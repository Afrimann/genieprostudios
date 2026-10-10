import { createClient } from "@/lib/supabase/server";
import { lagosDateOffset, lagosInstantIso } from "@/lib/utils/lagos-time";

// Dumb data access for the admin dashboard home (app/admin/(protected)/page.tsx)
// — a handful of independent counts/sums, each its own small query rather
// than one large join, since they don't share a filter shape. Relies on RLS
// (bookings_select_admin/payments_select_admin/portfolio_entries_select_admin,
// 0010_rls_policies.sql; blocked_time_ranges_select_admin, 0036, for the
// blocked-ranges count; session_attendance_select_admin,
// 0033_session_attendance.sql, for the ongoing-session count) — no admin
// check of its own, same convention as availability-repository.ts/
// admin-booking-repository.ts.
//
// 0036/0037 note: availability_slots/the "open windows" concept no longer
// exists — every date is open by default now, and admins instead mark
// closures (blocked_time_ranges). openWindowsCount is replaced by
// upcomingBlocksCount (admin-marked closures still ahead of today), which
// is the closest equivalent "how much am I managing" signal in the new
// model — it is NOT a count of bookable capacity (there's no such concept
// anymore).
export type AdminDashboardStats = {
  upcomingBlocksCount: number;
  upcomingBookingsCount: number;
  /** 0 or 1 in practice — the booth can only hold one session at a time. See getAdminDashboardStats' own comment. */
  ongoingSessionCount: number;
  unresolvedCount: number;
  revenueThisMonthKobo: number;
  portfolioPublishedCount: number;
  portfolioTotalCount: number;
};

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type UpcomingBookingRow = {
  session_date: string | null;
  session_start_time: string | null;
};

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const supabase = await createClient();
  const todayIso = toIsoDate(new Date());
  const monthStartIso = toIsoDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  // One day further back than todayIso, not todayIso itself — this is only
  // a coarse pre-filter to bound the row count; the real "has this session
  // actually started yet" check happens below in JS against the full
  // session_start_at() instant. Using todayIso here (a bare server-local
  // date, not Lagos-aware) risked excluding a session that IS still
  // upcoming by Lagos wall-clock time during the UTC/Lagos day-boundary
  // window — same class of bug lagos_today()/lagosToday() exist to avoid
  // elsewhere (0032_frontdesk_role.sql, lib/utils/lagos-time.ts).
  const upcomingWindowStartIso = lagosDateOffset(-1);

  const [
    upcomingBlocks,
    upcomingBookingsRows,
    ongoingSession,
    unresolved,
    revenue,
    portfolioPublished,
    portfolioTotal,
  ] = await Promise.all([
    supabase
      .from("blocked_time_ranges")
      .select("id", { count: "exact", head: true })
      .gte("date", todayIso),
    // Previously `.select("id", { count: "exact", head: true })` filtered
    // only by `session_date >= todayIso` — a bare calendar-day comparison.
    // That counted a booking as "upcoming" for its entire session_date, so
    // a session scheduled for 12:00–18:00 today stayed "upcoming" at 9pm
    // that same evening, completed or not — found live 2026-10-05, a
    // booking the front desk had already clocked out still showed as
    // upcoming on the dashboard. Fetching the rows (not just a head count)
    // so the actual start instant can be checked below fixes that: a
    // booking only counts once its session_start_at() is still in the
    // future, which is what "upcoming" actually means.
    supabase
      .from("bookings")
      .select("session_date, session_start_time")
      .in("status", ["deposited", "paid_in_full"])
      .gte("session_date", upcomingWindowStartIso),
    // Ongoing: clocked in, not yet clocked out. The studio only has one
    // booth, so this is a 0-or-1 signal in practice, not a general count —
    // see the "Ongoing" meta line on the Upcoming bookings tile
    // (app/admin/(protected)/page.tsx).
    supabase
      .from("session_attendance")
      .select("booking_id", { count: "exact", head: true })
      .not("clocked_in_at", "is", null)
      .is("clocked_out_at", null),
    supabase.rpc("bookings_unresolved_past_sessions"),
    supabase
      .from("payments")
      .select("amount_kobo")
      .eq("status", "success")
      .gte("verified_at", `${monthStartIso}T00:00:00Z`),
    supabase
      .from("portfolio_entries")
      .select("id", { count: "exact", head: true })
      .eq("published", true),
    supabase.from("portfolio_entries").select("id", { count: "exact", head: true }),
  ]);

  if (upcomingBlocks.error) {
    throw new Error(`getAdminDashboardStats: upcomingBlocks: ${upcomingBlocks.error.message}`);
  }
  if (upcomingBookingsRows.error) {
    throw new Error(`getAdminDashboardStats: upcomingBookings: ${upcomingBookingsRows.error.message}`);
  }
  if (ongoingSession.error) {
    throw new Error(`getAdminDashboardStats: ongoingSession: ${ongoingSession.error.message}`);
  }
  if (unresolved.error) {
    throw new Error(`getAdminDashboardStats: unresolved: ${unresolved.error.message}`);
  }
  if (revenue.error) {
    throw new Error(`getAdminDashboardStats: revenue: ${revenue.error.message}`);
  }
  if (portfolioPublished.error) {
    throw new Error(`getAdminDashboardStats: portfolioPublished: ${portfolioPublished.error.message}`);
  }
  if (portfolioTotal.error) {
    throw new Error(`getAdminDashboardStats: portfolioTotal: ${portfolioTotal.error.message}`);
  }

  const now = Date.now();
  const upcomingBookingsCount = ((upcomingBookingsRows.data ?? []) as UpcomingBookingRow[]).filter(
    (row) => {
      // Null session_date/session_start_time means an is_addon booking
      // (per-song mixing/mastering, no studio time reserved — see
      // 0019_addon_bookings.sql) — never "upcoming" in the room-booking
      // sense this tile reports on.
      if (!row.session_date || !row.session_start_time) return false;
      return new Date(lagosInstantIso(row.session_date, row.session_start_time)).getTime() > now;
    },
  ).length;

  const revenueThisMonthKobo = (revenue.data ?? []).reduce(
    (sum, row) => sum + (row.amount_kobo as number),
    0,
  );

  return {
    upcomingBlocksCount: upcomingBlocks.count ?? 0,
    upcomingBookingsCount,
    ongoingSessionCount: ongoingSession.count ?? 0,
    unresolvedCount: (unresolved.data ?? []).length,
    revenueThisMonthKobo,
    portfolioPublishedCount: portfolioPublished.count ?? 0,
    portfolioTotalCount: portfolioTotal.count ?? 0,
  };
}

/** Lightweight version of just the unresolved count, for the admin shell's sidebar badge — avoids the other 5 queries on every navigation. */
export async function getUnresolvedCount(): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("bookings_unresolved_past_sessions");

  if (error) {
    throw new Error(`getUnresolvedCount: ${error.message}`);
  }

  return (data ?? []).length;
}

// ---------------------------------------------------------------------------
// Revenue/payment detail for the dashboard's statistics section. All derived
// from a single fetch of the payments ledger (status='success') rather than
// several separate aggregate queries — PostgREST has no server-side GROUP
// BY, so date-bucketing and type-splitting happen here in JS, same
// "fetch rows, reduce client-side" convention already used for
// revenueThisMonthKobo above and lib/services/reminder-service.ts. Fine at
// this studio's booking volume; would need a real aggregate (RPC or
// materialized view) if payment volume grows into the thousands/month.
// ---------------------------------------------------------------------------

export type RevenuePoint = { date: string; kobo: number };

export type RevenueOverview = {
  allTimeKobo: number;
  thisMonthKobo: number;
  lastMonthKobo: number;
  depositKobo: number;
  balanceKobo: number;
  dailyLast14: RevenuePoint[];
};

const DAILY_CHART_DAYS = 14;

export async function getRevenueOverview(): Promise<RevenueOverview> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("payments")
    .select("amount_kobo, type, verified_at")
    .eq("status", "success")
    .not("verified_at", "is", null);

  if (error) {
    throw new Error(`getRevenueOverview: ${error.message}`);
  }

  const rows = data ?? [];
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  let allTimeKobo = 0;
  let thisMonthKobo = 0;
  let lastMonthKobo = 0;
  let depositKobo = 0;
  let balanceKobo = 0;

  const dailyBuckets = new Map<string, number>();
  for (let i = DAILY_CHART_DAYS - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dailyBuckets.set(toIsoDate(d), 0);
  }

  for (const row of rows) {
    const amount = row.amount_kobo as number;
    const verifiedAt = new Date(row.verified_at as string);

    allTimeKobo += amount;

    if (verifiedAt >= thisMonthStart) {
      thisMonthKobo += amount;
    } else if (verifiedAt >= lastMonthStart && verifiedAt < thisMonthStart) {
      lastMonthKobo += amount;
    }

    if (row.type === "deposit") {
      depositKobo += amount;
    } else {
      balanceKobo += amount;
    }

    const bucketKey = toIsoDate(verifiedAt);
    if (dailyBuckets.has(bucketKey)) {
      dailyBuckets.set(bucketKey, (dailyBuckets.get(bucketKey) ?? 0) + amount);
    }
  }

  return {
    allTimeKobo,
    thisMonthKobo,
    lastMonthKobo,
    depositKobo,
    balanceKobo,
    dailyLast14: Array.from(dailyBuckets.entries()).map(([date, kobo]) => ({ date, kobo })),
  };
}

export type RecentPayment = {
  id: string;
  customerName: string | null;
  serviceLabel: string;
  amountKobo: number;
  type: "deposit" | "balance";
  verifiedAt: string;
};

/**
 * Most recent successful payments, hydrated with customer/service names via
 * the same batch-`in(...)` hydrate pattern as
 * lib/repositories/reminder-repository.ts and admin-booking-repository.ts,
 * rather than a triple-nested PostgREST select (payments -> bookings ->
 * profiles/services) — keeps each query simple and independently testable.
 */
export async function getRecentPayments(limit: number): Promise<RecentPayment[]> {
  const supabase = await createClient();

  const { data: payments, error } = await supabase
    .from("payments")
    .select("id, booking_id, amount_kobo, type, verified_at")
    .eq("status", "success")
    .not("verified_at", "is", null)
    .order("verified_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`getRecentPayments: ${error.message}`);
  }

  const rows = payments ?? [];
  if (rows.length === 0) {
    return [];
  }

  const bookingIds = [...new Set(rows.map((r) => r.booking_id))];

  const { data: bookings, error: bookingsError } = await supabase
    .from("bookings")
    .select("id, customer_id, service_id")
    .in("id", bookingIds);

  if (bookingsError) {
    throw new Error(`getRecentPayments: bookings lookup failed: ${bookingsError.message}`);
  }

  const bookingById = new Map((bookings ?? []).map((b) => [b.id, b]));
  const customerIds = [...new Set((bookings ?? []).map((b) => b.customer_id))];
  const serviceIds = [...new Set((bookings ?? []).map((b) => b.service_id))];

  const [{ data: profiles, error: profilesError }, { data: services, error: servicesError }] =
    await Promise.all([
      supabase.from("profiles").select("id, full_name").in("id", customerIds),
      supabase.from("services").select("id, label").in("id", serviceIds),
    ]);

  if (profilesError) {
    throw new Error(`getRecentPayments: profiles lookup failed: ${profilesError.message}`);
  }
  if (servicesError) {
    throw new Error(`getRecentPayments: services lookup failed: ${servicesError.message}`);
  }

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const serviceById = new Map((services ?? []).map((s) => [s.id, s]));

  return rows.map((row) => {
    const booking = bookingById.get(row.booking_id);
    const profile = booking ? profileById.get(booking.customer_id) : undefined;
    const service = booking ? serviceById.get(booking.service_id) : undefined;

    return {
      id: row.id,
      customerName: profile?.full_name ?? null,
      serviceLabel: service?.label ?? "Unknown service",
      amountKobo: row.amount_kobo,
      type: row.type,
      verifiedAt: row.verified_at,
    };
  });
}

export type BookingStatusCounts = Record<
  "pending_deposit" | "deposited" | "paid_in_full" | "auto_cancelled" | "cancelled",
  number
>;

/** Counts every booking by status, in one query (status column only) rather than 5 separate `count`-only queries. */
export async function getBookingStatusCounts(): Promise<BookingStatusCounts> {
  const supabase = await createClient();

  const { data, error } = await supabase.from("bookings").select("status");

  if (error) {
    throw new Error(`getBookingStatusCounts: ${error.message}`);
  }

  const counts: BookingStatusCounts = {
    pending_deposit: 0,
    deposited: 0,
    paid_in_full: 0,
    auto_cancelled: 0,
    cancelled: 0,
  };

  for (const row of data ?? []) {
    counts[row.status as keyof BookingStatusCounts] += 1;
  }

  return counts;
}
