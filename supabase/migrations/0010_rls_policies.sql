-- 0010_rls_policies.sql
-- Row Level Security policies for every table except heartbeat (which has RLS
-- disabled entirely, see 0009). RLS was already enabled on each table in its
-- own creation migration; this file only adds the policies.
--
-- Admin-recursion note: every "admin can ..." policy below calls
-- public.is_admin() (defined in 0001) rather than embedding
-- `exists (select 1 from profiles where id = auth.uid() and is_admin)`
-- inline. is_admin() is SECURITY DEFINER, so its internal SELECT against
-- profiles bypasses RLS instead of re-entering it, which avoids the
-- "infinite recursion detected in policy for relation profiles" failure mode
-- Postgres RLS is prone to when a table's own policy queries that same table.

-- =============================================================================
-- profiles
-- =============================================================================
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- No insert policy for regular users: rows are created exclusively by the
-- handle_new_user() SECURITY DEFINER trigger on auth.users insert.

drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin"
  on public.profiles
  for select
  to authenticated
  using (public.is_admin());

-- =============================================================================
-- services
-- =============================================================================
drop policy if exists "services_select_active_public" on public.services;
create policy "services_select_active_public"
  on public.services
  for select
  to anon, authenticated
  using (active = true);

drop policy if exists "services_select_admin" on public.services;
create policy "services_select_admin"
  on public.services
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "services_insert_admin" on public.services;
create policy "services_insert_admin"
  on public.services
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "services_update_admin" on public.services;
create policy "services_update_admin"
  on public.services
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "services_delete_admin" on public.services;
create policy "services_delete_admin"
  on public.services
  for delete
  to authenticated
  using (public.is_admin());

-- =============================================================================
-- availability_slots
-- =============================================================================
drop policy if exists "availability_slots_select_open_public" on public.availability_slots;
create policy "availability_slots_select_open_public"
  on public.availability_slots
  for select
  to anon, authenticated
  using (status = 'open');

drop policy if exists "availability_slots_select_admin" on public.availability_slots;
create policy "availability_slots_select_admin"
  on public.availability_slots
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "availability_slots_insert_admin" on public.availability_slots;
create policy "availability_slots_insert_admin"
  on public.availability_slots
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "availability_slots_update_admin" on public.availability_slots;
create policy "availability_slots_update_admin"
  on public.availability_slots
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "availability_slots_delete_admin" on public.availability_slots;
create policy "availability_slots_delete_admin"
  on public.availability_slots
  for delete
  to authenticated
  using (public.is_admin());

-- Note: the atomic open->booked transition on booking creation happens via
-- the service-role client inside BookingService (bypasses RLS entirely by
-- design, since it must succeed regardless of which policies exist), so no
-- customer-facing UPDATE policy is needed or added here.

-- =============================================================================
-- bookings
-- =============================================================================
drop policy if exists "bookings_select_own" on public.bookings;
create policy "bookings_select_own"
  on public.bookings
  for select
  to authenticated
  using (customer_id = auth.uid());

drop policy if exists "bookings_select_admin" on public.bookings;
create policy "bookings_select_admin"
  on public.bookings
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "bookings_update_admin" on public.bookings;
create policy "bookings_update_admin"
  on public.bookings
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Deliberately no insert/update/delete policy for plain customers: all writes
-- happen server-side via the service-role client (webhook handler / booking
-- RPC / cron), which bypasses RLS. This guarantees "confirmed" status can
-- only ever be set after Paystack webhook verification, never by a client
-- write straight to the table.

-- =============================================================================
-- payments
-- =============================================================================
drop policy if exists "payments_select_own" on public.payments;
create policy "payments_select_own"
  on public.payments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.bookings b
      where b.id = payments.booking_id
        and b.customer_id = auth.uid()
    )
  );

drop policy if exists "payments_select_admin" on public.payments;
create policy "payments_select_admin"
  on public.payments
  for select
  to authenticated
  using (public.is_admin());

-- No insert/update/delete policy at all: payments are written exclusively by
-- the service-role client (Paystack initiate + webhook handler).

-- =============================================================================
-- tc_acceptances
-- =============================================================================
drop policy if exists "tc_acceptances_select_own" on public.tc_acceptances;
create policy "tc_acceptances_select_own"
  on public.tc_acceptances
  for select
  to authenticated
  using (customer_id = auth.uid());

drop policy if exists "tc_acceptances_select_admin" on public.tc_acceptances;
create policy "tc_acceptances_select_admin"
  on public.tc_acceptances
  for select
  to authenticated
  using (public.is_admin());

-- Customer-writable by design: recorded during the booking flow via a Server
-- Action running as the user's own session. accepted_at/ip_address are never
-- trusted from client input at the application layer regardless — the DB
-- DEFAULT NOW() on accepted_at is what actually guarantees the timestamp is
-- server-set (a malicious client could still try to smuggle a value for
-- ip_address via a raw insert, so the Server Action must not forward any
-- client-supplied ip_address either; it should derive it server-side or omit
-- it).
drop policy if exists "tc_acceptances_insert_own" on public.tc_acceptances;
create policy "tc_acceptances_insert_own"
  on public.tc_acceptances
  for insert
  to authenticated
  with check (customer_id = auth.uid());

-- =============================================================================
-- reminder_log
-- =============================================================================
-- No policy for anon/authenticated at all: service-role (cron) only for
-- reads/writes from the app's perspective. Admin gets an explicit select.
drop policy if exists "reminder_log_select_admin" on public.reminder_log;
create policy "reminder_log_select_admin"
  on public.reminder_log
  for select
  to authenticated
  using (public.is_admin());

-- =============================================================================
-- portfolio_entries
-- =============================================================================
drop policy if exists "portfolio_entries_select_published_public" on public.portfolio_entries;
create policy "portfolio_entries_select_published_public"
  on public.portfolio_entries
  for select
  to anon, authenticated
  using (published = true);

drop policy if exists "portfolio_entries_select_admin" on public.portfolio_entries;
create policy "portfolio_entries_select_admin"
  on public.portfolio_entries
  for select
  to authenticated
  using (public.is_admin());

drop policy if exists "portfolio_entries_insert_admin" on public.portfolio_entries;
create policy "portfolio_entries_insert_admin"
  on public.portfolio_entries
  for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "portfolio_entries_update_admin" on public.portfolio_entries;
create policy "portfolio_entries_update_admin"
  on public.portfolio_entries
  for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "portfolio_entries_delete_admin" on public.portfolio_entries;
create policy "portfolio_entries_delete_admin"
  on public.portfolio_entries
  for delete
  to authenticated
  using (public.is_admin());

-- =============================================================================
-- heartbeat: intentionally excluded. RLS is not enabled on this table at all
-- (see 0009_heartbeat.sql) and no policies are defined for it.
-- =============================================================================
