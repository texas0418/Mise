/**
 * scripts/test-sidebar-destinations.ts
 *
 * Keeps the web sidebar and the native tab bar offering the same six places.
 *
 *   node --experimental-strip-types scripts/test-sidebar-destinations.ts
 *
 * `components/DesktopSidebar.web.tsx` exists because the tab bar in
 * `app/(tabs)/_layout.tsx` belongs to the Tabs navigator and therefore vanishes
 * the moment you open a tool, which are root Stack routes (#120). The cost of
 * that fix is a second copy of the destination list, and the failure it invites
 * is silent and one-sided: someone adds a seventh tab, the phone gets it, the
 * web does not, and nothing complains.
 *
 * Neither file can be imported here — both are JSX and reach React Native
 * through the `@/` alias — so this reads the source, in the same spirit as the
 * `isSyncEnabled` check in test-entitlement.ts.
 */
import { readFileSync } from 'node:fs';

const SIDEBAR = 'components/DesktopSidebar.web.tsx';
const TABS = 'app/(tabs)/_layout.tsx';

const sidebarSrc = readFileSync(SIDEBAR, 'utf8');
const tabsSrc = readFileSync(TABS, 'utf8');

let pass = 0;
let fail = 0;

function ok(label: string, condition: boolean, detail = '') {
  if (condition) { pass++; return; }
  fail++;
  console.log(`FAIL ${label}${detail ? `\n  ${detail}` : ''}`);
}

// --- the two lists ----------------------------------------------------------

const sidebarLabels = [...sidebarSrc.matchAll(/\{ label: '([^']+)'/g)].map(m => m[1]);

/*
 * Tab titles, minus the ones deliberately absent from navigation. `crew` sets
 * `href: null`, which is expo-router's way of keeping a route in the group
 * without giving it a tab, so it should not appear in the sidebar either.
 */
const tabScreens = [...tabsSrc.matchAll(/<Tabs\.Screen\s+name="([^"]+)"\s+options=\{\{([\s\S]*?)\}\}\s*\/>/g)]
  .map(m => ({ name: m[1], options: m[2] }));
const tabLabels = tabScreens
  .filter(t => !/href:\s*null/.test(t.options))
  .map(t => (t.options.match(/title:\s*"([^"]+)"/) || [])[1])
  .filter(Boolean);

ok('the sidebar lists six destinations', sidebarLabels.length === 6,
  `found ${sidebarLabels.length}: ${sidebarLabels.join(', ')}`);

ok('the tab bar lists six destinations', tabLabels.length === 6,
  `found ${tabLabels.length}: ${tabLabels.join(', ')}`);

ok('both offer exactly the same places, in the same order',
  JSON.stringify(sidebarLabels) === JSON.stringify(tabLabels),
  `sidebar: ${sidebarLabels.join(', ')}\n  tabs:    ${tabLabels.join(', ')}`);

ok('a route hidden from the tab bar is hidden from the sidebar',
  !sidebarLabels.some(l => l.toLowerCase() === 'crew'),
  'crew sets href: null, so it is reachable but not a destination');

// --- the mechanism that makes the sidebar persist ---------------------------

ok('the sidebar is mounted outside the tab group',
  /DesktopSidebar/.test(readFileSync('app/_layout.tsx', 'utf8')),
  'mounted inside (tabs) it would unmount on every tool, which is the bug');

ok('the tab bar stands down on desktop',
  /isDesktop \? \{ display: 'none'/.test(tabsSrc),
  'without this the desktop shows two copies of the same six links');

ok('destinations switch rather than stack',
  /router\.replace\(path as never\)/.test(sidebarSrc),
  'push and navigate both leave a back arrow pointing at the tool you left — '
  + 'navigate included, because reaching a tool unmounts the tab group');

console.log(`${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
