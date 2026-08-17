# supabase/

Server-side pieces of Mise: the RevenueCat webhook and the SQL that has been
applied to project `mnzkjdpwaibufwhirkon` (MiseApp).

## These migrations are a record, not a pipeline

Mise's schema has always been managed out of band — there is no `supabase link`
in this repo and no migration chain to replay. The files in `migrations/` are
the exact SQL that was applied, checked in so that the next session can read
what the database is supposed to look like instead of inferring it from
`lib/deviceManager.ts` comments.

Applying them a second time is safe (`if not exists`, `drop policy if exists`),
but nothing does that automatically. If you change the schema, apply it and
then commit the SQL you applied.

## Why entitlement moved to the server

`entitlements` used to be written by the app (#112) under owner RLS: the row
recording whether someone had paid was writable by that same someone. Tolerable
while it was only read on-device inside an app the App Store had already gated.
Not tolerable once a browser build reads that row to decide whether to open at
all (#111), because any signed-in user has their own access token in plain text
on their own machine.

So:

- `functions/revenuecat-webhook` writes the table with the service role.
- `20260817_entitlements_server_authoritative.sql` drops the client's
  INSERT/UPDATE policies. SELECT stays, so the app can still read what it has.
- `contexts/DeviceLicenseContext.tsx` no longer attempts the write, and
  `lib/entitlementMirror.ts` is gone.

**`devices.is_licensed` is still client-writable** and the desktop gate accepts
it as an alternative source of truth, so the gate is not yet hard. That is
deliberate — device registration legitimately writes those rows from the client
on every launch, and the mirror is empty until updated builds are in people's
hands. See #76.

## Deploying the function

Deployed through the Supabase MCP connection, since the `supabase` CLI on this
machine is logged into a different account:

- name `revenuecat-webhook`, entrypoint `index.ts`
- **`verify_jwt: false`** — RevenueCat cannot mint a Supabase JWT, so the
  function authenticates itself by comparing the whole `Authorization` header
  against `REVENUECAT_WEBHOOK_SECRET`.

`REVENUECAT_WEBHOOK_SECRET` is set in the Supabase dashboard (Edge Functions →
Secrets) and the same value goes in RevenueCat's webhook Authorization header.
Until it is set the function returns 500 to everything, on purpose: an
unconfigured secret must never be read as "allow".

## Testing it

- `scripts/test-revenuecat-webhook.ts` (in CI, via `npm test`) covers every
  branch of `decide()` — which events grant, which revoke, and which are
  refused as unattributable.
- `tsconfig.json` excludes `supabase/`, because this is Deno rather than React
  Native. `deno check functions/revenuecat-webhook/index.ts` typechecks it.
