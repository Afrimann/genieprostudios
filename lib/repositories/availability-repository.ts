import { createClient } from "@/lib/supabase/server";
import type { Booking } from "@/lib/services/booking-service";

// Mirrors public.blocked_time_ranges (see
// supabase/migrations/0036_blocked_time_ranges.sql). Replaces the old
// availability_slots "admin opens a window" model: every date is open by
// default, 00:00-23:59 — a row here marks a specific time range on a
// specific date as CLOSED. No status enum: a row's existence IS the
// closure. Admin-only (customers never query this table directly;
// book_session enforces blocks server-side, see 0037_book_session.sql).
export type BlockedTimeRange = {
  id: string;
  date: string; // ISO date (YYYY-MM-DD)
  start_time: string; // HH:MM:SS
  end_time: string; // HH:MM:SS
  reason: string | null;
  created_by: string | null;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Admin-only reads/writes. Rely entirely on the blocked_time_ranges_*_admin
// RLS policies (0036), which gate on public.is_admin() — NOT on the
// book_session RPC. This repository must only ever be called from
// admin-authenticated contexts; it does not itself re-check admin status
// (dumb data access, no business rules in the repository layer per
// project-notes.md).
// ---------------------------------------------------------------------------

/**
 * Returns every block for a single date (ISO "YYYY-MM-DD"), ordered by
 * start_time — the list the admin UI shows alongside "Block a time range"
 * for that day.
 */
export async function getBlocksForDate(date: string): Promise<BlockedTimeRange[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("blocked_time_ranges")
    .select("*")
    .eq("date", date)
    .order("start_time", { ascending: true });

  if (error) {
    throw new Error(`getBlocksForDate: ${error.message}`);
  }

  return data ?? [];
}

export type CreateBlockInput = {
  date: string; // ISO "YYYY-MM-DD"
  startTime: string; // "HH:MM" or "HH:MM:SS"
  endTime: string; // "HH:MM" or "HH:MM:SS"
  reason?: string | null;
};

/**
 * Inserts a new block. Pure data access — does NOT enforce the 30-minute
 * buffer rule or any overlap check against existing blocks/bookings; that
 * validation (if any is ever needed for blocks specifically) belongs in
 * lib/services/availability-service.ts, which calls this function only
 * after any such check passes. Unlike the old createSlot, a block has no
 * buffer requirement against adjacent blocks today — the buffer only ever
 * applied between bookable windows, and blocks are the inverse concept
 * (closures), so two blocks may legitimately sit back-to-back or even
 * overlap with no correctness issue.
 */
export async function createBlock(input: CreateBlockInput): Promise<BlockedTimeRange> {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("blocked_time_ranges")
    .insert({
      date: input.date,
      start_time: input.startTime,
      end_time: input.endTime,
      reason: input.reason ?? null,
      created_by: userData?.user?.id ?? null,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`createBlock: ${error.message}`);
  }

  return data;
}

/**
 * Deletes a block by id (removing a closure re-opens that time range
 * immediately — there is no "undo" state to manage, unlike the old
 * open/booked/closed slot status machine). Returns true if a row was
 * actually deleted, false if no row matched (already removed, or never
 * existed), so the caller can distinguish "removed successfully" from
 * "nothing happened" without needing a second lookup.
 */
export async function deleteBlock(blockId: string): Promise<boolean> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("blocked_time_ranges")
    .delete()
    .eq("id", blockId)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(`deleteBlock: ${error.message}`);
  }

  return data !== null;
}

// ---------------------------------------------------------------------------
// Bookings overlapping a date range — the "open by default" model's
// equivalent of the old getBookingsForSlot (keyed by slot_id). Both the
// customer-facing advisory start-time computation and the admin UI's
// "what's already booked on this date" display need this, keyed by date
// range (not slot_id, which no longer exists — see 0036).
// ---------------------------------------------------------------------------

export type DateRangeBookingRow = Pick<
  Booking,
  | "id"
  | "session_date"
  | "session_start_time"
  | "session_end_date"
  | "session_end_time"
  | "status"
  | "created_at"
>;

/**
 * Returns every non-addon booking whose session_date falls within
 * [startDate, endDate] (inclusive, ISO "YYYY-MM-DD") — any status; callers
 * that only care about "still occupies time" must filter out
 * cancelled/auto_cancelled (and age out stale pending_deposit rows)
 * themselves, same convention the old getBookingsForSlot used.
 *
 * Callers computing overlap for a single target date should pass
 * [targetDate - 1, targetDate + 1] (or similar) so a booking that starts
 * the evening before or runs into the morning after is still caught — see
 * lib/services/availability-service.ts's computeValidStartTimes, which is
 * the actual overlap-computation consumer of this read.
 *
 * Relies on RLS: bookings_select_admin (admin, all rows) and
 * bookings_select_own (customer, only their own bookings) both gate on
 * public.is_admin()/customer_id = auth.uid() respectively (0010) — this
 * repository adds no extra filtering beyond the date range, matching the
 * established "dumb data access" convention in this file. A customer-
 * authenticated caller therefore only ever sees their OWN bookings via this
 * read — fine for the booking flow's advisory start-time computation (it
 * only needs to know which of ITS OWN candidate ranges would collide with
 * something it's already committed to), but the real security boundary is
 * always book_session's own server-side overlap check against the FULL
 * bookings table (via SECURITY DEFINER), never this advisory read.
 */
export async function getBookingsForDateRange(
  startDate: string,
  endDate: string,
): Promise<DateRangeBookingRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("bookings")
    .select("id, session_date, session_start_time, session_end_date, session_end_time, status, created_at")
    .gte("session_date", startDate)
    .lte("session_date", endDate)
    .not("session_date", "is", null)
    .order("session_date", { ascending: true })
    .order("session_start_time", { ascending: true });

  if (error) {
    throw new Error(`getBookingsForDateRange: ${error.message}`);
  }

  return data ?? [];
}

export type DateWithBlocksAndBookings = {
  date: string;
  blocks: BlockedTimeRange[];
  bookings: DateRangeBookingRow[];
};

/**
 * Admin-only: a single date's blocks plus every booking overlapping that
 * date (via getBookingsForDateRange, queried [date, date] — the admin UI
 * only ever looks at one date at a time, unlike the advisory service-layer
 * computation which needs the adjoining date too). Backs the admin
 * availability UI's "blocks for this date" + "bookings overlapping this
 * date" display, replacing the old getSlotsForDateWithBookings' nested
 * window -> bookings shape (there is no nesting relationship anymore —
 * blocks and bookings are both flat, independent lists against the same
 * date).
 */
export async function getBlocksAndBookingsForDate(date: string): Promise<DateWithBlocksAndBookings> {
  const [blocks, bookings] = await Promise.all([
    getBlocksForDate(date),
    getBookingsForDateRange(date, date),
  ]);

  return { date, blocks, bookings };
}
