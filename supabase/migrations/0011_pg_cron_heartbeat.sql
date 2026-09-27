-- 0011_pg_cron_heartbeat.sql
-- Schedules a trivial daily insert into public.heartbeat purely so the
-- free-tier Supabase project shows real database activity and doesn't get
-- auto-paused for inactivity.
--
-- IMPORTANT: this is completely unrelated to the app-level Vercel Cron job(s)
-- used later for customer balance reminders / auto-cancellation of unpaid
-- bookings (24h-before-session cutoff). That reminder/auto-cancel logic lives
-- in the Node backend and is triggered by Vercel Cron hitting a route
-- handler with the service-role client — it does NOT run inside Postgres via
-- pg_cron. This migration's only job is the heartbeat ping.
--
-- pg_cron requires the extension to be created in the `extensions` schema on
-- Supabase-hosted projects (the platform pre-authorizes this location).

create extension if not exists pg_cron with schema extensions;

-- Idempotent scheduling: unschedule first if a job with this name already
-- exists, then (re)schedule, so this migration is safe to re-run.
do $$
begin
  if exists (
    select 1 from cron.job where jobname = 'heartbeat_daily_ping'
  ) then
    perform cron.unschedule('heartbeat_daily_ping');
  end if;
end;
$$;

select cron.schedule(
  'heartbeat_daily_ping',
  '0 3 * * *', -- daily at 03:00 UTC
  $$insert into public.heartbeat (pinged_at) values (now());$$
);
