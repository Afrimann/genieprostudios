"use server";

// "Find Your Project" — the public, passwordless lookup for Triumph Music
// Global clients (Project Code + email, no account). Separate file from
// triumph-actions.ts (intake) the same way support-actions.ts is split by
// audience from the main booking actions — this is a different caller
// (an existing project's client, not a fresh visitor).

import { cookies } from "next/headers";

import { redirect } from "next/navigation";

import { triumphProjectLookupSchema } from "@/lib/validation/triumph-project";
import { findTriumphProjectByCodeAndEmail } from "@/lib/repositories/triumph-projects-repository";
import {
  signTrackingCookie,
  trackingCookieName,
  verifiedCookieName,
  TRACKING_COOKIE_MAX_AGE_SECONDS,
} from "@/lib/services/triumph-tracking-cookie";
import { checkRateLimit, RATE_LIMITED_MESSAGE } from "@/lib/services/rate-limit";

export type LookupTriumphProjectResult =
  | { success: true; projectCode: string }
  | { success: false; message: string };

// One generic message regardless of which field was wrong, so a failed
// lookup never reveals whether the code or the email was the wrong half.
// Paired with the per-email throttle below (added 2026-10-03, audit finding
// V-2) — the generic message alone was previously the ONLY enumeration
// defense, which an unlimited-guess attacker could simply ignore.
const GENERIC_FAILURE_MESSAGE =
  "We couldn't find a project with that code and email. Please check and try again.";

export async function lookupTriumphProjectAction(input: unknown): Promise<LookupTriumphProjectResult> {
  const parsed = triumphProjectLookupSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: GENERIC_FAILURE_MESSAGE };
  }

  // Clients will type lowercase codes / mixed-case emails on phones.
  const projectCode = parsed.data.projectCode.trim().toUpperCase();
  const email = parsed.data.email.trim().toLowerCase();

  // Keyed on the email rather than the code: an attacker guessing codes
  // against one known email is the realistic attack, and keying on the code
  // would let them simply rotate codes to get a fresh budget each time.
  if (!(await checkRateLimit("projectLookup", email))) {
    return { success: false, message: RATE_LIMITED_MESSAGE };
  }

  const project = await findTriumphProjectByCodeAndEmail(projectCode, email);

  if (!project) {
    return { success: false, message: GENERIC_FAILURE_MESSAGE };
  }

  // Cookie name is scoped to this project's code so looking up a second
  // project in the same browser doesn't clobber the first one's access.
  const cookieStore = await cookies();
  cookieStore.set(trackingCookieName(project.project_code), signTrackingCookie(project.id), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/triumph/track",
    maxAge: TRACKING_COOKIE_MAX_AGE_SECONDS,
  });

  return { success: true, projectCode: project.project_code };
}

/**
 * Clears this project's tracking grant — the passwordless equivalent of
 * signing out (2026-10-04). Until this existed, a client who checked their
 * project on a shared or public machine left a 7-day signed cookie behind
 * with no way to clear it from the UI; the next person at that machine
 * could open /triumph/track/[code] and see the project, and (if the email
 * had also been verified) download the finished masters.
 *
 * Deletes BOTH grants, not just the tracking one. The verified cookie is
 * the stronger of the two — it's what unlocks downloads — so leaving it
 * behind while clearing the base cookie would be the worst outcome: the UI
 * would show the lookup form again, implying the session was cleared, while
 * the download grant quietly survived.
 *
 * `path` must match what the cookies were set with ("/triumph/track"),
 * or the delete silently targets a different cookie and no-ops.
 */
export async function exitTriumphProjectAction(projectCode: string): Promise<void> {
  const cookieStore = await cookies();
  const path = "/triumph/track";

  cookieStore.delete({ name: trackingCookieName(projectCode), path });
  cookieStore.delete({ name: verifiedCookieName(projectCode), path });

  // Back to the lookup form rather than the Triumph marketing page — a
  // client who just exited is most likely done, but if they exited by
  // mistake the way back in is right there.
  redirect("/triumph/track");
}
