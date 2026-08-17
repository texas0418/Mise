/**
 * supabase/functions/revenuecat-webhook/entitlementFromEvent.ts
 *
 * The decision half of the RevenueCat webhook, kept pure so it can be tested
 * without Deno, a network, or a database (scripts/test-revenuecat-webhook.ts).
 *
 * `index.ts` does the I/O — auth, reading the current row, writing — and this
 * file answers the only question that is easy to get wrong: given one event,
 * does this account have Pro or not, and until when?
 *
 * Two principles run through every branch below, because this code decides
 * whether someone who paid can open the app they paid for:
 *
 *   1. **An unrecognised event never revokes.** New event types get added to
 *      RevenueCat, and a webhook that treats "I don't know this" as "not paid"
 *      would lock people out on RevenueCat's release schedule rather than on
 *      anything the customer did.
 *   2. **Ambiguous data never revokes either.** Loss of entitlement is stated
 *      explicitly by EXPIRATION. Everything else that *might* mean a lapse
 *      (a cancelled auto-renewal, a failed card) still has paid-for time left
 *      on it, and that time is honoured.
 *
 * No import in this file, on purpose: it has to load under both Deno and
 * `node --experimental-strip-types`.
 */

/** The subset of a RevenueCat webhook event this function reads. */
export interface RevenueCatEvent {
  id?: string | null;
  type?: string | null;
  app_user_id?: string | null;
  original_app_user_id?: string | null;
  event_timestamp_ms?: number | null;
  expiration_at_ms?: number | null;
  entitlement_ids?: string[] | null;
  /** Older RevenueCat payloads carry a single id instead of the array. */
  entitlement_id?: string | null;
}

export type Decision =
  | {
      action: 'apply';
      userId: string;
      isPro: boolean;
      expiresAt: string | null;
      eventAt: string;
      reason: string;
    }
  | { action: 'ignore'; reason: string };

/**
 * The entitlement that means "Pro" in this app.
 *
 * Must match ENTITLEMENT_ID in contexts/SubscriptionContext.tsx. The
 * additional-device products are separate SKUs that grant the same
 * entitlement, so filtering on the entitlement rather than the product is what
 * keeps an add-on purchase from being read as something other than Pro.
 */
export const PRO_ENTITLEMENT = 'Mise Film Director Suite Pro';

/** Event types that mean the subscription is active as of this event. */
const GRANTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
  'NON_RENEWING_PURCHASE',
  'SUBSCRIPTION_EXTENDED',
]);

/** Event types that mean the subscription is over, now. */
const REVOKES = new Set(['EXPIRATION', 'SUBSCRIPTION_PAUSED']);

/**
 * Event types that say something changed about *renewal*, not about access.
 *
 * CANCELLATION means auto-renew was switched off — the customer keeps what
 * they bought until `expiration_at_ms`. BILLING_ISSUE means a payment failed
 * and RevenueCat is in a grace period. Treating either as immediate loss would
 * take the app away from someone in the middle of a paid month, and would be
 * visible to them as a bug. EXPIRATION arrives later and is what revokes.
 */
const HONOUR_EXPIRY = new Set(['CANCELLATION', 'BILLING_ISSUE']);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/**
 * Which Supabase account this event belongs to, if any.
 *
 * `app_user_id` is whatever the app told RevenueCat it was. Before the
 * `Purchases.logIn` fix, that was always an anonymous per-install id
 * (`$RCAnonymousID:…`), and it stays that way for every customer until a build
 * carrying the fix runs on their device. Those events are unattributable and
 * must be dropped rather than guessed at.
 *
 * `original_app_user_id` is checked second: after `logIn` aliases an anonymous
 * id, some events still carry the anonymous id as the original and the real
 * one as `app_user_id`, and occasionally the reverse.
 */
export function resolveUserId(event: RevenueCatEvent): string | null {
  if (isUuid(event.app_user_id)) return event.app_user_id as string;
  if (isUuid(event.original_app_user_id)) return event.original_app_user_id as string;
  return null;
}

/**
 * Whether this event concerns the Pro entitlement.
 *
 * An event with no entitlement information at all is accepted: older payload
 * versions omit it, and this app sells nothing that does not grant Pro. An
 * event that names entitlements and does not include Pro is not ours.
 */
function touchesProEntitlement(event: RevenueCatEvent): boolean {
  const ids =
    event.entitlement_ids ??
    (typeof event.entitlement_id === 'string' ? [event.entitlement_id] : null);
  if (!ids || ids.length === 0) return true;
  return ids.includes(PRO_ENTITLEMENT);
}

function msToIso(ms: number | null | undefined): string | null {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms <= 0) return null;
  return new Date(ms).toISOString();
}

/**
 * Event types that are recognised and deliberately not acted on.
 *
 * TEST is checked before anything else so that "Send test event" in the
 * RevenueCat dashboard always comes back 200 during setup, whatever it puts in
 * the other fields.
 *
 * TRANSFER moves an entitlement between app user ids and carries
 * transferred_from/transferred_to rather than a single subject. Handling it
 * properly means revoking from one account and granting to another; nothing in
 * Mise creates them today (they come from Apple family sharing and manual
 * support transfers), so it is logged and left alone rather than half-done.
 */
const SKIP: Record<string, string> = {
  TEST: 'test event',
  TRANSFER: 'TRANSFER is not handled — see #76',
};

/** Why an event could not be tied to an account, phrased for the event log. */
function unattributableReason(event: RevenueCatEvent): string {
  const raw = event.app_user_id ?? '';
  return typeof raw === 'string' && raw.startsWith('$RCAnonymousID:')
    ? 'anonymous app_user_id — device has not run a build with Purchases.logIn'
    : 'app_user_id is not a Supabase user id';
}

/**
 * Whether a renewal-status change leaves the customer still inside the period
 * they paid for.
 *
 * No expiry on the event means we do not know when that period ends. Keeping
 * access is the recoverable mistake: EXPIRATION will arrive and revoke.
 * Guessing the other way charges a paying customer for nothing.
 */
function stillWithinPaidPeriod(event: RevenueCatEvent, nowMs: number): boolean {
  return event.expiration_at_ms == null || event.expiration_at_ms > nowMs;
}

/**
 * Decide what this event means for one account's entitlement.
 *
 * `nowMs` is a parameter rather than a call to Date.now() so the expiry
 * branches can be tested at a fixed point in time.
 */
export function decide(event: RevenueCatEvent | null | undefined, nowMs: number): Decision {
  if (!event || typeof event !== 'object') {
    return { action: 'ignore', reason: 'no event object in payload' };
  }

  const type = typeof event.type === 'string' ? event.type : '';
  if (!type) return { action: 'ignore', reason: 'event has no type' };
  if (SKIP[type]) return { action: 'ignore', reason: SKIP[type] };

  const userId = resolveUserId(event);
  if (!userId) return { action: 'ignore', reason: unattributableReason(event) };

  if (!touchesProEntitlement(event)) {
    return { action: 'ignore', reason: `event does not concern ${PRO_ENTITLEMENT}` };
  }

  const base = {
    action: 'apply' as const,
    userId,
    expiresAt: msToIso(event.expiration_at_ms),
    eventAt: msToIso(event.event_timestamp_ms) ?? new Date(nowMs).toISOString(),
  };

  if (GRANTS.has(type)) return { ...base, isPro: true, reason: type };
  if (REVOKES.has(type)) return { ...base, isPro: false, reason: type };

  if (HONOUR_EXPIRY.has(type)) {
    const stillPaid = stillWithinPaidPeriod(event, nowMs);
    return {
      ...base,
      isPro: stillPaid,
      reason: stillPaid ? `${type} — paid period still running` : `${type} — paid period ended`,
    };
  }

  return { action: 'ignore', reason: `unhandled event type ${type}` };
}

/**
 * Whether an event should be skipped because a newer one has already been
 * applied to this account.
 *
 * RevenueCat retries failed deliveries, so an EXPIRATION that failed at 10:00
 * can arrive after the RENEWAL that succeeded at 10:05. Applying it would
 * revoke a subscription that had just been renewed, and nothing would correct
 * it until the next renewal a month later. Equal timestamps are treated as
 * stale so a redelivery of the same event is a no-op.
 */
export function isStale(appliedAt: string | null | undefined, eventAt: string): boolean {
  if (!appliedAt) return false;
  const applied = Date.parse(appliedAt);
  const incoming = Date.parse(eventAt);
  if (Number.isNaN(applied) || Number.isNaN(incoming)) return false;
  return incoming <= applied;
}
