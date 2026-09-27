-- 0015_portfolio_categories.sql
-- Adds a `category` column to portfolio_entries so the public /work grid can
-- filter by video-content genre. Deliberately a plain `text` column, not a
-- Postgres enum: the allowed set is validated at the application layer (see
-- lib/validation/portfolio.ts's PORTFOLIO_CATEGORIES), matching the existing
-- convention for services.category (plain text, app-side label map in
-- app/services/page.tsx's CATEGORY_LABELS/CATEGORY_ORDER) rather than the
-- DB-enum approach used for portfolio_platform (0008) — this is deliberately
-- easier to extend later without a migration, since new video categories are
-- expected to be lower-stakes/more frequent than new payment platforms.
--
-- This is video-content-genre granularity, NOT booking-SKU granularity —
-- services.category has day/night pricing variants (rehearsal_day,
-- rehearsal_night, etc.) that have no meaning for a portfolio video, so this
-- column intentionally does not reuse or reference services.category.

alter table public.portfolio_entries  
  add column if not exists category text not null default 'recording';

comment on column public.portfolio_entries.category is
  'Video-content genre for public /work grid filtering. Small fixed set '
  'validated at the application layer (lib/validation/portfolio.ts), not a '
  'DB enum type — see that file for the canonical allowed values.';
