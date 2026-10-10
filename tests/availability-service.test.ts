import { describe, it, expect } from "vitest";

import {
  checkSlotBuffer,
  computeValidStartTimes,
  SLOT_BUFFER_MINUTES,
} from "@/lib/services/availability-service";
import type { DateRangeBookingRow } from "@/lib/repositories/availability-repository";

// Regression coverage for the critical QA finding: computeValidStartTimes'
// advisory overlap check must consider bookings/blocks from the PREVIOUS
// calendar day (not just the target day and the next day), to stay
// consistent with book_session's own overlap check (0037_book_session.sql),
// which queries `session_date between p_date - 1 and v_end_date`. Without
// this, the advisory check could offer an early-morning start time that the
// RPC would then correctly reject — a confusing failed-booking UX for a slot
// the UI claimed was free.

function makeBooking(overrides: Partial<DateRangeBookingRow>): DateRangeBookingRow {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    session_date: null,
    session_start_time: null,
    session_end_date: null,
    session_end_time: null,
    status: "paid_in_full",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("computeValidStartTimes — previous-day overnight booking", () => {
  it("excludes an early-morning target-date start time blocked by a booking that started the day before and runs past midnight", () => {
    // Booking on 2026-10-09 22:00 for 4 hours -> ends 2026-10-10 02:00.
    const previousDayOvernightBooking = makeBooking({
      session_date: "2026-10-09",
      session_start_time: "22:00:00",
      session_end_date: "2026-10-10",
      session_end_time: "02:00:00",
    });

    const options = computeValidStartTimes(
      "2026-10-10",
      1, // 1-hour service
      [],
      [previousDayOvernightBooking],
    );

    // 02:00 ends at 02:30 + buffer would still collide; well-clear of the
    // booking's padded end (02:00 + 30min buffer = 02:30), so 01:00 must be
    // excluded (01:00-02:00 overlaps 21:30-02:30 padded range).
    const startTimes = options.map((o) => o.startTime);
    expect(startTimes).not.toContain("01:00:00");
    expect(startTimes).not.toContain("00:30:00");
    expect(startTimes).not.toContain("00:00:00");

    // 03:00 is clear of the booking's padded end (02:30) and should be offered.
    expect(startTimes).toContain("03:00:00");
  });

  it("does not exclude target-date start times when the previous day's booking ends well before midnight (no bleed-through)", () => {
    const previousDayDaytimeBooking = makeBooking({
      session_date: "2026-10-09",
      session_start_time: "10:00:00",
      session_end_date: "2026-10-09",
      session_end_time: "14:00:00",
    });

    const options = computeValidStartTimes(
      "2026-10-10",
      1,
      [],
      [previousDayDaytimeBooking],
    );

    const startTimes = options.map((o) => o.startTime);
    expect(startTimes).toContain("00:00:00");
    expect(startTimes).toContain("01:00:00");
  });

  it("still respects the buffer around a previous-day overnight booking's padded end time", () => {
    // Ends 2026-10-10 02:00; buffer is SLOT_BUFFER_MINUTES either side.
    const booking = makeBooking({
      session_date: "2026-10-09",
      session_start_time: "22:00:00",
      session_end_date: "2026-10-10",
      session_end_time: "02:00:00",
    });

    const options = computeValidStartTimes("2026-10-10", 1, [], [booking]);
    const startTimes = options.map((o) => o.startTime);

    // 02:00 start would begin exactly at the padded boundary (02:00 + 30 =
    // 02:30), and a 1hr session starting at 02:00 ends 03:00, overlapping
    // the padded end at 02:30 -> must be excluded.
    expect(startTimes).not.toContain("02:00:00");
    // 02:30 start ends 03:30, clear of the 02:30 padded boundary -> allowed.
    expect(startTimes).toContain("02:30:00");
  });

  it("ignores a cancelled previous-day overnight booking", () => {
    const cancelledBooking = makeBooking({
      session_date: "2026-10-09",
      session_start_time: "22:00:00",
      session_end_date: "2026-10-10",
      session_end_time: "02:00:00",
      status: "cancelled",
    });

    const options = computeValidStartTimes(
      "2026-10-10",
      1,
      [],
      [cancelledBooking],
    );

    const startTimes = options.map((o) => o.startTime);
    expect(startTimes).toContain("00:00:00");
    expect(startTimes).toContain("01:00:00");
  });

  it("does NOT widen the blocked_time_ranges check to the previous day (matches book_session's bt.date in (p_date, v_end_date))", () => {
    // A block sitting only on the previous day should have no effect on the
    // target date's candidates — book_session's own blocked_time_ranges
    // check never looks at p_date - 1 either.
    const previousDayBlock = {
      date: "2026-10-09",
      start_time: "22:00:00",
      end_time: "23:59:00",
      reason: "closed",
    };

    const options = computeValidStartTimes(
      "2026-10-10",
      1,
      [previousDayBlock],
      [],
    );

    const startTimes = options.map((o) => o.startTime);
    expect(startTimes).toContain("00:00:00");
  });
});

describe("checkSlotBuffer — unaffected by previous-day widening (blocks only, documented behavior)", () => {
  it("still flags an overlap against a same-day block", () => {
    const result = checkSlotBuffer(
      [{ date: "2026-10-10", start_time: "10:00:00", end_time: "12:00:00", reason: null }],
      { date: "2026-10-10", startTime: "11:00:00", endTime: "13:00:00" },
    );

    expect(result.ok).toBe(false);
  });

  it("allows a proposal that clears the buffer entirely", () => {
    // Block ends 12:00; buffer is SLOT_BUFFER_MINUTES (30min), so the
    // earliest clear start is 12:30. 13:00 is comfortably clear.
    const result = checkSlotBuffer(
      [{ date: "2026-10-10", start_time: "10:00:00", end_time: "12:00:00", reason: null }],
      { date: "2026-10-10", startTime: "13:00:00", endTime: "15:00:00" },
    );

    expect(result.ok).toBe(true);
    expect(SLOT_BUFFER_MINUTES).toBeLessThanOrEqual(60);
  });
});
