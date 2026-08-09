/**
 * scripts/test-typography.ts
 *
 *   node --experimental-strip-types scripts/test-typography.ts
 *
 * The type scale's arithmetic, across the range of system text sizes a reader
 * can actually select — iOS runs from roughly 0.82x to 3.1x.
 *
 * The interesting cases are the ends. At the small end the floor has to win,
 * or the accessibility fix reintroduces the 9px labels it was meant to remove.
 * At the large end the multiplier ceiling has to hold for constrained layouts
 * while unconstrained text keeps growing — those two behaviours share a
 * function, so it is easy to change one and silently change the other.
 */
import {
  scaleFont, scaleOnSetFont, lineHeightFor,
  MIN_SIZE, MIN_ONSET_SIZE, MAX_SCALE, MIN_SCALE, TYPE,
} from '../utils/typography.ts';

let pass = 0;
let fail = 0;

function ok(label: string, condition: boolean, detail = '') {
  if (condition) { pass++; return; }
  fail++;
  console.log(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

// ─── The floor ──────────────────────────────────────────────────────────────
// The whole point of #47's "raise the floor to 12px": a 9px label is 12px at
// the default setting, not 9px until somebody goes looking for a menu.

ok('a 9px label becomes the floor at 1x', scaleFont(9, 1) === MIN_SIZE, `${scaleFont(9, 1)}`);
ok('an 8px label becomes the floor', scaleFont(8, 1) === MIN_SIZE);
ok('a 10px label becomes the floor', scaleFont(10, 1) === MIN_SIZE);
ok('an 11px label becomes the floor', scaleFont(11, 1) === MIN_SIZE);
ok('a 12px label is untouched at 1x', scaleFont(12, 1) === 12);
ok('a 16px size is untouched at 1x', scaleFont(16, 1) === 16);

// The floor applies before scaling, so a tiny base grows with everything else
// rather than being pinned at the floor forever.
ok('a floored size still scales up', scaleFont(9, 1.5) === 18, `${scaleFont(9, 1.5)}`);
ok('a floored size scales with the rest', scaleFont(9, 2) === 24);

// ─── The on-set floor ───────────────────────────────────────────────────────

ok('on set, 12px is raised to 14', scaleOnSetFont(12, 1) === MIN_ONSET_SIZE);
ok('on set, 9px is raised to 14', scaleOnSetFont(9, 1) === MIN_ONSET_SIZE);
ok('on set, 16px is left alone', scaleOnSetFont(16, 1) === 16);
ok('on set floor is above the general floor', MIN_ONSET_SIZE > MIN_SIZE);
ok('on set still scales', scaleOnSetFont(14, 2) === 28);

// ─── Smaller text settings ──────────────────────────────────────────────────
// A reader who prefers smaller text is honoured, but not past the floor —
// which is the case that would quietly undo the whole fix.

ok('a small setting never breaches the floor', scaleFont(12, 0.5) === MIN_SIZE, `${scaleFont(12, 0.5)}`);
ok('a small setting never breaches the on-set floor', scaleOnSetFont(20, 0.5) >= MIN_ONSET_SIZE);
ok('the scale itself is clamped below', scaleFont(40, 0.1) === Math.round(40 * MIN_SCALE));
ok('large text is still smaller when asked', scaleFont(40, 0.9) < 40);

// ─── The ceiling ────────────────────────────────────────────────────────────

ok('the multiplier is capped for constrained layouts', scaleFont(16, 3.1) === 16 * MAX_SCALE,
   `${scaleFont(16, 3.1)}`);
ok('at the cap exactly', scaleFont(16, MAX_SCALE) === 32);
ok('unconstrained text opts out and keeps growing',
   scaleFont(16, 3, { maxScale: Infinity }) === 48, `${scaleFont(16, 3, { maxScale: Infinity })}`);
ok('opting out still respects the floor', scaleFont(9, 1, { maxScale: Infinity }) === MIN_SIZE);
ok('a custom floor is honoured', scaleFont(10, 1, { floor: 18 }) === 18);

// ─── Nonsense in ────────────────────────────────────────────────────────────
// A missing fontScale must not collapse the type to zero.

ok('NaN scale falls back to 1x', scaleFont(16, NaN) === 16);
// Infinity is treated as absent rather than as "as large as possible": a
// garbled scale should render the default, not the largest thing on offer.
ok('Infinity scale falls back to 1x', scaleFont(16, Infinity) === 16);
ok('undefined scale falls back', scaleFont(16, undefined as unknown as number) === 16);
ok('NaN base falls back to the floor', scaleFont(NaN, 1) === MIN_SIZE);

// ─── Monotonic ──────────────────────────────────────────────────────────────
// Bigger setting is never smaller text, and a bigger base is never smaller
// than a smaller one at the same setting. Both are easy to break with rounding.

let monotonicScale = true;
for (let s = MIN_SCALE; s <= 3.1; s += 0.05) {
  if (scaleFont(16, s) > scaleFont(16, s + 0.05)) monotonicScale = false;
}
ok('text never shrinks as the setting grows', monotonicScale);

let monotonicBase = true;
for (let base = 8; base < 40; base++) {
  if (scaleFont(base, 1.4) > scaleFont(base + 1, 1.4)) monotonicBase = false;
}
ok('a bigger base is never smaller', monotonicBase);

// ─── Line height ────────────────────────────────────────────────────────────
// Large type that clips against its own next line reads as a rendering bug,
// so it does not get reported as an accessibility one.

ok('line height exceeds the size', lineHeightFor(16) > 16);
ok('line height takes a ratio', lineHeightFor(20, 1.5) === 30);
// Proportional to within rounding — not exactly double, since 16 and 32 round
// in opposite directions (22 and 43, not 22 and 44).
ok('line height grows with the size', lineHeightFor(32) > lineHeightFor(16));
ok('line height stays proportional', Math.abs(lineHeightFor(32) - 2 * lineHeightFor(16)) <= 1);
let clearsAtEverySize = true;
for (let size = MIN_SIZE; size <= 64; size++) {
  if (lineHeightFor(size) <= size) clearsAtEverySize = false;
}
ok('line height clears the size at every step', clearsAtEverySize);

// ─── The named steps ────────────────────────────────────────────────────────

const steps = Object.entries(TYPE);
ok('every named step is at or above the floor', steps.every(([, v]) => v >= MIN_SIZE),
   steps.filter(([, v]) => v < MIN_SIZE).map(([k]) => k).join(', '));

let ascending = true;
for (let i = 1; i < steps.length; i++) {
  if (steps[i][1] <= steps[i - 1][1]) ascending = false;
}
ok('the steps ascend', ascending);
ok('there is a step at the floor', steps.some(([, v]) => v === MIN_SIZE));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
