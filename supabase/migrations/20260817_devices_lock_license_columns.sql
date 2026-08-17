-- 20260817_devices_lock_license_columns.sql
--
-- Make devices.is_licensed server-only. Applied to project mnzkjdpwaibufwhirkon.
--
-- The web build gates on this column, and `devices_owner` (ALL, auth.uid() =
-- user_id) let any signed-in user write their own row — so anyone could set
-- is_licensed = true and let themselves into the paid web app. Revoking the
-- client's write on `entitlements` did not close this, because the gate accepts
-- either source and `entitlements` is empty until Purchases.logIn ships.
--
-- A column-level REVOKE was the obvious fix and is the wrong one: the shipped
-- app inserts `is_licensed: false` explicitly on every launch (registerDevice
-- in lib/deviceManager.ts), and a revoke forbids naming the column at all,
-- which would break registration for every live user.
--
-- So the columns are pinned by a trigger. Clients still insert and update their
-- own device rows — name, model, last_active, soft delete — and the licensing
-- columns do not move for them.
--
-- NOTE: the first version of this function was SECURITY DEFINER, which makes
-- current_user the function's owner rather than the caller, so the client check
-- never matched and a client could still insert an already-licensed device.
-- Caught by testing the behaviour instead of trusting the migration's success.
-- SECURITY INVOKER is also simply correct: the function only rewrites NEW.
create or replace function public.devices_lock_license_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- PostgREST sets the role per request: 'authenticated' or 'anon' for clients,
  -- 'service_role' for the edge functions. Anything else is an admin session.
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.is_licensed := false;
      new.license_tier := null;
    else
      new.is_licensed := old.is_licensed;
      new.license_tier := old.license_tier;
    end if;
  end if;
  return new;
end
$$;

drop trigger if exists devices_lock_license on public.devices;

create trigger devices_lock_license
  before insert or update on public.devices
  for each row execute function public.devices_lock_license_columns();

comment on function public.devices_lock_license_columns() is
  'Pins devices.is_licensed and license_tier against client writes. Registration still works; only the server grants a licence.';

-- KNOWN CONSEQUENCE, accepted deliberately (Simon, 2026-08-17): the purchase
-- flow can no longer license a device either. activateDevice() still reports
-- success and the flag no longer moves. A new subscriber gets Pro on their
-- phone via the RevenueCat entitlement, and reaches the web build once the
-- webhook has written their entitlements row — which needs Purchases.logIn
-- (#115) in a shipped release. Server-side activation is the follow-up.
