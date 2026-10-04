import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";

// The module throws at call time (not import time) if the secret is unset,
// so setting it before importing is enough — no module mocking needed.
process.env.TRIUMPH_TRACKING_SECRET = "test-secret-do-not-use-in-production";

import {
  signTrackingCookie,
  verifyTrackingCookie,
  trackingCookieName,
  verifiedCookieName,
} from "@/lib/services/triumph-tracking-cookie";

// This HMAC cookie is the ENTIRE access-control boundary for the
// passwordless Triumph tracking flow — there is no Supabase session on that
// path. A forgery here means reading another client's project and
// downloading their masters, so these are the highest-value tests in the
// suite.
const PROJECT_A = "11111111-1111-4111-8111-111111111111";
const PROJECT_B = "22222222-2222-4222-8222-222222222222";

describe("triumph tracking cookie", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("round-trip", () => {
    it("verifies a cookie it just signed", () => {
      expect(verifyTrackingCookie(signTrackingCookie(PROJECT_A))).toBe(PROJECT_A);
    });

    it("returns the correct project id, not just any id", () => {
      expect(verifyTrackingCookie(signTrackingCookie(PROJECT_B))).toBe(PROJECT_B);
    });

    it("does not put the project id in the cookie in plaintext-recoverable form without a valid signature", () => {
      // The payload IS base64url (not encrypted) by design — the signature
      // is what provides integrity. This asserts the documented property:
      // tampering with the payload invalidates the token.
      const token = signTrackingCookie(PROJECT_A);
      const [payload, signature] = token.split(".");
      const forgedPayload = Buffer.from(
        JSON.stringify({ pid: PROJECT_B, exp: Math.floor(Date.now() / 1000) + 3600 }),
        "utf-8",
      ).toString("base64url");

      expect(verifyTrackingCookie(`${forgedPayload}.${signature}`)).toBeNull();
    });
  });

  describe("rejects forged and malformed tokens", () => {
    const malformed = [
      ["empty string", ""],
      ["no separator", "abcdef"],
      ["too many segments", "a.b.c"],
      ["empty signature", "abc."],
      ["garbage", "!!!!.!!!!"],
    ] as const;

    for (const [label, input] of malformed) {
      it(`rejects ${label}`, () => {
        expect(verifyTrackingCookie(input)).toBeNull();
      });
    }

    it("rejects undefined and null", () => {
      expect(verifyTrackingCookie(undefined)).toBeNull();
      expect(verifyTrackingCookie(null)).toBeNull();
    });

    it("rejects a token signed with a different secret", () => {
      // Simulates an attacker who knows the payload format but not the key.
      const token = signTrackingCookie(PROJECT_A);
      const [payload] = token.split(".");
      const forged = `${payload}.${Buffer.from("wrong-signature").toString("base64url")}`;
      expect(verifyTrackingCookie(forged)).toBeNull();
    });

    it("rejects a tampered payload with the original signature", () => {
      const token = signTrackingCookie(PROJECT_A);
      const [, signature] = token.split(".");
      const tampered = Buffer.from(
        JSON.stringify({ pid: PROJECT_B, exp: 9_999_999_999 }),
        "utf-8",
      ).toString("base64url");
      expect(verifyTrackingCookie(`${tampered}.${signature}`)).toBeNull();
    });
  });

  describe("expiry", () => {
    it("rejects a token past its expiry", () => {
      const token = signTrackingCookie(PROJECT_A);
      // Cookie max age is 7 days; jump 8 days forward.
      vi.useFakeTimers();
      vi.setSystemTime(new Date(Date.now() + 8 * 24 * 60 * 60 * 1000));
      expect(verifyTrackingCookie(token)).toBeNull();
    });

    it("still accepts a token inside its window", () => {
      const token = signTrackingCookie(PROJECT_A);
      vi.useFakeTimers();
      vi.setSystemTime(new Date(Date.now() + 6 * 24 * 60 * 60 * 1000));
      expect(verifyTrackingCookie(token)).toBe(PROJECT_A);
    });
  });

  describe("cookie names are scoped per project", () => {
    it("derives distinct names per project code", () => {
      expect(trackingCookieName("TMG-AAAAAA")).not.toBe(trackingCookieName("TMG-BBBBBB"));
    });

    it("keeps the tracking and verified grants in separate cookies", () => {
      // A verified grant must never be mistakable for a tracking grant —
      // they share a token shape and are distinguished only by cookie name.
      expect(trackingCookieName("TMG-AAAAAA")).not.toBe(verifiedCookieName("TMG-AAAAAA"));
    });
  });
});
