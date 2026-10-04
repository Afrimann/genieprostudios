-- 0029_triumph_payments.sql
-- Money ledger behind the Triumph payment-status gate (2026-10-03 client
-- request): the admin moving a project's payment_status to deposit_paid or
-- paid_in_full is now treated as "recording a payment," not just flipping a
-- flag — see record_triumph_payment() below, which is the only path that
-- can move payment_status into either of those two values from this point
-- forward (update_triumph_project_payment_status, 0024, still exists and is
-- still the only path back to 'pending' — a revert isn't a money event, so
-- it doesn't need an amount/receipt/confirmation code; see
-- triumph-admin-actions.ts's comment on that scope decision).
--
-- The confirmation-code check itself happens in application code
-- (triumph-admin-actions.ts), not in this RPC — it's a team-known PIN
-- gating a UI action, not a cryptographic secret an RLS policy could check.
-- This migration only has to make sure the resulting write still can't
-- happen any other way (no insert policy on triumph_payments at all, same
-- "writes only through the RPC" discipline as triumph_project_updates in
-- 0023).

-- ---------------------------------------------------------------------------
-- triumph_payments
-- ---------------------------------------------------------------------------
create table public.triumph_payments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.triumph_projects(id) on delete cascade,
  payment_status public.triumph_payment_status not null,
  amount_kobo bigint not null,
  receipt_path text,
  receipt_name text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  constraint triumph_payments_status_is_a_money_event
    check (payment_status in ('deposit_paid', 'paid_in_full')),
  constraint triumph_payments_amount_non_negative
    check (amount_kobo >= 0)
);

comment on table public.triumph_payments is
  'Append-only ledger of recorded Triumph payments — one row per admin
  confirmation that a deposit or full payment landed, via
  record_triumph_payment() below. payment_status here is never ''pending''
  (that is not a money event). Powers /triumph-admin''s revenue overview
  page the same way public.payments powers the main site''s.';

alter table public.triumph_payments enable row level security;

create policy "triumph_payments_select_admin"
  on public.triumph_payments
  for select
  to authenticated
  using (public.is_admin());

-- No insert/update/delete policy for any role — every write goes through
-- record_triumph_payment() (SECURITY DEFINER) below, same "the ledger can't
-- be edited around the one function that writes it" discipline as
-- triumph_project_updates/create_triumph_project_update in 0023.

-- ---------------------------------------------------------------------------
-- record_triumph_payment: admin-only, atomically inserts the ledger row and
-- advances triumph_projects.payment_status — a recorded payment must never
-- exist without the project actually reflecting it, same reasoning as
-- create_triumph_project_update syncing triumph_projects.status in 0023.
-- ---------------------------------------------------------------------------
create or replace function public.record_triumph_payment(
  p_project_id uuid,
  p_payment_status public.triumph_payment_status,
  p_amount_kobo bigint,
  p_receipt_path text,
  p_receipt_name text
)
returns public.triumph_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.triumph_payments;
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;

  if p_payment_status not in ('deposit_paid', 'paid_in_full') then
    raise exception 'invalid_payment_status';
  end if;

  if p_amount_kobo < 0 then
    raise exception 'invalid_amount';
  end if;

  if not exists (select 1 from public.triumph_projects where id = p_project_id) then
    raise exception 'invalid_project';
  end if;

  insert into public.triumph_payments (project_id, payment_status, amount_kobo, receipt_path, receipt_name, created_by)
  values (p_project_id, p_payment_status, p_amount_kobo, p_receipt_path, p_receipt_name, auth.uid())
  returning * into v_payment;

  update public.triumph_projects
  set payment_status = p_payment_status,
      updated_at = now()
  where id = p_project_id;

  return v_payment;
end;
$$;

comment on function public.record_triumph_payment(
  uuid, public.triumph_payment_status, bigint, text, text
) is
  'Admin-only SECURITY DEFINER RPC — the only way payment_status can move to
  deposit_paid or paid_in_full. Raises: ''not_admin'', ''invalid_payment_status''
  (anything but deposit_paid/paid_in_full), ''invalid_amount'' (negative),
  ''invalid_project''.';

revoke all on function public.record_triumph_payment(
  uuid, public.triumph_payment_status, bigint, text, text
) from public;
revoke all on function public.record_triumph_payment(
  uuid, public.triumph_payment_status, bigint, text, text
) from anon;
grant execute on function public.record_triumph_payment(
  uuid, public.triumph_payment_status, bigint, text, text
) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private bucket for payment receipts (admin-uploaded proof of
-- payment) — kept separate from triumph-deliverables (0023), which is
-- engineer-output-to-client, not admin-input bookkeeping. Same admin-only
-- policy shape; image/PDF mime types instead of audio.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'triumph-receipts',
  'triumph-receipts',
  false,
  10485760, -- 10MB — same Free-tier-enforced-cap caveat as triumph-deliverables, well under it regardless
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

create policy "triumph_receipts_insert_admin"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'triumph-receipts'
    and public.is_admin()
  );

create policy "triumph_receipts_select_admin"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'triumph-receipts'
    and public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- Realtime — same reasoning as 0028_realtime_admin_tables.sql: Realtime
-- still checks the subscriber's RLS (triumph_payments_select_admin above),
-- so this grants no new access, it just lets the revenue overview page push
-- updates instead of requiring a reload.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.triumph_payments;
