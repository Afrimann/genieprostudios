import { z } from "zod";

// Canonical, fixed set of video-content categories for the public /work
// grid filter + the admin portfolio-entry form. Deliberately small and
// content-genre-shaped (NOT the same granularity as services.category,
// which has booking-SKU day/night variants like rehearsal_day/
// rehearsal_night — see supabase/migrations/0015_portfolio_categories.sql's
// comment). This is the single source of truth for allowed values: the DB
// column is plain `text` (not a Postgres enum) specifically so this array
// can be extended later without a migration — but every write path (the
// admin form via createPortfolioEntrySchema/updatePortfolioEntrySchema
// below) must still validate against it server-side, never trust the
// client's <select> to have only offered these values.
export const PORTFOLIO_CATEGORIES = [
  "recording",
  "rehearsal",
  "live_performance",
  "music_video",
  "mix_master",
] as const;

export type PortfolioCategory = (typeof PORTFOLIO_CATEGORIES)[number];

// Presentation labels for the frontend filter UI / admin form <select>,
// mirroring the CATEGORY_LABELS convention in app/services/page.tsx (kept
// here rather than in that page since this is portfolio-specific and this
// file is already the canonical source for the category set itself).
export const PORTFOLIO_CATEGORY_LABELS: Record<PortfolioCategory, string> = {
  recording: "Recording",
  rehearsal: "Rehearsal",
  live_performance: "Live Performance",
  music_video: "Music Video",
  mix_master: "Mix & Master",
};

const categorySchema = z.enum(PORTFOLIO_CATEGORIES, {
  error: "Choose a valid category",
});

// Matches public.portfolio_platform (supabase/migrations/0008_portfolio_entries.sql).
export const PORTFOLIO_PLATFORMS = ["youtube", "instagram"] as const;
export type PortfolioPlatform = (typeof PORTFOLIO_PLATFORMS)[number];

const platformSchema = z.enum(PORTFOLIO_PLATFORMS, {
  error: "Choose a valid platform",
});

// Shared field-level schemas so create/update stay in lockstep without
// duplicating rules — same split rationale as
// lib/validation/availability.ts's startTimeField/endTimeField.
const titleField = z.string().trim().min(1, "Title is required");
const descriptionField = z
  .string()
  .trim()
  .max(2000, "Description is too long")
  .optional()
  .or(z.literal(""));
const videoIdOrUrlField = z
  .string()
  .trim()
  .min(1, "A video ID or URL is required");
const thumbnailUrlField = z
  .string()
  .trim()
  .url("Enter a valid thumbnail URL")
  .optional()
  .or(z.literal(""));
const displayOrderField = z.coerce.number().int().default(0);
const publishedField = z.coerce.boolean().default(false);

/**
 * Validates a new admin-authored portfolio entry before it reaches
 * createPortfolioEntry (lib/repositories/portfolio-repository.ts). Every
 * field the admin form submits is re-validated here server-side — the
 * form's <select> options for category/platform are a UX convenience, not
 * the actual security boundary.
 */
export const createPortfolioEntrySchema = z.object({
  title: titleField,
  description: descriptionField,
  platform: platformSchema,
  videoIdOrUrl: videoIdOrUrlField,
  thumbnailUrl: thumbnailUrlField,
  category: categorySchema,
  displayOrder: displayOrderField,
  published: publishedField,
});

export type CreatePortfolioEntryInput = z.infer<typeof createPortfolioEntrySchema>;

// Update allows partial edits (e.g. toggling `published` alone from the
// admin list without resubmitting every field) — same partial-schema shape
// as any PATCH-style admin action elsewhere in this codebase.
export const updatePortfolioEntrySchema = createPortfolioEntrySchema.partial();

export type UpdatePortfolioEntryInput = z.infer<typeof updatePortfolioEntrySchema>;
