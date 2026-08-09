/**
 * scripts/test-navthrottle.ts
 *
 * Assertions for utils/navigationThrottle.ts — which repeated navigations get
 * swallowed and, more importantly, which do not. Run from the repo root:
 *
 *   node --experimental-strip-types scripts/test-navthrottle.ts
 *
 * Time is passed in rather than read, so these are exact rather than timing
 * dependent.
 */
import {
  REPEAT_WINDOW_MS, navigationKey, createNavigationThrottle,
} from '../utils/navigationThrottle.ts';

let pass = 0;
let fail = 0;

function eq(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { pass++; return; }
  fail++;
  console.log(`FAIL ${label}\n  expected ${e}\n  actual   ${a}`);
}

// --- navigationKey ---------------------------------------------------------
eq('string href', navigationKey('push', '/a'), 'push:/a');
eq('no href', navigationKey('back'), 'back');
eq('object href', navigationKey('push', { pathname: '/a', params: { id: '1' } }), 'push:{"pathname":"/a","params":{"id":"1"}}');
// Same route, different method, must be a different key.
eq('method is part of the key', navigationKey('replace', '/a') !== navigationKey('push', '/a'), true);
// Different params must be different keys.
eq('params distinguish object hrefs',
  navigationKey('push', { pathname: '/a', params: { id: '1' } }) !== navigationKey('push', { pathname: '/a', params: { id: '2' } }),
  true);
// A circular href must not throw.
const circular: Record<string, unknown> = { pathname: '/a' };
circular.self = circular;
eq('circular href does not throw', typeof navigationKey('push', circular), 'string');

// --- the bug being fixed ---------------------------------------------------
{
  const allow = createNavigationThrottle();
  // A double tap on one button, both in the same tick.
  eq('first tap runs', allow(navigationKey('push', '/new-project'), 1000), true);
  eq('second tap in the same tick is swallowed', allow(navigationKey('push', '/new-project'), 1000), false);
  eq('third tap too', allow(navigationKey('push', '/new-project'), 1000), false);
}

// --- what must NOT be swallowed --------------------------------------------
{
  const allow = createNavigationThrottle();
  // app/paywall.tsx: close, then push sign-up, in one handler. A single shared
  // timer would have eaten the push and broken that flow.
  eq('back runs', allow(navigationKey('back'), 1000), true);
  eq('push straight after back still runs', allow(navigationKey('push', '/auth/sign-up'), 1000), true);
}
{
  const allow = createNavigationThrottle();
  // Two different destinations in a row are two different intents.
  eq('push A runs', allow(navigationKey('push', '/a'), 1000), true);
  eq('push B straight after runs', allow(navigationKey('push', '/b'), 1000), true);
}
{
  const allow = createNavigationThrottle();
  eq('push then replace of the same route both run',
    [allow(navigationKey('push', '/a'), 1000), allow(navigationKey('replace', '/a'), 1000)],
    [true, true]);
}

// --- the window ------------------------------------------------------------
{
  const allow = createNavigationThrottle();
  allow(navigationKey('push', '/a'), 1000);
  eq('inside the window is blocked', allow(navigationKey('push', '/a'), 1000 + REPEAT_WINDOW_MS - 1), false);
}
{
  const allow = createNavigationThrottle();
  allow(navigationKey('push', '/a'), 1000);
  // A deliberate second trip to the same screen must work.
  eq('at the window boundary it runs again', allow(navigationKey('push', '/a'), 1000 + REPEAT_WINDOW_MS), true);
}
{
  const allow = createNavigationThrottle();
  allow(navigationKey('push', '/a'), 1000);
  eq('well after the window it runs again', allow(navigationKey('push', '/a'), 5000), true);
}
{
  // A blocked call must not extend the window — otherwise holding a button
  // down could lock the route out indefinitely.
  const allow = createNavigationThrottle();
  allow(navigationKey('push', '/a'), 1000);
  allow(navigationKey('push', '/a'), 1100);
  allow(navigationKey('push', '/a'), 1200);
  eq('blocked calls do not extend the window', allow(navigationKey('push', '/a'), 1600), true);
}

// --- independence ----------------------------------------------------------
{
  // Two components each get their own throttle; one must not gag the other.
  const a = createNavigationThrottle();
  const b = createNavigationThrottle();
  eq('component A runs', a(navigationKey('push', '/x'), 1000), true);
  eq('component B is unaffected', b(navigationKey('push', '/x'), 1000), true);
}
{
  const allow = createNavigationThrottle(0);
  eq('a zero window blocks nothing',
    [allow('k', 1000), allow('k', 1000)], [true, true]);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
