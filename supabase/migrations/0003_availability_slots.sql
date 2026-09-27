-- 0003_availability_slots.sql
-- Owner-managed availability, opened manually date-by-date (no recurring template).

create type public.availability_status as enum ('open', 'booked', 'closed');

create table if not exists public.availability_slots (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  start_time time not null,
  end_time time not null,
  status public.availability_status not null default 'open',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint availability_slots_date_start_time_key unique (date, start_time)
);

comment on table public.availability_slots is
  'Owner-opened availability, date-by-date (manual, no recurring weekly template). '
  'A slot flips from open -> booked atomically when a booking is created; see '
  'BookingService for the concurrency-safe transition (e.g. a conditional '
  'UPDATE ... WHERE status = ''open'' or an RPC), not enforced here in the schema.';

comment on constraint availability_slots_date_start_time_key on public.availability_slots is
  'Prevents two slots being opened at the same start time on the same date.';

comment on column public.availability_slots.status is
  'open = bookable, booked = taken by a confirmed/in-progress booking, '
  'closed = owner manually withdrew it. Note: the 30-minute setup buffer '
  'between adjacent slots is enforced in application code at slot-creation '
  'time (BookingService/AvailabilityService), NOT as a DB constraint here.';

alter table public.availability_slots enable row level security;

create index if not exists availability_slots_date_status_idx
  on public.availability_slots (date, status);
