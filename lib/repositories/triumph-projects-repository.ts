import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { generateProjectCode } from "@/lib/utils/project-code";
import type { TriumphProjectStatus } from "@/lib/validation/triumph-update";
import type { TriumphPaymentStatus } from "@/lib/validation/triumph-payment";

// Service-role reads/writes for Triumph's PUBLIC side (intake + "Find Your
// Project" tracking lookup) — there is no Supabase session on that path at
// all (no account/password, by design), so there's no RLS policy to rely
// on. Authorization instead happens in the calling trusted server code
// (triumph-actions.ts's Zod-validated Server Action; the tracking cookie
// check in triumph-tracking-actions.ts/the [code] page) before any of these
// functions are called. The admin side uses the separate, RLS-gated
// triumph-admin-repository.ts instead — see 0023_triumph_projects.sql's
// comments for why the split exists.

const MAX_CODE_GENERATION_ATTEMPTS = 5;

// Mirrors public.triumph_projects (0023_triumph_projects.sql).
export type TriumphProject = {
  id: string;
  project_code: string;
  full_name: string;
  email: string;
  country: string;
  phone: string;
  number_of_songs: number;
  service_id: string;
  project_details: string;
  status: TriumphProjectStatus;
  payment_status: TriumphPaymentStatus;
  created_at: string;
  updated_at: string;
};

// Mirrors public.triumph_project_updates (0023_triumph_projects.sql).
export type TriumphProjectUpdate = {
  id: string;
  project_id: string;
  body: string;
  status_after: TriumphProjectStatus | null;
  file_path: string | null;
  file_name: string | null;
  created_at: string;
};

export type CreateTriumphProjectInput = {
  fullName: string;
  email: string;
  country: string;
  phone: string;
  numberOfSongs: number;
  serviceId: string;
  projectDetails: string;
};

/**
 * Inserts a new triumph_projects row. Retries with a freshly-generated
 * project_code on a unique-violation collision (Postgres error 23505) —
 * essentially never triggers at this volume, but the failure mode must be
 * a clean retry rather than a confusing error. email is stored lower-cased
 * so the tracking lookup's .eq("email", ...) stays a plain index match.
 */
export async function createTriumphProject(
  input: CreateTriumphProjectInput,
): Promise<TriumphProject> {
  const supabase = createAdminClient();

  for (let attempt = 0; attempt < MAX_CODE_GENERATION_ATTEMPTS; attempt++) {
    const { data, error } = await supabase
      .from("triumph_projects")
      .insert({
        project_code: generateProjectCode(),
        full_name: input.fullName,
        email: input.email.toLowerCase(),
        country: input.country,
        phone: input.phone,
        number_of_songs: input.numberOfSongs,
        service_id: input.serviceId,
        project_details: input.projectDetails,
      })
      .select("*")
      .single();

    if (!error) {
      return data as TriumphProject;
    }

    if (error.code !== "23505") {
      throw new Error(`createTriumphProject: ${error.message}`);
    }
    // Unique violation on project_code — loop regenerates and retries.
  }

  throw new Error("createTriumphProject: exhausted project_code generation attempts");
}

/**
 * The public "Find Your Project" lookup — matches project_code AND a
 * case-insensitive email. Returns null (never an error) on no match, so
 * the caller can return one generic failure message regardless of which
 * field was wrong — resists enumeration.
 */
export async function findTriumphProjectByCodeAndEmail(
  projectCode: string,
  email: string,
): Promise<TriumphProject | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("triumph_projects")
    .select("*")
    .eq("project_code", projectCode)
    .eq("email", email.toLowerCase())
    .maybeSingle();

  if (error) {
    throw new Error(`findTriumphProjectByCodeAndEmail: ${error.message}`);
  }

  return (data as TriumphProject | null) ?? null;
}

/** Used by the /triumph/track/[code] page + its status route handler, after the signed cookie has already been verified. */
export async function getTriumphProjectById(projectId: string): Promise<TriumphProject | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("triumph_projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();

  if (error) {
    throw new Error(`getTriumphProjectById: ${error.message}`);
  }

  return (data as TriumphProject | null) ?? null;
}

export async function getTriumphProjectUpdates(projectId: string): Promise<TriumphProjectUpdate[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("triumph_project_updates")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`getTriumphProjectUpdates: ${error.message}`);
  }

  return (data ?? []) as TriumphProjectUpdate[];
}

/** Used by the download route handler to confirm the update belongs to the project before minting a signed URL. */
export async function getTriumphProjectUpdateById(
  updateId: string,
): Promise<TriumphProjectUpdate | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("triumph_project_updates")
    .select("*")
    .eq("id", updateId)
    .maybeSingle();

  if (error) {
    throw new Error(`getTriumphProjectUpdateById: ${error.message}`);
  }

  return (data as TriumphProjectUpdate | null) ?? null;
}

/**
 * Signed, time-limited download URL for a deliverable — the service-role
 * client bypasses storage RLS entirely, which is fine here because the
 * caller (the download route handler) has already independently verified
 * the tracking cookie + project/update ownership before calling this.
 */
export async function createDeliverableSignedUrl(filePath: string): Promise<string> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.storage
    .from("triumph-deliverables")
    .createSignedUrl(filePath, 60);

  if (error || !data) {
    throw new Error(`createDeliverableSignedUrl: ${error?.message ?? "no URL returned"}`);
  }

  return data.signedUrl;
}
