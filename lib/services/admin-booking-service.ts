import { createClient } from "@/lib/supabase/server";
import type { Booking } from "@/lib/services/booking-service";

// Admin-only reschedule orchestration — mirrors createPendingBooking's
// RPC-call + error-translation shape in booking-service.ts, calling
// admin_reschedule_booking (0037_book_session.sql) instead of book_session.

export type RescheduleBookingResult =
  | { success: true; booking: Booking }
  | { success: false; error: "admin_required"; message: string }
  | { success: false; error: "booking_not_found"; message: string }
  | { success: false; error: "invalid_service"; message: string }
  | { success: false; error: "start_in_past"; message: string }
  | { success: false; error: "invalid_start_time"; message: string }
  | { success: false; error: "time_blocked"; message: string }
  | { success: false; error: "time_unavailable"; message: string }
  | { success: false; error: "unknown"; message: string };

/**
 * Moves an existing booking onto a new date/start time via
 * admin_reschedule_booking. `startTime` must be "HH:MM" or "HH:MM:SS" — one
 * of the options getValidStartTimesForDate(date, serviceId, bookingId)
 * returned for the target date (see
 * lib/services/availability-service.ts's excludeBookingId param, added
 * specifically so this UI's advisory list doesn't block on the booking's
 * own current time when rescheduling within the same date). This function
 * does not itself validate date/startTime — the RPC is the actual
 * security/correctness boundary, same discipline as createPendingBooking.
 */
export async function rescheduleBooking(
  bookingId: string,
  date: string,
  startTime: string,
): Promise<RescheduleBookingResult> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("admin_reschedule_booking", {
    p_booking_id: bookingId,
    p_date: date,
    p_start_time: startTime,
  });

  if (error) {
    return translateRescheduleError(error);
  }

  if (!data) {
    return {
      success: false,
      error: "unknown",
      message: "Reschedule could not be completed. Please try again.",
    };
  }

  return { success: true, booking: data as Booking };
}

function translateRescheduleError(error: {
  message: string;
  details?: string | null;
}): RescheduleBookingResult {
  const text = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();

  if (text.includes("admin_required")) {
    return {
      success: false,
      error: "admin_required",
      message: "You must be signed in as an admin to do this.",
    };
  }

  if (text.includes("booking_not_found")) {
    return {
      success: false,
      error: "booking_not_found",
      message: "This booking could not be found.",
    };
  }

  if (text.includes("invalid_service")) {
    return {
      success: false,
      error: "invalid_service",
      message: "This booking's service is no longer available.",
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
      message: "That time overlaps another booking (or its buffer). Please pick another time.",
    };
  }

  return {
    success: false,
    error: "unknown",
    message: "Something went wrong while rescheduling. Please try again.",
  };
}
