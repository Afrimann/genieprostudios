-- 0036_blocked_time_ranges.sql
-- Part 2 of the "open-by-default availability + overnight bookings" change.
--
-- PRE-FLIGHT CHECK (performed before writing this migration, per the task
-- that produced it): queried the live Supabase project directly with the
-- service-role key. Findings: availability_slots held 11 rows (10 'open',
-- 1 'booked'); bookings held exactly 5 rows total, every single one with a
-- non-null slot_id (1 'cancelled', 4 'paid_in_full'). This matches
-- pre-launch test data (small volume, placeholder-looking slot windows like
-- 00:00:00-23:59:00, dates clustered around recent dev/test sessions) with
-- no sign of a real customer transaction. Confirmed safe to drop outright
-- rather than attempt a migration/backfill of this data into the new model.
--
-- Design: "close-the-exceptions, not open-the-exceptions". Retires the
-- "admin opens a window, customer books inside it" model entirely. Every
-- date is now open by default, 00:00-23:59 — the admin instead marks
-- specific time ranges on specific days as *closed*. A row's existence in
-- blocked_time_ranges IS the closure; there is no status enum to flip.
--
-- This migration also adds bookings.session_end_date so a session can
-- legitimately span midnight (e.g. 11pm Friday -> 2am Saturday) — see
-- 0037_book_session.sql for the RPC that computes/validates it. Minimal-
-- invasive approach per the plan: every existing same-day booking simply
-- gets session_end_date = session_date; only a genuinely overnight booking
-- ever has session_end_date <> session_date. Far less invasive than
-- migrating every date/time column to timestamptz.

-- =============================================================================
-- 1. public.blocked_time_ranges
-- =============================================================================
create table if not exists public.blocked_time_ranges (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  start_time time not null,
  end_time time not null,
  reason text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

comment on table public.blocked_time_ranges is
  'Replaces availability_slots (dropped below). Every date is open by '
  'default, 00:00-23:59 — a row here marks a specific time range on a '
  'specific date as CLOSED. No status enum: the row''s existence IS the '
  'closure. Admin-only read/write (customers never query this table '
  'directly — book_session (0037) enforces blocks server-side).';

comment on column public.blocked_time_ranges.reason is
  'Optional free-text note for the owner''s own reference (e.g. ''equipment '
  'maintenance'', ''private event''). Never shown to customers.';

alter table public.blocked_time_ranges enable row level security;

create index if not exists blocked_time_ranges_date_idx
  on public.blocked_time_ranges (date);

drop policy if exists "blocked_time_ranges_select_admin" on public.blocked_time_ranges;
create policy "blocked_time_ranges_select_admin"
  on public.blocked_time_ranges
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "blocked_time_ranges_insert_admin" on public.blocked_time_ranges;
create policy "blocked_time_ranges_insert_admin"
  on public.blocked_time_ranges
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "blocked_time_ranges_update_admin" on public.blocked_time_ranges;
create policy "blocked_time_ranges_update_admin"
  on public.blocked_time_ranges
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "blocked_time_ranges_delete_admin" on public.blocked_time_ranges;
create policy "blocked_time_ranges_delete_admin"
  on public.blocked_time_ranges
  for delete
  to authenticated
  using (public.is_admin());

-- =============================================================================
-- 2. bookings.session_end_date
-- =============================================================================
alter table public.bookings
  add column if not exists session_end_date date;

-- Backfill every existing row (same-day booking) before adding any
-- not-null constraint — see the all-or-nothing nullability rule applied
-- right after this.
update public.bookings
  set session_end_date = session_date
  where session_end_date is null
    and session_date is not null;

comment on column public.bookings.session_end_date is
  'The calendar date the session ENDS on. Equal to session_date for every '
  'same-day booking (the overwhelming majority); only differs from '
  'session_date for a genuinely overnight booking that crosses midnight '
  '(e.g. session_date = Friday, session_end_date = Saturday). Nullable only '
  'for an is_addon booking (no studio room time reserved at all, per '
  '0019_addon_bookings.sql''s consistency rule) — never null for a real '
  'session booking. See bookings_session_fields_consistent below for the '
  'updated all-or-nothing check, and book_session (0037) for how this is '
  'computed via plain timestamp arithmetic so it correctly overflows into '
  'the next calendar day rather than wrapping.';

-- Extend the existing all-or-nothing consistency rule (0019) to include
-- session_end_date: still null only together (is_addon) or not-null
-- together (real session booking). Drop and recreate rather than ALTER,
-- matching 0019's own pattern of dropping the old constraint by name first.
alter table public.bookings
  drop constraint if exists bookings_session_fields_consistent;

alter table public.bookings
  add constraint bookings_session_fields_consistent check (
    (
      session_date is null
      and session_start_time is null
      and session_end_date is null
      and session_end_time is null
    )
    or
    (
      session_date is not null
      and session_start_time is not null
      and session_end_date is not null
      and session_end_time is not null
    )
  );

-- =============================================================================
-- 3. Drop availability_slots and bookings.slot_id
-- =============================================================================
-- Confirmed safe by the pre-flight check at the top of this file. Drop the
-- column before the table so there's no dangling FK reference order issue,
-- though `drop table` with no `cascade` would also fail loudly (not
-- silently corrupt anything) if a reference still existed — explicit column
-- drop first is simply the clearer order of operations.
alter table public.bookings
  drop column if exists slot_id;

drop table if exists public.availability_slots;

drop type if exists public.availability_status;
