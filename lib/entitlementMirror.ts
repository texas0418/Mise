/**
 * lib/entitlementMirror.ts
 *
 * Mirrors the device's resolved entitlement into Supabase (`entitlements`,
 * one row per user, RLS owner-only) so the web/desktop build can gate paid
 * features without a purchases SDK — react-native-purchases has no web
 * support, so the browser reads this row instead (#111).
 *
 * Fire-and-forget by design: a failed mirror must never affect the app's own
 * entitlement (the device remains the source of truth for itself), so errors
 * are logged and swallowed. Identical states are not re-written.
 */
import { supabase } from '@/lib/supabase';

let lastWritten: string | null = null;

export function mirrorEntitlement(
  userId: string | null | undefined,
  isPro: boolean,
  source: 'device_license' | 'subscription' | null
): void {
  if (!userId) return;
  const key = `${userId}:${isPro}:${source ?? ''}`;
  if (key === lastWritten) return;
  lastWritten = key;

  supabase
    .from('entitlements')
    .upsert(
      {
        user_id: userId,
        is_pro: isPro,
        source,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )
    .then(({ error }) => {
      if (error) {
        // Roll back the dedupe so the next state change retries the write.
        lastWritten = null;
        console.warn('[entitlementMirror] upsert failed:', error.message);
      }
    });
}
