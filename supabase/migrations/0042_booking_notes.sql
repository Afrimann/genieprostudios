-- 0042_booking_notes.sql
-- Owner request (2026-10-21): while booking, a customer should be able to
-- write in a free-text box anything specific the studio needs to know for
-- their session, and the owner should see it on the admin booking detail
-- page. Adds a single nullable `notes` column to `bookings` and threads an
-- optional p_notes through both customer-facing creation RPCs (book_session,
-- create_addon_booking) so it's set atomically at insert time rather than
-- via a separate update (customers have no UPDATE policy on bookings at all,
-- see bookings_update_admin in 0010_rls_policies.sql — there is no
-- bookings_update_own to piggyback an update through).

alter table public.bookings
  add column if not exists notes text;

comment on column public.bookings.notes is
  'Free-text specifics the customer typed in during booking (e.g. "need an '
  'extra vocal mic", "running 10 min late") — optional, set once at booking '
  'creation via book_session/create_addon_booking''s p_notes. Shown on the '
  'admin booking detail page. Never written to after creation (no customer '
  'UPDATE policy on bookings).';

-- =============================================================================
-- book_session: add p_notes (default null) as a new trailing parameter.
-- A trailing parameter changes the function's arg-type signature, so
-- `create or replace` would create a second overload rather than replacing
-- the 3-arg version in place — drop the old signature first, same
-- "no stale version reachable alongside the new one" discipline as 0037.
-- =============================================================================
drop function if exists public.book_session(uuid, date, time);

create or replace function public.book_session(
  p_service_id uuid,
  p_date date,
  p_start_time time,
  p_notes text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service public.services;
  v_end_ts timestamp;
  v_end_date date;
  v_end_time time;
  v_deposit_kobo bigint;
  v_booking public.bookings;
  v_buffer_minutes constant int := 30;
  v_pending_hold_minutes constant int := 20;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  if extract(minute from p_start_time)::int not in (0, 30)
     or extract(second from p_start_time) <> 0 then
    raise exception 'invalid_start_time';
  end if;

  if (p_date + p_start_time) at time zone 'Africa/Lagos' <= now() then
    raise exception 'start_in_past';
  end if;

  select *
  into v_service
  from public.services
  where id = p_service_id
    and active = true;

  if v_service is null then
    raise exception 'invalid_service';
  end if;

  if v_service.is_addon is true then
    raise exception 'is_addon_service';
  end if;

  v_end_ts := (p_date + p_start_time)::timestamp + (v_service.duration_hours || ' hours')::interval;
  v_end_date := v_end_ts::date;
  v_end_time := v_end_ts::time;

  perform pg_advisory_xact_lock(hashtext(p_date::text));
  if v_end_date <> p_date then
    perform pg_advisory_xact_lock(hashtext(v_end_date::text));
  end if;

  if exists (
    select 1
    from public.blocked_time_ranges bt
    where bt.date in (p_date, v_end_date)
      and (
        (p_date + p_start_time)::timestamp - (v_buffer_minutes || ' minutes')::interval
      ) < (bt.date + bt.end_time)::timestamp
      and (
        v_end_ts + (v_buffer_minutes || ' minutes')::interval
      ) > (bt.date + bt.start_time)::timestamp
  ) then
    raise exception 'time_blocked';
  end if;

  if exists (
    select 1
    from public.bookings b
    where b.session_date between (p_date - 1) and v_end_date
      and b.status not in ('cancelled', 'auto_cancelled')
      and (
        b.status <> 'pending_deposit'
        or b.created_at >= now() - (v_pending_hold_minutes || ' minutes')::interval
      )
      and (
        (p_date + p_start_time)::timestamp - (v_buffer_minutes || ' minutes')::interval
      ) < (b.session_end_date + b.session_end_time)::timestamp
      and (
        v_end_ts + (v_buffer_minutes || ' minutes')::interval
      ) > (b.session_date + b.session_start_time)::timestamp
  ) then
    raise exception 'time_unavailable';
  end if;

  v_deposit_kobo := ceil(v_service.price_kobo * 0.7);

  insert into public.bookings (
    customer_id,
    service_id,
    session_date,
    session_start_time,
    session_end_date,
    session_end_time,
    total_price_kobo,
    deposit_amount_kobo,
    status,
    notes
  )
  values (
    auth.uid(),
    p_service_id,
    p_date,
    p_start_time,
    v_end_date,
    v_end_time,
    v_service.price_kobo,
    v_deposit_kobo,
    'pending_deposit',
    nullif(trim(p_notes), '')
  )
  returning * into v_booking;

  return v_booking;
end;
$$;

comment on function public.book_session(uuid, date, time, text) is
  'Customer-facing SECURITY DEFINER RPC: creates a bookings row for a '
  'customer-chosen date + start time, for a given (non-addon) service. '
  'p_notes (optional, 0042) is trimmed and stored as-is, blank/whitespace '
  'collapsing to null. See 0037_book_session.sql for the full validation '
  'chain (grid/past/block/overlap) and exception codes, unchanged here.';

revoke all on function public.book_session(uuid, date, time, text) from public;
revoke all on function public.book_session(uuid, date, time, text) from anon;
grant execute on function public.book_session(uuid, date, time, text) to authenticated;

-- =============================================================================
-- create_addon_booking: add p_notes (default null) as a new trailing
-- parameter, same drop-then-recreate convention as book_session above.
-- =============================================================================
drop function if exists public.create_addon_booking(uuid, integer, text, text);

create or replace function public.create_addon_booking(
  p_service_id uuid,
  p_song_count int,
  p_contact_name text,
  p_contact_email text,
  p_notes text default null
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
    status,
    notes
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
    'pending_deposit',
    nullif(trim(p_notes), '')
  )
  returning * into v_booking;

  return v_booking;
end;
$$;

comment on function public.create_addon_booking(uuid, integer, text, text, text) is
  'Customer-facing SECURITY DEFINER RPC: creates a bookings row for an '
  'is_addon service priced at price_kobo * p_song_count, with no studio '
  'room time reserved and contact_name/contact_email recorded. p_notes '
  '(optional, 0042) is trimmed and stored as-is, blank/whitespace collapsing '
  'to null. customer_id is always auth.uid(), never a parameter. Raises: '
  '''auth_required'', ''invalid_service'', ''not_an_addon'', '
  '''invalid_song_count'' (< 1), ''invalid_contact'' (blank name/email). '
  'Individual songs are recorded separately in booking_tracks, one row per '
  'song, inserted by the client after this RPC returns.';

revoke all on function public.create_addon_booking(uuid, integer, text, text, text) from public;
revoke all on function public.create_addon_booking(uuid, integer, text, text, text) from anon;
grant execute on function public.create_addon_booking(uuid, integer, text, text, text) to authenticated;
