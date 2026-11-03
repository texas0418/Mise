-- Crew seats: a director's plan covers the crew they invite, up to the plan's
-- number (Simon, 2026-11-03). Solo 1, Crew 5, Production 15, Studio 40,
-- Slate 250, the same numbers as lib/tiers.ts deviceLimit. The owner takes
-- one seat. Everyone past the number needs their own subscription.
--
-- Who is covered: an owner's accepted members across all of the owner's
-- live projects, counted once per person, oldest acceptance first. A member
-- who pays for their own Pro does not use one of the owner's seats. Pending
-- invites do not count.
--
-- Enforced in project_access(): a member row only opens a project when the
-- member has their own Pro or holds one of the owner's seats. Every member
-- policy goes through project_access(), so an uncovered member reads and
-- writes nothing.

begin;

alter table public.entitlements add column if not exists seats integer not null default 1;

-- Seats for a store product id. Apple: com.mise.film_director_suite.crew_monthly.
-- Play, as RevenueCat reports it: mise_crew:crew-monthly. Legacy pro_* is Solo.
create or replace function public.mise_seats_for_product(p_product text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p_product ilike '%slate%' then 250
    when p_product ilike '%studio%' then 40
    when p_product ilike '%production%' then 15
    when p_product ilike '%crew%' then 5
    else 1
  end;
$$;

create or replace function public.mise_has_own_pro(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from entitlements e
     where e.user_id = p_uid and e.is_pro
       and (e.expires_at is null or e.expires_at > now())
  );
$$;

create or replace function public.mise_owner_seats(p_owner uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select e.seats from entitlements e
     where e.user_id = p_owner and e.is_pro
       and (e.expires_at is null or e.expires_at > now())
  ), 0);
$$;

-- The owner's members who use a seat, in seat order.
create or replace function public.mise_seat_holders(p_owner uuid)
returns table (user_id uuid, seat integer)
language sql
stable
security definer
set search_path = public
as $$
  with members as (
    select m.user_id, min(m.accepted_at) as first_at
      from project_members m
      join projects p on p.id = m.project_id
     where p.user_id = p_owner and p.deleted_at is null
       and m.deleted_at is null and m.accepted_at is not null
       and m.user_id is not null and m.user_id <> p_owner
       and not public.mise_has_own_pro(m.user_id)
     group by m.user_id
  )
  select user_id, (row_number() over (order by first_at, user_id))::integer as seat
    from members;
$$;

create or replace function public.mise_seat_covered(p_owner uuid, p_member uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.mise_seat_holders(p_owner) h
     where h.user_id = p_member and h.seat <= public.mise_owner_seats(p_owner) - 1
  );
$$;

create or replace function public.project_access(p_project_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1 from projects p
      where p.id = p_project_id and p.user_id = auth.uid() and p.deleted_at is null
    ) then 'owner'
    else (
      select m.role from project_members m
        join projects p on p.id = m.project_id
      where m.project_id = p_project_id
        and m.user_id = auth.uid()
        and m.accepted_at is not null
        and m.deleted_at is null
        and (public.mise_has_own_pro(auth.uid()) or public.mise_seat_covered(p.user_id, auth.uid()))
      limit 1
    )
  end;
$$;

-- For the app: may this account sync? Own Pro, or a seat on any project.
create or replace function public.mise_sync_access()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'own_pro', public.mise_has_own_pro(auth.uid()),
    'seat_covered', exists (
      select 1 from project_members m join projects p on p.id = m.project_id
       where m.user_id = auth.uid() and m.accepted_at is not null and m.deleted_at is null
         and p.deleted_at is null and public.mise_seat_covered(p.user_id, auth.uid())
    )
  );
$$;

-- For the invite screen: the caller's seats as an owner.
create or replace function public.mise_seat_status()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'seats', public.mise_owner_seats(auth.uid()),
    'used', 1 + (select count(*) from public.mise_seat_holders(auth.uid()))
  );
$$;

-- Backfill seats from the last product each account bought.
update public.entitlements e
   set seats = public.mise_seats_for_product(x.product)
  from (
    select distinct on (ev.user_id) ev.user_id,
           coalesce(ev.payload->>'new_product_id', ev.payload->>'product_id') as product
      from public.revenuecat_events ev
     where ev.user_id is not null
       and coalesce(ev.payload->>'new_product_id', ev.payload->>'product_id') is not null
     order by ev.user_id, (ev.payload->>'event_timestamp_ms')::bigint desc nulls last
  ) x
 where x.user_id = e.user_id;

revoke execute on function public.mise_has_own_pro(uuid) from anon, public, authenticated;
revoke execute on function public.mise_owner_seats(uuid) from anon, public, authenticated;
revoke execute on function public.mise_seat_holders(uuid) from anon, public, authenticated;
revoke execute on function public.mise_seat_covered(uuid, uuid) from anon, public, authenticated;
revoke execute on function public.mise_sync_access() from anon, public;
revoke execute on function public.mise_seat_status() from anon, public;
revoke execute on function public.project_access(uuid) from anon, public;
revoke execute on function public.mise_seats_for_product(text) from anon, public, authenticated;
grant execute on function public.mise_sync_access() to authenticated;
grant execute on function public.mise_seat_status() to authenticated;
grant execute on function public.project_access(uuid) to authenticated;

commit;
