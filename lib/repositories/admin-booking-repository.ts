import { createClient } from "@/lib/supabase/server";
import type { Booking, BookingStatus } from "@/lib/services/booking-service";

// Admin-facing booking repository — dumb data access only, same convention
// as availability-repository.ts. Relies on RLS (bookings_select_admin/
// bookings_update_admin/profiles_select_admin, 0010_rls_policies.sql) plus
// the RPCs' own internal is_admin() checks (0017_admin_unresolved_and_reschedule.sql)
// for authorization — this file adds no redundant admin check of its own,
// matching availability-actions.ts's existing pattern for admin-only actions.

export type UnresolvedBooking = {
  id: string;
  customerId: string;
  serviceId: string;
  slotId: string;
  sessionDate: string;
  sessionStartTime: string;
  sessionEndTime: string;
  totalPriceKobo: number;
  depositAmountKobo: number;
  amountPaidKobo: number;
  status: BookingStatus;
  customerName: string | null;
  customerEmail: string | null;
  serviceLabel: string;
};

type UnresolvedRpcRow = {
  id: string;
  customer_id: string;
  service_id: string;
  slot_id: string;
  session_date: string;
  session_start_time: string;
  session_end_time: string;
  total_price_kobo: number;
  deposit_amount_kobo: number;
  amount_paid_kobo: number;
  status: BookingStatus;
};

/**
 * Bookings whose session already started/passed with an unpaid balance —
 * see bookings_unresolved_past_sessions() (0017) for the exact predicate.
 * Hydrated with customer/service display info the admin UI needs, via two
 * batch `in (...)` lookups (same shape as reminder-repository.ts's hydrate())
 * rather than N+1 per-row joins.
 */
export async function getUnresolvedPastSessions(): Promise<UnresolvedBooking[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("bookings_unresolved_past_sessions");

  if (error) {
    throw new Error(`getUnresolvedPastSessions: ${error.message}`);
  }

  const rows = (data ?? []) as UnresolvedRpcRow[];

  if (rows.length === 0) {
    return [];
  }

  const customerIds = [...new Set(rows.map((r) => r.customer_id))];
  const serviceIds = [...new Set(rows.map((r) => r.service_id))];

  const [{ data: profiles, error: profilesError }, { data: services, error: servicesError }] =
    await Promise.all([
      supabase.from("profiles").select("id, full_name, email").in("id", customerIds),
      supabase.from("services").select("id, label").in("id", serviceIds),
    ]);

  if (profilesError) {
    throw new Error(`getUnresolvedPastSessions: profiles lookup failed: ${profilesError.message}`);
  }

  if (servicesError) {
    throw new Error(`getUnresolvedPastSessions: services lookup failed: ${servicesError.message}`);
  }

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const serviceById = new Map((services ?? []).map((s) => [s.id, s]));

  return rows.map((row) => {
    const profile = profileById.get(row.customer_id);
    const service = serviceById.get(row.service_id);

    return {
      id: row.id,
      customerId: row.customer_id,
      serviceId: row.service_id,
      slotId: row.slot_id,
      sessionDate: row.session_date,
      sessionStartTime: row.session_start_time,
      sessionEndTime: row.session_end_time,
      totalPriceKobo: row.total_price_kobo,
      depositAmountKobo: row.deposit_amount_kobo,
      amountPaidKobo: row.amount_paid_kobo,
      status: row.status,
      customerName: profile?.full_name ?? null,
      customerEmail: profile?.email ?? null,
      serviceLabel: service?.label ?? "Unknown service",
    };
  });
}

/**
 * Marks a still-''deposited'' unresolved booking as stale (status ->
 * 'auto_cancelled') — the same terminal state the automated 24h sweep uses
 * for the same underlying reason (unpaid balance), just admin-triggered
 * instead of cron-triggered. The `.eq("status", "deposited")` guard makes
 * this a safe no-op (returns null, not an error) if the booking already
 * moved on (paid in full, already marked stale, etc.) between the admin's
 * page load and this click — no separate read-then-write race window.
 */
export async function markBookingStale(bookingId: string): Promise<Booking | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("bookings")
    .update({ status: "auto_cancelled" })
    .eq("id", bookingId)
    .eq("status", "deposited")
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`markBookingStale: ${error.message}`);
  }

  return (data as Booking) ?? null;
}

// ---------------------------------------------------------------------------
// Full bookings list + detail — the "order admin" view: every booking (not
// just unresolved ones), and a per-booking detail page with everything
// attached to it (customer, service, the window it was carved from, its full
// payment history, its T&Cs acceptance record).
// ---------------------------------------------------------------------------

export type AdminBookingListItem = {
  id: string;
  customerName: string | null;
  customerEmail: string | null;
  serviceLabel: string;
  sessionDate: string;
  sessionStartTime: string;
  sessionEndTime: string;
  totalPriceKobo: number;
  amountPaidKobo: number;
  status: BookingStatus;
  createdAt: string;
};

/** Every booking, newest first, hydrated with customer/service names — same batch-`in(...)` hydrate pattern as getUnresolvedPastSessions() above. */
export async function getAllBookingsForAdmin(): Promise<AdminBookingListItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, customer_id, service_id, session_date, session_start_time, session_end_time, total_price_kobo, amount_paid_kobo, status, created_at",
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`getAllBookingsForAdmin: ${error.message}`);
  }

  const rows = data ?? [];

  if (rows.length === 0) {
    return [];
  }

  const customerIds = [...new Set(rows.map((r) => r.customer_id))];
  const serviceIds = [...new Set(rows.map((r) => r.service_id))];

  const [{ data: profiles, error: profilesError }, { data: services, error: servicesError }] =
    await Promise.all([
      supabase.from("profiles").select("id, full_name, email").in("id", customerIds),
      supabase.from("services").select("id, label").in("id", serviceIds),
    ]);

  if (profilesError) {
    throw new Error(`getAllBookingsForAdmin: profiles lookup failed: ${profilesError.message}`);
  }
  if (servicesError) {
    throw new Error(`getAllBookingsForAdmin: services lookup failed: ${servicesError.message}`);
  }

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const serviceById = new Map((services ?? []).map((s) => [s.id, s]));

  return rows.map((row) => {
    const profile = profileById.get(row.customer_id);
    const service = serviceById.get(row.service_id);

    return {
      id: row.id,
      customerName: profile?.full_name ?? null,
      customerEmail: profile?.email ?? null,
      serviceLabel: service?.label ?? "Unknown service",
      sessionDate: row.session_date,
      sessionStartTime: row.session_start_time,
      sessionEndTime: row.session_end_time,
      totalPriceKobo: row.total_price_kobo,
      amountPaidKobo: row.amount_paid_kobo,
      status: row.status,
      createdAt: row.created_at,
    };
  });
}

export type AdminBookingDetail = {
  id: string;
  status: BookingStatus;
  createdAt: string;
  updatedAt: string;
  sessionDate: string;
  sessionStartTime: string;
  sessionEndTime: string;
  totalPriceKobo: number;
  depositAmountKobo: number;
  amountPaidKobo: number;
  customer: { id: string; name: string | null; email: string | null; phone: string | null };
  service: {
    id: string;
    label: string;
    category: string;
    durationHours: number;
    priceKobo: number;
    isAddon: boolean;
  };
  window: { id: string; date: string; startTime: string; endTime: string; status: string } | null;
  payments: {
    id: string;
    paystackReference: string;
    type: string;
    amountKobo: number;
    status: string;
    verifiedAt: string | null;
    createdAt: string;
  }[];
  tcAcceptance: { termsVersion: string; acceptedAt: string; ipAddress: string | null } | null;
};

/**
 * Everything attached to a single booking, for the /admin/bookings/[id]
 * "order detail" page — the booking row itself plus five independent
 * lookups (customer, service, the window it was carved from, every payment
 * ever recorded against it, and its T&Cs acceptance record). Returns null
 * (not a throw) if the booking id doesn't exist, so the page can render a
 * clean "not found" rather than an error boundary.
 */
export async function getBookingDetailForAdmin(bookingId: string): Promise<AdminBookingDetail | null> {
  const supabase = await createClient();

  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", bookingId)
    .maybeSingle();

  if (bookingError) {
    throw new Error(`getBookingDetailForAdmin: ${bookingError.message}`);
  }

  if (!booking) {
    return null;
  }

  const [profileRes, serviceRes, windowRes, paymentsRes, tcRes] = await Promise.all([
    supabase.from("profiles").select("full_name, email, phone").eq("id", booking.customer_id).maybeSingle(),
    supabase
      .from("services")
      .select("id, label, category, duration_hours, price_kobo, is_addon")
      .eq("id", booking.service_id)
      .maybeSingle(),
    supabase
      .from("availability_slots")
      .select("id, date, start_time, end_time, status")
      .eq("id", booking.slot_id)
      .maybeSingle(),
    supabase
      .from("payments")
      .select("id, paystack_reference, type, amount_kobo, status, verified_at, created_at")
      .eq("booking_id", bookingId)
      .order("created_at", { ascending: false }),
    booking.tc_acceptance_id
      ? supabase
          .from("tc_acceptances")
          .select("terms_version, accepted_at, ip_address")
          .eq("id", booking.tc_acceptance_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (profileRes.error) {
    throw new Error(`getBookingDetailForAdmin: profile lookup failed: ${profileRes.error.message}`);
  }
  if (serviceRes.error) {
    throw new Error(`getBookingDetailForAdmin: service lookup failed: ${serviceRes.error.message}`);
  }
  if (windowRes.error) {
    throw new Error(`getBookingDetailForAdmin: window lookup failed: ${windowRes.error.message}`);
  }
  if (paymentsRes.error) {
    throw new Error(`getBookingDetailForAdmin: payments lookup failed: ${paymentsRes.error.message}`);
  }
  if (tcRes.error) {
    throw new Error(`getBookingDetailForAdmin: tc_acceptance lookup failed: ${tcRes.error.message}`);
  }

  const service = serviceRes.data;
  const window = windowRes.data;
  const tc = tcRes.data;

  return {
    id: booking.id,
    status: booking.status,
    createdAt: booking.created_at,
    updatedAt: booking.updated_at,
    sessionDate: booking.session_date,
    sessionStartTime: booking.session_start_time,
    sessionEndTime: booking.session_end_time,
    totalPriceKobo: booking.total_price_kobo,
    depositAmountKobo: booking.deposit_amount_kobo,
    amountPaidKobo: booking.amount_paid_kobo,
    customer: {
      id: booking.customer_id,
      name: profileRes.data?.full_name ?? null,
      email: profileRes.data?.email ?? null,
      phone: profileRes.data?.phone ?? null,
    },
    service: service
      ? {
          id: service.id,
          label: service.label,
          category: service.category,
          durationHours: service.duration_hours,
          priceKobo: service.price_kobo,
          isAddon: service.is_addon,
        }
      : {
          id: booking.service_id,
          label: "Unknown service",
          category: "",
          durationHours: 0,
          priceKobo: 0,
          isAddon: false,
        },
    window: window
      ? { id: window.id, date: window.date, startTime: window.start_time, endTime: window.end_time, status: window.status }
      : null,
    payments: (paymentsRes.data ?? []).map((p) => ({
      id: p.id,
      paystackReference: p.paystack_reference,
      type: p.type,
      amountKobo: p.amount_kobo,
      status: p.status,
      verifiedAt: p.verified_at,
      createdAt: p.created_at,
    })),
    tcAcceptance: tc
      ? { termsVersion: tc.terms_version, acceptedAt: tc.accepted_at, ipAddress: tc.ip_address }
      : null,
  };
}
