/**
 * lib/entitlement.ts
 *
 * Whether this device is entitled to paid features, readable outside React.
 *
 * `useDeviceLicense()` is the source of truth, but `DeviceLicenseProvider`
 * mounts *inside* `SyncProvider`, so the sync layer cannot reach it by hook.
 * Reordering the providers to fix that would move the license below the auth
 * and sync contexts it depends on, so the entitlement is published here
 * instead: the license context writes, the sync layer reads.
 *
 * Deliberately fail-closed. It starts false and only becomes true once the
 * license has actually resolved, so a paid feature is briefly unavailable at
 * launch rather than briefly free — the failure that costs money is the other
 * one (#43: sync ran for every signed-in user, paid or not).
 */

let proEntitled = false;

/** Called by DeviceLicenseContext whenever the resolved entitlement changes. */
export function setProEntitled(value: boolean): void {
  proEntitled = value;
}

/** True once the device is known to hold a licence or an active subscription. */
export function isProEntitled(): boolean {
  return proEntitled;
}
