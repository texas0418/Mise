/**
 * scripts/test-callsheet.ts
 *
 * Assertions for utils/callSheet.ts — the scene and cast rows a call sheet
 * prints. Run from the repo root:
 *
 *   node --experimental-strip-types scripts/test-callsheet.ts
 *
 * No test runner: utils/callSheet.ts imports nothing, which is what lets node
 * execute it directly. Exits non-zero if anything fails.
 */
import {
  resolveDayScenes, dayNightCode, sceneRows, dayTotals, sceneListLabel,
  normalizeCharacterName, castRows, castTimesForDay,
} from '../utils/callSheet.ts';

let pass = 0;
let fail = 0;

function eq(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { pass++; return; }
  fail++;
  console.log(`FAIL ${label}\n  expected ${e}\n  actual   ${a}`);
}

const scenes = [
  { id: 's12', number: '12', heading: 'INT. LIGHTHOUSE - NIGHT', intExt: 'INT', timeOfDay: 'night', pageEighths: 12, cast: ['MAREN', 'The Keeper'] },
  { id: 's12a', number: '12A', heading: 'INT. STAIRWELL - NIGHT', intExt: 'INT', timeOfDay: 'night', pageEighths: 4, cast: ['Maren'] },
  { id: 's30', number: '30', heading: 'EXT. CLIFF - DAY', intExt: 'EXT', timeOfDay: 'day', pageEighths: 8, cast: ['DEV'] },
  { id: 's44', number: '44', heading: 'EXT. JETTY - MAGIC HOUR', intExt: 'EXT', timeOfDay: 'magic-hour', pageEighths: 6, cast: [] },
];

// --- resolveDayScenes ------------------------------------------------------
const day = { sceneIds: ['s12', 's12a'], scenes: 'Sc. 12, 12A' };
eq('resolve day scenes', resolveDayScenes(day, scenes).map(s => s.number), ['12', '12A']);
// The day's order is the shooting order and must survive.
eq('day order is preserved, not script order',
  resolveDayScenes({ sceneIds: ['s12a', 's12'] }, scenes).map(s => s.number), ['12A', '12']);
eq('missing ids are dropped', resolveDayScenes({ sceneIds: ['s12', 'gone'] }, scenes).map(s => s.id), ['s12']);
eq('no links', resolveDayScenes({ scenes: 'Sc. 12' }, scenes), []);
eq('null day', resolveDayScenes(null, scenes), []);
eq('empty link list', resolveDayScenes({ sceneIds: [] }, scenes), []);

// --- dayNightCode ----------------------------------------------------------
eq('day code', dayNightCode('day'), 'D');
eq('night code', dayNightCode('night'), 'N');
eq('dawn code', dayNightCode('dawn'), 'DAWN');
eq('dusk code', dayNightCode('dusk'), 'DUSK');
eq('magic hour code', dayNightCode('magic-hour'), 'MAGIC');
eq('magic hour with a space', dayNightCode('magic hour'), 'MAGIC');
eq('mixed case', dayNightCode('Night'), 'N');
eq('unknown passes through', dayNightCode('twilight'), 'TWILIGHT');
eq('empty', dayNightCode(''), '—');

// --- sceneRows -------------------------------------------------------------
const rows = sceneRows(resolveDayScenes(day, scenes));
eq('row count', rows.length, 2);
eq('row numbers', rows.map(r => r.number), ['12', '12A']);
eq('row int/ext', rows.map(r => r.intExt), ['INT', 'INT']);
eq('row day/night', rows.map(r => r.dayNight), ['N', 'N']);
eq('row pages', rows.map(r => r.pageEighths), [12, 4]);
eq('row cast', rows[0].cast, ['MAREN', 'The Keeper']);
// A blank name in the breakdown should not become an empty cast chip.
eq('blank cast names are dropped',
  sceneRows([{ id: 'x', number: '1', heading: '', intExt: 'INT', timeOfDay: 'day', pageEighths: 0, cast: ['Ada', '  ', ''] }])[0].cast,
  ['Ada']);
eq('missing cast array', sceneRows([{ id: 'y', number: '2', heading: '', intExt: 'EXT', timeOfDay: 'day', pageEighths: 3 }])[0].cast, []);
eq('negative pages clamp',
  sceneRows([{ id: 'z', number: '3', heading: '', intExt: 'EXT', timeOfDay: 'day', pageEighths: -5 }])[0].pageEighths, 0);

// --- dayTotals -------------------------------------------------------------
const totals = dayTotals(resolveDayScenes(day, scenes));
eq('totals scene count', totals.sceneCount, 2);
eq('totals eighths', totals.eighths, 16);
// MAREN appears in both scenes and is one person to call, not two.
eq('totals count distinct characters', totals.castCount, 2);
eq('empty totals', dayTotals([]), { sceneCount: 0, eighths: 0, castCount: 0 });

// --- sceneListLabel --------------------------------------------------------
eq('label from linked scenes', sceneListLabel(day, scenes), '12, 12A');
eq('label falls back to typed text', sceneListLabel({ scenes: 'Sc. 40-42' }, scenes), 'Sc. 40-42');
eq('label with nothing at all', sceneListLabel({}, scenes), '—');
eq('label with null day', sceneListLabel(null, scenes), '—');

// --- normalizeCharacterName ------------------------------------------------
eq('normalize case', normalizeCharacterName('Maren'), 'MAREN');
eq('normalize spacing', normalizeCharacterName('  the   keeper '), 'THE KEEPER');
eq('normalize empty', normalizeCharacterName(''), '');

// --- castRows --------------------------------------------------------------
const cast = [
  { id: 'c1', characterName: 'Maren', actorName: 'Ada Lyle', status: 'confirmed' },
  { id: 'c2', characterName: 'the keeper', actorName: 'Ross Vane', status: 'confirmed' },
  { id: 'c3', characterName: 'Dev', actorName: 'Jo Marsh', status: 'confirmed' },
];
const times = new Map([
  ['c1', { castMemberId: 'c1', makeupTime: '5:30 AM', wardrobeTime: '6:15 AM', onSetTime: '7:00 AM' }],
]);
const dayScenes = resolveDayScenes(day, scenes);
const cRows = castRows(cast, dayScenes, times);

eq('only cast in the day appear', cRows.map(r => r.castMemberId), ['c1', 'c2']);
eq('Dev is not called', cRows.some(r => r.castMemberId === 'c3'), false);
// Maren carries both scenes, so she sorts above the Keeper's one.
eq('ordered by how much of the day they carry', cRows[0].character, 'Maren');
eq('scene numbers per character', cRows[0].sceneNumbers, ['12', '12A']);
eq('keeper scene numbers', cRows[1].sceneNumbers, ['12']);
eq('matched despite case and spacing', cRows[1].actor, 'Ross Vane');
eq('times applied', [cRows[0].makeupTime, cRows[0].wardrobeTime, cRows[0].onSetTime], ['5:30 AM', '6:15 AM', '7:00 AM']);
// No row means the general call, which must read as blank rather than undefined.
eq('missing times are blank strings', [cRows[1].makeupTime, cRows[1].wardrobeTime, cRows[1].onSetTime], ['', '', '']);
eq('no times map at all', castRows(cast, dayScenes, null)[0].makeupTime, '');
eq('whitespace-only time reads as blank',
  castRows(cast, dayScenes, new Map([['c1', { castMemberId: 'c1', makeupTime: '   ' }]]))[0].makeupTime, '');
eq('no scenes means nobody is called', castRows(cast, [], times), []);
eq('no cast records', castRows([], dayScenes, times), []);
// A scene with no cast listed must not invent a row.
eq('scene with empty cast', castRows(cast, [scenes[3]], times), []);

// --- castTimesForDay -------------------------------------------------------
const entries = [
  { scheduleDayId: 'd2', castMemberId: 'c1', makeupTime: '5:30 AM' },
  { scheduleDayId: 'd2', castMemberId: 'c2', makeupTime: '6:00 AM' },
  { scheduleDayId: 'd3', castMemberId: 'c1', makeupTime: '9:00 AM' },
];
const d2 = castTimesForDay(entries, 'd2');
eq('times for the day only', [...d2.keys()].sort(), ['c1', 'c2']);
eq('the right day wins', d2.get('c1')?.makeupTime, '5:30 AM');
// The same actor on another day must not leak across.
eq('other day is separate', castTimesForDay(entries, 'd3').get('c1')?.makeupTime, '9:00 AM');
eq('unknown day is empty', castTimesForDay(entries, 'nope').size, 0);
eq('null day is empty', castTimesForDay(entries, null).size, 0);
eq('no entries', castTimesForDay([], 'd2').size, 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
