"use server";

// Server Action boundary between admin Client Components and the
// availability service/repository layer (both of which use
// createClient() from lib/supabase/server.ts and therefore can only run
// server-side). Mirrors the pattern in lib/services/auth-service.ts:
// validate input server-side, never throw for expected failures, always
// return a typed result the UI can branch on directly.

import {
  getSlotsForDate,
  getSlotsForDateWithBookings,
  closeSlot as closeSlotRepo,
  type AvailabilitySlot,
  type SlotWithBookings,
} from "@/lib/repositories/availability-repository";
import {
  createSlotWithBufferCheck,
  type CreateSlotWithBufferCheckResult,
} from "@/lib/services/availability-service";
import { createSlotSchema } from "@/lib/validation/availability";

export type GetSlotsForDateResult =
  | { success: true; slots: AvailabilitySlot[] }
  | { success: false; message: string };

/** Admin-only: all slots (any status) for a given date. */
export async function fetchSlotsForDate(date: string): Promise<GetSlotsForDateResult> {
  try {
    const slots = await getSlotsForDate(date);
    return { success: true, slots };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load slots.";
    return { success: false, message };
  }
}

/**
 * Validates + creates a new slot with the mandatory buffer check. Never
 * calls createSlot()/the repository directly — createSlotWithBufferCheck is
 * the only sanctioned path per lib/services/availability-service.ts.
 */
export async function addSlot(input: {
  date: string;
  startTime: string;
  endTime: string;
}): Promise<CreateSlotWithBufferCheckResult> {
  const parsed = createSlotSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: "unknown",
      message: parsed.error.issues[0]?.message ?? "Invalid slot details",
    };
  }

  return createSlotWithBufferCheck({
    date: parsed.data.date,
    startTime: parsed.data.startTime,
    endTime: parsed.data.endTime,
  });
}

export type CloseSlotResult =
  | { success: true; slot: AvailabilitySlot }
  | { success: false; message: string };

/** Admin-only: closes an open slot. No-ops (returns failure) if it wasn't open. */
export async function closeSlotAction(slotId: string): Promise<CloseSlotResult> {
  try {
    const slot = await closeSlotRepo(slotId);

    if (!slot) {
      return {
        success: false,
        message: "This slot could not be closed (it may already be booked or closed).",
      };
    }

    return { success: true, slot };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to close slot.";
    return { success: false, message };
  }
}

export type GetSlotsForDateWithBookingsResult =
  | { success: true; slots: SlotWithBookings[] }
  | { success: false; message: string };

/**
 * Admin-only: all windows (any status) for a given date, each with its own
 * bookings nested underneath (ordered by session_start_time). Backs the
 * admin availability UI's "window -> its bookings" display (0014: a window
 * can now back multiple non-overlapping bookings, so the flat
 * fetchSlotsForDate view above no longer shows which times within a window
 * are already taken).
 */
export async function fetchSlotsForDateWithBookings(
  date: string,
): Promise<GetSlotsForDateWithBookingsResult> {
  try {
    const slots = await getSlotsForDateWithBookings(date);
    return { success: true, slots };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load slots.";
    return { success: false, message };
  }
}
