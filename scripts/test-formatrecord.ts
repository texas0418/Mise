/**
 * scripts/test-formatrecord.ts
 *
 *   node --experimental-strip-types scripts/test-formatrecord.ts
 *
 * The formatters that stand between a half-written record and the screen.
 *
 * #90 was a hard crash: `formatCurrency(undefined)` on a BudgetItem missing its
 * numbers took the entire Budget screen down to a redbox. The type said
 * `number`. The record disagreed, and TypeScript cannot see that far.
 *
 * The cases below are the shapes actually found in storage — a record holding
 * nothing but `id` and `projectId` — plus the ones a sync pull can produce.
 * Every formatter has to survive all of them, because the alternative is a
 * screen that does not render at all.
 */
import {
  money, count, text, toNumber, toDate,
  shortDate, weekdayDate, longDate, mediumDate, clockTime, MISSING,
} from '../utils/formatRecord.ts';

let pass = 0;
let fail = 0;

function ok(label: string, condition: boolean, detail = '') {
  if (condition) { pass++; return; }
  fail++;
  console.log(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

// The record shape that caused #90.
const stub = { id: 'mise_budget-p2', projectId: 'p2' } as Record<string, unknown>;

// ─── Money ──────────────────────────────────────────────────────────────────

ok('the #90 record no longer throws', money(stub.estimated) === MISSING);
ok('undefined is an em dash', money(undefined) === MISSING);
ok('null is an em dash', money(null) === MISSING);
ok('a blank string is an em dash', money('') === MISSING);
ok('NaN is an em dash', money(NaN) === MISSING);
ok('Infinity is an em dash', money(Infinity) === MISSING);
ok('a plain number formats', money(48000) === '$48,000');
ok('zero is a real amount, not a gap', money(0) === '$0');
ok('an overspend puts the sign outside', money(-2100) === '-$2,100');
ok('never the "$-" form', !money(-2100).includes('$-'));
ok('decimals round away', money(1234.56) === '$1,235');
// CSV import and the spreadsheet editor both hand over strings.
ok('a numeric string formats', money('1200') === '$1,200');
ok('a string with separators formats', money('$1,200') === '$1,200');
ok('a non-numeric string is an em dash', money('n/a') === MISSING);

// ─── Counts ─────────────────────────────────────────────────────────────────

ok('a count formats', count(1200) === '1,200');
ok('zero counts', count(0) === '0');
ok('a missing count is an em dash', count(undefined) === MISSING);

// ─── Dates ──────────────────────────────────────────────────────────────────

ok('the #90-shaped record has no date', shortDate(stub.createdAt) === MISSING);
ok('undefined is an em dash', shortDate(undefined) === MISSING);
ok('a blank string is an em dash', shortDate('') === MISSING);
ok('gibberish is an em dash, not "Invalid Date"', shortDate('not-a-date') === MISSING);
ok('never renders the word Invalid', !weekdayDate('nonsense').includes('Invalid'));
ok('an ISO timestamp formats', shortDate('2026-08-09T09:48:00') === 'Aug 9');
ok('a weekday format', weekdayDate('2026-08-09T12:00:00').startsWith('Sun'));
ok('a long format', longDate('2026-08-09T12:00:00') === 'August 9, 2026');
ok('a medium format', mediumDate('2026-08-09T12:00:00') === 'Aug 9, 2026');
ok('a Date instance passes through', shortDate(new Date('2026-08-09T12:00:00')) === 'Aug 9');
ok('an invalid Date instance is an em dash', shortDate(new Date('nope')) === MISSING);

// A bare YYYY-MM-DD parsed as UTC midnight lands on the previous day for
// anyone west of Greenwich — the same trap as toISOString().slice(0,10).
ok('a bare date keeps its own day', shortDate('2026-08-09') === 'Aug 9',
   `got ${shortDate('2026-08-09')} in ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
ok('a bare date is not the day before', !shortDate('2026-01-01').includes('Dec'));

// ─── Clock ──────────────────────────────────────────────────────────────────

ok('a timestamp gives a clock reading', /\d:\d/.test(clockTime('2026-08-09T09:48:00')));
ok('a missing timestamp is an em dash', clockTime(undefined) === MISSING);
ok('gibberish gives no clock reading', clockTime('half past') === MISSING);

// ─── Text ───────────────────────────────────────────────────────────────────

ok('text passes through trimmed', text('  soft focus ') === 'soft focus');
ok('blank text is an em dash', text('   ') === MISSING);
ok('missing text is an em dash', text(undefined) === MISSING);

// ─── The primitives ─────────────────────────────────────────────────────────

ok('toNumber rejects nonsense', toNumber('abc') === null);
ok('toNumber keeps zero', toNumber(0) === 0);
ok('toDate rejects nonsense', toDate('abc') === null);
ok('toDate rejects an invalid Date', toDate(new Date('x')) === null);

// No *derived* formatter may emit these, whatever it is handed.
//
// `text` is excluded deliberately: it is a verbatim passthrough for content a
// person typed, and a note that genuinely reads "NaN" should render as written.
// Censoring user content to protect a test would be the worse bug.
const derivedFormatters = [money, count, shortDate, weekdayDate, longDate, mediumDate, clockTime];
const nastyInputs: unknown[] = [undefined, null, '', '   ', NaN, Infinity, -Infinity, 'Invalid Date', {}, [], true];
let leaked = '';
for (const format of derivedFormatters) {
  for (const input of nastyInputs) {
    const out = format(input);
    if (/Invalid|undefined|NaN/.test(out)) leaked = `${format.name}(${String(input)}) = ${out}`;
  }
}
ok('no derived formatter ever emits Invalid, undefined or NaN', leaked === '', leaked);
ok('text passes a literal through untouched', text('Invalid Date') === 'Invalid Date');

// ─── The source ─────────────────────────────────────────────────────────────
//
// Structural, for the same reason test-cascade.ts is: the guarded versions only
// stay guarded while someone remembers. Formatting a record field directly is
// how #90 happened, and it is invisible until a record turns up without it.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith('.tsx')) out.push(full);
  }
  return out;
}

const offences: string[] = [];
for (const file of [...walk('app'), ...walk('components')]) {
  const source = readFileSync(file, 'utf8');
  source.split('\n').forEach((line, i) => {
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;

    // `new Date(<something>).toLocale…` — safe only when the something is the
    // current time, which cannot be invalid.
    const dated = /new Date\(([^)]*)\)\s*\.\s*toLocale/.exec(line);
    if (dated && dated[1].trim().length > 0) {
      offences.push(`${file}:${i + 1}  ${line.trim().slice(0, 80)}`);
    }

    // `<record>.<field>.toLocaleString()` — the #90 shape exactly.
    if (/\w+\.\w+\.toLocaleString\(/.test(line)) {
      offences.push(`${file}:${i + 1}  ${line.trim().slice(0, 80)}`);
    }
  });
}

if (offences.length === 0) {
  pass++;
} else {
  fail++;
  console.log(`FAIL ${offences.length} record field(s) formatted without a guard:`);
  for (const o of offences) console.log(`       ${o}`);
  console.log('       Use utils/formatRecord.ts — money, dateWith, timeWith, clockTime.');
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
