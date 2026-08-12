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
