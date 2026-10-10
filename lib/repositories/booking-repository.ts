import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Booking, BookingStatus } from "@/lib/services/booking-service";
import { getTracksForBooking } from "@/lib/repositories/booking-tracks-repository";

// Shape the dashboard needs to render a booking card: enough of the booking
// itself plus the joined service label, per project-notes.md's Component ->
// Hook -> Service -> Repository layering (this repository is dumb data
// access only — no business rules, no status derivation, that lives in
// services/the webhook handler).
// session_date/session_start_time/session_end_date/session_end_time are
// null for an is_addon booking (per-song mixing/mastering) — no studio
// room time was reserved. See
// supabase/migrations/0036_blocked_time_ranges.sql's updated consistency
// check.
export type CustomerBooking = {
  id: string;
  serviceName: string;
  session_date: string | null;
  session_start_time: string | null;
  session_end_date: string | null;
  session_end_time: string | null;
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
// Ordered by created_at descending — most recently made booking first,
// matching the order the customer actually created them in (not session
// date, which could otherwise put an older booking for a far-future session
// above one made minutes ago for an earlier date).
//
// Excludes status='cancelled': per the "only a verified deposit or full
// payment should be allowed to keep a booked time" rule, a 'cancelled'
// booking is by construction one that NEVER had a successful payment land
// on it (stale-pending cleanup, a verified-failed payment, or the
// customer's own opt-out cancel — see cancelOwnPendingBooking below) — it
// was never really a booking from the customer's perspective, just an
// abandoned attempt, so it shouldn't clutter this list. 'auto_cancelled' is
// deliberately still shown: that status means a deposit WAS actually paid
// and the booking later fell through for non-payment of the balance —
// that's a real event worth the customer seeing in their history.
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
        session_end_date,
        session_end_time,
        total_price_kobo,
        deposit_amount_kobo,
        amount_paid_kobo,
        status,
        services ( label )
      `,
    )
    .eq("customer_id", userData.user.id)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`getBookingsForCurrentCustomer: ${error.message}`);
  }

  type JoinedRow = {
    id: string;
    session_date: string | null;
    session_start_time: string | null;
    session_end_date: string | null;
    session_end_time: string | null;
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
      session_end_date: row.session_end_date,
      session_end_time: row.session_end_time,
      total_price_kobo: row.total_price_kobo,
      deposit_amount_kobo: row.deposit_amount_kobo,
      amount_paid_kobo: row.amount_paid_kobo,
      status: row.status,
    };
  });
}

// ---------------------------------------------------------------------------
// Single-booking detail, scoped to the current customer — the "your
// bookings" list card's click-through target. Mirrors the shape of
// admin-booking-repository.ts's getBookingDetailForAdmin(), minus internal
// Paystack references, but keeps the customer's own payment history —
// reasonable for them to see what they've actually paid and when.
// ---------------------------------------------------------------------------

// sessionDate/sessionStartTime/sessionEndDate/sessionEndTime are null for
// an is_addon booking — see CustomerBooking above.
export type CustomerBookingDetail = {
  id: string;
  status: BookingStatus;
  createdAt: string;
  sessionDate: string | null;
  sessionStartTime: string | null;
  sessionEndDate: string | null;
  sessionEndTime: string | null;
  totalPriceKobo: number;
  depositAmountKobo: number;
  amountPaidKobo: number;
  service: { label: string; durationHours: number; isAddon: boolean };
  payments: { id: string; type: string; amountKobo: number; status: string; createdAt: string }[];
  // Only ever populated for an is_addon booking (see booking_tracks,
  // 0020_addon_song_details.sql) — empty for a room booking.
  tracks: { title: string }[];
};

/**
 * Fetches one booking's full detail, scoped to the authenticated customer.
 * Relies on bookings_select_own / payments_select_own RLS
 * (0010_rls_policies.sql) to make "not mine" and "doesn't exist"
 * indistinguishable from the outside — both simply return null here, same
 * defensive pattern as payment-service.ts's initializePayment().
 */
export async function getBookingDetailForCustomer(
  bookingId: string,
): Promise<CustomerBookingDetail | null> {
  const supabase = await createClient();

  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData?.user) {
    return null;
  }

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select(
      `
        id,
        status,
        created_at,
        session_date,
        session_start_time,
        session_end_date,
        session_end_time,
        total_price_kobo,
        deposit_amount_kobo,
        amount_paid_kobo,
        services ( label, duration_hours, is_addon )
      `,
    )
    .eq("id", bookingId)
    .eq("customer_id", userData.user.id)
    .maybeSingle();

  if (bookingError) {
    throw new Error(`getBookingDetailForCustomer: ${bookingError.message}`);
  }

  if (!booking) {
    return null;
  }

  const { data: payments, error: paymentsError } = await supabase
    .from("payments")
    .select("id, type, amount_kobo, status, created_at")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false });

  if (paymentsError) {
    throw new Error(`getBookingDetailForCustomer: payments lookup failed: ${paymentsError.message}`);
  }

  type ServiceJoin = { label: string; duration_hours: number; is_addon: boolean };
  const serviceJoin = booking.services as ServiceJoin | ServiceJoin[] | null;
  const service = Array.isArray(serviceJoin) ? serviceJoin[0] : serviceJoin;

  const tracks = service?.is_addon ? await getTracksForBooking(bookingId) : [];

  return {
    id: booking.id,
    status: booking.status,
    createdAt: booking.created_at,
    sessionDate: booking.session_date,
    sessionStartTime: booking.session_start_time,
    sessionEndDate: booking.session_end_date,
    sessionEndTime: booking.session_end_time,
    totalPriceKobo: booking.total_price_kobo,
    depositAmountKobo: booking.deposit_amount_kobo,
    amountPaidKobo: booking.amount_paid_kobo,
    service: {
      label: service?.label ?? "Unknown service",
      durationHours: service?.duration_hours ?? 0,
      isAddon: service?.is_addon ?? false,
    },
    payments: (payments ?? []).map((p) => ({
      id: p.id,
      type: p.type,
      amountKobo: p.amount_kobo,
      status: p.status,
      createdAt: p.created_at,
    })),
    tracks: tracks.map((t) => ({ title: t.title })),
  };
}

/**
 * Customer opt-out: "the user should be able to opt out of making that
 * booking request." Only ever moves a booking pending_deposit -> cancelled
 * — once a deposit has actually landed (status is 'deposited' or beyond),
 * cancelling is no longer self-service (the studio's no-refund/reschedule-fee
 * terms, shown during checkout, apply from that point on).
 *
 * Uses the admin client for the write (customers have no UPDATE policy on
 * bookings.status, per 0010_rls_policies.sql — the same reason
 * markBookingStale in admin-booking-repository.ts does), but ownership is
 * enforced explicitly via .eq("customer_id", ...) sourced from the caller's
 * own authenticated session (the RLS-scoped client's auth.getUser()), so
 * this can never cancel another customer's booking. The
 * .eq("status", "pending_deposit") guard makes an already-resolved booking
 * (paid, already cancelled, etc.) a safe no-op — returns null, not an
 * error — rather than a race condition with e.g. a webhook confirming
 * payment at the same moment.
 */
export async function cancelOwnPendingBooking(bookingId: string): Promise<Booking | null> {
  const supabase = await createClient();

  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData?.user) {
    return null;
  }

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("id", bookingId)
    .eq("customer_id", userData.user.id)
    .eq("status", "pending_deposit")
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`cancelOwnPendingBooking: ${error.message}`);
  }

  return (data as Booking) ?? null;
}
