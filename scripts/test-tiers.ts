/**
 * scripts/test-tiers.ts
 *
 *   node --experimental-strip-types scripts/test-tiers.ts
 *
 * The device-tier ladder holds together.
 *
 * ## Why this exists
 *
 * The ladder in lib/tiers.ts is the single map between money and device
 * counts, across two stores whose product identifiers do not even share a
 * format (iOS ships a full reverse-DNS id, Android ships `sub:basePlan`).
 * A typo in one id means a tier that cannot be bought, or worse, a paying
 * customer whose tier resolves to null and reads as free. Every assertion
 * here is a shape the paywall or the device limit silently depends on.
 *
 * It also pins the grandfathering contract: the old Mise Pro products ARE
 * Solo, and a still-renewing per-device add-on is one extra device. If an
 * edit to the ladder breaks either, existing subscribers lose access they
 * pay for, and this file is where that surfaces.
 */
import {
  TIERS,
  getTier,
  tierForDeviceCount,
  nextTierUp,
  tierForProduct,
  isLegacyAddonProduct,
  resolveTierState,
} from '../lib/tiers.ts';

let pass = 0;
let fail = 0;

function ok(label: string, condition: boolean, detail = '') {
  if (condition) { pass++; return; }
  fail++;
  console.error(`FAIL: ${label}${detail ? ` — ${detail}` : ''}`);
}

// ─── The ladder itself ───────────────────────────────────────────────────────

ok('five tiers', TIERS.length === 5, String(TIERS.length));
ok('ladder order is solo, crew, production, studio, slate',
  TIERS.map(t => t.id).join(',') === 'solo,crew,production,studio,slate');

for (let i = 1; i < TIERS.length; i++) {
  ok(`${TIERS[i].id} licenses more devices than ${TIERS[i - 1].id}`,
    TIERS[i].deviceLimit > TIERS[i - 1].deviceLimit);
  ok(`${TIERS[i].id} costs more per month than ${TIERS[i - 1].id}`,
    TIERS[i].monthlyPrice > TIERS[i - 1].monthlyPrice);
}

ok('device limits are the agreed ladder',
  TIERS.map(t => t.deviceLimit).join(',') === '1,5,15,40,250');
ok('monthly prices are the agreed ladder',
  TIERS.map(t => t.monthlyPrice).join(',') === '4.99,14.99,34.99,79.99,149.99');

for (const t of TIERS) {
  if (t.annualPrice !== null) {
    ok(`${t.id} annual is the 10x break`,
      Math.abs(t.annualPrice - (t.monthlyPrice * 10 + 0.09)) < 0.11,
      `${t.annualPrice} vs ${t.monthlyPrice}`);
    ok(`${t.id} has annual ids on both stores and a package`,
      t.appleAnnual !== null && t.playAnnualPlan !== null && t.packageAnnual !== null);
  } else {
    ok(`${t.id} is monthly-only everywhere, not half-configured`,
      t.appleAnnual === null && t.playAnnualPlan === null && t.packageAnnual === null);
  }
}

// ─── Grandfathering: Solo IS the original Mise Pro ───────────────────────────

ok('solo keeps the shipped iOS monthly product',
  getTier('solo').appleMonthly === 'com.mise.film_director_suite.pro_monthly');
ok('solo keeps the shipped iOS yearly product',
  getTier('solo').appleAnnual === 'com.mise.film_director_suite.pro_yearly');
ok('solo keeps the live Play subscription',
  getTier('solo').playSubscription === 'mise_pro');

// ─── Identifier hygiene ──────────────────────────────────────────────────────

const appleIds = TIERS.flatMap(t => [t.appleMonthly, t.appleAnnual]).filter(Boolean);
const playSubs = TIERS.map(t => t.playSubscription);
const packageIds = TIERS.flatMap(t => [t.packageMonthly, t.packageAnnual]).filter(Boolean);
ok('no duplicate Apple product ids', new Set(appleIds).size === appleIds.length);
ok('no duplicate Play subscription ids', new Set(playSubs).size === playSubs.length);
ok('no duplicate RC package ids', new Set(packageIds).size === packageIds.length);
ok('every Apple id carries the bundle prefix',
  appleIds.every(id => (id as string).startsWith('com.mise.film_director_suite.')));

// ─── tierForDeviceCount: the paywall's "which plan do I need" ────────────────

ok('1 device needs solo', tierForDeviceCount(1)?.id === 'solo');
ok('2 devices need crew', tierForDeviceCount(2)?.id === 'crew');
ok('5 devices still fit crew', tierForDeviceCount(5)?.id === 'crew');
ok('6 devices need production', tierForDeviceCount(6)?.id === 'production');
ok('250 devices fit slate', tierForDeviceCount(250)?.id === 'slate');
ok('251 devices honestly have no tier', tierForDeviceCount(251) === null);

// ─── nextTierUp: the upgrade path ────────────────────────────────────────────

ok('solo upgrades to crew', nextTierUp('solo')?.id === 'crew');
ok('studio upgrades to slate', nextTierUp('studio')?.id === 'slate');
ok('slate has nowhere up to go', nextTierUp('slate') === null);

// ─── tierForProduct: both stores' identifier formats ─────────────────────────

ok('iOS monthly id resolves',
  tierForProduct('com.mise.film_director_suite.crew_monthly')?.id === 'crew');
ok('iOS yearly id resolves',
  tierForProduct('com.mise.film_director_suite.pro_yearly')?.id === 'solo');
ok('Android sub:plan id resolves',
  tierForProduct('mise_production:production-monthly')?.id === 'production');
ok('Android bare sub id resolves',
  tierForProduct('mise_slate')?.id === 'slate');
ok('an unknown product resolves to null',
  tierForProduct('com.mise.film_director_suite.enterprise_monthly') === null);

// ─── Legacy add-on detection ─────────────────────────────────────────────────

ok('iOS add-on monthly is legacy',
  isLegacyAddonProduct('com.mise.film_director_suite.additional_device_monthly'));
ok('iOS add-on annual is legacy',
  isLegacyAddonProduct('com.mise.film_director_suite.additional_device_annual'));
ok('Play add-on is legacy, in sub:plan form too',
  isLegacyAddonProduct('mise_additional_device:device-monthly'));
ok('a tier product is not legacy',
  !isLegacyAddonProduct('com.mise.film_director_suite.pro_monthly'));

// ─── resolveTierState: what the app enforces ─────────────────────────────────

const free = resolveTierState([]);
ok('no subscriptions = no tier, no devices',
  free.tier === null && free.deviceLimit === 0 && !free.legacyAddonActive);

const solo = resolveTierState(['com.mise.film_director_suite.pro_monthly']);
ok('old Mise Pro subscriber is solo with 1 device',
  solo.tier?.id === 'solo' && solo.deviceLimit === 1);

const legacy = resolveTierState([
  'com.mise.film_director_suite.pro_yearly',
  'com.mise.film_director_suite.additional_device_monthly',
]);
ok('grandfathered base + add-on is solo with 2 devices',
  legacy.tier?.id === 'solo' && legacy.deviceLimit === 2 && legacy.legacyAddonActive);

const orphanAddon = resolveTierState([
  'com.mise.film_director_suite.additional_device_monthly',
]);
ok('an add-on with no base still buys its device',
  orphanAddon.tier === null && orphanAddon.deviceLimit === 1);

const midProration = resolveTierState([
  'mise_pro:pro-monthly',
  'mise_studio:studio-monthly',
]);
ok('two active tiers resolve to the bigger one',
  midProration.tier?.id === 'studio' && midProration.deviceLimit === 40);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
