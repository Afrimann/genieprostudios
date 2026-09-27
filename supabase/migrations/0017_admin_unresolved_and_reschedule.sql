-- 0017_admin_unresolved_and_reschedule.sql
-- Found live (2026-09-27) while verifying Phase 4: a deposited booking whose
-- session already happened with the balance still unpaid has no admin-facing
-- surface at all — bookings_needing_autocancel() (0016) now deliberately
-- excludes it (see that migration's comment), so it just sits at 'deposited'
-- forever with nobody looking at it. This migration adds:
--   1. bookings_unresolved_past_sessions() — the admin-facing read backing a
--      new /admin/bookings list of exactly these bookings (plus ones an admin
--      already manually resolved to auto_cancelled but hasn't rescheduled),
--      so the owner can decide what to do rather than it going unnoticed.
--   2. admin_reschedule_booking(...) — lets the owner move such a booking
--      onto a new open window/start time (e.g. the customer reached out and
--      wants to still use their deposit for a new session), reusing the same
--      bounds/grid/overlap validation book_slot_and_create_booking (0014)
--      enforces for a brand-new booking, but as an UPDATE against an existing
--      booking row instead of an INSERT.
-- "Mark as stale" itself needs no new RPC: bookings_update_admin
-- (0010_rls_policies.sql) already lets an is_admin() caller UPDATE
-- bookings.status directly through the RLS-scoped client, so that action is
-- a plain repository update (see lib/repositories/admin-booking-repository.ts),
-- not a new database function.

-- ---------------------------------------------------------------------------
-- 0. Widen session_start_at()'s grant
-- ---------------------------------------------------------------------------
-- 0016 revoked EXECUTE on session_start_at() from authenticated/anon because,
-- at the time, it was only ever called by the other three 0016 functions,
-- which are themselves only ever invoked via the service-role cron route
-- (service_role bypasses grants entirely, so the narrow grant was never
-- exercised). bookings_unresolved_past_sessions() below is the first caller
-- of session_start_at() that runs as SECURITY INVOKER under an actual
-- `authenticated` admin session — found live (2026-09-27) as "permission
-- denied for function session_start_at" the first time an admin session
-- called it. session_start_at() does no table I/O and returns no sensitive
-- data (it's pure date/time arithmetic), so widening this grant is safe.
grant execute on function public.session_start_at(date, time) to authenticated;

-- ---------------------------------------------------------------------------
-- 1. bookings_unresolved_past_sessions()
-- ---------------------------------------------------------------------------
-- security invoker (not definer): the calling admin already has
-- bookings_select_admin/profiles_select_admin/services read access via RLS
-- (0010_rls_policies.sql), so there is no privilege gap to bridge — this only
-- needs its own explicit is_admin() check (mirroring auth_required in
-- book_slot_and_create_booking) so a non-admin caller gets a clean error
-- instead of an empty/confusing result.
create or replace function public.bookings_unresolved_past_sessions()
returns table (
  id uuid,
  customer_id uuid,
  service_id uuid,
  slot_id uuid,
  session_date date,
  session_start_time time,
  session_end_time time,
  total_price_kobo bigint,
  deposit_amount_kobo bigint,
  amount_paid_kobo bigint,
  status public.booking_status
)
language plpgsql
security invoker
stable
as $$
begin
  if not public.is_admin() then
    raise exception 'admin_required';
  end if;

  return query
  select
    b.id,
    b.customer_id,
    b.service_id,
    b.slot_id,
    b.session_date,
    b.session_start_time,
    b.session_end_time,
    b.total_price_kobo,
    b.deposit_amount_kobo,
    b.amount_paid_kobo,
    b.status
  from public.bookings b
  where b.status in ('deposited', 'auto_cancelled')
    and b.amount_paid_kobo < b.total_price_kobo
    and public.session_start_at(b.session_date, b.session_start_time) <= now()
  order by b.session_date desc, b.session_start_time desc;
end;
$$;

comment on function public.bookings_unresolved_past_sessions() is
  'Admin-facing: bookings whose session has already started/passed, still '
  'carrying an unpaid balance, and either still ''deposited'' (never '
  'resolved — bookings_needing_autocancel excludes these once past, see '
  '0016) or already ''auto_cancelled'' (resolved but not yet rescheduled). '
  'Backs the /admin/bookings unresolved list: each row gets a "mark stale" '
  'action (deposited only) and a "reschedule" action (either status), see '
  'admin_reschedule_booking below.';

revoke all on function public.bookings_unresolved_past_sessions() from public;
revoke all on function public.bookings_unresolved_past_sessions() from anon;
grant execute on function public.bookings_unresolved_past_sessions() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. admin_reschedule_booking(...)
-- ---------------------------------------------------------------------------
-- Same validation shape as book_slot_and_create_booking (0014) — window
-- locked FOR UPDATE, service duration bounds check, 30-minute grid check,
-- buffer-padded overlap check against the target window's OTHER bookings
-- (excluding the booking being moved, so rescheduling within its own current
-- time range can never spuriously collide with itself) — but as an UPDATE
-- against an existing booking rather than an INSERT of a new one.
--
-- security invoker (not definer): unlike book_slot_and_create_booking, there
-- is no customer_id-impersonation risk here (the booking already exists and
-- its customer_id is never changed), and the calling admin already holds
-- sufficient RLS grants (bookings_update_admin, availability_slots select)
-- — so no privilege bridge is needed, only the explicit is_admin() gate.
create or replace function public.admin_reschedule_booking(
  p_booking_id uuid,
  p_slot_id uuid,
  p_start_time time
)
returns public.bookings
language plpgsql
security invoker
as $$
declare
  v_booking public.bookings;
  v_slot public.availability_slots;
  v_service public.services;
  v_end_time time;
  v_buffer_minutes constant int := 30; -- must match SLOT_BUFFER_MINUTES in
    -- lib/services/availability-service.ts, same caveat as 0014's copy of
    -- this same literal.
begin
  if not public.is_admin() then
    raise exception 'admin_required';
  end if;

  -- Lock the booking row itself first (stable read for status/service_id
  -- through the rest of this function, and prevents a second concurrent
  -- reschedule of the SAME booking from racing this one).
  select *
  into v_booking
  from public.bookings
  where id = p_booking_id
  for update;

  if v_booking is null then
    raise exception 'booking_not_found';
  end if;

  -- Lock the target window, same as book_slot_and_create_booking: any other
  -- concurrent booking/reschedule against this window serializes behind
  -- this transaction.
  select *
  into v_slot
  from public.availability_slots
  where id = p_slot_id
    and status = 'open'
  for update;

  if v_slot is null then
    raise exception 'slot_unavailable';
  end if;

  select *
  into v_service
  from public.services
  where id = v_booking.service_id
    and active = true;

  if v_service is null then
    raise exception 'invalid_service';
  end if;

  v_end_time := p_start_time + (v_service.duration_hours || ' hours')::interval;

  if p_start_time < v_slot.start_time or v_end_time > v_slot.end_time then
    raise exception 'outside_window';
  end if;

  if extract(minute from p_start_time)::int not in (0, 30)
     or extract(second from p_start_time) <> 0 then
    raise exception 'invalid_start_time';
  end if;

  if exists (
    select 1
    from public.bookings b
    where b.slot_id = p_slot_id
      and b.id <> p_booking_id
      and b.status not in ('cancelled', 'auto_cancelled')
      and (p_start_time - (v_buffer_minutes || ' minutes')::interval) < b.session_end_time
      and (v_end_time + (v_buffer_minutes || ' minutes')::interval) > b.session_start_time
  ) then
    raise exception 'time_unavailable';
  end if;

  -- Moving off auto_cancelled back to deposited: the deposit was already
  -- paid and is still sitting in amount_paid_kobo untouched by this
  -- function — rescheduling just gives that payment a new session to attach
  -- to. A booking still at 'deposited' (never marked stale) simply keeps its
  -- status as-is.
  update public.bookings
  set slot_id = p_slot_id,
      session_date = v_slot.date,
      session_start_time = p_start_time,
      session_end_time = v_end_time,
      status = case when v_booking.status = 'auto_cancelled' then 'deposited' else v_booking.status end
  where id = p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$$;

comment on function public.admin_reschedule_booking(uuid, uuid, time) is
  'Admin-only: moves an existing booking onto a new open window/start time, '
  'validating bounds/grid/overlap exactly like book_slot_and_create_booking '
  '(0014) but against an UPDATE rather than an INSERT. Reverts status from '
  'auto_cancelled back to deposited (the deposit already paid still counts); '
  'leaves any other status as-is. Raises: admin_required, booking_not_found, '
  'slot_unavailable, invalid_service, outside_window, invalid_start_time, '
  'time_unavailable — same codes/meanings as book_slot_and_create_booking '
  'where applicable.';

revoke all on function public.admin_reschedule_booking(uuid, uuid, time) from public;
revoke all on function public.admin_reschedule_booking(uuid, uuid, time) from anon;
grant execute on function public.admin_reschedule_booking(uuid, uuid, time) to authenticated;
