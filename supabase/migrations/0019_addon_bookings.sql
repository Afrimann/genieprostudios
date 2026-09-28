-- 0019_addon_bookings.sql
-- Real gap found (2026-09-28): the two is_addon services (Mixing &
-- Mastering, Mix + Master Bundle — "per song", duration_hours = 0, see
-- 0002_services.sql) were still forced through the full studio-room
-- date -> window -> start-time picker, and getValidStartTimesForWindow
-- (lib/services/availability-service.ts) throws for duration_hours = 0 —
-- these two real, priced services were completely unbookable. They're
-- queue/SLA-based deliverables ("5-day queue after deposit", "24-hour
-- turnaround" — see lib/content/package-details.ts), not room bookings, so
-- the fix is to let them skip scheduling entirely rather than inventing a
-- fake time slot for them.
--
-- This migration makes the four "studio room time" columns on `bookings`
-- nullable (only ever null together, enforced by a check constraint) and
-- adds create_addon_booking(), the addon equivalent of
-- book_slot_and_create_booking() (0014/0018) — no window to lock, no
-- overlap/grid/buffer check, since there's no physical time being reserved.

alter table public.bookings
  alter column slot_id drop not null,
  alter column session_date drop not null,
  alter column session_start_time drop not null,
  alter column session_end_time drop not null;

alter table public.bookings
  drop constraint if exists bookings_session_fields_consistent;

alter table public.bookings
  add constraint bookings_session_fields_consistent check (
    (slot_id is null and session_date is null and session_start_time is null and session_end_time is null)
    or
    (slot_id is not null and session_date is not null and session_start_time is not null and session_end_time is not null)
  );

comment on column public.bookings.slot_id is
  'FK to availability_slots (the "window" this booking was carved from). '
  'NULL for an is_addon booking (per-song mixing/mastering) — those have no '
  'studio room time to reserve at all, see create_addon_booking(). Never '
  'null for a real session booking (book_slot_and_create_booking). See '
  'bookings_session_fields_consistent for the all-or-nothing rule across '
  'slot_id/session_date/session_start_time/session_end_time.';

-- Every downstream reader that combines session_date/session_start_time via
-- session_start_at() (0016) — bookings_needing_balance_reminder,
-- bookings_needing_autocancel, bookings_unresolved_past_sessions (0017) —
-- already handles this safely with no further changes needed: SQL's NULL
-- propagation makes session_start_at(null, null) evaluate to NULL, and
-- `NULL > x` / `NULL <= x` are never TRUE, so an addon booking (no session)
-- is simply never matched by any of those session-time-based predicates.
-- stale_pending_bookings() doesn't reference session_date/time at all, so
-- an abandoned addon checkout still gets cleaned up correctly after 30
-- minutes.

-- Customer-facing SECURITY DEFINER RPC, addon equivalent of
-- book_slot_and_create_booking (0014/0018). No window to lock (FOR UPDATE)
-- and no overlap/grid/bounds check — there is no physical time being
-- reserved, so none of that applies. Only real work: verify the service is
-- an active, is_addon row, then insert with every session-time column
-- explicitly null.
create or replace function public.create_addon_booking(
  p_service_id uuid
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service public.services;
  v_deposit_kobo bigint;
  v_booking public.bookings;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  select *
  into v_service
  from public.services
  where id = p_service_id
    and active = true;

  if v_service is null then
    raise exception 'invalid_service';
  end if;

  if v_service.is_addon is not true then
    -- Guards against this RPC being called directly (bypassing the UI) for
    -- a real, room-time service — those must go through
    -- book_slot_and_create_booking instead, which is the only path that
    -- actually reserves a time range.
    raise exception 'not_an_addon';
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
    null,
    null,
    null,
    null,
    v_service.price_kobo,
    v_deposit_kobo,
    'pending_deposit'
  )
  returning * into v_booking;

  return v_booking;
end;
$$;

comment on function public.create_addon_booking(uuid) is
  'Customer-facing SECURITY DEFINER RPC: creates a bookings row for an '
  'is_addon service (p_service_id) with no studio room time reserved — '
  'slot_id/session_date/session_start_time/session_end_time all left null. '
  'customer_id is always auth.uid(), never a parameter. Raises: '
  '''auth_required'' (not signed in), ''invalid_service'' (missing/'
  'inactive), ''not_an_addon'' (service exists but is_addon = false — use '
  'book_slot_and_create_booking instead). Booking status always starts at '
  '''pending_deposit'', same as the room-booking RPC.';

revoke all on function public.create_addon_booking(uuid) from public;
revoke all on function public.create_addon_booking(uuid) from anon;
grant execute on function public.create_addon_booking(uuid) to authenticated;
