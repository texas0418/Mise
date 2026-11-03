-- Close the four holes found by the 2026-11-02 audit.
--
-- 1. project_members_insert only required a session, so anyone could insert
--    themselves as 'owner' of any project and project_access() would agree.
-- 2. The scripts bucket let any signed-in user read and upload anywhere.
-- 3. projects_member_update let a crew member rewrite projects.user_id and
--    become the owner.
-- 4. Invites linked to whichever account held the address, confirmed or not.
--
-- The owner/director check moves from get_my_project_role(), which reads only
-- project_members and so never saw the real owner (projects.user_id), to
-- can_delete_in_project(), which goes through project_access().

begin;

-- Map a scripts folder name to the server project id. Phones name the folder
-- after the local id, which is Date.now() as a string; lib/syncEngine.ts
-- deterministicUUID() turns that into the server id. Mirror it here.
create or replace function public.mise_project_uuid(folder text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when folder ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then folder::uuid
    when folder ~ '^[0-9]{1,18}$'
      then (select (substr(h, 1, 8) || '-' || substr(h, 9, 4) || '-4' || substr(h, 14, 3)
                    || '-a' || substr(h, 18, 3) || '-' || substr(h, 21, 12))::uuid
            from (select lpad(to_hex(folder::bigint), 32, '0') as h) x)
    else null
  end;
$$;

-- ---------------------------------------------------------------- members
drop policy if exists project_members_insert on public.project_members;
create policy project_members_insert on public.project_members
  for insert to authenticated
  with check (public.can_delete_in_project(project_id) and role <> 'owner');

drop policy if exists project_members_select on public.project_members;
create policy project_members_select on public.project_members
  for select to authenticated
  using (user_id = auth.uid() or public.can_delete_in_project(project_id));

drop policy if exists project_members_update on public.project_members;
create policy project_members_update on public.project_members
  for update to authenticated
  using (user_id = auth.uid() or public.can_delete_in_project(project_id))
  with check (role <> 'owner'
              and (user_id = auth.uid() or public.can_delete_in_project(project_id)));

drop policy if exists project_members_delete on public.project_members;
create policy project_members_delete on public.project_members
  for delete to authenticated
  using (public.can_delete_in_project(project_id));

-- A member editing their own row may accept or leave, nothing else.
create or replace function public.guard_project_member_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;  -- service role
  end if;
  if new.project_id is distinct from old.project_id then
    raise exception 'project_id cannot change' using errcode = '42501';
  end if;
  if not public.can_delete_in_project(old.project_id)
     and (new.role is distinct from old.role
          or new.user_id is distinct from old.user_id
          or new.email is distinct from old.email) then
    raise exception 'only the owner or director can change a member' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_project_member_update on public.project_members;
create trigger trg_guard_project_member_update
  before update on public.project_members
  for each row execute function public.guard_project_member_update();

-- --------------------------------------------------------------- projects
create or replace function public.guard_project_owner_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and new.user_id is distinct from old.user_id
     and old.user_id is distinct from auth.uid() then
    raise exception 'only the owner can hand over a project' using errcode = '42501';
  end if;
  return new;
end $$;

drop trigger if exists trg_guard_project_owner_change on public.projects;
create trigger trg_guard_project_owner_change
  before update on public.projects
  for each row execute function public.guard_project_owner_change();

-- ---------------------------------------------------------------- scripts
-- Read: the uploader, or anyone who can read the project the folder names.
-- Upload: into a project you can write, or a project not on the server yet
-- (free accounts never sync theirs), and only under a file name that starts
-- with your own id, which is how utils/scriptPicker.ts names uploads.
drop policy if exists storage_scripts_select on storage.objects;
create policy storage_scripts_select on storage.objects
  for select to authenticated
  using (bucket_id = 'scripts'
         and (owner = auth.uid()
              or public.can_read_project(public.mise_project_uuid((storage.foldername(name))[1]))));

drop policy if exists storage_scripts_insert on storage.objects;
create policy storage_scripts_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'scripts'
              and storage.filename(name) like auth.uid()::text || '-%'
              and (public.can_write_project(public.mise_project_uuid((storage.foldername(name))[1]))
                   or not exists (select 1 from public.projects p
                                  where p.id = public.mise_project_uuid((storage.foldername(name))[1]))));

-- ---------------------------------------------------------------- invites
-- Link an invite only to an account whose address is confirmed. While
-- "Confirm email" is off every account counts as confirmed, so this bites
-- once that setting is on.
create or replace function public.link_member_on_invite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_uid uuid;
begin
  if new.user_id is null and new.email is not null then
    select id into v_uid from auth.users
     where lower(email) = lower(new.email) and email_confirmed_at is not null
     limit 1;
    if v_uid is not null then
      new.user_id := v_uid;
      new.accepted_at := coalesce(new.accepted_at, now());
    end if;
  end if;
  return new;
end $$;

create or replace function public.link_members_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is not null and new.email_confirmed_at is not null then
    update project_members
       set user_id = new.id,
           accepted_at = coalesce(accepted_at, now()),
           updated_at = now()
     where user_id is null and deleted_at is null
       and lower(email) = lower(new.email);
  end if;
  return new;
end $$;

drop trigger if exists trg_link_members_on_signup on auth.users;
create trigger trg_link_members_on_signup
  after insert or update of email_confirmed_at on auth.users
  for each row execute function public.link_members_on_signup();

-- ---------------------------------------------------------------- helpers
-- is_project_owner returned true for any existing project. Nothing uses it,
-- but make it say what its name says.
create or replace function public.is_project_owner(p_project_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from projects where id = p_project_id and user_id = p_user_id);
$$;

alter function public.get_my_project_role(uuid) set search_path = public;
alter function public.is_project_member(uuid, uuid) set search_path = public;
alter function public.user_has_project_access(uuid) set search_path = public;

revoke execute on function public.project_access(uuid) from anon, public;
revoke execute on function public.can_read_project(uuid) from anon, public;
revoke execute on function public.can_write_project(uuid) from anon, public;
revoke execute on function public.can_delete_in_project(uuid) from anon, public;
revoke execute on function public.get_my_project_role(uuid) from anon, public;
revoke execute on function public.is_project_member(uuid, uuid) from anon, public;
revoke execute on function public.is_project_owner(uuid, uuid) from anon, public;
revoke execute on function public.user_has_project_access(uuid) from anon, public;
revoke execute on function public.guard_project_member_update() from anon, authenticated, public;
revoke execute on function public.guard_project_owner_change() from anon, authenticated, public;

grant execute on function public.project_access(uuid) to authenticated;
grant execute on function public.can_read_project(uuid) to authenticated;
grant execute on function public.can_write_project(uuid) to authenticated;
grant execute on function public.can_delete_in_project(uuid) to authenticated;
grant execute on function public.get_my_project_role(uuid) to authenticated;
grant execute on function public.is_project_member(uuid, uuid) to authenticated;
grant execute on function public.is_project_owner(uuid, uuid) to authenticated;
grant execute on function public.user_has_project_access(uuid) to authenticated;
grant execute on function public.mise_project_uuid(text) to authenticated;

commit;
