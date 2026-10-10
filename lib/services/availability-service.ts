import {
  createBlock,
  getBlocksForDate,
  getBookingsForDateRange,
  type BlockedTimeRange,
  type CreateBlockInput,
  type DateRangeBookingRow,
} from "@/lib/repositories/availability-repository";
import { getServiceById } from "@/lib/repositories/service-repository";
import { lagosToday } from "@/lib/utils/lagos-time";

// Mandatory setup/teardown buffer the owner requires between any two
// bookings (or a booking and an admin-marked block), per project-notes.md
// ("30-minute mandatory setup buffer between booked slots"). Unchanged by
// the open-by-default model flip — still advisory-only here, the RPC
// (book_session, supabase/migrations/0037_book_session.sql) remains the
// real boundary.
export const SLOT_BUFFER_MINUTES = 30;

type TimeLike = string; // "HH:MM" or "HH:MM:SS"

/**
 * Converts "HH:MM" or "HH:MM:SS" to minutes-since-midnight for arithmetic.
 * Pure helper, no I/O.
 */
function timeToMinutes(time: TimeLike): number {
  const [hoursStr, minutesStr] = time.split(":");
  const hours = Number(hoursStr);
  const minutes = Number(minutesStr);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    throw new Error(`timeToMinutes: invalid time value "${time}"`);
  }

  return hours * 60 + minutes;
}

/** The calendar day after a `YYYY-MM-DD` string. Pure date arithmetic, no timezone involved. */
function nextCalendarDay(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

/** The calendar day before a `YYYY-MM-DD` string. Pure date arithmetic, no timezone involved. */
function previousCalendarDay(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
}

/**
 * Minutes-since-midnight-of-`baseDate` for a (date, time) pair, allowing
 * the result to run negative when `date` is the day BEFORE `baseDate`, or
 * past 1440 when `date` is the day AFTER `baseDate` — the same "plain
 * timestamp, not time-of-day" arithmetic book_session (0037) uses in SQL,
 * reimplemented here so the advisory JS computation can reason about a
 * range that spans midnight (in either direction) without wrapping. Only
 * ever called with `date` equal to `baseDate` or one of the two calendar
 * days immediately adjacent to it (the only three days any of this
 * module's computations ever consider — mirroring book_session's own
 * `p_date - 1 .. v_end_date` window), so a plain day-count multiply is
 * sufficient — no general calendar math needed.
 */
function toOffsetMinutes(baseDate: string, date: string, time: TimeLike): number {
  const dayOffset = date === baseDate ? 0 : date < baseDate ? -1 : 1;
  return dayOffset * 24 * 60 + timeToMinutes(time);
}

export type BufferCheckResult = { ok: true } | { ok: false; reason: string };

/**
 * Pure, unit-testable core of the block-overlap rule: given the blocks that
 * exist on a target date AND the next calendar date (a block sitting on the
 * following day can still collide with a session starting late the night
 * before and running into it), and a proposed range anchored to the target
 * date, returns whether the proposed range keeps at least
 * SLOT_BUFFER_MINUTES of clearance from every block.
 *
 * `proposed.endDate` lets the proposed range itself span midnight (an
 * overnight booking candidate) — when absent, it's assumed to equal
 * `proposed.date` (a same-day proposal), matching computeValidStartTimes'
 * candidates below.
 *
 * All offsets are computed relative to `proposed.date` via
 * toOffsetMinutes, so a block on the day after `proposed.date` lands in the
 * [1440, 2880) range rather than wrapping back to [0, 1440) — this is what
 * makes the overlap comparison correct across the midnight boundary, the
 * same fix book_session's SQL applies via plain timestamp arithmetic
 * instead of raw `time` values.
 */
export function checkSlotBuffer(
  blocks: Pick<BlockedTimeRange, "date" | "start_time" | "end_time" | "reason">[],
  proposed: { date: string; startTime: TimeLike; endDate?: string; endTime: TimeLike },
): BufferCheckResult {
  const anchorDate = proposed.date;
  const endDate = proposed.endDate ?? proposed.date;

  const proposedStart = toOffsetMinutes(anchorDate, anchorDate, proposed.startTime);
  const proposedEnd = toOffsetMinutes(anchorDate, endDate, proposed.endTime);

  if (proposedEnd <= proposedStart) {
    return { ok: false, reason: "End time must be after start time." };
  }

  const relevantBlocks = blocks.filter(
    (block) => block.date === anchorDate || block.date === endDate,
  );

  for (const block of relevantBlocks) {
    const blockStart = toOffsetMinutes(anchorDate, block.date, block.start_time);
    const blockEnd = toOffsetMinutes(anchorDate, block.date, block.end_time);

    const paddedStart = blockStart - SLOT_BUFFER_MINUTES;
    const paddedEnd = blockEnd + SLOT_BUFFER_MINUTES;

    const overlaps = proposedStart < paddedEnd && proposedEnd > paddedStart;

    if (overlaps) {
      return {
        ok: false,
        reason: `This time is blocked${block.reason ? ` (${block.reason})` : ""} (${block.start_time.slice(0, 5)}-${block.end_time.slice(0, 5)} on ${block.date}). A ${SLOT_BUFFER_MINUTES}-minute buffer is required around a blocked range.`,
      };
    }
  }

  return { ok: true };
}

export type CreateBlockWithOverlapCheckResult =
  | { success: true; block: BlockedTimeRange }
  | { success: false; error: "overlap_violation"; message: string }
  | { success: false; error: "unknown"; message: string };

/**
 * Admin-side orchestration for creating a block. Unlike the old
 * createSlotWithBufferCheck, this does NOT reject a block that overlaps an
 * existing block — two closures overlapping is harmless (the time is
 * closed either way) — but it DOES still warn/fail if the admin tries to
 * block a time that would collide with an existing, still-live booking's
 * buffer zone, since blocking that range wouldn't actually prevent the
 * booking from using it; the owner needs to know the block has no teeth
 * there rather than assume it silently worked. Checked against both the
 * target date and the day before (a booking starting late the previous
 * evening could run into this date's early hours).
 */
export async function createBlockWithOverlapCheck(
  input: CreateBlockInput,
): Promise<CreateBlockWithOverlapCheckResult> {
  try {
    const previousDate = (() => {
      const [year, month, day] = input.date.split("-").map(Number);
      return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10);
    })();

    const existingBookings = await getBookingsForDateRange(previousDate, input.date);

    const activeBookings = filterActiveBookings(existingBookings);

    const collides = activeBookings.some((booking) => {
      if (
        !booking.session_date ||
        !booking.session_start_time ||
        !booking.session_end_date ||
        !booking.session_end_time
      ) {
        // Null session_* fields mean an is_addon booking (no studio room
        // time reserved, see 0036_blocked_time_ranges.sql's consistency
        // check) — never collides with a block.
        return false;
      }

      const anchorDate = input.date;
      const blockStart = toOffsetMinutes(anchorDate, anchorDate, input.startTime);
      const blockEnd = toOffsetMinutes(anchorDate, anchorDate, input.endTime);

      const bookingStart = toOffsetMinutes(anchorDate, booking.session_date, booking.session_start_time);
      const bookingEnd = toOffsetMinutes(anchorDate, booking.session_end_date, booking.session_end_time);

      return blockStart < bookingEnd && blockEnd > bookingStart;
    });

    if (collides) {
      return {
        success: false,
        error: "overlap_violation",
        message: "This time range overlaps an existing booking and cannot be blocked.",
      };
    }

    const block = await createBlock(input);
    return { success: true, block };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create block.";
    return { success: false, error: "unknown", message };
  }
}

// ---------------------------------------------------------------------------
// Open-by-default start-time computation (0036/0037): every date is open
// 00:00-23:59 by default; bounds are the full day's 30-minute grid rather
// than a single admin-opened window. THESE FUNCTIONS ARE ADVISORY ONLY —
// same discipline as before: the UI uses this to offer only valid
// start-time buttons and fail fast with a friendly message, but
// book_session (0037) independently re-validates everything server-side.
// Never remove or weaken the RPC's own checks on the assumption that "the
// UI already only offers valid options."
// ---------------------------------------------------------------------------

export type StartTimeOption = { startTime: string; endTime: string; endDate: string };

/**
 * Filters out every booking that hasn't actually been paid for yet.
 * 'pending_deposit' never occupies time, for any amount of time — a
 * customer who reaches the summary step but never pays must not block
 * another customer from booking that time, even for a minute. Only
 * 'deposited'/'paid_in_full' block, since real money has landed on them;
 * 'cancelled'/'auto_cancelled' never block either way. Mirrors
 * book_session's SQL overlap predicate exactly (0040_no_pending_hold.sql).
 */
function filterActiveBookings(bookings: DateRangeBookingRow[]): DateRangeBookingRow[] {
  return bookings.filter(
    (booking) => booking.status === "deposited" || booking.status === "paid_in_full",
  );
}

/**
 * Pure, unit-testable core of "which start times can the customer pick on
 * this date" — the open-by-default replacement for the old window-scoped
 * computeValidStartTimes. Bounds are the full day: every 30-minute-grid
 * candidate from 00:00 up to 23:30 (the latest grid mark in a day,
 * regardless of whether the resulting session spans into the next day —
 * an overnight session is explicitly supported, not excluded).
 *
 * `blocks` must include rows from BOTH the target date and the next
 * calendar date — a late candidate start time can run into a block sitting
 * on the day after `date` — matching book_session's own blocked_time_ranges
 * check, which only ever queries `bt.date in (p_date, v_end_date)` (0037
 * line ~153), never the day before.
 *
 * `existingBookings`, however, must include rows from the PREVIOUS calendar
 * date as well as the target date and the next calendar date (a 3-day
 * window) — a booking that started the evening before `date` can still be
 * running into `date`'s early hours, and book_session's own overlap check
 * queries exactly this wider `session_date between p_date - 1 and
 * v_end_date` range (0037 line ~175). Without the previous day included
 * here, this advisory check would offer an early-morning start time that
 * the RPC would then correctly reject — a confusing failed-booking UX for a
 * slot the UI claimed was free.
 *
 * This function does not fetch anything itself (pure data in/out, same
 * discipline as the pre-0036 version, so it stays testable without a
 * database or mocks).
 *
 * `now`/`isToday` exclude any candidate start time that's already in the
 * past when `date` is today in Lagos — the RPC itself also rejects a past
 * start time (book_session's start_in_past check), but doing it here too
 * means the UI never even offers a dead button for today's already-passed
 * slots.
 */
export function computeValidStartTimes(
  date: string,
  durationHours: number,
  blocks: Pick<BlockedTimeRange, "date" | "start_time" | "end_time" | "reason">[],
  existingBookings: DateRangeBookingRow[],
  options?: { isToday?: boolean; nowMinutesInDay?: number },
): StartTimeOption[] {
  const durationMinutes = Math.round(durationHours * 60);

  if (durationMinutes <= 0) {
    throw new Error(`computeValidStartTimes: invalid durationHours "${durationHours}"`);
  }

  const activeBookings = filterActiveBookings(existingBookings);
  const nextDate = nextCalendarDay(date);
  const previousDate = previousCalendarDay(date);

  // Blocks: target date + next calendar date only — mirrors book_session's
  // own blocked_time_ranges check (0037), which never looks at the previous
  // day either.
  const relevantBlocks = blocks.filter((block) => block.date === date || block.date === nextDate);

  // Bookings: previous date + target date + next calendar date (3-day
  // window) — mirrors book_session's own overlap check (0037), which
  // queries `session_date between p_date - 1 and v_end_date`. A booking
  // starting late on `previousDate` can still be occupying the early hours
  // of `date`.
  const relevantBookings = activeBookings.filter(
    (booking) =>
      booking.session_date === previousDate ||
      booking.session_date === date ||
      booking.session_date === nextDate,
  );

  const dayStart = 0;
  const dayEnd = 23 * 60 + 30; // last grid-aligned start of the day, 23:30

  const options_: StartTimeOption[] = [];

  for (let candidateStart = dayStart; candidateStart <= dayEnd; candidateStart += 30) {
    if (
      options?.isToday &&
      typeof options.nowMinutesInDay === "number" &&
      candidateStart <= options.nowMinutesInDay
    ) {
      // Already in the past (or exactly now) for today in Lagos — never
      // offer it, mirroring book_session's own start_in_past rejection.
      continue;
    }

    const candidateEnd = candidateStart + durationMinutes;

    const paddedStart = candidateStart - SLOT_BUFFER_MINUTES;
    const paddedEnd = candidateEnd + SLOT_BUFFER_MINUTES;

    const overlapsBlock = relevantBlocks.some((block) => {
      const blockStart = toOffsetMinutes(date, block.date, block.start_time);
      const blockEnd = toOffsetMinutes(date, block.date, block.end_time);
      return paddedStart < blockEnd && paddedEnd > blockStart;
    });

    if (overlapsBlock) {
      continue;
    }

    const overlapsBooking = relevantBookings.some((booking) => {
      if (
        !booking.session_date ||
        !booking.session_start_time ||
        !booking.session_end_date ||
        !booking.session_end_time
      ) {
        // Null session_* fields mean an is_addon booking (no studio room
        // time reserved) — never blocks a candidate start time.
        return false;
      }

      const bookingStart = toOffsetMinutes(date, booking.session_date, booking.session_start_time);
      const bookingEnd = toOffsetMinutes(date, booking.session_end_date, booking.session_end_time);

      return paddedStart < bookingEnd && paddedEnd > bookingStart;
    });

    if (overlapsBooking) {
      continue;
    }

    const endOffset = candidateEnd;
    const endDate = endOffset >= 24 * 60 ? nextDate : date;
    const endTime = minutesToTime(endOffset % (24 * 60));

    options_.push({
      startTime: minutesToTime(candidateStart),
      endTime,
      endDate,
    });
  }

  return options_;
}

/**
 * Converts minutes-since-midnight back to "HH:MM:SS", matching the format
 * BlockedTimeRange.start_time/end_time already use, so callers can feed the
 * result straight back into the repository/RPC layer without reformatting.
 */
function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:00`;
}

export type GetValidStartTimesResult =
  | { success: true; options: StartTimeOption[] }
  | { success: false; error: "invalid_service" | "unknown"; message: string };

/**
 * I/O wrapper around computeValidStartTimes: fetches the service's duration
 * (getServiceById), the blocks for `date` and the next calendar date
 * (getBlocksForDate, called for both days — matching book_session's own
 * blocked_time_ranges check, which never looks at the previous day), and
 * bookings across the full previous-date..next-date 3-day window
 * (getBookingsForDateRange, matching book_session's own `p_date - 1 ..
 * v_end_date` overlap check, 0037) from the repository layer, then
 * delegates all business logic to the pure function above. Kept separate
 * from computeValidStartTimes so the block/overlap logic itself stays
 * trivially unit-testable without mocking Supabase.
 */
export async function getValidStartTimesForDate(
  date: string,
  serviceId: string,
  excludeBookingId?: string,
): Promise<GetValidStartTimesResult> {
  try {
    const previousDate = previousCalendarDay(date);
    const nextDate = nextCalendarDay(date);

    const [service, blocksToday, blocksNextDay, bookings] = await Promise.all([
      getServiceById(serviceId),
      getBlocksForDate(date),
      getBlocksForDate(nextDate),
      getBookingsForDateRange(previousDate, nextDate),
    ]);

    if (!service) {
      return {
        success: false,
        error: "invalid_service",
        message: "This service is no longer available. Please choose another.",
      };
    }

    // Admin reschedule may target a date a booking is already scheduled
    // on — without this exclusion, that booking's own current time range
    // would count as an "existing booking" blocking candidates around
    // itself. The customer booking flow never passes this (there is no
    // booking to exclude yet), so it's a no-op filter there.
    const existingBookings = excludeBookingId
      ? bookings.filter((b) => b.id !== excludeBookingId)
      : bookings;

    const today = lagosToday();
    const isToday = date === today;
    const nowMinutesInDay = isToday ? lagosMinutesSinceMidnight() : undefined;

    const options = computeValidStartTimes(
      date,
      service.duration_hours,
      [...blocksToday, ...blocksNextDay],
      existingBookings,
      { isToday, nowMinutesInDay },
    );

    return { success: true, options };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to compute available start times.";
    return { success: false, error: "unknown", message };
  }
}

/**
 * Current minutes-since-midnight in Lagos wall-clock time, for excluding
 * already-past candidate start times when the target date is today. Not
 * exported — only needed internally by getValidStartTimesForDate; kept
 * next to computeValidStartTimes' other pure time-math helpers above for
 * locality even though this one (unlike those) does read the real clock.
 */
function lagosMinutesSinceMidnight(now: Date = new Date()): number {
  const parts = now.toLocaleTimeString("en-GB", {
    timeZone: "Africa/Lagos",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const [hoursStr, minutesStr] = parts.split(":");
  return Number(hoursStr) * 60 + Number(minutesStr);
}
