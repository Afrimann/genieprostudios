// Lagos wall-clock helpers, the TypeScript half of what
// supabase/migrations/0016_session_start_at_helper.sql does in SQL.
//
// bookings.session_date / session_start_time / session_end_time are naive
// date/time columns entered as Lagos wall-clock time with no timezone
// attached (see 0003/0005). Anything that needs to compare them against
// "now" — the front desk board deciding whether a session is overdue, a
// running timer — has to pin them to a real instant first, and doing that
// with the *browser's* local timezone would be wrong the moment the owner
// checks the board from abroad, or a tablet's timezone is misconfigured.
//
// WHY A FIXED OFFSET IS SAFE HERE
// Nigeria observes West Africa Time (UTC+1) year-round and has never
// operated daylight saving. So unlike most timezones, a literal "+01:00"
// is exact rather than an approximation, and it avoids depending on the
// runtime's ICU/tzdata being present and current (Intl's timezone data
// varies across Node builds and mobile browsers). If Nigeria ever adopts
// DST, this constant is the single place that has to change.

const LAGOS_UTC_OFFSET = "+01:00";

/**
 * Today's date in Lagos as a `YYYY-MM-DD` string, directly comparable
 * against a naive `bookings.session_date` value. The SQL equivalent is
 * `public.lagos_today()` (0032) — keep the two in step.
 *
 * Not `new Date().toISOString().slice(0, 10)`: that is UTC, which is already
 * "tomorrow" in Lagos between 23:00 and midnight — the last hour of a normal
 * studio evening.
 */
export function lagosToday(now: Date = new Date()): string {
  // 'en-CA' is the shortest reliable route to YYYY-MM-DD out of
  // toLocaleDateString. The explicit numeric parts keep it stable across
  // locales/runtimes rather than trusting the format alone.
  return now.toLocaleDateString("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/** `YYYY-MM-DD` for `offsetDays` either side of today in Lagos (negative = past). */
export function lagosDateOffset(offsetDays: number, now: Date = new Date()): string {
  const [year, month, day] = lagosToday(now).split("-").map(Number);
  // Date.UTC + a UTC-based read keeps this pure calendar arithmetic with no
  // local-timezone involvement at all — we only ever want "the day before
  // this calendar date", never a real instant.
  const shifted = new Date(Date.UTC(year, month - 1, day + offsetDays));
  return shifted.toISOString().slice(0, 10);
}

/** The calendar day after a `YYYY-MM-DD` string. Pure date arithmetic, no timezone involved. */
export function nextCalendarDay(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}

/**
 * Combines a naive Lagos date + time into a real instant (ISO string), the
 * TS twin of `public.session_start_at()`. Pass the raw column values —
 * Postgres returns `time` as `HH:MM:SS`.
 */
export function lagosInstantIso(date: string, time: string): string {
  // Normalise `HH:MM` and `HH:MM:SS` alike; Date's ISO parsing needs seconds.
  const withSeconds = time.length === 5 ? `${time}:00` : time;
  return new Date(`${date}T${withSeconds}${LAGOS_UTC_OFFSET}`).toISOString();
}

/** `HH:MM` from a `HH:MM:SS` column value, for display. */
export function toDisplayTime(time: string): string {
  return time.slice(0, 5);
}

/**
 * Human elapsed/remaining duration, e.g. "0m", "47m", "2h 05m". Used for the
 * live session timer at the desk, so it stays legible at a glance from a few
 * feet away rather than being precise to the second.
 */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}m`;
  }

  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}
