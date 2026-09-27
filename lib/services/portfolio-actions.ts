"use server";

// Server Action boundary between the admin portfolio manager (Client
// Component) and the portfolio service/repository layer (both use
// createClient() from lib/supabase/server.ts and therefore can only run
// server-side). Mirrors lib/services/availability-actions.ts: validate
// input server-side, never throw for expected failures, always return a
// typed result the UI can branch on directly.

import {
  getAllPortfolioEntriesForAdmin,
  createPortfolioEntry as createPortfolioEntryRepo,
  updatePortfolioEntry as updatePortfolioEntryRepo,
  deletePortfolioEntry as deletePortfolioEntryRepo,
  type PortfolioEntry,
} from "@/lib/repositories/portfolio-repository";
import { resolveThumbnailUrl } from "@/lib/services/portfolio-service";
import {
  createPortfolioEntrySchema,
  updatePortfolioEntrySchema,
} from "@/lib/validation/portfolio";

export type FetchAllPortfolioEntriesResult =
  | { success: true; entries: PortfolioEntry[] }
  | { success: false; message: string };

/** Admin-only: every portfolio entry regardless of published status. */
export async function fetchAllPortfolioEntries(): Promise<FetchAllPortfolioEntriesResult> {
  try {
    const entries = await getAllPortfolioEntriesForAdmin();
    return { success: true, entries };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load portfolio entries.";
    return { success: false, message };
  }
}

export type PortfolioEntryActionResult =
  | { success: true; entry: PortfolioEntry }
  | { success: false; message: string };

/**
 * Validates + creates a new portfolio entry. When no explicit thumbnail
 * override is supplied, resolves one server-side via resolveThumbnailUrl
 * before persisting (per the backend service's intended connection point —
 * this is the only sanctioned path, never call createPortfolioEntry
 * directly from the admin UI).
 */
export async function createPortfolioEntryAction(
  input: unknown,
): Promise<PortfolioEntryActionResult> {
  const parsed = createPortfolioEntrySchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid portfolio entry details.",
    };
  }

  const data = parsed.data;
  const explicitThumbnail = data.thumbnailUrl && data.thumbnailUrl.length > 0
    ? data.thumbnailUrl
    : null;
  const thumbnailUrl = resolveThumbnailUrl(data.platform, data.videoIdOrUrl, explicitThumbnail);

  try {
    const entry = await createPortfolioEntryRepo({
      title: data.title,
      description: data.description && data.description.length > 0 ? data.description : null,
      platform: data.platform,
      videoIdOrUrl: data.videoIdOrUrl,
      thumbnailUrl,
      category: data.category,
      displayOrder: data.displayOrder,
      published: data.published,
    });
    return { success: true, entry };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create portfolio entry.";
    return { success: false, message };
  }
}

/**
 * Validates + updates an existing portfolio entry (partial patch). Same
 * thumbnail-resolution rule as create: an explicit override always wins,
 * otherwise resolveThumbnailUrl derives one from the (possibly newly
 * supplied) platform/videoIdOrUrl before persisting. Only re-resolves the
 * thumbnail when platform or videoIdOrUrl is actually part of this patch —
 * a patch that doesn't touch either (e.g. toggling `published` alone) must
 * not overwrite an existing thumbnail with a derived one from stale/absent
 * input.
 */
export async function updatePortfolioEntryAction(
  id: string,
  input: unknown,
): Promise<PortfolioEntryActionResult> {
  const parsed = updatePortfolioEntrySchema.safeParse(input);

  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid portfolio entry details.",
    };
  }

  const data = parsed.data;
  const patch: Parameters<typeof updatePortfolioEntryRepo>[1] = {};

  if (data.title !== undefined) patch.title = data.title;
  if (data.description !== undefined) {
    patch.description = data.description.length > 0 ? data.description : null;
  }
  if (data.platform !== undefined) patch.platform = data.platform;
  if (data.videoIdOrUrl !== undefined) patch.videoIdOrUrl = data.videoIdOrUrl;
  if (data.category !== undefined) patch.category = data.category;
  if (data.displayOrder !== undefined) patch.displayOrder = data.displayOrder;
  if (data.published !== undefined) patch.published = data.published;

  const explicitThumbnail = data.thumbnailUrl && data.thumbnailUrl.length > 0
    ? data.thumbnailUrl
    : null;

  if (data.thumbnailUrl !== undefined || data.platform !== undefined || data.videoIdOrUrl !== undefined) {
    // Resolving requires both platform and videoIdOrUrl — if this patch
    // doesn't supply both (e.g. only videoIdOrUrl changed), the caller must
    // have supplied the other via the same form submission (the admin form
    // always submits the full record on edit, per the form-only schema
    // covering every field), so both are expected to be present together.
    if (data.platform !== undefined && data.videoIdOrUrl !== undefined) {
      patch.thumbnailUrl = resolveThumbnailUrl(data.platform, data.videoIdOrUrl, explicitThumbnail);
    } else if (explicitThumbnail) {
      patch.thumbnailUrl = explicitThumbnail;
    }
  }

  try {
    const entry = await updatePortfolioEntryRepo(id, patch);

    if (!entry) {
      return { success: false, message: "This portfolio entry could not be found." };
    }

    return { success: true, entry };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update portfolio entry.";
    return { success: false, message };
  }
}

export type DeletePortfolioEntryResult =
  | { success: true }
  | { success: false; message: string };

/** Admin-only: deletes a portfolio entry by id. */
export async function deletePortfolioEntryAction(
  id: string,
): Promise<DeletePortfolioEntryResult> {
  try {
    const deleted = await deletePortfolioEntryRepo(id);

    if (!deleted) {
      return { success: false, message: "This portfolio entry could not be found." };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete portfolio entry.";
    return { success: false, message };
  }
}
