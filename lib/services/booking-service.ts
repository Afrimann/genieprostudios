import { createClient } from "@/lib/supabase/server";

// Mirrors public.bookings (see supabase/migrations/0005_bookings.sql).
export type BookingStatus =
  | "pending_deposit"
  | "deposited"
  | "paid_in_full"
  | "auto_cancelled"
  | "cancelled";

// session_date/session_start_time/session_end_date/session_end_time are
// only null together, for an is_addon booking created via
// createAddonBooking() below — a per-song service (e.g. mixing/mastering)
// has no studio room time to reserve at all (see
// 0036_blocked_time_ranges.sql's updated bookings_session_fields_consistent
// check constraint, the DB-level source of truth for this invariant).
// Never null for a real session booking (createPendingBooking). slot_id no
// longer exists on this table (dropped in 0036 alongside availability_slots
// — every date is open by default now, see book_session/0037).
export type Booking = {
  id: string;
  customer_id: string;
  service_id: string;
  session_date: string | null;
  session_start_time: string | null;
  session_end_date: string | null;
  session_end_time: string | null;
  // Order contact info, collected once per order — only ever set on an
  // is_addon booking (createAddonBooking below). Null for a room booking,
  // which already has the customer's profile. See 0020_addon_song_details.sql.
  contact_name: string | null;
  contact_email: string | null;
  total_price_kobo: number;
  deposit_amount_kobo: number;
  amount_paid_kobo: number;
  status: BookingStatus;
  tc_acceptance_id: string | null;
  created_at: string;
  updated_at: string;
};

// Discriminated union so the frontend can branch on `.error` without ever
// parsing Postgres error strings itself.
//
// 0037 note: book_session takes a customer-chosen p_date/p_start_time and
// validates grid alignment, that the start isn't in the past, overlap
// against admin-marked blocked_time_ranges, and overlap with existing
// bookings — including across a midnight boundary, since a session may now
// legitimately span two calendar days (see
// supabase/migrations/0037_book_session.sql). The error variants below
// correspond 1:1 to that RPC's raise exception codes.
export type CreatePendingBookingResult =
  | { success: true; booking: Booking }
  | { success: false; error: "invalid_service"; message: string }
  | { success: false; error: "auth_required"; message: string }
  | { success: false; error: "start_in_past"; message: string }
  | { success: false; error: "invalid_start_time"; message: string }
  | { success: false; error: "time_blocked"; message: string }
  | { success: false; error: "time_unavailable"; message: string }
  | { success: false; error: "is_addon_service"; message: string }
  | { success: false; error: "not_an_addon"; message: string }
  | { success: false; error: "invalid_song_count"; message: string }
  | { success: false; error: "invalid_contact"; message: string }
  | { success: false; error: "unknown"; message: string };

/**
 * Creates a pending booking by calling the book_session Postgres RPC
 * (supabase/migrations/0037_book_session.sql), which inserts the bookings
 * row for the customer-chosen date + startTime in a single transaction,
 * after validating grid alignment, that the start isn't already in the
 * past, overlap against admin-marked blocked_time_ranges, and overlap with
 * any existing non-cancelled booking — all serialized via an advisory
 * transaction lock keyed on the target date(s) so concurrent requests for
 * overlapping times can never both succeed. This is the ONLY supported way
 * to create a booking that reserves real studio time — never insert into
 * bookings directly from application code, since that would reintroduce
 * the double-booking race the RPC exists to prevent. For an is_addon
 * service with no room time to reserve (e.g. per-song mixing/mastering),
 * use createAddonBooking below instead.
 *
 * `startTime` must be "HH:MM" or "HH:MM:SS" (matching the format used
 * elsewhere for BlockedTimeRange.start_time/end_time — see
 * lib/repositories/availability-repository.ts and
 * lib/services/availability-service.ts's computeValidStartTimes, which is
 * the advisory, UI-supporting source of the options a caller should be
 * choosing from). This function does not itself validate date/startTime's
 * format/alignment/bounds — that validation is the RPC's job server-side,
 * per this codebase's money/security discipline: never trust client input,
 * always let the database (via auth.uid() and its own checks) be the source
 * of truth. Passing an invalid date/startTime here is expected to surface
 * as one of the start_in_past/invalid_start_time/time_blocked/
 * time_unavailable failures below, not as a client-side-caught error.
 *
 * The RPC alone determines the deposit amount (ceil(price_kobo * 0.7),
 * server-side) — this function must never compute or pass a deposit amount
 * itself. See lib/utils/money.ts's estimateDepositKobo() for the
 * display-only client estimate, which is not sent here.
 *
 * customer_id is derived server-side from the caller's auth.uid() inside
 * the RPC; date/serviceId/startTime are the only inputs. A session may now
 * span midnight — the RPC itself computes session_end_date/
 * session_end_time via plain timestamp arithmetic, this function never
 * computes or passes an end date/time.
 */
export async function createPendingBooking(
  date: string,
  serviceId: string,
  startTime: string,
): Promise<CreatePendingBookingResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("book_session", {
    p_service_id: serviceId,
    p_date: date,
    p_start_time: startTime,
  });

  if (error) {
    return translateBookSlotError(error);
  }

  if (!data) {
    return {
      success: false,
      error: "unknown",
      message: "Booking could not be created. Please try again.",
    };
  }

  return { success: true, booking: data as Booking };
}

/**
 * Creates a pending booking for an is_addon service (e.g. per-song
 * mixing/mastering) by calling create_addon_booking
 * (supabase/migrations/0020_addon_song_details.sql) — the addon equivalent
 * of createPendingBooking above. No slotId/startTime: an addon booking has
 * no studio room time to reserve, so there's nothing to validate against a
 * window's bounds/grid/overlap. The RPC prices the booking at
 * price_kobo * songCount and records contactName/contactEmail — individual
 * songs are recorded separately afterward via booking-tracks-repository.ts's
 * createBookingTrack, one row per song, once each file has finished
 * uploading to storage.
 */
export async function createAddonBooking(
  serviceId: string,
  songCount: number,
  contactName: string,
  contactEmail: string,
): Promise<CreatePendingBookingResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("create_addon_booking", {
    p_service_id: serviceId,
    p_song_count: songCount,
    p_contact_name: contactName,
    p_contact_email: contactEmail,
  });

  if (error) {
    return translateBookSlotError(error);
  }

  if (!data) {
    return {
      success: false,
      error: "unknown",
      message: "Booking could not be created. Please try again.",
    };
  }

  return { success: true, booking: data as Booking };
}

/**
 * Maps a Postgres error surfaced through supabase-js's RPC call to a clean,
 * typed failure result. The RPC raises plain `raise exception '<code>'`
 * with no SQLSTATE customization, so the code shows up in
 * error.message (and often duplicated into error.details) rather than in a
 * dedicated field — matching is done via substring checks accordingly.
 *
 * Order matters slightly here only for clarity, not correctness: each code
 * is a distinct, non-overlapping substring (e.g. "invalid_service" and
 * "invalid_start_time" both start with "invalid_" but are checked as full
 * substrings, so there's no risk of one accidentally matching the other).
 */
function translateBookSlotError(error: {
  message: string;
  details?: string | null;
}): CreatePendingBookingResult {
  const text = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();

  if (text.includes("invalid_service")) {
    return {
      success: false,
      error: "invalid_service",
      message: "This service is no longer available. Please choose another.",
    };
  }

  if (text.includes("auth_required")) {
    return {
      success: false,
      error: "auth_required",
      message: "Please sign in before booking a session.",
    };
  }

  if (text.includes("start_in_past")) {
    return {
      success: false,
      error: "start_in_past",
      message: "That start time has already passed. Please pick another time.",
    };
  }

  if (text.includes("invalid_start_time")) {
    return {
      success: false,
      error: "invalid_start_time",
      message: "Please choose a start time on the 30-minute schedule (e.g. 10:00 or 10:30).",
    };
  }

  if (text.includes("time_blocked")) {
    return {
      success: false,
      error: "time_blocked",
      message: "That time isn't available (blocked by the studio). Please pick another time.",
    };
  }

  if (text.includes("time_unavailable")) {
    return {
      success: false,
      error: "time_unavailable",
      message: "That time was just booked (or is too close to another booking), please pick another.",
    };
  }

  if (text.includes("is_addon_service")) {
    return {
      success: false,
      error: "is_addon_service",
      message: "This service has no studio time to reserve. Please use the add-on flow instead.",
    };
  }

  if (text.includes("not_an_addon")) {
    return {
      success: false,
      error: "not_an_addon",
      message: "This service requires a studio date and time. Please choose it from the regular booking flow.",
    };
  }

  if (text.includes("invalid_song_count")) {
    return {
      success: false,
      error: "invalid_song_count",
      message: "Please add at least one song before continuing.",
    };
  }

  if (text.includes("invalid_contact")) {
    return {
      success: false,
      error: "invalid_contact",
      message: "Please provide a valid name and email address.",
    };
  }

  return {
    success: false,
    error: "unknown",
    message: "Something went wrong while creating your booking. Please try again.",
  };
}
