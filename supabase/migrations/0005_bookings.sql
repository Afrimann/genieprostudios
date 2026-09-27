-- 0005_bookings.sql
-- Core booking record. slot_id is UNIQUE + NOT NULL so a given availability
-- slot can back at most one booking ever (see BookingService for the atomic
-- open->booked slot claim that must happen in the same transaction as this
-- insert to prevent double-booking under concurrent requests).

create type public.booking_status as enum (
  'pending_deposit',
  'deposited',
  'paid_in_full',
  'auto_cancelled',
  'cancelled'
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id),
  service_id uuid not null references public.services (id),
  slot_id uuid not null unique references public.availability_slots (id),
  session_date date not null,
  session_start_time time not null,
  session_end_time time not null,
  total_price_kobo bigint not null,
  deposit_amount_kobo bigint not null,
  amount_paid_kobo bigint not null default 0,
  status public.booking_status not null default 'pending_deposit',
  tc_acceptance_id uuid references public.tc_acceptances (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.bookings is
  'One row per booking attempt. slot_id is UNIQUE so a slot can never back '
  'more than one booking; the transition of the linked availability_slots row '
  'from open -> booked must happen atomically with this insert (e.g. a single '
  'RPC/transaction with a conditional UPDATE ... WHERE status = ''open'') to '
  'prevent double-booking under concurrent requests. Never rely on the '
  'frontend having already removed the slot from its local view.';

comment on column public.bookings.status is
  'pending_deposit: created, awaiting Paystack deposit webhook. '
  'deposited: >=70% deposit verified by webhook. '
  'paid_in_full: balance also verified by webhook. '
  'auto_cancelled: balance unpaid by the 24h-before-session cutoff, released by cron. '
  'cancelled: manually cancelled. '
  'A booking is only ever moved to deposited/paid_in_full by the Paystack '
  'webhook handler after signature+status verification — never on client-side '
  'redirect alone.';

comment on column public.bookings.tc_acceptance_id is
  'FK to tc_acceptances. Nullable at the DB level because tc_acceptances can '
  'be recorded slightly before the booking row exists in the flow, but '
  'BookingService.book() must refuse to proceed to payment without a valid, '
  'linked acceptance for the current terms_version.';

alter table public.tc_acceptances
  add constraint tc_acceptances_booking_id_fkey
  foreign key (booking_id) references public.bookings (id);

alter table public.bookings enable row level security;

create index if not exists bookings_customer_id_idx on public.bookings (customer_id);
create index if not exists bookings_status_idx on public.bookings (status);
create index if not exists bookings_session_date_idx on public.bookings (session_date);

-- Keep updated_at current on every row change.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Generic trigger function: stamps updated_at = now() on UPDATE. Reused by any table with an updated_at column.';

drop trigger if exists bookings_set_updated_at on public.bookings;

create trigger bookings_set_updated_at
  before update on public.bookings
  for each row
  execute function public.set_updated_at();
