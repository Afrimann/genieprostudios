import { createClient } from "@/lib/supabase/server";

// Admin-facing read of everything front desk staff have done — the "who
// clocked whom in/out, and when" log the owner asked for after the
// /frontdesk build shipped (2026-10-05): "the person who does the action
// must be recorded and shown in the admin monitoring log". Relies entirely
// on session_attendance_select_admin (0033_session_attendance.sql, no date
// window — unlike the front desk's own ±1 day RLS, the owner can look back
// further than reception can).
//
// session_attendance is one row per booking holding up to three events
// (clock-in, clock-out, no-show) as separate timestamp/actor pairs — see
// that table's own comment. This file's job is turning rows into a flat,
// chronological event feed, since "who clocked in Boluwatife at 12:04" and
// "who clocked her out at 18:11" are two separate log lines to a reader even
// though they live in one database row.

export type FrontdeskActivityEventType = "clock_in" | "clock_out" | "no_show";

export type FrontdeskActivityEvent = {
  id: string;
  type: FrontdeskActivityEventType;
  atIso: string;
  staffName: string | null;
  customerName: string | null;
  serviceLabel: string;
  sessionDate: string | null;
  sessionStartTime: string | null;
  bookingId: string;
  note: string | null;
  /** Only meaningful on a clock_in event — the balance owed at that moment, see session_attendance.clock_in_balance_kobo. */
  balanceKobo: number | null;
};

// Bounds the query, not the feed: each row can produce up to 3 events, so
// this is "most recently touched 150 sessions" rather than "150 events".
// Plenty for an owner scanning what happened today/this week; a page/filter
// control can be added if the log ever needs to go back further than that.
const ROW_LIMIT = 150;

type AttendanceRow = {
  booking_id: string;
  clocked_in_at: string | null;
  clocked_in_by: string | null;
  clocked_out_at: string | null;
  clocked_out_by: string | null;
  no_show_at: string | null;
  no_show_by: string | null;
  clock_in_balance_kobo: number | string | null;
  note: string | null;
};

export async function listFrontdeskActivity(): Promise<FrontdeskActivityEvent[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("session_attendance")
    .select(
      "booking_id, clocked_in_at, clocked_in_by, clocked_out_at, clocked_out_by, no_show_at, no_show_by, clock_in_balance_kobo, note",
    )
    .order("updated_at", { ascending: false })
    .limit(ROW_LIMIT);

  if (error) {
    throw new Error(`listFrontdeskActivity: ${error.message}`);
  }

  const rows = (data ?? []) as AttendanceRow[];

  if (rows.length === 0) {
    return [];
  }

  const bookingIds = rows.map((r) => r.booking_id);
  const staffIds = [
    ...new Set(
      rows
        .flatMap((r) => [r.clocked_in_by, r.clocked_out_by, r.no_show_by])
        .filter((id): id is string => !!id),
    ),
  ];

  const [{ data: bookings, error: bookingsError }, { data: staff, error: staffError }] =
    await Promise.all([
      supabase
        .from("bookings")
        .select("id, customer_id, service_id, session_date, session_start_time")
        .in("id", bookingIds),
      staffIds.length === 0
        ? Promise.resolve({ data: [], error: null })
        : supabase.from("profiles").select("id, full_name, email").in("id", staffIds),
    ]);

  if (bookingsError) {
    throw new Error(`listFrontdeskActivity: bookings lookup failed: ${bookingsError.message}`);
  }
  if (staffError) {
    throw new Error(`listFrontdeskActivity: staff lookup failed: ${staffError.message}`);
  }

  const bookingById = new Map((bookings ?? []).map((b) => [b.id, b]));
  const customerIds = [...new Set((bookings ?? []).map((b) => b.customer_id))];
  const serviceIds = [...new Set((bookings ?? []).map((b) => b.service_id))];

  const [{ data: customers, error: customersError }, { data: services, error: servicesError }] =
    await Promise.all([
      customerIds.length === 0
        ? Promise.resolve({ data: [], error: null })
        : supabase.from("profiles").select("id, full_name").in("id", customerIds),
      serviceIds.length === 0
        ? Promise.resolve({ data: [], error: null })
        : supabase.from("services").select("id, label").in("id", serviceIds),
    ]);

  if (customersError) {
    throw new Error(`listFrontdeskActivity: customer lookup failed: ${customersError.message}`);
  }
  if (servicesError) {
    throw new Error(`listFrontdeskActivity: service lookup failed: ${servicesError.message}`);
  }

  const staffById = new Map((staff ?? []).map((s) => [s.id, s]));
  const customerById = new Map((customers ?? []).map((c) => [c.id, c]));
  const serviceById = new Map((services ?? []).map((s) => [s.id, s]));

  function staffName(id: string | null): string | null {
    if (!id) return null;
    const row = staffById.get(id);
    return row?.full_name ?? row?.email ?? null;
  }

  const events: FrontdeskActivityEvent[] = [];

  for (const row of rows) {
    const booking = bookingById.get(row.booking_id);
    const customerName = booking ? (customerById.get(booking.customer_id)?.full_name ?? null) : null;
    const serviceLabel = booking
      ? (serviceById.get(booking.service_id)?.label ?? "Unknown service")
      : "Unknown service";
    const sessionDate = booking?.session_date ?? null;
    const sessionStartTime = booking?.session_start_time ?? null;

    if (row.clocked_in_at) {
      events.push({
        id: `${row.booking_id}:clock_in`,
        type: "clock_in",
        atIso: row.clocked_in_at,
        staffName: staffName(row.clocked_in_by),
        customerName,
        serviceLabel,
        sessionDate,
        sessionStartTime,
        bookingId: row.booking_id,
        note: row.note,
        balanceKobo: row.clock_in_balance_kobo === null ? null : Number(row.clock_in_balance_kobo),
      });
    }

    if (row.clocked_out_at) {
      events.push({
        id: `${row.booking_id}:clock_out`,
        type: "clock_out",
        atIso: row.clocked_out_at,
        staffName: staffName(row.clocked_out_by),
        customerName,
        serviceLabel,
        sessionDate,
        sessionStartTime,
        bookingId: row.booking_id,
        note: null,
        balanceKobo: null,
      });
    }

    if (row.no_show_at) {
      events.push({
        id: `${row.booking_id}:no_show`,
        type: "no_show",
        atIso: row.no_show_at,
        staffName: staffName(row.no_show_by),
        customerName,
        serviceLabel,
        sessionDate,
        sessionStartTime,
        bookingId: row.booking_id,
        note: row.note,
        balanceKobo: null,
      });
    }
  }

  events.sort((a, b) => new Date(b.atIso).getTime() - new Date(a.atIso).getTime());

  return events;
}
