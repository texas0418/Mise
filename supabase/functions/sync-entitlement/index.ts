/**
 * supabase/functions/sync-entitlement/index.ts
 *
 * Fills in the entitlement row for someone who subscribed before they had an
 * account.
 *
 * See entitlementFromSubscriber.ts for why that hole exists. In short: Mise
 * lets people buy while signed out, the resulting INITIAL_PURCHASE carries only
 * an anonymous id and is dropped, and the sign-in that follows aliases the
 * customer without emitting any event for the webhook to act on. Nothing else
 * ever writes their row, so the web build reads them as free.
 *
 * The app calls this after `Purchases.logIn` succeeds.
 *
 * ## Why this cannot be done in the app
 *
 * It is the same question the webhook answers, and it has the same answer: a
 * client asserting its own entitlement is the user's claim about themselves,
 * which is exactly what #112 removed. The client's INSERT/UPDATE on
 * `entitlements` is revoked and stays revoked.
 *
 * So the trust here rests on two things, and neither involves believing the
 * caller:
 *
 *   1. **Who they are** comes from the Supabase JWT, verified by
 *      `auth.getUser()`. The request body is never read for identity — a body
 *      field would let anyone grant Pro to any account by typing a different
 *      uuid.
 *   2. **What they bought** comes from RevenueCat over the network, not from
 *      the request.
 *
 * ## Deployment
 *
 * Unlike the webhook this keeps `verify_jwt` at its default of true: the caller
 * is a signed-in Mise user holding a real Supabase token, so there is no reason
 * to hand-roll authentication.
 *
 *   supabase functions deploy sync-entitlement
 *
 * `REVENUECAT_API_KEY` is optional and defaults to the iOS SDK key, which is
 * public by nature — it ships inside the app — and is accepted by
 * `/v1/subscribers`. Setting a secret key narrows what a leak of this
 * function's environment would expose:
 *
 *   supabase secrets set REVENUECAT_API_KEY=sk_…
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  entitlementFromSubscriber,
  isUuid,
  shouldWrite,
  type RevenueCatSubscriber,
} from './entitlementFromSubscriber.ts';

/** The public iOS SDK key from contexts/SubscriptionContext.tsx. */
const DEFAULT_REVENUECAT_KEY = 'appl_hDSIJdgEdYkPSIavpEfPgjEImCA';

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Who is calling, according to their token rather than their claim.
 *
 * The anon key plus the caller's own Authorization header is what makes
 * `getUser()` authoritative: it validates the JWT signature server-side and
 * returns the user that token was actually minted for.
 */
async function callerId(req: Request): Promise<string | null> {
  const authorization = req.headers.get('Authorization');
  if (!authorization) return null;

  const scoped = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } }
  );

  const { data, error } = await scoped.auth.getUser();
  if (error || !data?.user?.id) return null;
  return data.user.id;
}

function serviceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );
}

/**
 * Ask RevenueCat what this account holds.
 *
 * Looking the customer up by the Supabase id works precisely because
 * `Purchases.logIn` aliased it onto the existing anonymous customer — RevenueCat
 * resolves an alias to the same subscriber, so this returns the anonymous
 * purchase made before the account existed. That is the whole point.
 *
 * Note this endpoint is get-or-create: querying an id RevenueCat has never seen
 * returns an empty subscriber rather than a 404. That is harmless here (an
 * empty subscriber holds no entitlement and writes nothing) and is why the
 * absence of a customer is not treated as an error.
 */
async function fetchSubscriber(userId: string): Promise<RevenueCatSubscriber | null> {
  const key = Deno.env.get('REVENUECAT_API_KEY') || DEFAULT_REVENUECAT_KEY;
  const res = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
    { headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' } }
  );

  if (!res.ok) {
    console.warn(`[sync-entitlement] RevenueCat responded ${res.status}`);
    return null;
  }

  const body = await res.json().catch(() => null);
  return (body?.subscriber as RevenueCatSubscriber) ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' });

  const userId = await callerId(req);
  if (!userId || !isUuid(userId)) return json(401, { error: 'unauthorized' });

  const subscriber = await fetchSubscriber(userId);
  if (!subscriber) {
    // Reaching RevenueCat failed. 502 rather than 200 so a retry is possible,
    // but the caller treats any failure as a no-op either way.
    return json(502, { error: 'could not reach RevenueCat' });
  }

  const entitlement = entitlementFromSubscriber(subscriber, Date.now());

  const supabase = serviceClient();
  const existing = await supabase
    .from('entitlements')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing.error) {
    console.error('[sync-entitlement] read failed:', existing.error.message);
    return json(500, { error: 'could not read current entitlement' });
  }

  if (!shouldWrite(existing.data, entitlement)) {
    console.log(`[sync-entitlement] ${userId} no write: ${entitlement.reason}`);
    return json(200, { ok: true, written: false, reason: entitlement.reason });
  }

  const { error } = await supabase.from('entitlements').insert({
    user_id: userId,
    is_pro: true,
    source: 'subscription',
    expires_at: entitlement.expiresAt,
    /*
     * The purchase date, deliberately not `now`. This column is the webhook's
     * out-of-order guard, so stamping it with the current time would make every
     * subsequent real event look stale and be skipped.
     */
    last_event_at: entitlement.purchasedAt,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    /*
     * A unique violation means the webhook wrote the row between the read above
     * and this insert. That is the correct outcome, not a failure — the webhook
     * is the more informed writer and this function exists only to fill a hole.
     */
    if (error.code === '23505') {
      return json(200, { ok: true, written: false, reason: 'row already written' });
    }
    console.error('[sync-entitlement] insert failed:', error.message);
    return json(500, { error: 'could not write entitlement' });
  }

  console.log(`[sync-entitlement] ${userId} backfilled is_pro=true (${entitlement.reason})`);
  return json(200, { ok: true, written: true, expires_at: entitlement.expiresAt });
});
