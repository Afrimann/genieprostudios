-- 0007_reminder_log.sql
-- Audit trail of reminder notifications sent to customers (e.g. the 24-hour
-- balance-due reminder cadence). Written by the cron/reminder job only.

create table if not exists public.reminder_log (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id),
  sent_at timestamptz not null default now(),
  type text not null
);

comment on table public.reminder_log is
  'Audit log of reminders sent for a booking (e.g. type=''balance_due_24h''). '
  'Service-role write only, used by the reminder cron to avoid duplicate sends.';

alter table public.reminder_log enable row level security;

create index if not exists reminder_log_booking_id_idx on public.reminder_log (booking_id);
