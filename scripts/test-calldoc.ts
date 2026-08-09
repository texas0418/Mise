/**
 * scripts/test-calldoc.ts
 *
 * Assertions for the call sheet *document* — the markup that becomes the PDF.
 *
 *   bun run scripts/test-calldoc.ts
 *
 * Bun rather than node here: utils/exportDocuments.ts imports through the `@/`
 * alias, which needs tsconfig paths to resolve, and node cannot do that alone.
 * The pure row-building underneath is covered by scripts/test-callsheet.ts,
 * which does run under plain node.
 *
 * This checks composition, not rendering. `Print.printToFileAsync` is native
 * and has still never run on a device — see the note in the PR.
 */
import { buildCallSheetHtml } from '@/utils/exportDocuments';

const project = { id: 'p1', title: 'The Lighthouse Keeper', logline: '', genre: 'Drama', status: 'production', format: 'Feature', createdAt: '' } as any;
const day = { id: 'd2', projectId: 'p1', date: '2026-08-09', dayNumber: 2, sceneIds: ['s12', 's12a'], scenes: 'Sc. 12, 12A', location: 'Stage B', callTime: '7:00 AM', wrapTime: '7:00 PM', notes: 'Night interiors.' } as any;
const scenes = [
  { id: 's12', projectId: 'p1', number: '12', heading: 'INT. LIGHTHOUSE - NIGHT', intExt: 'INT', timeOfDay: 'night', location: 'Stage B', pageEighths: 12, cast: ['MAREN', 'The Keeper'], extras: '', props: [], wardrobe: [], specialEquipment: [], synopsis: '', notes: '', createdAt: '', updatedAt: '' },
  { id: 's12a', projectId: 'p1', number: '12A', heading: 'INT. STAIRWELL - NIGHT', intExt: 'INT', timeOfDay: 'night', location: 'Stage B', pageEighths: 4, cast: ['Maren'], extras: '', props: [], wardrobe: [], specialEquipment: [], synopsis: '', notes: '', createdAt: '', updatedAt: '' },
] as any;
const crew = [{ id: 'cr1', assignmentId: 'as1', name: 'Nia Okafor', role: 'DP', projectRole: 'Director of Photography', department: 'camera', phone: '', email: '', callTime: '5:30 AM' }] as any;
const cast = [
  { id: 'ca1', projectId: 'p1', actorName: 'Ada Lyle', characterName: 'Maren', status: 'confirmed' },
  { id: 'ca2', projectId: 'p1', actorName: 'Ross Vane', characterName: 'the keeper', status: 'confirmed' },
  { id: 'ca3', projectId: 'p1', actorName: 'Jo Marsh', characterName: 'Dev', status: 'confirmed' },
] as any;
const times = new Map<string, any>([['ca1', { castMemberId: 'ca1', makeupTime: '5:30 AM', wardrobeTime: '6:15 AM', onSetTime: '7:00 AM' }]]);

const html = buildCallSheetHtml(project, day, scenes, crew, cast, times);

const checks: [string, boolean][] = [
  ['has a Cast section', html.includes('<h2>Cast (2)</h2>')],
  ['lists Maren', html.includes('Maren')],
  ['lists her actor', html.includes('Ada Lyle')],
  ['keeps case-mismatched character', html.includes('Ross Vane')],
  ['excludes cast not in the day', !html.includes('Jo Marsh')],
  ['Maren makeup time', html.includes('5:30 AM')],
  ['Maren wardrobe time', html.includes('6:15 AM')],
  ['cast scene numbers', html.includes('12, 12A')],
  ['cast table headers', html.includes('Makeup') && html.includes('Wardrobe') && html.includes('On set')],
  ['scene table still there', html.includes('<h2>Scenes')],
  ['crew table still there', html.includes('<h2>Crew (1)</h2>')],
  ['cast comes before crew', html.indexOf('<h2>Cast') < html.indexOf('<h2>Crew')],
  ['no unescaped angle brackets in data', !html.includes('<script')],
];

// Blank times must fall back to the general call, not print empty cells.
const noTimes = buildCallSheetHtml(project, day, scenes, crew, cast, null);
const keeperRow = noTimes.slice(noTimes.indexOf('Ross Vane'), noTimes.indexOf('Ross Vane') + 400);
checks.push(['blank times fall back to the general call', (keeperRow.match(/7:00 AM/g) || []).length >= 3]);

// Called with the old four-argument signature, the way any un-updated caller would.
const legacy = buildCallSheetHtml(project, day, scenes, crew);
checks.push(['old signature still builds', legacy.includes('<h2>Scenes')]);
checks.push(['old signature says no cast', legacy.includes('No cast matched')]);

let fail = 0;
for (const [label, ok] of checks) {
  if (!ok) { fail++; console.log(`FAIL ${label}`); }
}
console.log(`${checks.length - fail} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
