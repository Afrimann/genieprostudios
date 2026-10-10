-- 0040_no_pending_hold.sql
-- Owner request (2026-10-10): a 'pending_deposit' booking (created but never
-- paid) must NEVER occupy/reserve studio time, not even for the 20-minute
-- grace window book_session/admin_reschedule_booking previously gave it
-- (v_pending_hold_minutes, 0037, carried over from 0018). A customer who
-- reaches the summary step, accepts the terms, and then backs out without
-- paying must not block anyone else from booking that time for any number
-- of minutes — "no number of minutes should time be saved for someone who
-- just accepted terms and turns back". Only 'deposited'/'paid_in_full'
-- (real money landed) should ever block a time range now; this is the same
-- exclusion cancelled/auto_cancelled already got, just widened to also
-- cover pending_deposit unconditionally instead of ageing it out.
--
-- No signature change on either function (same uuid/date/time params and
-- `public.bookings` return type), so `create or replace` is sufficient —
-- unlike 0038/0039, no `drop function` is needed first.

create or replace function public.book_session(
  p_service_id uuid,
  p_date date,
  p_start_time time
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
  v_buffer_minutes constant int := 30; -- must match SLOT_BUFFER_MINUTES in
    -- lib/services/availability-service.ts; if that constant ever changes,
    -- update this literal too.
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

  -- Overlap check against existing bookings — 'pending_deposit' never
  -- blocks, at any age (0040; previously it blocked for
  -- v_pending_hold_minutes after creation, 0018/0037). Only 'deposited' and
  -- 'paid_in_full' (real payment landed) count as occupying this time.
  if exists (
    select 1
    from public.bookings b
    where b.session_date between (p_date - 1) and v_end_date
      and b.status in ('deposited', 'paid_in_full')
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
    status
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
    'pending_deposit'
  )
  returning * into v_booking;

  return v_booking;
end;
$$;

comment on function public.book_session(uuid, date, time) is
  'Customer-facing SECURITY DEFINER RPC: creates a bookings row for a '
  'customer-chosen date + start time, for a given (non-addon) service. '
  'Every date is open by default — validates against blocked_time_ranges '
  '(admin-marked closures) rather than requiring a pre-opened window. '
  'Supports overnight sessions via plain timestamp arithmetic. Overlap '
  'check against existing bookings only ever considers ''deposited''/'
  '''paid_in_full'' rows (0040) — a ''pending_deposit'' booking never '
  'occupies time, for any duration, since no payment has landed on it yet. '
  'customer_id is always auth.uid(), never a parameter. Raises: '
  '''auth_required'', ''invalid_start_time'', ''start_in_past'', '
  '''invalid_service'', ''is_addon_service'', ''time_blocked'' (overlaps a '
  'blocked_time_ranges row), ''time_unavailable'' (overlaps an existing '
  'deposited/paid_in_full booking). Booking status always starts at '
  '''pending_deposit'' — this RPC never marks a booking confirmed/paid; '
  'that only happens via the Paystack webhook handler.';

revoke all on function public.book_session(uuid, date, time) from public;
revoke all on function public.book_session(uuid, date, time) from anon;
grant execute on function public.book_session(uuid, date, time) to authenticated;

-- ---------------------------------------------------------------------------
-- admin_reschedule_booking: same overlap-predicate change.
-- ---------------------------------------------------------------------------
create or replace function public.admin_reschedule_booking(
  p_booking_id uuid,
  p_date date,
  p_start_time time
)
returns public.bookings
language plpgsql
security invoker
as $$
declare
  v_booking public.bookings;
  v_service public.services;
  v_end_ts timestamp;
  v_end_date date;
  v_end_time time;
  v_buffer_minutes constant int := 30; -- must match SLOT_BUFFER_MINUTES in
    -- lib/services/availability-service.ts, same caveat as book_session's copy.
begin
  if not public.is_admin() then
    raise exception 'admin_required';
  end if;

  select *
  into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if v_booking is null then
    raise exception 'booking_not_found';
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
  where id = v_booking.service_id
    and active = true;

  if v_service is null then
    raise exception 'invalid_service';
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

  -- Same overlap predicate as book_session (0040): only deposited/paid_in_full
  -- bookings block, excluding the booking being moved itself.
  if exists (
    select 1
    from public.bookings b
    where b.session_date between (p_date - 1) and v_end_date
      and b.id <> p_booking_id
      and b.status in ('deposited', 'paid_in_full')
      and (
        (p_date + p_start_time)::timestamp - (v_buffer_minutes || ' minutes')::interval
      ) < (b.session_end_date + b.session_end_time)::timestamp
      and (
        v_end_ts + (v_buffer_minutes || ' minutes')::interval
      ) > (b.session_date + b.session_start_time)::timestamp
  ) then
    raise exception 'time_unavailable';
  end if;

  update public.bookings
  set session_date = p_date,
      session_start_time = p_start_time,
      session_end_date = v_end_date,
      session_end_time = v_end_time,
      status = case when v_booking.status = 'auto_cancelled' then 'deposited' else v_booking.status end
  where id = p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$$;

comment on function public.admin_reschedule_booking(uuid, date, time) is
  'Admin-only: moves an existing booking onto a new date/start time, '
  'validating grid/past/block/overlap exactly like book_session but as an '
  'UPDATE rather than an INSERT. Overlap check only considers deposited/'
  'paid_in_full bookings (0040) — pending_deposit never blocks. Reverts '
  'status from auto_cancelled back to deposited (the deposit already paid '
  'still counts); leaves any other status as-is. Raises: admin_required, '
  'booking_not_found, invalid_start_time, start_in_past, invalid_service, '
  'time_blocked, time_unavailable.';

revoke all on function public.admin_reschedule_booking(uuid, date, time) from public;
revoke all on function public.admin_reschedule_booking(uuid, date, time) from anon;
grant execute on function public.admin_reschedule_booking(uuid, date, time) to authenticated;
