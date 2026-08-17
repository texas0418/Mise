-- 20260817_entitlements_server_authoritative.sql
--
-- Revoke the client's ability to write its own entitlement.
-- Applied to project mnzkjdpwaibufwhirkon.
--
-- `entitlements` was written by the app under owner RLS (#112): the policies
-- below let any authenticated user insert or update the row whose user_id is
-- their own. That makes the record of who has paid a claim the user makes
-- about themselves. Anyone with their own access token — which every signed-in
-- user has, in plain text, on their own device — could set is_pro and let
-- themselves into the desktop build.
--
-- It stops being self-attested here. The RevenueCat webhook
-- (supabase/functions/revenuecat-webhook) writes this table with the service
-- role, which bypasses RLS, and the client keeps SELECT so it can still read
-- what it is entitled to.
--
-- Nothing shipped is broken by this. The client write lives in
-- lib/entitlementMirror.ts, which is on `dev` and is not in 1.0 (live) or
-- 1.1.0 (in review) — so no build in a customer's hands attempts this write.
-- The same PR that carries this migration stops the client attempting it at
-- all, rather than leaving a call that is now guaranteed to fail.
--
-- `devices.is_licensed` is deliberately NOT locked down here. It is a blanket
-- owner policy (`devices_owner`, ALL, auth.uid() = user_id) and the desktop
-- gate reads it as an alternative source of truth, so the gate stays soft
-- until that is dealt with too — see the note in the PR and #76. Locking it
-- now would break device registration, which legitimately writes those rows
-- from the client on every launch.

drop policy if exists "own entitlement upsert" on public.entitlements;
drop policy if exists "own entitlement update" on public.entitlements;

-- Left in place: "own entitlement read" (SELECT, auth.uid() = user_id).

comment on table public.entitlements is
  'Server-authoritative entitlement, written only by the revenuecat-webhook edge function (service role). Clients may read their own row and nothing else.';
