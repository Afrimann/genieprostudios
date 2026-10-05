-- 0033_session_attendance.sql
-- The actual clock in / clock out record behind /frontdesk (2026-10-05 client
-- request: "any session that has reached its time must be clocked in by a
-- staff and also clocked out").
--
-- WHY A SEPARATE TABLE INSTEAD OF COLUMNS ON bookings
-- Two independent reasons, either of which would be sufficient:
--
--   1. bookings.status is the PAYMENT lifecycle (pending_deposit ->
--      deposited -> paid_in_full, plus the two cancellations), and the
--      Paystack webhook owns it — see 0005's column comment, which states a
--      booking is only ever moved to deposited/paid_in_full by the verified
--      webhook. Attendance is an orthogonal axis: a paid_in_full booking can
--      be awaiting, in progress, completed or a no-show. Folding those into
--      the same enum would mean every existing query, policy, cron sweep and
--      RPC that reasons about payment state would have to learn about
--      attendance state, and a clock-out would be writing to the same column
--      the webhook writes to.
--
--   2. RLS is row-level, not column-level — the lesson 0031 was written to
--      fix. Putting clocked_in_at on bookings would require giving reception
--      an UPDATE grant on a table that also holds total_price_kobo,
--      amount_paid_kobo and status, and nothing in Postgres RLS would stop a
--      receptionist from writing those instead. A separate table makes the
--      blast radius of a front desk write exactly "attendance", structurally.
--
-- State is DERIVED, never stored, so there is no second status column to
-- drift out of sync with the timestamps:
--   no row                            -> awaiting
--   clocked_in_at, no clocked_out_at  -> in progress
--   clocked_out_at                    -> completed
--   no_show_at                        -> no-show
-- A session is "overdue" when it is awaiting and session_start_at() has
-- passed; "running over" when it is in progress past session_end_time. Both
-- are computed at read time from data already here.

create table if not exists public.session_attendance (
  -- PK, not just FK: one attendance record per booking, enforced by the
  -- database rather than by the RPCs remembering to check. The clock-in RPC
  -- relies on this for its ON CONFLICT upsert.
  booking_id uuid primary key references public.bookings (id) on delete cascade,

  clocked_in_at timestamptz,
  clocked_in_by uuid references public.profiles (id),

  clocked_out_at timestamptz,
  clocked_out_by uuid references public.profiles (id),

  no_show_at timestamptz,
  no_show_by uuid references public.profiles (id),

  -- Outstanding balance in kobo at the moment of clock-in, frozen. The client
  -- decided (2026-10-05) that reception may let someone with an unpaid
  -- balance into the booth after an explicit confirmation, so the owner needs
  -- to be able to see afterwards that it happened and how much was owed. It
  -- has to be a snapshot: the customer may well pay later that same day, at
  -- which point bookings.amount_paid_kobo no longer tells you anything about
  -- what the desk was looking at when they waved them through.
  clock_in_balance_kobo bigint,

  -- Free text from the desk ("arrived 20 min late", "engineer running over").
  -- The clock-in RPC also appends its own line here when an unpaid balance is
  -- overridden, so this is an audit trail as much as a notepad.
  note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- The state machine, enforced in the database so it holds even if a future
  -- RPC or a service-role script gets it wrong.
  constraint session_attendance_out_requires_in
    check (clocked_out_at is null or clocked_in_at is not null),
  constraint session_attendance_out_after_in
    check (clocked_out_at is null or clocked_out_at >= clocked_in_at),
  constraint session_attendance_no_show_xor_attended
    check (no_show_at is null or clocked_in_at is null)
);

comment on table public.session_attendance is
  'Clock in / clock out record for a booked session, written by front desk
  staff at /frontdesk. One row per booking, created on first clock-in (or on
  being marked a no-show) — the absence of a row means "awaiting". All writes
  go through the frontdesk_* SECURITY DEFINER RPCs below; there are
  deliberately no INSERT/UPDATE/DELETE policies on this table.';

comment on column public.session_attendance.clocked_in_by is
  'Which staff member pressed the button. The client chose individual staff
  logins over a shared desk account (2026-10-05) specifically so this is
  answerable — it is what makes a later dispute about an overtime charge or a
  no-show resolvable.';

comment on column public.session_attendance.clock_in_balance_kobo is
  'Outstanding balance in kobo at clock-in, snapshotted by frontdesk_clock_in().
  0 for a fully paid session. Non-zero means the desk used the unpaid-balance
  override — see the note column for the audit line.';

alter table public.session_attendance enable row level security;

drop trigger if exists session_attendance_set_updated_at on public.session_attendance;

create trigger session_attendance_set_updated_at
  before update on public.session_attendance
  for each row
  execute function public.set_updated_at();

-- No extra indexes. The board reads this table by booking_id (the primary
-- key) for a set of bookings already narrowed to a single day by
-- bookings_session_date_idx, and the table grows by roughly the number of
-- sessions the studio actually runs. Add a partial index if and when a real
-- query is slow, not now.

-- ---------------------------------------------------------------------------
-- RLS: read-only, and only through the RPCs for writes
-- ---------------------------------------------------------------------------
-- Same three-day Lagos window the front desk sees on bookings (0032), kept
-- consistent by reusing lagos_today() rather than restating the arithmetic.
drop policy if exists "session_attendance_select_frontdesk" on public.session_attendance;
create policy "session_attendance_select_frontdesk"
  on public.session_attendance
  for select
  to authenticated
  using (
    public.can_use_frontdesk()
    and exists (
      select 1
      from public.bookings b
      where b.id = session_attendance.booking_id
        and b.session_date between public.lagos_today() - 1 and public.lagos_today() + 1
    )
  );

drop policy if exists "session_attendance_select_admin" on public.session_attendance;
create policy "session_attendance_select_admin"
  on public.session_attendance
  for select
  to authenticated
  using (public.is_admin());

-- Deliberately no insert/update/delete policy for anyone, mirroring the
-- bookings table's own "all writes happen through a verified server path"
-- stance (0010). Every transition below is a SECURITY DEFINER RPC that stamps
-- auth.uid() and now() itself, so a receptionist cannot backdate a session,
-- attribute it to a colleague, or clock out a session that was never clocked
-- in — none of which a plain RLS-governed UPDATE could prevent.

-- ---------------------------------------------------------------------------
-- frontdesk_clock_in()
-- ---------------------------------------------------------------------------
-- p_override_unpaid is the server half of the confirmation dialog: the first
-- call for a booking with an outstanding balance raises 'balance_outstanding',
-- the UI shows the amount and asks the staff member to confirm, and the
-- retry passes true. Enforcing it here rather than only in the UI means the
-- override is a real, logged decision and not something a stale client can
-- skip silently.
create or replace function public.frontdesk_clock_in(
  p_booking_id uuid,
  p_override_unpaid boolean default false,
  p_note text default null
)
returns public.session_attendance
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_balance_kobo bigint;
  v_note text;
  v_row public.session_attendance;
begin
  -- SECURITY DEFINER means this runs as the function owner, so the role
  -- check has to be explicit and has to come first — exactly the reasoning
  -- in book_slot_and_create_booking (0013). auth.uid() reflects the caller's
  -- actual JWT and cannot be spoofed, so it is also the only acceptable
  -- source for clocked_in_by.
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  if not public.can_use_frontdesk() then
    raise exception 'frontdesk_required';
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id;

  if v_booking is null then
    raise exception 'booking_not_found';
  end if;

  -- Mirrors the status filter on bookings_select_frontdesk (0032): anything
  -- outside these two is not a session that is expected to happen, and a
  -- front desk caller cannot even see it on the board. Checked again here
  -- because the RPC is SECURITY DEFINER and therefore read the row above
  -- with RLS bypassed — the policy is not protecting this code path.
  if v_booking.status not in ('deposited', 'paid_in_full') then
    raise exception 'booking_not_active';
  end if;

  v_balance_kobo := greatest(v_booking.total_price_kobo - v_booking.amount_paid_kobo, 0);

  if v_balance_kobo > 0 and not coalesce(p_override_unpaid, false) then
    raise exception 'balance_outstanding';
  end if;

  v_note := p_note;

  if v_balance_kobo > 0 then
    v_note := concat_ws(
      E'\n',
      v_note,
      format(
        'Clocked in with %s kobo outstanding, confirmed by staff.',
        v_balance_kobo
      )
    );
  end if;

  -- The upsert is what makes this safe under two tablets pressing the button
  -- on the same session at the same time. Whichever transaction gets there
  -- second finds a conflicting row, falls into DO UPDATE, fails its WHERE
  -- (clocked_in_at is no longer null), updates zero rows, and so RETURNING
  -- hands back nothing — v_row stays null and the loser gets a clean
  -- 'already_clocked_in' instead of silently overwriting the first staff
  -- member's timestamp and name.
  --
  -- The same WHERE deliberately lets a no-show row through: a customer who
  -- was written off and then walks in forty minutes later is a real evening
  -- at a studio, and clocking them in clears the no-show rather than
  -- requiring someone to go and undo it first.
  insert into public.session_attendance as sa (
    booking_id,
    clocked_in_at,
    clocked_in_by,
    clock_in_balance_kobo,
    note
  )
  values (
    p_booking_id,
    now(),
    auth.uid(),
    v_balance_kobo,
    v_note
  )
  on conflict (booking_id) do update
    set clocked_in_at = excluded.clocked_in_at,
        clocked_in_by = excluded.clocked_in_by,
        clock_in_balance_kobo = excluded.clock_in_balance_kobo,
        no_show_at = null,
        no_show_by = null,
        -- concat_ws skips nulls, so an existing note is preserved and the
        -- new line appended; a previously-null note just becomes the line.
        -- The nullif keeps "no note at all" as NULL rather than letting
        -- concat_ws turn two nulls into an empty string, which would render
        -- as a blank note row at the desk.
        note = nullif(concat_ws(E'\n', sa.note, excluded.note), '')
    where sa.clocked_in_at is null
  returning * into v_row;

  if v_row is null then
    raise exception 'already_clocked_in';
  end if;

  return v_row;
end;
$$;

comment on function public.frontdesk_clock_in(uuid, boolean, text) is
  'Front desk: marks a booked session as started. Stamps now() and auth.uid()
  server-side — never trusts a client clock or a caller-supplied staff id.
  Raises auth_required / frontdesk_required / booking_not_found /
  booking_not_active / balance_outstanding / already_clocked_in.
  balance_outstanding is the expected first response for an unpaid booking:
  show the amount, confirm with the staff member, retry with
  p_override_unpaid => true, and the override is recorded in the note and in
  clock_in_balance_kobo.';

-- ---------------------------------------------------------------------------
-- frontdesk_clock_out()
-- ---------------------------------------------------------------------------
create or replace function public.frontdesk_clock_out(
  p_booking_id uuid,
  p_note text default null
)
returns public.session_attendance
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.session_attendance;
  v_exists boolean;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  if not public.can_use_frontdesk() then
    raise exception 'frontdesk_required';
  end if;

  -- Conditional UPDATE rather than read-then-write: the WHERE clause is the
  -- concurrency guard, so two staff clocking out the same session can only
  -- produce one winning write.
  update public.session_attendance as sa
  set clocked_out_at = now(),
      clocked_out_by = auth.uid(),
      note = nullif(concat_ws(E'\n', sa.note, p_note), '')
  where sa.booking_id = p_booking_id
    and sa.clocked_in_at is not null
    and sa.clocked_out_at is null
  returning * into v_row;

  if v_row is null then
    -- Zero rows updated means one of three things, and the desk deserves to
    -- be told which: the session was never clocked in, or it has already
    -- been clocked out, or the booking id is wrong.
    select true into v_exists
    from public.session_attendance
    where booking_id = p_booking_id
      and clocked_out_at is not null;

    if v_exists then
      raise exception 'already_clocked_out';
    end if;

    raise exception 'not_clocked_in';
  end if;

  return v_row;
end;
$$;

comment on function public.frontdesk_clock_out(uuid, text) is
  'Front desk: marks a started session as completed. Stamps now() and
  auth.uid() server-side. Raises auth_required / frontdesk_required /
  already_clocked_out / not_clocked_in. Does not compute or charge overtime —
  the elapsed-vs-scheduled comparison is a read-time concern, and any money
  attached to it is a separate decision the owner has not made yet.';

-- ---------------------------------------------------------------------------
-- frontdesk_mark_no_show()
-- ---------------------------------------------------------------------------
create or replace function public.frontdesk_mark_no_show(
  p_booking_id uuid,
  p_note text default null
)
returns public.session_attendance
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_row public.session_attendance;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  if not public.can_use_frontdesk() then
    raise exception 'frontdesk_required';
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id;

  if v_booking is null then
    raise exception 'booking_not_found';
  end if;

  if v_booking.status not in ('deposited', 'paid_in_full') then
    raise exception 'booking_not_active';
  end if;

  -- A session cannot be a no-show before it was due to start. Uses
  -- session_start_at() (0016) rather than comparing the naive columns
  -- against now() directly, since now() is timestamptz and session_date /
  -- session_start_time carry no timezone of their own.
  if public.session_start_at(v_booking.session_date, v_booking.session_start_time) > now() then
    raise exception 'session_not_started';
  end if;

  insert into public.session_attendance as sa (
    booking_id,
    no_show_at,
    no_show_by,
    note
  )
  values (
    p_booking_id,
    now(),
    auth.uid(),
    p_note
  )
  on conflict (booking_id) do update
    set no_show_at = excluded.no_show_at,
        no_show_by = excluded.no_show_by,
        note = nullif(concat_ws(E'\n', sa.note, excluded.note), '')
    where sa.clocked_in_at is null
  returning * into v_row;

  if v_row is null then
    -- The only way to conflict and fail that WHERE is a row that is already
    -- clocked in. Somebody is in the booth; they are not a no-show.
    raise exception 'already_clocked_in';
  end if;

  return v_row;
end;
$$;

comment on function public.frontdesk_mark_no_show(uuid, text) is
  'Front desk: records that a customer never arrived. Only allowed once the
  session start time has passed. Reversible by simply clocking them in — see
  frontdesk_clock_in(), which clears no_show_at. Raises auth_required /
  frontdesk_required / booking_not_found / booking_not_active /
  session_not_started / already_clocked_in.';

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
-- Deny by default, grant narrowly — the same convention as 0013/0016. These
-- are granted to `authenticated` rather than to any narrower role because
-- Postgres roles are not the mechanism here: every one of them performs its
-- own can_use_frontdesk() check as its second statement, so a signed-in
-- customer calling them directly over PostgREST gets 'frontdesk_required'.
revoke all on function public.frontdesk_clock_in(uuid, boolean, text) from public, anon;
grant execute on function public.frontdesk_clock_in(uuid, boolean, text) to authenticated;

revoke all on function public.frontdesk_clock_out(uuid, text) from public, anon;
grant execute on function public.frontdesk_clock_out(uuid, text) to authenticated;

revoke all on function public.frontdesk_mark_no_show(uuid, text) from public, anon;
grant execute on function public.frontdesk_mark_no_show(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
-- Same reasoning as 0028: being in the publication grants no new access,
-- since Realtime re-checks the subscribing connection's RLS exactly like a
-- normal select. This is what lets the reception tablet and the owner's
-- admin view both update the moment anyone clocks a session in or out,
-- instead of two staff members reloading and racing each other.
-- Guarded because adding a table already in the publication raises.
do $$
begin
  alter publication supabase_realtime add table public.session_attendance;
exception
  when duplicate_object then null;
end;
$$;

-- ---------------------------------------------------------------------------
-- VERIFY after applying (as a front desk user, against a booking due today)
-- ---------------------------------------------------------------------------
--   select frontdesk_clock_out('<id>');            -- not_clocked_in
--   select frontdesk_clock_in('<unpaid id>');      -- balance_outstanding
--   select frontdesk_clock_in('<unpaid id>', true);-- ok, note + balance set
--   select frontdesk_clock_in('<unpaid id>', true);-- already_clocked_in
--   select frontdesk_clock_out('<id>');            -- ok
--   select frontdesk_clock_out('<id>');            -- already_clocked_out
-- As an ordinary customer:
--   select frontdesk_clock_in('<any id>');         -- frontdesk_required
--   insert into session_attendance ...;            -- blocked, no policy
-- ---------------------------------------------------------------------------
