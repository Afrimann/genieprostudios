import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

// Hand-rolled signed-cookie primitive for the public Triumph project
// tracking flow (/triumph/track/[code]) — there is no Supabase session on
// that path at all (no account/password, by design), so none of the
// existing auth plumbing applies, and this codebase has no session/JWT
// library beyond @supabase/ssr, which doesn't cover this case either. A
// small HMAC-signed payload is the simplest correct option here.
//
// The payload carries the project's UUID (the actual trust anchor) and an
// expiry — never the email, which must never be stored in a way a client
// could read back out of their own cookie.

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days
export const TRACKING_COOKIE_MAX_AGE_SECONDS = COOKIE_MAX_AGE_SECONDS;

function getSecret(): string {
  const secret = process.env.TRIUMPH_TRACKING_SECRET;
  if (!secret) {
    // Missing config is our bug, not a client error — same distinction
    // app/api/cron/daily-sweep/route.ts draws for a missing CRON_SECRET.
    throw new Error("triumph-tracking-cookie: TRIUMPH_TRACKING_SECRET is not configured");
  }
  return secret;
}

function base64url(input: string): string {
  return Buffer.from(input, "utf-8").toString("base64url");
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

type TrackingPayload = { pid: string; exp: number };

export function signTrackingCookie(projectId: string): string {
  const payload: TrackingPayload = {
    pid: projectId,
    exp: Math.floor(Date.now() / 1000) + COOKIE_MAX_AGE_SECONDS,
  };
  const encodedPayload = base64url(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

/**
 * Verifies signature + expiry, returning the project id on success or null
 * on any failure (bad signature, expired, malformed) — never throws for a
 * bad cookie, since an invalid/missing cookie just means "show the lookup
 * form again," not an error.
 */
export function verifyTrackingCookie(cookieValue: string | undefined | null): string | null {
  if (!cookieValue) return null;

  const parts = cookieValue.split(".");
  if (parts.length !== 2) return null;
  const [encodedPayload, signature] = parts;

  const expected = Buffer.from(sign(encodedPayload));
  const actual = Buffer.from(signature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null;
  }

  let payload: TrackingPayload;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf-8"));
  } catch {
    return null;
  }

  if (typeof payload.pid !== "string" || typeof payload.exp !== "number") return null;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;

  return payload.pid;
}

// Centralized cookie-name helpers — two independent grants share the same
// signed-token shape (sign/verifyTrackingCookie above), distinguished only
// by which cookie name they're stored under: the base "tracking" cookie
// (code+email lookup passed) vs. the "verified" cookie (also proved they
// currently control the inbox — see triumph-email-verification.ts). A
// verified cookie is always a superset requirement on top of a valid
// tracking cookie, never a replacement for one.
export function trackingCookieName(projectCode: string): string {
  return `tmg_track_${projectCode}`;
}

export function verifiedCookieName(projectCode: string): string {
  return `tmg_verified_${projectCode}`;
}
