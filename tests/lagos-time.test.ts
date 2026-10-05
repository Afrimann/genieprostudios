import { describe, it, expect, afterEach, vi } from "vitest";

import {
  formatDuration,
  lagosDateOffset,
  lagosInstantIso,
  lagosToday,
  nextCalendarDay,
  toDisplayTime,
} from "@/lib/utils/lagos-time";

// The front desk board decides what is overdue, what is running over, and
// which day's sessions to show, entirely from these helpers. The bugs they
// exist to prevent are all timezone-boundary bugs that would only surface at
// specific times of day — i.e. exactly the kind nobody notices until a
// receptionist is standing there with a customer.
//
// The reference the SQL side must agree with is public.lagos_today() and
// public.session_start_at() (0032 / 0016).

describe("lagosToday", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the UTC date during most of the day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T12:00:00Z"));

    expect(lagosToday()).toBe("2026-10-05");
  });

  it("is already tomorrow in Lagos during the last hour of the UTC day", () => {
    // 23:30 UTC is 00:30 the next day in Lagos. This is the case that makes
    // a bare `new Date().toISOString().slice(0,10)` wrong, and it falls in
    // the middle of a studio evening rather than somewhere harmless.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T23:30:00Z"));

    expect(lagosToday()).toBe("2026-10-06");
  });

  it("is still the same Lagos day just before 23:00 UTC", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T22:59:00Z"));

    expect(lagosToday()).toBe("2026-10-05");
  });
});

describe("lagosDateOffset", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("steps back across a month boundary", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-01T09:00:00Z"));

    expect(lagosDateOffset(-1)).toBe("2026-10-31");
  });

  it("steps forward across a year boundary", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-12-31T09:00:00Z"));

    expect(lagosDateOffset(1)).toBe("2027-01-01");
  });

  it("steps back from a Lagos day that is ahead of the UTC day", () => {
    // 23:30 UTC on the 5th is the 6th in Lagos, so "yesterday" at the desk
    // is the 5th — not the 4th, which a UTC-based calculation would give.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-05T23:30:00Z"));

    expect(lagosDateOffset(-1)).toBe("2026-10-05");
  });
});

describe("lagosInstantIso", () => {
  it("interprets a naive date + time as Lagos wall-clock (UTC+1)", () => {
    expect(lagosInstantIso("2026-10-05", "14:00:00")).toBe("2026-10-05T13:00:00.000Z");
  });

  it("accepts HH:MM as well as HH:MM:SS", () => {
    expect(lagosInstantIso("2026-10-05", "14:00")).toBe("2026-10-05T13:00:00.000Z");
  });

  it("rolls back into the previous UTC day for an early-morning Lagos time", () => {
    expect(lagosInstantIso("2026-10-05", "00:30:00")).toBe("2026-10-04T23:30:00.000Z");
  });

  it("does not shift for daylight saving — Nigeria has none", () => {
    // Same wall-clock time in January and July must map to the same offset.
    expect(lagosInstantIso("2026-01-15", "14:00:00")).toBe("2026-01-15T13:00:00.000Z");
    expect(lagosInstantIso("2026-07-15", "14:00:00")).toBe("2026-07-15T13:00:00.000Z");
  });
});

describe("nextCalendarDay", () => {
  it("crosses a month boundary", () => {
    expect(nextCalendarDay("2026-10-31")).toBe("2026-11-01");
  });

  it("handles a leap day", () => {
    expect(nextCalendarDay("2028-02-28")).toBe("2028-02-29");
  });
});

describe("formatDuration", () => {
  it("shows minutes only under an hour", () => {
    expect(formatDuration(47 * 60_000)).toBe("47m");
  });

  it("zero-pads the minutes past an hour so the width stays stable", () => {
    expect(formatDuration(65 * 60_000)).toBe("1h 05m");
  });

  it("floors rather than rounds, so a timer never reads ahead of itself", () => {
    expect(formatDuration(59_999)).toBe("0m");
  });

  it("clamps negatives to zero", () => {
    // Callers only ever pass a difference they believe is positive; a
    // slightly-behind device clock should read "0m", not "-1m".
    expect(formatDuration(-5_000)).toBe("0m");
  });
});

describe("toDisplayTime", () => {
  it("drops seconds from a Postgres time value", () => {
    expect(toDisplayTime("14:00:00")).toBe("14:00");
  });
});
