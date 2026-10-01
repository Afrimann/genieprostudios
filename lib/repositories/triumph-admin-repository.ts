import { createClient } from "@/lib/supabase/server";
import type {
  TriumphProject,
  TriumphProjectUpdate,
} from "@/lib/repositories/triumph-projects-repository";
import type { TriumphProjectStatus } from "@/lib/validation/triumph-update";
import type { TriumphPaymentStatus } from "@/lib/validation/triumph-payment";

// Admin-side ("engineer") reads/writes for Triumph projects — relies
// entirely on the is_admin()-gated RLS policies on triumph_projects/
// triumph_project_updates (0023_triumph_projects.sql), same convention as
// admin-booking-repository.ts: dumb data access, no redundant admin check
// here. Only ever call from behind the /triumph-admin/(protected) auth
// gate. The public side (intake + tracking lookup) uses the separate
// service-role triumph-projects-repository.ts instead.

export async function listTriumphProjectsForAdmin(): Promise<TriumphProject[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("triumph_projects")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`listTriumphProjectsForAdmin: ${error.message}`);
  }

  return (data ?? []) as TriumphProject[];
}

export type TriumphProjectStatusCounts = Record<TriumphProjectStatus, number>;

/** Powers the dashboard's status-count summary strip, same pattern as getBookingStatusCounts(). */
export async function getTriumphProjectStatusCounts(): Promise<TriumphProjectStatusCounts> {
  const supabase = await createClient();

  const { data, error } = await supabase.from("triumph_projects").select("status");

  if (error) {
    throw new Error(`getTriumphProjectStatusCounts: ${error.message}`);
  }

  const counts: TriumphProjectStatusCounts = {
    new: 0,
    in_progress: 0,
    review: 0,
    completed: 0,
    cancelled: 0,
  };

  for (const row of data ?? []) {
    counts[row.status as TriumphProjectStatus] += 1;
  }

  return counts;
}

export async function getTriumphProjectForAdmin(projectId: string): Promise<TriumphProject | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("triumph_projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();

  if (error) {
    throw new Error(`getTriumphProjectForAdmin: ${error.message}`);
  }

  return (data as TriumphProject | null) ?? null;
}

export async function getTriumphProjectUpdatesForAdmin(
  projectId: string,
): Promise<TriumphProjectUpdate[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("triumph_project_updates")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`getTriumphProjectUpdatesForAdmin: ${error.message}`);
  }

  return (data ?? []) as TriumphProjectUpdate[];
}

/**
 * Calls the create_triumph_project_update RPC (0023) — the only write path
 * for updates, so a status change and its note always land atomically (see
 * the RPC's own comment for why this isn't two separate repository calls).
 */
export async function postTriumphProjectUpdate(params: {
  projectId: string;
  body: string;
  statusAfter: TriumphProjectStatus | null;
  filePath: string | null;
  fileName: string | null;
}): Promise<TriumphProjectUpdate> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("create_triumph_project_update", {
    p_project_id: params.projectId,
    p_body: params.body,
    p_status_after: params.statusAfter,
    p_file_path: params.filePath,
    p_file_name: params.fileName,
  });

  if (error) {
    throw new Error(`postTriumphProjectUpdate: ${error.message}`);
  }

  return data as TriumphProjectUpdate;
}

/**
 * Calls the update_triumph_project_payment_status RPC (0024) — a standalone
 * admin toggle, independent of the work-status timeline above. Manually
 * set by the admin; no payment gateway backs this.
 */
export async function updateTriumphProjectPaymentStatus(
  projectId: string,
  paymentStatus: TriumphPaymentStatus,
): Promise<TriumphProject> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("update_triumph_project_payment_status", {
    p_project_id: projectId,
    p_payment_status: paymentStatus,
  });

  if (error) {
    throw new Error(`updateTriumphProjectPaymentStatus: ${error.message}`);
  }

  return data as TriumphProject;
}
