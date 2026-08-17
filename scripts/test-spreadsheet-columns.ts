/**
 * scripts/test-spreadsheet-columns.ts
 *
 * Assertions for the budget spreadsheet's column widths.
 *
 *   node --experimental-strip-types scripts/test-spreadsheet-columns.ts
 *
 * The grid used fixed pixel columns totalling 796px inside a horizontal
 * scroller. That is right on a phone and was wrong on a desk: on a 1440px
 * browser the table stopped at 796px and left the rest of the window empty,
 * which is the opposite of the reason to open a budget on a laptop (#120).
 *
 * `app/budget-spreadsheet.tsx` cannot be imported here — it is JSX and pulls
 * in React Native through the `@/` alias — so this is a structural test in the
 * same spirit as the `isSyncEnabled` check in test-entitlement.ts. The risk is
 * not that the arithmetic is subtly wrong; it is that somebody later restores
 * a constant width and nothing notices until a customer opens a laptop.
 *
 * Two specific regressions are guarded, both of which were live during this
 * fix and neither of which announces itself:
 *
 *  1. Measuring the horizontal ScrollView with onLayout. It reports its
 *     *content* width, which is set by the column widths, which would then be
 *     derived from it — a loop that settles at the base width and looks like
 *     nothing happened.
 *  2. Reintroducing a module-level total, so the grid stops tracking width.
 */
import { readFileSync } from 'node:fs';

const SRC = 'app/budget-spreadsheet.tsx';
const src = readFileSync(SRC, 'utf8');

let pass = 0;
let fail = 0;

function ok(label: string, condition: boolean, detail = '') {
  if (condition) { pass++; return; }
  fail++;
  console.log(`FAIL ${label}${detail ? `\n  ${detail}` : ''}`);
}

// --- the columns must be derived, not fixed ---------------------------------

ok('columns are computed from a width',
  /export function columnsFor\(/.test(src),
  'columnsFor() is what turns available width into column widths');

ok('the grid reads contentWidth from useLayout',
  /useLayout\(\)/.test(src) && /contentWidth/.test(src),
  'width must come from the same primitive the other screens use, not a constant');

ok('columnsFor feeds the rendered columns',
  /columnsFor\(contentWidth\)/.test(src),
  'if this stops being wired the table silently returns to 796px');

// --- the specific mistakes that were made and corrected ---------------------

ok('the horizontal ScrollView is not measured with onLayout',
  !/horizontal[\s\S]{0,200}onLayout/.test(src),
  'a horizontal ScrollView reports its content width; deriving columns from that '
  + 'is a loop that settles at the base width and looks like the fix never applied');

ok('no module-level total width constant',
  !/const TOTAL_WIDTH\s*=/.test(src),
  'a fixed total is what pinned the grid to 796px in the first place');

// --- the shape of the widening -----------------------------------------------
// Numeric columns hold currency and do not need more room. Surplus goes to the
// two columns that actually run out: a line item description and a vendor name.

ok('surplus is shared between description and vendor',
  /DESCRIPTION_SHARE/.test(src) && /vendor: BASE_COL\.vendor \+/.test(src),
  'widening only the description column leaves vendor truncated at any width');

ok('numeric columns are not widened',
  !/estimated: BASE_COL\.estimated \+/.test(src)
  && !/actual: BASE_COL\.actual \+/.test(src)
  && !/variance: BASE_COL\.variance \+/.test(src),
  'a currency figure gains nothing from a wider column');

ok('growth is capped',
  /MAX_GRID_WIDTH/.test(src),
  'uncapped, a maximised window on a large display produces a description column '
  + 'harder to read across than the cramped one it replaced');

// --- the base widths remain the phone floor ---------------------------------

ok('base columns are still declared',
  /const BASE_COL = \{/.test(src),
  'the phone widths are the floor; a narrow viewport must still scroll sideways');

ok('rows receive columns rather than reading a constant',
  /cols: Cols;/.test(src) && /cols=\{cols\}/.test(src),
  'row components must render the computed widths, not the base ones');

console.log(`${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
