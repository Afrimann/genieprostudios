-- 0039_unresolved_sessions_and_realtime.sql
-- Two cleanup items that fall out of dropping availability_slots/slot_id
-- (0036) and adding book_session/blocked_time_ranges (0036/0037):
--
--   1. bookings_unresolved_past_sessions() (0017) still returned slot_id in
--      its `returns table` list — that column no longer exists on
--      bookings, so the function would fail to even load/compile after
--      0036's `alter table ... drop column slot_id`. Recreated here with
--      slot_id removed and session_end_date added, matching the same
--      display-only addition made to the three 0016 sweep functions in
--      0038.
--   2. availability_slots was registered in the supabase_realtime
--      publication (0028) — Postgres automatically drops a table from any
--      publication it belongs to when the table itself is dropped (0036),
--      so no explicit DROP ... FROM PUBLICATION is needed there. This
--      migration instead ADDS blocked_time_ranges and equipment_items to
--      the publication, so the admin availability UI's existing live-
--      refresh pattern (useRealtimeRefresh subscribing to table changes,
--      see components/admin/availability-manager.tsx) keeps working
--      against the new table, and the (currently UI-less, backend-only per
--      this migration's scope) equipment admin surface is ready for the
--      same pattern once the frontend adds it.

-- ---------------------------------------------------------------------------
-- 1. bookings_unresolved_past_sessions(): drop slot_id, add session_end_date
-- ---------------------------------------------------------------------------
-- slot_id is removed and session_end_date is inserted mid-list (not appended
-- at the end), so create or replace alone hits 42P13 ("cannot change return
-- type of existing function") — drop first, same fix as 0038.
drop function if exists public.bookings_unresolved_past_sessions();

create or replace function public.bookings_unresolved_past_sessions()
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
  amount_paid_kobo bigint,
  status public.booking_status
)
language plpgsql
security invoker
stable
as $$
begin
  if not public.is_admin() then
    raise exception 'admin_required';
  end if;

  return query
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
    b.amount_paid_kobo,
    b.status
  from public.bookings b
  where b.status in ('deposited', 'auto_cancelled')
    and b.amount_paid_kobo < b.total_price_kobo
    and public.session_start_at(b.session_date, b.session_start_time) <= now()
  order by b.session_date desc, b.session_start_time desc;
end;
$$;

comment on function public.bookings_unresolved_past_sessions() is
  'Admin-facing: bookings whose session has already started/passed, still '
  'carrying an unpaid balance, and either still ''deposited'' (never '
  'resolved) or already ''auto_cancelled'' (resolved but not yet '
  'rescheduled). slot_id dropped (0039) now that availability_slots/slot_id '
  'no longer exist (0036) — callers needing to reschedule now pass '
  'session_date/session_start_time directly to admin_reschedule_booking '
  '(0037). session_end_date added alongside session_end_time for '
  'overnight-aware display. Backs the /admin/bookings unresolved list: each '
  'row gets a "mark stale" action (deposited only) and a "reschedule" '
  'action (either status).';

revoke all on function public.bookings_unresolved_past_sessions() from public;
revoke all on function public.bookings_unresolved_past_sessions() from anon;
grant execute on function public.bookings_unresolved_past_sessions() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Realtime publication: add the new tables
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.blocked_time_ranges;
alter publication supabase_realtime add table public.equipment_items;
