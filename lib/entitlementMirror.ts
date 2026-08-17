/**
 * lib/entitlementMirror.ts
 *
 * Reads the entitlement row the browser build gates on.
 *
 * `react-native-purchases` has no web SDK, so in a browser both the device
 * path and the RevenueCat path resolve to "not Pro". This row is the web
 * build's only way to know what someone has paid for (#111).
 *
 * It used to be written from here too, by the app, under owner RLS — which
 * made the record of who had paid a claim the user made about themselves.
 * That write is gone: `entitlements` is now written only by the
 * `revenuecat-webhook` edge function with the service role, and the client's
 * INSERT/UPDATE policies have been revoked. This file reads. Nothing more.
 */
import { supabase } from '@/lib/supabase';

/**
 * Read the mirrored entitlement back — the web build's only way to know.
 *
 * `react-native-purchases` has no web SDK, so in a browser the device path and
 * the RevenueCat path both resolve to "not Pro". Without this, every desktop
 * user is silently free regardless of what they pay for on their iPad.
 *
 * **A missing row means not-Pro, not an error.** Rows appear only when
 * RevenueCat sends an event the webhook can attribute, which needs a build
 * carrying `Purchases.logIn` on that person's device. Treating an absent row
 * as a failure would put an error in front of someone whose only mistake is
 * not having updated their phone yet; treating it as not-Pro degrades to
 * exactly the behaviour that shipped before this existed.
 */
export async function readMirroredEntitlement(
  userId: string | null | undefined
): Promise<boolean> {
  if (!userId) return false;
  try {
    const { data, error } = await supabase
      .from('entitlements')
      .select('is_pro')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      console.warn('[entitlementMirror] read failed:', error.message);
      return false;
    }
    return data?.is_pro === true;
  } catch (e) {
    console.warn('[entitlementMirror] read threw:', e);
    return false;
  }
}

/**
 * Whether this account may use Mise in a browser.
 *
 * Simon's rule (2026-08-12): the web build is included with a subscription,
 * and requires one — "usable only if the user has paid a subscription for at
 * least one device".
 *
 * Two sources, because each covers what the other cannot:
 *
 * - **`devices.is_licensed`** is the live record of paid devices and has rows
 *   right now, so an existing subscriber is recognised the moment they sign in
 *   on a laptop. This is the one that makes the rule work on day one.
 * - **`entitlements.is_pro`** is written only by the `revenuecat-webhook` edge
 *   function. It is empty until a build carrying `Purchases.logIn` has run on
 *   someone's device and RevenueCat has sent an event for them, so on its own
 *   it would today admit nobody at all.
 *
 * Either one is enough. Both are read under owner-only RLS, so a signed-out
 * visitor gets nothing.
 *
 * ## Both sources are now server-written
 *
 * This used to be a soft gate: owner RLS let a user write their own rows in
 * both tables, so anyone with their own access token — which every signed-in
 * user has, in plain text, on their own machine — could set either flag and
 * let themselves in.
 *
 * Neither is client-writable any more.
 *
 * - `entitlements` lost its client INSERT/UPDATE policies; only the webhook
 *   writes it, with the service role.
 * - `devices.is_licensed` (and `license_tier`) are pinned by the
 *   `devices_lock_license` trigger. Clients still register devices and rename
 *   them; the licensing columns simply do not move for them. A plain column
 *   REVOKE was rejected for this — the app inserts `is_licensed: false`
 *   explicitly on every launch, and a revoke forbids naming the column at all,
 *   which would have broken registration for every live user.
 *
 * The consequence worth knowing: nothing client-side can grant a licence any
 * more, including the purchase flow. `activateDevice` still returns success
 * and the flag no longer moves. Until server-side activation exists, a new
 * subscriber gets Pro on their phone through RevenueCat and reaches the web
 * build once the webhook has written their entitlement row.
 */
export async function readDesktopEntitlement(
  userId: string | null | undefined
): Promise<boolean> {
  if (!userId) return false;
  try {
    const { count, error: devError } = await supabase
      .from('devices')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_licensed', true)
      .is('deleted_at', null);
    if (!devError && (count ?? 0) > 0) return true;
    if (devError) console.warn('[entitlement] device read failed:', devError.message);
  } catch (e) {
    console.warn('[entitlement] device read threw:', e);
  }
  return readMirroredEntitlement(userId);
}
