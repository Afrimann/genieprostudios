import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

// Email-ownership verification gate for deliverable downloads on
// /triumph/track/[code] (2026-10-xx client request): the base code+email
// "Find Your Project" lookup only proves the visitor KNEW the email on
// file, not that they currently control that inbox. Before letting them
// download an actual file, we send a 6-digit code to that email and
// require it back.
//
// Stateless — no new DB table. The code is derived from an HMAC of the
// project id + a 10-minute time bucket, using the same secret as the
// tracking cookie (TRIUMPH_TRACKING_SECRET) — recomputable server-side on
// demand, nothing to store or expire/clean up. Same hand-rolled-HMAC
// approach as triumph-tracking-cookie.ts, since this codebase has no
// OTP/session library.

const CODE_WINDOW_MS = 10 * 60 * 1000;
// Also accept the previous window, so a code emailed right at a window
// boundary doesn't expire while the user is still typing it in —
// effectively ~10-20 minutes of validity.
const CODE_WINDOW_GRACE_STEPS = 1;

function getSecret(): string {
  const secret = process.env.TRIUMPH_TRACKING_SECRET;
  if (!secret) {
    throw new Error("triumph-email-verification: TRIUMPH_TRACKING_SECRET is not configured");
  }
  return secret;
}

// "verify:" prefix keeps this derivation distinct from any other value
// this codebase might ever derive from the same secret + project id pair.
function codeForWindow(projectId: string, window: number): string {
  const digest = createHmac("sha256", getSecret()).update(`verify:${projectId}:${window}`).digest();
  return (digest.readUInt32BE(0) % 1_000_000).toString().padStart(6, "0");
}

export function generateEmailVerificationCode(projectId: string): string {
  return codeForWindow(projectId, Math.floor(Date.now() / CODE_WINDOW_MS));
}

export function verifyEmailVerificationCode(projectId: string, submittedCode: string): boolean {
  const trimmed = submittedCode.trim();
  if (!/^\d{6}$/.test(trimmed)) return false;

  const currentWindow = Math.floor(Date.now() / CODE_WINDOW_MS);
  const submittedBuf = Buffer.from(trimmed);

  for (let step = 0; step <= CODE_WINDOW_GRACE_STEPS; step++) {
    const expectedBuf = Buffer.from(codeForWindow(projectId, currentWindow - step));
    if (expectedBuf.length === submittedBuf.length && timingSafeEqual(expectedBuf, submittedBuf)) {
      return true;
    }
  }

  return false;
}
