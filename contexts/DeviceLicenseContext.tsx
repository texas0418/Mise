// ---------------------------------------------------------------------------
// contexts/DeviceLicenseContext.tsx — Device-based license gating
//
// Combines RevenueCat (payment) with Supabase devices table (license tracking).
//
// Two purchase flows:
//   purchaseBaseAndActivate()       — $4.99/mo, for first device
//   purchaseAdditionalAndActivate() — $2.99/mo, for extra devices
//
// Both functions:
//   1. Trigger the RevenueCat purchase (App Store transaction)
//   2. On success, mark this device as licensed in Supabase
//   3. Update all local state atomically
//
// Legacy RevenueCat subscribers are auto-grandfathered on first load.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Result type returned by purchase functions
// ---------------------------------------------------------------------------
export interface PurchaseResult {
  success: boolean;
  error?: string;
}

export const [DeviceLicenseProvider, useDeviceLicense] = createContextHook(() => {
  const { user, isAuthenticated } = useAuth();
  const {
    isPro: isRevenueCatPro,
    purchaseBase,
    purchaseAdditionalDevice,
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

  // -------------------------------------------------------------------------
  // Initialize on auth
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (isAuthenticated && userId) {
      initialize(userId);
    } else {
      setIsDeviceLicensed(false);
      setCurrentDevice(null);
      setDevices([]);
      setLicensedCount(0);
      setIsLoading(false);
    }
  }, [isAuthenticated, userId]);

  // -------------------------------------------------------------------------
  // Re-check on foreground
  // -------------------------------------------------------------------------
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active' && userId) refreshLicenseStatus(userId);
    });
    return () => sub.remove();
  }, [userId]);

  // -------------------------------------------------------------------------
  // RevenueCat legacy bridge
  // Auto-activate device for grandfathered RC subscribers
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (isRevenueCatPro && userId && currentDevice && !currentDevice.isLicensed) {
      console.log('[DeviceLicense] Legacy RC subscriber — auto-activating device');
      setIsLegacySubscriber(true);
      activateCurrentDevice();
    }
  }, [isRevenueCatPro, userId, currentDevice]);

  // -------------------------------------------------------------------------
  // Core initialization
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // Lightweight refresh (no re-registration)
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // Internal: activate current device in Supabase and update all state
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // PUBLIC: Purchase base subscription + activate this device
  //
  // Call this when licensedCount === 0 (first device, $4.99/mo)
  // Returns { success, error }
  // -------------------------------------------------------------------------
  const purchaseBaseAndActivate = useCallback(async (): Promise<PurchaseResult> => {
    if (!userId || !currentDevice) {
      return { success: false, error: 'Not signed in or device not registered' };
    }

    setIsPurchasing(true);
    setPurchaseError(null);

    try {
      // Step 1: RevenueCat purchase (App Store transaction)
      const rcSuccess = await purchaseBase();
      if (!rcSuccess) {
        // purchaseBase() sets its own error in SubscriptionContext
        // User may have cancelled — don't show an error for that
        setIsPurchasing(false);
        return { success: false };
      }

      // Step 2: Mark device as licensed in Supabase
      const activated = await activateCurrentDevice();
      if (!activated) {
        const err = 'Payment successful but device activation failed. Please contact support.';
        setPurchaseError(err);
        setIsPurchasing(false);
        return { success: false, error: err };
      }

      console.log('[DeviceLicense] Base purchase + activation complete');
      setIsPurchasing(false);
      return { success: true };
    } catch (e: any) {
      const err = e?.message || 'Purchase failed';
      setPurchaseError(err);
      setIsPurchasing(false);
      return { success: false, error: err };
    }
  }, [userId, currentDevice, purchaseBase, activateCurrentDevice]);

  // -------------------------------------------------------------------------
  // PUBLIC: Purchase additional device subscription + activate this device
  //
  // Call this when licensedCount >= 1 (extra device, $2.99/mo)
  // Returns { success, error }
  // -------------------------------------------------------------------------
  const purchaseAdditionalAndActivate = useCallback(async (): Promise<PurchaseResult> => {
    if (!userId || !currentDevice) {
      return { success: false, error: 'Not signed in or device not registered' };
    }

    setIsPurchasing(true);
    setPurchaseError(null);

    try {
      // Step 1: RevenueCat purchase
      const rcSuccess = await purchaseAdditionalDevice();
      if (!rcSuccess) {
        setIsPurchasing(false);
        return { success: false };
      }

      // Step 2: Activate in Supabase
      const activated = await activateCurrentDevice();
      if (!activated) {
        const err = 'Payment successful but device activation failed. Please contact support.';
        setPurchaseError(err);
        setIsPurchasing(false);
        return { success: false, error: err };
      }

      console.log('[DeviceLicense] Additional device purchase + activation complete');
      setIsPurchasing(false);
      return { success: true };
    } catch (e: any) {
      const err = e?.message || 'Purchase failed';
      setPurchaseError(err);
      setIsPurchasing(false);
      return { success: false, error: err };
    }
  }, [userId, currentDevice, purchaseAdditionalDevice, activateCurrentDevice]);

  // -------------------------------------------------------------------------
  // PUBLIC: Restore purchases + activate if entitled
  // -------------------------------------------------------------------------
  const restoreAndActivate = useCallback(async (): Promise<PurchaseResult> => {
    if (!userId || !currentDevice) {
      return { success: false, error: 'Not signed in or device not registered' };
    }

    setIsPurchasing(true);
    setPurchaseError(null);

    try {
      const restored = await rcRestorePurchases();
      if (!restored) {
        setIsPurchasing(false);
        return { success: false, error: 'No active subscription found' };
      }

      // Subscription found — activate this device
      const activated = await activateCurrentDevice();
      setIsPurchasing(false);
      return activated
        ? { success: true }
        : { success: false, error: 'Subscription restored but device activation failed' };
    } catch (e: any) {
      const err = e?.message || 'Restore failed';
      setPurchaseError(err);
      setIsPurchasing(false);
      return { success: false, error: err };
    }
  }, [userId, currentDevice, rcRestorePurchases, activateCurrentDevice]);

  // -------------------------------------------------------------------------
  // Deactivate a device (remove Pro access, keep device registered)
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // Remove a device entirely (soft delete)
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // Refresh device list
  // -------------------------------------------------------------------------
  const refreshDevices = useCallback(async () => {
    if (!userId) return;
    const [allDevices, count] = await Promise.all([
      listUserDevices(userId),
      getLicensedDeviceCount(userId),
    ]);
    setDevices(allDevices);
    setLicensedCount(count);
  }, [userId]);

  // -------------------------------------------------------------------------
  // Derived values
  // -------------------------------------------------------------------------

  // isPro = device licensed in Supabase OR active RC entitlement (legacy)
  const isPro = isDeviceLicensed || isRevenueCatPro;

  // Which purchase function to call — smart picker for the paywall
  const isFirstDevice = licensedCount === 0;

  // Monthly total across all licensed devices
  const monthlyPrice = calculateMonthlyPrice(licensedCount);

  // Price for the NEXT device (what the paywall should show)
  const nextDevicePrice = isFirstDevice
    ? PRICING.baseMonthly
    : PRICING.additionalDeviceMonthly;

  // -------------------------------------------------------------------------
  // Return
  // -------------------------------------------------------------------------
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
    purchaseAdditionalAndActivate,
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
