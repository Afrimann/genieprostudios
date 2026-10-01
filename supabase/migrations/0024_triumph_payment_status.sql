-- 0024_triumph_payment_status.sql
-- Admin-settable payment status for Triumph projects, separate from the
-- work-status enum (triumph_project_status, 0023) — the engineer needs to
-- track "has this client paid" independently of "how far along is the
-- mix," per client request (2026-10-01). This is a manual field the admin
-- sets by hand on the project detail page — NOT a Paystack/payment-gateway
-- integration, which remains a separate, bigger, deferred feature (see
-- 0023's "explicitly out of scope" comment).

create type public.triumph_payment_status as enum (
  'pending',
  'deposit_paid',
  'paid_in_full'
);

alter table public.triumph_projects
  add column payment_status public.triumph_payment_status not null default 'pending';

comment on column public.triumph_projects.payment_status is
  'Manually set by the admin via update_triumph_project_payment_status() '
  'below — independent of status (work progress). No payment gateway '
  'backs this; it is purely a record of what the admin was told/observed.';

-- ---------------------------------------------------------------------------
-- update_triumph_project_payment_status: admin-only, direct column update.
-- A separate RPC from create_triumph_project_update (0023) because a
-- payment status change is a standalone toggle, not a timeline note with
-- an optional status change — it doesn't belong in triumph_project_updates.
-- ---------------------------------------------------------------------------
create or replace function public.update_triumph_project_payment_status(
  p_project_id uuid,
  p_payment_status public.triumph_payment_status
)
returns public.triumph_projects
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.triumph_projects;
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;

  update public.triumph_projects
  set payment_status = p_payment_status,
      updated_at = now()
  where id = p_project_id
  returning * into v_project;

  if v_project is null then
    raise exception 'invalid_project';
  end if;

  return v_project;
end;
$$;

comment on function public.update_triumph_project_payment_status(
  uuid, public.triumph_payment_status
) is
  'Admin-only SECURITY DEFINER RPC. Raises ''not_admin'' or ''invalid_project''.';

revoke all on function public.update_triumph_project_payment_status(
  uuid, public.triumph_payment_status
) from public;
revoke all on function public.update_triumph_project_payment_status(
  uuid, public.triumph_payment_status
) from anon;
grant execute on function public.update_triumph_project_payment_status(
  uuid, public.triumph_payment_status
) to authenticated;
