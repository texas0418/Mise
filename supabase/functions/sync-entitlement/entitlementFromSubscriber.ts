/**
 * supabase/functions/sync-entitlement/entitlementFromSubscriber.ts
 *
 * The decision half of the entitlement backfill, kept pure so it can be tested
 * without Deno, a network, or a database (scripts/test-sync-entitlement.ts).
 *
 * ## Why a backfill exists at all
 *
 * `entitlements` is written by the `revenuecat-webhook` function, and webhooks
 * fire on *events* — INITIAL_PURCHASE, RENEWAL, EXPIRATION. That covers every
 * customer who signs in before they buy, because the purchase event then
 * carries their Supabase id.
 *
 * It does not cover the other order. Mise deliberately lets someone subscribe
 * while signed out (app/paywall.tsx offers to sign in *after* a purchase), and
 * for that person:
 *
 *   1. INITIAL_PURCHASE arrives carrying only `$RCAnonymousID:…`, because no
 *      account exists yet. The webhook correctly refuses to guess and drops it.
 *   2. They sign in. `Purchases.logIn` aliases their Supabase id onto the
 *      RevenueCat customer — but **aliasing emits no webhook event**.
 *
 * So nothing ever writes their row. They are Pro on the device, where
 * entitlement is read from the RevenueCat SDK, and not Pro on the web, where
 * `entitlements` is the only source (lib/entitlementMirror.ts). They stay that
 * way until their next renewal — up to a month, or up to a year on the annual
 * plan.
 *
 * This function closes that gap by asking RevenueCat directly, at sign-in,
 * rather than waiting for RevenueCat to volunteer it.
 */

/** The entitlement that means "Pro". Must match PRO_ENTITLEMENT in the webhook. */
export const PRO_ENTITLEMENT = 'Mise Film Director Suite Pro';

/** The subset of a RevenueCat `/v1/subscribers` response this function reads. */
export interface RevenueCatSubscriber {
  entitlements?: Record<
    string,
    { expires_date?: string | null; purchase_date?: string | null } | null
  > | null;
}

export interface SubscriberEntitlement {
  isPro: boolean;
  expiresAt: string | null;
  /** When the entitlement was bought, used as the staleness cursor. */
  purchasedAt: string | null;
  reason: string;
}

/**
 * Whether this subscriber holds Pro right now, and until when.
 *
 * `/v1/subscribers` returns every entitlement the customer has *ever* had, not
 * only the live ones, so presence alone means nothing — an expired subscription
 * is still listed, with `expires_date` in the past. The date is the whole
 * answer, and reading it wrongly grants Pro to someone who cancelled a year
 * ago.
 *
 * A null `expires_date` means a lifetime grant rather than "unknown": that is
 * what RevenueCat returns for non-expiring entitlements. Mise does not sell one
 * today, but treating it as active is both what RevenueCat means by it and the
 * forgiving direction if that ever changes.
 *
 * `nowMs` is a parameter rather than a `Date.now()` call so the boundary can be
 * tested at a fixed point in time.
 */
export function entitlementFromSubscriber(
  subscriber: RevenueCatSubscriber | null | undefined,
  nowMs: number
): SubscriberEntitlement {
  const none = (reason: string): SubscriberEntitlement => ({
    isPro: false,
    expiresAt: null,
    purchasedAt: null,
    reason,
  });

  if (!subscriber || typeof subscriber !== 'object') {
    return none('no subscriber in the RevenueCat response');
  }

  const entry = subscriber.entitlements?.[PRO_ENTITLEMENT];
  if (!entry) return none(`no ${PRO_ENTITLEMENT} entitlement on this customer`);

  const purchasedAt = normaliseDate(entry.purchase_date);
  const expiresRaw = entry.expires_date;

  // A lifetime grant. RevenueCat states this as an explicit null.
  if (expiresRaw == null) {
    return { isPro: true, expiresAt: null, purchasedAt, reason: 'entitlement does not expire' };
  }

  const expiresAt = normaliseDate(expiresRaw);
  if (!expiresAt) {
    /*
     * A present-but-unparseable date. Refusing is right here, unlike in the
     * webhook: this path only ever *adds* a row that RevenueCat's own events
     * would otherwise write later, so declining costs a delay, while granting
     * on a date we could not read costs a free subscription.
     */
    return none(`expires_date could not be parsed: ${String(expiresRaw)}`);
  }

  const active = Date.parse(expiresAt) > nowMs;
  return {
    isPro: active,
    expiresAt,
    purchasedAt,
    reason: active ? 'entitlement is active' : 'entitlement expired',
  };
}

/** ISO-normalise a RevenueCat date, or null if it is absent or unreadable. */
function normaliseDate(value: string | null | undefined): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/**
 * Whether the backfill should write, given what is already stored.
 *
 * **The webhook owns this row.** It sees the whole subscription lifecycle;
 * this function sees one moment, at sign-in. So the backfill fills a hole and
 * never overwrites: if a row exists, the webhook has spoken about this account
 * and its answer is the more informed one.
 *
 * That also keeps the two from fighting over `last_event_at`, which the webhook
 * uses to reject out-of-order deliveries. A backfill that stamped that cursor
 * with the current time would make every genuine event that followed look stale
 * and be skipped — silently turning a fix into a subtler version of the same
 * bug.
 */
export function shouldWrite(existingRow: unknown, entitlement: SubscriberEntitlement): boolean {
  if (existingRow) return false;
  return entitlement.isPro;
}
