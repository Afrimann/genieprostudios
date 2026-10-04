"use server";

// Server Action boundary for the Triumph engineer posting a project update
// (status change and/or note and/or deliverable — all one primitive, see
// create_triumph_project_update in 0023_triumph_projects.sql). Only ever
// called from behind /triumph-admin/(protected), same trust assumption as
// every other admin Server Action in this codebase.

import { timingSafeEqual } from "crypto";

import { triumphProjectUpdateSchema } from "@/lib/validation/triumph-update";
import { TRIUMPH_PROJECT_STATUS_LABELS } from "@/lib/validation/triumph-update";
import { triumphPaymentStatusUpdateSchema, recordTriumphPaymentSchema } from "@/lib/validation/triumph-payment";
import {
  getTriumphProjectForAdmin,
  postTriumphProjectUpdate,
  updateTriumphProjectPaymentStatus,
  recordTriumphPayment,
  getTriumphReceiptDownloadUrl,
} from "@/lib/repositories/triumph-admin-repository";
import { sendClientProjectUpdateEmail } from "@/lib/services/email-service";
import { SITE_URL } from "@/lib/utils/site-url";
import { nairaToKobo } from "@/lib/utils/money";
import { checkRateLimit, RATE_LIMITED_MESSAGE } from "@/lib/services/rate-limit";

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

export type RecordTriumphPaymentResult = { success: true } | { success: false; message: string };

/**
 * The gated path for moving payment_status to deposit_paid or paid_in_full
 * (2026-10-03 client request) — unlike updateTriumphProjectPaymentStatusAction
 * above (still the only path back to 'pending'), this requires a team-known
 * confirmation code and records an amount/optional receipt as a real ledger
 * entry (0029_triumph_payments.sql), specifically so that having the admin
 * account logged in isn't enough on its own to mark money as received.
 *
 * The code is checked here, not in the DB — it's a UI-level team PIN, not a
 * per-user credential RLS could evaluate. crypto.timingSafeEqual (not ===)
 * for the same reason triumph-email-verification.ts uses it: a plain string
 * comparison leaks how many leading characters matched via response timing.
 * Equal-length padding keeps the comparison itself from throwing when
 * lengths differ, which would otherwise leak the correct code's length.
 */
function isCorrectConfirmationCode(submitted: string): boolean {
  const expected = process.env.TRIUMPH_PAYMENT_CONFIRMATION_CODE || "123456";
  const expectedBuf = Buffer.from(expected.padEnd(32, "\0"));
  const submittedBuf = Buffer.from(submitted.padEnd(32, "\0"));
  return timingSafeEqual(expectedBuf, submittedBuf) && submitted.length === expected.length;
}

export async function recordTriumphPaymentAction(input: unknown): Promise<RecordTriumphPaymentResult> {
  const parsed = recordTriumphPaymentSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: "Please check the payment details and try again." };
  }

  const { projectId, paymentStatus, amountNaira, confirmationCode, receiptPath, receiptName } = parsed.data;

  // Before the code check, so guesses burn budget whether right or wrong.
  // The PIN is short and shared; without this, "requires a confirmation
  // code" degrades to "requires a few thousand requests" (audit V-5).
  if (!(await checkRateLimit("paymentCode", projectId))) {
    return { success: false, message: RATE_LIMITED_MESSAGE };
  }

  if (!isCorrectConfirmationCode(confirmationCode)) {
    return { success: false, message: "Incorrect confirmation code." };
  }

  try {
    await recordTriumphPayment({
      projectId,
      paymentStatus,
      amountKobo: nairaToKobo(amountNaira),
      receiptPath,
      receiptName,
    });
  } catch (err) {
    console.error("recordTriumphPaymentAction: failed to record payment", err);
    return { success: false, message: "Something went wrong. Please try again." };
  }

  return { success: true };
}

export type GetTriumphReceiptDownloadUrlResult =
  | { success: true; url: string }
  | { success: false; message: string };

export async function getTriumphReceiptDownloadUrlAction(
  filePath: string,
): Promise<GetTriumphReceiptDownloadUrlResult> {
  try {
    const url = await getTriumphReceiptDownloadUrl(filePath);
    return { success: true, url };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate a download link.";
    return { success: false, message };
  }
}
