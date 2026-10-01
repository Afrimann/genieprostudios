"use server";

// "Find Your Project" — the public, passwordless lookup for Triumph Music
// Global clients (Project Code + email, no account). Separate file from
// triumph-actions.ts (intake) the same way support-actions.ts is split by
// audience from the main booking actions — this is a different caller
// (an existing project's client, not a fresh visitor).

import { cookies } from "next/headers";

import { triumphProjectLookupSchema } from "@/lib/validation/triumph-project";
import { findTriumphProjectByCodeAndEmail } from "@/lib/repositories/triumph-projects-repository";
import {
  signTrackingCookie,
  trackingCookieName,
  TRACKING_COOKIE_MAX_AGE_SECONDS,
} from "@/lib/services/triumph-tracking-cookie";

export type LookupTriumphProjectResult =
  | { success: true; projectCode: string }
  | { success: false; message: string };

// One generic message regardless of which field was wrong — there is no
// rate-limiting infrastructure anywhere in this codebase yet, so this is
// the only enumeration defense available right now (see 0023's comments).
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
