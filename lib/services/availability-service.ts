import {
  createSlot,
  getBookingsForSlot,
  getSlotById,
  getSlotsForDate,
  type AvailabilitySlot,
  type CreateSlotInput,
} from "@/lib/repositories/availability-repository";
import { getServiceById } from "@/lib/repositories/service-repository";

// Mandatory setup/teardown buffer the owner requires between any two slots
// on the same date, per project-notes.md ("30-minute mandatory setup buffer
// between booked slots") — applies regardless of the existing slot's
// status (open/booked/closed all physically occupy or reserve studio time
// for that window), not just booked ones.
export const SLOT_BUFFER_MINUTES = 30;

// How long a 'pending_deposit' booking (created but never paid) still
// counts as occupying its time range, mirrored in
// supabase/migrations/0018_pending_deposit_age_limit.sql's
// v_pending_hold_minutes — must match. Only 'pending_deposit' ages out this
// way; 'deposited'/'paid_in_full' always block regardless of age, since
// real money has landed on them.
export const PENDING_DEPOSIT_HOLD_MINUTES = 20;

type TimeLike = string; // "HH:MM" or "HH:MM:SS"

export type ProposedSlot = {
  date: string;
  startTime: TimeLike;
  endTime: TimeLike;
};

export type BufferCheckResult =
  | { ok: true }
  | { ok: false; reason: string };

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

/**
 * Pure, unit-testable core of the buffer rule: given the slots that already
 * exist on a date (any status) and a proposed new slot for that same date,
 * returns whether the proposed slot keeps at least SLOT_BUFFER_MINUTES of
 * clearance from every existing slot's start/end.
 *
 * Overlap check: pad each existing slot's [start, end] window by the buffer
 * on both sides, then reject the proposal if its own [start, end] window
 * intersects that padded window. Padding both sides (existing slot AND
 * implicitly the proposed slot, since a symmetric pad on one side is
 * equivalent to padding both and comparing raw ranges) guarantees the true
 * gap between any existing slot and the proposed one is >= buffer minutes,
 * not just >= buffer/2.
 *
 * Takes plain data in/out (no Supabase calls) specifically so it can be
 * unit-tested without a database or mocks.
 */
export function checkSlotBuffer(
  existingSlots: Pick<AvailabilitySlot, "date" | "start_time" | "end_time" | "status">[],
  proposed: ProposedSlot,
): BufferCheckResult {
  const proposedStart = timeToMinutes(proposed.startTime);
  const proposedEnd = timeToMinutes(proposed.endTime);

  if (proposedEnd <= proposedStart) {
    return { ok: false, reason: "End time must be after start time." };
  }

  const sameDateSlots = existingSlots.filter((slot) => slot.date === proposed.date);

  for (const slot of sameDateSlots) {
    const existingStart = timeToMinutes(slot.start_time);
    const existingEnd = timeToMinutes(slot.end_time);

    // Pad the existing slot's window by the buffer on both sides, then
    // check for intersection with the proposed (unpadded) window. This is
    // mathematically equivalent to requiring >= buffer minutes of gap on
    // whichever side the two slots are adjacent from.
    const paddedStart = existingStart - SLOT_BUFFER_MINUTES;
    const paddedEnd = existingEnd + SLOT_BUFFER_MINUTES;

    const overlaps = proposedStart < paddedEnd && proposedEnd > paddedStart;

    if (overlaps) {
      return {
        ok: false,
        reason: `Too close to an existing ${slot.status} slot (${slot.start_time}-${slot.end_time}). A ${SLOT_BUFFER_MINUTES}-minute buffer is required between slots.`,
      };
    }
  }

  return { ok: true };
}

export type CreateSlotWithBufferCheckResult =
  | { success: true; slot: AvailabilitySlot }
  | { success: false; error: "buffer_violation"; message: string }
  | { success: false; error: "unknown"; message: string };

/**
 * Admin-side orchestration: validates the 30-minute buffer rule against
 * every existing slot for that date (open/booked/closed — fetched via the
 * admin "all slots" repository read, not just open ones) before calling the
 * repository to actually insert. Returns a validation failure instead of
 * calling the repository at all when the buffer check fails.
 */
export async function createSlotWithBufferCheck(
  input: CreateSlotInput,
): Promise<CreateSlotWithBufferCheckResult> {
  try {
    const existingSlots = await getSlotsForDate(input.date);

    const bufferResult = checkSlotBuffer(existingSlots, {
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
    });

    if (!bufferResult.ok) {
      return { success: false, error: "buffer_violation", message: bufferResult.reason };
    }

    const slot = await createSlot(input);
    return { success: true, slot };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create slot.";
    return { success: false, error: "unknown", message };
  }
}

// ---------------------------------------------------------------------------
// Booking windows (0014): a window is now a continuous block the customer
// picks a start time inside, rather than a single pre-cut slot. The
// functions below are the service-layer, UI-supporting equivalent of the
// grid/overlap validation that book_slot_and_create_booking
// (supabase/migrations/0014_booking_windows.sql) also enforces server-side
// inside the RPC. THESE FUNCTIONS ARE ADVISORY ONLY — they exist so the UI
// can offer only valid start-time buttons and fail fast with a friendly
// message before round-tripping to the RPC, but they are NOT a security
// boundary. A direct RPC call bypassing this computation entirely must still
// be rejected correctly by the RPC's own bounds/grid/overlap checks; never
// remove or weaken those checks on the assumption that "the UI already only
// offers valid options."
// ---------------------------------------------------------------------------

export type StartTimeOption = { startTime: string; endTime: string };

type MinimalBookingForOverlap = {
  session_start_time: string;
  session_end_time: string;
  status: string;
  created_at: string;
};

/**
 * Pure, unit-testable core of the "which start times can the customer pick"
 * rule: given a window and the service's duration, generates every
 * 30-minute-grid-aligned candidate start time from window.start_time up to
 * (and including) the latest start that still leaves room for the full
 * duration before window.end_time, then filters out any candidate whose
 * [start, start+duration] range, padded by SLOT_BUFFER_MINUTES on both
 * sides, overlaps an existing non-cancelled booking already carved from this
 * window.
 *
 * cancelled/auto_cancelled bookings are excluded from the overlap check
 * entirely (they no longer occupy real studio time), and a pending_deposit
 * booking stops counting once it's older than PENDING_DEPOSIT_HOLD_MINUTES
 * (no successful payment ever landed on it in that time) — mirroring the
 * same exclusions in the RPC's SQL overlap predicate
 * (0018_pending_deposit_age_limit.sql).
 *
 * Takes plain data in/out (no Supabase calls) specifically so it can be
 * unit-tested without a database or mocks — same style as checkSlotBuffer.
 */
export function computeValidStartTimes(
  window: Pick<AvailabilitySlot, "start_time" | "end_time">,
  durationHours: number,
  existingBookings: MinimalBookingForOverlap[],
): StartTimeOption[] {
  const windowStart = timeToMinutes(window.start_time);
  const windowEnd = timeToMinutes(window.end_time);
  const durationMinutes = Math.round(durationHours * 60);

  if (durationMinutes <= 0) {
    throw new Error(`computeValidStartTimes: invalid durationHours "${durationHours}"`);
  }

  // Only bookings that still occupy real studio time can block a candidate.
  const pendingCutoff = Date.now() - PENDING_DEPOSIT_HOLD_MINUTES * 60_000;
  const activeBookings = existingBookings.filter((booking) => {
    if (booking.status === "cancelled" || booking.status === "auto_cancelled") return false;
    if (booking.status === "pending_deposit") {
      return new Date(booking.created_at).getTime() >= pendingCutoff;
    }
    return true;
  });

  const options: StartTimeOption[] = [];

  // Last valid grid-aligned start is the latest 30-minute mark that still
  // leaves durationMinutes of room before windowEnd.
  const lastValidStart = windowEnd - durationMinutes;

  for (
    let candidateStart = windowStart;
    candidateStart <= lastValidStart;
    candidateStart += 30
  ) {
    const candidateEnd = candidateStart + durationMinutes;

    const paddedStart = candidateStart - SLOT_BUFFER_MINUTES;
    const paddedEnd = candidateEnd + SLOT_BUFFER_MINUTES;

    const overlapsExisting = activeBookings.some((booking) => {
      const bookingStart = timeToMinutes(booking.session_start_time);
      const bookingEnd = timeToMinutes(booking.session_end_time);

      // Standard overlap predicate: two ranges intersect iff each one
      // starts before the other ends. Padding our own candidate range (not
      // the existing booking's) by the buffer on both sides is equivalent
      // to requiring >= SLOT_BUFFER_MINUTES of true clearance from the
      // existing booking on whichever side they're adjacent from.
      return paddedStart < bookingEnd && paddedEnd > bookingStart;
    });

    if (!overlapsExisting) {
      options.push({
        startTime: minutesToTime(candidateStart),
        endTime: minutesToTime(candidateEnd),
      });
    }
  }

  return options;
}

/**
 * Converts minutes-since-midnight back to "HH:MM:SS", matching the format
 * AvailabilitySlot.start_time/end_time already use (see
 * lib/repositories/availability-repository.ts) so callers can feed the
 * result straight back into the repository/RPC layer without reformatting.
 * Inverse of timeToMinutes for whole-minute values (seconds always ":00"
 * since every candidate here is grid-aligned).
 */
function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:00`;
}

export type GetValidStartTimesResult =
  | { success: true; options: StartTimeOption[] }
  | { success: false; error: "window_not_found" | "invalid_service" | "unknown"; message: string };

/**
 * I/O wrapper around computeValidStartTimes: fetches the window
 * (getSlotById), its existing non-cancelled-filtered-later bookings
 * (getBookingsForSlot), and the service's duration (getServiceById) from the
 * repository layer, then delegates all business logic to the pure function
 * above. Kept separate from computeValidStartTimes so the grid/overlap
 * logic itself stays trivially unit-testable without mocking Supabase.
 */
export async function getValidStartTimesForWindow(
  slotId: string,
  serviceId: string,
  excludeBookingId?: string,
): Promise<GetValidStartTimesResult> {
  try {
    const [service, allBookings, window] = await Promise.all([
      getServiceById(serviceId),
      getBookingsForSlot(slotId),
      getSlotById(slotId),
    ]);

    // Admin reschedule (lib/repositories/admin-booking-repository.ts) may
    // target the SAME window a booking is already carved from — without this
    // exclusion, that booking's own current time range would count as an
    // "existing booking" blocking candidates around itself. The customer
    // booking flow never passes this (there is no booking to exclude yet),
    // so it's a no-op filter there.
    // getBookingsForSlot(slotId) only ever returns bookings that have this
    // real window as their slot_id — by 0019_addon_bookings.sql's
    // consistency check, slot_id is non-null iff every session_* field is
    // too, so this filter is a type-narrow of an invariant that already
    // holds, not a behavior change (an is_addon booking has no slot_id and
    // could never be returned here in the first place).
    const existingBookings = allBookings
      .filter((b) => (excludeBookingId ? b.id !== excludeBookingId : true))
      .filter(
        (b): b is typeof b & { session_start_time: string; session_end_time: string } =>
          b.session_start_time !== null && b.session_end_time !== null,
      );

    if (!window) {
      return {
        success: false,
        error: "window_not_found",
        message: "This availability window could not be found.",
      };
    }

    if (!service) {
      return {
        success: false,
        error: "invalid_service",
        message: "This service is no longer available. Please choose another.",
      };
    }

    const options = computeValidStartTimes(window, service.duration_hours, existingBookings);
    return { success: true, options };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to compute available start times.";
    return { success: false, error: "unknown", message };
  }
}
