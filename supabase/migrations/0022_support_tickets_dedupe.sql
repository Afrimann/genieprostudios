-- 0022_support_tickets_dedupe.sql
-- Fixes a live bug found right after 0021 shipped: a customer ended up with
-- more than one 'open' support_tickets row, which crashed
-- getMyOpenTicket() (lib/repositories/support-repository.ts used
-- .maybeSingle(), which throws "multiple rows returned" instead of just
-- picking one). The code itself has been made defensive (orders by
-- created_at and takes the most recent), but the underlying data-level
-- invariant still needs fixing: support_tickets_one_open_per_customer
-- (0021's partial unique index) either never got created against
-- already-duplicated rows, or was skipped/failed silently depending on how
-- 0021 was pasted into the SQL editor.
--
-- This migration is safe to run whether or not 0021's index already
-- exists: it first collapses any existing duplicate 'open' rows per
-- customer down to just the most recently created one (closing the rest,
-- same terminal state close_support_ticket() would leave them in), then
-- (re)creates the unique index.

update public.support_tickets t
set status = 'closed',
    closed_at = now()
where t.status = 'open'
  and t.id not in (
    select distinct on (customer_id) id
    from public.support_tickets
    where status = 'open'
    order by customer_id, created_at desc
  );

drop index if exists support_tickets_one_open_per_customer;

create unique index support_tickets_one_open_per_customer
  on public.support_tickets (customer_id)
  where status = 'open';
