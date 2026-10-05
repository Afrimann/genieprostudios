"use server";

// Server Action boundary for /admin/staff. Unlike admin-booking-actions.ts
// and every other admin action in this codebase, these two mutate through
// the SERVICE ROLE client (createAdminClient()) rather than the RLS-scoped
// one — there is no other way to write profiles.is_frontdesk at all (it's
// REVOKEd from authenticated, see 0032_frontdesk_role.sql), and
// inviteUserByEmail() is an admin-only Supabase Auth API with no RLS
// equivalent. That means the usual "relies entirely on RLS, no redundant
// check here" convention this project uses elsewhere does NOT apply: a
// service-role client bypasses RLS completely, so if this file didn't check
// who's calling, ANY signed-in user could invite themselves front desk
// access by hitting this Server Action directly. requireAdmin() below is
// that check — the same reasoning 0033's frontdesk_* RPCs use for checking
// can_use_frontdesk() themselves despite being SECURITY DEFINER.

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { inviteFrontdeskStaffSchema } from "@/lib/validation/frontdesk-staff";
import { absoluteUrl } from "@/lib/utils/site-url";
import { sendFrontdeskInviteEmail } from "@/lib/services/email-service";

async function requireAdmin(): Promise<{ id: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("auth_required");
  }

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();

  if (!profile?.is_admin) {
    throw new Error("admin_required");
  }

  return { id: user.id };
}

/**
 * Builds this project's own /auth/confirm link from a raw token, rather than
 * trusting Supabase's {{ .RedirectTo }} email-template interpolation —
 * URLSearchParams guarantees correct encoding of `next`, which is exactly
 * what a hand-built template string got wrong (found live 2026-10-05: a
 * double-wrapped /auth/confirm URL that safeRedirectPath() then correctly
 * rejected, bouncing every invite to /frontdesk/login instead of
 * /frontdesk/accept-invite). See app/auth/confirm/route.ts for the other
 * half of this link's contract.
 */
function buildAcceptInviteUrl(hashedToken: string): string {
  const url = new URL(absoluteUrl("/auth/confirm"));
  url.searchParams.set("token_hash", hashedToken);
  url.searchParams.set("type", "invite");
  url.searchParams.set("next", "/frontdesk/accept-invite");
  return url.toString();
}

type ActionResult = { success: true } | { success: false; message: string };

/**
 * Records that an invite was sent — frontdesk_invited_at/_by only.
 * Deliberately does NOT set is_frontdesk: a session exists the instant
 * someone clicks the invite link (verifyOtp signs them in before they've
 * set anything), so granting access at send-time would let that session
 * reach /frontdesk — a real board, with real customer data — before a
 * password even exists. If they then sign out without finishing setup,
 * they're locked out with no credential at all. is_frontdesk only turns on
 * in markFrontdeskInviteAcceptedAction below, once a password is actually
 * set — that's the actual gate, not this bookkeeping write.
 */
async function recordInviteSent(
  adminClient: SupabaseClient,
  userId: string,
  invitedByAdminId: string,
): Promise<ActionResult> {
  const { error } = await adminClient
    .from("profiles")
    .update({
      frontdesk_invited_at: new Date().toISOString(),
      frontdesk_invited_by: invitedByAdminId,
    })
    .eq("id", userId);

  if (error) {
    return { success: false, message: error.message };
  }

  return { success: true };
}

/**
 * Restores access immediately — used only for someone who has already
 * completed setup once before (frontdesk_invite_accepted_at already set,
 * now being re-added after a revoke). They already have a working
 * password, so there is no "must set a password first" gate left to
 * enforce; waiting for another accept step would just be friction.
 */
async function restoreFrontdeskAccess(
  adminClient: SupabaseClient,
  userId: string,
  invitedByAdminId: string,
): Promise<ActionResult> {
  const { error } = await adminClient
    .from("profiles")
    .update({
      is_frontdesk: true,
      frontdesk_invited_at: new Date().toISOString(),
      frontdesk_invited_by: invitedByAdminId,
    })
    .eq("id", userId);

  if (error) {
    return { success: false, message: error.message };
  }

  return { success: true };
}

export type InviteFrontdeskStaffResult =
  | { success: true; reinvited: boolean }
  | { success: false; message: string };

/**
 * Invites a front desk staff member. Sends its own branded email via Resend
 * (lib/services/email-service.ts's sendFrontdeskInviteEmail) rather than
 * relying on Supabase Auth's built-in invite mailer — see that function's
 * own comment for why (free-tier template lock behind custom SMTP, and a
 * silent dead end for someone who never finishes setup, both worked around
 * here).
 *
 * Three cases, told apart by whether a profile already exists for this
 * email and whether it has ever completed setup
 * (frontdesk_invite_accepted_at):
 *   1. No existing account — ordinary first invite.
 *   2. Account exists, never completed setup — e.g. they clicked the link,
 *      never got to set a password, and are now locked out with no way back
 *      in. A silent re-grant here would strand them permanently, so this
 *      sends a FRESH invite email too, not just a flag flip.
 *   3. Account exists and already completed setup once (revoked, now being
 *      re-added) — they already have a working password, so no email is
 *      sent; the grant alone restores their access. `reinvited: true` tells
 *      the UI to say "access restored" instead of "invite sent" for this
 *      case specifically.
 */
export async function inviteFrontdeskStaffAction(input: {
  email: string;
}): Promise<InviteFrontdeskStaffResult> {
  const parsed = inviteFrontdeskStaffSchema.safeParse(input);

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Invalid email address." };
  }

  const { email } = parsed.data;

  try {
    const admin = await requireAdmin();
    const adminClient = createAdminClient();

    const { data: existing, error: lookupError } = await adminClient
      .from("profiles")
      .select("id, frontdesk_invite_accepted_at")
      .eq("email", email)
      .maybeSingle();

    if (lookupError) {
      return { success: false, message: lookupError.message };
    }

    // Case 3: already completed setup once — restore access, no email.
    if (existing?.frontdesk_invite_accepted_at) {
      const grant = await restoreFrontdeskAccess(adminClient, existing.id, admin.id);
      if (!grant.success) return grant;

      revalidatePath("/admin/staff");
      return { success: true, reinvited: true };
    }

    // Cases 1 and 2: generate a fresh invite token ourselves. generateLink
    // works whether or not the account already exists (unlike
    // inviteUserByEmail, which errors "already registered" for case 2 —
    // exactly the case that most needs a fresh email), and critically does
    // NOT send anything itself, leaving that to sendFrontdeskInviteEmail
    // below.
    const { data: link, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo: absoluteUrl("/frontdesk/accept-invite") },
    });

    if (linkError || !link) {
      return { success: false, message: linkError?.message ?? "Failed to generate an invite link." };
    }

    const emailResult = await sendFrontdeskInviteEmail({
      to: email,
      acceptUrl: buildAcceptInviteUrl(link.properties.hashed_token),
    });

    if (!emailResult.success) {
      return { success: false, message: emailResult.message };
    }

    const userId = existing?.id ?? link.user.id;
    const recorded = await recordInviteSent(adminClient, userId, admin.id);
    if (!recorded.success) return recorded;

    revalidatePath("/admin/staff");
    return { success: true, reinvited: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to invite staff member.";
    return {
      success: false,
      message: message === "admin_required" ? "Only admins can invite staff." : message,
    };
  }
}

export type MarkInviteAcceptedResult = { success: true } | { success: false; message: string };

/**
 * Called once from app/frontdesk/accept-invite/page.tsx right after the
 * CALLING user sets a password. Stamps frontdesk_invite_accepted_at AND —
 * this is the actual access gate for a brand-new invite — turns on
 * is_frontdesk here, not at invite-send time. See recordInviteSent()'s own
 * comment for why: a session exists from the moment the invite link is
 * clicked, before any password is set, so granting access any earlier would
 * let that bare session reach the real board.
 *
 * Not admin-gated like the two actions above — any signed-in user may call
 * this directly (it's a Server Action, reachable from client JS) — but it
 * can only ever touch the CALLING user's own row (auth.uid(), never a
 * parameter), and it only grants is_frontdesk if frontdesk_invited_at is
 * already set on that row. That column is REVOKEd from
 * anon/authenticated (0034_frontdesk_invites.sql) — a plain customer
 * calling this action directly cannot have it set, so cannot forge their
 * way to front desk access through this path. Without that check, this
 * would be as serious a privilege-escalation hole as the one 0031 exists to
 * close for is_admin.
 */
export async function markFrontdeskInviteAcceptedAction(): Promise<MarkInviteAcceptedResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Your session expired — sign in again." };
  }

  const adminClient = createAdminClient();

  const { data: profile, error: lookupError } = await adminClient
    .from("profiles")
    .select("frontdesk_invited_at")
    .eq("id", user.id)
    .maybeSingle();

  if (lookupError) {
    return { success: false, message: lookupError.message };
  }

  const update: { frontdesk_invite_accepted_at: string; is_frontdesk?: true } = {
    frontdesk_invite_accepted_at: new Date().toISOString(),
  };

  if (profile?.frontdesk_invited_at) {
    update.is_frontdesk = true;
  }

  const { error } = await adminClient.from("profiles").update(update).eq("id", user.id);

  if (error) {
    return { success: false, message: error.message };
  }

  return { success: true };
}

export type RevokeFrontdeskStaffResult = { success: true } | { success: false; message: string };

/** Removes front desk access. Leaves the auth account and invite history intact — see profiles.is_frontdesk's own comment. */
export async function revokeFrontdeskStaffAction(profileId: string): Promise<RevokeFrontdeskStaffResult> {
  try {
    await requireAdmin();
    const adminClient = createAdminClient();

    const { error } = await adminClient.from("profiles").update({ is_frontdesk: false }).eq("id", profileId);

    if (error) {
      return { success: false, message: error.message };
    }

    revalidatePath("/admin/staff");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to revoke staff access.";
    return {
      success: false,
      message: message === "admin_required" ? "Only admins can revoke staff access." : message,
    };
  }
}
