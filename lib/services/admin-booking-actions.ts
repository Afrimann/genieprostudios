"use server";

// Server Action boundary for the admin unresolved-bookings UI
// (app/admin/(protected)/bookings). Mirrors lib/services/availability-actions.ts's
// pattern: thin wrappers around repository/service calls, never thrown
// errors, always a typed result the Client Component can branch on.

import {
  getUnresolvedPastSessions,
  markBookingStale,
  type UnresolvedBooking,
} from "@/lib/repositories/admin-booking-repository";
import { getTrackDownloadUrl } from "@/lib/repositories/booking-tracks-repository";
import {
  getValidStartTimesForDate,
  type GetValidStartTimesResult,
} from "@/lib/services/availability-service";
import {
  rescheduleBooking,
  type RescheduleBookingResult,
} from "@/lib/services/admin-booking-service";
import type { Booking } from "@/lib/services/booking-service";

export type FetchUnresolvedBookingsResult =
  | { success: true; bookings: UnresolvedBooking[] }
  | { success: false; message: string };

export async function fetchUnresolvedBookings(): Promise<FetchUnresolvedBookingsResult> {
  try {
    const bookings = await getUnresolvedPastSessions();
    return { success: true, bookings };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load unresolved bookings.";
    return { success: false, message };
  }
}

export type MarkBookingStaleResult =
  | { success: true; booking: Booking }
  | { success: false; message: string };

/** Only succeeds if the booking is still 'deposited' — see markBookingStale's no-op-on-race guard. */
export async function markBookingStaleAction(bookingId: string): Promise<MarkBookingStaleResult> {
  try {
    const booking = await markBookingStale(bookingId);

    if (!booking) {
      return {
        success: false,
        message: "This booking has already moved on (paid, or already marked stale) — refresh the list.",
      };
    }

    return { success: true, booking };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to mark booking stale.";
    return { success: false, message };
  }
}

/**
 * excludeBookingId is always the booking currently being rescheduled, so its
 * own current time range never blocks itself if the admin picks the same
 * date it's already on. See getValidStartTimesForDate's third param.
 *
 * Every date is open by default now (0036/0037) — there is no "open dates"
 * allowlist to fetch anymore. The admin reschedule calendar instead only
 * needs to keep disabling past dates (a plain `date < today` check in the
 * UI), same as the customer booking flow.
 */
export async function fetchValidStartTimesForReschedule(
  date: string,
  serviceId: string,
  excludeBookingId: string,
): Promise<GetValidStartTimesResult> {
  return getValidStartTimesForDate(date, serviceId, excludeBookingId);
}

export async function rescheduleBookingAction(
  bookingId: string,
  date: string,
  startTime: string,
): Promise<RescheduleBookingResult> {
  return rescheduleBooking(bookingId, date, startTime);
}

export type GetTrackDownloadUrlResult =
  | { success: true; url: string }
  | { success: false; message: string };

/**
 * Signed download URL for an addon booking's uploaded track — relies on the
 * track_uploads_select_admin storage policy (0020_addon_song_details.sql),
 * so this only succeeds when called by an admin's own session.
 */
export async function getTrackDownloadUrlAction(filePath: string): Promise<GetTrackDownloadUrlResult> {
  try {
    const url = await getTrackDownloadUrl(filePath);
    return { success: true, url };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate a download link.";
    return { success: false, message };
  }
}
