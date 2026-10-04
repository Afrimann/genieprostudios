-- 0028_realtime_admin_tables.sql
-- Enables Supabase Realtime (postgres_changes) for tables the authenticated
-- admin role already has RLS SELECT access to via is_admin() — see
-- 0010_rls_policies.sql (bookings/payments/availability_slots/
-- portfolio_entries), 0021_support_tickets.sql (support_tickets;
-- support_messages was already added to the publication there), and
-- 0023_triumph_projects.sql (triumph_projects/triumph_project_updates).
--
-- Realtime still checks the subscribing connection's RLS the same way a
-- normal select does — being listed in this publication grants no new
-- access by itself. An anon/public connection subscribing to
-- triumph_projects, for example, still sees nothing, because no anon select
-- policy exists on that table (by design — see that migration's own
-- comment). This migration only lets the admin's own browser, already
-- authenticated and already is_admin()-permitted to read these rows, receive
-- the next change as a push instead of waiting for a manual reload.
alter publication supabase_realtime add table public.bookings;
alter publication supabase_realtime add table public.payments;
alter publication supabase_realtime add table public.availability_slots;
alter publication supabase_realtime add table public.portfolio_entries;
alter publication supabase_realtime add table public.support_tickets;
alter publication supabase_realtime add table public.triumph_projects;
alter publication supabase_realtime add table public.triumph_project_updates;
