-- 0032_frontdesk_role.sql
-- Introduces the first genuine non-owner role in this project: front desk
-- (reception) staff, who clock booked sessions in and out at the studio.
--
-- WHY A NEW FLAG AND NOT is_admin
-- app/triumph-admin/(protected)/layout.tsx says, in its own words, that
-- reusing profiles.is_admin for /triumph-admin was a UI/URL separation and
-- that the real trigger for a role distinction would be "a non-owner who
-- shouldn't see everything". A receptionist is exactly that person: they
-- must be able to see who is due in today and press two buttons, and must
-- NOT see revenue, payment records, availability editing, or anything on
-- Triumph. So is_frontdesk is a separate flag, gated separately.
--
-- Admins are deliberately allowed through the front desk gate as well (see
-- can_use_frontdesk() below) — the owner covering the desk himself is a
-- normal Saturday, not an edge case.

-- ---------------------------------------------------------------------------
-- 1. The column
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_frontdesk boolean not null default false;

-- Same lockdown as is_admin (0031_lock_is_admin_column.sql), for the same
-- reason: "profiles_update_own" (0010) lets a user UPDATE their own profiles
-- row, and Postgres RLS is ROW-level only — it cannot restrict WHICH COLUMNS
-- an UPDATE touches. Without this revoke, any customer who can sign up could
-- grant themselves front desk access and read every customer's name and
-- phone number for the next three days of bookings.
revoke update (is_frontdesk) on public.profiles from anon, authenticated;

comment on column public.profiles.is_frontdesk is
  'Front desk / reception staff flag, gating /frontdesk only. Writable ONLY
  by service_role/postgres — see 0032_frontdesk_role.sql. Grant it from the
  owner-facing Staff screen under /admin (which uses the service-role
  client), never from an authenticated session. Deliberately independent of
  is_admin: a receptionist is not an admin, and an admin does not need this
  flag set to use /frontdesk (see can_use_frontdesk()).';

-- ---------------------------------------------------------------------------
-- 2. Extend the escalation guard to cover both flags
-- ---------------------------------------------------------------------------
-- 0031 added prevent_is_admin_self_escalation() as defense in depth behind
-- the column REVOKE, specifically so that a future migration accidentally
-- re-granting the column could not silently reopen the hole. That reasoning
-- applies verbatim to is_frontdesk, so rather than add a second
-- single-column trigger, the guard is generalised to cover every privileged
-- flag on profiles. Any flag added here in future should be added to this
-- function too.
create or replace function public.prevent_privileged_flag_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_admin is distinct from old.is_admin
     or new.is_frontdesk is distinct from old.is_frontdesk then
    -- current_user is 'authenticated'/'anon' for a PostgREST request made
    -- with a user JWT, and 'service_role'/'postgres'/'supabase_admin' for
    -- trusted server-side connections. Only the latter may flip these flags.
    if current_user not in ('service_role', 'postgres', 'supabase_admin') then
      raise exception 'privileged role flags cannot be changed by this role'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.prevent_privileged_flag_self_escalation() is
  'Blocks any UPDATE that changes profiles.is_admin or profiles.is_frontdesk
  unless performed by a service-role/superuser connection. Supersedes
  prevent_is_admin_self_escalation() from 0031. Add any future privileged
  flag on profiles to this function''s condition.';

-- Replace the 0031 trigger+function with the generalised pair. Order matters:
-- the function cannot be dropped while a trigger still references it.
drop trigger if exists profiles_prevent_is_admin_escalation on public.profiles;
drop function if exists public.prevent_is_admin_self_escalation();

drop trigger if exists profiles_prevent_privileged_flag_escalation on public.profiles;

create trigger profiles_prevent_privileged_flag_escalation
  before update on public.profiles
  for each row
  execute function public.prevent_privileged_flag_self_escalation();

-- ---------------------------------------------------------------------------
-- 3. can_use_frontdesk(): the RLS helper
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER for the same anti-recursion reason spelled out above
-- is_admin() in 0001: a policy on profiles that queries profiles re-enters
-- RLS on the same table, which is the classic "infinite recursion detected
-- in policy" failure. Running as the function owner bypasses RLS for the
-- internal SELECT, so policies can call this freely — including the
-- profiles_select_frontdesk policy added below.
--
-- Named can_use_frontdesk() rather than is_frontdesk() on purpose: it is
-- deliberately true for admins too, and a helper called is_frontdesk()
-- returning true for someone whose is_frontdesk column is false would be a
-- trap for whoever reads these policies next.
create or replace function public.can_use_frontdesk()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select is_frontdesk or is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

comment on function public.can_use_frontdesk() is
  'True when the current user may use the /frontdesk reception area — i.e.
  profiles.is_frontdesk OR profiles.is_admin (the owner can cover the desk).
  SECURITY DEFINER so RLS policies can call it without re-entering RLS on
  profiles. Note the asymmetry: this does NOT make a receptionist an admin,
  and nothing under /admin or /triumph-admin should ever gate on it.';

-- ---------------------------------------------------------------------------
-- 4. lagos_today(): the window every front desk policy is scoped to
-- ---------------------------------------------------------------------------
-- bookings.session_date is a naive date entered as Lagos wall-clock time
-- (see 0003/0005, and session_start_at() in 0016 for the same problem on the
-- time side). The database's own now() is UTC, and Lagos is UTC+1 — so
-- between 23:00 and 00:00 UTC, current_date in the database is already
-- "tomorrow" in Lagos. A front desk policy written against a bare
-- current_date would therefore blank the board for the last hour of every
-- evening, which is prime studio time. This helper is the single place that
-- conversion happens.
create or replace function public.lagos_today()
returns date
language sql
stable
set search_path = public
as $$
  select (now() at time zone 'Africa/Lagos')::date;
$$;

comment on function public.lagos_today() is
  'Today''s date in Africa/Lagos, the studio''s wall-clock timezone. Use this
  instead of current_date anywhere a naive session_date is being compared,
  since the database clock is UTC and Lagos is UTC+1.';

-- Policy expressions execute with the CALLING user's privileges, so
-- authenticated needs EXECUTE or every front desk select fails with
-- "permission denied for function lagos_today" — exactly the failure 0017
-- hit live with session_start_at(). Granting is safe: it takes no input,
-- touches no table, and returns a date anyone could compute themselves.
revoke all on function public.lagos_today() from public;
grant execute on function public.lagos_today() to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Front desk read access
-- ---------------------------------------------------------------------------
-- Scoped to a three-day window (yesterday..tomorrow in Lagos), not the whole
-- table. The desk needs today; yesterday covers a session that ran past
-- midnight and still has to be clocked out, and tomorrow covers an early
-- arrival and a staff member setting up before a late shift rolls over.
-- Booking history beyond that is the owner's business, not reception's.
--
-- Status is restricted to bookings that represent a session that is actually
-- expected to happen. pending_deposit (never paid, usually an abandoned
-- checkout) and cancelled/auto_cancelled bookings are not sessions, and
-- showing them would invite the desk to clock in someone who has no booking.
-- If reception later needs to tell a walk-in "that booking was cancelled",
-- widen this deliberately rather than by accident.
--
-- is_addon bookings (per-song mixing/mastering) are excluded automatically
-- and correctly: 0019 made session_date nullable for them, and NULL fails
-- the BETWEEN rather than passing it. That is the right outcome — an addon
-- booking reserves no studio room time and nobody physically turns up for
-- one, so it is not a session the desk can clock in. Same NULL-propagation
-- reasoning 0019 already relies on for the reminder/auto-cancel predicates.
drop policy if exists "bookings_select_frontdesk" on public.bookings;
create policy "bookings_select_frontdesk"
  on public.bookings
  for select
  to authenticated
  using (
    public.can_use_frontdesk()
    and status in ('deposited', 'paid_in_full')
    and session_date between public.lagos_today() - 1 and public.lagos_today() + 1
  );

-- No update policy for front desk on bookings, deliberately. Clock in/out
-- lives in its own table with its own SECURITY DEFINER RPCs
-- (0033_session_attendance.sql) precisely so that reception never holds an
-- UPDATE grant on a table containing total_price_kobo and status — the
-- row-level-not-column-level lesson from 0031 again.

-- Customer name and phone for the people due in today: the desk has to be
-- able to greet someone and call them when they are late. Scoped through the
-- bookings table so a receptionist can read exactly the customers they are
-- expecting and nobody else.
--
-- The EXISTS subquery is itself subject to the bookings policies above when
-- evaluated for an authenticated caller, which is intentional — it means
-- this policy automatically inherits the same three-day/status window rather
-- than duplicating it, and cannot drift out of sync with it.
drop policy if exists "profiles_select_frontdesk" on public.profiles;
create policy "profiles_select_frontdesk"
  on public.profiles
  for select
  to authenticated
  using (
    public.can_use_frontdesk()
    and exists (
      select 1
      from public.bookings b
      where b.customer_id = profiles.id
    )
  );

-- Service names for the board. services_select_active_public (0010) already
-- exposes active services to everyone, so this adds essentially nothing
-- sensitive — it exists only so that a booking pointing at a service the
-- owner has since deactivated still renders with its name instead of a blank
-- card at the desk.
drop policy if exists "services_select_frontdesk" on public.services;
create policy "services_select_frontdesk"
  on public.services
  for select
  to authenticated
  using (public.can_use_frontdesk());

-- Note what is NOT granted here, and should stay that way: payments,
-- reminder_log, availability_slots, support_tickets, tc_acceptances, and
-- every triumph_* table. The desk reads the outstanding balance off
-- bookings.amount_paid_kobo vs total_price_kobo (enough to warn before
-- clocking in an unpaid session) and has no access to payment records,
-- Paystack references, or any revenue figure.

-- ---------------------------------------------------------------------------
-- VERIFY after applying
-- ---------------------------------------------------------------------------
-- As an ordinary signed-in customer (NOT the SQL editor, which runs as
-- postgres and bypasses both layers):
--   await supabase.from('profiles').update({ is_frontdesk: true }).eq('id', <own id>)
-- Expected: error, and is_frontdesk still false on re-select.
--
-- As a front desk user (is_frontdesk = true, is_admin = false):
--   select * from bookings;          -- only today±1, deposited/paid_in_full
--   select * from payments;          -- zero rows
--   select * from triumph_projects;  -- zero rows
--
-- Promotion is service-role only, by design:
--   update public.profiles set is_frontdesk = true where id = '<staff uuid>';
-- ---------------------------------------------------------------------------
