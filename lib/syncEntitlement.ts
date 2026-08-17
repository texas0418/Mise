/**
 * lib/syncEntitlement.ts
 *
 * Asks the server to fill in this account's entitlement row after sign-in.
 *
 * `entitlements` is what the web build gates on (lib/entitlementMirror.ts) and
 * it is written only by the `revenuecat-webhook` function, from RevenueCat
 * events. That misses one order of operations, which Mise explicitly supports:
 * subscribing while signed out, then signing in afterwards. The purchase event
 * arrived carrying an anonymous id and was dropped, and the sign-in that
 * followed emits no event of its own — so no row is ever written, and the
 * customer is Pro on their phone and free on their laptop until the next
 * renewal.
 *
 * The `sync-entitlement` function closes that by asking RevenueCat directly.
 * This calls it; it does not decide anything. The entitlement is still read
 * from RevenueCat and still written with the service role, because a client
 * asserting its own entitlement is the thing #112 removed.
 */
import { supabase } from '@/lib/supabase';

/**
 * Fire the backfill for the signed-in user.
 *
 * **Failure is silent and that is deliberate.** Nothing the user can see
 * depends on this call: on-device entitlement comes from the RevenueCat SDK,
 * and the row this writes is read by the *web* build, later, on another
 * machine. Surfacing an error here would put a warning in front of someone
 * about a problem they cannot act on and are not currently having. The
 * function is also idempotent, so the next sign-in retries it for free.
 */
export async function syncEntitlement(): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('sync-entitlement', {
      method: 'POST',
    });
    if (error) console.log('[syncEntitlement] skipped:', error.message);
  } catch (e: any) {
    console.log('[syncEntitlement] skipped:', e?.message || e);
  }
}
