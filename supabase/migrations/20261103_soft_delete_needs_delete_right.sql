-- A soft delete needs the right to delete.
--
-- The app deletes by pushing UPDATE ... SET deleted_at (lib/syncEngine.ts), so
-- the DELETE policies (can_delete_in_project) never ran: anyone who could
-- write a project could erase it, and every row in it, by setting deleted_at.
-- This trigger applies the delete rule to that update.
--
-- Setting deleted_at from null to a value is allowed when:
--   projects:      can_delete_in_project(the project)
--   child tables:  can_delete_in_project(project_id), or the caller created
--                  the row (user_id = auth.uid(), old or new)
-- A null user_id is nobody's, so it does not count as the caller's.
-- With no auth.uid() (service role, migrations, functions) it is skipped.
-- Clearing deleted_at (an undelete) and every other update are unchanged.
--
-- Attached to projects and to every public base table with a project_id,
-- except project_members, which has its own guard.
--
-- NOT APPLIED. Dry run at the bottom.

begin;

create or replace function public.guard_soft_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return new;
  end if;
  if old.deleted_at is not null or new.deleted_at is null then
    return new;
  end if;

  if tg_table_name = 'projects' then
    if public.can_delete_in_project(new.id) then
      return new;
    end if;
  elsif public.can_delete_in_project(new.project_id)
        or old.user_id = v_uid
        or new.user_id = v_uid then
    return new;
  end if;

  raise exception 'deleting this needs the owner or director' using errcode = '42501';
end $$;

revoke execute on function public.guard_soft_delete() from anon, authenticated, public;

drop trigger if exists trg_guard_soft_delete on public.projects;
create trigger trg_guard_soft_delete
  before update on public.projects
  for each row execute function public.guard_soft_delete();

do $$
declare
  t record;
begin
  for t in
    select c.table_name
      from information_schema.columns c
      join information_schema.tables tb
        on tb.table_schema = c.table_schema and tb.table_name = c.table_name
     where c.table_schema = 'public'
       and c.column_name = 'project_id'
       and tb.table_type = 'BASE TABLE'
       and c.table_name <> 'project_members'
       and exists (select 1 from information_schema.columns d
                    where d.table_schema = 'public' and d.table_name = c.table_name
                      and d.column_name = 'deleted_at')
       and exists (select 1 from information_schema.columns u
                    where u.table_schema = 'public' and u.table_name = c.table_name
                      and u.column_name = 'user_id')
  loop
    execute format('drop trigger if exists trg_guard_soft_delete on public.%I', t.table_name);
    execute format('create trigger trg_guard_soft_delete before update on public.%I
                    for each row execute function public.guard_soft_delete()', t.table_name);
  end loop;
end $$;

commit;

-- Dry run. The file commits itself, so swap the commit for a rollback and
-- add the check before it. In psql, with real ids for a crew member and a
-- row in a project they can write but not delete in:
--
--   sed 's/^commit;$//' supabase/migrations/20261103_soft_delete_needs_delete_right.sql > /tmp/dry.sql
--   cat >> /tmp/dry.sql <<'SQL'
--   set local role authenticated;
--   select set_config('request.jwt.claims',
--     '{"sub":"<crew-user-uuid>","role":"authenticated"}', true);
--   update public.shots set deleted_at = now()
--    where id = '<shot-uuid-created-by-the-director>';   -- expect ERROR 42501
--   rollback;
--   SQL
--   psql "$DB_URL" -f /tmp/dry.sql
