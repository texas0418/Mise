/**
 * scripts/test-datetime-fields.ts
 *
 *   node --experimental-strip-types scripts/test-datetime-fields.ts
 *
 * What the pickers write is exactly what the app reads.
 *
 * ## The risk this covers
 *
 * `components/DateTimeField.tsx` replaced 20 free-text date and time inputs.
 * The dangerous way to do that is to let the picker emit its own format — a
 * `Date`, an ISO timestamp, a locale string — because the form would look
 * perfect while the call sheet, the Today view and every record already in a
 * user's storage silently stopped parsing. Mise is live; those records exist.
 *
 * So the fields deliberately round-trip through the functions the app already
 * owns, and this suite pins that down as a property rather than as examples:
 *
 *   time  `formatClock` writes  →  `parseClockTime` reads   (utils/today.ts)
 *   date  `localDateKey` writes →  `toDate` reads           (utils/formatRecord.ts)
 *
 * Every minute of the day and a spread of dates are checked, not a handful,
 * because the failures here are at the edges: midnight, noon, the 12/0 hour
 * flip, and the days a clock changes.
 *
 * ## Why the date half is not `toISOString().slice(0, 10)`
 *
 * That is a day out for anyone west of Greenwich for part of every day, which
 * is the bug `localDateKey` was written to avoid and #90 was written to survive.
 * Asserting the picker uses the local-fields path is the point, so the test
 * compares against local calendar fields, never UTC ones.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseClockTime, formatClock, localDateKey } from '../utils/today.ts';
import { toDate } from '../utils/formatRecord.ts';

const root = join(import.meta.dirname, '..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

let pass = 0;
let fail = 0;

function ok(label: string, condition: boolean, detail = '') {
  if (condition) { pass++; return; }
  fail++;
  console.log(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

// ─── Times: every minute of the day survives the trip ───────────────────────

let timeRoundTrips = 0;
let firstTimeFailure = '';
for (let minutes = 0; minutes < 24 * 60; minutes++) {
  const written = formatClock(minutes);
  const readBack = parseClockTime(written);
  if (readBack === minutes) { timeRoundTrips++; continue; }
  if (!firstTimeFailure) firstTimeFailure = `${minutes} → "${written}" → ${readBack}`;
}
ok('every minute of the day round-trips', timeRoundTrips === 1440,
  firstTimeFailure || `${timeRoundTrips}/1440`);

/* The hours that are their own special case in a 12-hour clock. */
ok('midnight writes as 12:00 AM', formatClock(0) === '12:00 AM');
ok('noon writes as 12:00 PM', formatClock(12 * 60) === '12:00 PM');
ok('one minute to noon is still AM', formatClock(11 * 60 + 59) === '11:59 AM');
ok('one minute past noon is PM', formatClock(12 * 60 + 1) === '12:01 PM');
ok('the last minute of the day', formatClock(23 * 60 + 59) === '11:59 PM');

/*
 * The field builds its written value from a picked Date's local hours and
 * minutes. That is the same arithmetic, so it must agree.
 */
const asPicked = (hours: number, mins: number) => {
  const d = new Date(2026, 7, 10, hours, mins, 0, 0);
  return formatClock(d.getHours() * 60 + d.getMinutes());
};
ok('a picked 7:00 writes the call sheet shape', asPicked(7, 0) === '7:00 AM');
ok('a picked 18:00 writes as 6:00 PM', asPicked(18, 0) === '6:00 PM');
ok('a picked 00:30 writes as 12:30 AM', asPicked(0, 30) === '12:30 AM');

/* The shapes already sitting in users' storage still read. Nothing regressed. */
ok('the existing "7:00 AM" still parses', parseClockTime('7:00 AM') === 7 * 60);
ok('the abbreviated "0700" still parses', parseClockTime('0700') === 7 * 60);
ok('24-hour "17:30" still parses', parseClockTime('17:30') === 17 * 60 + 30);
ok('junk is still rejected rather than guessed', parseClockTime('whenever') === null);
ok('an empty time is null, not zero', parseClockTime('') === null);

// ─── Dates: local calendar fields, never UTC ────────────────────────────────

let dateRoundTrips = 0;
let dateChecked = 0;
let firstDateFailure = '';
for (let dayOffset = 0; dayOffset < 400; dayOffset++) {
  const original = new Date(2026, 0, 1 + dayOffset, 9, 30, 0, 0);
  const written = localDateKey(original);
  const readBack = toDate(written);
  dateChecked++;
  const sameDay = readBack !== null
    && readBack.getFullYear() === original.getFullYear()
    && readBack.getMonth() === original.getMonth()
    && readBack.getDate() === original.getDate();
  if (sameDay) { dateRoundTrips++; continue; }
  if (!firstDateFailure) firstDateFailure = `${original.toDateString()} → "${written}" → ${readBack}`;
}
ok('400 consecutive days round-trip to the same local day',
  dateRoundTrips === dateChecked, firstDateFailure || `${dateRoundTrips}/${dateChecked}`);

ok('the written shape is YYYY-MM-DD', /^\d{4}-\d{2}-\d{2}$/.test(localDateKey(new Date(2026, 7, 10))));
ok('single-digit months and days are padded', localDateKey(new Date(2026, 0, 5)) === '2026-01-05');

/*
 * A date picked at any hour must write the day the user saw. Reading the
 * picked Date in UTC would move late evenings west of Greenwich onto tomorrow
 * and early mornings east of it onto yesterday, so both ends are checked.
 */
const day = new Date(2026, 7, 10);
ok('a date picked just after midnight writes that day',
  localDateKey(new Date(2026, 7, 10, 0, 1)) === localDateKey(day));
ok('a date picked just before midnight writes that day',
  localDateKey(new Date(2026, 7, 10, 23, 59)) === localDateKey(day));

/* Clock-change days: the stored date is anchored at midday to survive them. */
for (const [label, d] of [
  ['spring forward', new Date(2026, 2, 8, 3, 0)],
  ['fall back', new Date(2026, 10, 1, 1, 0)],
] as const) {
  const readBack = toDate(localDateKey(d));
  ok(`${label} keeps its calendar day`, readBack !== null && readBack.getDate() === d.getDate());
}

ok('an unreadable stored date is still rejected', toDate('not a date') === null);
ok('an empty stored date is still null', toDate('') === null);

// ─── The free-text inputs are actually gone ─────────────────────────────────

/*
 * A ratchet, not a formality. The reason to replace these was that free text
 * on a QWERTY is what produced the unparseable values #90 defends against, and
 * a new form written from an old one as a template puts a `YYYY-MM-DD`
 * TextInput straight back.
 */
const WIRED = [
  'app/new-schedule-day.tsx',
  'app/new-time-entry.tsx',
  'app/new-wrap-report.tsx',
  'app/new-festival.tsx',
  'app/new-vfx.tsx',
  'app/new-script-side.tsx',
  'app/call-sheet-details.tsx',
  'app/call-sheets.tsx',
];

let fields = 0;
for (const file of WIRED) {
  const source = read(file);
  ok(`${file} uses the picker`, /from '@\/components\/DateTimeField'/.test(source));
  ok(`${file} has no YYYY-MM-DD text input left`, !source.includes('placeholder="YYYY-MM-DD"'));
  fields += (source.match(/<(Date|Time|CompactTime)Field/g) ?? []).length;
}
/*
 * 17 call sites, which render 20 fields. Two of them are data-driven and so
 * appear once in the source: the meal times on call-sheet-details come from a
 * field list, and the two on call-sheets are inside `.map`s over the cast and
 * crew, one cell per person.
 *
 * The handoff estimated "17 inputs across 10 screens". It is 20 across 8 —
 * four of them the per-person call times on a call sheet, which are table
 * cells rather than form fields and are easy to miss counting from the forms.
 */
ok('every date and time call site is a picker', fields === 17, `${fields} found`);

/* The stored shape is the app's, not the picker library's. */
const field = read('components/DateTimeField.tsx');
ok('the date field writes through localDateKey', field.includes('localDateKey(picked)'));
ok('the time field writes through formatClock', field.includes('formatClock(picked.getHours()'));
/*
 * Comments stripped first. The module comment names `toISOString` in order to
 * explain why it is the wrong call, so a plain grep flags the explanation as
 * the offence.
 */
const fieldCode = field.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
ok('nothing writes a raw ISO string', !fieldCode.includes('toISOString'));
ok('the field reads with the guarded parsers',
  field.includes('toDate(value)') && field.includes('parseClockTime(value)'));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
