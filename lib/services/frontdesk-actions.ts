"use server";

// Server Action boundary for the /frontdesk reception board. Mirrors
// lib/services/admin-booking-actions.ts: thin wrappers around the RPCs,
// never thrown errors, always a typed result the Client Component branches
// on. Authorization lives in the frontdesk_* RPCs themselves (each one
// checks can_use_frontdesk() as its second statement, see
// 0033_session_attendance.sql) — not here, and not in the UI.

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

/**
 * The exception names raised by the frontdesk_* RPCs. Kept as a discriminated
 * code rather than flattened into a message string because the UI genuinely
 * branches on one of them: `balance_outstanding` is not an error to display,
 * it is the prompt to open the confirmation dialog.
 */
export type FrontdeskErrorCode =
  | "auth_required"
  | "frontdesk_required"
  | "booking_not_found"
  | "booking_not_active"
  | "balance_outstanding"
  | "already_clocked_in"
  | "already_clocked_out"
  | "not_clocked_in"
  | "session_not_started"
  | "unknown";

export type FrontdeskActionResult =
  | { success: true }
  | { success: false; code: FrontdeskErrorCode; message: string };

const ERROR_MESSAGES: Record<FrontdeskErrorCode, string> = {
  auth_required: "Your session expired — sign in again.",
  frontdesk_required: "This account doesn't have front desk access.",
  booking_not_found: "That booking no longer exists — refresh the board.",
  booking_not_active: "That booking isn't an active session any more — refresh the board.",
  balance_outstanding: "This customer still has an outstanding balance.",
  already_clocked_in: "Someone already clocked this session in — refresh the board.",
  already_clocked_out: "This session has already been clocked out.",
  not_clocked_in: "This session was never clocked in.",
  session_not_started: "This session hasn't reached its start time yet.",
  unknown: "Something went wrong. Try again.",
};

const KNOWN_CODES = Object.keys(ERROR_MESSAGES) as FrontdeskErrorCode[];

/**
 * Postgres `raise exception 'already_clocked_in'` arrives here as a
 * PostgREST error whose message embeds the raised text. Match on substring
 * rather than equality: PostgREST has wrapped these differently across
 * versions, and a desk tablet showing "Something went wrong" because of a
 * prefix change would be a bad trade for a stricter check.
 */
function toErrorCode(message: string): FrontdeskErrorCode {
  return KNOWN_CODES.find((code) => code !== "unknown" && message.includes(code)) ?? "unknown";
}

function toResult(message: string): FrontdeskActionResult {
  const code = toErrorCode(message);
  return { success: false, code, message: ERROR_MESSAGES[code] };
}

/**
 * Clocks a session in. `overrideUnpaid` is the second half of the
 * confirmation dialog: the first call for a booking with money still owed
 * comes back `balance_outstanding`, the UI shows the amount and asks the
 * staff member to confirm, and the retry passes true — at which point the
 * override is recorded against the attendance row by the RPC itself.
 */
export async function clockInSession(
  bookingId: string,
  overrideUnpaid = false,
): Promise<FrontdeskActionResult> {
  try {
    const supabase = await createClient();

    const { error } = await supabase.rpc("frontdesk_clock_in", {
      p_booking_id: bookingId,
      p_override_unpaid: overrideUnpaid,
    });

    if (error) {
      return toResult(error.message);
    }

    revalidatePath("/frontdesk");
    return { success: true };
  } catch (err) {
    return toResult(err instanceof Error ? err.message : "");
  }
}

/** Clocks a session out as completed. */
export async function clockOutSession(bookingId: string): Promise<FrontdeskActionResult> {
  try {
    const supabase = await createClient();

    const { error } = await supabase.rpc("frontdesk_clock_out", {
      p_booking_id: bookingId,
    });

    if (error) {
      return toResult(error.message);
    }

    revalidatePath("/frontdesk");
    return { success: true };
  } catch (err) {
    return toResult(err instanceof Error ? err.message : "");
  }
}

/**
 * Records that a customer never arrived. Reversible — clocking them in
 * afterwards clears it, which is deliberate: someone written off at 7pm who
 * walks in at 7:40 is a normal evening.
 */
export async function markSessionNoShow(bookingId: string): Promise<FrontdeskActionResult> {
  try {
    const supabase = await createClient();

    const { error } = await supabase.rpc("frontdesk_mark_no_show", {
      p_booking_id: bookingId,
    });

    if (error) {
      return toResult(error.message);
    }

    revalidatePath("/frontdesk");
    return { success: true };
  } catch (err) {
    return toResult(err instanceof Error ? err.message : "");
  }
}
