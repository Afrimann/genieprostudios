-- 0004_tc_acceptances.sql
-- Proof of Terms & Conditions acceptance, recorded per booking (not per account).
-- Created before `bookings` so bookings.tc_acceptance_id can FK to it directly
-- without a deferred ALTER TABLE step.
--
-- booking_id is nullable here because acceptance happens in the flow *before*
-- the booking row necessarily exists yet (T&Cs gate comes before payment/booking
-- creation) — BookingService is responsible for back-filling it once the
-- booking is created, and bookings.tc_acceptance_id is the canonical link back.

create table if not exists public.tc_acceptances (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id),
  booking_id uuid, -- FK added in 0005 after public.bookings exists (mutual forward ref)
  terms_version text not null,
  accepted_at timestamptz not null default now(),
  ip_address text
);

comment on table public.tc_acceptances is
  'Proof of T&Cs acceptance: timestamp, terms version, and IP. Recorded per '
  'booking, not per account. accepted_at is server-set via DEFAULT NOW() and '
  'must never be trusted from client input at the application layer either.';

comment on column public.tc_acceptances.accepted_at is
  'Server-set only (DEFAULT NOW()). The app layer (Server Action) must not '
  'accept or forward a client-supplied timestamp for this column.';

alter table public.tc_acceptances enable row level security;

create index if not exists tc_acceptances_customer_id_idx
  on public.tc_acceptances (customer_id);
