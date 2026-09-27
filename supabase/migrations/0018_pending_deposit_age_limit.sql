-- 0018_pending_deposit_age_limit.sql
-- Correction (2026-09-27, customer-facing bug report): a 'pending_deposit'
-- booking was blocking its time range indefinitely until the DAILY cron's
-- stale-pending sweep (lib/services/reminder-service.ts's
-- runStalePendingCleanupSweep, 30-minute cutoff) got around to it — which,
-- being a once-a-day cron, could leave an abandoned checkout (closed
-- Paystack tab, payment never attempted, payment failed and the customer
-- never returned to /book/confirmation) occupying a real time slot for up
-- to 24 hours. "Only a verified deposit or full payment should be allowed
-- to keep a booked time" — a pending_deposit booking should stop blocking
-- new bookings as soon as it's old enough to be considered abandoned,
-- without waiting on the cron.
--
-- This does NOT touch the daily cron's own 30-minute stale-pending cutoff
-- (that still runs once a day and formally moves old pending_deposit rows
-- to 'cancelled' for DB/dashboard hygiene) — it only changes when a
-- pending_deposit row stops counting as "occupying" a time range for the
-- purposes of booking a NEW, possibly-overlapping session. The two values
-- (this migration's 20 minutes, the cron's 30 minutes) are deliberately
-- different: a customer should be free to book the same time a stale
-- checkout was holding well before that checkout is formally cleaned up.
create or replace function public.book_slot_and_create_booking(
  p_slot_id uuid,
  p_service_id uuid,
  p_start_time time
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot public.availability_slots;
  v_service public.services;
  v_end_time time;
  v_deposit_kobo bigint;
  v_booking public.bookings;
  v_buffer_minutes constant int := 30; -- must match SLOT_BUFFER_MINUTES in
    -- lib/services/availability-service.ts.
  v_pending_hold_minutes constant int := 20; -- must match
    -- PENDING_DEPOSIT_HOLD_MINUTES in lib/services/availability-service.ts.
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

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
  where id = p_service_id
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

  -- Overlap check, same predicate as 0014 plus one added condition: a
  -- 'pending_deposit' booking only counts as blocking while it's still
  -- fresh (created within the last v_pending_hold_minutes). Once it ages
  -- past that, it's treated the same as a cancelled booking for THIS
  -- purpose only — its own status is left untouched here (a separate
  -- process is responsible for actually marking it cancelled; see the
  -- migration header comment). 'deposited'/'paid_in_full' bookings always
  -- block regardless of age, since real money has landed on them.
  if exists (
    select 1
    from public.bookings b
    where b.slot_id = p_slot_id
      and b.status not in ('cancelled', 'auto_cancelled')
      and (
        b.status <> 'pending_deposit'
        or b.created_at >= now() - (v_pending_hold_minutes || ' minutes')::interval
      )
      and (p_start_time - (v_buffer_minutes || ' minutes')::interval) < b.session_end_time
      and (v_end_time + (v_buffer_minutes || ' minutes')::interval) > b.session_start_time
  ) then
    raise exception 'time_unavailable';
  end if;

  v_deposit_kobo := ceil(v_service.price_kobo * 0.7);

  insert into public.bookings (
    customer_id,
    service_id,
    slot_id,
    session_date,
    session_start_time,
    session_end_time,
    total_price_kobo,
    deposit_amount_kobo,
    status
  )
  values (
    auth.uid(),
    p_service_id,
    p_slot_id,
    v_slot.date,
    p_start_time,
    v_end_time,
    v_service.price_kobo,
    v_deposit_kobo,
    'pending_deposit'
  )
  returning * into v_booking;

  return v_booking;
end;
$$;

comment on function public.book_slot_and_create_booking(uuid, uuid, time) is
  'Customer-facing SECURITY DEFINER RPC (v3, 0018): same as v2 (0014) '
  'except the overlap check no longer treats a ''pending_deposit'' booking '
  'as blocking once it is older than 20 minutes (no successful payment '
  'ever landed on it in that time, so it no longer holds the slot) — '
  '''deposited''/''paid_in_full'' bookings still block regardless of age. '
  'Raises the same auth_required/slot_unavailable/invalid_service/'
  'outside_window/invalid_start_time/time_unavailable set as v2.';
