/**
 * scripts/test-sync-entitlement.ts
 *
 *   node --experimental-strip-types scripts/test-sync-entitlement.ts
 *
 * Assertions for the entitlement backfill's decision logic.
 *
 * This function exists to fix a bug that was invisible: someone subscribes
 * while signed out, signs in afterwards, and never gets a row — so the app says
 * Pro and the website says free, with nothing anywhere reporting a failure. It
 * is worth being careful that the fix cannot fail the same quiet way.
 *
 * Two directions of error, and they are not symmetrical:
 *
 * - **Granting Pro to someone who did not pay** is the one that costs money and
 *   cannot be undone by a later event. An expired entitlement is still listed
 *   by `/v1/subscribers`, so "the key is present" must never be enough.
 * - **Failing to grant** costs a delay: the next renewal writes the row through
 *   the webhook anyway. So an unreadable date declines rather than guesses.
 *
 * The third concern is that this function must not damage the webhook, which is
 * the authoritative writer. `shouldWrite` is tested for that specifically.
 */
import {
  entitlementFromSubscriber,
  isUuid,
  shouldWrite,
  PRO_ENTITLEMENT,
  type RevenueCatSubscriber,
} from '../supabase/functions/sync-entitlement/entitlementFromSubscriber.ts';

let pass = 0;
let fail = 0;

function ok(label: string, condition: boolean, detail = '') {
  if (condition) { pass++; return; }
  fail++;
  console.log(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

const NOW = Date.parse('2026-08-17T12:00:00Z');
const FUTURE = '2026-09-17T12:00:00Z';
const PAST = '2026-07-17T12:00:00Z';

function subscriber(entitlement: Record<string, unknown> | null): RevenueCatSubscriber {
  return { entitlements: entitlement ? { [PRO_ENTITLEMENT]: entitlement } : {} } as RevenueCatSubscriber;
}

// ─── Granting ───────────────────────────────────────────────────────────────

const active = entitlementFromSubscriber(
  subscriber({ expires_date: FUTURE, purchase_date: PAST }), NOW);
ok('an unexpired entitlement is Pro', active.isPro === true);
ok('the expiry is carried through', active.expiresAt === new Date(FUTURE).toISOString());
ok('the purchase date is carried through as the cursor',
  active.purchasedAt === new Date(PAST).toISOString());

const lifetime = entitlementFromSubscriber(subscriber({ expires_date: null }), NOW);
ok('a null expiry is a lifetime grant, not an unknown', lifetime.isPro === true,
  'RevenueCat states non-expiring entitlements as an explicit null');
ok('a lifetime grant stores no expiry', lifetime.expiresAt === null);

// ─── Refusing ───────────────────────────────────────────────────────────────

ok('an expired entitlement is not Pro',
  entitlementFromSubscriber(subscriber({ expires_date: PAST }), NOW).isPro === false,
  '/v1/subscribers lists entitlements the customer no longer holds');

ok('an entitlement expiring exactly now is not Pro',
  entitlementFromSubscriber(
    subscriber({ expires_date: '2026-08-17T12:00:00Z' }), NOW).isPro === false,
  'the boundary must not round in the customer’s favour');

ok('a customer with no Pro entitlement is not Pro',
  entitlementFromSubscriber(subscriber(null), NOW).isPro === false);

ok('a different entitlement does not grant Pro',
  entitlementFromSubscriber(
    { entitlements: { 'Some Other Thing': { expires_date: FUTURE } } }, NOW).isPro === false);

ok('an unparseable expiry declines rather than guesses',
  entitlementFromSubscriber(subscriber({ expires_date: 'whenever' }), NOW).isPro === false,
  'granting on a date we cannot read is a free subscription');

ok('a missing subscriber is not Pro',
  entitlementFromSubscriber(null, NOW).isPro === false);
ok('a malformed subscriber is not Pro',
  entitlementFromSubscriber(undefined, NOW).isPro === false);

// Every refusal must say why, because the event log is the only place anyone
// can find out what happened to a customer who says the website locked them out.
for (const [label, value] of [
  ['no entitlement', subscriber(null)],
  ['expired', subscriber({ expires_date: PAST })],
  ['unparseable', subscriber({ expires_date: 'whenever' })],
] as const) {
  const r = entitlementFromSubscriber(value, NOW);
  ok(`a refusal states a reason (${label})`, r.reason.length > 0);
}

// ─── Not fighting the webhook ───────────────────────────────────────────────

ok('an existing row is never overwritten',
  shouldWrite({ user_id: 'x' }, { isPro: true, expiresAt: FUTURE, purchasedAt: PAST, reason: '' })
    === false,
  'the webhook sees the whole lifecycle; this function sees one moment');

ok('a missing row for a paying customer is written',
  shouldWrite(null, { isPro: true, expiresAt: FUTURE, purchasedAt: PAST, reason: '' }) === true);

ok('a missing row for a non-paying customer is not written',
  shouldWrite(null, { isPro: false, expiresAt: null, purchasedAt: null, reason: '' }) === false,
  'writing is_pro=false would invent a row saying nothing the absence did not');

// ─── Identity ───────────────────────────────────────────────────────────────

ok('a real uuid is accepted', isUuid('e3b9c097-5e4a-4e31-8701-d073e1178d10') === true);
ok('an anonymous RevenueCat id is not a uuid',
  isUuid('$RCAnonymousID:7e57e0ec297248b183ae6726c15fc3ec') === false);
ok('an empty string is not a uuid', isUuid('') === false);
ok('a non-string is not a uuid', isUuid(null) === false);

// ---------------------------------------------------------------------------

console.log(`${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
