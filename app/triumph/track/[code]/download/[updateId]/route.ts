import { cookies } from "next/headers";

import {
  verifyTrackingCookie,
  trackingCookieName,
  verifiedCookieName,
} from "@/lib/services/triumph-tracking-cookie";
import {
  getTriumphProjectById,
  getTriumphProjectUpdateById,
  createDeliverableSignedUrl,
} from "@/lib/repositories/triumph-projects-repository";

// Re-validates the base tracking cookie + code-match + update ownership,
// THEN also requires the separate email-verification cookie (set only
// after the client confirms a one-time code sent to their email — see
// lib/services/triumph-email-verification.ts) before minting a signed URL.
// Enforced here server-side regardless of what the UI shows/hides, same
// "never trust the client" discipline as every other download path —
// never exposes the storage bucket path or lets the client mint its own
// URL, same as getTrackDownloadUrl() in booking-tracks-repository.ts.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string; updateId: string }> },
): Promise<Response> {
  const { code, updateId } = await params;
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(trackingCookieName(code))?.value;
  const projectId = verifyTrackingCookie(cookieValue);

  if (!projectId) {
    return new Response("Not authorized", { status: 401 });
  }

  const project = await getTriumphProjectById(projectId);

  if (!project || project.project_code !== code) {
    return new Response("Not authorized", { status: 401 });
  }

  const verifiedCookieValue = cookieStore.get(verifiedCookieName(code))?.value;
  const verifiedProjectId = verifyTrackingCookie(verifiedCookieValue);

  if (verifiedProjectId !== project.id) {
    return new Response("Email verification required", { status: 403 });
  }

  const update = await getTriumphProjectUpdateById(updateId);

  if (!update || update.project_id !== project.id || !update.file_path) {
    return new Response("Not found", { status: 404 });
  }

  const signedUrl = await createDeliverableSignedUrl(update.file_path);

  return Response.redirect(signedUrl, 302);
}
