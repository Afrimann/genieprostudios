"use server";

// Server Action boundary between admin Client Components and the
// availability service/repository layer (both of which use
// createClient() from lib/supabase/server.ts and therefore can only run
// server-side). Mirrors the pattern in lib/services/auth-service.ts:
// validate input server-side, never throw for expected failures, always
// return a typed result the UI can branch on directly.

import {
  getBlocksForDate,
  getBlocksAndBookingsForDate,
  deleteBlock as deleteBlockRepo,
  type BlockedTimeRange,
  type DateWithBlocksAndBookings,
} from "@/lib/repositories/availability-repository";
import {
  createBlockWithOverlapCheck,
  getValidStartTimesForDate,
  type CreateBlockWithOverlapCheckResult,
  type GetValidStartTimesResult,
} from "@/lib/services/availability-service";
import { createBlockSchema } from "@/lib/validation/availability";

export type GetBlocksForDateResult =
  | { success: true; blocks: BlockedTimeRange[] }
  | { success: false; message: string };

/** Admin-only: every block for a given date. */
export async function fetchBlocksForDate(date: string): Promise<GetBlocksForDateResult> {
  try {
    const blocks = await getBlocksForDate(date);
    return { success: true, blocks };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load blocks.";
    return { success: false, message };
  }
}

/**
 * Validates + creates a new block, warning (via the "overlap_violation"
 * error) if it would collide with an existing, still-live booking. Never
 * calls createBlock()/the repository directly — createBlockWithOverlapCheck
 * is the only sanctioned path per lib/services/availability-service.ts.
 */
export async function addBlock(input: {
  date: string;
  startTime: string;
  endTime: string;
  reason?: string;
}): Promise<CreateBlockWithOverlapCheckResult> {
  const parsed = createBlockSchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      error: "unknown",
      message: parsed.error.issues[0]?.message ?? "Invalid block details",
    };
  }

  return createBlockWithOverlapCheck({
    date: parsed.data.date,
    startTime: parsed.data.startTime,
    endTime: parsed.data.endTime,
    reason: parsed.data.reason ?? null,
  });
}

export type DeleteBlockResult =
  | { success: true }
  | { success: false; message: string };

/** Admin-only: removes a block, immediately re-opening that time range. No-ops (returns failure) if it was already removed. */
export async function deleteBlockAction(blockId: string): Promise<DeleteBlockResult> {
  try {
    const removed = await deleteBlockRepo(blockId);

    if (!removed) {
      return {
        success: false,
        message: "This block could not be removed (it may already be gone).",
      };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to remove this block.";
    return { success: false, message };
  }
}

export type GetBlocksAndBookingsForDateResult =
  | { success: true; data: DateWithBlocksAndBookings }
  | { success: false; message: string };

/**
 * Admin-only: a date's blocks plus every booking overlapping that date.
 * Backs the admin availability UI's "blocks for this date" + "bookings
 * overlapping this date" display, replacing the old
 * fetchSlotsForDateWithBookings' nested window -> bookings shape.
 */
export async function fetchBlocksAndBookingsForDate(
  date: string,
): Promise<GetBlocksAndBookingsForDateResult> {
  try {
    const data = await getBlocksAndBookingsForDate(date);
    return { success: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load this date's availability.";
    return { success: false, message };
  }
}

/** Thin passthrough — getValidStartTimesForDate is already a
 * discriminated-union result, no extra shaping needed. Advisory only (see
 * lib/services/availability-service.ts) — the RPC called to actually book
 * independently re-validates bounds/grid/overlap server-side, so this is
 * purely what populates the UI's start-time buttons. */
export async function fetchValidStartTimesForDate(
  date: string,
  serviceId: string,
  excludeBookingId?: string,
): Promise<GetValidStartTimesResult> {
  return getValidStartTimesForDate(date, serviceId, excludeBookingId);
}
