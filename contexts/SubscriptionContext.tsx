/**
 * contexts/SubscriptionContext.tsx
 *
 * RevenueCat Subscription Provider — v2 Device Licensing Model
 *
 * Products:
 *   com.mise.film_director_suite.pro_monthly         → $4.99/mo (base, 1st device)
 *   com.mise.film_director_suite.pro_additional_device → $2.99/mo (each extra device)
 *
 * Entitlement: "Mise Film Director Suite Pro"
 *
 * Flow:
 *   - purchaseBase()           → buys the $4.99 monthly, grants entitlement
 *   - purchaseAdditionalDevice() → buys the $2.99 add-on for extra devices
 *   - restorePurchases()       → restores any active RC subscription
 *   - After any successful purchase, DeviceLicenseContext calls activateCurrentDevice()
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import { Platform, AppState, AppStateStatus } from 'react-native';

// RevenueCat — dynamic import so app doesn't crash if SDK isn't installed
let Purchases: any = null;
let LOG_LEVEL: any = null;
try {
  const rc = require('react-native-purchases');
  Purchases = rc.default || rc.Purchases;
  LOG_LEVEL = rc.LOG_LEVEL;
} catch (e) {
  console.log('[Subscription] RevenueCat SDK not installed — running in free mode');
}

// ─── Constants ────────────────────────────────────────────────────────────────

const REVENUECAT_IOS_KEY = 'appl_hDSIJdgEdYkPSIavpEfPgjEImCA';
const REVENUECAT_ANDROID_KEY = '';

const ENTITLEMENT_ID = 'Mise Film Director Suite Pro';

// Product identifiers — must match App Store Connect exactly
export const PRODUCT_IDS = {
  /** Base subscription — $4.99/month, required for first device */
  base: 'com.mise.film_director_suite.pro_monthly',
  /** Add-on subscription — $2.99/month per additional device */
  additionalDevice: 'com.mise.film_director_suite.pro_additional_device',
} as const;

// RevenueCat package identifiers set in the Offerings dashboard
// '$rc_monthly' is RevenueCat's built-in identifier for MONTHLY packages
export const PACKAGE_IDS = {
  base: '$rc_monthly',
  additionalDevice: 'mise_additional_device',
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

interface SubscriptionState {
  isInitialized: boolean;
  isPro: boolean;
  isLoading: boolean;
  /** All available packages from the current RC Offering */
  packages: any[];
  /** The base $4.99 package, if available */
  basePackage: any | null;
  /** The additional device $2.99 package, if available */
  additionalDevicePackage: any | null;
  error: string | null;
}

interface SubscriptionContextValue extends SubscriptionState {
  /** Purchase the base Pro subscription ($4.99/mo, first device) */
  purchaseBase: () => Promise<boolean>;
  /** Purchase an additional device slot ($2.99/mo) */
  purchaseAdditionalDevice: () => Promise<boolean>;
  /** Restore any previous purchases from the App Store */
  restorePurchases: () => Promise<boolean>;
  /** Refresh subscription status (call after device activation) */
  refreshStatus: () => Promise<void>;
  /** @deprecated Use purchaseBase() instead */
  purchasePro: () => Promise<boolean>;
}

export type ProFeature =
  | 'spreadsheet_import'
  | 'ai_import'
  | 'unlimited_projects'
  | 'csv_templates'
  | 'import_history'
  | 'multi_device_sync';

const PRO_FEATURES: Set<ProFeature> = new Set([
  'spreadsheet_import',
  'ai_import',
  'unlimited_projects',
  'csv_templates',
  'import_history',
  'multi_device_sync',
]);

export const FREE_PROJECT_LIMIT = 2;

// ─── Context ──────────────────────────────────────────────────────────────────

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SubscriptionState>({
    isInitialized: false,
    isPro: false,
    isLoading: false,
    packages: [],
    basePackage: null,
    additionalDevicePackage: null,
    error: null,
  });

  const appState = useRef(AppState.currentState);

  useEffect(() => {
    initializeRevenueCat();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  const handleAppStateChange = useCallback(async (nextState: AppStateStatus) => {
    if (appState.current.match(/inactive|background/) && nextState === 'active') {
      await checkSubscriptionStatus();
    }
    appState.current = nextState;
  }, []);

  // ─── Initialization ──────────────────────────────────────────────────────

  const initializeRevenueCat = async () => {
    if (!Purchases) {
      console.log('[Subscription] Running in free mode (SDK not installed)');
      setState(prev => ({ ...prev, isInitialized: true, isPro: false }));
      return;
    }

    try {
      const apiKey = Platform.OS === 'ios' ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY;
      if (!apiKey) {
        console.log('[Subscription] No API key for platform:', Platform.OS);
        setState(prev => ({ ...prev, isInitialized: true }));
        return;
      }

      if (LOG_LEVEL) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      await Purchases.configure({ apiKey });
      console.log('[Subscription] RevenueCat initialized');

      await Promise.all([checkSubscriptionStatus(), fetchOfferings()]);
      setState(prev => ({ ...prev, isInitialized: true }));
    } catch (error: any) {
      console.warn('[Subscription] Init error:', error?.message || error);
      setState(prev => ({
        ...prev,
        isInitialized: true,
        error: 'Failed to initialize purchases',
      }));
    }
  };

  // ─── Status check ────────────────────────────────────────────────────────

  const checkSubscriptionStatus = async () => {
    if (!Purchases) return;
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      const isPro = customerInfo?.entitlements?.active?.[ENTITLEMENT_ID] !== undefined;
      setState(prev => ({ ...prev, isPro, error: null }));
      console.log('[Subscription] Pro status:', isPro);
    } catch (error: any) {
      console.warn('[Subscription] Status check error:', error?.message || error);
    }
  };

  // ─── Offerings ───────────────────────────────────────────────────────────

  const fetchOfferings = async () => {
    if (!Purchases) return;
    try {
      const offerings = await Purchases.getOfferings();
      const current = offerings?.current;
      const allPackages: any[] = current?.availablePackages ?? [];

      // Find base package — the $rc_monthly or first MONTHLY type
      const basePackage =
        allPackages.find((p: any) =>
          p.identifier === PACKAGE_IDS.base ||
          p.packageType === 'MONTHLY'
        ) ?? allPackages[0] ?? null;

      // Find additional device package by our custom identifier
      const additionalDevicePackage =
        allPackages.find((p: any) =>
          p.identifier === PACKAGE_IDS.additionalDevice ||
          p.product?.productIdentifier === PRODUCT_IDS.additionalDevice
        ) ?? null;

      setState(prev => ({
        ...prev,
        packages: allPackages,
        basePackage,
        additionalDevicePackage,
      }));

      console.log(
        '[Subscription] Offerings loaded — base:',
        basePackage?.identifier ?? 'none',
        'additional:',
        additionalDevicePackage?.identifier ?? 'none (not yet created in ASC)'
      );
    } catch (error: any) {
      console.warn('[Subscription] Offerings error:', error?.message || error);
    }
  };

  // ─── Purchase helpers ────────────────────────────────────────────────────

  const executePurchase = async (pkg: any | null, label: string): Promise<boolean> => {
    if (!Purchases) {
      setState(prev => ({ ...prev, error: 'Purchase not available in development mode' }));
      return false;
    }
    if (!pkg) {
      setState(prev => ({
        ...prev,
        error: `${label} package not available. Please try again later.`,
      }));
      return false;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const isPro = customerInfo?.entitlements?.active?.[ENTITLEMENT_ID] !== undefined;
      setState(prev => ({
        ...prev,
        isPro,
        isLoading: false,
        error: isPro ? null : 'Purchase completed but entitlement not found',
      }));
      return isPro;
    } catch (error: any) {
      const userCancelled = error?.userCancelled || error?.code === '1';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: userCancelled ? null : error?.message || 'Purchase failed',
      }));
      return false;
    }
  };

  // ─── Public purchase functions ───────────────────────────────────────────

  /**
   * Purchase the base Pro subscription ($4.99/mo).
   * Should be called when the user has 0 licensed devices.
   * After success, call DeviceLicenseContext.activateCurrentDevice().
   */
  const purchaseBase = useCallback(async (): Promise<boolean> => {
    // If package not loaded yet, try to fetch offerings first
    let pkg = state.basePackage;
    if (!pkg && Purchases) {
      await fetchOfferings();
      // Re-read from state after fetch — use the updated value from RC
      try {
        const offerings = await Purchases.getOfferings();
        const allPkgs: any[] = offerings?.current?.availablePackages ?? [];
        pkg = allPkgs.find((p: any) =>
          p.identifier === PACKAGE_IDS.base || p.packageType === 'MONTHLY'
        ) ?? allPkgs[0] ?? null;
      } catch { /* use null */ }
    }
    return executePurchase(pkg, 'Base Pro');
  }, [state.basePackage]);

  /**
   * Purchase an additional device slot ($2.99/mo).
   * Should be called when the user already has at least 1 licensed device.
   * After success, call DeviceLicenseContext.activateCurrentDevice().
   */
  const purchaseAdditionalDevice = useCallback(async (): Promise<boolean> => {
    let pkg = state.additionalDevicePackage;
    if (!pkg && Purchases) {
      try {
        const offerings = await Purchases.getOfferings();
        const allPkgs: any[] = offerings?.current?.availablePackages ?? [];
        pkg = allPkgs.find((p: any) =>
          p.identifier === PACKAGE_IDS.additionalDevice ||
          p.product?.productIdentifier === PRODUCT_IDS.additionalDevice
        ) ?? null;
      } catch { /* use null */ }
    }
    return executePurchase(pkg, 'Additional Device');
  }, [state.additionalDevicePackage]);

  /** @deprecated Use purchaseBase() */
  const purchasePro = useCallback(() => purchaseBase(), [purchaseBase]);

  // ─── Restore ─────────────────────────────────────────────────────────────

  const restorePurchases = useCallback(async (): Promise<boolean> => {
    if (!Purchases) {
      setState(prev => ({ ...prev, error: 'Restore not available in development mode' }));
      return false;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const customerInfo = await Purchases.restorePurchases();
      const isPro = customerInfo?.entitlements?.active?.[ENTITLEMENT_ID] !== undefined;
      setState(prev => ({
        ...prev,
        isPro,
        isLoading: false,
        error: isPro ? null : 'No active subscription found',
      }));
      return isPro;
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error?.message || 'Restore failed',
      }));
      return false;
    }
  }, []);

  const refreshStatus = useCallback(async () => {
    await Promise.all([checkSubscriptionStatus(), fetchOfferings()]);
  }, []);

  // ─── Context value ───────────────────────────────────────────────────────

  const value: SubscriptionContextValue = {
    ...state,
    purchaseBase,
    purchaseAdditionalDevice,
    purchasePro,
    restorePurchases,
    refreshStatus,
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSubscription(): SubscriptionContextValue {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}

export default SubscriptionContext;
