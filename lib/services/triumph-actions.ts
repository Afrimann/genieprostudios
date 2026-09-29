"use server";

// Server Action boundary for Triumph Music Global's "Start a Project" form.
// No DB table for v1 — this is email-only (best-effort owner notification),
// consistent with keeping scope minimal until the client wants a persisted
// request history (a natural follow-up mirroring support_tickets, not built
// now). Re-validates with the same schema the client form already used —
// never trust client-side validation alone for a Server Action boundary.

import { triumphProjectRequestSchema } from "@/lib/validation/triumph-project";
import { TRIUMPH_PRICING_TIERS } from "@/lib/data/triumph-pricing";
import { sendOwnerNewProjectRequestEmail } from "@/lib/services/email-service";

export type SubmitProjectRequestResult = { success: true } | { success: false; message: string };

export async function submitProjectRequestAction(input: unknown): Promise<SubmitProjectRequestResult> {
  const parsed = triumphProjectRequestSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: "Please check the form for errors and try again." };
  }

  const ownerEmail = process.env.OWNER_NOTIFICATION_EMAIL;

  if (!ownerEmail) {
    console.warn("submitProjectRequestAction: OWNER_NOTIFICATION_EMAIL is not configured, skipping email");
    return { success: false, message: "Something went wrong. Please try again later." };
  }

  const { fullName, email, country, phone, numberOfSongs, serviceId, projectDetails } = parsed.data;
  const serviceLabel = TRIUMPH_PRICING_TIERS.find((tier) => tier.id === serviceId)?.name ?? serviceId;

  const result = await sendOwnerNewProjectRequestEmail({
    ownerEmail,
    fullName,
    email,
    country,
    phone,
    numberOfSongs,
    serviceLabel,
    projectDetails,
  });

  if (!result.success) {
    return { success: false, message: "Something went wrong sending your request. Please try again." };
  }

  return { success: true };
}
