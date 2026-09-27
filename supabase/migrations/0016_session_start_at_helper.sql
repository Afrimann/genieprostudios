-- 0016_session_start_at_helper.sql
-- Phase 4 (balance reminders / auto-cancel / stale-pending cleanup) needs to
-- compare a booking's session start against now() in real time, but
-- bookings.session_date/session_start_time are naive date/time columns —
-- entered by the admin as Lagos, Nigeria wall-clock time (see
-- 0003_availability_slots.sql / 0005_bookings.sql), with no timezone
-- attached at the DB level. session_start_at() below is the single place
-- that combines the two and interprets them as Africa/Lagos, producing a
-- real timestamptz that can be safely compared against now() regardless of
-- the DB session's own timezone setting. SQL functions/queries in this
-- migration use it instead of doing timezone math in JS, per the
-- server-is-source-of-truth discipline used throughout this codebase.

create or replace function public.session_start_at(
  p_session_date date,
  p_session_start_time time
)
returns timestamptz
language sql
stable
as $$
  select (p_session_date + p_session_start_time) at time zone 'Africa/Lagos';
$$;

comment on function public.session_start_at(date, time) is
  'Combines a naive session_date/session_start_time (entered as Lagos, '
  'Nigeria wall-clock time) into a real timestamptz, by interpreting the '
  'naive timestamp as Africa/Lagos local time. Use this instead of '
  'comparing session_date/session_start_time against now() directly, since '
  'now() is timestamptz and the raw columns carry no timezone of their own.';

-- ---------------------------------------------------------------------------
-- Shared column shape returned by all three sweep-source functions below:
-- just enough for the reminder/cron service layer to build an email and log
-- it, without any join to profiles/services baked in here (those joins are
-- the repository's job — see lib/repositories/reminder-repository.ts).
--
-- security invoker (the default, stated explicitly for clarity) rather than
-- security definer: these functions are only ever called from a
-- service-role context (a cron route, never the browser/authenticated
-- client), so there is no privilege-escalation need to run as the function
-- owner, unlike book_slot_and_create_booking (0013) which specifically
-- needs to bypass a customer caller's lack of grants. Keeping these
-- invoker-rights is the least-privilege default per this project's
-- "deny by default, grant narrowly" convention (0010_rls_policies.sql,
-- 0013_book_slot_rpc.sql).
-- ---------------------------------------------------------------------------

create or replace function public.bookings_needing_balance_reminder()
returns table (
  id uuid,
  customer_id uuid,
  service_id uuid,
  session_date date,
  session_start_time time,
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
  'by the daily reminder sweep (lib/services/reminder-service.ts).';

create or replace function public.bookings_needing_autocancel()
returns table (
  id uuid,
  customer_id uuid,
  service_id uuid,
  session_date date,
  session_start_time time,
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
  'still upcoming but now within 24h. Excludes sessions whose start time has '
  'already passed (found live, 2026-09-27: a sweep run/deploy gap can let a '
  'session''s start time slip into the past before the daily cron catches '
  'it) — those are left as ''deposited'' for manual owner follow-up rather '
  'than auto-cancelled + emailed as if pre-emptively cancelled, since the '
  'session already happened. Matched bookings are auto-cancelled (status -> '
  'auto_cancelled) by the daily sweep — distinct from stale_pending_bookings '
  '(abandoned checkout, status -> cancelled). Called service-role-side only. '
  'Note: there is no slot to release back to the pool as part of this — '
  'availability_slots is never flipped to ''booked'' on booking creation '
  'since 0014_booking_windows.sql, so auto-cancelling here only ever updates '
  'bookings.status.';

create or replace function public.stale_pending_bookings()
returns table (
  id uuid,
  customer_id uuid,
  service_id uuid,
  session_date date,
  session_start_time time,
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
  'abandoned checkout, never any payment. Cleaned up to status = ''cancelled'' '
  '(not auto_cancelled — that status is reserved for the 24h-before-session '
  'unpaid-balance case, a different reason). Called service-role-side only.';

-- Explicit least-privilege grants, mirroring 0013_book_slot_rpc.sql's
-- revoke-then-grant-narrowly pattern. These four functions are only ever
-- invoked by the service-role key (cron route -> createAdminClient()), which
-- bypasses grants entirely, but grants are still set deny-by-default here so
-- no anon/authenticated caller can invoke them directly over PostgREST.
revoke all on function public.session_start_at(date, time) from public;
revoke all on function public.session_start_at(date, time) from anon, authenticated;

revoke all on function public.bookings_needing_balance_reminder() from public;
revoke all on function public.bookings_needing_balance_reminder() from anon, authenticated;

revoke all on function public.bookings_needing_autocancel() from public;
revoke all on function public.bookings_needing_autocancel() from anon, authenticated;

revoke all on function public.stale_pending_bookings() from public;
revoke all on function public.stale_pending_bookings() from anon, authenticated;
