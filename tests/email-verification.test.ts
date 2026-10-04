import { describe, it, expect, afterEach, vi } from "vitest";

process.env.TRIUMPH_TRACKING_SECRET = "test-secret-do-not-use-in-production";

import {
  generateEmailVerificationCode,
  verifyEmailVerificationCode,
} from "@/lib/services/triumph-email-verification";

// The OTP gate standing between a tracking cookie and downloading a
// client's finished masters. Note: these tests cover CORRECTNESS of the
// derivation only. They do NOT cover brute-force resistance, because there
// is none yet — see audit finding V-2; the keyspace is 10^6 with unlimited
// attempts until rate limiting lands.
const PROJECT_A = "11111111-1111-4111-8111-111111111111";
const PROJECT_B = "22222222-2222-4222-8222-222222222222";

describe("triumph email verification code", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("generates a 6-digit numeric code", () => {
    expect(generateEmailVerificationCode(PROJECT_A)).toMatch(/^\d{6}$/);
  });

  it("accepts the code it just generated", () => {
    const code = generateEmailVerificationCode(PROJECT_A);
    expect(verifyEmailVerificationCode(PROJECT_A, code)).toBe(true);
  });

  it("is deterministic within the same time window", () => {
    expect(generateEmailVerificationCode(PROJECT_A)).toBe(generateEmailVerificationCode(PROJECT_A));
  });

  it("derives a different code per project", () => {
    // If two projects shared a code, one client could verify as another.
    expect(generateEmailVerificationCode(PROJECT_A)).not.toBe(
      generateEmailVerificationCode(PROJECT_B),
    );
  });

  it("rejects another project's current code", () => {
    const codeForB = generateEmailVerificationCode(PROJECT_B);
    expect(verifyEmailVerificationCode(PROJECT_A, codeForB)).toBe(false);
  });

  describe("input shape", () => {
    const rejected = ["", "12345", "1234567", "abcdef", "12 34 56", "12345a"];

    for (const input of rejected) {
      it(`rejects malformed input: "${input}"`, () => {
        expect(verifyEmailVerificationCode(PROJECT_A, input)).toBe(false);
      });
    }

    it("tolerates surrounding whitespace (users paste from email)", () => {
      const code = generateEmailVerificationCode(PROJECT_A);
      expect(verifyEmailVerificationCode(PROJECT_A, `  ${code}  `)).toBe(true);
    });
  });

  describe("time window", () => {
    // The window is a FIXED bucket — floor(epoch / 600s) — not a rolling
    // 10 minutes from generation. So these tests must pin the clock to a
    // known bucket boundary BEFORE generating, otherwise the result depends
    // on where in the real wall-clock bucket the suite happens to run.
    // (Learned the hard way: an earlier version of this test passed at
    // 12:54 and failed at 12:59.)
    const WINDOW_MS = 10 * 60 * 1000;
    // An exact multiple of WINDOW_MS, so this instant is a bucket start.
    const BUCKET_START = 1_800_000_000_000 - (1_800_000_000_000 % WINDOW_MS);

    function generateAt(offsetMs: number): string {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(BUCKET_START + offsetMs));
      return generateEmailVerificationCode(PROJECT_A);
    }

    it("accepts a code generated in the immediately previous bucket (grace step)", () => {
      const code = generateAt(0);
      // Move into the very next bucket — one grace step back still covers it.
      vi.setSystemTime(new Date(BUCKET_START + WINDOW_MS + 1000));
      expect(verifyEmailVerificationCode(PROJECT_A, code)).toBe(true);
    });

    it("accepts a code still inside its own bucket", () => {
      const code = generateAt(0);
      vi.setSystemTime(new Date(BUCKET_START + WINDOW_MS - 1000));
      expect(verifyEmailVerificationCode(PROJECT_A, code)).toBe(true);
    });

    it("rejects a code two buckets old (past the grace step)", () => {
      const code = generateAt(0);
      vi.setSystemTime(new Date(BUCKET_START + 2 * WINDOW_MS + 1000));
      expect(verifyEmailVerificationCode(PROJECT_A, code)).toBe(false);
    });

    it("rejects a long-expired code", () => {
      const code = generateAt(0);
      vi.setSystemTime(new Date(BUCKET_START + 45 * 60 * 1000));
      expect(verifyEmailVerificationCode(PROJECT_A, code)).toBe(false);
    });
  });
});
