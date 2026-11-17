-- Apply the approved customer-facing package names and exact per-song/track
-- rates while retaining existing service rows (and therefore booking history).
-- Prices use kobo (NGN * 100). No bundled discount is applied.

update public.service_packages
set title = 'Stereo Recording Session',
    subtitle = 'Stereo recording & full stage lighting'
where slug = 'virtual-session';

update public.service_packages
set title = 'Mix and Master Bundle',
    subtitle = 'Per-song mix and master bundle'
where slug = 'mix-master-bundle';

update public.service_packages
set title = 'Post-Production Add-ons',
    subtitle = 'Mixing and mastering, priced per song'
where slug = 'post-production-addon';

insert into public.service_packages (slug, title, subtitle, display_order)
values (
  'digital-production',
  'Digital Production',
  'Digital production with mixing and mastering included; priced per track',
  6
)
on conflict (slug) do update set
  title = excluded.title,
  subtitle = excluded.subtitle,
  display_order = excluded.display_order;

update public.service_categories
set label = case category
      when 'virtual_package_day' then 'Stereo Recording Session — Day'
      when 'virtual_package_night' then 'Stereo Recording Session — Night'
    end,
    description = case category
      when 'virtual_package_day' then 'Stereo recording and full stage lighting for daytime sessions.'
      when 'virtual_package_night' then 'Stereo recording and full stage lighting for evening sessions.'
    end
where category in ('virtual_package_day', 'virtual_package_night');

-- Keep the existing bundle category and service row, but move the old generic
-- post-production category to the distinct Mix and Master Bundle offer.
update public.service_categories c
set package_id = p.id,
    label = 'Mix and Master Bundle',
    description = 'Mix and master bundle, priced per song.'
from public.service_packages p
where c.category = 'post_production'
  and p.slug = 'mix-master-bundle';

insert into public.service_categories (
  category, package_id, label, description, display_order, active
)
select
  'post_production_addons',
  p.id,
  'Post-Production Add-ons',
  'Mixing and mastering, priced per song.',
  0,
  true
from public.service_packages p
where p.slug = 'post-production-addon'
on conflict (category) do update set
  package_id = excluded.package_id,
  label = excluded.label,
  description = excluded.description,
  display_order = excluded.display_order,
  active = true;

insert into public.service_categories (
  category, package_id, label, description, display_order, active
)
select
  'digital_production',
  p.id,
  'Digital Production',
  'Digital production including mixing and mastering, priced per track.',
  0,
  true
from public.service_packages p
where p.slug = 'digital-production'
on conflict (category) do update set
  package_id = excluded.package_id,
  label = excluded.label,
  description = excluded.description,
  display_order = excluded.display_order,
  active = true;

-- Reprice the existing service rows in place so historical bookings keep
-- pointing at the same service IDs. Identify the second add-on by exclusion
-- from the bundle rather than its editable display label. If that legacy row
-- is absent, create the approved add-on instead of leaving it unavailable.
do $$
declare
  v_bundle_count integer;
  v_addon_count integer;
  v_bundle_id uuid;
  v_addon_id uuid;
begin
  select count(*)
  into v_bundle_count
  from public.services
  where category = 'post_production'
    and is_addon = true
    and (
      label ilike 'Mix + Master Bundle%'
      or label ilike 'Mix and Master Bundle%'
    );

  if v_bundle_count <> 1 then
    raise exception 'pricing migration expected one existing Mix and Master Bundle service, found %',
      v_bundle_count;
  end if;

  select id
  into v_bundle_id
  from public.services
  where category = 'post_production'
    and is_addon = true
    and (
      label ilike 'Mix + Master Bundle%'
      or label ilike 'Mix and Master Bundle%'
    )
  limit 1;

  update public.services
  set label = 'Mix and Master Bundle (per song)',
      price_kobo = 15000000
  where id = v_bundle_id;
  get diagnostics v_bundle_count = row_count;

  if v_bundle_count <> 1 then
    raise exception 'pricing migration expected one existing Mix and Master Bundle service, found %',
      v_bundle_count;
  end if;

  select count(*)
  into v_addon_count
  from public.services
  where category in ('post_production', 'post_production_addons')
    and is_addon = true
    and id <> v_bundle_id;

  if v_addon_count > 1 then
    raise exception 'pricing migration expected at most one existing Post-Production Add-on service, found %',
      v_addon_count;
  end if;

  if v_addon_count = 1 then
    select id
    into v_addon_id
    from public.services
    where category in ('post_production', 'post_production_addons')
      and is_addon = true
      and id <> v_bundle_id
    limit 1;

    update public.services
    set category = 'post_production_addons',
        label = 'Mixing & Mastering (per song)',
        price_kobo = 8000000,
        duration_hours = 0,
        active = true
    where id = v_addon_id;
  else
    insert into public.services (
      category, label, duration_hours, price_kobo, is_addon, active
    )
    values (
      'post_production_addons',
      'Mixing & Mastering (per song)',
      0,
      8000000,
      true,
      true
    );
  end if;
end;
$$;

insert into public.services (
  category, label, duration_hours, price_kobo, is_addon, active
)
select
  'digital_production',
  'Digital Production (per track)',
  0,
  25000000,
  true,
  true
where not exists (
  select 1
  from public.services
  where category = 'digital_production'
    and is_addon = true
    and label = 'Digital Production (per track)'
);

-- Video Shoot / Extra-Curricular Activities rates are added separately in
-- 0045_video_shoot_extra_curricular_rates.sql.
