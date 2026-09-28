-- 0021_support_tickets.sql
-- "Front desk" support chat: a signed-in customer can start a conversation,
-- keep sending messages, and see admin replies live, until admin explicitly
-- closes the ticket (2026-09-28 client request). Scope decision: a customer
-- has at most one OPEN ticket at a time — no ticket picker needed on the
-- customer side, and it keeps "which conversation am I in" unambiguous.
--
-- Same write discipline as bookings (0010's comment: writes happen
-- server-side, bypassing RLS) — here that's SECURITY DEFINER RPCs rather
-- than the service-role client, since these are live, customer-initiated
-- actions rather than webhook/cron writes.

-- ---------------------------------------------------------------------------
-- support_tickets
-- ---------------------------------------------------------------------------
create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  last_message_at timestamptz,
  last_message_role text check (last_message_role in ('customer', 'admin')),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

comment on table public.support_tickets is
  'One "front desk" conversation. A customer may have at most one open '
  'ticket at a time (see the partial unique index below) — closing a '
  'ticket is what lets them start a new one.';
comment on column public.support_tickets.last_message_role is
  'Snapshot of who sent the most recent message, kept in sync by '
  'send_support_message() below. Drives the admin "awaiting reply" badge '
  '(open tickets where this = ''customer'') without a per-row subquery.';

-- The actual DB-level guarantee behind "one open ticket at a time" — belt
-- and suspenders alongside create_or_resume_support_ticket()'s own check.
create unique index support_tickets_one_open_per_customer
  on public.support_tickets (customer_id)
  where status = 'open';

alter table public.support_tickets enable row level security;

create policy "support_tickets_select_own"
  on public.support_tickets
  for select
  to authenticated
  using (customer_id = auth.uid());

create policy "support_tickets_select_admin"
  on public.support_tickets
  for select
  to authenticated
  using (public.is_admin());

-- No insert/update policy for either role: all writes go through the
-- SECURITY DEFINER RPCs below.

-- ---------------------------------------------------------------------------
-- support_messages
-- ---------------------------------------------------------------------------
create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_role text not null check (sender_role in ('customer', 'admin')),
  body text not null,
  created_at timestamptz not null default now()
);

comment on column public.support_messages.sender_role is
  'Snapshotted at insert time by send_support_message() from the caller''s '
  'own auth.uid()/is_admin() — never client-supplied — so historical '
  'messages keep correct attribution even if someone''s admin status '
  'changes later.';

alter table public.support_messages enable row level security;

create policy "support_messages_select_own"
  on public.support_messages
  for select
  to authenticated
  using (
    exists (
      select 1 from public.support_tickets t
      where t.id = support_messages.ticket_id
        and t.customer_id = auth.uid()
    )
  );

create policy "support_messages_select_admin"
  on public.support_messages
  for select
  to authenticated
  using (public.is_admin());

-- Realtime: postgres_changes subscriptions are evaluated against the
-- subscribing client's JWT through the SELECT policies above, so no
-- separate realtime-specific policy is needed.
alter publication supabase_realtime add table public.support_messages;

-- ---------------------------------------------------------------------------
-- create_or_resume_support_ticket: returns the caller's existing open
-- ticket if any, else creates one.
-- ---------------------------------------------------------------------------
create or replace function public.create_or_resume_support_ticket(p_subject text)
returns public.support_tickets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.support_tickets;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  select * into v_ticket
  from public.support_tickets
  where customer_id = auth.uid()
    and status = 'open';

  if v_ticket is not null then
    return v_ticket;
  end if;

  if p_subject is null or length(trim(p_subject)) = 0 then
    raise exception 'invalid_subject';
  end if;

  insert into public.support_tickets (customer_id, subject)
  values (auth.uid(), trim(p_subject))
  returning * into v_ticket;

  return v_ticket;
end;
$$;

comment on function public.create_or_resume_support_ticket(text) is
  'Customer-facing SECURITY DEFINER RPC. Returns the caller''s existing '
  'open ticket if one exists (ignoring p_subject), else creates a new one. '
  'Raises: ''auth_required'', ''invalid_subject'' (blank).';

revoke all on function public.create_or_resume_support_ticket(text) from public;
revoke all on function public.create_or_resume_support_ticket(text) from anon;
grant execute on function public.create_or_resume_support_ticket(text) to authenticated;

-- ---------------------------------------------------------------------------
-- send_support_message: shared by both customer and admin callers — the
-- caller's role is resolved server-side, never trusted from a parameter.
-- ---------------------------------------------------------------------------
create or replace function public.send_support_message(p_ticket_id uuid, p_body text)
returns public.support_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.support_tickets;
  v_role text;
  v_message public.support_messages;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  select * into v_ticket
  from public.support_tickets
  where id = p_ticket_id;

  if v_ticket is null then
    raise exception 'invalid_ticket';
  end if;

  if public.is_admin() then
    v_role := 'admin';
  elsif v_ticket.customer_id = auth.uid() then
    v_role := 'customer';
  else
    raise exception 'not_authorized';
  end if;

  if v_ticket.status != 'open' then
    raise exception 'ticket_closed';
  end if;

  if p_body is null or length(trim(p_body)) = 0 then
    raise exception 'invalid_message';
  end if;

  insert into public.support_messages (ticket_id, sender_id, sender_role, body)
  values (p_ticket_id, auth.uid(), v_role, trim(p_body))
  returning * into v_message;

  update public.support_tickets
  set last_message_at = v_message.created_at,
      last_message_role = v_role
  where id = p_ticket_id;

  return v_message;
end;
$$;

comment on function public.send_support_message(uuid, text) is
  'Shared customer/admin SECURITY DEFINER RPC — resolves the caller''s '
  'role from is_admin()/ticket ownership, never a parameter. Raises: '
  '''auth_required'', ''invalid_ticket'', ''not_authorized'', '
  '''ticket_closed'' (blocks messages on a closed ticket — start a new '
  'one instead), ''invalid_message'' (blank).';

revoke all on function public.send_support_message(uuid, text) from public;
revoke all on function public.send_support_message(uuid, text) from anon;
grant execute on function public.send_support_message(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- close_support_ticket: admin-only.
-- ---------------------------------------------------------------------------
create or replace function public.close_support_ticket(p_ticket_id uuid)
returns public.support_tickets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.support_tickets;
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;

  update public.support_tickets
  set status = 'closed',
      closed_at = now()
  where id = p_ticket_id
  returning * into v_ticket;

  if v_ticket is null then
    raise exception 'invalid_ticket';
  end if;

  return v_ticket;
end;
$$;

comment on function public.close_support_ticket(uuid) is
  'Admin-only SECURITY DEFINER RPC. Raises ''not_admin'' or ''invalid_ticket''.';

revoke all on function public.close_support_ticket(uuid) from public;
revoke all on function public.close_support_ticket(uuid) from anon;
grant execute on function public.close_support_ticket(uuid) to authenticated;
