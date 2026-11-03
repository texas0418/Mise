-- lighting_diagrams: the one syncable table with no server table.
--
-- lib/syncConfig.ts has listed lighting_diagrams since the lighting editor
-- shipped, so every sync pushed and pulled it and got a 404 back. Columns
-- follow types/lighting-types.ts (LightingDiagram) through the sync engine's
-- camelCase to snake_case conversion; elements is the canvas, kept as jsonb.
--
-- Access matches the other project child tables: read with can_read_project,
-- write with can_write_project, hard delete with can_delete_in_project. Soft
-- deletes are checked by guard_soft_delete() from
-- 20261103_soft_delete_needs_delete_right.sql when that has been applied.
--
-- NOT APPLIED. The file commits itself, so dry-run it with the commit swapped:
--   sed 's/^commit;$/rollback;/' supabase/migrations/20261103_lighting_diagrams_table.sql | psql "$DB_URL" -v ON_ERROR_STOP=1

begin;

create table if not exists public.lighting_diagrams (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid default auth.uid() references auth.users (id) on delete cascade,
  project_id    uuid not null references public.projects (id) on delete cascade,
  scene_number  integer,
  shot_number   text,
  title         text not null default '',
  description   text,
  template_name text,
  elements      jsonb not null default '[]'::jsonb,
  bg_style      text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create index if not exists lighting_diagrams_project_id_idx on public.lighting_diagrams (project_id);
create index if not exists lighting_diagrams_updated_at_idx on public.lighting_diagrams (updated_at);

alter table public.lighting_diagrams enable row level security;

drop policy if exists lighting_diagrams_select on public.lighting_diagrams;
create policy lighting_diagrams_select on public.lighting_diagrams
  for select to authenticated
  using (public.can_read_project(project_id));

drop policy if exists lighting_diagrams_insert on public.lighting_diagrams;
create policy lighting_diagrams_insert on public.lighting_diagrams
  for insert to authenticated
  with check (public.can_write_project(project_id));

drop policy if exists lighting_diagrams_update on public.lighting_diagrams;
create policy lighting_diagrams_update on public.lighting_diagrams
  for update to authenticated
  using (public.can_write_project(project_id))
  with check (public.can_write_project(project_id));

drop policy if exists lighting_diagrams_delete on public.lighting_diagrams;
create policy lighting_diagrams_delete on public.lighting_diagrams
  for delete to authenticated
  using (public.can_delete_in_project(project_id));

grant select, insert, update, delete on public.lighting_diagrams to authenticated;

-- updated_at on every update, so other devices' cursors see the change even
-- when a writer forgets to set it.
create or replace function public.lighting_diagrams_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end $$;

revoke execute on function public.lighting_diagrams_set_updated_at() from anon, authenticated, public;

drop trigger if exists trg_lighting_diagrams_updated_at on public.lighting_diagrams;
create trigger trg_lighting_diagrams_updated_at
  before update on public.lighting_diagrams
  for each row execute function public.lighting_diagrams_set_updated_at();

-- The soft-delete guard, if its migration is already in.
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'guard_soft_delete') then
    execute 'drop trigger if exists trg_guard_soft_delete on public.lighting_diagrams';
    execute 'create trigger trg_guard_soft_delete before update on public.lighting_diagrams
             for each row execute function public.guard_soft_delete()';
  end if;
end $$;

-- Realtime, like the other synced tables.
do $$
begin
  alter publication supabase_realtime add table public.lighting_diagrams;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

commit;
