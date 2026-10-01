import { cookies } from "next/headers";

import {
  verifyTrackingCookie,
  trackingCookieName,
  verifiedCookieName,
} from "@/lib/services/triumph-tracking-cookie";
import {
  getTriumphProjectById,
  getTriumphProjectUpdates,
} from "@/lib/repositories/triumph-projects-repository";

// JSON polling endpoint backing components/triumph/project-status-timeline.tsx's
// "approximate real-time" refresh — same cookie + code-match verification
// as the [code] page itself, since this is just that page's data fetch
// exposed for a background refetch rather than a full reload. Also reports
// `verified` so the client can flip from "verify to download" to real
// download links the moment the admin's separate email-verification cookie
// becomes valid, without the user needing to reload the page.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
): Promise<Response> {
  const { code } = await params;
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(trackingCookieName(code))?.value;
  const projectId = verifyTrackingCookie(cookieValue);

  if (!projectId) {
    return new Response(null, { status: 401 });
  }

  const project = await getTriumphProjectById(projectId);

  if (!project || project.project_code !== code) {
    return new Response(null, { status: 401 });
  }

  const verifiedCookieValue = cookieStore.get(verifiedCookieName(code))?.value;
  const verifiedProjectId = verifyTrackingCookie(verifiedCookieValue);

  const updates = await getTriumphProjectUpdates(project.id);

  return Response.json({
    status: project.status,
    paymentStatus: project.payment_status,
    verified: verifiedProjectId === project.id,
    updates: updates.map((u) => ({
      id: u.id,
      body: u.body,
      statusAfter: u.status_after,
      fileName: u.file_name,
      createdAt: u.created_at,
    })),
  });
}
