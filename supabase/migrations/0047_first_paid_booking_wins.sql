-- Unpaid bookings never reserve a time (0040). If two customers reach
-- Paystack for the same time, serialize successful confirmations and let
-- the first confirmed payment keep the slot. The later charge is recorded
-- explicitly for an operator to refund rather than confirming both sessions.

alter type public.payment_status add value if not exists 'refund_required';

create or replace function public.confirm_booking_payment(
  p_reference text,
  p_verified_at timestamptz,
  p_raw_payload jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments;
  v_booking public.bookings;
  v_previous_status public.booking_status;
  v_new_status public.booking_status;
  v_new_amount_paid bigint;
  v_buffer_minutes constant int := 30;
begin
  select *
  into v_payment
  from public.payments
  where paystack_reference = p_reference
  for update;

  if not found then
    return jsonb_build_object('outcome', 'not_found');
  end if;

  select *
  into v_booking
  from public.bookings
  where id = v_payment.booking_id
  for update;

  if not found then
    return jsonb_build_object('outcome', 'error', 'message', 'Booking not found');
  end if;

  if v_payment.status <> 'pending' then
    if v_payment.status = 'refund_required' then
      return jsonb_build_object(
        'outcome', 'refund_required',
        'new_status', v_booking.status,
        'booking_id', v_booking.id
      );
    end if;

    return jsonb_build_object(
      'outcome', 'already_processed',
      'new_status', v_booking.status
    );
  end if;

  v_previous_status := v_booking.status;

  if v_booking.session_date is not null
     and v_booking.status in ('pending_deposit', 'cancelled', 'auto_cancelled') then
    perform pg_advisory_xact_lock(hashtext(v_booking.session_date::text));
    if v_booking.session_end_date <> v_booking.session_date then
      perform pg_advisory_xact_lock(hashtext(v_booking.session_end_date::text));
    end if;

    if exists (
      select 1
      from public.blocked_time_ranges bt
      where bt.date in (v_booking.session_date, v_booking.session_end_date)
        and (v_booking.session_date + v_booking.session_start_time)::timestamp
              - (v_buffer_minutes || ' minutes')::interval
            < (bt.date + bt.end_time)::timestamp
        and (v_booking.session_end_date + v_booking.session_end_time)::timestamp
              + (v_buffer_minutes || ' minutes')::interval
            > (bt.date + bt.start_time)::timestamp
    ) or exists (
      select 1
      from public.bookings b
      where b.id <> v_booking.id
        and b.session_date between (v_booking.session_date - 1) and v_booking.session_end_date
        and b.status in ('deposited', 'paid_in_full')
        and (v_booking.session_date + v_booking.session_start_time)::timestamp
              - (v_buffer_minutes || ' minutes')::interval
            < (b.session_end_date + b.session_end_time)::timestamp
        and (v_booking.session_end_date + v_booking.session_end_time)::timestamp
              + (v_buffer_minutes || ' minutes')::interval
            > (b.session_date + b.session_start_time)::timestamp
    ) then
      update public.payments
      set status = 'refund_required',
          verified_at = p_verified_at,
          raw_webhook_payload = p_raw_payload
      where id = v_payment.id;

      update public.bookings
      set status = 'cancelled'
      where id = v_booking.id;

      return jsonb_build_object(
        'outcome', 'refund_required',
        'new_status', 'cancelled',
        'booking_id', v_booking.id
      );
    end if;
  end if;

  v_new_amount_paid := v_booking.amount_paid_kobo + v_payment.amount_kobo;
  v_new_status := v_booking.status;

  if v_new_amount_paid >= v_booking.total_price_kobo then
    v_new_status := 'paid_in_full';
  elsif v_new_amount_paid >= v_booking.deposit_amount_kobo then
    v_new_status := 'deposited';
  end if;

  update public.payments
  set status = 'success',
      verified_at = p_verified_at,
      raw_webhook_payload = p_raw_payload
  where id = v_payment.id;

  update public.bookings
  set amount_paid_kobo = v_new_amount_paid,
      status = v_new_status
  where id = v_booking.id
  returning * into v_booking;

  return jsonb_build_object(
    'outcome', 'applied',
    'new_status', v_new_status,
    'previous_status', v_previous_status,
    'new_amount_paid_kobo', v_new_amount_paid,
    'booking', to_jsonb(v_booking)
  );
end;
$$;

comment on function public.confirm_booking_payment(text, timestamptz, jsonb) is
  'Atomically confirms a Paystack payment and claims its booking time. '
  'Uses the same date advisory locks and 30-minute overlap rule as '
  'book_session. If another paid booking already owns the time, the charge '
  'is marked refund_required and its unpaid booking is cancelled.';

revoke all on function public.confirm_booking_payment(text, timestamptz, jsonb) from public;
revoke all on function public.confirm_booking_payment(text, timestamptz, jsonb) from anon;
revoke all on function public.confirm_booking_payment(text, timestamptz, jsonb) from authenticated;
grant execute on function public.confirm_booking_payment(text, timestamptz, jsonb) to service_role;
