-- Owner-supplied Video Shoot / Extra-Curricular Activities hourly rates.
-- Prices are stored in kobo (NGN * 100), consistent with public.services.

insert into public.service_packages (slug, title, subtitle, display_order, active)
values (
  'video-shoot-extra-curricular-activities',
  'Video Shoot / Extra-Curricular Activities',
  'Hourly video shoot and extra-curricular activity sessions',
  7,
  true
)
on conflict (slug) do update set
  title = excluded.title,
  subtitle = excluded.subtitle,
  display_order = excluded.display_order,
  active = true;

insert into public.service_categories (
  category, package_id, label, description, display_order, active
)
select
  'video_shoot_extra_curricular_activities',
  p.id,
  'Video Shoot / Extra-Curricular Activities',
  'Hourly video shoot and extra-curricular activity sessions.',
  0,
  true
from public.service_packages p
where p.slug = 'video-shoot-extra-curricular-activities'
on conflict (category) do update set
  package_id = excluded.package_id,
  label = excluded.label,
  description = excluded.description,
  display_order = excluded.display_order,
  active = true;

-- Retain any existing service IDs and booking references. The duration is the
-- stable key within this category; only missing hourly tiers are inserted.
update public.services s
set label = 'Video Shoot / Extra-Curricular Activities — ' || expected.duration_hours || 'hr',
    price_kobo = expected.price_kobo,
    is_addon = false,
    active = true
from (values
  (1::numeric,  3000000::bigint),
  (2::numeric,  6000000::bigint),
  (3::numeric,  8000000::bigint),
  (4::numeric, 10000000::bigint),
  (5::numeric, 12500000::bigint),
  (6::numeric, 15000000::bigint)
) as expected(duration_hours, price_kobo)
where s.category = 'video_shoot_extra_curricular_activities'
  and s.duration_hours = expected.duration_hours;

insert into public.services (
  category, label, duration_hours, price_kobo, is_addon, active
)
select
  'video_shoot_extra_curricular_activities',
  'Video Shoot / Extra-Curricular Activities — ' || seed.duration_hours || 'hr',
  seed.duration_hours,
  seed.price_kobo,
  false,
  true
from (values
  (1::numeric,  3000000::bigint),
  (2::numeric,  6000000::bigint),
  (3::numeric,  8000000::bigint),
  (4::numeric, 10000000::bigint),
  (5::numeric, 12500000::bigint),
  (6::numeric, 15000000::bigint)
) as seed(duration_hours, price_kobo)
where not exists (
  select 1
  from public.services s
  where s.category = 'video_shoot_extra_curricular_activities'
    and s.duration_hours = seed.duration_hours
);

-- Fail explicitly if a pre-existing duplicate or incorrect rate would make
-- the public booking catalog ambiguous or expose a non-approved price.
do $$
begin
  if exists (
    select 1
    from (values
      (1::numeric,  3000000::bigint),
      (2::numeric,  6000000::bigint),
      (3::numeric,  8000000::bigint),
      (4::numeric, 10000000::bigint),
      (5::numeric, 12500000::bigint),
      (6::numeric, 15000000::bigint)
    ) as expected(duration_hours, price_kobo)
    left join public.services s
      on s.category = 'video_shoot_extra_curricular_activities'
      and s.duration_hours = expected.duration_hours
    group by expected.duration_hours, expected.price_kobo
    having count(s.id) <> 1
      or min(s.price_kobo) is distinct from expected.price_kobo
  ) then
    raise exception 'Video Shoot / Extra-Curricular Activities rates must contain exactly one service at each approved 1–6 hour price';
  end if;

  if (
    select count(*)
    from public.services
    where category = 'video_shoot_extra_curricular_activities'
  ) <> 6 then
    raise exception 'Video Shoot / Extra-Curricular Activities must contain exactly six hourly service rates';
  end if;
end;
$$;
