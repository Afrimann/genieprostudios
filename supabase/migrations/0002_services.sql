-- 0002_services.sql
-- Reference table of bookable services/packages and post-production add-ons.
-- Prices are stored in kobo (naira * 100) to avoid floating point money bugs.

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  label text not null,
  duration_hours numeric not null,
  price_kobo bigint not null,
  is_addon boolean not null default false,
  active boolean not null default true
);

comment on table public.services is
  'Reference/catalog table of bookable services and post-production add-ons. '
  'Prices are in kobo (NGN * 100).';
comment on column public.services.category is
  'Grouping key, e.g. rehearsal_day, rehearsal_night, multitrack_day, '
  'multitrack_night, video_livestream_day, virtual_package_day, '
  'virtual_package_night, post_production.';
comment on column public.services.duration_hours is
  'Session length in hours. For is_addon rows priced per-song rather than per-hour, '
  'this is set to 0 (there is no time-slot duration to reserve for an add-on).';

alter table public.services enable row level security;

-- ---------------------------------------------------------------------------
-- Seed data — real pricing supplied by the owner (2026-09-26 intake).
-- ---------------------------------------------------------------------------
insert into public.services (category, label, duration_hours, price_kobo, is_addon, active)
values
  -- Rehearsal Day
  ('rehearsal_day', 'Rehearsal Day — 1hr', 1, 3000000, false, true),
  ('rehearsal_day', 'Rehearsal Day — 2hrs', 2, 6000000, false, true),
  ('rehearsal_day', 'Rehearsal Day — 3hrs', 3, 9000000, false, true),

  -- Rehearsal Night
  ('rehearsal_night', 'Rehearsal Night — 4hrs', 4, 8000000, false, true),
  ('rehearsal_night', 'Rehearsal Night — 6hrs', 6, 10000000, false, true),

  -- Multi-track Day
  ('multitrack_day', 'Multi-track Day — 2hrs', 2, 10000000, false, true),
  ('multitrack_day', 'Multi-track Day — 4hrs', 4, 20000000, false, true),
  ('multitrack_day', 'Multi-track Day — 6hrs', 6, 25000000, false, true),

  -- Multi-track Night
  ('multitrack_night', 'Multi-track Night — 2hrs', 2, 10000000, false, true),
  ('multitrack_night', 'Multi-track Night — 4hrs', 4, 20000000, false, true),
  ('multitrack_night', 'Multi-track Night — 6hrs', 6, 25000000, false, true),

  -- Video Livestream Day (iPhone single angle)
  ('video_livestream_day', 'Video Livestream Day — 1hr', 1, 5000000, false, true),
  ('video_livestream_day', 'Video Livestream Day — 2hrs', 2, 8000000, false, true),

  -- Virtual Package Day (Facebook/YouTube Live)
  ('virtual_package_day', 'Virtual Package Day — 2hrs', 2, 8000000, false, true),
  ('virtual_package_day', 'Virtual Package Day — 3hrs', 3, 12000000, false, true),

  -- Virtual Package Night
  ('virtual_package_night', 'Virtual Package Night — 4hrs', 4, 16000000, false, true),

  -- Post-Production Add-ons (priced per song, not per hour — duration_hours = 0)
  ('post_production', 'Mix + Master Bundle (per song)', 0, 20000000, true, true),
  ('post_production', 'Mixing & Mastering (per song)', 0, 8000000, true, true);
