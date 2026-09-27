-- 0014_booking_windows.sql
-- Reworks availability_slots from "one window = at most one booking" into
-- "windows" — the admin still opens a single continuous block of time
-- (e.g. 10:00-18:00), but the customer now picks any 30-minute-grid-aligned
-- start time inside it for their service's duration, and multiple
-- non-overlapping bookings can be carved out of the same window over time.
--
-- This migration:
--   1. Drops the UNIQUE constraint on bookings.slot_id (a window may now
--      back many bookings, not just one), while keeping slot_id NOT NULL
--      (every booking still references exactly one window).
--   2. Drops and recreates book_slot_and_create_booking with a new 3-arg
--      signature that takes a customer-chosen p_start_time and validates it
--      server-side (grid alignment, window bounds, overlap against existing
--      bookings on that window, respecting the same 30-minute buffer used
--      elsewhere in this project) instead of flipping the window itself to a
--      terminal 'booked' status.

-- =============================================================================
-- 1. bookings.slot_id: drop the UNIQUE constraint, keep NOT NULL
-- =============================================================================
-- Verified constraint name: 0005_bookings.sql line 19 declares
--   slot_id uuid not null unique references public.availability_slots (id)
-- as a column-level `unique` with no explicit `constraint <name>` clause (contrast
-- with 0003_availability_slots.sql's `constraint availability_slots_date_start_time_key
-- unique (date, start_time)`, which DOES name itself explicitly — the presence of that
-- explicit-naming convention elsewhere in this codebase, and its absence here, confirms
-- bookings.slot_id's constraint was left to Postgres's default naming rule:
-- `<table>_<column>_key` for a single-column unique constraint. That resolves to
-- `bookings_slot_id_key`. `if exists` makes this statement safe to re-run even if the
-- name were ever wrong (it would simply no-op instead of erroring).
alter table public.bookings
  drop constraint if exists bookings_slot_id_key;

-- slot_id remains NOT NULL — every booking still references exactly one
-- window, it's just no longer the window's exclusive booking. No ALTER
-- needed here since NOT NULL was never touched; this comment documents that
-- omission is intentional, not an oversight.

comment on table public.bookings is
  'One row per booking attempt. slot_id references the availability_slots '
  '"window" it was carved from, but (as of 0014) is NO LONGER unique — a '
  'single window can back many non-overlapping bookings, each with its own '
  'customer-chosen session_start_time/session_end_time within the window''s '
  'bounds. Overlap prevention (including the mandatory 30-minute buffer) now '
  'happens via a row lock on the window (FOR UPDATE) plus an explicit overlap '
  'check against that window''s existing bookings inside '
  'book_slot_and_create_booking, rather than via a conditional UPDATE that '
  'flips the window to a terminal status. Never rely on the frontend having '
  'already removed a time range from its local view.';

comment on column public.bookings.slot_id is
  'FK to availability_slots (the "window" this booking was carved from). '
  'NOT NULL (every booking belongs to exactly one window) but, as of 0014, '
  'no longer UNIQUE — a window stays open and may back multiple '
  'non-overlapping bookings. See book_slot_and_create_booking for the '
  'overlap/buffer enforcement that replaces the old one-booking-per-window '
  'invariant.';

-- =============================================================================
-- 2. book_slot_and_create_booking: drop the old 2-arg version, create the
--    new 3-arg version.
-- =============================================================================
-- Drop the old signature explicitly first (rather than relying on
-- `create or replace`) because the new function has a different argument
-- list (arity changed from 2 to 3) — Postgres treats functions with
-- different signatures as entirely distinct objects, so a stale 2-arg
-- version left in place would otherwise keep working (and keep the old
-- one-booking-per-window behavior reachable) forever alongside the new one.
drop function if exists public.book_slot_and_create_booking(uuid, uuid);

-- Customer-facing RPC that creates a bookings row for a customer-chosen
-- start time inside an open availability_slots "window", after validating
-- (all server-side, never trusting the UI to have already validated any of
-- this):
--   - the caller is authenticated (auth.uid() is not null)
--   - the window exists, is 'open', and is locked for the duration of this
--     transaction (SELECT ... FOR UPDATE) so concurrent requests against the
--     same window serialize instead of racing
--   - the service exists and is active
--   - the requested start time + the service's duration stays inside the
--     window's [start_time, end_time] bounds
--   - the requested start time is aligned to the 30-minute grid (:00 or :30,
--     zero seconds) — the UI only ever offers grid-aligned options, but a
--     direct RPC call bypassing the UI must still be rejected by the RPC
--     itself, not just by the service-layer helper that computes those
--     options (that helper is advisory/UI-supporting only, not a security
--     boundary)
--   - the requested [start, end], padded by the same 30-minute buffer used
--     elsewhere in this project (see SLOT_BUFFER_MINUTES in
--     lib/services/availability-service.ts), does not intersect any
--     existing non-cancelled booking already carved from this same window
--
-- Unlike the pre-0014 version, this function never writes to
-- availability_slots at all — the window stays 'open' regardless of how many
-- bookings are carved from it. It is only ever closed by the explicit admin
-- "Close" action (closeSlot in lib/repositories/availability-repository.ts).
-- The locking mechanism that prevents double-booking under concurrent
-- requests is therefore no longer "conditionally UPDATE the window to a
-- terminal status" (there is no terminal status to flip to anymore, since
-- many bookings can share one window) — it is now "SELECT ... FOR UPDATE the
-- window row so concurrent requests for the *same window* serialize, then
-- have the second (and every subsequent) transaction re-evaluate the overlap
-- check against whatever the first transaction just committed."
--
-- SECURITY DEFINER is still required for the same reason as before: this
-- function writes to bookings (customers have no INSERT policy there via
-- RLS, per 0010) and customer_id must always come from auth.uid(), never a
-- caller-supplied parameter, since a SECURITY DEFINER function runs with the
-- privileges of its owner rather than the caller and could otherwise be used
-- to impersonate another customer.
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
    -- lib/services/availability-service.ts; if that constant ever changes,
    -- update this literal too (kept as a literal rather than reading from a
    -- config table since this project has no such table and introducing one
    -- purely for this would be disproportionate to the problem).
begin
  -- Never trust a caller-supplied customer id: this function is SECURITY
  -- DEFINER (runs with the privileges of the function owner, not the
  -- caller), so if customer_id were taken from a parameter instead of
  -- auth.uid(), any authenticated caller could create bookings that
  -- impersonate a different customer. auth.uid() reflects the actual JWT
  -- of whoever is calling right now and cannot be spoofed by the caller.
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  -- Lock the window row for the remainder of this transaction. This is the
  -- new correctness mechanism replacing the old conditional UPDATE: since
  -- the window is no longer flipped to a terminal status on booking (it can
  -- back many bookings), there is no longer a single UPDATE whose affected-
  -- row-count can serve as the "did I win the race" signal. Instead, FOR
  -- UPDATE takes a row-level lock on this window: any other concurrent
  -- transaction trying to book (or close) the SAME window blocks until this
  -- transaction commits or rolls back, at which point it re-reads the
  -- now-current state (including any bookings just inserted by us) before
  -- doing its own overlap check below. This guarantees two concurrent
  -- requests for overlapping times on the same window can never both
  -- succeed, without requiring the window itself to become unavailable to
  -- every other request regardless of time range.
  select *
  into v_slot
  from public.availability_slots
  where id = p_slot_id
    and status = 'open'
  for update;

  if v_slot is null then
    -- Window missing, never opened, or already closed by the admin. Raising
    -- here (with no EXCEPTION block anywhere in this function) aborts the
    -- whole implicit transaction block, so nothing has been written yet at
    -- this point in any case — there is nothing to roll back.
    raise exception 'slot_unavailable';
  end if;

  select *
  into v_service
  from public.services
  where id = p_service_id
    and active = true;

  if v_service is null then
    -- Raising here still rolls back cleanly even though nothing has been
    -- written yet either (the FOR UPDATE lock above is released
    -- automatically on rollback, same as any other exception path in this
    -- function) — kept as a raise exception (not smothered) so an invalid
    -- service id fails the whole call clearly.
    raise exception 'invalid_service';
  end if;

  -- Compute the session end time from the customer-chosen start time and the
  -- service's duration. `time + interval` in Postgres wraps modulo 24h
  -- rather than overflowing into a following day (e.g. '23:00'::time +
  -- interval '2 hours' = '01:00'::time, NOT '2024-01-02 01:00') — there is no
  -- way for a `time` value to represent "past midnight" at all, so a
  -- genuinely late session that crosses midnight could silently wrap to an
  -- earlier-looking end time here. This migration deliberately does NOT cast
  -- through timestamp to "fix" that, because the immediately-following
  -- bounds check (`v_end_time > v_slot.end_time`) already rejects any
  -- request where the computed end time doesn't fit inside the window: if a
  -- wrap occurred, v_end_time would land on some time earlier in the clock
  -- than p_start_time, and since v_slot.end_time is itself a same-day `time`
  -- value that is never earlier than v_slot.start_time (enforced at window
  -- creation), a wrapped v_end_time can only fail the bounds check, never
  -- incorrectly pass it. In other words: the wrap-around behavior of
  -- `time + interval` cannot produce a false positive here, only a
  -- (correct) rejection of a start time whose duration would run past
  -- midnight. If GenieProStudios ever needs to support windows/sessions that
  -- legitimately span midnight, both availability_slots and this function
  -- would need to move to timestamp-based storage — out of scope for this
  -- migration.
  v_end_time := p_start_time + (v_service.duration_hours || ' hours')::interval;

  -- Bounds check: the full requested session must fit inside the window.
  if p_start_time < v_slot.start_time or v_end_time > v_slot.end_time then
    raise exception 'outside_window';
  end if;

  -- Grid check: reject any start time not aligned to :00 or :30, and reject
  -- any nonzero seconds component too (a `time` value can carry seconds even
  -- though the UI only ever offers whole-minute options) — the UI only ever
  -- offers grid-aligned buttons, but this RPC is reachable directly (e.g. via
  -- supabase-js .rpc() with an arbitrary payload) and must independently
  -- enforce the same rule, not rely on the caller having gone through the
  -- UI.
  if extract(minute from p_start_time)::int not in (0, 30)
     or extract(second from p_start_time) <> 0 then
    raise exception 'invalid_start_time';
  end if;

  -- Overlap check against every existing, still-relevant booking already
  -- carved from this same window. cancelled/auto_cancelled bookings are
  -- excluded because a cancelled booking no longer occupies real studio
  -- time and must not block a new one from reusing that time range.
  --
  -- Padding logic mirrors checkSlotBuffer in
  -- lib/services/availability-service.ts conceptually (pad one side's window
  -- by the buffer and compare raw ranges, which is equivalent to requiring
  -- >= buffer minutes of true gap on whichever side the two ranges are
  -- adjacent from), reimplemented fresh in SQL per the task's instruction —
  -- this function cannot call into TypeScript. Standard overlap predicate:
  -- two ranges [a_start, a_end) and [b_start, b_end) intersect iff
  -- a_start < b_end AND a_end > b_start. Here b is the existing booking's
  -- raw [session_start_time, session_end_time) and a is our proposed range
  -- padded by the buffer on both sides ([p_start_time - buffer, v_end_time +
  -- buffer)) — padding the proposed side only (rather than padding both
  -- sides and halving) keeps this single self-contained predicate exactly
  -- equivalent to "existing booking must keep >= buffer minutes clearance
  -- from the proposed range on either side".
  if exists (
    select 1
    from public.bookings b
    where b.slot_id = p_slot_id
      and b.status not in ('cancelled', 'auto_cancelled')
      and (p_start_time - (v_buffer_minutes || ' minutes')::interval) < b.session_end_time
      and (v_end_time + (v_buffer_minutes || ' minutes')::interval) > b.session_start_time
  ) then
    raise exception 'time_unavailable';
  end if;

  -- ceil() on numeric keeps this bigint-safe: price_kobo is bigint, and
  -- multiplying by 0.7 promotes to numeric, so ceil(...) returns a numeric
  -- that Postgres casts cleanly back to bigint for the bigint column.
  v_deposit_kobo := ceil(v_service.price_kobo * 0.7);

  -- Deliberately does NOT touch availability_slots.status at all — the
  -- window stays 'open' no matter how many bookings are carved from it. It
  -- is only ever closed by the explicit admin "Close" action
  -- (closeSlot()/closeSlotAction() in the availability repository/service),
  -- which is a separate, unrelated write path from this function.
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
  'Customer-facing SECURITY DEFINER RPC (v2, 0014): creates a bookings row '
  'for a customer-chosen start time (p_start_time) inside an open '
  'availability_slots "window" (p_slot_id) for a given service '
  '(p_service_id). Locks the window row with SELECT ... FOR UPDATE (rather '
  'than the pre-0014 conditional UPDATE ... WHERE status = ''open'') so '
  'concurrent requests against the SAME window serialize; each transaction '
  're-checks bounds/grid/overlap against whatever is committed at the time '
  'it acquires the lock, so two overlapping requests can never both '
  'succeed. Never writes to availability_slots — the window stays ''open'' '
  'indefinitely and may back many non-overlapping bookings; it is only '
  'closed by the explicit admin Close action. customer_id is always '
  'auth.uid(), never a parameter, so a caller can never impersonate another '
  'customer. Raises: ''auth_required'' (not signed in), ''slot_unavailable'' '
  '(window missing/not open), ''invalid_service'' (service missing/'
  'inactive), ''outside_window'' (requested start+duration does not fit '
  'inside the window''s bounds), ''invalid_start_time'' (start time not '
  'aligned to the 30-minute grid, or has nonzero seconds), ''time_unavailable'' '
  '(requested range, padded by the 30-minute buffer, overlaps an existing '
  'non-cancelled booking already carved from this window). All of these '
  'roll back any writes already made in this invocation (there is no '
  'EXCEPTION block here to swallow the error). Booking status always starts '
  'at ''pending_deposit'' — this RPC never marks a booking confirmed/paid; '
  'that only happens via the Paystack webhook handler (server-role client, '
  'Phase 3).';

-- Explicit least-privilege grants: only signed-in customers may call this.
-- Follows the same "deny by default, grant narrowly" convention used
-- throughout 0010_rls_policies.sql (e.g. no anon write policies anywhere).
-- Revoke first so this stays correct even if a future Postgres/Supabase
-- default grants EXECUTE more broadly than intended.
revoke all on function public.book_slot_and_create_booking(uuid, uuid, time) from public;
revoke all on function public.book_slot_and_create_booking(uuid, uuid, time) from anon;
grant execute on function public.book_slot_and_create_booking(uuid, uuid, time) to authenticated;
