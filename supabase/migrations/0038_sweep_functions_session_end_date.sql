-- 0038_sweep_functions_session_end_date.sql
-- Adds session_end_date to the three sweep-source functions' returns table/
-- select lists (0016_session_start_at_helper.sql). Their WHERE clauses only
-- ever use session_start_at(session_date, session_start_time) — session
-- START, not end — so none of those predicates are affected by this change;
-- this is purely a display-only addition so lib/repositories/reminder-
-- repository.ts (and the email templates it feeds) can show the correct
-- end date for an overnight booking rather than silently assuming same-day.
--
-- create or replace function cannot change a `returns table` column list
-- unless the new list is an exact append at the end — session_end_date is
-- inserted in the middle (after session_start_time, before session_end_time,
-- matching the bookings table's own column order from 0036), which Postgres
-- rejects with 42P13 ("cannot change return type of existing function").
-- Each function is dropped first so the following create recreates it fresh.

drop function if exists public.bookings_needing_balance_reminder();
drop function if exists public.bookings_needing_autocancel();
drop function if exists public.stale_pending_bookings();

create or replace function public.bookings_needing_balance_reminder()
returns table (
  id uuid,
  customer_id uuid,
  service_id uuid,
  session_date date,
  session_start_time time,
  session_end_date date,
  session_end_time time,
  total_price_kobo bigint,
  deposit_amount_kobo bigint,
  amount_paid_kobo bigint
)
language sql
security invoker
stable
as $$
  select
    b.id,
    b.customer_id,
    b.service_id,
    b.session_date,
    b.session_start_time,
    b.session_end_date,
    b.session_end_time,
    b.total_price_kobo,
    b.deposit_amount_kobo,
    b.amount_paid_kobo
  from public.bookings b
  where b.status = 'deposited'
    and public.session_start_at(b.session_date, b.session_start_time) > now() + interval '24 hours'
    and not exists (
      select 1
      from public.reminder_log rl
      where rl.booking_id = b.id
        and rl.type = 'balance_due_24h'
        and rl.sent_at > now() - interval '24 hours'
    );
$$;

comment on function public.bookings_needing_balance_reminder() is
  'Deposited bookings (>=70% paid, balance outstanding) whose session start '
  'is still more than 24h away and that have not already received a '
  'balance_due_24h reminder in the last 24h. Called service-role-side only, '
  'by the daily reminder sweep (lib/services/reminder-service.ts). Returns '
  'session_end_date (0038) alongside session_end_time for overnight-aware '
  'display — the WHERE clause above is unaffected, since it only ever '
  'compares session START.';

create or replace function public.bookings_needing_autocancel()
returns table (
  id uuid,
  customer_id uuid,
  service_id uuid,
  session_date date,
  session_start_time time,
  session_end_date date,
  session_end_time time,
  total_price_kobo bigint,
  deposit_amount_kobo bigint,
  amount_paid_kobo bigint
)
language sql
security invoker
stable
as $$
  select
    b.id,
    b.customer_id,
    b.service_id,
    b.session_date,
    b.session_start_time,
    b.session_end_date,
    b.session_end_time,
    b.total_price_kobo,
    b.deposit_amount_kobo,
    b.amount_paid_kobo
  from public.bookings b
  where b.status = 'deposited'
    and public.session_start_at(b.session_date, b.session_start_time) <= now() + interval '24 hours'
    and public.session_start_at(b.session_date, b.session_start_time) > now();
$$;

comment on function public.bookings_needing_autocancel() is
  'Deposited bookings (balance still outstanding) whose session start is '
  'still upcoming but now within 24h. Excludes sessions whose start time '
  'has already passed (see 0016''s original comment for why). Returns '
  'session_end_date (0038) alongside session_end_time for overnight-aware '
  'display — the WHERE clause above is unaffected, since it only ever '
  'compares session START. Matched bookings are auto-cancelled by the daily '
  'sweep. Called service-role-side only.';

create or replace function public.stale_pending_bookings()
returns table (
  id uuid,
  customer_id uuid,
  service_id uuid,
  session_date date,
  session_start_time time,
  session_end_date date,
  session_end_time time,
  total_price_kobo bigint,
  deposit_amount_kobo bigint,
  amount_paid_kobo bigint
)
language sql
security invoker
stable
as $$
  select
    b.id,
    b.customer_id,
    b.service_id,
    b.session_date,
    b.session_start_time,
    b.session_end_date,
    b.session_end_time,
    b.total_price_kobo,
    b.deposit_amount_kobo,
    b.amount_paid_kobo
  from public.bookings b
  where b.status = 'pending_deposit'
    and b.created_at < now() - interval '30 minutes';
$$;

comment on function public.stale_pending_bookings() is
  'Bookings still pending_deposit more than 30 minutes after creation — an '
  'abandoned checkout, never any payment. Returns session_end_date (0038) '
  'alongside session_end_time — this function''s WHERE clause does not '
  'reference session_date/time at all, so it is entirely unaffected. Called '
  'service-role-side only.';

-- Grants are unchanged from 0016/0017 (session_start_at already granted to
-- authenticated there; these three sweep functions remain revoked from
-- anon/authenticated since they're only ever invoked service-role-side) —
-- re-asserting them here is redundant but harmless and keeps this migration
-- self-contained if ever replayed against a fresh database out of order
-- relative to 0016.
revoke all on function public.bookings_needing_balance_reminder() from public;
revoke all on function public.bookings_needing_balance_reminder() from anon, authenticated;

revoke all on function public.bookings_needing_autocancel() from public;
revoke all on function public.bookings_needing_autocancel() from anon, authenticated;

revoke all on function public.stale_pending_bookings() from public;
revoke all on function public.stale_pending_bookings() from anon, authenticated;
