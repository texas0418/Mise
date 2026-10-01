/**
 * contexts/SubscriptionContext.tsx
 *
 * RevenueCat Subscription Provider — v3 Device Tier Model
 *
 * One subscription per tier, monthly + annual base plans, all tiers in one
 * subscription group per store so upgrades and proration are native. The
 * ladder itself (names, limits, product ids) lives in lib/tiers.ts.
 *
 * Solo is the original Mise Pro product, so existing subscribers are
 * already on a tier. The old per-device add-on products are never sold
 * here again but are still honoured when active (grandfathering).
 *
 * Entitlement: "Mise Film Director Suite Pro" — attached to every tier.
 *
 * Flow:
 *   - purchaseTier(tierId, period)  → buy or change tier
 *   - restorePurchases()            → restores any active RC subscription
 *   - After any successful purchase, DeviceLicenseContext calls activateCurrentDevice()
 *
 * NOTE: This context exposes ONLY the RevenueCat signals (state.isPro,
 * state.activeTierId). For feature gating, components should use
 * useDeviceLicense().isPro instead, which is the combined truth:
 * (isDeviceLicensed || isRevenueCatPro).
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
import { useAuth } from '@/contexts/AuthContext';
import { syncEntitlement } from '@/lib/syncEntitlement';
import {
  TIERS,
  TIERS_OFFERING_ID,
  getTier,
  resolveTierState,
  type TierId,
  type BillingPeriod,
} from '@/lib/tiers';

/*
 * RevenueCat — required lazily so the app does not crash when the SDK is absent.
 *
 * The web build maps `react-native-purchases` to `web-stubs/empty.js`
 * (metro.config.js), and that stub sets `module.exports.default = {}`. So on
 * web the require succeeds and `rc.default` is an empty object: **truthy, with
 * no methods on it**. Every `if (!Purchases)` guard in this file passed, and
 * the call after it hit a method that does not exist.
 *
 * Rather than test for a method at each call site — which leaves the trap
 * armed for the next one — "present but not functional" is resolved to
 * absent here, once. `configure` is the probe because nothing else can happen
 * without it.
 */
let Purchases: any = null;
let LOG_LEVEL: any = null;
try {
  const rc = require('react-native-purchases');
  const resolved = rc.default || rc.Purchases;
  Purchases = typeof resolved?.configure === 'function' ? resolved : null;
  LOG_LEVEL = rc.LOG_LEVEL;
  if (!Purchases) {
    console.log('[Subscription] RevenueCat has no implementation on this platform — free mode');
  }
} catch (e) {
  console.log('[Subscription] RevenueCat SDK not installed — running in free mode');
}

/**
 * Why a purchase action cannot run here.
 *
 * On web this is not a failure and should not read like one: Mise takes
 * payment only through the App Store, which is exactly what the desktop gate
 * told the user on the way in. Anywhere else, a missing SDK means a
 * development build.
 */
function unavailableMessage(action: 'Purchase' | 'Restore'): string {
  return Platform.OS === 'web'
    ? 'Subscriptions are managed in the Mise app on iPhone and iPad, through the App Store.'
    : `${action} not available in development mode`;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const REVENUECAT_IOS_KEY = 'appl_hDSIJdgEdYkPSIavpEfPgjEImCA';
const REVENUECAT_ANDROID_KEY = 'goog_BDEFvTtjaxyWwmoJfQVRFfXETml';

const ENTITLEMENT_ID = 'Mise Film Director Suite Pro';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Key into tierPackages: `${tierId}_${period}`. */
export function tierPackageKey(tierId: TierId, period: BillingPeriod): string {
  return `${tierId}_${period}`;
}

interface SubscriptionState {
  isInitialized: boolean;
  isPro: boolean;
  isLoading: boolean;
  /** The tier whose subscription is currently active, or null when free. */
  activeTierId: TierId | null;
  /** A grandfathered per-device add-on is still renewing (+1 device). */
  legacyAddonActive: boolean;
  /** Devices the active subscription licenses (0 when free). */
  deviceLimit: number;
  /** RC packages from the `tiers` offering, keyed by tierPackageKey(). */
  tierPackages: Record<string, any>;
  error: string | null;
}

interface SubscriptionContextValue extends SubscriptionState {
  /** Purchase (or change to) the given tier. The stores handle proration
   * natively because every tier shares one subscription group. */
  purchaseTier: (tierId: TierId, period: BillingPeriod) => Promise<boolean>;
  /** Restore any previous purchases from the store */
  restorePurchases: () => Promise<boolean>;
  /** Refresh subscription status (call after device activation) */
  refreshStatus: () => Promise<void>;
}

export const FREE_PROJECT_LIMIT = 2;

// ─── Context ──────────────────────────────────────────────────────────────────

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SubscriptionState>({
    isInitialized: false,
    isPro: false,
    isLoading: false,
    activeTierId: null,
    legacyAddonActive: false,
    deviceLimit: 0,
    tierPackages: {},
    error: null,
  });

  const appState = useRef(AppState.currentState);
  const { user } = useAuth();
  const userId = user?.id ?? null;

  useEffect(() => {
    initializeRevenueCat();
  }, []);

  /*
   * Tell RevenueCat who this is.
   *
   * Without this, `Purchases.configure` assigns an anonymous per-install id
   * ($RCAnonymousID:…) and RevenueCat never learns the Supabase user. That is
   * survivable while entitlement is read on-device — but it makes a webhook
   * impossible, because the event arrives attributed to an id no server can
   * map to an account. Identifying here is the precondition for entitlement
   * being authoritative rather than self-attested.
   *
   * logIn also aliases the anonymous id to this one, so a subscription bought
   * before signing in follows the person into their account rather than being
   * stranded on the install.
   *
   * Failures are logged and swallowed: identity is for the server's benefit,
   * and losing it must never stop someone using something they paid for.
   */
  useEffect(() => {
    if (!Purchases) return;
    let cancelled = false;
    (async () => {
      try {
        if (userId) await Purchases.logIn(userId);
        else await Purchases.logOut();
        if (!cancelled) await checkSubscriptionStatus();
      } catch (e: any) {
        // logOut throws when already anonymous; that is not a problem.
        console.log('[Subscription] identity:', e?.message || e);
      }
      /*
       * Outside the try, and after logIn rather than instead of it: aliasing
       * emits no webhook event, so someone who subscribed before they had an
       * account never gets an `entitlements` row and reads as free on the web
       * until their next renewal. This asks the server to fill it in.
       *
       * It runs even if the identity call above threw, because the failure that
       * matters most here — logIn rejecting after having already aliased — is
       * exactly when the row is missing and worth requesting.
       */
      if (userId && !cancelled) await syncEntitlement();
    })();
    return () => { cancelled = true; };
  }, [userId]);

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

  // ─── Initialization ─────────────────────────────────────────────────────────

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

  // ─── Status check ───────────────────────────────────────────────────────────

  /*
   * One read answers both questions: is the entitlement active, and which
   * tier product carries it. `activeSubscriptions` is RC's list of active
   * product ids; resolveTierState maps them through the ladder and prices
   * the grandfathered add-on in as +1 device.
   */
  const checkSubscriptionStatus = async () => {
    if (!Purchases) return;
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      const isPro = customerInfo?.entitlements?.active?.[ENTITLEMENT_ID] !== undefined;
      const activeIds: string[] = customerInfo?.activeSubscriptions ?? [];
      const { tier, legacyAddonActive, deviceLimit } = resolveTierState(activeIds);
      setState(prev => ({
        ...prev,
        isPro,
        activeTierId: tier?.id ?? null,
        legacyAddonActive,
        deviceLimit,
        error: null,
      }));
      console.log('[Subscription] Pro:', isPro, '| tier:', tier?.id ?? 'none');
    } catch (error: any) {
      console.warn('[Subscription] Status check error:', error?.message || error);
    }
  };

  // ─── Offerings ──────────────────────────────────────────────────────────────

  /*
   * The tier paywall reads the `tiers` offering, NOT `current`. Shipped 1.1.x
   * builds match packages in the current offering by packageType, so adding
   * a second MONTHLY package there would make old paywalls sell the wrong
   * product. The default offering stays frozen for them; this build asks for
   * the tier offering by id.
   */
  const fetchOfferings = async () => {
    if (!Purchases) return;
    try {
      const offerings = await Purchases.getOfferings();
      const tiersOffering = offerings?.all?.[TIERS_OFFERING_ID] ?? null;
      const allPackages: any[] = tiersOffering?.availablePackages ?? [];

      const tierPackages: Record<string, any> = {};
      for (const tier of TIERS) {
        for (const pkg of allPackages) {
          if (pkg.identifier === tier.packageMonthly) {
            tierPackages[tierPackageKey(tier.id, 'monthly')] = pkg;
          } else if (tier.packageAnnual && pkg.identifier === tier.packageAnnual) {
            tierPackages[tierPackageKey(tier.id, 'annual')] = pkg;
          }
        }
      }

      setState(prev => ({ ...prev, tierPackages }));
      console.log(
        '[Subscription] Tier offering loaded —',
        Object.keys(tierPackages).length, 'of',
        TIERS.reduce((n, t) => n + (t.packageAnnual ? 2 : 1), 0),
        'packages'
      );
    } catch (error: any) {
      console.warn('[Subscription] Offerings error:', error?.message || error);
    }
  };

  // ─── Purchase ───────────────────────────────────────────────────────────────

  /*
   * Fold a CustomerInfo into state. Purchase and restore both end here so the
   * entitlement flag and the resolved tier can never disagree between the two
   * paths. `missingError` is what to surface when the store transaction went
   * through but the entitlement did not arrive.
   */
  const applyCustomerInfo = (customerInfo: any, missingError: string): boolean => {
    const isPro = customerInfo?.entitlements?.active?.[ENTITLEMENT_ID] !== undefined;
    const activeIds: string[] = customerInfo?.activeSubscriptions ?? [];
    const resolved = resolveTierState(activeIds);
    setState(prev => ({
      ...prev,
      isPro,
      activeTierId: resolved.tier?.id ?? null,
      legacyAddonActive: resolved.legacyAddonActive,
      deviceLimit: resolved.deviceLimit,
      isLoading: false,
      error: isPro ? null : missingError,
    }));
    return isPro;
  };

  /*
   * On iOS a tier change inside the subscription group is handled entirely by
   * StoreKit. On Android, Play needs to be told which subscription is being
   * replaced or it opens a second, parallel one — that is the old two-
   * subscription trap wearing a new hat. RC carries that as
   * googleProductChangeInfo (third argument; the second is the deprecated
   * UpgradeInfo slot).
   */
  const purchaseTier = useCallback(
    async (tierId: TierId, period: BillingPeriod): Promise<boolean> => {
      if (!Purchases) {
        setState(prev => ({ ...prev, error: unavailableMessage('Purchase') }));
        return false;
      }

      const tier = getTier(tierId);
      let pkg = state.tierPackages[tierPackageKey(tierId, period)] ?? null;
      if (!pkg) {
        await fetchOfferings();
        pkg = await fetchTierPackage(tierId, period);
      }
      if (!pkg) {
        setState(prev => ({
          ...prev,
          error: `${tier.name} plan not available. Please try again later.`,
        }));
        return false;
      }

      const changingFromTier =
        Platform.OS === 'android' && state.activeTierId && state.activeTierId !== tierId
          ? getTier(state.activeTierId)
          : null;
      const googleChange = changingFromTier
        ? { oldProductIdentifier: changingFromTier.playSubscription }
        : null;

      setState(prev => ({ ...prev, isLoading: true, error: null }));
      try {
        const { customerInfo } = await Purchases.purchasePackage(pkg, null, googleChange);
        return applyCustomerInfo(customerInfo, 'Purchase completed but entitlement not found');
      } catch (error: any) {
        const userCancelled = error?.userCancelled || error?.code === '1';
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: userCancelled ? null : error?.message || 'Purchase failed',
        }));
        return false;
      }
    },
    [state.tierPackages, state.activeTierId]
  );

  // Helper: fetch a fresh package straight from RC if state is stale
  const fetchTierPackage = async (
    tierId: TierId,
    period: BillingPeriod
  ): Promise<any | null> => {
    if (!Purchases) return null;
    try {
      const tier = getTier(tierId);
      const packageId = period === 'annual' ? tier.packageAnnual : tier.packageMonthly;
      if (!packageId) return null;
      const offerings = await Purchases.getOfferings();
      const allPkgs: any[] =
        offerings?.all?.[TIERS_OFFERING_ID]?.availablePackages ?? [];
      return allPkgs.find((p: any) => p.identifier === packageId) ?? null;
    } catch {
      return null;
    }
  };

  // ─── Restore ────────────────────────────────────────────────────────────────

  const restorePurchases = useCallback(async (): Promise<boolean> => {
    if (!Purchases) {
      setState(prev => ({ ...prev, error: unavailableMessage('Restore') }));
      return false;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const customerInfo = await Purchases.restorePurchases();
      return applyCustomerInfo(customerInfo, 'No active subscription found');
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

  // ─── Context value ──────────────────────────────────────────────────────────

  const value: SubscriptionContextValue = {
    ...state,
    purchaseTier,
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
