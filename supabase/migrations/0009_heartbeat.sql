-- 0009_heartbeat.sql
-- Trivial table pinged daily by pg_cron (see 0011_pg_cron_heartbeat.sql) purely
-- to keep the free-tier Supabase project from auto-pausing due to inactivity.
-- Deliberately has NO row level security and NO policies: it is never queried
-- by the app or the frontend, only written by pg_cron under the database
-- owner role, so RLS would add nothing but confusion here.

create table if not exists public.heartbeat (
  id uuid primary key default gen_random_uuid(),
  pinged_at timestamptz not null default now()
);

comment on table public.heartbeat is
  'Daily pg_cron ping target to prevent free-tier inactivity auto-pause. '
  'No RLS/policies by design — not accessed by the app, only by pg_cron.';
