-- 0037_book_session.sql
-- Replaces book_slot_and_create_booking (0013/0014/0018) with book_session,
-- and reworks admin_reschedule_booking (0017) the same way — both move off
-- the "admin opens a window" concept entirely (see 0036_blocked_time_ranges.sql)
-- and gain overnight-session support (session can start one calendar day and
-- end the next, e.g. 11pm Friday -> 2am Saturday).
--
-- Concurrency model change: the old functions serialized concurrent
-- requests by locking the single availability_slots row being booked from
-- (SELECT ... FOR UPDATE). There is no such row anymore — "availability" is
-- now the absence of a blocked_time_ranges row, not a row you can lock. The
-- serialization point instead becomes pg_advisory_xact_lock(hashtext(date))
-- for the target date (and the next day's hash too, if the session crosses
-- midnight) — any two concurrent calls touching the same date(s) now
-- serialize on that advisory lock before either one's overlap check runs,
-- which is the same transactional-serialization goal as the old row lock,
-- adapted to a dateless model. The lock is released automatically at
-- transaction end (xact-scoped), so it never needs an explicit unlock call.

-- =============================================================================
-- 1. Drop the old functions outright (arity/behavior both changed enough
--    that `create or replace` would be misleading to read, and the
--    plan/task explicitly calls for new RPC names) rather than leaving a
--    stale version reachable alongside the new one.
-- =============================================================================
drop function if exists public.book_slot_and_create_booking(uuid, uuid, time);
drop function if exists public.admin_reschedule_booking(uuid, uuid, time);

-- =============================================================================
-- 2. book_session(p_service_id, p_date, p_start_time)
-- =============================================================================
-- Customer-facing SECURITY DEFINER RPC, same privilege-escalation reasoning
-- as the old book_slot_and_create_booking: customer_id must always be
-- auth.uid(), never a parameter, since a SECURITY DEFINER function runs
-- with the owner's privileges rather than the caller's and could otherwise
-- be used to impersonate another customer.
--
-- Validates, in order (per the task spec):
--   1. auth.uid() present.
--   2. Grid alignment on p_start_time (:00/:30, zero seconds).
--   3. Not in the past, using the same Lagos-offset convention as
--      session_start_at() (0016_session_start_at_helper.sql).
--   4. Compute v_end_ts via PLAIN TIMESTAMP arithmetic (not time
--      arithmetic) so a late-night session correctly overflows into the
--      next calendar day instead of wrapping — this is exactly the gap
--      0014's own comment flagged as out of scope at the time. Derive
--      v_end_date/v_end_time from v_end_ts.
--   5. Overlap check against blocked_time_ranges for BOTH p_date and
--      v_end_date (a late start can run into a block the following day).
--   6. Overlap check against existing non-cancelled bookings, querying
--      session_date between p_date - 1 and v_end_date to catch adjacent-day
--      overlaps in both directions (a session starting the evening before
--      p_date could already occupy the early-morning hours of p_date).
--   7. Insert with session_date/session_start_time/session_end_date/
--      session_end_time — no slot_id (column no longer exists, 0036).
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
  v_pending_hold_minutes constant int := 20; -- must match
    -- PENDING_DEPOSIT_HOLD_MINUTES in lib/services/availability-service.ts.
begin
  -- 1. auth_required
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  -- 2. Grid alignment. Checked before any DB lookup so a malformed request
  -- fails fast and cheaply, same ordering as the old RPC.
  if extract(minute from p_start_time)::int not in (0, 30)
     or extract(second from p_start_time) <> 0 then
    raise exception 'invalid_start_time';
  end if;

  -- 3. Not in the past. Same Lagos-offset convention as session_start_at()
  -- (0016) — (date + time) naively has no timezone, so it must be
  -- explicitly interpreted as Africa/Lagos wall-clock time before comparing
  -- against now() (which is a real timestamptz).
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
    -- Guards against this RPC being called directly for an is_addon
    -- service (per-song mixing/mastering, no studio room time) — those must
    -- go through create_addon_booking instead (0019/0020), which is the
    -- only path that makes sense for a service with no physical time to
    -- reserve.
    raise exception 'is_addon_service';
  end if;

  -- 4. Plain TIMESTAMP arithmetic (not `time + interval`, which wraps
  -- modulo 24h and can never represent "past midnight") — this is the fix
  -- for the gap 0014's own comment flagged as explicitly out of scope: a
  -- session starting at 23:00 for 3 hours must land on v_end_date = the
  -- NEXT calendar day, v_end_time = 02:00, not wrap back to the same day at
  -- 02:00 looking like it ends before it starts.
  v_end_ts := (p_date + p_start_time)::timestamp + (v_service.duration_hours || ' hours')::interval;
  v_end_date := v_end_ts::date;
  v_end_time := v_end_ts::time;

  -- 5. Concurrency: serialize on the target date's advisory lock (and the
  -- next day's too, if this session spans midnight) BEFORE either overlap
  -- check below runs, so two concurrent requests for overlapping time
  -- ranges on the same date(s) can never both pass their overlap check and
  -- both insert. hashtext() on the date's text representation gives a
  -- stable per-date lock key; pg_advisory_xact_lock blocks until any other
  -- holder of the same key commits/rolls back, and releases automatically
  -- at the end of this transaction (no explicit unlock needed, and nothing
  -- to clean up on an exception path either).
  perform pg_advisory_xact_lock(hashtext(p_date::text));
  if v_end_date <> p_date then
    perform pg_advisory_xact_lock(hashtext(v_end_date::text));
  end if;

  -- 6. Overlap check against blocked_time_ranges, for BOTH p_date and
  -- v_end_date (a block sitting on the following day can still collide
  -- with a session that starts late the night before and runs into it).
  -- Each block's own [date + start_time, date + end_time) range is compared
  -- against our proposed range padded by the buffer on both sides — same
  -- predicate shape as the old RPC's booking-overlap check, just computed
  -- via (date + time) timestamps instead of raw `time` values so it's
  -- correct across a midnight boundary.
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

  -- 7. Overlap check against existing non-cancelled bookings. Queries
  -- session_date between p_date - 1 and v_end_date (not just p_date/
  -- v_end_date) to catch a booking that started the day before p_date and
  -- is still running into the early hours of p_date itself — an adjacent-
  -- day overlap in the OTHER direction from the blocked_time_ranges check
  -- above. 'pending_deposit' bookings only count as blocking while still
  -- fresh (created within the last v_pending_hold_minutes), same ageing-out
  -- rule as 0018; 'deposited'/'paid_in_full' always block regardless of age.
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
  'Customer-facing SECURITY DEFINER RPC (replaces book_slot_and_create_booking, '
  '0013/0014/0018): creates a bookings row for a customer-chosen date + start '
  'time, for a given (non-addon) service. Every date is open by default — '
  'validates against blocked_time_ranges (admin-marked closures) rather than '
  'requiring a pre-opened window. Supports overnight sessions: the end '
  'date/time are computed via plain timestamp arithmetic so a late start '
  'correctly overflows into the next calendar day. Concurrency: serializes '
  'on pg_advisory_xact_lock(hashtext(date)) for the target date (and the '
  'next day''s hash too if the session spans midnight) before either '
  'overlap check runs. customer_id is always auth.uid(), never a parameter. '
  'Raises: ''auth_required'' (not signed in), ''invalid_start_time'' (not '
  'grid-aligned), ''start_in_past'' (session start has already passed in '
  'Africa/Lagos time), ''invalid_service'' (service missing/inactive), '
  '''is_addon_service'' (service has no studio room time — use '
  'create_addon_booking instead), ''time_blocked'' (overlaps an admin-'
  'marked blocked_time_ranges row, padded by the 30-minute buffer), '
  '''time_unavailable'' (overlaps an existing non-cancelled booking, same '
  'buffer). Booking status always starts at ''pending_deposit'' — this RPC '
  'never marks a booking confirmed/paid; that only happens via the Paystack '
  'webhook handler.';

revoke all on function public.book_session(uuid, date, time) from public;
revoke all on function public.book_session(uuid, date, time) from anon;
grant execute on function public.book_session(uuid, date, time) to authenticated;

-- =============================================================================
-- 3. admin_reschedule_booking(p_booking_id, p_date, p_start_time)
-- =============================================================================
-- Same validation chain as book_session, mirrored onto an UPDATE against an
-- existing booking rather than an INSERT. security invoker (not definer),
-- same reasoning as the 0017 original: no customer_id-impersonation risk
-- (customer_id is never changed here), and the calling admin already holds
-- sufficient RLS grants (bookings_update_admin) — only the explicit
-- is_admin() gate is needed.
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
  v_pending_hold_minutes constant int := 20; -- must match
    -- PENDING_DEPOSIT_HOLD_MINUTES in lib/services/availability-service.ts.
begin
  if not public.is_admin() then
    raise exception 'admin_required';
  end if;

  -- Lock the booking row itself first (stable read for status/service_id
  -- through the rest of this function, and prevents a second concurrent
  -- reschedule of the SAME booking from racing this one) — same as 0017.
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

  -- Concurrency: same advisory-lock serialization as book_session, for the
  -- target date(s) of the NEW proposed time (not the booking's current
  -- time) — any other concurrent booking/reschedule touching these dates
  -- serializes behind this transaction.
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

  -- Same overlap predicate as book_session, excluding the booking being
  -- moved itself (b.id <> p_booking_id) so rescheduling within its own
  -- current time range can never spuriously collide with itself.
  if exists (
    select 1
    from public.bookings b
    where b.session_date between (p_date - 1) and v_end_date
      and b.id <> p_booking_id
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

  -- Moving off auto_cancelled back to deposited: the deposit was already
  -- paid and is still sitting in amount_paid_kobo untouched by this
  -- function — rescheduling just gives that payment a new session to
  -- attach to. A booking still at 'deposited' (never marked stale) simply
  -- keeps its status as-is. Same rule as 0017.
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
  'UPDATE rather than an INSERT. Drops p_slot_id (no windows left to '
  'reference, 0036) in favor of taking p_date/p_start_time directly. '
  'Reverts status from auto_cancelled back to deposited (the deposit '
  'already paid still counts); leaves any other status as-is. Raises: '
  'admin_required, booking_not_found, invalid_start_time, start_in_past, '
  'invalid_service, time_blocked, time_unavailable.';

revoke all on function public.admin_reschedule_booking(uuid, date, time) from public;
revoke all on function public.admin_reschedule_booking(uuid, date, time) from anon;
grant execute on function public.admin_reschedule_booking(uuid, date, time) to authenticated;
