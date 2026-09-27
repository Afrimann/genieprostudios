import { createClient } from "@/lib/supabase/server";
import type { BookingStatus } from "@/lib/services/booking-service";

// Shape the dashboard needs to render a booking card: enough of the booking
// itself plus the joined service label, per project-notes.md's Component ->
// Hook -> Service -> Repository layering (this repository is dumb data
// access only — no business rules, no status derivation, that lives in
// services/the webhook handler).
export type CustomerBooking = {
  id: string;
  serviceName: string;
  session_date: string;
  session_start_time: string;
  session_end_time: string;
  total_price_kobo: number;
  deposit_amount_kobo: number;
  amount_paid_kobo: number;
  status: BookingStatus;
};

// Matches the established repository return-shape convention: see
// getActiveServices()/getOpenDatesInRange() in
// lib/repositories/service-repository.ts and
// lib/repositories/availability-repository.ts, which throw on a genuine
// Supabase error and return a plain array (never a discriminated-union
// result) for reads — repositories don't wrap failures in typed results,
// that's a service-layer concern. An unauthenticated caller is treated the
// same as "nothing to show" (empty array) rather than an error, since
// "no bookings" and "not signed in" both simply mean nothing renders here;
// the page/layout is responsible for actually gating access to
// authenticated users in the first place (app/dashboard/layout.tsx,
// out of scope for this phase).
//
// Ordered by session_date descending (most recent/upcoming-first from the
// customer's perspective — a customer opening their dashboard cares most
// about the session closest at hand or most recently completed, not the
// oldest historical booking) with created_at descending as a tiebreaker for
// same-day bookings.
export async function getBookingsForCurrentCustomer(): Promise<CustomerBooking[]> {
  const supabase = await createClient();

  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData?.user) {
    return [];
  }

  // customer_id filter is explicit here for clarity/defense in depth even
  // though "bookings_select_own" RLS (0010_rls_policies.sql) already
  // restricts SELECT to customer_id = auth.uid() on its own.
  const { data, error } = await supabase
    .from("bookings")
    .select(
      `
        id,
        session_date,
        session_start_time,
        session_end_time,
        total_price_kobo,
        deposit_amount_kobo,
        amount_paid_kobo,
        status,
        services ( label )
      `,
    )
    .eq("customer_id", userData.user.id)
    .order("session_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`getBookingsForCurrentCustomer: ${error.message}`);
  }

  type JoinedRow = {
    id: string;
    session_date: string;
    session_start_time: string;
    session_end_time: string;
    total_price_kobo: number;
    deposit_amount_kobo: number;
    amount_paid_kobo: number;
    status: BookingStatus;
    services: { label: string } | { label: string }[] | null;
  };

  return ((data ?? []) as unknown as JoinedRow[]).map((row) => {
    // Supabase/PostgREST returns a joined to-one relationship as a single
    // object in most configurations, but the generated type can be an array
    // depending on how the FK relationship is inferred — handle both shapes
    // defensively rather than assuming one.
    const service = Array.isArray(row.services) ? row.services[0] : row.services;

    return {
      id: row.id,
      serviceName: service?.label ?? "Unknown service",
      session_date: row.session_date,
      session_start_time: row.session_start_time,
      session_end_time: row.session_end_time,
      total_price_kobo: row.total_price_kobo,
      deposit_amount_kobo: row.deposit_amount_kobo,
      amount_paid_kobo: row.amount_paid_kobo,
      status: row.status,
    };
  });
}
