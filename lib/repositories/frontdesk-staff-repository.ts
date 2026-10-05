import { createClient } from "@/lib/supabase/server";

// Admin-facing read for the /admin/staff screen. Dumb data access only,
// relies on profiles_select_admin (0010_rls_policies.sql) — same convention
// as admin-booking-repository.ts. The actual grant/revoke writes live in
// lib/services/frontdesk-staff-actions.ts, since they go through the
// service-role client (profiles.is_frontdesk can't be written any other
// way, see 0032_frontdesk_role.sql) and therefore need their own explicit
// is_admin() check that a plain repository read doesn't.

export type FrontdeskStaffStatus = "pending" | "active" | "revoked";

export type FrontdeskStaffMember = {
  id: string;
  email: string | null;
  fullName: string | null;
  status: FrontdeskStaffStatus;
  invitedAt: string | null;
  invitedByName: string | null;
  acceptedAt: string | null;
};

function deriveStatus(isFrontdesk: boolean, acceptedAt: string | null): FrontdeskStaffStatus {
  if (!isFrontdesk) return "revoked";
  return acceptedAt ? "active" : "pending";
}

/**
 * Everyone ever invited to /frontdesk, newest invite first — including
 * revoked staff, so the owner can see who used to have access rather than
 * that history silently disappearing. Someone who has never been invited
 * (frontdesk_invited_at is null) never appears here, even if is_frontdesk
 * were somehow true by other means.
 */
export async function listFrontdeskStaff(): Promise<FrontdeskStaffMember[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, is_frontdesk, frontdesk_invited_at, frontdesk_invite_accepted_at, frontdesk_invited_by")
    .not("frontdesk_invited_at", "is", null)
    .order("frontdesk_invited_at", { ascending: false });

  if (error) {
    throw new Error(`listFrontdeskStaff: ${error.message}`);
  }

  const rows = data ?? [];

  if (rows.length === 0) {
    return [];
  }

  const inviterIds = [...new Set(rows.map((r) => r.frontdesk_invited_by).filter((id): id is string => !!id))];

  const { data: inviters, error: invitersError } =
    inviterIds.length === 0
      ? { data: [], error: null }
      : await supabase.from("profiles").select("id, full_name, email").in("id", inviterIds);

  if (invitersError) {
    throw new Error(`listFrontdeskStaff: inviter lookup failed: ${invitersError.message}`);
  }

  const inviterById = new Map((inviters ?? []).map((p) => [p.id, p]));

  return rows.map((row) => {
    const inviter = row.frontdesk_invited_by ? inviterById.get(row.frontdesk_invited_by) : undefined;

    return {
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      status: deriveStatus(row.is_frontdesk, row.frontdesk_invite_accepted_at),
      invitedAt: row.frontdesk_invited_at,
      invitedByName: inviter?.full_name ?? inviter?.email ?? null,
      acceptedAt: row.frontdesk_invite_accepted_at,
    };
  });
}
