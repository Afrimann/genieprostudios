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
import {
  getOpenDatesInRange,
  getOpenSlotsForDate,
  type AvailabilitySlot,
} from "@/lib/repositories/availability-repository";
import {
  getValidStartTimesForWindow,
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

export type FetchOpenDatesResult =
  | { success: true; dates: string[] }
  | { success: false; message: string };

/** Reused date-range read (same underlying repository call the customer booking flow uses — availability_slots.status='open' is publicly readable, no admin-specific filtering needed). */
export async function fetchOpenDatesForReschedule(
  startDate: string,
  endDate: string,
): Promise<FetchOpenDatesResult> {
  try {
    const dates = await getOpenDatesInRange(startDate, endDate);
    return { success: true, dates };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load open dates.";
    return { success: false, message };
  }
}

export type FetchWindowsResult =
  | { success: true; windows: AvailabilitySlot[] }
  | { success: false; message: string };

export async function fetchWindowsForRescheduleDate(date: string): Promise<FetchWindowsResult> {
  try {
    const windows = await getOpenSlotsForDate(date);
    return { success: true, windows };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load open windows.";
    return { success: false, message };
  }
}

/**
 * excludeBookingId is always the booking currently being rescheduled, so its
 * own current time range never blocks itself if the admin picks the same
 * window it's already on. See getValidStartTimesForWindow's third param.
 */
export async function fetchValidStartTimesForReschedule(
  slotId: string,
  serviceId: string,
  excludeBookingId: string,
): Promise<GetValidStartTimesResult> {
  return getValidStartTimesForWindow(slotId, serviceId, excludeBookingId);
}

export async function rescheduleBookingAction(
  bookingId: string,
  slotId: string,
  startTime: string,
): Promise<RescheduleBookingResult> {
  return rescheduleBooking(bookingId, slotId, startTime);
}
