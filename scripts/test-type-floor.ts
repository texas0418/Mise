/**
 * scripts/test-type-floor.ts
 *
 *   node --experimental-strip-types scripts/test-type-floor.ts
 *
 * No font size in the app may be written below the floor.
 *
 * This is app-wide rather than a ratchet, because unlike labels it is purely
 * mechanical: there is no screen where 9px is the right answer, so there is
 * nothing to opt out of and no reason to phase it.
 *
 * The point that took a while to establish, and that #47 gets wrong: React
 * Native's `<Text>` already scales with Dynamic Type — `allowFontScaling`
 * defaults to true. The app was never failing to scale. It was scaling from
 * bases too small to be worth scaling, and 270 of them sat below 12px. Raising
 * the base is the whole fix; multiplying by fontScale on top would scale twice.
 *
 * Every numeric literal in a fontSize expression is checked, not just the plain
 * `fontSize: 10` form — the smallest text in the app was
 * `fontSize: isTablet ? 14 : 10` on the tab bar, which a simpler pattern misses.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { MIN_SIZE, MIN_ONSET_SIZE, floorFont, scaleNonText, TYPE, MAX_NON_TEXT_SCALE } from '../utils/typography.ts';

/** Surfaces read at arm's length, in the dark, on a rig. */
const ONSET_SURFACES = [
  'app/(tabs)/onset/index.tsx',
  'app/(tabs)/(today)/index.tsx',
  'app/log-take.tsx',
  'app/shot-checklist.tsx',
  'components/TodayCards.tsx',
];

let pass = 0;
let fail = 0;

function ok(label: string, condition: boolean, detail = '') {
  if (condition) { pass++; return; }
  fail++;
  console.log(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

// ─── The helpers ────────────────────────────────────────────────────────────

ok('a 9px base is raised to the floor', floorFont(9) === MIN_SIZE);
ok('an 11px base is raised to the floor', floorFont(11) === MIN_SIZE);
ok('a 12px base is untouched', floorFont(12) === 12);
ok('a 16px base is untouched', floorFont(16) === 16);
ok('on set, 12px is raised to 14', floorFont(12, true) === MIN_ONSET_SIZE);
ok('on set, 16px is untouched', floorFont(16, true) === 16);
ok('the on-set floor is higher', MIN_ONSET_SIZE > MIN_SIZE);
ok('a nonsense base falls back to the floor', floorFont(NaN) === MIN_SIZE);
ok('floorFont never scales', floorFont(20) === 20);

// Non-text scaling is the only place a multiplier is correct.
ok('an icon grows with the setting', scaleNonText(20, 1.5) === 30);
ok('icon growth is clamped', scaleNonText(20, 3.1) === Math.round(20 * MAX_NON_TEXT_SCALE));
ok('an icon never shrinks below 1x', scaleNonText(20, 0.5) === 20);
ok('a nonsense scale is 1x', scaleNonText(20, NaN) === 20);

const steps = Object.entries(TYPE);
ok('every named step clears the floor', steps.every(([, v]) => v >= MIN_SIZE),
   steps.filter(([, v]) => v < MIN_SIZE).map(([k]) => k).join(', '));
let ascending = true;
for (let i = 1; i < steps.length; i++) if (steps[i][1] <= steps[i - 1][1]) ascending = false;
ok('the steps ascend', ascending);

// ─── The source ─────────────────────────────────────────────────────────────

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith('.tsx') || full.endsWith('.ts')) out.push(full);
  }
  return out;
}

interface Offence { file: string; line: number; size: number; floor: number; text: string }

const offences: Offence[] = [];
let declarations = 0;

for (const file of [...walk('app'), ...walk('components')]) {
  const source = readFileSync(file, 'utf8');
  const floor = ONSET_SURFACES.includes(file) ? MIN_ONSET_SIZE : MIN_SIZE;

  // Take the whole expression up to the line end or the next property, then
  // read every number out of it. Catches `fontSize: 10` and the ternary form.
  const pattern = /fontSize:\s*([^,\n}]+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    declarations++;
    const numbers = (match[1].match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
    for (const size of numbers) {
      if (size >= floor) continue;
      offences.push({
        file,
        line: source.slice(0, match.index).split('\n').length,
        size, floor,
        text: match[0].trim(),
      });
    }
  }
}

if (offences.length === 0) {
  pass++;
} else {
  fail++;
  console.log(`FAIL ${offences.length} font size(s) below the floor:`);
  for (const o of offences) {
    console.log(`       ${o.file}:${o.line}  ${o.text}  (floor ${o.floor})`);
  }
}

// A pattern that matches nothing would pass silently, which is the expensive
// way for this to be wrong.
ok('the scan found font sizes at all', declarations > 100, `${declarations} found`);
ok('the on-set surfaces all exist',
   ONSET_SURFACES.every(f => { try { return statSync(f).isFile(); } catch { return false; } }),
   ONSET_SURFACES.filter(f => { try { statSync(f); return false; } catch { return true; } }).join(', '));

console.log(`\n  ${declarations} font size declarations, floor ${MIN_SIZE} (${MIN_ONSET_SIZE} on set)\n`);
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
