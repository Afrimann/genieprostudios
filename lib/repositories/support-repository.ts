import { createClient } from "@/lib/supabase/server";

// Customer-facing "front desk" support repository — dumb data access only,
// relies entirely on RLS (support_tickets_select_own/support_messages_select_own,
// 0021_support_tickets.sql) for authorization, same convention as
// booking-repository.ts. Writes go through support-service.ts's RPC calls,
// never through this file.

export type SupportTicket = {
  id: string;
  customer_id: string;
  subject: string;
  status: "open" | "closed";
  last_message_at: string | null;
  last_message_role: "customer" | "admin" | null;
  created_at: string;
  closed_at: string | null;
};

export type SupportMessage = {
  id: string;
  ticket_id: string;
  sender_id: string;
  sender_role: "customer" | "admin";
  body: string;
  created_at: string;
};

/** The caller's single open ticket, if any — see the one-open-ticket-at-a-time rule (0021). */
export async function getMyOpenTicket(): Promise<SupportTicket | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("status", "open")
    .maybeSingle();

  if (error) {
    throw new Error(`getMyOpenTicket: ${error.message}`);
  }

  return (data as SupportTicket) ?? null;
}

/** Past conversations, most recently closed first. */
export async function getMyClosedTickets(): Promise<SupportTicket[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("status", "closed")
    .order("closed_at", { ascending: false });

  if (error) {
    throw new Error(`getMyClosedTickets: ${error.message}`);
  }

  return (data ?? []) as SupportTicket[];
}

/** Full message history for one ticket, oldest first — RLS scopes this to the caller's own ticket. */
export async function getTicketMessages(ticketId: string): Promise<SupportMessage[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("support_messages")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`getTicketMessages: ${error.message}`);
  }

  return (data ?? []) as SupportMessage[];
}

/** A single ticket by id — RLS scopes this to a ticket the caller owns. */
export async function getTicketById(ticketId: string): Promise<SupportTicket | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("id", ticketId)
    .maybeSingle();

  if (error) {
    throw new Error(`getTicketById: ${error.message}`);
  }

  return (data as SupportTicket) ?? null;
}
