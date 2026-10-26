-- Owner-managed service catalog metadata. Existing service IDs, prices and
-- booking references stay in public.services; categories attach those rates
-- to the public package cards shown on /services and /book.

create table if not exists public.service_packages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  subtitle text,
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_categories (
  category text primary key,
  package_id uuid not null references public.service_packages (id) on delete restrict,
  label text not null,
  description text not null default '',
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_package_features (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.service_packages (id) on delete restrict,
  label text not null,
  included boolean not null default true,
  highlight boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists service_categories_package_order_idx
  on public.service_categories (package_id, display_order);
create index if not exists service_package_features_package_order_idx
  on public.service_package_features (package_id, display_order);

drop trigger if exists service_packages_set_updated_at on public.service_packages;
create trigger service_packages_set_updated_at
  before update on public.service_packages
  for each row execute function public.set_updated_at();

drop trigger if exists service_categories_set_updated_at on public.service_categories;
create trigger service_categories_set_updated_at
  before update on public.service_categories
  for each row execute function public.set_updated_at();

drop trigger if exists service_package_features_set_updated_at on public.service_package_features;
create trigger service_package_features_set_updated_at
  before update on public.service_package_features
  for each row execute function public.set_updated_at();

alter table public.service_packages enable row level security;
alter table public.service_categories enable row level security;
alter table public.service_package_features enable row level security;

drop policy if exists "service_packages_select_active_public" on public.service_packages;
create policy "service_packages_select_active_public"
  on public.service_packages for select to anon, authenticated using (active = true);
drop policy if exists "service_packages_select_admin" on public.service_packages;
create policy "service_packages_select_admin"
  on public.service_packages for select to authenticated using (public.is_admin());
drop policy if exists "service_packages_insert_admin" on public.service_packages;
create policy "service_packages_insert_admin"
  on public.service_packages for insert to authenticated with check (public.is_admin());
drop policy if exists "service_packages_update_admin" on public.service_packages;
create policy "service_packages_update_admin"
  on public.service_packages for update to authenticated using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "service_categories_select_active_public" on public.service_categories;
create policy "service_categories_select_active_public"
  on public.service_categories for select to anon, authenticated using (
    active = true and exists (
      select 1 from public.service_packages p
      where p.id = package_id and p.active = true
    )
  );
drop policy if exists "service_categories_select_admin" on public.service_categories;
create policy "service_categories_select_admin"
  on public.service_categories for select to authenticated using (public.is_admin());
drop policy if exists "service_categories_insert_admin" on public.service_categories;
create policy "service_categories_insert_admin"
  on public.service_categories for insert to authenticated with check (public.is_admin());
drop policy if exists "service_categories_update_admin" on public.service_categories;
create policy "service_categories_update_admin"
  on public.service_categories for update to authenticated using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "service_package_features_select_active_public" on public.service_package_features;
create policy "service_package_features_select_active_public"
  on public.service_package_features for select to anon, authenticated using (
    exists (
      select 1 from public.service_packages p
      where p.id = package_id and p.active = true
    )
  );
drop policy if exists "service_package_features_select_admin" on public.service_package_features;
create policy "service_package_features_select_admin"
  on public.service_package_features for select to authenticated using (public.is_admin());
drop policy if exists "service_package_features_insert_admin" on public.service_package_features;
create policy "service_package_features_insert_admin"
  on public.service_package_features for insert to authenticated with check (public.is_admin());
drop policy if exists "service_package_features_update_admin" on public.service_package_features;
create policy "service_package_features_update_admin"
  on public.service_package_features for update to authenticated using (public.is_admin())
  with check (public.is_admin());
drop policy if exists "service_package_features_delete_admin" on public.service_package_features;
create policy "service_package_features_delete_admin"
  on public.service_package_features for delete to authenticated using (public.is_admin());

insert into public.service_packages (slug, title, subtitle, display_order)
values
  ('video-livestream', '1 iPhone Camera Angle Video Livestream', '1080p quality stream', 0),
  ('rehearsal', 'Rehearsal Session', 'Stereo recording & basic studio lighting', 1),
  ('multitrack', 'Multitrack Recording', 'Stereo & multitrack recording', 2),
  ('virtual-session', 'Virtual Session', 'Stereo recording & full stage lighting', 3),
  ('mix-master-bundle', 'Mix + Master Bundle', '(20 mins per song)', 4),
  ('post-production-addon', 'Post Production Add-on', 'Mixing and mastering add-on', 5)
on conflict (slug) do update set
  title = excluded.title,
  subtitle = excluded.subtitle,
  display_order = excluded.display_order;

insert into public.service_categories (category, package_id, label, description, display_order)
select seed.category, p.id, seed.label, seed.description, seed.display_order
from (values
  ('video_livestream_day', 'video-livestream', 'Video Livestream', 'Single-angle livestream setup for your performance or service.', 0),
  ('rehearsal_day', 'rehearsal', 'Rehearsal Sessions — Day', 'Band or solo rehearsal time in a fully equipped room, booked by the hour.', 0),
  ('rehearsal_night', 'rehearsal', 'Rehearsal Sessions — Night', 'The same rehearsal space, at after-hours rates for late sessions.', 1),
  ('multitrack_day', 'multitrack', 'Multi-track Recording — Day', 'Full multi-track recording with isolated inputs for every instrument and vocal.', 0),
  ('multitrack_night', 'multitrack', 'Multi-track Recording — Night', 'Multi-track recording booked for evening and late sessions.', 1),
  ('virtual_package_day', 'virtual-session', 'Virtual Package — Day', 'Multi-platform livestream package, built for Facebook and YouTube Live.', 0),
  ('virtual_package_night', 'virtual-session', 'Virtual Package — Night', 'Virtual package rates for evening broadcasts.', 1),
  ('post_production', 'post-production-addon', 'Post-Production Add-ons', 'Mixing and mastering for songs recorded here or sent in remotely.', 0)
) as seed(category, package_slug, label, description, display_order)
join public.service_packages p on p.slug = seed.package_slug
on conflict (category) do update set
  package_id = excluded.package_id,
  label = excluded.label,
  description = excluded.description,
  display_order = excluded.display_order;

insert into public.service_package_features (package_id, label, included, highlight, display_order)
select p.id, seed.label, seed.included, seed.highlight, seed.display_order
from (values
  ('video-livestream', 'One camera angle streaming to multiple platforms', true, false, 0),
  ('video-livestream', 'Recorded stream video', true, false, 1),
  ('video-livestream', 'Login details and flyer display are not provided — please bring your own', false, false, 2),
  ('rehearsal', 'Stereo recording', true, false, 0),
  ('rehearsal', 'Setup time 30 minutes before your allocated time', true, false, 1),
  ('rehearsal', 'Access to studio facilities', true, false, 2),
  ('rehearsal', 'Basic studio lighting', true, false, 3),
  ('rehearsal', 'Video streaming services', false, false, 4),
  ('rehearsal', 'Videography', false, false, 5),
  ('rehearsal', 'Mixing & mastering', false, false, 6),
  ('multitrack', 'Stereo recording', true, false, 0),
  ('multitrack', 'Multitrack recording', true, false, 1),
  ('multitrack', 'Access to studio facilities', true, false, 2),
  ('multitrack', 'Full studio lighting', true, false, 3),
  ('multitrack', 'Raw files', true, false, 4),
  ('multitrack', 'Videography', false, false, 5),
  ('multitrack', 'Mixing & mastering', false, false, 6),
  ('virtual-session', 'Stereo recording', true, false, 0),
  ('virtual-session', 'Access to studio facilities', true, false, 1),
  ('virtual-session', 'Full stage lighting', true, false, 2),
  ('virtual-session', 'Video streaming services', false, false, 3),
  ('virtual-session', 'Videography', false, false, 4),
  ('virtual-session', 'Mixing & mastering', false, false, 5),
  ('mix-master-bundle', '5-day queue after deposit', true, false, 0),
  ('mix-master-bundle', '3 working days once started', true, true, 1),
  ('mix-master-bundle', 'Full mixing service', true, true, 2),
  ('mix-master-bundle', 'Professional vocal tuning', true, true, 3),
  ('mix-master-bundle', 'Dynamics & FX processing', true, true, 4),
  ('mix-master-bundle', 'Stereo mastering', true, true, 5),
  ('mix-master-bundle', 'Loudness optimization', true, true, 6),
  ('mix-master-bundle', 'Radio-ready output', true, true, 7),
  ('mix-master-bundle', 'The complete release-ready package', true, false, 8),
  ('post-production-addon', '24-hour turnaround', true, false, 0),
  ('post-production-addon', 'Additional instrumentation', true, true, 1),
  ('post-production-addon', 'Auxiliary arrangement', true, true, 2),
  ('post-production-addon', 'Electronic orchestration', true, true, 3),
  ('post-production-addon', 'Production enhancement', true, true, 4),
  ('post-production-addon', 'Available as an add-on to your mixing project', true, false, 5)
) as seed(package_slug, label, included, highlight, display_order)
join public.service_packages p on p.slug = seed.package_slug
where not exists (
  select 1
  from public.service_package_features f
  where f.package_id = p.id and f.label = seed.label
);

alter table public.services
  add constraint services_category_catalog_fk
  foreign key (category) references public.service_categories (category)
  on update cascade on delete restrict;

-- Service rows are referenced by booking history. Keep the admin archive
-- workflow as the supported removal path rather than permitting hard deletes.
drop policy if exists "services_delete_admin" on public.services;

create or replace function public.ensure_active_service_package_for_booking()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.services s
    join public.service_categories c on c.category = s.category
    join public.service_packages p on p.id = c.package_id
    where s.id = new.service_id
      and s.active
      and c.active
      and p.active
  ) then
    raise exception 'inactive_service' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists bookings_require_active_service_package on public.bookings;
create trigger bookings_require_active_service_package
  before insert on public.bookings
  for each row execute function public.ensure_active_service_package_for_booking();
