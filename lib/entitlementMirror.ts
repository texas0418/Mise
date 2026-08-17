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
 * Whether this account may use Mise on a desktop.
 *
 * Simon's rule (2026-08-12): the desktop build is included with a
 * subscription, and requires one — "usable only if the user has paid a
 * subscription for at least one device".
 *
 * Two sources, because one of them is empty today:
 *
 * - **`devices.is_licensed`** is the live record of paid devices and has rows
 *   right now, so an existing subscriber is recognised the moment they sign in
 *   on a laptop. This is the one that makes the rule work on day one.
 * - **`entitlements.is_pro`** is the mirror from #112. It only gains rows once
 *   a build carrying the mirror has run on a device, and that build is on
 *   `dev`, not in the shipped 1.1.0 — so on its own it would lock out every
 *   paying customer until they updated their phone and opened it once.
 *
 * Either one is enough. Both are read under owner-only RLS, so a signed-out
 * visitor gets nothing.
 *
 * ## This is a soft gate, and should not be mistaken for a hard one
 *
 * RLS lets a user write **their own** rows in both tables — `devices` is a
 * blanket owner policy and `entitlements` has an owner INSERT/UPDATE check.
 * So a determined person with their own access token can set either flag and
 * let themselves in. That stops casual sharing, not deliberate bypass.
 *
 * Making it authoritative means the client never writing entitlement at all:
 * a RevenueCat webhook into an edge function that writes with the service
 * role, and client INSERT/UPDATE revoked. That also backfills every existing
 * subscriber, since RevenueCat already knows who they are. Worth doing before
 * the desktop build is public rather than after.
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
