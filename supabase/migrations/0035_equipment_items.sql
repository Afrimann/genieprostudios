-- 0035_equipment_items.sql
-- Part 1 of the "equipment inventory + open-by-default availability +
-- overnight bookings" change (see the plan doc referenced in the task that
-- produced this migration). Equipment is unrelated to the availability
-- model flip in 0036/0037 and is self-contained — built alongside, not
-- blocking.
--
-- Customers must see the equipment inventory (what's in stock, who provides
-- it — studio vs. client) before they book, read-only. The owner updates it
-- from the admin side. No business rules here (no buffer/overlap concept
-- like availability) — pure data access, same "dumb CRUD" shape as
-- portfolio_entries (0008_portfolio_entries.sql).

create table if not exists public.equipment_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  provided_by text not null check (provided_by in ('studio', 'client')),
  quantity_available int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.equipment_items is
  'Read-only-to-customers equipment inventory shown before booking (what''s '
  'in stock, who provides it). Owner-managed via the admin UI. No '
  'business-rule logic belongs here — pure data access, same convention as '
  'portfolio_entries (0008_portfolio_entries.sql).';

comment on column public.equipment_items.provided_by is
  'studio = GenieProStudios supplies this item, client = the customer must '
  'bring their own (displayed as-is on the customer-facing equipment step, '
  'no business logic branches on this value).';

comment on column public.equipment_items.quantity_available is
  'How many units the studio currently has on hand, for studio-provided '
  'items. Purely informational display — booking a session never '
  'decrements/reserves equipment quantity; there is no equipment-booking '
  'relationship at all.';

alter table public.equipment_items enable row level security;

create index if not exists equipment_items_provided_by_idx
  on public.equipment_items (provided_by);

-- Reuses public.set_updated_at() (defined in 0005_bookings.sql) — the
-- generic "stamp updated_at = now() on UPDATE" trigger shared by every table
-- with an updated_at column.
drop trigger if exists equipment_items_set_updated_at on public.equipment_items;

create trigger equipment_items_set_updated_at
  before update on public.equipment_items
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: "deny by default, grant narrowly" (0010_rls_policies.sql convention).
-- Public select for anon+authenticated (same shape as services_select_active_public
-- / portfolio_entries_select_published_public); insert/update/delete gated
-- on public.is_admin().
-- ---------------------------------------------------------------------------
drop policy if exists "equipment_items_select_public" on public.equipment_items;
create policy "equipment_items_select_public"
  on public.equipment_items
  for select
  to anon, authenticated
  using (true);

drop policy if exists "equipment_items_insert_admin" on public.equipment_items;
create policy "equipment_items_insert_admin"
  on public.equipment_items
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "equipment_items_update_admin" on public.equipment_items;
create policy "equipment_items_update_admin"
  on public.equipment_items
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "equipment_items_delete_admin" on public.equipment_items;
create policy "equipment_items_delete_admin"
  on public.equipment_items
  for delete
  to authenticated
  using (public.is_admin());
