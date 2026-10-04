import { createClient } from "@/lib/supabase/server";
import type {
  TriumphProject,
  TriumphProjectUpdate,
} from "@/lib/repositories/triumph-projects-repository";
import type { TriumphProjectStatus } from "@/lib/validation/triumph-update";
import type { MoneyPaymentStatus, TriumphPaymentStatus } from "@/lib/validation/triumph-payment";

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

// Mirrors public.triumph_payments (0029_triumph_payments.sql). `project` is
// the PostgREST-embedded triumph_projects row via the project_id FK — null
// only if the project was somehow deleted out from under a historical
// payment row (on delete cascade means this shouldn't happen in practice).
export type TriumphPayment = {
  id: string;
  project_id: string;
  payment_status: MoneyPaymentStatus;
  amount_kobo: number;
  receipt_path: string | null;
  receipt_name: string | null;
  created_by: string | null;
  created_at: string;
  project: { project_code: string; full_name: string } | null;
};

/**
 * Calls the record_triumph_payment RPC (0029) — the only write path for the
 * ledger, so a recorded payment and the project's payment_status always
 * land atomically. The confirmation-code check has already happened in
 * triumph-admin-actions.ts before this is ever called.
 */
export async function recordTriumphPayment(params: {
  projectId: string;
  paymentStatus: MoneyPaymentStatus;
  amountKobo: number;
  receiptPath: string | null;
  receiptName: string | null;
}): Promise<TriumphPayment> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("record_triumph_payment", {
    p_project_id: params.projectId,
    p_payment_status: params.paymentStatus,
    p_amount_kobo: params.amountKobo,
    p_receipt_path: params.receiptPath,
    p_receipt_name: params.receiptName,
  });

  if (error) {
    throw new Error(`recordTriumphPayment: ${error.message}`);
  }

  return data as TriumphPayment;
}

export type TriumphRevenueOverview = {
  allTimeKobo: number;
  thisMonthKobo: number;
  lastMonthKobo: number;
  payments: TriumphPayment[];
};

/**
 * Powers /triumph-admin/revenue — same "fetch the ledger, reduce client-side"
 * convention as getRevenueOverview() in admin-dashboard-repository.ts (no
 * server-side GROUP BY available via PostgREST, and volume here is low
 * enough that this is fine).
 */
export async function getTriumphRevenueOverview(): Promise<TriumphRevenueOverview> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("triumph_payments")
    .select("*, project:triumph_projects(project_code, full_name)")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`getTriumphRevenueOverview: ${error.message}`);
  }

  const payments = (data ?? []) as TriumphPayment[];
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  let allTimeKobo = 0;
  let thisMonthKobo = 0;
  let lastMonthKobo = 0;

  for (const payment of payments) {
    const createdAt = new Date(payment.created_at);
    allTimeKobo += payment.amount_kobo;

    if (createdAt >= thisMonthStart) {
      thisMonthKobo += payment.amount_kobo;
    } else if (createdAt >= lastMonthStart) {
      lastMonthKobo += payment.amount_kobo;
    }
  }

  return { allTimeKobo, thisMonthKobo, lastMonthKobo, payments };
}

/**
 * Signed, time-limited download URL for a payment receipt — relies on the
 * triumph_receipts_select_admin storage policy (0029), so this only
 * succeeds when called by an admin's own session. Same cookie-scoped-client
 * + 60s-ttl pattern as getTrackDownloadUrl() in booking-tracks-repository.ts.
 */
export async function getTriumphReceiptDownloadUrl(filePath: string): Promise<string> {
  const supabase = await createClient();

  const { data, error } = await supabase.storage
    .from("triumph-receipts")
    .createSignedUrl(filePath, 60);

  if (error || !data) {
    throw new Error(`getTriumphReceiptDownloadUrl: ${error?.message ?? "no URL returned"}`);
  }

  return data.signedUrl;
}
