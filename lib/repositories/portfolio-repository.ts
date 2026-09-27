import { createClient } from "@/lib/supabase/server";
import type {
  PortfolioCategory,
  PortfolioPlatform,
} from "@/lib/validation/portfolio";

// Mirrors public.portfolio_entries (see supabase/migrations/0008_portfolio_entries.sql,
// extended by 0015_portfolio_categories.sql's `category` column).
export type PortfolioEntry = {
  id: string;
  title: string;
  description: string | null;
  platform: PortfolioPlatform;
  video_id_or_url: string;
  thumbnail_url: string | null;
  category: PortfolioCategory;
  display_order: number;
  published: boolean;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Public-facing reads. Rely on the existing RLS policy
// "portfolio_entries_select_published_public" (0010), which already
// restricts anon/authenticated SELECT to published = true rows — the
// explicit .eq("published", true) filters below are defense-in-depth/
// clarity, not the actual security boundary, matching how
// service-repository.ts's getActiveServices explicitly filters active=true.
// ---------------------------------------------------------------------------

/**
 * Reads all published portfolio entries, ordered by display_order — the
 * list the public /work grid renders. Dumb data access only: no
 * category-filtering logic here, that's a frontend concern applied on top
 * of this full published list (or, if pagination/server-side filtering is
 * ever needed, add a dedicated parameterized function rather than
 * overloading this one).
 */
export async function getPublishedPortfolioEntries(): Promise<PortfolioEntry[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("portfolio_entries")
    .select("*")
    .eq("published", true)
    .order("display_order", { ascending: true });

  if (error) {
    throw new Error(`getPublishedPortfolioEntries: ${error.message}`);
  }

  return data ?? [];
}

/**
 * Reads a single published portfolio entry by id, for the /work/[id] detail
 * page. Returns null if it doesn't exist or isn't published, rather than
 * throwing, so callers can distinguish "not found" (a normal, expected
 * case — e.g. a stale link to an entry the admin has since unpublished)
 * from a genuine query failure. Same pattern as getServiceById
 * (service-repository.ts).
 */
export async function getPortfolioEntryById(id: string): Promise<PortfolioEntry | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("portfolio_entries")
    .select("*")
    .eq("id", id)
    .eq("published", true)
    .maybeSingle();

  if (error) {
    throw new Error(`getPortfolioEntryById: ${error.message}`);
  }

  return data ?? null;
}

// ---------------------------------------------------------------------------
// Admin-side reads/writes. Rely entirely on the existing admin RLS policies
// (portfolio_entries_select_admin / _insert_admin / _update_admin /
// _delete_admin, 0010), which gate on public.is_admin() — this repository
// does not itself re-check admin status (dumb data access, no business
// rules in the repository layer per project-notes.md). Only ever call these
// from a context already behind the /admin/(protected) auth gate, same
// convention as availability-repository.ts's admin functions.
// ---------------------------------------------------------------------------

/**
 * Returns ALL portfolio entries (any published status), ordered by
 * display_order, for the admin manager list — the admin needs to see drafts
 * too, not just what's already public.
 */
export async function getAllPortfolioEntriesForAdmin(): Promise<PortfolioEntry[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("portfolio_entries")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) {
    throw new Error(`getAllPortfolioEntriesForAdmin: ${error.message}`);
  }

  return data ?? [];
}

export type CreatePortfolioEntryInput = {
  title: string;
  description: string | null;
  platform: PortfolioPlatform;
  videoIdOrUrl: string;
  thumbnailUrl: string | null;
  category: PortfolioCategory;
  displayOrder: number;
  published: boolean;
};

/**
 * Inserts a new portfolio entry. Pure data access — does NOT resolve a
 * missing YouTube thumbnail or validate the category/platform against the
 * allowed sets; that belongs in lib/services/portfolio-service.ts and
 * lib/validation/portfolio.ts respectively, both of which must run before
 * this function is called. Relies on the admin RLS insert policy.
 */
export async function createPortfolioEntry(
  input: CreatePortfolioEntryInput,
): Promise<PortfolioEntry> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("portfolio_entries")
    .insert({
      title: input.title,
      description: input.description,
      platform: input.platform,
      video_id_or_url: input.videoIdOrUrl,
      thumbnail_url: input.thumbnailUrl,
      category: input.category,
      display_order: input.displayOrder,
      published: input.published,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`createPortfolioEntry: ${error.message}`);
  }

  return data;
}

export type UpdatePortfolioEntryInput = Partial<CreatePortfolioEntryInput>;

/**
 * Updates an existing portfolio entry (partial patch). Returns the updated
 * row, or null if no row matched the id (doesn't exist), so the caller can
 * distinguish "updated successfully" from "nothing happened" — same pattern
 * as availability-repository.ts's closeSlot. Relies on the admin RLS update
 * policy.
 */
export async function updatePortfolioEntry(
  id: string,
  input: UpdatePortfolioEntryInput,
): Promise<PortfolioEntry | null> {
  const supabase = await createClient();

  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.platform !== undefined) patch.platform = input.platform;
  if (input.videoIdOrUrl !== undefined) patch.video_id_or_url = input.videoIdOrUrl;
  if (input.thumbnailUrl !== undefined) patch.thumbnail_url = input.thumbnailUrl;
  if (input.category !== undefined) patch.category = input.category;
  if (input.displayOrder !== undefined) patch.display_order = input.displayOrder;
  if (input.published !== undefined) patch.published = input.published;

  const { data, error } = await supabase
    .from("portfolio_entries")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`updatePortfolioEntry: ${error.message}`);
  }

  return data ?? null;
}

/**
 * Deletes a portfolio entry by id. Returns true if a row was actually
 * deleted, false if no row matched the id (doesn't exist/already deleted),
 * so the caller can distinguish the two rather than assuming success.
 * Relies on the admin RLS delete policy.
 */
export async function deletePortfolioEntry(id: string): Promise<boolean> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("portfolio_entries")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    throw new Error(`deletePortfolioEntry: ${error.message}`);
  }

  return (data ?? []).length > 0;
}
