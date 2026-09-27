-- 0013_book_slot_rpc.sql
-- Customer-facing RPC that atomically claims an open availability_slots row
-- and creates the corresponding bookings row in a single transaction. This
-- is the ONLY customer write path onto availability_slots — see 0010's note
-- that there is intentionally no customer-facing UPDATE policy on that
-- table, since a plain RLS-governed UPDATE from the client could never do
-- the "claim slot + insert booking, all-or-nothing" atomicity this requires.
--
-- SECURITY DEFINER is required because the function needs to write to
-- availability_slots (customers have no UPDATE grant there via RLS) and to
-- bookings (customers have no INSERT policy there either, per 0010). Both
-- of those restrictions stay intentional and unchanged; this function is the
-- single, tightly-scoped exception, and it is not allowed to trust ANY
-- caller-supplied identity — customer_id is always taken from auth.uid().

create or replace function public.book_slot_and_create_booking(
  p_slot_id uuid,
  p_service_id uuid
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot public.availability_slots;
  v_service public.services;
  v_deposit_kobo bigint;
  v_booking public.bookings;
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

  -- Atomically claim the slot: this UPDATE only affects a row that is
  -- currently 'open'. Under concurrent requests for the same slot, Postgres
  -- row-level locking ensures only one concurrent transaction's UPDATE can
  -- win the race for a given row; the loser's WHERE status = 'open' simply
  -- matches zero rows once the winner's row is committed (or it blocks
  -- briefly on the row lock and then sees status already 'booked' and
  -- matches zero rows). Either way, at most one caller ever gets a non-null
  -- v_slot back for a given slot id.
  update public.availability_slots
  set status = 'booked'
  where id = p_slot_id
    and status = 'open'
  returning * into v_slot;

  if v_slot is null then
    -- Slot did not exist, or was not 'open' (already booked/closed by
    -- someone else, possibly the concurrent request that won the race
    -- above). Raising here aborts the current function invocation's
    -- transaction/subtransaction: Postgres rolls back every write the
    -- function has performed so far (there are none yet at this point,
    -- since the UPDATE above only ran if v_slot ended up null, i.e. it
    -- affected zero rows — there is nothing to roll back in that case).
    -- This exception is intentionally left uncaught (no EXCEPTION block in
    -- this function) so it propagates straight to the caller and the whole
    -- RPC call fails cleanly with no partial effect.
    raise exception 'slot_unavailable';
  end if;

  select * into v_service
  from public.services
  where id = p_service_id
    and active = true;

  if v_service is null then
    -- IMPORTANT: raising here rolls back the slot UPDATE above too. A
    -- plpgsql function body executes as an implicit transaction block (or
    -- subtransaction, if called from within a larger transaction); an
    -- uncaught exception anywhere in that body aborts the whole block, and
    -- Postgres undoes every write made during it — including the
    -- 'open' -> 'booked' UPDATE performed earlier in this same invocation.
    -- The slot is therefore correctly released back to 'open' as far as
    -- the database is concerned (the UPDATE never durably happened), so an
    -- invalid service id can never strand a slot in 'booked' with no
    -- matching booking.
    raise exception 'invalid_service';
  end if;

  -- ceil() on numeric keeps this bigint-safe: price_kobo is bigint, and
  -- multiplying by 0.7 promotes to numeric, so ceil(...) returns a numeric
  -- that Postgres casts cleanly back to bigint for the bigint column.
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
    p_slot_id,
    v_slot.date,
    v_slot.start_time,
    v_slot.end_time,
    v_service.price_kobo,
    v_deposit_kobo,
    'pending_deposit'
  )
  returning * into v_booking;

  return v_booking;
end;
$$;

comment on function public.book_slot_and_create_booking(uuid, uuid) is
  'Customer-facing SECURITY DEFINER RPC: atomically claims an open '
  'availability_slots row (open -> booked, conditional on current status to '
  'prevent double-booking under concurrent requests) and inserts the '
  'matching bookings row in the same transaction. customer_id is always '
  'auth.uid(), never a parameter, so a caller can never impersonate another '
  'customer. Raises ''slot_unavailable'' if the slot is missing/not open, '
  'or ''invalid_service'' if the service is missing/inactive; both cases '
  'roll back any writes already made in this invocation (including the '
  'slot claim), since there is no EXCEPTION block here to swallow the '
  'error. Booking status always starts at ''pending_deposit'' — this RPC '
  'never marks a booking confirmed/paid; that only happens via the '
  'Paystack webhook handler (server-role client, Phase 3).';

-- Explicit least-privilege grants: only signed-in customers may call this.
-- Follows the same "deny by default, grant narrowly" convention used
-- throughout 0010_rls_policies.sql (e.g. no anon write policies anywhere).
-- Revoke first so this stays correct even if a future Postgres/Supabase
-- default grants EXECUTE more broadly than intended.
revoke all on function public.book_slot_and_create_booking(uuid, uuid) from public;
revoke all on function public.book_slot_and_create_booking(uuid, uuid) from anon;
grant execute on function public.book_slot_and_create_booking(uuid, uuid) to authenticated;
