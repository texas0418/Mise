/**
 * scripts/test-contrast.ts
 *
 *   node --experimental-strip-types scripts/test-contrast.ts
 *
 * Every text-on-surface pair in the palette, measured against WCAG AA.
 *
 * Contrast is the one part of #47 that needs no judgement and no device: the
 * ratio is arithmetic, so it can be a build failure rather than a review note.
 * The palette shipped with `text.tertiary` at #6B6B6B failing AA on all six
 * surfaces — 3.72:1 at best, 2.69:1 on the input background behind 179
 * placeholders — and nothing caught it for the life of the project, because
 * nothing was looking.
 *
 * This is deliberately a *matrix* rather than a list of known-bad pairs. A new
 * surface or a new text colour is covered the moment it is added to
 * constants/colors.ts, which is the same reason test-cascade.ts reads the
 * table registry rather than naming tables.
 */
import { ratio, contrastRatio, parseColor, flatten, relativeLuminance, AA_NORMAL, AA_NON_TEXT } from '../utils/contrast.ts';
import Colors from '../constants/colors.ts';

let pass = 0;
let fail = 0;

function ok(label: string, condition: boolean, detail = '') {
  if (condition) { pass++; return; }
  fail++;
  console.log(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

// ─── The arithmetic itself ──────────────────────────────────────────────────
// Worth pinning: every assertion below is only as good as this.

ok('parses #RRGGBB', parseColor('#FFFFFF')?.r === 255);
ok('parses shorthand #RGB', parseColor('#FFF')?.g === 255);
ok('parses rgba', parseColor('rgba(200, 160, 74, 0.12)')?.a === 0.12);
ok('rejects nonsense', parseColor('not-a-colour') === null);
ok('white on black is 21:1', Math.round(contrastRatio('#FFFFFF', '#000000')!) === 21);
ok('a colour against itself is 1:1', Math.round(contrastRatio('#C8A04A', '#C8A04A')!) === 1);
ok('order does not matter', ratio('#FFFFFF', '#000000') === ratio('#000000', '#FFFFFF'));
ok('white luminance is 1', Math.round(relativeLuminance({ r: 255, g: 255, b: 255, a: 1 })) === 1);
ok('black luminance is 0', relativeLuminance({ r: 0, g: 0, b: 0, a: 1 }) === 0);

// Translucency must be composited or the ratio is a fiction: accent.goldBg is
// 12% gold, and read as opaque gold it would claim eight times its contrast.
const goldBgFlat = flatten(parseColor(Colors.accent.goldBg)!, parseColor(Colors.bg.primary)!);
ok('translucent colours composite', goldBgFlat.a === 1 && goldBgFlat.r < 60,
   `got r=${Math.round(goldBgFlat.r)}`);
ok('goldBg is a surface, not a text colour', ratio(Colors.accent.goldBg, Colors.bg.primary) < 2);

// ─── Text on every surface ──────────────────────────────────────────────────

const surfaces = Object.entries(Colors.bg);
const textColors = Object.entries(Colors.text).filter(([name]) => name !== 'inverse');

for (const [textName, textValue] of textColors) {
  for (const [bgName, bgValue] of surfaces) {
    const r = ratio(textValue, bgValue);
    ok(`text.${textName} on bg.${bgName}`, r >= AA_NORMAL, `${r}:1, needs ${AA_NORMAL}:1`);
  }
}

// text.inverse only ever sits on the gold accents — a filled button.
for (const accent of ['gold', 'goldLight'] as const) {
  const r = ratio(Colors.text.inverse, Colors.accent[accent]);
  ok(`text.inverse on accent.${accent}`, r >= AA_NORMAL, `${r}:1`);
}

// ─── Icons, indicators and borders ──────────────────────────────────────────
// WCAG 1.4.11: non-text content needs 3:1, not 4.5:1. These carry meaning as
// shapes and fills rather than as words.

const nonText = { ...Colors.status, gold: Colors.accent.gold, goldLight: Colors.accent.goldLight, goldDim: Colors.accent.goldDim };
for (const [name, value] of Object.entries(nonText)) {
  for (const [bgName, bgValue] of surfaces) {
    const r = ratio(value, bgValue);
    ok(`${name} icon on bg.${bgName}`, r >= AA_NON_TEXT, `${r}:1, needs ${AA_NON_TEXT}:1`);
  }
}

// accent.goldDim clears the non-text bar but not the text one, so it must not
// be used as a text colour. It was, once, on a 9px label.
ok('goldDim is below the text threshold, as expected',
   ratio(Colors.accent.goldDim, Colors.bg.primary) < AA_NORMAL);

// ─── The report ─────────────────────────────────────────────────────────────
// Printed on every run: the numbers are the point, not just the pass.

const pad = (s: string, n: number) => s.padStart(n);
console.log('\n  text on surface (AA normal = 4.5:1)');
console.log('  ' + pad('', 11) + surfaces.map(([n]) => pad(n, 10)).join(''));
for (const [textName, textValue] of textColors) {
  console.log('  ' + textName.padEnd(11) +
    surfaces.map(([, bg]) => pad(ratio(textValue, bg).toFixed(2), 10)).join(''));
}
console.log('');

if (fail > 0) console.log('');
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
