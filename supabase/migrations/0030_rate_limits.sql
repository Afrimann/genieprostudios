-- 0030_rate_limits.sql
-- Fixed-window rate limiting (2026-10-03 audit, findings V-2 and V-5).
--
-- Before this, nothing in the application throttled anything. The concrete
-- exposures it closes:
--   1. confirmDownloadVerificationCodeAction — a 6-digit OTP (10^6 keyspace)
--      with unlimited attempts, guarding deliverable downloads. Exhaustible.
--   2. recordTriumphPaymentAction — the team confirmation PIN, likewise
--      unlimited-guess.
--   3. lookupTriumphProjectAction — unlimited project code/email guesses.
--   4. requestDownloadVerificationCodeAction / submitProjectRequestAction —
--      each sends real email per call, so uncapped = inbox flooding and
--      Resend quota burn.
--
-- Why a table and not Upstash/Vercel KV: this project has no KV binding and
-- adding one means a new external account + dependency + a second source of
-- truth. Postgres is already here, already the trust anchor for every other
-- limit in this codebase, and shared correctly across serverless instances
-- (an in-memory Map would not be — each lambda gets its own).
--
-- Fixed window, not sliding: a sliding window needs per-hit rows and a
-- periodic prune. At this studio's volume the extra precision buys nothing,
-- and a fixed window cannot be gamed into more than 2x the intended rate.

create table public.rate_limits (
  -- "<action>:<scope>", e.g. "otp_confirm:<project_uuid>". Callers build
  -- this; see lib/services/rate-limit.ts.
  key text not null,
  window_start timestamptz not null,
  attempts integer not null default 0,
  primary key (key, window_start)
);

comment on table public.rate_limits is
  'Fixed-window counters for application-level rate limiting. Written only
  by consume_rate_limit() below. Rows are disposable — safe to delete any
  row whose window_start is older than the longest window in use.';

alter table public.rate_limits enable row level security;

-- No policy for ANY role, including admin reads. Every access goes through
-- consume_rate_limit() (SECURITY DEFINER) — there is no legitimate reason
-- for a client, or even the admin UI, to read or write these rows directly,
-- and a client that could delete its own counter could defeat the limit.

-- ---------------------------------------------------------------------------
-- consume_rate_limit: atomically records one attempt and reports whether the
-- caller is still under the limit.
--
-- Returns TRUE  = allowed (attempt recorded)
--         FALSE = limit exceeded (attempt still recorded, so sustained
--                 hammering keeps the window pinned rather than letting the
--                 counter drain while the attacker keeps trying)
--
-- The INSERT ... ON CONFLICT DO UPDATE is what makes this safe under the
-- concurrent invocations a brute-force attempt actually produces: the
-- read-modify-write happens inside a single statement holding a row lock,
-- so two simultaneous requests can never both read "attempts = 4" and both
-- decide they're allowed. A SELECT-then-UPDATE in application code would
-- have exactly that race, which is precisely when it matters most.
-- ---------------------------------------------------------------------------
create or replace function public.consume_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_attempts integer;
begin
  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'invalid_rate_limit_config';
  end if;

  -- Floor now() to the start of its window: all calls within the same
  -- window land on the same row, which is what makes the counter shared.
  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limits (key, window_start, attempts)
  values (p_key, v_window_start, 1)
  on conflict (key, window_start)
    do update set attempts = public.rate_limits.attempts + 1
  returning attempts into v_attempts;

  return v_attempts <= p_limit;
end;
$$;

comment on function public.consume_rate_limit(text, integer, integer) is
  'Atomically increments the counter for (key, current window) and returns
  whether the caller is still within p_limit. Always records the attempt,
  including when over the limit. Raises ''invalid_rate_limit_config'' on a
  non-positive limit or window.';

revoke all on function public.consume_rate_limit(text, integer, integer) from public;
-- anon IS granted deliberately: the public Triumph tracking flow has no
-- Supabase session at all, and those are exactly the endpoints most in need
-- of throttling. The function only ever increments a counter and returns a
-- boolean — it exposes no data and cannot be used to decrement.
grant execute on function public.consume_rate_limit(text, integer, integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Housekeeping: drop counters older than a day. Called by the existing
-- daily sweep (app/api/cron/daily-sweep/route.ts) rather than pg_cron, to
-- keep all scheduled work in one place.
-- ---------------------------------------------------------------------------
create or replace function public.prune_rate_limits()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.rate_limits where window_start < now() - interval '1 day';
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.prune_rate_limits() from public, anon;
grant execute on function public.prune_rate_limits() to authenticated;
