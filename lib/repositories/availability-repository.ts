import { createClient } from "@/lib/supabase/server";
import type { Booking } from "@/lib/services/booking-service";

// Mirrors public.availability_slots (see supabase/migrations/0003_availability_slots.sql).
export type AvailabilityStatus = "open" | "booked" | "closed";

export type AvailabilitySlot = {
  id: string;
  date: string; // ISO date (YYYY-MM-DD)
  start_time: string; // HH:MM:SS
  end_time: string; // HH:MM:SS
  status: AvailabilityStatus;
  created_by: string | null;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Customer-facing reads. Rely entirely on the existing RLS policy
// "availability_slots_select_open_public" (0010), which already restricts
// anon/authenticated SELECT to status = 'open' rows — the explicit
// .eq("status", "open") filters below are defense-in-depth/clarity, not the
// actual security boundary.
// ---------------------------------------------------------------------------

/**
 * Returns the distinct dates within [startDate, endDate] (inclusive, ISO
 * "YYYY-MM-DD") that have at least one open slot. Intended for
 * calendar-disabling logic on the customer-facing date picker: only dates
 * returned here should be selectable, everything else greyed out.
 */
export async function getOpenDatesInRange(
  startDate: string,
  endDate: string,
): Promise<string[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("availability_slots")
    .select("date")
    .eq("status", "open")
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });

  if (error) {
    throw new Error(`getOpenDatesInRange: ${error.message}`);
  }

  const distinctDates = Array.from(new Set((data ?? []).map((row) => row.date)));
  return distinctDates;
}

/**
 * Returns all open slots for a single date (ISO "YYYY-MM-DD"), ordered by
 * start_time — the list a customer picks a time slot from once they've
 * selected a date.
 */
export async function getOpenSlotsForDate(date: string): Promise<AvailabilitySlot[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("availability_slots")
    .select("*")
    .eq("status", "open")
    .eq("date", date)
    .order("start_time", { ascending: true });

  if (error) {
    throw new Error(`getOpenSlotsForDate: ${error.message}`);
  }

  return data ?? [];
}

// ---------------------------------------------------------------------------
// Admin-side reads/writes. Rely entirely on the existing admin RLS policies
// (availability_slots_select_admin / _insert_admin / _update_admin, 0010),
// which gate on public.is_admin() — NOT on the book_slot_and_create_booking
// RPC. This repository must only ever be called from admin-authenticated
// contexts; it does not itself re-check admin status (that's what the DB
// policies are for — dumb data access, no business rules in the repository
// layer per project-notes.md).
// ---------------------------------------------------------------------------

/**
 * Returns ALL slots (open/booked/closed) for a given date, ordered by
 * start_time. Needed by the admin UI so the owner can see everything
 * already on the calendar for that day, not just what's still open —
 * e.g. to avoid re-opening a time that's already booked or closed.
 */
export async function getSlotsForDate(date: string): Promise<AvailabilitySlot[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("availability_slots")
    .select("*")
    .eq("date", date)
    .order("start_time", { ascending: true });

  if (error) {
    throw new Error(`getSlotsForDate: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Targeted single-window read by id — needed by
 * lib/services/availability-service.ts's getValidStartTimesForWindow, which
 * only needs one window's own bounds and shouldn't have to know the window's
 * date ahead of time just to look it up (getSlotsForDate requires a date).
 * Returns null if the window doesn't exist, rather than throwing, so callers
 * can distinguish "not found" from a genuine query failure.
 *
 * Relies on RLS: an admin caller sees any window (availability_slots_
 * select_admin), a customer-authenticated/anon caller only sees it if it's
 * currently 'open' (availability_slots_select_open_public, 0010) — same
 * reliance as every other read in this file.
 */
export async function getSlotById(slotId: string): Promise<AvailabilitySlot | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("availability_slots")
    .select("*")
    .eq("id", slotId)
    .maybeSingle();

  if (error) {
    throw new Error(`getSlotById: ${error.message}`);
  }

  return data ?? null;
}

export type CreateSlotInput = {
  date: string; // ISO "YYYY-MM-DD"
  startTime: string; // "HH:MM" or "HH:MM:SS"
  endTime: string; // "HH:MM" or "HH:MM:SS"
};

/**
 * Inserts a new availability slot with status='open'. Pure data access —
 * does NOT enforce the 30-minute buffer rule; that validation belongs in
 * lib/services/availability-service.ts (createSlotWithBufferCheck), which
 * calls this function only after the buffer check passes. Relies on the
 * admin RLS insert policy + the (date, start_time) unique constraint for
 * DB-level guarantees.
 */
export async function createSlot(input: CreateSlotInput): Promise<AvailabilitySlot> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("availability_slots")
    .insert({
      date: input.date,
      start_time: input.startTime,
      end_time: input.endTime,
      status: "open",
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`createSlot: ${error.message}`);
  }

  return data;
}

/**
 * Closes a slot (status -> 'closed'). Only valid as a transition from
 * 'open' — the WHERE clause guards against closing a 'booked' slot via
 * this path (a booked slot represents real studio time already committed
 * to a customer; withdrawing it here would silently orphan that booking's
 * link to an availability row without cancelling the booking itself, which
 * is a business decision this repository must not make unilaterally).
 *
 * Returns the updated row, or null if no row matched (already
 * booked/closed, or doesn't exist) so the caller can distinguish "closed
 * successfully" from "nothing happened".
 */
export async function closeSlot(slotId: string): Promise<AvailabilitySlot | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("availability_slots")
    .update({ status: "closed" })
    .eq("id", slotId)
    .eq("status", "open")
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`closeSlot: ${error.message}`);
  }

  return data ?? null;
}

// ---------------------------------------------------------------------------
// Booking windows (0014): a window ("slot") can now back multiple
// non-overlapping bookings, so both admin and service-layer callers need to
// read the bookings already carved from a given window.
// ---------------------------------------------------------------------------

export type SlotBookingRow = Pick<
  Booking,
  "id" | "session_start_time" | "session_end_time" | "status" | "created_at"
>;

/**
 * Returns the bookings already carved from a single window (any status —
 * callers that only care about "still occupies time" must filter out
 * cancelled/auto_cancelled themselves, same convention as getSlotsForDate
 * returning all statuses for the admin view).
 *
 * Relies on RLS: bookings_select_admin (admin, all rows) and
 * bookings_select_own (customer, only their own bookings) both gate on
 * public.is_admin()/customer_id = auth.uid() respectively (0010) — this
 * repository adds no extra filtering beyond slot_id, matching the
 * established "dumb data access" convention in this file.
 *
 * Pure data access — the overlap/grid computation that consumes this belongs
 * in lib/services/availability-service.ts, not here.
 */
export async function getBookingsForSlot(slotId: string): Promise<SlotBookingRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("bookings")
    .select("id, session_start_time, session_end_time, status, created_at")
    .eq("slot_id", slotId)
    .order("session_start_time", { ascending: true });

  if (error) {
    throw new Error(`getBookingsForSlot: ${error.message}`);
  }

  return data ?? [];
}

export type SlotWithBookings = AvailabilitySlot & {
  bookings: SlotBookingRow[];
};

/**
 * Admin-only: all slots (any status) for a given date, each with its own
 * bookings nested underneath (ordered by session_start_time), so the admin
 * availability UI can render "window -> its bookings" without a client-side
 * join.
 *
 * Implementation: reuses getSlotsForDate for the window list, then issues
 * one additional query for every booking whose slot_id is one of those
 * windows' ids (a single `in (...)` query, not N+1), and assembles the
 * nested shape here. This read-shaping is simple enough (no business rules,
 * just grouping rows that are already fully authorized by RLS) to keep in
 * the repository per this file's existing convention — if it ever grows
 * business logic (e.g. filtering/deriving availability from the nested
 * bookings), that belongs in availability-service.ts instead, not here.
 *
 * Relies entirely on the existing admin RLS policies (availability_slots_
 * select_admin, bookings_select_admin, both gating on public.is_admin(),
 * 0010) — same as every other admin read in this file. Do not call this from
 * a non-admin-authenticated context.
 */
export async function getSlotsForDateWithBookings(date: string): Promise<SlotWithBookings[]> {
  const slots = await getSlotsForDate(date);

  if (slots.length === 0) {
    return [];
  }

  const supabase = await createClient();
  const slotIds = slots.map((slot) => slot.id);

  const { data, error } = await supabase
    .from("bookings")
    .select("id, slot_id, session_start_time, session_end_time, status, created_at")
    .in("slot_id", slotIds)
    .order("session_start_time", { ascending: true });

  if (error) {
    throw new Error(`getSlotsForDateWithBookings: ${error.message}`);
  }

  const bookingsBySlotId = new Map<string, SlotBookingRow[]>();
  for (const booking of data ?? []) {
    const existing = bookingsBySlotId.get(booking.slot_id);
    const row: SlotBookingRow = {
      id: booking.id,
      session_start_time: booking.session_start_time,
      session_end_time: booking.session_end_time,
      status: booking.status,
      created_at: booking.created_at,
    };

    if (existing) {
      existing.push(row);
    } else {
      bookingsBySlotId.set(booking.slot_id, [row]);
    }
  }

  return slots.map((slot) => ({
    ...slot,
    bookings: bookingsBySlotId.get(slot.id) ?? [],
  }));
}
