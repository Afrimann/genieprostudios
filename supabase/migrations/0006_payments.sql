-- 0006_payments.sql
-- Append-only ledger of payment attempts/results. Written exclusively by the
-- server-only Paystack integration (initiate + webhook handler) via the
-- service-role client — never by the frontend directly.

create type public.payment_type as enum ('deposit', 'balance');
create type public.payment_status as enum ('pending', 'success', 'failed');

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id),
  paystack_reference text unique,
  type public.payment_type not null,
  amount_kobo bigint not null,
  status public.payment_status not null default 'pending',
  verified_at timestamptz,
  raw_webhook_payload jsonb,
  created_at timestamptz not null default now()
);

comment on table public.payments is
  'Append-only payment ledger. Row is created (status=pending) when a Paystack '
  'transaction is initiated server-side, then updated to success/failed only '
  'by the webhook handler after signature verification. raw_webhook_payload '
  'retains the full payload for audit/debugging.';

comment on column public.payments.verified_at is
  'Set by the webhook handler at the moment Paystack signature + status are '
  'verified server-side — never derived from client-side redirect.';

alter table public.payments enable row level security;

create index if not exists payments_booking_id_idx on public.payments (booking_id);
create index if not exists payments_status_idx on public.payments (status);
