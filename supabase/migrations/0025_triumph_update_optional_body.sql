-- 0025_triumph_update_optional_body.sql
-- Relaxes create_triumph_project_update (0023) so the admin can post a
-- pure status change — e.g. marking a project "Completed" — with no note
-- and no deliverable attached (2026-10-xx client request: "should be able
-- to change the status to completed without having sent a deliverable").
-- The only remaining rule is that an update can't be completely empty:
-- at least one of body/status_after/file_path must carry something, same
-- invariant enforced client-side in triumph-update.ts's Zod refine.

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
  v_body text;
begin
  if not public.is_admin() then
    raise exception 'not_admin';
  end if;

  if not exists (select 1 from public.triumph_projects where id = p_project_id) then
    raise exception 'invalid_project';
  end if;

  v_body := coalesce(trim(p_body), '');

  if v_body = '' and p_status_after is null and p_file_path is null then
    raise exception 'empty_update';
  end if;

  insert into public.triumph_project_updates (project_id, body, status_after, file_path, file_name)
  values (p_project_id, v_body, p_status_after, p_file_path, p_file_name)
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
  'Admin-only SECURITY DEFINER RPC. Inserts a timeline entry (body may be '
  'blank — a pure status change or file drop is valid) and, when '
  'p_status_after is non-null, atomically advances triumph_projects.status '
  '+ updated_at in the same transaction. Raises: ''not_admin'', '
  '''invalid_project'', ''empty_update'' (body blank AND no status change '
  'AND no file).';
