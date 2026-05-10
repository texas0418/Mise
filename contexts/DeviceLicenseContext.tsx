// ----------------------------------------------------------------------------
// contexts/DeviceLicenseContext.tsx — Device-based license gating
//
// Combines RevenueCat (payment) with Supabase devices table (license tracking).
//
// Four purchase flows:
//   purchaseBaseAndActivate()                    → $4.99/mo, for first device
//   purchaseBaseAnnualAndActivate()              → $49.99/yr, for first device
//   purchaseAdditionalAndActivate()              → $2.99/mo, for extra devices
//   purchaseAdditionalAnnualAndActivate()        → $29.99/yr, for extra devices
//
// Each function:
//   1. Triggers the RevenueCat purchase (App Store transaction)
//   2. If signed in with a registered device, marks the device as licensed in Supabase
//   3. If anonymous (not signed in), the entitlement lives only on the Apple ID via RC.
//      When the user later signs in, the existing legacy-RC bridge below auto-activates
//      the device row that gets created on first sign-in.
//   4. Updates all local state atomically
//
// Legacy RevenueCat subscribers are auto-grandfathered on first load.
// The same mechanism handles "bought anonymously, then signed in" with no extra code.
// ----------------------------------------------------------------------------

import { useEffect, useState, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import createContextHook from '@nkzw/create-context-hook';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import {
  registerDevice,
  checkDeviceLicense,
  listUserDevices,
  activateDevice,
  deactivateDevice,
  removeDevice,
  getLicensedDeviceCount,
  getCurrentDeviceUuid,
  calculateMonthlyPrice,
  PRICING,
  type DeviceRecord,
} from '@/lib/deviceManager';

// ----------------------------------------------------------------------------
// Result type returned by purchase functions
// ----------------------------------------------------------------------------
export interface PurchaseResult {
  success: boolean;
  error?: string;
  // True when the purchase succeeded but the device could not be linked to a
  // user account (because no one is signed in). The caller should prompt the
  // user to sign in so the device can be registered and added to their license.
  needsSignIn?: boolean;
}

export const [DeviceLicenseProvider, useDeviceLicense] = createContextHook(() => {
  const { user, isAuthenticated } = useAuth();
  const {
    isPro: isRevenueCatPro,
    purchaseBase,
    purchaseBaseAnnual,
    purchaseAdditionalDevice,
    purchaseAdditionalDeviceAnnual,
    restorePurchases: rcRestorePurchases,
  } = useSubscription();

  const [isDeviceLicensed, setIsDeviceLicensed]     = useState(false);
  const [currentDevice, setCurrentDevice]           = useState<DeviceRecord | null>(null);
  const [devices, setDevices]                       = useState<DeviceRecord[]>([]);
  const [currentDeviceUuid, setCurrentDeviceUuid]   = useState<string | null>(null);
  const [licensedCount, setLicensedCount]           = useState(0);
  const [isLoading, setIsLoading]                   = useState(true);
  const [isPurchasing, setIsPurchasing]             = useState(false);
  const [isLegacySubscriber, setIsLegacySubscriber] = useState(false);
  const [purchaseError, setPurchaseError]           = useState<string | null>(null);

  const userId = user?.id ?? null;

  // ----------------------------------------------------------------------------
  // Initialize on auth
  //
  // Note: when there is no signed-in user we still want a device UUID locally
  // so future calls can reference "this device," but we do NOT create a Supabase
  // row. The devices table requires user_id NOT NULL, so the row is created
  // lazily on first sign-in.
  // ----------------------------------------------------------------------------
  useEffect(() => {
    if (isAuthenticated && userId) {
      initialize(userId);
    } else {
      // Anonymous mode: clear server-backed state, keep local device UUID.
      setIsDeviceLicensed(false);
      setCurrentDevice(null);
      setDevices([]);
      setLicensedCount(0);
      setIsLoading(false);
      // Cache the UUID even when logged out so it's ready when they sign in.
      getCurrentDeviceUuid().then(setCurrentDeviceUuid).catch(() => {});
    }
  }, [isAuthenticated, userId]);

  // ----------------------------------------------------------------------------
  // Re-check on foreground
  // ----------------------------------------------------------------------------
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active' && userId) refreshLicenseStatus(userId);
    });
    return () => sub.remove();
  }, [userId]);

  // ----------------------------------------------------------------------------
  // RevenueCat legacy bridge
  //
  // Auto-activate this device when:
  //   - RC says the Apple ID has an active entitlement
  //   - The device row exists in Supabase (i.e. user is signed in)
  //   - The device row is not yet marked licensed
  //
  // This handles two cases with one mechanism:
  //   1. Grandfathered RC subscribers on the old subscription model
  //   2. New users who bought anonymously, then signed in
  // ----------------------------------------------------------------------------
  useEffect(() => {
    if (isRevenueCatPro && userId && currentDevice && !currentDevice.isLicensed) {
      console.log('[DeviceLicense] RC entitlement detected — auto-activating device');
      setIsLegacySubscriber(true);
      activateCurrentDevice();
    }
  }, [isRevenueCatPro, userId, currentDevice]);

  // ----------------------------------------------------------------------------
  // Core initialization
  // ----------------------------------------------------------------------------
  const initialize = useCallback(async (uid: string) => {
    setIsLoading(true);
    try {
      const [device, uuid, licensed, allDevices, count] = await Promise.all([
        registerDevice(uid),
        getCurrentDeviceUuid(),
        checkDeviceLicense(uid),
        listUserDevices(uid),
        getLicensedDeviceCount(uid),
      ]);

      setCurrentDevice(device);
      setCurrentDeviceUuid(uuid);
      setIsDeviceLicensed(licensed);
      setDevices(allDevices);
      setLicensedCount(count);
    } catch (e: any) {
      console.warn('[DeviceLicense] Init error:', e.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ----------------------------------------------------------------------------
  // Lightweight refresh (no re-registration)
  // ----------------------------------------------------------------------------
  const refreshLicenseStatus = useCallback(async (uid: string) => {
    try {
      const [licensed, count] = await Promise.all([
        checkDeviceLicense(uid),
        getLicensedDeviceCount(uid),
      ]);
      setIsDeviceLicensed(licensed);
      setLicensedCount(count);
    } catch (e: any) {
      console.warn('[DeviceLicense] Refresh error:', e.message);
    }
  }, []);

  // ----------------------------------------------------------------------------
  // Internal: activate current device in Supabase and update all state
  // ----------------------------------------------------------------------------
  const activateCurrentDevice = useCallback(async (): Promise<boolean> => {
    if (!currentDevice) return false;

    const success = await activateDevice(currentDevice.id);
    if (success) {
      setIsDeviceLicensed(true);
      setCurrentDevice(prev => prev ? { ...prev, isLicensed: true } : null);
      setLicensedCount(prev => prev + 1);
      if (userId) {
        const allDevices = await listUserDevices(userId);
        setDevices(allDevices);
      }
    }
    return success;
  }, [currentDevice, userId]);

  // ----------------------------------------------------------------------------
  // Internal: shared purchase wrapper (RC purchase + optional Supabase activation)
  //
  // Purchase ALWAYS proceeds, regardless of auth state. RevenueCat captures the
  // entitlement on the Apple ID. If the user is signed in with a registered
  // device, we also flip is_licensed in Supabase. If not, the entitlement lives
  // only on the Apple ID via RC, and isPro stays true via the OR with
  // isRevenueCatPro. The caller is told via needsSignIn=true so they can prompt.
  // ----------------------------------------------------------------------------
  const purchaseAndActivate = useCallback(async (
    rcPurchaseFn: () => Promise<boolean>,
    label: string
  ): Promise<PurchaseResult> => {
    setIsPurchasing(true);
    setPurchaseError(null);

    try {
      // Step 1: RevenueCat purchase (App Store transaction). No auth required.
      const rcSuccess = await rcPurchaseFn();
      if (!rcSuccess) {
        // User cancelled, package missing, or RC error — RC has already set its
        // own error state. Don't surface a Mise-side error for cancellations.
        setIsPurchasing(false);
        return { success: false };
      }

      // Step 2: If signed in with a registered device, link the entitlement to
      // the device row in Supabase. If not, the purchase is still successful.
      if (userId && currentDevice) {
        const activated = await activateCurrentDevice();
        if (!activated) {
          // RC purchase went through, but Supabase write failed. Pro is still
          // active on this device via the RC entitlement, so don't treat this
          // as a hard failure — log it and let the legacy-RC bridge retry on
          // next foreground.
          console.warn(`[DeviceLicense] ${label} purchase OK but device activation failed — will retry on foreground`);
        }
        setIsPurchasing(false);
        return { success: true };
      }

      // Anonymous purchase path: success, but the user should sign in so
      // multi-device, sync, and crew invites work.
      console.log(`[DeviceLicense] ${label} purchase complete (anonymous) — sign-in required for device linking`);
      setIsPurchasing(false);
      return { success: true, needsSignIn: true };
    } catch (e: any) {
      const err = e?.message || 'Purchase failed';
      setPurchaseError(err);
      setIsPurchasing(false);
      return { success: false, error: err };
    }
  }, [userId, currentDevice, activateCurrentDevice]);

  // ----------------------------------------------------------------------------
  // PUBLIC: Purchase base subscription + activate this device
  //
  // Call these when licensedCount === 0 (first device)
  // ----------------------------------------------------------------------------
  const purchaseBaseAndActivate = useCallback(
    () => purchaseAndActivate(purchaseBase, 'Base'),
    [purchaseAndActivate, purchaseBase]
  );

  const purchaseBaseAnnualAndActivate = useCallback(
    () => purchaseAndActivate(purchaseBaseAnnual, 'Base Annual'),
    [purchaseAndActivate, purchaseBaseAnnual]
  );

  // ----------------------------------------------------------------------------
  // PUBLIC: Purchase additional device subscription + activate this device
  //
  // Call these when licensedCount >= 1 (extra device)
  // ----------------------------------------------------------------------------
  const purchaseAdditionalAndActivate = useCallback(
    () => purchaseAndActivate(purchaseAdditionalDevice, 'Additional device'),
    [purchaseAndActivate, purchaseAdditionalDevice]
  );

  const purchaseAdditionalAnnualAndActivate = useCallback(
    () => purchaseAndActivate(purchaseAdditionalDeviceAnnual, 'Additional device annual'),
    [purchaseAndActivate, purchaseAdditionalDeviceAnnual]
  );

  // ----------------------------------------------------------------------------
  // PUBLIC: Restore purchases + activate if entitled
  //
  // Restore is allowed regardless of auth state. RC will surface the entitlement
  // tied to the Apple ID. If the user is signed in, we also flip the Supabase
  // device row.
  // ----------------------------------------------------------------------------
  const restoreAndActivate = useCallback(async (): Promise<PurchaseResult> => {
    setIsPurchasing(true);
    setPurchaseError(null);

    try {
      const restored = await rcRestorePurchases();
      if (!restored) {
        setIsPurchasing(false);
        return { success: false, error: 'No active subscription found' };
      }

      // Subscription found — if signed in with a registered device, activate it.
      if (userId && currentDevice) {
        const activated = await activateCurrentDevice();
        setIsPurchasing(false);
        return activated
          ? { success: true }
          : { success: true }; // RC entitlement is enough; legacy bridge will retry
      }

      // Anonymous restore: Pro is active on this device via the RC entitlement.
      setIsPurchasing(false);
      return { success: true, needsSignIn: true };
    } catch (e: any) {
      const err = e?.message || 'Restore failed';
      setPurchaseError(err);
      setIsPurchasing(false);
      return { success: false, error: err };
    }
  }, [userId, currentDevice, rcRestorePurchases, activateCurrentDevice]);

  // ----------------------------------------------------------------------------
  // Deactivate a device (remove Pro access, keep device registered)
  // ----------------------------------------------------------------------------
  const deactivateDeviceById = useCallback(async (deviceId: string): Promise<boolean> => {
    const success = await deactivateDevice(deviceId);
    if (success && userId) {
      if (currentDevice?.id === deviceId) {
        setIsDeviceLicensed(false);
        setCurrentDevice(prev => prev ? { ...prev, isLicensed: false } : null);
      }
      setLicensedCount(prev => Math.max(0, prev - 1));
      const allDevices = await listUserDevices(userId);
      setDevices(allDevices);
    }
    return success;
  }, [currentDevice, userId]);

  // ----------------------------------------------------------------------------
  // Remove a device entirely (soft delete)
  // ----------------------------------------------------------------------------
  const removeDeviceById = useCallback(async (deviceId: string): Promise<boolean> => {
    const device = devices.find(d => d.id === deviceId);
    const success = await removeDevice(deviceId);
    if (success && userId) {
      if (device?.isLicensed) setLicensedCount(prev => Math.max(0, prev - 1));
      if (currentDevice?.id === deviceId) {
        setIsDeviceLicensed(false);
        setCurrentDevice(null);
      }
      const allDevices = await listUserDevices(userId);
      setDevices(allDevices);
    }
    return success;
  }, [devices, currentDevice, userId]);

  // ----------------------------------------------------------------------------
  // Refresh device list
  // ----------------------------------------------------------------------------
  const refreshDevices = useCallback(async () => {
    if (!userId) return;
    const [allDevices, count] = await Promise.all([
      listUserDevices(userId),
      getLicensedDeviceCount(userId),
    ]);
    setDevices(allDevices);
    setLicensedCount(count);
  }, [userId]);

  // ----------------------------------------------------------------------------
  // Derived values
  // ----------------------------------------------------------------------------

  // isPro = device licensed in Supabase OR active RC entitlement (legacy + anon)
  const isPro = isDeviceLicensed || isRevenueCatPro;

  // Which purchase function to call — smart picker for the paywall
  const isFirstDevice = licensedCount === 0;

  // Monthly total across all licensed devices
  const monthlyPrice = calculateMonthlyPrice(licensedCount);

  // Price for the NEXT device (what the paywall should show)
  const nextDevicePrice = isFirstDevice
    ? PRICING.baseMonthly
    : PRICING.additionalDeviceMonthly;

  // ----------------------------------------------------------------------------
  // Return
  // ----------------------------------------------------------------------------
  return {
    // State
    isPro,
    isDeviceLicensed,
    isLegacySubscriber,
    isFirstDevice,
    currentDevice,
    currentDeviceUuid,
    devices,
    licensedCount,
    monthlyPrice,
    nextDevicePrice,
    isLoading,
    isPurchasing,
    purchaseError,
    pricing: PRICING,

    // Purchase actions (RC + Supabase in one call)
    purchaseBaseAndActivate,
    purchaseBaseAnnualAndActivate,
    purchaseAdditionalAndActivate,
    purchaseAdditionalAnnualAndActivate,
    restoreAndActivate,

    // Device management
    activateCurrentDevice,
    deactivateDeviceById,
    removeDeviceById,
    refreshDevices,
    refreshLicenseStatus: () =>
      userId ? refreshLicenseStatus(userId) : Promise.resolve(),
  };
});
