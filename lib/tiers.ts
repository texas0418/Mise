// ----------------------------------------------------------------------------
// lib/tiers.ts — The device-tier ladder
//
// Replaces the linear base + add-on pricing model. Neither store lets one
// account hold two concurrent subscriptions to the same auto-renewing
// product, so "buy another add-on per device" silently capped at 2 devices.
// Tiers put every size of production on one subscription each, all in one
// subscription group per store, so upgrades and proration are native.
//
// Solo IS the old Mise Pro: same products, same price, so every existing
// subscriber is already on a tier without being migrated or repriced.
//
// Pure module: imports nothing, so `node --experimental-strip-types` can run
// scripts/test-tiers.ts against it directly.
// ----------------------------------------------------------------------------

export type TierId = 'solo' | 'crew' | 'production' | 'studio' | 'slate';
export type BillingPeriod = 'monthly' | 'annual';

export interface DeviceTier {
  id: TierId;
  name: string;
  /** Devices this tier licenses. A hard number on purpose — see `slate`. */
  deviceLimit: number;
  /** Fallback display prices (USD). Live store prices from RevenueCat win. */
  monthlyPrice: number;
  /** null = this tier is billed monthly only (store price caps, see below). */
  annualPrice: number | null;
  /** App Store product identifiers. */
  appleMonthly: string;
  appleAnnual: string | null;
  /** Play subscription id + base plan ids (RC reports these as `sub:plan`). */
  playSubscription: string;
  playMonthlyPlan: string;
  playAnnualPlan: string | null;
  /** Package identifiers inside the RevenueCat `tiers` offering. */
  packageMonthly: string;
  packageAnnual: string | null;
}

const APPLE_PREFIX = 'com.mise.film_director_suite.';

/*
 * "Slate", not "Unlimited": the cap at 250 is real, and advertising unlimited
 * while enforcing a ceiling is indefensible in a refund dispute. The cap
 * exists because a genuinely unlimited per-device licence invites a rental
 * house or film school to run everything off one login.
 *
 * Annual pricing is 10x monthly (the ~17% break the original $49.99 set).
 * Studio and Slate have no annual plan: 10x monthly lands above Apple's
 * $1,000 price-point ceiling for Slate and above Google Play's $400 US cap
 * for both, so those tiers bill monthly everywhere rather than carrying a
 * different value proposition per store.
 */
export const TIERS: readonly DeviceTier[] = [
  {
    id: 'solo',
    name: 'Solo',
    deviceLimit: 1,
    monthlyPrice: 4.99,
    annualPrice: 49.99,
    appleMonthly: APPLE_PREFIX + 'pro_monthly',
    appleAnnual: APPLE_PREFIX + 'pro_yearly',
    playSubscription: 'mise_pro',
    playMonthlyPlan: 'pro-monthly',
    playAnnualPlan: 'pro-annual',
    packageMonthly: 'solo_monthly',
    packageAnnual: 'solo_annual',
  },
  {
    id: 'crew',
    name: 'Crew',
    deviceLimit: 5,
    monthlyPrice: 14.99,
    annualPrice: 149.99,
    appleMonthly: APPLE_PREFIX + 'crew_monthly',
    appleAnnual: APPLE_PREFIX + 'crew_yearly',
    playSubscription: 'mise_crew',
    playMonthlyPlan: 'crew-monthly',
    playAnnualPlan: 'crew-annual',
    packageMonthly: 'crew_monthly',
    packageAnnual: 'crew_annual',
  },
  {
    id: 'production',
    name: 'Production',
    deviceLimit: 15,
    monthlyPrice: 34.99,
    annualPrice: 349.99,
    appleMonthly: APPLE_PREFIX + 'production_monthly',
    appleAnnual: APPLE_PREFIX + 'production_yearly',
    playSubscription: 'mise_production',
    playMonthlyPlan: 'production-monthly',
    playAnnualPlan: 'production-annual',
    packageMonthly: 'production_monthly',
    packageAnnual: 'production_annual',
  },
  {
    id: 'studio',
    name: 'Studio',
    deviceLimit: 40,
    monthlyPrice: 79.99,
    annualPrice: null,
    appleMonthly: APPLE_PREFIX + 'studio_monthly',
    appleAnnual: null,
    playSubscription: 'mise_studio',
    playMonthlyPlan: 'studio-monthly',
    playAnnualPlan: null,
    packageMonthly: 'studio_monthly',
    packageAnnual: null,
  },
  {
    id: 'slate',
    name: 'Slate',
    deviceLimit: 250,
    monthlyPrice: 149.99,
    annualPrice: null,
    appleMonthly: APPLE_PREFIX + 'slate_monthly',
    appleAnnual: null,
    playSubscription: 'mise_slate',
    playMonthlyPlan: 'slate-monthly',
    playAnnualPlan: null,
    packageMonthly: 'slate_monthly',
    packageAnnual: null,
  },
] as const;

/** The RevenueCat offering the tier paywall reads. The `default` offering is
 * left untouched because shipped builds match its packages by packageType,
 * and a second MONTHLY package there would make 1.1.x paywalls sell the
 * wrong product. */
export const TIERS_OFFERING_ID = 'tiers';

/*
 * The old per-device add-on products. Still APPROVED in both stores and still
 * renewing for grandfathered subscribers; never sold again. An active add-on
 * licenses one extra device on top of Solo.
 */
const LEGACY_ADDON_PRODUCTS: readonly string[] = [
  APPLE_PREFIX + 'additional_device_monthly',
  APPLE_PREFIX + 'additional_device_annual',
  'mise_additional_device',
];

export function getTier(id: TierId): DeviceTier {
  // TIERS covers every TierId by construction; the fallback keeps the
  // signature non-optional without an assertion.
  return TIERS.find(t => t.id === id) ?? TIERS[0];
}

/** The cheapest tier that licenses at least `deviceCount` devices, or null
 * when the count exceeds every tier (the honest answer past 250). */
export function tierForDeviceCount(deviceCount: number): DeviceTier | null {
  return TIERS.find(t => t.deviceLimit >= deviceCount) ?? null;
}

/** The next tier up from `id`, or null at the top of the ladder. */
export function nextTierUp(id: TierId): DeviceTier | null {
  const i = TIERS.findIndex(t => t.id === id);
  return i >= 0 && i + 1 < TIERS.length ? TIERS[i + 1] : null;
}

/*
 * RevenueCat reports a product identifier as the raw App Store id on iOS and
 * as `subscriptionId:basePlanId` (or occasionally the bare subscription id)
 * on Android. Normalising here keeps every caller platform-blind.
 */
export function tierForProduct(productId: string): DeviceTier | null {
  const bare = productId.split(':')[0];
  return (
    TIERS.find(
      t =>
        t.appleMonthly === productId ||
        t.appleAnnual === productId ||
        t.playSubscription === bare
    ) ?? null
  );
}

export function isLegacyAddonProduct(productId: string): boolean {
  const bare = productId.split(':')[0];
  return (
    LEGACY_ADDON_PRODUCTS.includes(productId) ||
    LEGACY_ADDON_PRODUCTS.includes(bare)
  );
}

/*
 * The active tier for a customer, from RevenueCat's active product ids.
 * Highest tier wins if more than one is somehow active (mid-proration, or a
 * household with both). Returns the tier plus the extra device a legacy
 * add-on still buys, so callers get one number to enforce.
 */
export function resolveTierState(activeProductIds: readonly string[]): {
  tier: DeviceTier | null;
  legacyAddonActive: boolean;
  deviceLimit: number;
} {
  let best: DeviceTier | null = null;
  let legacyAddonActive = false;
  for (const pid of activeProductIds) {
    if (isLegacyAddonProduct(pid)) {
      legacyAddonActive = true;
      continue;
    }
    const tier = tierForProduct(pid);
    if (tier && (!best || tier.deviceLimit > best.deviceLimit)) best = tier;
  }
  const base = best ? best.deviceLimit : 0;
  return {
    tier: best,
    legacyAddonActive,
    deviceLimit: base + (legacyAddonActive ? 1 : 0),
  };
}
