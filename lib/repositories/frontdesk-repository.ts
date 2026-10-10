import { createClient } from "@/lib/supabase/server";
import { lagosDateOffset, lagosInstantIso, lagosToday } from "@/lib/utils/lagos-time";

// Front desk data access — dumb reads only, same convention as
// admin-booking-repository.ts. Authorization is RLS
// (bookings_select_frontdesk / profiles_select_frontdesk /
// services_select_frontdesk / session_attendance_select_frontdesk, see
// 0032_frontdesk_role.sql and 0033_session_attendance.sql) plus the
// frontdesk_* RPCs' own can_use_frontdesk() checks. This file adds no
// redundant role check of its own.

export type FrontdeskSessionState = "awaiting" | "in_progress" | "completed" | "no_show";

export type FrontdeskSession = {
  bookingId: string;
  customerName: string | null;
  customerPhone: string | null;
  serviceLabel: string;
  sessionDate: string;
  sessionStartTime: string;
  sessionEndTime: string;
  /**
   * Real instants derived from the naive Lagos columns — see
   * lib/utils/lagos-time.ts. endAtIso uses session_end_date (0036) directly
   * rather than guessing a midnight wrap from the raw times, since a
   * session may now legitimately span two calendar days.
   */
  startAtIso: string;
  endAtIso: string;
  /** Still owed right now, in kobo. 0 when paid in full. */
  balanceKobo: number;
  state: FrontdeskSessionState;
  clockedInAtIso: string | null;
  clockedOutAtIso: string | null;
  noShowAtIso: string | null;
  /** Balance frozen at clock-in — see session_attendance.clock_in_balance_kobo. */
  clockInBalanceKobo: number | null;
  note: string | null;
  /** True when this session's scheduled date is not today in Lagos (i.e. it ran past midnight). */
  isCarriedOver: boolean;
};

type BookingRow = {
  id: string;
  customer_id: string;
  service_id: string;
  session_date: string;
  session_start_time: string;
  session_end_date: string;
  session_end_time: string;
  total_price_kobo: number | string;
  amount_paid_kobo: number | string;
};

type AttendanceRow = {
  booking_id: string;
  clocked_in_at: string | null;
  clocked_out_at: string | null;
  no_show_at: string | null;
  clock_in_balance_kobo: number | string | null;
  note: string | null;
};

function deriveState(attendance: AttendanceRow | undefined): FrontdeskSessionState {
  // Mirrors the derivation documented on the session_attendance table: no row
  // at all means nobody has touched this session yet. Deliberately not a
  // stored column — a stored status and these timestamps could disagree.
  if (!attendance) return "awaiting";
  if (attendance.clocked_out_at) return "completed";
  if (attendance.clocked_in_at) return "in_progress";
  if (attendance.no_show_at) return "no_show";
  return "awaiting";
}

/**
 * Every session the front desk should be looking at right now:
 *
 *   - everything scheduled for today in Lagos, whatever its state; plus
 *   - yesterday's sessions that are still in progress — a session that
 *     started at 22:00 and runs past midnight still has to be clocked out,
 *     and it would otherwise vanish off the board mid-session.
 *
 * Yesterday's already-finished sessions are dropped (the desk is done with
 * them) and tomorrow's are not fetched at all. Note the RLS window in 0032 is
 * deliberately wider than this query — a ±1 day policy is a coarse, stable
 * security boundary, while exactly what the board shows is a product
 * decision that can change here without touching a policy.
 */
export async function getFrontdeskBoard(): Promise<FrontdeskSession[]> {
  const supabase = await createClient();

  const today = lagosToday();
  const yesterday = lagosDateOffset(-1);

  const { data: bookingData, error: bookingError } = await supabase
    .from("bookings")
    .select(
      "id, customer_id, service_id, session_date, session_start_time, session_end_date, session_end_time, total_price_kobo, amount_paid_kobo",
    )
    .in("session_date", [yesterday, today])
    .order("session_start_time", { ascending: true });

  if (bookingError) {
    throw new Error(`getFrontdeskBoard: ${bookingError.message}`);
  }

  const bookings = (bookingData ?? []) as BookingRow[];

  if (bookings.length === 0) {
    return [];
  }

  const bookingIds = bookings.map((b) => b.id);
  const customerIds = [...new Set(bookings.map((b) => b.customer_id))];
  const serviceIds = [...new Set(bookings.map((b) => b.service_id))];

  // Three batch `in (...)` lookups rather than per-row joins — same hydrate
  // shape as admin-booking-repository.ts.
  const [
    { data: profiles, error: profilesError },
    { data: services, error: servicesError },
    { data: attendance, error: attendanceError },
  ] = await Promise.all([
    supabase.from("profiles").select("id, full_name, phone").in("id", customerIds),
    supabase.from("services").select("id, label").in("id", serviceIds),
    supabase
      .from("session_attendance")
      .select("booking_id, clocked_in_at, clocked_out_at, no_show_at, clock_in_balance_kobo, note")
      .in("booking_id", bookingIds),
  ]);

  if (profilesError) {
    throw new Error(`getFrontdeskBoard: profiles lookup failed: ${profilesError.message}`);
  }
  if (servicesError) {
    throw new Error(`getFrontdeskBoard: services lookup failed: ${servicesError.message}`);
  }
  if (attendanceError) {
    throw new Error(`getFrontdeskBoard: attendance lookup failed: ${attendanceError.message}`);
  }

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const serviceById = new Map((services ?? []).map((s) => [s.id, s]));
  const attendanceByBookingId = new Map(
    ((attendance ?? []) as AttendanceRow[]).map((a) => [a.booking_id, a]),
  );

  return bookings
    .map((booking): FrontdeskSession => {
      const profile = profileById.get(booking.customer_id);
      const service = serviceById.get(booking.service_id);
      const row = attendanceByBookingId.get(booking.id);
      const state = deriveState(row);

      // Supabase returns bigint columns as string under some PostgREST
      // configs and number under others — see lib/utils/money.ts for the
      // same caveat. Normalise once, here.
      const balanceKobo = Math.max(
        Number(booking.total_price_kobo) - Number(booking.amount_paid_kobo),
        0,
      );

      return {
        bookingId: booking.id,
        customerName: profile?.full_name ?? null,
        customerPhone: profile?.phone ?? null,
        serviceLabel: service?.label ?? "Unknown service",
        sessionDate: booking.session_date,
        sessionStartTime: booking.session_start_time,
        sessionEndTime: booking.session_end_time,
        startAtIso: lagosInstantIso(booking.session_date, booking.session_start_time),
        endAtIso: lagosInstantIso(booking.session_end_date, booking.session_end_time),
        balanceKobo,
        state,
        clockedInAtIso: row?.clocked_in_at ?? null,
        clockedOutAtIso: row?.clocked_out_at ?? null,
        noShowAtIso: row?.no_show_at ?? null,
        clockInBalanceKobo:
          row?.clock_in_balance_kobo === null || row?.clock_in_balance_kobo === undefined
            ? null
            : Number(row.clock_in_balance_kobo),
        note: row?.note ?? null,
        isCarriedOver: booking.session_date !== today,
      };
    })
    .filter((session) => !session.isCarriedOver || session.state === "in_progress");
}
