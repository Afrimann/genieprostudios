-- 0001_extensions_and_profiles.sql
-- Extensions required across the schema, plus the profiles table (1:1 with auth.users)
-- and the trigger that keeps it populated automatically on signup.

-- gen_random_uuid() lives in pgcrypto on some Postgres builds; Supabase ships it
-- enabled by default but we make it explicit/idempotent here.
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  '1:1 extension of auth.users. Row is created automatically by handle_new_user() on signup.';

-- ---------------------------------------------------------------------------
-- handle_new_user(): populates public.profiles when a new auth.users row is
-- inserted. SECURITY DEFINER so it can write to public.profiles regardless of
-- the inserting session's RLS context (there is no session yet during signup).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone'
  );
  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Trigger function: creates a profiles row for every new auth.users row, '
  'pulling full_name/phone from raw_user_meta_data when present. '
  'SECURITY DEFINER is required because the new user has no session/RLS grant yet.';

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- is_admin(): non-recursive-safe helper for RLS policies.
--
-- Why not just write `exists (select 1 from profiles where id = auth.uid() and
-- is_admin)` directly inside the profiles table's own RLS policy? Because a
-- policy on `profiles` that queries `profiles` re-enters RLS on the same table,
-- which is the classic "infinite recursion detected in policy" error in
-- Postgres once policies get complex (and is fragile/confusing even when it
-- happens not to recurse immediately).
--
-- The fix used here: is_admin() is SECURITY DEFINER, so the SELECT it runs
-- against public.profiles executes as the function owner (bypassing RLS
-- entirely) rather than as the calling user. Policies then call is_admin()
-- instead of embedding the subquery directly, so there's no self-referential
-- RLS evaluation. This is the standard safe pattern recommended by Supabase
-- for "is this user an admin" checks.
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

comment on function public.is_admin() is
  'SECURITY DEFINER helper used by RLS policies to check admin status without '
  'recursively re-invoking RLS on profiles. See comment above the function body.';

alter table public.profiles enable row level security;
