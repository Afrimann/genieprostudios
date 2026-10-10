import { createClient } from "@/lib/supabase/server";
import type { BookingStatus } from "@/lib/services/booking-service";

// Admin-facing customer repository — dumb data access only, same convention
// as admin-booking-repository.ts. Relies on RLS (bookings_select_admin/
// profiles_select_admin, 0010_rls_policies.sql) for authorization; adds no
// redundant admin check of its own.
//
// "Has booked" is defined the same way admin-booking-repository.ts's
// getAllBookingsForAdmin() defines "a sale": any booking that isn't still
// 'pending_deposit' (owner request, 2026-10-10 — an unpaid booking isn't a
// real booking yet). Keeping this definition identical across both pages
// means a customer who shows up in /admin/bookings also shows up in
// /admin/customers, and vice versa — no silent mismatch between the two.

export type AdminCustomerListItem = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  bookingCount: number;
  lastBookingAt: string;
};

type BookingForCustomerRollup = {
  customer_id: string;
  created_at: string;
};

/**
 * Every customer with at least one non-pending_deposit booking, newest
 * activity first. Built from a single bookings query rolled up client-side
 * (group-by isn't expressible via supabase-js's query builder) rather than
 * N+1 per-customer queries — the bookings table is small enough for this
 * project's scale that a single full scan plus an `in (...)` profile lookup
 * is simpler than a dedicated SQL view, matching this file's "dumb data
 * access" convention.
 */
export async function getCustomersWithBookings(): Promise<AdminCustomerListItem[]> {
  const supabase = await createClient();

  const { data: bookingRows, error: bookingsError } = await supabase
    .from("bookings")
    .select("customer_id, created_at")
    .neq("status", "pending_deposit")
    .order("created_at", { ascending: false });

  if (bookingsError) {
    throw new Error(`getCustomersWithBookings: ${bookingsError.message}`);
  }

  const rows = (bookingRows ?? []) as BookingForCustomerRollup[];

  if (rows.length === 0) {
    return [];
  }

  const rollupByCustomerId = new Map<string, { count: number; lastBookingAt: string }>();

  for (const row of rows) {
    const existing = rollupByCustomerId.get(row.customer_id);
    if (existing) {
      existing.count += 1;
      // Rows are already newest-first, so the first time we see a customer
      // is their most recent booking — later rows for the same customer
      // are always older and must never overwrite lastBookingAt.
    } else {
      rollupByCustomerId.set(row.customer_id, { count: 1, lastBookingAt: row.created_at });
    }
  }

  const customerIds = [...rollupByCustomerId.keys()];

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone")
    .in("id", customerIds);

  if (profilesError) {
    throw new Error(`getCustomersWithBookings: profiles lookup failed: ${profilesError.message}`);
  }

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  return customerIds
    .map((id) => {
      const profile = profileById.get(id);
      const rollup = rollupByCustomerId.get(id)!;

      return {
        id,
        name: profile?.full_name ?? null,
        email: profile?.email ?? null,
        phone: profile?.phone ?? null,
        bookingCount: rollup.count,
        lastBookingAt: rollup.lastBookingAt,
      };
    })
    .sort((a, b) => new Date(b.lastBookingAt).getTime() - new Date(a.lastBookingAt).getTime());
}

export type AdminCustomerDetail = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  bookings: {
    id: string;
    serviceLabel: string;
    sessionDate: string | null;
    sessionStartTime: string | null;
    sessionEndTime: string | null;
    sessionEndDate: string | null;
    totalPriceKobo: number;
    amountPaidKobo: number;
    status: BookingStatus;
    createdAt: string;
  }[];
};

/**
 * One customer's profile plus every non-pending_deposit booking they've
 * made, newest first — backs /admin/customers/[id]. Returns null if the
 * profile doesn't exist (bad id) rather than throwing, same convention as
 * getBookingDetailForAdmin in admin-booking-repository.ts.
 */
export async function getCustomerDetailForAdmin(
  customerId: string,
): Promise<AdminCustomerDetail | null> {
  const supabase = await createClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone")
    .eq("id", customerId)
    .maybeSingle();

  if (profileError) {
    throw new Error(`getCustomerDetailForAdmin: profile lookup failed: ${profileError.message}`);
  }

  if (!profile) {
    return null;
  }

  const { data: bookingRows, error: bookingsError } = await supabase
    .from("bookings")
    .select(
      "id, service_id, session_date, session_start_time, session_end_date, session_end_time, total_price_kobo, amount_paid_kobo, status, created_at",
    )
    .eq("customer_id", customerId)
    .neq("status", "pending_deposit")
    .order("created_at", { ascending: false });

  if (bookingsError) {
    throw new Error(`getCustomerDetailForAdmin: bookings lookup failed: ${bookingsError.message}`);
  }

  const rows = bookingRows ?? [];
  const serviceIds = [...new Set(rows.map((r) => r.service_id))];

  const { data: services, error: servicesError } = await supabase
    .from("services")
    .select("id, label")
    .in("id", serviceIds.length > 0 ? serviceIds : [""]);

  if (servicesError) {
    throw new Error(`getCustomerDetailForAdmin: services lookup failed: ${servicesError.message}`);
  }

  const serviceById = new Map((services ?? []).map((s) => [s.id, s]));

  return {
    id: profile.id,
    name: profile.full_name,
    email: profile.email,
    phone: profile.phone,
    bookings: rows.map((row) => ({
      id: row.id,
      serviceLabel: serviceById.get(row.service_id)?.label ?? "Unknown service",
      sessionDate: row.session_date,
      sessionStartTime: row.session_start_time,
      sessionEndTime: row.session_end_time,
      sessionEndDate: row.session_end_date,
      totalPriceKobo: row.total_price_kobo,
      amountPaidKobo: row.amount_paid_kobo,
      status: row.status,
      createdAt: row.created_at,
    })),
  };
}
