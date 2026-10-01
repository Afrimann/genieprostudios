"use server";

// Server Action boundary for the Triumph engineer posting a project update
// (status change and/or note and/or deliverable — all one primitive, see
// create_triumph_project_update in 0023_triumph_projects.sql). Only ever
// called from behind /triumph-admin/(protected), same trust assumption as
// every other admin Server Action in this codebase.

import { triumphProjectUpdateSchema } from "@/lib/validation/triumph-update";
import { TRIUMPH_PROJECT_STATUS_LABELS } from "@/lib/validation/triumph-update";
import { triumphPaymentStatusUpdateSchema } from "@/lib/validation/triumph-payment";
import {
  getTriumphProjectForAdmin,
  postTriumphProjectUpdate,
  updateTriumphProjectPaymentStatus,
} from "@/lib/repositories/triumph-admin-repository";
import { sendClientProjectUpdateEmail } from "@/lib/services/email-service";
import { SITE_URL } from "@/lib/utils/site-url";

export type PostTriumphProjectUpdateResult = { success: true } | { success: false; message: string };

// Translates create_triumph_project_update's raised exceptions (0023/0026)
// into a message the admin can act on — same pattern as
// support-service.ts's translateTicketError, matching on the RPC's own
// error text rather than a generic fallback for every failure.
function translatePostUpdateError(err: unknown): string {
  const text = err instanceof Error ? err.message : "";

  if (text.includes("completed_requires_deliverable")) {
    return "This project can't be marked Completed until a deliverable has been sent — attach a file with this update, or send one first.";
  }

  return "Something went wrong. Please try again.";
}

export async function postTriumphProjectUpdateAction(input: unknown): Promise<PostTriumphProjectUpdateResult> {
  const parsed = triumphProjectUpdateSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: "Please check the update for errors and try again." };
  }

  const { projectId, body, statusAfter, filePath, fileName } = parsed.data;

  let project;
  try {
    project = await getTriumphProjectForAdmin(projectId);
  } catch (err) {
    console.error("postTriumphProjectUpdateAction: failed to load project", err);
    return { success: false, message: "Something went wrong. Please try again." };
  }

  if (!project) {
    return { success: false, message: "This project could not be found." };
  }

  const statusActuallyChanged = statusAfter !== null && statusAfter !== project.status;

  try {
    await postTriumphProjectUpdate({ projectId, body, statusAfter, filePath, fileName });
  } catch (err) {
    console.error(`postTriumphProjectUpdateAction: failed to post update for ${projectId}`, err);
    return { success: false, message: translatePostUpdateError(err) };
  }

  // Best-effort, only when the update actually changes the status (never
  // for a status-less note) — mirrors email-service.ts's discipline
  // elsewhere: a failed send never changes the result already returned.
  if (statusActuallyChanged && statusAfter) {
    const emailResult = await sendClientProjectUpdateEmail({
      clientEmail: project.email,
      fullName: project.full_name,
      projectCode: project.project_code,
      statusLabel: TRIUMPH_PROJECT_STATUS_LABELS[statusAfter],
      body,
      siteUrl: SITE_URL,
    });

    if (!emailResult.success) {
      console.warn(
        `postTriumphProjectUpdateAction: client update email failed for ${project.project_code}: ${emailResult.message}`,
      );
    }
  }

  return { success: true };
}

export type UpdateTriumphPaymentStatusResult = { success: true } | { success: false; message: string };

/**
 * Standalone admin toggle, independent of postTriumphProjectUpdateAction
 * above — a payment status change is not a timeline note, no email is
 * sent for it (the client doesn't need a notification every time the admin
 * flips an internal bookkeeping flag).
 */
export async function updateTriumphProjectPaymentStatusAction(
  input: unknown,
): Promise<UpdateTriumphPaymentStatusResult> {
  const parsed = triumphPaymentStatusUpdateSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: "Invalid payment status." };
  }

  try {
    await updateTriumphProjectPaymentStatus(parsed.data.projectId, parsed.data.paymentStatus);
  } catch (err) {
    console.error("updateTriumphProjectPaymentStatusAction: failed to update payment status", err);
    return { success: false, message: "Something went wrong. Please try again." };
  }

  return { success: true };
}
