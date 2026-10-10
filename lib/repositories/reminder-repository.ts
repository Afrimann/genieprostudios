import { createAdminClient } from "@/lib/supabase/admin";

// Dumb data access for the Phase 4 daily sweep (balance reminders,
// auto-cancel, stale-pending cleanup). Always uses the service-role client:
// there is no user session in a cron context, and none of these rows are
// meant to be readable/writable by an authenticated customer anyway (see
// 0010_rls_policies.sql's "no policy at all" note on reminder_log, and
// bookings' "deliberately no insert/update/delete policy for plain
// customers"). Matches booking-repository.ts's convention: throw on a
// genuine Supabase error, return a plain typed array/void otherwise — no
// business rules live here, that's lib/services/reminder-service.ts's job.

// Row shape returned by all three bookings_needing_*/stale_pending_bookings
// RPCs defined in supabase/migrations/0016_session_start_at_helper.sql,
// hydrated with exactly what the email templates in
// lib/services/email-service.ts need: the customer's name/email and the
// service's label/duration. amount_paid_kobo/total/deposit stay in kobo
// (bigint-as-number over the wire, same caveat as service-repository.ts's
// Service type) so the service layer can compute the outstanding balance
// itself rather than trusting a precomputed value from here.
export type SweepBooking = {
  id: string;
  customerId: string;
  serviceId: string;
  sessionDate: string;
  sessionStartTime: string;
  sessionEndDate: string;
  sessionEndTime: string;
  totalPriceKobo: number;
  depositAmountKobo: number;
  amountPaidKobo: number;
  customerName: string | null;
  customerEmail: string | null;
  serviceLabel: string;
  serviceDurationHours: number;
};

// Matches the column set every bookings_needing_*/stale_pending_bookings RPC
// returns (0016_session_start_at_helper.sql, extended with session_end_date
// by 0038_sweep_functions_session_end_date.sql) — all three share this
// exact shape by design, so one hydration helper below works for all of
// them.
type RpcBookingRow = {
  id: string;
  customer_id: string;
  service_id: string;
  session_date: string;
  session_start_time: string;
  session_end_date: string;
  session_end_time: string;
  total_price_kobo: number;
  deposit_amount_kobo: number;
  amount_paid_kobo: number;
};

/**
 * Joins in profiles (customer name/email) and services (label/duration) for
 * a batch of RPC rows, via two extra queries (one `in (...)` each) rather
 * than N+1 per-row lookups. Missing profile/service data degrades to
 * null/fallback values instead of throwing — a booking with a missing join
 * target is still a real booking that needs its status transitioned by the
 * service layer; only the email content is degraded, and email-service.ts
 * already tolerates a customer with no name (falls back to a generic
 * greeting) — see its JSDoc.
 */
async function hydrate(
  admin: ReturnType<typeof createAdminClient>,
  rows: RpcBookingRow[],
): Promise<SweepBooking[]> {
  if (rows.length === 0) {
    return [];
  }

  const customerIds = [...new Set(rows.map((r) => r.customer_id))];
  const serviceIds = [...new Set(rows.map((r) => r.service_id))];

  const [{ data: profiles, error: profilesError }, { data: services, error: servicesError }] =
    await Promise.all([
      admin.from("profiles").select("id, full_name, email").in("id", customerIds),
      admin.from("services").select("id, label, duration_hours").in("id", serviceIds),
    ]);

  if (profilesError) {
    throw new Error(`reminder-repository.hydrate: profiles lookup failed: ${profilesError.message}`);
  }

  if (servicesError) {
    throw new Error(`reminder-repository.hydrate: services lookup failed: ${servicesError.message}`);
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
      sessionDate: row.session_date,
      sessionStartTime: row.session_start_time,
      sessionEndDate: row.session_end_date,
      sessionEndTime: row.session_end_time,
      totalPriceKobo: row.total_price_kobo,
      depositAmountKobo: row.deposit_amount_kobo,
      amountPaidKobo: row.amount_paid_kobo,
      customerName: profile?.full_name ?? null,
      customerEmail: profile?.email ?? null,
      serviceLabel: service?.label ?? "Unknown service",
      serviceDurationHours: service?.duration_hours ?? 0,
    };
  });
}

/**
 * Deposited bookings due a 24h balance reminder (see
 * bookings_needing_balance_reminder() for the exact predicate, including the
 * reminder_log dedupe window) — hydrated with customer/service info for
 * sendBalanceReminderEmail().
 */
export async function getBookingsNeedingBalanceReminder(): Promise<SweepBooking[]> {
  const admin = createAdminClient();

  const { data, error } = await admin.rpc("bookings_needing_balance_reminder");

  if (error) {
    throw new Error(`getBookingsNeedingBalanceReminder: ${error.message}`);
  }

  return hydrate(admin, (data ?? []) as RpcBookingRow[]);
}

/**
 * Deposited bookings whose session start is within 24h (or already past),
 * balance still outstanding — due for auto-cancellation. See
 * bookings_needing_autocancel().
 */
export async function getBookingsNeedingAutoCancel(): Promise<SweepBooking[]> {
  const admin = createAdminClient();

  const { data, error } = await admin.rpc("bookings_needing_autocancel");

  if (error) {
    throw new Error(`getBookingsNeedingAutoCancel: ${error.message}`);
  }

  return hydrate(admin, (data ?? []) as RpcBookingRow[]);
}

/**
 * Bookings still pending_deposit more than 30 minutes after creation —
 * abandoned checkouts with no payment ever received. See
 * stale_pending_bookings().
 */
export async function getStalePendingBookings(): Promise<SweepBooking[]> {
  const admin = createAdminClient();

  const { data, error } = await admin.rpc("stale_pending_bookings");

  if (error) {
    throw new Error(`getStalePendingBookings: ${error.message}`);
  }

  return hydrate(admin, (data ?? []) as RpcBookingRow[]);
}

/**
 * Records that a reminder of the given type was sent for a booking, so the
 * bookings_needing_balance_reminder() dedupe window (reminder_log.sent_at >
 * now() - interval '24 hours') can suppress a duplicate send on the next
 * run. Callers (reminder-service.ts) must only call this AFTER a successful
 * email send — never speculatively before, or a failed send would be
 * wrongly treated as already-notified and skipped on the next sweep.
 */
export async function insertReminderLog(bookingId: string, type: string): Promise<void> {
  const admin = createAdminClient();

  const { error } = await admin.from("reminder_log").insert({
    booking_id: bookingId,
    type,
  });

  if (error) {
    throw new Error(`insertReminderLog: ${error.message}`);
  }
}

/**
 * Moves a booking to auto_cancelled — the 24h-before-session unpaid-balance
 * cancellation. Only updates bookings.status: there is no slot-release step,
 * since availability_slots is never flipped to 'booked' on booking creation
 * anymore (0014_booking_windows.sql) — see bookings_needing_autocancel()'s
 * comment.
 */
export async function markBookingAutoCancelled(bookingId: string): Promise<void> {
  const admin = createAdminClient();

  const { error } = await admin
    .from("bookings")
    .update({ status: "auto_cancelled" })
    .eq("id", bookingId);

  if (error) {
    throw new Error(`markBookingAutoCancelled: ${error.message}`);
  }
}

/**
 * Moves a booking to cancelled — the stale-pending (abandoned checkout)
 * cleanup. Distinct status from auto_cancelled by design: same "no
 * slot-release step" note applies here too.
 */
export async function markBookingCancelled(bookingId: string): Promise<void> {
  const admin = createAdminClient();

  const { error } = await admin.from("bookings").update({ status: "cancelled" }).eq("id", bookingId);

  if (error) {
    throw new Error(`markBookingCancelled: ${error.message}`);
  }
}
