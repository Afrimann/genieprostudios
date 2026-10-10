"use server";

// Server Action boundary for the customer-facing booking flow
// (app/book). Wraps repository/service reads that require a server-side
// Supabase client (cookies()) so the Client Component-owned
// lib/hooks/use-booking-flow.ts can call them directly.

import { getActiveServices, type Service } from "@/lib/repositories/service-repository";
import { cancelOwnPendingBooking } from "@/lib/repositories/booking-repository";
import {
  createBookingTrack,
  type BookingTrack,
} from "@/lib/repositories/booking-tracks-repository";
import {
  createPendingBooking as createPendingBookingService,
  createAddonBooking as createAddonBookingService,
  type CreatePendingBookingResult,
} from "@/lib/services/booking-service";
import {
  getValidStartTimesForDate,
  type GetValidStartTimesResult,
} from "@/lib/services/availability-service";

export type FetchServicesResult =
  | { success: true; services: Service[] }
  | { success: false; message: string };

export async function fetchServices(): Promise<FetchServicesResult> {
  try {
    const services = await getActiveServices();
    return { success: true, services };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load services.";
    return { success: false, message };
  }
}

/** Thin passthrough — getValidStartTimesForDate is already a
 * discriminated-union result, no extra shaping needed. Advisory only (see
 * lib/services/availability-service.ts) — the RPC called by
 * createPendingBooking below independently re-validates grid/past/block/
 * overlap server-side, so this is purely what populates the UI's
 * start-time buttons. Every date is open by default now (0036/0037) — there
 * is no "open dates"/"open slots" allowlist fetch anymore; the date picker
 * only needs to keep disabling past dates (see
 * components/booking/booking-flow.tsx's disabled prop), a frontend-facing
 * change out of this file's scope. */
export async function fetchValidStartTimes(
  date: string,
  serviceId: string,
): Promise<GetValidStartTimesResult> {
  return getValidStartTimesForDate(date, serviceId);
}

/** Thin passthrough — createPendingBooking is already a discriminated-union
 * result, no extra shaping needed. Re-exported under this module purely so
 * the hook only ever imports from "use server" action files, never
 * services/repositories directly (keeps the Component -> Hook -> Service
 * boundary enforceable at the Client Component layer).
 *
 * startTime ("HH:MM" or "HH:MM:SS") is the customer's chosen start time from
 * one of the options fetchValidStartTimes returned — see
 * 0037_book_session.sql's book_session for the server-side grid/past/
 * block/overlap enforcement this ultimately calls into. */
export async function createPendingBooking(
  date: string,
  serviceId: string,
  startTime: string,
): Promise<CreatePendingBookingResult> {
  return createPendingBookingService(date, serviceId, startTime);
}

/** Thin passthrough — same convention as createPendingBooking above, for
 * the is_addon (per-song, no studio room time) path. See
 * supabase/migrations/0020_addon_song_details.sql's create_addon_booking.
 * Prices the booking at price_kobo * songCount server-side; the individual
 * songs themselves are recorded afterward via saveBookingTrack below, once
 * each file has finished uploading to storage. */
export async function createAddonBooking(
  serviceId: string,
  songCount: number,
  contactName: string,
  contactEmail: string,
): Promise<CreatePendingBookingResult> {
  return createAddonBookingService(serviceId, songCount, contactName, contactEmail);
}

export type SaveBookingTrackResult =
  | { success: true; track: BookingTrack }
  | { success: false; message: string };

/**
 * Records one song's title + already-uploaded file path against a booking.
 * Called once per song, after that song's file has finished uploading
 * directly to the track-uploads storage bucket from the browser (see
 * lib/hooks/use-booking-flow.ts's submitAddonSongs) — this function never
 * touches file bytes itself, only the booking_tracks row.
 */
export async function saveBookingTrack(params: {
  bookingId: string;
  position: number;
  title: string;
  filePath: string;
  fileName: string;
}): Promise<SaveBookingTrackResult> {
  try {
    const track = await createBookingTrack(params);
    return { success: true, track };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save this song.";
    return { success: false, message };
  }
}

export type CancelBookingResult =
  | { success: true }
  | { success: false; message: string };

/**
 * Customer-facing "opt out of making this booking request" action — used
 * both by the booking flow's own summary step and by the dashboard's
 * pending-booking cards/detail page. Thin wrapper around
 * cancelOwnPendingBooking (booking-repository.ts), which already enforces
 * ownership + the pending_deposit-only guard; this layer just shapes the
 * result and turns "already resolved, nothing to cancel" into a clear
 * customer-facing message rather than a silent no-op.
 */
export async function cancelBooking(bookingId: string): Promise<CancelBookingResult> {
  try {
    const booking = await cancelOwnPendingBooking(bookingId);

    if (!booking) {
      return {
        success: false,
        message:
          "This booking can no longer be cancelled here — it may already be paid, cancelled, or not yours.",
      };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to cancel this booking.";
    return { success: false, message };
  }
}
