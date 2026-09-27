-- 0012_add_email_to_profiles.sql
-- profiles never stored email — auth.users isn't queryable client-side (no
-- PostgREST access to the auth schema), so admin views (e.g. bookings list)
-- had no RLS-safe way to show a customer's email. Add it, backfill existing
-- rows, and keep handle_new_user() + a new update trigger in sync going
-- forward so it never goes stale if a user changes their email.

alter table public.profiles
  add column if not exists email text;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and p.email is null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, email)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'phone',
    new.email
  );
  return new;
end;
$$;

-- Keeps profiles.email in sync if a user changes their auth email later.
create or replace function public.handle_user_email_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end;
$$;

comment on function public.handle_user_email_update() is
  'Trigger function: mirrors auth.users.email into profiles.email whenever it changes.';

drop trigger if exists on_auth_user_email_updated on auth.users;

create trigger on_auth_user_email_updated
  after update on auth.users
  for each row
  execute function public.handle_user_email_update();
