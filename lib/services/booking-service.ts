import { createClient } from "@/lib/supabase/server";

// Mirrors public.bookings (see supabase/migrations/0005_bookings.sql).
export type BookingStatus =
  | "pending_deposit"
  | "deposited"
  | "paid_in_full"
  | "auto_cancelled"
  | "cancelled";

export type Booking = {
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
  tc_acceptance_id: string | null;
  created_at: string;
  updated_at: string;
};

// Discriminated union so the frontend can branch on `.error` without ever
// parsing Postgres error strings itself.
//
// 0014 note: book_slot_and_create_booking now takes a customer-chosen
// p_start_time and validates it against the window's bounds, the 30-minute
// grid, and overlap with existing bookings on that window (see
// supabase/migrations/0014_booking_windows.sql) — the three new error
// variants below (outside_window/invalid_start_time/time_unavailable)
// correspond 1:1 to that RPC's new raise exception codes.
export type CreatePendingBookingResult =
  | { success: true; booking: Booking }
  | { success: false; error: "slot_taken"; message: string }
  | { success: false; error: "invalid_service"; message: string }
  | { success: false; error: "auth_required"; message: string }
  | { success: false; error: "outside_window"; message: string }
  | { success: false; error: "invalid_start_time"; message: string }
  | { success: false; error: "time_unavailable"; message: string }
  | { success: false; error: "unknown"; message: string };

/**
 * Creates a pending booking by calling the book_slot_and_create_booking
 * Postgres RPC (supabase/migrations/0014_booking_windows.sql), which locks
 * the window row (FOR UPDATE) and inserts the bookings row for the
 * customer-chosen startTime in a single transaction, after validating that
 * startTime against the window's bounds, the 30-minute grid, and overlap
 * with any existing non-cancelled booking already carved from that same
 * window. This is the ONLY supported way to create a booking — never insert
 * into bookings/availability_slots directly from application code, since
 * that would reintroduce the double-booking race the RPC exists to prevent.
 *
 * `startTime` must be "HH:MM" or "HH:MM:SS" (matching the format used
 * elsewhere for AvailabilitySlot.start_time/end_time — see
 * lib/repositories/availability-repository.ts and
 * lib/services/availability-service.ts's computeValidStartTimes, which is
 * the advisory, UI-supporting source of the options a caller should be
 * choosing from). This function does not itself validate startTime's
 * format/alignment/bounds — that validation is the RPC's job server-side,
 * per this codebase's money/security discipline: never trust client input,
 * always let the database (via auth.uid() and its own checks) be the source
 * of truth. Passing an invalid startTime here is expected to surface as one
 * of the outside_window/invalid_start_time/time_unavailable failures below,
 * not as a client-side-caught error.
 *
 * The RPC alone determines the deposit amount (ceil(price_kobo * 0.7),
 * server-side) — this function must never compute or pass a deposit amount
 * itself. See lib/utils/money.ts's estimateDepositKobo() for the
 * display-only client estimate, which is not sent here.
 *
 * customer_id is derived server-side from the caller's auth.uid() inside
 * the RPC; slotId/serviceId/startTime are the only inputs.
 */
export async function createPendingBooking(
  slotId: string,
  serviceId: string,
  startTime: string,
): Promise<CreatePendingBookingResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("book_slot_and_create_booking", {
    p_slot_id: slotId,
    p_service_id: serviceId,
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

  if (text.includes("slot_unavailable")) {
    return {
      success: false,
      error: "slot_taken",
      message: "This slot was just taken, please pick another.",
    };
  }

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

  if (text.includes("outside_window")) {
    return {
      success: false,
      error: "outside_window",
      message: "That start time doesn't leave enough room in this availability window. Please pick another time.",
    };
  }

  if (text.includes("invalid_start_time")) {
    return {
      success: false,
      error: "invalid_start_time",
      message: "Please choose a start time on the 30-minute schedule (e.g. 10:00 or 10:30).",
    };
  }

  if (text.includes("time_unavailable")) {
    return {
      success: false,
      error: "time_unavailable",
      message: "That time was just booked (or is too close to another booking), please pick another.",
    };
  }

  return {
    success: false,
    error: "unknown",
    message: "Something went wrong while creating your booking. Please try again.",
  };
}
