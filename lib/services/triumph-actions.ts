"use server";

// Server Action boundary for Triumph Music Global's "Start a Project" form.
// Persists a triumph_projects row and hands the client a project_code (the
// "Project ID" the client later uses on /triumph/track to check status) —
// see 0023_triumph_projects.sql. Persistence is now primary; email is
// best-effort on top. Re-validates with the same schema the client form
// already used — never trust client-side validation alone for a Server
// Action boundary.

import { triumphProjectRequestSchema } from "@/lib/validation/triumph-project";
import { TRIUMPH_PRICING_TIERS } from "@/lib/data/triumph-pricing";
import { createTriumphProject } from "@/lib/repositories/triumph-projects-repository";
import {
  sendOwnerNewProjectRequestEmail,
  sendClientProjectConfirmationEmail,
} from "@/lib/services/email-service";
import { SITE_URL } from "@/lib/utils/site-url";
import { checkRateLimit, RATE_LIMITED_MESSAGE } from "@/lib/services/rate-limit";

export type SubmitProjectRequestResult =
  | { success: true; projectCode: string }
  | { success: false; message: string };

export async function submitProjectRequestAction(input: unknown): Promise<SubmitProjectRequestResult> {
  const parsed = triumphProjectRequestSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: "Please check the form for errors and try again." };
  }

  const { fullName, email, country, phone, numberOfSongs, serviceId, projectDetails } = parsed.data;

  // Each submission writes a row and sends two emails — uncapped, this is a
  // spam/quota-burn primitive on a fully public form (audit finding V-2).
  if (!(await checkRateLimit("projectIntake", email.trim().toLowerCase()))) {
    return { success: false, message: RATE_LIMITED_MESSAGE };
  }

  const serviceLabel = TRIUMPH_PRICING_TIERS.find((tier) => tier.id === serviceId)?.name ?? serviceId;

  let projectCode: string;

  try {
    const project = await createTriumphProject({
      fullName,
      email,
      country,
      phone,
      numberOfSongs,
      serviceId,
      projectDetails,
    });
    projectCode = project.project_code;
  } catch (err) {
    // The DB insert is the primary outcome now (the client's only way back
    // into their project is the code it produces) — fail the whole action
    // rather than letting an email-only "success" promise a code that
    // doesn't exist anywhere.
    console.error("submitProjectRequestAction: failed to create triumph_projects row", err);
    return { success: false, message: "Something went wrong. Please try again." };
  }

  // Both emails are best-effort — neither failing changes the result
  // already returned above, since the project row (and its code) exists
  // either way.
  const ownerEmail = process.env.OWNER_NOTIFICATION_EMAIL;

  if (ownerEmail) {
    const ownerResult = await sendOwnerNewProjectRequestEmail({
      ownerEmail,
      fullName,
      email,
      country,
      phone,
      numberOfSongs,
      serviceLabel,
      projectDetails,
    });

    if (!ownerResult.success) {
      console.warn(`submitProjectRequestAction: owner email failed for ${projectCode}: ${ownerResult.message}`);
    }
  } else {
    console.warn("submitProjectRequestAction: OWNER_NOTIFICATION_EMAIL is not configured, skipping owner email");
  }

  const clientResult = await sendClientProjectConfirmationEmail({
    clientEmail: email,
    fullName,
    projectCode,
    serviceLabel,
    siteUrl: SITE_URL,
  });

  if (!clientResult.success) {
    console.warn(`submitProjectRequestAction: client confirmation email failed for ${projectCode}: ${clientResult.message}`);
  }

  return { success: true, projectCode };
}
