-- 0041_triumph_packages.sql
--
-- Triumph's pricing tiers were hardcoded in lib/data/triumph-pricing.ts
-- (TRIUMPH_PRICING_TIERS) with a TODO(client) placeholder-pricing comment —
-- every price change meant a code deploy, and the client had to text the
-- dev to update a number. This moves pricing into the DB, owner-editable
-- from /triumph-admin, same "dumb CRUD" shape as equipment_items
-- (0035_equipment_items.sql): no business-rule logic, pure data access.
--
-- Seeded with the real tier pricing the client shared (not the old
-- placeholder figures): Mastering $75, Mix + Master Bundle $250 (the
-- client's main bundle — marked featured), Express Mix & Master $300,
-- Post-production add-ons $80.

create table if not exists public.triumph_packages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price_usd integer not null check (price_usd >= 0),
  unit text not null default '/song',
  description text not null default '',
  turnaround text not null default '',
  featured boolean not null default false,
  display_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- `slug` is the stable identifier other tables reference (specifically
-- triumph_projects.service_id, see 0023_triumph_projects.sql) — a text
-- slug rather than the `id` uuid so it reads sensibly in that column and
-- survives a re-seed. Confirmed zero existing triumph_projects rows at the
-- time this table was built (pre-launch), so there was no legacy slug
-- scheme to stay compatible with. Immutable after creation
-- (lib/repositories/triumph-package-repository.ts never updates it):
-- renaming `name` must not silently break every existing project that
-- stored this slug as its service_id.
--
-- Added via ALTER rather than inline in the CREATE TABLE above so this
-- migration is safe to re-run against a database where this table was
-- already created by an earlier version of this same file (before `slug`
-- existed) — CREATE TABLE IF NOT EXISTS is a no-op in that case, so a
-- column only declared in the CREATE statement would never actually land.
alter table public.triumph_packages add column if not exists slug text;

-- Backfills slug for rows inserted by an earlier run of this file's seed
-- below, before this column existed. Matches by name (the seed names were
-- unique at the time) and only fills genuinely-empty slugs, so it's a
-- no-op on a fresh install where the seed insert runs with slug already set.
update public.triumph_packages set slug = 'mastering'
  where slug is null and name = 'Mastering';
update public.triumph_packages set slug = 'mix-master-bundle'
  where slug is null and name = 'Mix + Master Bundle';
update public.triumph_packages set slug = 'express-mix-master'
  where slug is null and name = 'Express Mix & Master';
update public.triumph_packages set slug = 'post-production-add-ons'
  where slug is null and name = 'Post-Production Add-Ons';

alter table public.triumph_packages alter column slug set not null;

create unique index if not exists triumph_packages_slug_key
  on public.triumph_packages (slug);

comment on table public.triumph_packages is
  'Owner-managed Triumph Music Global pricing tiers, shown on /triumph''s '
  'pricing section (components/triumph/pricing.tsx). Replaces the static '
  'TRIUMPH_PRICING_TIERS array formerly in lib/data/triumph-pricing.ts. No '
  'relationship to public.services or bookings — Triumph pricing is '
  'purely informational display, same as it was as a static array.';

comment on column public.triumph_packages.price_usd is
  'Whole-dollar price (not cents) — every tier price seen so far is a round '
  'dollar amount (e.g. 250, 300, 75, 80), unlike services.price_kobo which '
  'needs sub-unit precision for NGN.';

comment on column public.triumph_packages.active is
  'Inactive tiers are hidden from the public /triumph page but kept in the '
  'admin list (soft-hide, not delete) — mirrors how a tier might be '
  'paused without losing its configured copy.';

alter table public.triumph_packages enable row level security;

create index if not exists triumph_packages_display_order_idx
  on public.triumph_packages (display_order);

drop trigger if exists triumph_packages_set_updated_at on public.triumph_packages;

create trigger triumph_packages_set_updated_at
  before update on public.triumph_packages
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: "deny by default, grant narrowly" (0010_rls_policies.sql convention).
-- Public select is scoped to active=true only (unlike equipment_items,
-- where every row is customer-relevant) — admin uses a separate
-- authenticated+is_admin() policy to also see inactive rows.
-- ---------------------------------------------------------------------------
drop policy if exists "triumph_packages_select_public" on public.triumph_packages;
create policy "triumph_packages_select_public"
  on public.triumph_packages
  for select
  to anon, authenticated
  using (active = true);

drop policy if exists "triumph_packages_select_admin" on public.triumph_packages;
create policy "triumph_packages_select_admin"
  on public.triumph_packages
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "triumph_packages_insert_admin" on public.triumph_packages;
create policy "triumph_packages_insert_admin"
  on public.triumph_packages
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "triumph_packages_update_admin" on public.triumph_packages;
create policy "triumph_packages_update_admin"
  on public.triumph_packages
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "triumph_packages_delete_admin" on public.triumph_packages;
create policy "triumph_packages_delete_admin"
  on public.triumph_packages
  for delete
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Seed: the real tiers the client shared over WhatsApp, replacing the old
-- placeholder TRIUMPH_PRICING_TIERS figures. on conflict targets the slug
-- unique index above, so re-running this file (e.g. the backfill path
-- above) never duplicates rows that already exist.
-- ---------------------------------------------------------------------------
insert into public.triumph_packages (slug, name, price_usd, unit, description, turnaround, featured, display_order)
values
  ('mastering', 'Mastering', 75, '/song', 'Tonal correction, loudness optimization, radio-ready.', '3 working days (5-day queue)', false, 0),
  ('mix-master-bundle', 'Mix + Master Bundle', 250, '/song', 'Full mixing plus stereo mastering, radio-ready.', '3 working days (5-day queue)', true, 1),
  ('express-mix-master', 'Express Mix & Master', 300, '/song', 'Mixing and mastering, vocal tuning, dynamics & FX, on a tighter turnaround.', '24-hour queue', false, 2),
  ('post-production-add-ons', 'Post-Production Add-Ons', 80, '/song', 'Additional instrumentation, arrangement, orchestration.', '24-hour turnaround', false, 3)
on conflict (slug) do nothing;
