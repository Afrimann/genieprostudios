import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

// Application-level rate limiting (2026-10-03 audit, findings V-2/V-5).
// Backed by consume_rate_limit() in 0030_rate_limits.sql — a single atomic
// statement, so concurrent requests cannot race past the limit.
//
// Uses the service-role client because the public Triumph tracking actions
// that most need throttling have no Supabase session at all. The RPC itself
// exposes nothing: it takes a key and returns a boolean.

export const RATE_LIMITS = {
  // The OTP guarding deliverable downloads. 5 tries per 15 min per project
  // reduces a 10^6 keyspace from "exhaustible in minutes" to "millennia",
  // while still leaving room for a client fat-fingering a code.
  otpConfirm: { limit: 5, windowSeconds: 15 * 60 },
  // Sending a code sends a real email — cap the client's inbox exposure.
  otpRequest: { limit: 3, windowSeconds: 15 * 60 },
  // Project code + email guesses.
  projectLookup: { limit: 10, windowSeconds: 15 * 60 },
  // Public intake form: one DB row + two emails per submission.
  projectIntake: { limit: 5, windowSeconds: 60 * 60 },
  // Team payment-confirmation PIN. Tighter than the OTP because a
  // legitimate admin knows this code and should never need 5 tries.
  paymentCode: { limit: 5, windowSeconds: 15 * 60 },
} as const;

export type RateLimitName = keyof typeof RATE_LIMITS;

/**
 * Records one attempt and reports whether the caller may proceed.
 *
 * FAILS OPEN on an infrastructure error (RPC unreachable, migration not yet
 * applied) — deliberately. These limits sit on top of an existing
 * authorization check in every case: the OTP already requires a valid
 * tracking cookie, the payment code already requires an admin session. A
 * database hiccup must degrade to "unthrottled but still authorized",
 * not "nobody can use the site". The failure is logged loudly so it
 * surfaces rather than silently disabling the protection forever.
 *
 * `scope` should be the narrowest stable identifier available — a project
 * id, not an IP, where one exists. IPs are shared (mobile carriers, office
 * NAT) and spoofable via X-Forwarded-For, so they'd both over-block real
 * users and under-block a determined attacker.
 */
export async function checkRateLimit(name: RateLimitName, scope: string): Promise<boolean> {
  const { limit, windowSeconds } = RATE_LIMITS[name];

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("consume_rate_limit", {
      p_key: `${name}:${scope}`,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });

    if (error) {
      console.error(`checkRateLimit: RPC failed for ${name} — failing open`, error.message);
      return true;
    }

    return data === true;
  } catch (err) {
    console.error(`checkRateLimit: unexpected error for ${name} — failing open`, err);
    return true;
  }
}

/** Shared copy for a throttled caller — deliberately vague about the limit itself. */
export const RATE_LIMITED_MESSAGE =
  "Too many attempts. Please wait a few minutes and try again.";
