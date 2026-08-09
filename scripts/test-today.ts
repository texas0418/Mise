/**
 * scripts/test-today.ts
 *
 * Assertions for utils/today.ts — the date, clock and pace arithmetic behind
 * the Today view. Run it from the repo root:
 *
 *   node --experimental-strip-types scripts/test-today.ts
 *
 * Worth running under a few zones, since the whole point of localDateKey is
 * that it does not agree with UTC:
 *
 *   for tz in UTC America/New_York Asia/Tokyo Pacific/Kiritimati; do
 *     TZ=$tz node --experimental-strip-types scripts/test-today.ts | tail -1
 *   done
 *
 * No test runner: utils/today.ts imports nothing, which is what lets node
 * execute it directly. Exits non-zero on the first failing count.
 */
import {
  localDateKey, localMinutes, daysBetweenKeys,
  parseClockTime, formatClock, formatDuration,
  pickShootDay, resolveCurrentDay, dayProgress,
  scenesForDay, shotsForScenes, summarizeWork, castCalledFor, computePace, totalDayCount,
} from '../utils/today.ts';

let pass = 0;
let fail = 0;

function eq(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { pass++; return; }
  fail++;
  console.log(`FAIL ${label}\n  expected ${e}\n  actual   ${a}`);
}

function near(label: string, actual: number, expected: number, tol = 1e-9) {
  if (Math.abs(actual - expected) <= tol) { pass++; return; }
  fail++;
  console.log(`FAIL ${label}\n  expected ~${expected}\n  actual    ${actual}`);
}

console.log(`TZ=${Intl.DateTimeFormat().resolvedOptions().timeZone}`);

// --- localDateKey: the UTC trap -------------------------------------------
const evening = new Date(2026, 7, 9, 20, 30); // 9 Aug 2026, 8:30pm local
eq('localDateKey evening does not roll over', localDateKey(evening), '2026-08-09');
console.log(`  (toISOString would have said ${evening.toISOString().slice(0, 10)})`);
eq('localDateKey just before midnight', localDateKey(new Date(2026, 7, 9, 23, 59)), '2026-08-09');
eq('localDateKey just after midnight', localDateKey(new Date(2026, 7, 10, 0, 1)), '2026-08-10');
eq('localDateKey pads', localDateKey(new Date(2026, 0, 5, 12, 0)), '2026-01-05');
eq('localMinutes', localMinutes(new Date(2026, 7, 9, 13, 45)), 825);

// --- daysBetweenKeys -------------------------------------------------------
eq('daysBetween same', daysBetweenKeys('2026-08-09', '2026-08-09'), 0);
eq('daysBetween forward', daysBetweenKeys('2026-08-09', '2026-08-14'), 5);
eq('daysBetween back', daysBetweenKeys('2026-08-09', '2026-08-07'), -2);
eq('daysBetween across month', daysBetweenKeys('2026-08-30', '2026-09-02'), 3);
// DST: 8 Mar 2026 is the US spring-forward. A naive ms/86400000 gives 0.958.
eq('daysBetween across DST', daysBetweenKeys('2026-03-07', '2026-03-09'), 2);
eq('daysBetween garbage', daysBetweenKeys('nope', '2026-08-09'), 0);

// --- parseClockTime --------------------------------------------------------
eq('parse 7:00 AM', parseClockTime('7:00 AM'), 420);
eq('parse 7:00am', parseClockTime('7:00am'), 420);
eq('parse 7 AM', parseClockTime('7 AM'), 420);
eq('parse 7a', parseClockTime('7a'), 420);
eq('parse 5:30p', parseClockTime('5:30p'), 1050);
eq('parse 5:30 P.M.', parseClockTime('5:30 P.M.'), 1050);
eq('parse 17:30', parseClockTime('17:30'), 1050);
eq('parse 0700', parseClockTime('0700'), 420);
eq('parse 700', parseClockTime('700'), 420);
eq('parse 1830', parseClockTime('1830'), 1110);
eq('parse 12:00 AM is midnight', parseClockTime('12:00 AM'), 0);
eq('parse 12:30 PM is midday', parseClockTime('12:30 PM'), 750);
eq('parse 12:00 PM', parseClockTime('12:00 PM'), 720);
eq('parse padded whitespace', parseClockTime('  6:45 am '), 405);
eq('parse empty', parseClockTime(''), null);
eq('parse null', parseClockTime(null), null);
eq('parse word', parseClockTime('call'), null);
eq('parse 25:00', parseClockTime('25:00'), null);
eq('parse 7:99', parseClockTime('7:99'), null);
eq('parse 13:00 PM', parseClockTime('13:00 PM'), null);
eq('parse 0:00 AM', parseClockTime('0:00 AM'), null);

// --- formatClock / formatDuration -----------------------------------------
eq('format 420', formatClock(420), '7:00 AM');
eq('format 0', formatClock(0), '12:00 AM');
eq('format 750', formatClock(750), '12:30 PM');
eq('format 1439', formatClock(1439), '11:59 PM');
eq('format wraps past midnight', formatClock(1500), '1:00 AM');
eq('format negative wraps', formatClock(-60), '11:00 PM');
eq('duration 200', formatDuration(200), '3h 20m');
eq('duration 45', formatDuration(45), '45m');
eq('duration 120', formatDuration(120), '2h');
eq('duration 0', formatDuration(0), '0m');
eq('duration negative', formatDuration(-5), '0m');

// --- pickShootDay ----------------------------------------------------------
const days = [
  { id: 'd1', date: '2026-08-05', dayNumber: 1, callTime: '7:00 AM', wrapTime: '7:00 PM' },
  { id: 'd3', date: '2026-08-12', dayNumber: 3, callTime: '6:00 AM', wrapTime: '6:00 PM' },
  { id: 'd2', date: '2026-08-09', dayNumber: 2, callTime: '7:00 AM', wrapTime: '7:00 PM' },
];
eq('pick today', pickShootDay(days, '2026-08-09').day?.id, 'd2');
eq('pick today relation', pickShootDay(days, '2026-08-09').relation, 'today');
eq('pick upcoming', pickShootDay(days, '2026-08-10').day?.id, 'd3');
eq('pick upcoming relation', pickShootDay(days, '2026-08-10').relation, 'upcoming');
eq('pick upcoming daysAway', pickShootDay(days, '2026-08-10').daysAway, 2);
eq('pick wrapped', pickShootDay(days, '2026-08-20').day?.id, 'd3');
eq('pick wrapped relation', pickShootDay(days, '2026-08-20').relation, 'wrapped');
eq('pick wrapped daysAway', pickShootDay(days, '2026-08-20').daysAway, -8);
eq('pick before first', pickShootDay(days, '2026-08-01').day?.id, 'd1');
eq('pick empty', pickShootDay([], '2026-08-09').relation, 'none');
eq('pick all-garbage dates', pickShootDay([{ id: 'x', date: '', dayNumber: 1 }], '2026-08-09').relation, 'none');

// --- totalDayCount ---------------------------------------------------------
eq('totalDayCount full schedule', totalDayCount(days), 3);
// Day 2 deleted: two records, but the shoot still runs to day 3.
eq('totalDayCount with a gap', totalDayCount(days.filter(d => d.dayNumber !== 2)), 3);
eq('totalDayCount empty', totalDayCount([]), 0);
eq('totalDayCount unnumbered falls back to the count', totalDayCount([
  { id: 'a', date: '2026-08-01', dayNumber: 0 },
  { id: 'b', date: '2026-08-02', dayNumber: 0 },
]), 2);

// --- resolveCurrentDay: night shoots --------------------------------------
const nightDays = [
  { id: 'n1', date: '2026-08-08', dayNumber: 1, callTime: '6:00 PM', wrapTime: '4:00 AM' },
  { id: 'n2', date: '2026-08-10', dayNumber: 2, callTime: '6:00 PM', wrapTime: '4:00 AM' },
];
const at1am = new Date(2026, 7, 9, 1, 0);
eq('night shoot still today at 1am', resolveCurrentDay(nightDays, at1am).day?.id, 'n1');
eq('night shoot relation at 1am', resolveCurrentDay(nightDays, at1am).relation, 'today');
const at5am = new Date(2026, 7, 9, 5, 0);
eq('after wrap it is not today', resolveCurrentDay(nightDays, at5am).day?.id, 'n2');
eq('after wrap relation', resolveCurrentDay(nightDays, at5am).relation, 'upcoming');
// A normal day yesterday must not be dragged into today.
const dayDays = [{ id: 'p1', date: '2026-08-08', dayNumber: 1, callTime: '7:00 AM', wrapTime: '7:00 PM' }];
eq('yesterday day-shoot is wrapped', resolveCurrentDay(dayDays, at1am).relation, 'wrapped');
// A day dated today always wins outright.
const bothDays = [...nightDays, { id: 'n3', date: '2026-08-09', dayNumber: 9, callTime: '7:00 AM', wrapTime: '7:00 PM' }];
eq('today beats the overnight carry-over', resolveCurrentDay(bothDays, at1am).day?.id, 'n3');

// --- dayProgress -----------------------------------------------------------
const mid = dayProgress(420, 1140, 780); // 7am-7pm, now 1pm
eq('progress phase', mid.phase, 'shooting');
eq('progress elapsed', mid.elapsedMinutes, 360);
eq('progress remaining', mid.remainingMinutes, 360);
eq('progress total', mid.totalMinutes, 720);
near('progress fraction', mid.fraction, 0.5);

const early = dayProgress(420, 1140, 360); // 6am
eq('before call phase', early.phase, 'before-call');
eq('before call untilCall', early.untilCallMinutes, 60);
eq('before call fraction', early.fraction, 0);

const late = dayProgress(420, 1140, 1300);
eq('wrapped phase', late.phase, 'wrapped');
eq('wrapped remaining', late.remainingMinutes, 0);
eq('wrapped fraction', late.fraction, 1);

const overnight = dayProgress(1080, 240, 60); // 6pm-4am, now 1am
eq('overnight phase', overnight.phase, 'shooting');
eq('overnight total', overnight.totalMinutes, 600);
eq('overnight elapsed', overnight.elapsedMinutes, 420);
eq('overnight remaining', overnight.remainingMinutes, 180);
const overnightEarly = dayProgress(1080, 240, 900); // 3pm, before a 6pm call
eq('overnight before call', overnightEarly.phase, 'before-call');
eq('overnight before call untilCall', overnightEarly.untilCallMinutes, 180);
// 5am on a day that calls at 6pm *tonight* is before call, not after wrap:
// last night's shoot belongs to yesterday's record, and resolveCurrentDay
// hands that one over instead (asserted above).
eq('overnight morning is before tonight’s call', dayProgress(1080, 240, 300).phase, 'before-call');
// The wrap boundary itself, reached via the carry-over.
eq('overnight wrapped at the wrap', dayProgress(1080, 240, 240).phase, 'wrapped');
eq('overnight one minute before wrap', dayProgress(1080, 240, 239).phase, 'shooting');

eq('progress unknown without call', dayProgress(null, 1140, 780).phase, 'unknown');
eq('progress unknown without wrap', dayProgress(420, null, 780).phase, 'unknown');

// --- scenes / shots --------------------------------------------------------
const scenes = [
  { id: 's12', number: '12', pageEighths: 12, cast: ['MAREN', 'The Keeper'] },
  { id: 's12a', number: '12A', pageEighths: 4, cast: ['MAREN'] },
  { id: 's30', number: '30', pageEighths: 8, cast: ['DEV'] },
];
const day = { id: 'd2', date: '2026-08-09', dayNumber: 2, sceneIds: ['s12', 's12a'] };
eq('scenesForDay', scenesForDay(day, scenes).map(s => s.number), ['12', '12A']);
eq('scenesForDay keeps day order', scenesForDay({ ...day, sceneIds: ['s12a', 's12'] }, scenes).map(s => s.number), ['12A', '12']);
eq('scenesForDay drops missing ids', scenesForDay({ ...day, sceneIds: ['s12', 'gone'] }, scenes).map(s => s.id), ['s12']);
eq('scenesForDay with no links', scenesForDay({ id: 'x', date: '2026-08-09', dayNumber: 1 }, scenes), []);
eq('scenesForDay null day', scenesForDay(null, scenes), []);

const shots = [
  { id: 'a', sceneId: 's12', sceneNumber: 12, status: 'shot' },
  { id: 'b', sceneId: 's12', sceneNumber: 12, status: 'planned' },
  // No sceneId — the legacy shape the fallback exists for.
  { id: 'c', sceneNumber: 12, status: 'approved' },
  // "12A" as a loose number: the parseInt problem in reverse.
  { id: 'd', sceneNumber: '12A', status: 'shot' },
  { id: 'e', sceneId: 's30', sceneNumber: 30, status: 'shot' },
];
const dayScenes = scenesForDay(day, scenes);
eq('shotsForScenes ids + numbers', shotsForScenes(shots, dayScenes).map(s => s.id), ['a', 'b', 'c', 'd']);
eq('shotsForScenes excludes other days', shotsForScenes(shots, dayScenes).some(s => s.id === 'e'), false);
eq('shotsForScenes with no scenes', shotsForScenes(shots, []), []);

// A shot linked to 12A stores sceneNumber 12, because that field is a number
// and the letter was lost. Scene 12 must not claim it as well.
const linked12A = [
  { id: 'p', sceneId: 's12', sceneNumber: 12, status: 'shot' },
  { id: 'q', sceneId: 's12a', sceneNumber: 12, status: 'shot' },
  { id: 'r', sceneNumber: 12, status: 'planned' },
];
eq('explicit link beats the lost letter', shotsForScenes(linked12A, [scenes[0]]).map(s => s.id), ['p', 'r']);
eq('12A keeps its own shot', shotsForScenes(linked12A, [scenes[1]]).map(s => s.id), ['q']);
eq('the day still sees all three', shotsForScenes(linked12A, dayScenes).map(s => s.id), ['p', 'q', 'r']);
// Per-scene counts must add up to the day's count, which is what the bug broke.
const perScene = dayScenes.reduce((n, sc) => n + shotsForScenes(linked12A, [sc]).length, 0);
eq('per-scene counts sum to the day count', perScene, shotsForScenes(linked12A, dayScenes).length);

// --- summarizeWork ---------------------------------------------------------
const work = summarizeWork(dayScenes, shots);
eq('work sceneCount', work.sceneCount, 2);
eq('work shotsPlanned', work.shotsPlanned, 4);
eq('work shotsCompleted', work.shotsCompleted, 3);
eq('work eighthsPlanned', work.eighthsPlanned, 16);
// Scene 12 has a 'planned' shot outstanding, so its 12 eighths do not count.
// Scene 12A is fully covered, so its 4 do.
eq('work eighthsCompleted counts whole scenes only', work.eighthsCompleted, 4);
eq('work scenesCompleted', work.scenesCompleted, 1);

const allDone = summarizeWork(dayScenes, shots.map(s => ({ ...s, status: 'shot' })));
eq('work all done eighths', allDone.eighthsCompleted, 16);
eq('work all done scenes', allDone.scenesCompleted, 2);

// A scene with no shots at all cannot be complete.
const noShots = summarizeWork(dayScenes, []);
eq('work no shots planned', noShots.shotsPlanned, 0);
eq('work no shots completed eighths', noShots.eighthsCompleted, 0);
eq('work no shots still counts pages planned', noShots.eighthsPlanned, 16);

// --- castCalledFor ---------------------------------------------------------
const cast = [
  { id: 'c1', characterName: 'Maren', scenes: [] },
  { id: 'c2', characterName: '  the   keeper ', scenes: [] },
  { id: 'c3', characterName: 'Dev', scenes: [] },
  { id: 'c4', characterName: 'Unlisted', scenes: [12] },
  { id: 'c5', characterName: 'Nobody', scenes: [99] },
];
eq('cast by character name', castCalledFor(cast, dayScenes).map(c => c.id), ['c1', 'c2', 'c4']);
eq('cast excludes other scenes', castCalledFor(cast, dayScenes).some(c => c.id === 'c3'), false);
eq('cast with no scenes', castCalledFor(cast, []), []);

// --- computePace -----------------------------------------------------------
// Half the day gone, a quarter of the pages done.
const behind = computePace(
  { sceneCount: 2, scenesCompleted: 1, shotsPlanned: 8, shotsCompleted: 2, eighthsPlanned: 16, eighthsCompleted: 4 },
  mid, 420,
);
eq('pace behind', behind.status, 'behind');
near('pace workFraction', behind.workFraction, 0.25);
// 360 minutes bought a quarter of the day, so the whole day is 1440 from call.
eq('pace projection', behind.projectedWrapMinutes, 420 + 1440);

const ahead = computePace(
  { sceneCount: 2, scenesCompleted: 2, shotsPlanned: 8, shotsCompleted: 7, eighthsPlanned: 16, eighthsCompleted: 14 },
  mid, 420,
);
eq('pace ahead', ahead.status, 'ahead');

const onTrack = computePace(
  { sceneCount: 2, scenesCompleted: 1, shotsPlanned: 8, shotsCompleted: 4, eighthsPlanned: 16, eighthsCompleted: 8 },
  mid, 420,
);
eq('pace on track', onTrack.status, 'on-track');
eq('pace on track projection is the scheduled wrap', onTrack.projectedWrapMinutes, 1140);
eq('pace on track overrun is zero', onTrack.overrunMinutes, 0);
eq('pace behind overrun', behind.overrunMinutes, (420 + 1440) - 1140);

// Overnight: call 6pm, wrap 6am, now 4:30am, a quarter of the pages done.
// The scheduled end is 6am *tomorrow*, so the overrun must be measured against
// call+total, not against the raw wrap time — which would have said 54h.
const nightProgress = dayProgress(1080, 360, 270);
eq('overnight elapsed for pace', nightProgress.elapsedMinutes, 630);
eq('overnight total for pace', nightProgress.totalMinutes, 720);
const nightPace = computePace(
  { sceneCount: 2, scenesCompleted: 1, shotsPlanned: 5, shotsCompleted: 2, eighthsPlanned: 16, eighthsCompleted: 4 },
  nightProgress, 1080,
);
eq('overnight projection', nightPace.projectedWrapMinutes, 1080 + 2520);
eq('overnight overrun is 30h not 54h', nightPace.overrunMinutes, 1800);
eq('overnight overrun in hours', formatDuration(nightPace.overrunMinutes ?? 0), '30h');

// Nothing shot yet cannot be extrapolated.
const nothingYet = computePace(
  { sceneCount: 2, scenesCompleted: 0, shotsPlanned: 8, shotsCompleted: 0, eighthsPlanned: 16, eighthsCompleted: 0 },
  mid, 420,
);
eq("pace no work done projection", nothingYet.projectedWrapMinutes, null);
eq("pace no work done overrun", nothingYet.overrunMinutes, null);
eq('pace no work done status', nothingYet.status, 'behind');

// Before call there is no pace to speak of.
eq('pace before call', computePace(
  { sceneCount: 2, scenesCompleted: 0, shotsPlanned: 8, shotsCompleted: 0, eighthsPlanned: 16, eighthsCompleted: 0 },
  early, 420,
).status, 'unknown');

// No page counts falls back to shots.
const byShots = computePace(
  { sceneCount: 2, scenesCompleted: 0, shotsPlanned: 8, shotsCompleted: 4, eighthsPlanned: 0, eighthsCompleted: 0 },
  mid, 420,
);
near('pace falls back to shots', byShots.workFraction, 0.5);
eq('pace by shots status', byShots.status, 'on-track');

// Nothing planned at all.
eq('pace nothing planned', computePace(
  { sceneCount: 0, scenesCompleted: 0, shotsPlanned: 0, shotsCompleted: 0, eighthsPlanned: 0, eighthsCompleted: 0 },
  mid, 420,
).status, 'unknown');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
