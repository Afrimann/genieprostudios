-- 0023_triumph_projects.sql
-- Triumph Music Global client portal (2026-10-01 client request): the
-- "Start a Project" form (previously email-only, see 0_triumph intake in
-- triumph-actions.ts) now persists a project, hands the client a Project
-- Code, and lets them return anytime to check status/download deliverables
-- without an account — mirrors the reference site's passwordless
-- "Find Your Project" (code + email) lookup. No Supabase session exists on
-- that public lookup path at all, so (unlike support_tickets/bookings)
-- there is deliberately no anon/public RLS policy here — that path reads
-- via the service-role client from trusted server code instead. The admin
-- side IS an authenticated principal (reuses the existing /admin
-- profiles.is_admin flag — same business owner, just a separate UI/URL),
-- so it keeps the usual RLS-gated convention.

create type public.triumph_project_status as enum (
  'new',
  'in_progress',
  'review',
  'completed',
  'cancelled'
);

-- ---------------------------------------------------------------------------
-- triumph_projects
-- ---------------------------------------------------------------------------
create table public.triumph_projects (
  id uuid primary key default gen_random_uuid(),
  project_code text not null unique,
  full_name text not null,
  email text not null,
  country text not null,
  phone text not null,
  number_of_songs integer not null,
  service_id text not null,
  project_details text not null,
  status public.triumph_project_status not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.triumph_projects is
  'One Triumph Music Global project request. project_code is the '
  'human-typeable identifier (format TMG-XXXXXX) shown to the client and '
  'used, together with email, for the passwordless tracking lookup — see '
  'lib/repositories/triumph-projects-repository.ts. email is always stored '
  'lower-cased by the caller before insert. service_id references '
  'lib/data/triumph-pricing.ts::TRIUMPH_PRICING_TIERS, a static TS array, '
  'not a DB table.';
comment on column public.triumph_projects.status is
  'Work status only — no payment/deposit tracking exists here. Paystack '
  'integration for Triumph, if it happens, is a separate feature.';

alter table public.triumph_projects enable row level security;

-- Admin-only SELECT via the normal cookie-scoped client. No anon/public
-- policy: the public tracking lookup has no Supabase session to key RLS on,
-- so it goes through the service-role client from a Server Action instead
-- (which itself enforces code+email matching before ever returning data).
create policy "triumph_projects_select_admin"
  on public.triumph_projects
  for select
  to authenticated
  using (public.is_admin());

-- No insert/update policy for any role: the public intake action creates
-- rows via the service-role client (bypasses RLS entirely, by design), and
-- status changes happen only through create_triumph_project_update() below
-- (SECURITY DEFINER) so a status change and its timeline note always land
-- atomically — same reasoning as send_support_message() syncing
-- support_tickets.last_message_at in 0021_support_tickets.sql.

-- ---------------------------------------------------------------------------
-- triumph_project_updates
-- ---------------------------------------------------------------------------
create table public.triumph_project_updates (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.triumph_projects(id) on delete cascade,
  body text not null,
  status_after public.triumph_project_status,
  file_path text,
  file_name text,
  created_at timestamptz not null default now()
);

comment on table public.triumph_project_updates is
  'Timeline entries for a triumph_projects row — a status change, a plain '
  'note, or a deliverable upload (same primitive: a status change and a '
  'file attachment can both ride on one update). status_after null means '
  '"note only, no status change". file_path points into the '
  'triumph-deliverables storage bucket.';

alter table public.triumph_project_updates enable row level security;

create policy "triumph_project_updates_select_admin"
  on public.triumph_project_updates
  for select
  to authenticated
  using (public.is_admin());

-- No insert policy: all writes go through create_triumph_project_update()
-- below. The public tracking page reads updates via the service-role client
-- (same reasoning as triumph_projects above).

-- ---------------------------------------------------------------------------
-- create_triumph_project_update: admin-only, atomically inserts the update
-- and (when p_status_after is non-null) advances the project's status.
-- ---------------------------------------------------------------------------
create or replace function public.create_triumph_project_update(
  p_project_id uuid,
  p_body text,
  p_status_after public.triumph_project_status,
  p_file_path text,
  p_file_name text
)
returns public.triumph_project_updates
language plpgsql
security definer
set search_path = public
as $$
declare
  v_update public.triumph_project_updates;
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;

  if not exists (select 1 from public.triumph_projects where id = p_project_id) then
    raise exception 'invalid_project';
  end if;

  if p_body is null or length(trim(p_body)) = 0 then
    raise exception 'invalid_body';
  end if;

  insert into public.triumph_project_updates (project_id, body, status_after, file_path, file_name)
  values (p_project_id, trim(p_body), p_status_after, p_file_path, p_file_name)
  returning * into v_update;

  if p_status_after is not null then
    update public.triumph_projects
    set status = p_status_after,
        updated_at = now()
    where id = p_project_id;
  end if;

  return v_update;
end;
$$;

comment on function public.create_triumph_project_update(
  uuid, text, public.triumph_project_status, text, text
) is
  'Admin-only SECURITY DEFINER RPC. Inserts a timeline entry and, when '
  'p_status_after is non-null, atomically advances triumph_projects.status '
  '+ updated_at in the same transaction — a note must never claim a status '
  'change that didn''t land. Raises: ''not_admin'', ''invalid_project'', '
  '''invalid_body'' (blank).';

revoke all on function public.create_triumph_project_update(
  uuid, text, public.triumph_project_status, text, text
) from public;
revoke all on function public.create_triumph_project_update(
  uuid, text, public.triumph_project_status, text, text
) from anon;
grant execute on function public.create_triumph_project_update(
  uuid, text, public.triumph_project_status, text, text
) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private bucket for deliverable uploads (admin -> client).
-- ---------------------------------------------------------------------------
-- NOTE: same Free-tier 50MB enforced cap documented in
-- lib/validation/addon-songs.ts — the bucket's own file_size_limit only
-- takes effect on a paid plan.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'triumph-deliverables',
  'triumph-deliverables',
  false,
  52428800, -- 50MB
  array['audio/wav', 'audio/x-wav', 'audio/wave', 'audio/vnd.wave', 'audio/mpeg', 'audio/mp3']
)
on conflict (id) do nothing;

-- Admin uploads via their own authenticated session (not folder-scoped —
-- unlike track-uploads, every object here belongs to the one engineer, so
-- is_admin() alone is the right check). The client never touches this
-- bucket directly; downloads are signed URLs minted server-side by the
-- service-role client after the tracking cookie is validated.
create policy "triumph_deliverables_insert_admin"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'triumph-deliverables'
    and public.is_admin()
  );

create policy "triumph_deliverables_select_admin"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'triumph-deliverables'
    and public.is_admin()
  );
