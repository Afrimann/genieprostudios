-- 0020_addon_song_details.sql
-- Real requirement clarified by the client (2026-09-28): the per-song addon
-- services (Mixing & Mastering, Mix + Master Bundle — see 0002_services.sql)
-- are genuinely priced per song, and the studio needs the actual audio files
-- to do the work, not just a booking row. create_addon_booking (0019) always
-- charged a single per-song price regardless of how many songs the customer
-- actually has, and there was no mechanism at all for handing over files.
--
-- This migration: (1) adds contact_name/contact_email to bookings (collected
-- once per addon order — the account holder isn't always who the studio
-- should reach about the mix), (2) adds booking_tracks, one row per song
-- (title + uploaded file), (3) adds a private storage bucket for the actual
-- WAV files with RLS scoping uploads/reads to the owning customer (plus
-- admin read), and (4) replaces create_addon_booking to take a song count
-- and contact info, pricing the booking at price_kobo * song_count.

-- ---------------------------------------------------------------------------
-- 1. bookings: contact info for addon orders
-- ---------------------------------------------------------------------------
alter table public.bookings
  add column contact_name text,
  add column contact_email text;

comment on column public.bookings.contact_name is
  'Order contact name, collected once per order. Populated only by '
  'create_addon_booking (per-song orders) — null for room bookings, which '
  'already have the customer''s profile.';
comment on column public.bookings.contact_email is
  'Order contact email, collected once per order. Same nullability as '
  'contact_name above.';

-- ---------------------------------------------------------------------------
-- 2. booking_tracks: one row per song in an addon order
-- ---------------------------------------------------------------------------
create table public.booking_tracks (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  position smallint not null,
  title text not null,
  file_path text not null,
  file_name text not null,
  created_at timestamptz not null default now(),
  unique (booking_id, position)
);

comment on table public.booking_tracks is
  'One row per song submitted with an addon (per-song) booking — track '
  'title plus a pointer to the uploaded WAV file in the track-uploads '
  'storage bucket. Never populated for a room booking.';
comment on column public.booking_tracks.file_path is
  'Object path within the track-uploads storage bucket, of the form '
  '{customer_id}/{booking_id}/{position}-{sanitized file name}.';

alter table public.booking_tracks enable row level security;

create policy "booking_tracks_select_own"
  on public.booking_tracks
  for select
  to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_tracks.booking_id
        and b.customer_id = auth.uid()
    )
  );

create policy "booking_tracks_select_admin"
  on public.booking_tracks
  for select
  to authenticated
  using (public.is_admin());

-- Only while the booking is still pending_deposit, so a paid booking's track
-- list can't be altered after the fact (mirrors booking_tracks_insert_own's
-- purpose: this is the studio's record of what they agreed to work on).
create policy "booking_tracks_insert_own"
  on public.booking_tracks
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.bookings b
      where b.id = booking_tracks.booking_id
        and b.customer_id = auth.uid()
        and b.status = 'pending_deposit'
    )
  );

-- ---------------------------------------------------------------------------
-- 3. Storage: private bucket for uploaded track files
-- ---------------------------------------------------------------------------
-- NOTE: Supabase's Free tier hard-caps individual uploads at 50MB regardless
-- of this bucket's file_size_limit — if real WAV files exceed that, the
-- project needs to be on a paid plan (Storage settings -> upload size limit).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'track-uploads',
  'track-uploads',
  false,
  209715200, -- 200MB
  array['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave']
)
on conflict (id) do nothing;

-- Customers can only reach their own folder (first path segment = their
-- auth.uid()), matching the {customer_id}/{booking_id}/... path convention
-- documented on booking_tracks.file_path above.
create policy "track_uploads_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'track-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "track_uploads_select_own"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'track-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Lets the admin generate signed download URLs via the normal cookie-scoped
-- server client (supabase.storage...createSignedUrl), consistent with how
-- every other admin read in this project goes through RLS + is_admin()
-- rather than the service-role client (see admin-booking-repository.ts).
create policy "track_uploads_select_admin"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'track-uploads'
    and public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- 4. create_addon_booking: now takes song count + contact info
-- ---------------------------------------------------------------------------
drop function if exists public.create_addon_booking(uuid);

create or replace function public.create_addon_booking(
  p_service_id uuid,
  p_song_count integer,
  p_contact_name text,
  p_contact_email text
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service public.services;
  v_total_kobo bigint;
  v_deposit_kobo bigint;
  v_booking public.bookings;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  select *
  into v_service
  from public.services
  where id = p_service_id
    and active = true;

  if v_service is null then
    raise exception 'invalid_service';
  end if;

  if v_service.is_addon is not true then
    raise exception 'not_an_addon';
  end if;

  if p_song_count is null or p_song_count < 1 then
    raise exception 'invalid_song_count';
  end if;

  if p_contact_name is null or length(trim(p_contact_name)) = 0
     or p_contact_email is null or length(trim(p_contact_email)) = 0 then
    raise exception 'invalid_contact';
  end if;

  v_total_kobo := v_service.price_kobo * p_song_count;
  v_deposit_kobo := ceil(v_total_kobo * 0.7);

  insert into public.bookings (
    customer_id,
    service_id,
    slot_id,
    session_date,
    session_start_time,
    session_end_time,
    contact_name,
    contact_email,
    total_price_kobo,
    deposit_amount_kobo,
    status
  )
  values (
    auth.uid(),
    p_service_id,
    null,
    null,
    null,
    null,
    trim(p_contact_name),
    trim(p_contact_email),
    v_total_kobo,
    v_deposit_kobo,
    'pending_deposit'
  )
  returning * into v_booking;

  return v_booking;
end;
$$;

comment on function public.create_addon_booking(uuid, integer, text, text) is
  'Customer-facing SECURITY DEFINER RPC: creates a bookings row for an '
  'is_addon service priced at price_kobo * p_song_count, with no studio '
  'room time reserved and contact_name/contact_email recorded. '
  'customer_id is always auth.uid(), never a parameter. Raises: '
  '''auth_required'', ''invalid_service'', ''not_an_addon'', '
  '''invalid_song_count'' (< 1), ''invalid_contact'' (blank name/email). '
  'Individual songs are recorded separately in booking_tracks, one row per '
  'song, inserted by the client after this RPC returns.';

revoke all on function public.create_addon_booking(uuid, integer, text, text) from public;
revoke all on function public.create_addon_booking(uuid, integer, text, text) from anon;
grant execute on function public.create_addon_booking(uuid, integer, text, text) to authenticated;
