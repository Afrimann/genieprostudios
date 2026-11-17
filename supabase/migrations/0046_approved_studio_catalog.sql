-- Approved hourly catalog additions and revised rates.
-- Prices are NGN * 100 (kobo). Existing service IDs are updated in place so
-- booking references remain valid; missing duration tiers are inserted.

insert into public.service_packages (slug, title, subtitle, display_order, active)
values
  (
    'stereo-recording-streaming',
    'Stereo Recording Session + 1-Camera Streaming',
    'Stereo recording and one-camera livestreaming; listed prices are all-in totals',
    8,
    true
  ),
  (
    'acoustic-spontaneous-live-studio-cover',
    'Acoustic / Spontaneous Live Studio Cover Session',
    'One-hour live studio cover session with mix, master, and clean iPhone video',
    9,
    true
  ),
  (
    'digital-acoustic-spontaneous-session',
    'Digital Acoustic / Spontaneous Session',
    'One-hour digital acoustic or spontaneous session with mix, master, and clean iPhone video',
    10,
    true
  ),
  (
    'worship-medley-multitrack',
    'Worship Medley Multitrack',
    'One-hour multitrack worship medley session with mix, master, and clean iPhone video',
    11,
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
select seed.category, p.id, seed.label, seed.description, seed.display_order, true
from (values
  (
    'stereo_recording_streaming_day',
    'stereo-recording-streaming',
    'Stereo Recording Session + 1-Camera Streaming — Day',
    'Day session combining stereo recording with one-camera streaming. Prices are exact all-in totals.',
    0
  ),
  (
    'stereo_recording_streaming_night',
    'stereo-recording-streaming',
    'Stereo Recording Session + 1-Camera Streaming — Night',
    'Night session combining stereo recording with one-camera streaming. Prices are exact all-in totals.',
    1
  ),
  (
    'acoustic_spontaneous_live_studio_cover',
    'acoustic-spontaneous-live-studio-cover',
    'Acoustic / Spontaneous Live Studio Cover Session',
    'One-hour session includes mix and master, clean iPhone video, and a 10–15 minute mixed audio/video output.',
    0
  ),
  (
    'digital_acoustic_spontaneous',
    'digital-acoustic-spontaneous-session',
    'Digital Acoustic / Spontaneous Session',
    'One-hour session includes mix and master, clean iPhone video, and a 10–15 minute mixed audio/video output.',
    0
  ),
  (
    'worship_medley_multitrack',
    'worship-medley-multitrack',
    'Worship Medley Multitrack',
    'One-hour multitrack session includes mix and master and clean iPhone video.',
    0
  )
) as seed(category, package_slug, label, description, display_order)
join public.service_packages p on p.slug = seed.package_slug
on conflict (category) do update set
  package_id = excluded.package_id,
  label = excluded.label,
  description = excluded.description,
  display_order = excluded.display_order,
  active = true;

insert into public.service_package_features (package_id, label, included, highlight, display_order)
select p.id, seed.label, true, seed.highlight, seed.display_order
from (values
  ('stereo-recording-streaming', 'Stereo recording', false, 0),
  ('stereo-recording-streaming', 'One-camera streaming', false, 1),
  ('stereo-recording-streaming', 'All listed hourly prices are exact combined totals', true, 2),
  ('acoustic-spontaneous-live-studio-cover', 'Mix and master included', false, 0),
  ('acoustic-spontaneous-live-studio-cover', 'Clean iPhone video included', false, 1),
  ('acoustic-spontaneous-live-studio-cover', '10–15 minute mixed audio/video output included', true, 2),
  ('digital-acoustic-spontaneous-session', 'Mix and master included', false, 0),
  ('digital-acoustic-spontaneous-session', 'Clean iPhone video included', false, 1),
  ('digital-acoustic-spontaneous-session', '10–15 minute mixed audio/video output included', true, 2),
  ('worship-medley-multitrack', 'Multitrack recording', false, 0),
  ('worship-medley-multitrack', 'Mix and master included', false, 1),
  ('worship-medley-multitrack', 'Clean iPhone video included', true, 2)
) as seed(package_slug, label, highlight, display_order)
join public.service_packages p on p.slug = seed.package_slug
where not exists (
  select 1
  from public.service_package_features f
  where f.package_id = p.id and f.label = seed.label
);

-- Update existing duration rows first, then add only tiers not already present.
-- Categories and duration are the stable catalog keys; all are bookable
-- services (is_addon = false). The two post-production per-unit rates remain
-- add-ons with duration_hours = 0.
update public.services s
set label = seed.label,
    price_kobo = seed.price_kobo,
    is_addon = seed.is_addon,
    active = true
from (values
  ('rehearsal_day', 'Rehearsal Day — 1hr', 1::numeric, 3000000::bigint, false),
  ('rehearsal_day', 'Rehearsal Day — 2hrs', 2::numeric, 6000000::bigint, false),
  ('rehearsal_day', 'Rehearsal Day — 3hrs', 3::numeric, 8000000::bigint, false),
  ('rehearsal_day', 'Rehearsal Day — 4hrs', 4::numeric, 10000000::bigint, false),
  ('rehearsal_day', 'Rehearsal Day — 5hrs', 5::numeric, 12500000::bigint, false),
  ('rehearsal_day', 'Rehearsal Day — 6hrs', 6::numeric, 15000000::bigint, false),
  ('rehearsal_night', 'Rehearsal Night — 4hrs', 4::numeric, 8000000::bigint, false),
  ('rehearsal_night', 'Rehearsal Night — 6hrs', 6::numeric, 10000000::bigint, false),
  ('multitrack_day', 'Multi-track Recording Day — 2hrs', 2::numeric, 10000000::bigint, false),
  ('multitrack_day', 'Multi-track Recording Day — 3hrs', 3::numeric, 15000000::bigint, false),
  ('multitrack_day', 'Multi-track Recording Day — 4hrs', 4::numeric, 18000000::bigint, false),
  ('multitrack_day', 'Multi-track Recording Day — 5hrs', 5::numeric, 22000000::bigint, false),
  ('multitrack_day', 'Multi-track Recording Day — 6hrs', 6::numeric, 25000000::bigint, false),
  ('multitrack_night', 'Multi-track Recording Night — 2hrs', 2::numeric, 10000000::bigint, false),
  ('multitrack_night', 'Multi-track Recording Night — 3hrs', 3::numeric, 15000000::bigint, false),
  ('multitrack_night', 'Multi-track Recording Night — 4hrs', 4::numeric, 18000000::bigint, false),
  ('multitrack_night', 'Multi-track Recording Night — 5hrs', 5::numeric, 22000000::bigint, false),
  ('multitrack_night', 'Multi-track Recording Night — 6hrs', 6::numeric, 25000000::bigint, false),
  ('virtual_package_day', 'Stereo Recording Session Day — 1hr', 1::numeric, 4000000::bigint, false),
  ('virtual_package_day', 'Stereo Recording Session Day — 2hrs', 2::numeric, 8000000::bigint, false),
  ('virtual_package_day', 'Stereo Recording Session Day — 3hrs', 3::numeric, 10000000::bigint, false),
  ('virtual_package_day', 'Stereo Recording Session Day — 4hrs', 4::numeric, 14000000::bigint, false),
  ('virtual_package_day', 'Stereo Recording Session Day — 5hrs', 5::numeric, 18000000::bigint, false),
  ('virtual_package_day', 'Stereo Recording Session Day — 6hrs', 6::numeric, 20000000::bigint, false),
  ('virtual_package_night', 'Stereo Recording Session Night — 1hr', 1::numeric, 4000000::bigint, false),
  ('virtual_package_night', 'Stereo Recording Session Night — 2hrs', 2::numeric, 8000000::bigint, false),
  ('virtual_package_night', 'Stereo Recording Session Night — 3hrs', 3::numeric, 10000000::bigint, false),
  ('virtual_package_night', 'Stereo Recording Session Night — 4hrs', 4::numeric, 14000000::bigint, false),
  ('virtual_package_night', 'Stereo Recording Session Night — 5hrs', 5::numeric, 18000000::bigint, false),
  ('virtual_package_night', 'Stereo Recording Session Night — 6hrs', 6::numeric, 20000000::bigint, false),
  ('stereo_recording_streaming_day', 'Stereo Recording + 1-Camera Streaming Day — 1hr', 1::numeric, 7000000::bigint, false),
  ('stereo_recording_streaming_day', 'Stereo Recording + 1-Camera Streaming Day — 2hrs', 2::numeric, 13000000::bigint, false),
  ('stereo_recording_streaming_day', 'Stereo Recording + 1-Camera Streaming Day — 3hrs', 3::numeric, 15000000::bigint, false),
  ('stereo_recording_streaming_day', 'Stereo Recording + 1-Camera Streaming Day — 4hrs', 4::numeric, 15000000::bigint, false),
  ('stereo_recording_streaming_day', 'Stereo Recording + 1-Camera Streaming Day — 5hrs', 5::numeric, 20000000::bigint, false),
  ('stereo_recording_streaming_day', 'Stereo Recording + 1-Camera Streaming Day — 6hrs', 6::numeric, 20000000::bigint, false),
  ('stereo_recording_streaming_night', 'Stereo Recording + 1-Camera Streaming Night — 1hr', 1::numeric, 7000000::bigint, false),
  ('stereo_recording_streaming_night', 'Stereo Recording + 1-Camera Streaming Night — 2hrs', 2::numeric, 13000000::bigint, false),
  ('stereo_recording_streaming_night', 'Stereo Recording + 1-Camera Streaming Night — 3hrs', 3::numeric, 15000000::bigint, false),
  ('stereo_recording_streaming_night', 'Stereo Recording + 1-Camera Streaming Night — 4hrs', 4::numeric, 15000000::bigint, false),
  ('stereo_recording_streaming_night', 'Stereo Recording + 1-Camera Streaming Night — 5hrs', 5::numeric, 20000000::bigint, false),
  ('stereo_recording_streaming_night', 'Stereo Recording + 1-Camera Streaming Night — 6hrs', 6::numeric, 20000000::bigint, false),
  ('acoustic_spontaneous_live_studio_cover', 'Acoustic / Spontaneous Live Studio Cover Session — 1hr', 1::numeric, 10000000::bigint, false),
  ('digital_acoustic_spontaneous', 'Digital Acoustic / Spontaneous Session — 1hr', 1::numeric, 5000000::bigint, false),
  ('worship_medley_multitrack', 'Worship Medley Multitrack — 1hr', 1::numeric, 20000000::bigint, false),
  ('digital_production', 'Digital Production (per track)', 0::numeric, 25000000::bigint, true),
  ('post_production', 'Mix and Master Bundle (per song)', 0::numeric, 15000000::bigint, true),
  ('post_production_addons', 'Mixing & Mastering (per song)', 0::numeric, 8000000::bigint, true)
) as seed(category, label, duration_hours, price_kobo, is_addon)
where s.category = seed.category
  and s.duration_hours = seed.duration_hours;

insert into public.services (category, label, duration_hours, price_kobo, is_addon, active)
select seed.category, seed.label, seed.duration_hours, seed.price_kobo, seed.is_addon, true
from (values
  ('rehearsal_day', 'Rehearsal Day — 1hr', 1::numeric, 3000000::bigint, false),
  ('rehearsal_day', 'Rehearsal Day — 2hrs', 2::numeric, 6000000::bigint, false),
  ('rehearsal_day', 'Rehearsal Day — 3hrs', 3::numeric, 8000000::bigint, false),
  ('rehearsal_day', 'Rehearsal Day — 4hrs', 4::numeric, 10000000::bigint, false),
  ('rehearsal_day', 'Rehearsal Day — 5hrs', 5::numeric, 12500000::bigint, false),
  ('rehearsal_day', 'Rehearsal Day — 6hrs', 6::numeric, 15000000::bigint, false),
  ('rehearsal_night', 'Rehearsal Night — 4hrs', 4::numeric, 8000000::bigint, false),
  ('rehearsal_night', 'Rehearsal Night — 6hrs', 6::numeric, 10000000::bigint, false),
  ('multitrack_day', 'Multi-track Recording Day — 2hrs', 2::numeric, 10000000::bigint, false),
  ('multitrack_day', 'Multi-track Recording Day — 3hrs', 3::numeric, 15000000::bigint, false),
  ('multitrack_day', 'Multi-track Recording Day — 4hrs', 4::numeric, 18000000::bigint, false),
  ('multitrack_day', 'Multi-track Recording Day — 5hrs', 5::numeric, 22000000::bigint, false),
  ('multitrack_day', 'Multi-track Recording Day — 6hrs', 6::numeric, 25000000::bigint, false),
  ('multitrack_night', 'Multi-track Recording Night — 2hrs', 2::numeric, 10000000::bigint, false),
  ('multitrack_night', 'Multi-track Recording Night — 3hrs', 3::numeric, 15000000::bigint, false),
  ('multitrack_night', 'Multi-track Recording Night — 4hrs', 4::numeric, 18000000::bigint, false),
  ('multitrack_night', 'Multi-track Recording Night — 5hrs', 5::numeric, 22000000::bigint, false),
  ('multitrack_night', 'Multi-track Recording Night — 6hrs', 6::numeric, 25000000::bigint, false),
  ('virtual_package_day', 'Stereo Recording Session Day — 1hr', 1::numeric, 4000000::bigint, false),
  ('virtual_package_day', 'Stereo Recording Session Day — 2hrs', 2::numeric, 8000000::bigint, false),
  ('virtual_package_day', 'Stereo Recording Session Day — 3hrs', 3::numeric, 10000000::bigint, false),
  ('virtual_package_day', 'Stereo Recording Session Day — 4hrs', 4::numeric, 14000000::bigint, false),
  ('virtual_package_day', 'Stereo Recording Session Day — 5hrs', 5::numeric, 18000000::bigint, false),
  ('virtual_package_day', 'Stereo Recording Session Day — 6hrs', 6::numeric, 20000000::bigint, false),
  ('virtual_package_night', 'Stereo Recording Session Night — 1hr', 1::numeric, 4000000::bigint, false),
  ('virtual_package_night', 'Stereo Recording Session Night — 2hrs', 2::numeric, 8000000::bigint, false),
  ('virtual_package_night', 'Stereo Recording Session Night — 3hrs', 3::numeric, 10000000::bigint, false),
  ('virtual_package_night', 'Stereo Recording Session Night — 4hrs', 4::numeric, 14000000::bigint, false),
  ('virtual_package_night', 'Stereo Recording Session Night — 5hrs', 5::numeric, 18000000::bigint, false),
  ('virtual_package_night', 'Stereo Recording Session Night — 6hrs', 6::numeric, 20000000::bigint, false),
  ('stereo_recording_streaming_day', 'Stereo Recording + 1-Camera Streaming Day — 1hr', 1::numeric, 7000000::bigint, false),
  ('stereo_recording_streaming_day', 'Stereo Recording + 1-Camera Streaming Day — 2hrs', 2::numeric, 13000000::bigint, false),
  ('stereo_recording_streaming_day', 'Stereo Recording + 1-Camera Streaming Day — 3hrs', 3::numeric, 15000000::bigint, false),
  ('stereo_recording_streaming_day', 'Stereo Recording + 1-Camera Streaming Day — 4hrs', 4::numeric, 15000000::bigint, false),
  ('stereo_recording_streaming_day', 'Stereo Recording + 1-Camera Streaming Day — 5hrs', 5::numeric, 20000000::bigint, false),
  ('stereo_recording_streaming_day', 'Stereo Recording + 1-Camera Streaming Day — 6hrs', 6::numeric, 20000000::bigint, false),
  ('stereo_recording_streaming_night', 'Stereo Recording + 1-Camera Streaming Night — 1hr', 1::numeric, 7000000::bigint, false),
  ('stereo_recording_streaming_night', 'Stereo Recording + 1-Camera Streaming Night — 2hrs', 2::numeric, 13000000::bigint, false),
  ('stereo_recording_streaming_night', 'Stereo Recording + 1-Camera Streaming Night — 3hrs', 3::numeric, 15000000::bigint, false),
  ('stereo_recording_streaming_night', 'Stereo Recording + 1-Camera Streaming Night — 4hrs', 4::numeric, 15000000::bigint, false),
  ('stereo_recording_streaming_night', 'Stereo Recording + 1-Camera Streaming Night — 5hrs', 5::numeric, 20000000::bigint, false),
  ('stereo_recording_streaming_night', 'Stereo Recording + 1-Camera Streaming Night — 6hrs', 6::numeric, 20000000::bigint, false),
  ('acoustic_spontaneous_live_studio_cover', 'Acoustic / Spontaneous Live Studio Cover Session — 1hr', 1::numeric, 10000000::bigint, false),
  ('digital_acoustic_spontaneous', 'Digital Acoustic / Spontaneous Session — 1hr', 1::numeric, 5000000::bigint, false),
  ('worship_medley_multitrack', 'Worship Medley Multitrack — 1hr', 1::numeric, 20000000::bigint, false),
  ('digital_production', 'Digital Production (per track)', 0::numeric, 25000000::bigint, true),
  ('post_production', 'Mix and Master Bundle (per song)', 0::numeric, 15000000::bigint, true),
  ('post_production_addons', 'Mixing & Mastering (per song)', 0::numeric, 8000000::bigint, true)
) as seed(category, label, duration_hours, price_kobo, is_addon)
where not exists (
  select 1
  from public.services s
  where s.category = seed.category
    and s.duration_hours = seed.duration_hours
);

-- Refuse to leave duplicate, absent, inactive, or incorrectly priced tiers.
do $$
declare
  v_bad_rate_count integer;
begin
  select count(*) into v_bad_rate_count
  from (values
    ('rehearsal_day', 1::numeric, 3000000::bigint, false),
    ('rehearsal_day', 2::numeric, 6000000::bigint, false),
    ('rehearsal_day', 3::numeric, 8000000::bigint, false),
    ('rehearsal_day', 4::numeric, 10000000::bigint, false),
    ('rehearsal_day', 5::numeric, 12500000::bigint, false),
    ('rehearsal_day', 6::numeric, 15000000::bigint, false),
    ('rehearsal_night', 4::numeric, 8000000::bigint, false),
    ('rehearsal_night', 6::numeric, 10000000::bigint, false),
    ('multitrack_day', 2::numeric, 10000000::bigint, false),
    ('multitrack_day', 3::numeric, 15000000::bigint, false),
    ('multitrack_day', 4::numeric, 18000000::bigint, false),
    ('multitrack_day', 5::numeric, 22000000::bigint, false),
    ('multitrack_day', 6::numeric, 25000000::bigint, false),
    ('multitrack_night', 2::numeric, 10000000::bigint, false),
    ('multitrack_night', 3::numeric, 15000000::bigint, false),
    ('multitrack_night', 4::numeric, 18000000::bigint, false),
    ('multitrack_night', 5::numeric, 22000000::bigint, false),
    ('multitrack_night', 6::numeric, 25000000::bigint, false),
    ('virtual_package_day', 1::numeric, 4000000::bigint, false),
    ('virtual_package_day', 2::numeric, 8000000::bigint, false),
    ('virtual_package_day', 3::numeric, 10000000::bigint, false),
    ('virtual_package_day', 4::numeric, 14000000::bigint, false),
    ('virtual_package_day', 5::numeric, 18000000::bigint, false),
    ('virtual_package_day', 6::numeric, 20000000::bigint, false),
    ('virtual_package_night', 1::numeric, 4000000::bigint, false),
    ('virtual_package_night', 2::numeric, 8000000::bigint, false),
    ('virtual_package_night', 3::numeric, 10000000::bigint, false),
    ('virtual_package_night', 4::numeric, 14000000::bigint, false),
    ('virtual_package_night', 5::numeric, 18000000::bigint, false),
    ('virtual_package_night', 6::numeric, 20000000::bigint, false),
    ('stereo_recording_streaming_day', 1::numeric, 7000000::bigint, false),
    ('stereo_recording_streaming_day', 2::numeric, 13000000::bigint, false),
    ('stereo_recording_streaming_day', 3::numeric, 15000000::bigint, false),
    ('stereo_recording_streaming_day', 4::numeric, 15000000::bigint, false),
    ('stereo_recording_streaming_day', 5::numeric, 20000000::bigint, false),
    ('stereo_recording_streaming_day', 6::numeric, 20000000::bigint, false),
    ('stereo_recording_streaming_night', 1::numeric, 7000000::bigint, false),
    ('stereo_recording_streaming_night', 2::numeric, 13000000::bigint, false),
    ('stereo_recording_streaming_night', 3::numeric, 15000000::bigint, false),
    ('stereo_recording_streaming_night', 4::numeric, 15000000::bigint, false),
    ('stereo_recording_streaming_night', 5::numeric, 20000000::bigint, false),
    ('stereo_recording_streaming_night', 6::numeric, 20000000::bigint, false),
    ('acoustic_spontaneous_live_studio_cover', 1::numeric, 10000000::bigint, false),
    ('digital_acoustic_spontaneous', 1::numeric, 5000000::bigint, false),
    ('worship_medley_multitrack', 1::numeric, 20000000::bigint, false),
    ('digital_production', 0::numeric, 25000000::bigint, true),
    ('post_production', 0::numeric, 15000000::bigint, true),
    ('post_production_addons', 0::numeric, 8000000::bigint, true)
  ) as expected(category, duration_hours, price_kobo, is_addon)
  left join public.services s
    on s.category = expected.category
    and s.duration_hours = expected.duration_hours
  group by expected.category, expected.duration_hours, expected.is_addon, expected.price_kobo
  having count(s.id) <> 1
    or min(s.price_kobo) is distinct from expected.price_kobo
    or bool_and(s.is_addon) is distinct from expected.is_addon
    or bool_and(s.active) is distinct from true;

  if v_bad_rate_count <> 0 then
    raise exception 'Approved studio catalog has % missing, duplicate, inactive, or incorrectly priced rates',
      v_bad_rate_count;
  end if;

  if exists (
    select 1
    from public.services
    where category in (
      'rehearsal_day', 'rehearsal_night',
      'multitrack_day', 'multitrack_night',
      'virtual_package_day', 'virtual_package_night',
      'stereo_recording_streaming_day', 'stereo_recording_streaming_night',
      'acoustic_spontaneous_live_studio_cover',
      'digital_acoustic_spontaneous',
      'worship_medley_multitrack'
    )
    group by category
    having count(*) <> case category
      when 'rehearsal_day' then 6
      when 'rehearsal_night' then 2
      when 'multitrack_day' then 5
      when 'multitrack_night' then 5
      when 'virtual_package_day' then 6
      when 'virtual_package_night' then 6
      when 'stereo_recording_streaming_day' then 6
      when 'stereo_recording_streaming_night' then 6
      else 1
    end
  ) then
    raise exception 'Approved hourly catalog categories contain unexpected extra service tiers';
  end if;
end;
$$;
