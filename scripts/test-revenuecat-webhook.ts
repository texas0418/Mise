/**
 * scripts/test-revenuecat-webhook.ts
 *
 * Assertions for the RevenueCat webhook's decision logic.
 *
 *   node --experimental-strip-types scripts/test-revenuecat-webhook.ts
 *
 * The webhook is the one piece of Mise that decides whether a paying customer
 * can open the app, and it runs somewhere nobody is watching, triggered by
 * events nobody can easily replay. Its failure mode is silent and it is
 * discovered by a customer.
 *
 * `decide()` is kept free of I/O precisely so it can be pinned down here. The
 * two directions of failure are not equal and are tested as separate concerns:
 *
 * - **Granting Pro to the wrong account** is the security failure. It is what
 *   the whole change exists to prevent, so anything unattributable — an
 *   anonymous id, a non-UUID, a missing user — must be refused rather than
 *   guessed at.
 * - **Revoking Pro from a paying customer** is the one that costs a refund and
 *   a review. So a cancelled-but-not-yet-expired subscription, a billing
 *   grace period, an unknown event type, and a retried stale event must all
 *   leave a working subscription working.
 *
 * `tsconfig.json` excludes `supabase/`, since that code targets Deno rather
 * than React Native — this suite is what typechecks and exercises it.
 */
import {
  decide,
  isStale,
  isUuid,
  resolveUserId,
  PRO_ENTITLEMENT,
} from '../supabase/functions/revenuecat-webhook/entitlementFromEvent.ts';

let pass = 0;
let fail = 0;

function ok(label: string, condition: boolean, detail = '') {
  if (condition) { pass++; return; }
  fail++;
  console.log(`FAIL ${label}${detail ? `\n  ${detail}` : ''}`);
}

const USER = '3f1c0a52-9b2e-4d7a-8c11-6e5b4a0d9f33';
const NOW = Date.UTC(2026, 7, 17, 12, 0, 0); // 2026-08-17T12:00:00Z
const HOUR = 3600_000;

function event(over: Record<string, unknown> = {}) {
  return {
    id: 'evt_1',
    type: 'INITIAL_PURCHASE',
    app_user_id: USER,
    event_timestamp_ms: NOW,
    entitlement_ids: [PRO_ENTITLEMENT],
    ...over,
  };
}

// --- identity: the whole point of the change --------------------------------
// Every one of these must refuse. An event that cannot be attributed to a
// Supabase account is not evidence that any particular account has paid, and
// writing a row anyway would be inventing a customer.

ok('anonymous app_user_id is refused',
  decide(event({ app_user_id: '$RCAnonymousID:9f8e7d6c' }), NOW).action === 'ignore',
  'events from installs that predate Purchases.logIn must not be attributed to anyone');

ok('anonymous refusal says why',
  (decide(event({ app_user_id: '$RCAnonymousID:9f8e7d6c' }), NOW) as any).reason.includes('anonymous'),
  'the reason is the only diagnostic a future session gets from the event log');

ok('a non-UUID app_user_id is refused',
  decide(event({ app_user_id: 'simon@example.com' }), NOW).action === 'ignore');

ok('a missing app_user_id is refused',
  decide(event({ app_user_id: null }), NOW).action === 'ignore');

ok('a malformed UUID is refused',
  decide(event({ app_user_id: '3f1c0a52-9b2e-4d7a-8c11' }), NOW).action === 'ignore');

ok('original_app_user_id is the fallback',
  (decide(event({ app_user_id: '$RCAnonymousID:abc', original_app_user_id: USER }), NOW) as any).userId === USER,
  'after logIn aliases an install, the real id can arrive in either field');

// `aliases` is a real field, confirmed from an actual RevenueCat delivery.
// It carries every id RevenueCat ties to one customer, so a subscription
// bought before signing in is still attributable after logIn aliases it.
ok('aliases is the last resort for attribution',
  (decide(event({ app_user_id: '$RCAnonymousID:abc', original_app_user_id: '$RCAnonymousID:abc',
    aliases: ['$RCAnonymousID:abc', USER] }), NOW) as any).userId === USER,
  'an anonymous purchase that was later signed in must not be thrown away');

ok('app_user_id still wins over aliases',
  (decide(event({ app_user_id: USER,
    aliases: ['9999aaaa-bbbb-4ccc-8ddd-eeeeffff0000', USER] }), NOW) as any).userId === USER,
  'an install signed into two accounts has both in aliases; only app_user_id says which is current');

ok('aliases with nothing usable is still refused',
  decide(event({ app_user_id: '$RCAnonymousID:abc', original_app_user_id: null,
    aliases: ['$RCAnonymousID:abc'] }), NOW).action === 'ignore');

ok('a missing aliases field does not throw',
  decide(event({ app_user_id: 'nope', aliases: undefined }), NOW).action === 'ignore');

ok('an empty payload is refused', decide(null, NOW).action === 'ignore');
ok('an event with no type is refused', decide(event({ type: null }), NOW).action === 'ignore');

ok('isUuid rejects the anonymous prefix', isUuid('$RCAnonymousID:' + USER) === false);
ok('resolveUserId returns null with nothing usable', resolveUserId({}) === null);

// --- grants -----------------------------------------------------------------

for (const type of [
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
  'NON_RENEWING_PURCHASE',
  'SUBSCRIPTION_EXTENDED',
]) {
  const d = decide(event({ type }), NOW) as any;
  ok(`${type} grants Pro`, d.action === 'apply' && d.isPro === true);
  ok(`${type} is attributed to the user`, d.userId === USER);
}

// --- revocations ------------------------------------------------------------

for (const type of ['EXPIRATION', 'SUBSCRIPTION_PAUSED']) {
  const d = decide(event({ type }), NOW) as any;
  ok(`${type} revokes Pro`, d.action === 'apply' && d.isPro === false);
}

// --- cancellation is not loss ----------------------------------------------
// The single most expensive thing this file could get wrong: a customer turns
// off auto-renew on day 2 of a paid month and loses the app on day 2.

const cancelledWithTimeLeft = decide(
  event({ type: 'CANCELLATION', expiration_at_ms: NOW + 10 * 24 * HOUR }), NOW) as any;
ok('CANCELLATION with time left keeps Pro',
  cancelledWithTimeLeft.action === 'apply' && cancelledWithTimeLeft.isPro === true,
  'auto-renew off is not the same as access over — they paid through the period');

ok('CANCELLATION records the expiry',
  cancelledWithTimeLeft.expiresAt === new Date(NOW + 10 * 24 * HOUR).toISOString());

const cancelledPast = decide(
  event({ type: 'CANCELLATION', expiration_at_ms: NOW - HOUR }), NOW) as any;
ok('CANCELLATION whose period already ended revokes',
  cancelledPast.action === 'apply' && cancelledPast.isPro === false);

const cancelledNoExpiry = decide(event({ type: 'CANCELLATION', expiration_at_ms: null }), NOW) as any;
ok('CANCELLATION with no expiry keeps Pro',
  cancelledNoExpiry.isPro === true,
  'unknown end date must not revoke — EXPIRATION is what revokes, and it will arrive');

const billing = decide(
  event({ type: 'BILLING_ISSUE', expiration_at_ms: NOW + 3 * 24 * HOUR }), NOW) as any;
ok('BILLING_ISSUE in grace keeps Pro', billing.isPro === true,
  'a failed card during the grace period is RevenueCat retrying, not a lapse');

// --- entitlement filtering --------------------------------------------------

ok('an event for another entitlement is refused',
  decide(event({ entitlement_ids: ['some_other_entitlement'] }), NOW).action === 'ignore');

ok('an event with no entitlement field is accepted',
  decide(event({ entitlement_ids: null }), NOW).action === 'apply',
  'older payload versions omit it and every product in this app grants Pro');

ok('the singular entitlement_id form is read',
  decide(event({ entitlement_ids: null, entitlement_id: PRO_ENTITLEMENT }), NOW).action === 'apply');

ok('the entitlement id matches the app',
  PRO_ENTITLEMENT === 'Mise Film Director Suite Pro',
  'must equal ENTITLEMENT_ID in contexts/SubscriptionContext.tsx or every event is filtered out');

// --- event types we do not handle ------------------------------------------
// These must never revoke. RevenueCat adds event types on its own schedule and
// a webhook that reads "unrecognised" as "unpaid" locks customers out for it.

const unknown = decide(event({ type: 'SOMETHING_NEW_IN_2027' }), NOW);
ok('an unknown event type changes nothing', unknown.action === 'ignore');

ok('TEST is ignored, not attempted',
  decide(event({ type: 'TEST' }), NOW).action === 'ignore',
  'the dashboard Send-test-event button has to come back 200 during setup');

ok('TEST is ignored even when malformed',
  decide({ type: 'TEST' }, NOW).action === 'ignore');

ok('TRANSFER is ignored rather than half-applied',
  decide(event({ type: 'TRANSFER' }), NOW).action === 'ignore');

// --- timestamps -------------------------------------------------------------

ok('the event timestamp is used as eventAt',
  (decide(event({ event_timestamp_ms: NOW - HOUR }), NOW) as any).eventAt ===
    new Date(NOW - HOUR).toISOString());

ok('a missing event timestamp falls back to now',
  (decide(event({ event_timestamp_ms: null }), NOW) as any).eventAt === new Date(NOW).toISOString(),
  'a null here must not become epoch 0, which would make every later event stale');

ok('a zero expiry is null, not 1970',
  (decide(event({ expiration_at_ms: 0 }), NOW) as any).expiresAt === null);

// --- out-of-order delivery --------------------------------------------------
// RevenueCat retries failures, so a stale EXPIRATION can land after the
// RENEWAL that superseded it.

const t1 = new Date(NOW).toISOString();
const t0 = new Date(NOW - HOUR).toISOString();

ok('an older event is stale', isStale(t1, t0) === true,
  'a retried EXPIRATION must not revoke a subscription that has since renewed');
ok('a newer event is not stale', isStale(t0, t1) === false);
ok('the same event redelivered is stale', isStale(t1, t1) === true);
ok('the first event for an account is never stale', isStale(null, t1) === false);
ok('an unparseable stored timestamp does not block writes', isStale('not a date', t1) === false);

// ---------------------------------------------------------------------------

console.log(`${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
