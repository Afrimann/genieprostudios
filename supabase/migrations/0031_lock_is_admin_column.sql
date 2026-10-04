-- 0031_lock_is_admin_column.sql
-- CRITICAL privilege-escalation fix (2026-10-03 audit, finding V-0).
--
-- THE BUG
-- profiles.is_admin is a plain boolean column, and "profiles_update_own"
-- (0010_rls_policies.sql) lets an authenticated user UPDATE their own
-- profiles row:
--     for update to authenticated
--     using (id = auth.uid()) with check (id = auth.uid())
--
-- PostgreSQL RLS is ROW-level only — it does not restrict which COLUMNS an
-- UPDATE may touch. Supabase's default privileges grant UPDATE on public
-- schema tables to anon/authenticated and rely on RLS as the gate. So both
-- the USING and WITH CHECK clauses evaluate true for a user updating their
-- own row, including is_admin:
--
--     await supabase.from('profiles')
--       .update({ is_admin: true })
--       .eq('id', myUserId)          // <- succeeded before this migration
--
-- Both /admin and /triumph-admin gate solely on profiles.is_admin, so this
-- was a full compromise of both businesses' admin areas reachable by anyone
-- who could sign up — and signup is public.
--
-- THE FIX — two independent layers, because this is worth belt AND braces:
--   1. Column-level REVOKE. Column privileges are evaluated separately from
--      (and in addition to) RLS, so without UPDATE on this column the write
--      is rejected no matter what any current or future policy permits.
--   2. A BEFORE UPDATE trigger that rejects any change to is_admin not made
--      by a service-role/superuser connection. This survives someone later
--      re-granting the column (e.g. a blanket `grant all` in a future
--      migration) and makes the intent explicit at the table.
--
-- Legitimate admin promotion still works: service_role and the postgres
-- superuser bypass both layers, so setting the flag from the Supabase SQL
-- editor or a service-role script is unaffected.

-- ---------------------------------------------------------------------------
-- 1. Column-level privilege
-- ---------------------------------------------------------------------------
-- Revoke only the is_admin column. full_name/phone stay writable so the
-- existing profiles_update_own policy keeps working for its intended
-- purpose (a customer editing their own name/phone).
revoke update (is_admin) on public.profiles from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Guard trigger (defense in depth)
-- ---------------------------------------------------------------------------
create or replace function public.prevent_is_admin_self_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_admin is distinct from old.is_admin then
    -- current_user is 'authenticated'/'anon' for a PostgREST request made
    -- with a user JWT, and 'service_role'/'postgres'/'supabase_admin' for
    -- trusted server-side connections. Only the latter may flip this flag.
    if current_user not in ('service_role', 'postgres', 'supabase_admin') then
      raise exception 'is_admin cannot be changed by this role'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.prevent_is_admin_self_escalation() is
  'Blocks any UPDATE that changes profiles.is_admin unless performed by a
  service-role/superuser connection. Defense in depth behind the
  column-level REVOKE in 0031 — protects against a future migration
  re-granting the column by accident.';

drop trigger if exists profiles_prevent_is_admin_escalation on public.profiles;

create trigger profiles_prevent_is_admin_escalation
  before update on public.profiles
  for each row
  execute function public.prevent_is_admin_self_escalation();

comment on column public.profiles.is_admin is
  'Owner/admin flag gating BOTH /admin and /triumph-admin. Writable ONLY by
  service_role/postgres — see 0031_lock_is_admin_column.sql. Never add a
  policy or grant that lets authenticated users write this column.';

-- ---------------------------------------------------------------------------
-- VERIFY after applying (run as an ordinary authenticated user, not in the
-- SQL editor, which runs as postgres and is therefore allowed):
--   await supabase.from('profiles').update({ is_admin: true }).eq('id', <own id>)
-- Expected: an error, and a follow-up select shows is_admin still false.
--
-- REMEDIATION: if this project has been publicly reachable with signup open,
-- audit existing rows before trusting them:
--   select id, full_name, is_admin, created_at from public.profiles where is_admin;
-- Anyone in that list who is not the studio owner was escalated and should
-- be reset to false and have their session revoked.
-- ---------------------------------------------------------------------------
