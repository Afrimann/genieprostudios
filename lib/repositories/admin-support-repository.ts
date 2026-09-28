import { createClient } from "@/lib/supabase/server";
import type { SupportMessage, SupportTicket } from "@/lib/repositories/support-repository";

// Admin-facing "front desk" support repository — dumb data access only,
// relies on RLS (support_tickets_select_admin/support_messages_select_admin,
// 0021_support_tickets.sql) for authorization, same convention as
// admin-booking-repository.ts.

export type AdminSupportTicket = SupportTicket & {
  customerName: string | null;
  customerEmail: string | null;
};

/**
 * Every ticket, open first (most recently messaged first within each
 * group), then closed — mirrors AllBookingsTable's "order admin" style in
 * app/admin/(protected)/bookings/page.tsx. Hydrated with customer display
 * info via a single batch `in (...)` lookup, same pattern as
 * getUnresolvedPastSessions() in admin-booking-repository.ts.
 */
export async function getAllTicketsForAdmin(): Promise<AdminSupportTicket[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("support_tickets")
    .select("*")
    .order("status", { ascending: true }) // 'closed' < 'open' alphabetically is wrong; see below
    .order("last_message_at", { ascending: false, nullsFirst: false });

  if (error) {
    throw new Error(`getAllTicketsForAdmin: ${error.message}`);
  }

  const tickets = (data ?? []) as SupportTicket[];
  // 'open' should sort before 'closed' — the .order("status") call above
  // sorts alphabetically ('closed' < 'open'), so re-sort here instead of
  // fighting Postgres text ordering with a CASE expression for two values.
  tickets.sort((a, b) => (a.status === b.status ? 0 : a.status === "open" ? -1 : 1));

  if (tickets.length === 0) {
    return [];
  }

  const customerIds = [...new Set(tickets.map((t) => t.customer_id))];
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", customerIds);

  if (profilesError) {
    throw new Error(`getAllTicketsForAdmin: profiles lookup failed: ${profilesError.message}`);
  }

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  return tickets.map((ticket) => {
    const profile = profileById.get(ticket.customer_id);
    return {
      ...ticket,
      customerName: profile?.full_name ?? null,
      customerEmail: profile?.email ?? null,
    };
  });
}

/**
 * The AdminShell "Support" nav badge count — open tickets where the
 * customer sent the most recent message, i.e. genuinely awaiting an admin
 * reply (mirrors getUnresolvedCount()'s role in app/admin/(protected)/layout.tsx).
 */
export async function getOpenTicketsAwaitingReplyCount(): Promise<number> {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("support_tickets")
    .select("id", { count: "exact", head: true })
    .eq("status", "open")
    .eq("last_message_role", "customer");

  if (error) {
    throw new Error(`getOpenTicketsAwaitingReplyCount: ${error.message}`);
  }

  return count ?? 0;
}

export async function getTicketForAdmin(ticketId: string): Promise<AdminSupportTicket | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("id", ticketId)
    .maybeSingle();

  if (error) {
    throw new Error(`getTicketForAdmin: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", data.customer_id)
    .maybeSingle();

  if (profileError) {
    throw new Error(`getTicketForAdmin: profile lookup failed: ${profileError.message}`);
  }

  return {
    ...(data as SupportTicket),
    customerName: profile?.full_name ?? null,
    customerEmail: profile?.email ?? null,
  };
}

/** Same shape/order as getTicketMessages() in support-repository.ts, admin-scoped via RLS. */
export async function getTicketMessagesForAdmin(ticketId: string): Promise<SupportMessage[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("support_messages")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`getTicketMessagesForAdmin: ${error.message}`);
  }

  return (data ?? []) as SupportMessage[];
}
