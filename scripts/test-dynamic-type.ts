/**
 * scripts/test-dynamic-type.ts
 *
 *   node --experimental-strip-types scripts/test-dynamic-type.ts
 *
 * The app has to answer the reader's text size, and keep answering it.
 *
 * ## Why this suite exists
 *
 * `utils/useTypography.ts` was written during the #47 accessibility work,
 * documented, covered by test-type-floor.ts, and imported by **nothing**. It
 * shipped with zero call sites, so no layout in the app had ever responded to
 * the setting — before or after a relaunch. Nothing failed, because a hook with
 * no callers cannot fail. That is the same silent-omission shape as the seven
 * suites that sat unwired until scripts/ci/run-tests.sh started discovering
 * them, and it wants the same kind of guard: assert the wiring, not the helper.
 *
 * ## What the device found
 *
 * Changing Dynamic Type while Mise was running left every screen clipped until
 * the app was relaunched. The cause is in React Native:
 * `ParagraphShadowNode::getContent` memoises the built string per shadow node
 * and reads `layoutContext.fontSizeMultiplier` only when that memo misses, so a
 * node surviving the relayout reports the height it had at the old size.
 * `DynamicTypeBoundary` in app/_layout.tsx keys the navigator on `fontScale` so
 * the nodes are rebuilt. Delete the key and the clipping comes straight back
 * with nothing else to notice — hence a test on the key itself.
 *
 * Static checks, deliberately: these are facts about the source, and asserting
 * them needs neither a renderer nor a device.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LARGE_TEXT_THRESHOLD, MAX_TEXT_SCALE } from '../utils/typography.ts';

const root = join(import.meta.dirname, '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

let pass = 0;
let fail = 0;

function ok(label: string, condition: boolean, detail = '') {
  if (condition) { pass++; return; }
  fail++;
  console.log(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

// ─── The hook is actually wired in ──────────────────────────────────────────

/** Surfaces the iPad found broken at the accessibility sizes. */
const MUST_CONSULT_TEXT_SIZE = [
  'components/TodayCards.tsx',
  'app/(tabs)/schedule/index.tsx',
  'app/_layout.tsx',
];

for (const file of MUST_CONSULT_TEXT_SIZE) {
  ok(`${file} reads the live text size`, read(file).includes('useTypography'));
}

const hook = read('utils/useTypography.ts');
ok('the hook still reports the large-text flag', hook.includes('isLargeText'));
/*
 * Not a grep for "PixelRatio" — the hook's own comment names it, to explain why
 * it is the wrong source: `PixelRatio.getFontScale()` is read once and never
 * re-renders. What matters is where the value is actually taken from.
 */
ok('the hook takes the scale from a source that re-renders',
  /const \{ fontScale \} = useWindowDimensions\(\)/.test(hook));
ok('the threshold is the shared one', hook.includes('LARGE_TEXT_THRESHOLD'));
ok('the threshold sits in the accessibility sizes', LARGE_TEXT_THRESHOLD > 1 && LARGE_TEXT_THRESHOLD < 2);

// ─── The relayout fix is still in place ─────────────────────────────────────

const layout = read('app/_layout.tsx');
ok('a boundary rebuilds the tree on a text-size change', layout.includes('DynamicTypeBoundary'));
ok('the boundary is keyed on fontScale, which is what forces the rebuild',
  /key=\{fontScale\}/.test(layout));
ok('the boundary wraps the navigator', /<DynamicTypeBoundary>/.test(layout));
ok('the boundary sits inside the providers, so auth and sync survive it',
  layout.indexOf('<PermissionProvider>') < layout.indexOf('<DynamicTypeBoundary>'));

// ─── Capping is the exception, not the habit ────────────────────────────────

/*
 * `maxFontSizeMultiplier` shrinks what a reader asked to be bigger, so it is
 * only defensible where the container's height is not ours to grow. Today that
 * is the navigation bar and nothing else. If this count climbs, the reflex has
 * spread to layouts that could simply have been allowed to reflow.
 */
const capSites = [
  'app/_layout.tsx',
  'components/TodayCards.tsx',
  'app/(tabs)/schedule/index.tsx',
  'app/(tabs)/onset/index.tsx',
]
  .flatMap(file => read(file).match(/maxFontSizeMultiplier/g) ?? []);

ok('the navigation bar caps its Cancel button', layout.includes('maxFontSizeMultiplier'));
ok('capping has not spread beyond the navigation bar', capSites.length === 1,
  `${capSites.length} call sites`);
ok('the cap leaves text meaningfully larger than default', MAX_TEXT_SCALE >= 2);

// ─── The fixed boxes that clipped ───────────────────────────────────────────

/*
 * "Work" needs about 33pt at 14pt semibold and the label box was pinned to 30,
 * so it wrapped to "Wor / k" on an iPad at the *default* setting — filed under
 * the large-text findings, present the whole time at 1x. A minimum aligns the
 * two tracks without capping what the word may take.
 */
const todayCards = read('components/TodayCards.tsx');
const paceLabel = /paceBarLabel: \{([^}]*)\}/.exec(todayCards)?.[1] ?? '';
const pacePct = /paceBarPct: \{([^}]*)\}/.exec(todayCards)?.[1] ?? '';

ok('the pace label found', paceLabel.length > 0);
ok('the pace label is a minimum, not a fixed width',
  paceLabel.includes('minWidth') && !/[^n]width:/i.test(paceLabel), paceLabel.trim());
ok('the pace percentage is a minimum, not a fixed width',
  pacePct.includes('minWidth') && !/[^n]width:/i.test(pacePct), pacePct.trim());

/* A 64pt calendar tile rendered AU/G · 1/0 · Mo/n. It has to be able to grow. */
const schedule = read('app/(tabs)/schedule/index.tsx');
ok('the date tile drops its fixed width at the accessibility sizes',
  /dateBlockStacked: \{[^}]*width: undefined/.test(schedule));
ok('the date tile only stacks when the text is large',
  /isLargeText && styles\.dateBlockStacked/.test(schedule));

/* Names and roles are what a crew list is for; truncating them is not a fallback. */
ok('the person row stops truncating once text is large',
  /numberOfLines=\{isLargeText \? undefined : 1\}/.test(todayCards));
ok('the person row drops its 45% cap when stacked',
  /personTextStacked: \{[^}]*maxWidth: undefined/.test(todayCards));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
