"use server";

// Server Actions backing the email-verification gate on
// /triumph/track/[code] (components/triumph/email-verification-gate.tsx).
// Both require an already-valid tracking cookie (the client must have
// already passed the code+email lookup) — this is an additional proof
// layered on top of that, not a replacement for it.

import { cookies } from "next/headers";

import {
  trackingCookieName,
  verifiedCookieName,
  signTrackingCookie,
  verifyTrackingCookie,
  TRACKING_COOKIE_MAX_AGE_SECONDS,
} from "@/lib/services/triumph-tracking-cookie";
import {
  generateEmailVerificationCode,
  verifyEmailVerificationCode,
} from "@/lib/services/triumph-email-verification";
import { getTriumphProjectById } from "@/lib/repositories/triumph-projects-repository";
import { sendDownloadVerificationCodeEmail } from "@/lib/services/email-service";

async function resolveTrackedProject(projectCode: string) {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(trackingCookieName(projectCode))?.value;
  const projectId = verifyTrackingCookie(cookieValue);

  if (!projectId) {
    return null;
  }

  const project = await getTriumphProjectById(projectId);

  if (!project || project.project_code !== projectCode) {
    return null;
  }

  return project;
}

export type RequestDownloadVerificationResult = { success: true } | { success: false; message: string };

export async function requestDownloadVerificationCodeAction(
  projectCode: string,
): Promise<RequestDownloadVerificationResult> {
  const project = await resolveTrackedProject(projectCode);

  if (!project) {
    return { success: false, message: "Your session has expired. Please look up your project again." };
  }

  const code = generateEmailVerificationCode(project.id);

  const result = await sendDownloadVerificationCodeEmail({
    clientEmail: project.email,
    fullName: project.full_name,
    projectCode: project.project_code,
    code,
  });

  if (!result.success) {
    console.warn(
      `requestDownloadVerificationCodeAction: failed to send code for ${project.project_code}: ${result.message}`,
    );
    return { success: false, message: "Could not send a verification code. Please try again." };
  }

  return { success: true };
}

export type ConfirmDownloadVerificationResult = { success: true } | { success: false; message: string };

export async function confirmDownloadVerificationCodeAction(
  projectCode: string,
  code: string,
): Promise<ConfirmDownloadVerificationResult> {
  const project = await resolveTrackedProject(projectCode);

  if (!project) {
    return { success: false, message: "Your session has expired. Please look up your project again." };
  }

  if (!verifyEmailVerificationCode(project.id, code)) {
    return { success: false, message: "That code is incorrect or has expired. Please try again." };
  }

  const cookieStore = await cookies();
  cookieStore.set(verifiedCookieName(project.project_code), signTrackingCookie(project.id), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/triumph/track",
    maxAge: TRACKING_COOKIE_MAX_AGE_SECONDS,
  });

  return { success: true };
}
