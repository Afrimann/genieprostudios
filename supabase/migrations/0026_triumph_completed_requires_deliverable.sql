-- 0026_triumph_completed_requires_deliverable.sql
-- Reverses part of 0025's relaxation: a pure status change to 'completed'
-- is fine in general (0025), EXCEPT for 'completed' specifically — the
-- admin should not be able to mark a project Completed unless a
-- deliverable has actually gone out, either attached to this very update
-- or to some earlier one in the project's timeline (2026-10-xx client
-- correction: "should NOT be able to change status to completed without
-- having sent a deliverable").

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
  v_has_prior_deliverable boolean;
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

  if p_status_after = 'completed' and p_file_path is null then
    select exists (
      select 1 from public.triumph_project_updates
      where project_id = p_project_id and file_path is not null
    ) into v_has_prior_deliverable;

    if not v_has_prior_deliverable then
      raise exception 'completed_requires_deliverable';
    end if;
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
  '+ updated_at in the same transaction. Marking a project ''completed'' '
  'requires a deliverable — either attached to this update (p_file_path) '
  'or to some earlier one for the same project. Raises: ''not_admin'', '
  '''invalid_project'', ''empty_update'' (body blank AND no status change '
  'AND no file), ''completed_requires_deliverable''.';
