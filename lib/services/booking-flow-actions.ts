"use server";

// Server Action boundary for the customer-facing booking flow
// (app/book). Wraps repository/service reads that require a server-side
// Supabase client (cookies()) so the Client Component-owned
// lib/hooks/use-booking-flow.ts can call them directly.

import { getActiveServices, type Service } from "@/lib/repositories/service-repository";
import {
  getOpenDatesInRange,
  getOpenSlotsForDate,
  type AvailabilitySlot,
} from "@/lib/repositories/availability-repository";
import {
  createPendingBooking as createPendingBookingService,
  type CreatePendingBookingResult,
} from "@/lib/services/booking-service";
import {
  getValidStartTimesForWindow,
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

export type FetchOpenDatesResult =
  | { success: true; dates: string[] }
  | { success: false; message: string };

export async function fetchOpenDates(
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

export type FetchOpenSlotsResult =
  | { success: true; slots: AvailabilitySlot[] }
  | { success: false; message: string };

export async function fetchOpenSlots(date: string): Promise<FetchOpenSlotsResult> {
  try {
    const slots = await getOpenSlotsForDate(date);
    return { success: true, slots };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load open slots.";
    return { success: false, message };
  }
}

/** Thin passthrough — getValidStartTimesForWindow is already a
 * discriminated-union result, no extra shaping needed. Advisory only (see
 * lib/services/availability-service.ts) — the RPC called by
 * createPendingBooking below independently re-validates bounds/grid/overlap
 * server-side, so this is purely what populates the UI's start-time buttons. */
export async function fetchValidStartTimes(
  slotId: string,
  serviceId: string,
): Promise<GetValidStartTimesResult> {
  return getValidStartTimesForWindow(slotId, serviceId);
}

/** Thin passthrough — createPendingBooking is already a discriminated-union
 * result, no extra shaping needed. Re-exported under this module purely so
 * the hook only ever imports from "use server" action files, never
 * services/repositories directly (keeps the Component -> Hook -> Service
 * boundary enforceable at the Client Component layer).
 *
 * startTime ("HH:MM" or "HH:MM:SS") is the customer's chosen start time from
 * one of the options fetchValidStartTimes returned — see 0014_booking_windows.sql's
 * book_slot_and_create_booking for the server-side bounds/grid/overlap
 * enforcement this ultimately calls into. */
export async function createPendingBooking(
  slotId: string,
  serviceId: string,
  startTime: string,
): Promise<CreatePendingBookingResult> {
  return createPendingBookingService(slotId, serviceId, startTime);
}
