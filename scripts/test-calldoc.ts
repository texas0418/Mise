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

// --- safety, logistics, contacts, advance, weather, versioning -------------

const details = {
  id: 'cd1', projectId: 'p1', scheduleDayId: 'd2', version: 2,
  issuedAt: '2026-08-08T21:00:00.000Z',
  hospitalName: 'Grady Memorial', hospitalAddress: '80 Jesse Hill Jr Dr SE', hospitalPhone: '404-616-1000',
  safetyNotes: 'Wet floors on the stair unit.',
  parkingNotes: 'Lot C off Brady Ave', walkieChannels: '1 Production, 2 Camera',
  breakfastTime: '6:30 AM', lunchTime: '1:00 PM', cateringLocation: 'Basecamp tent',
  basecampNotes: '', crewParkNotes: '', nearestBathroom: '', companyMoves: '',
  createdAt: '',
} as any;
const advance = { dayNumber: 3, date: '2026-08-12', location: 'Point Reyes', callTime: '6:00 AM', sceneNumbers: ['30'], eighths: 8 };
const weather = {
  date: '2026-08-09', tempHigh: 89, tempLow: 70, conditionCode: 61, conditionLabel: 'Rain',
  precipChance: 40, windSpeed: 8, sunrise: '6:55 AM', sunset: '8:30 PM',
  goldenHourAM: '6:55 AM–7:25 AM', goldenHourPM: '8:00 PM–8:30 PM',
};
const contactCrew = [
  { id: 'cr1', assignmentId: 'as1', name: 'Nia Okafor', role: 'DP', projectRole: 'Director of Photography', department: 'camera', phone: '555-0103', email: '', callTime: '5:30 AM' },
  { id: 'cr2', assignmentId: 'as2', name: 'Priya Shah', role: '1st AD', projectRole: '1st AD', department: 'production', phone: '555-0101', email: '' },
] as any;

const full = buildCallSheetHtml(project, day, scenes, contactCrew, cast, times, details, advance, weather);

const more: [string, boolean][] = [
  ['safety block', full.includes('<h2>Safety</h2>')],
  ['hospital name', full.includes('Grady Memorial')],
  ['hospital phone', full.includes('404-616-1000')],
  ['safety sits above the scenes', full.indexOf('<h2>Safety') < full.indexOf('<h2>Scenes')],
  ['logistics block', full.includes('<h2>Logistics</h2>')],
  ['walkie channels', full.includes('1 Production, 2 Camera')],
  ['meals', full.includes('6:30 AM') && full.includes('1:00 PM')],
  ['blank logistics fields do not print', !full.includes('Nearest bathroom')],
  ['key contacts', full.includes('<h2>Key contacts</h2>')],
  ['contact phone', full.includes('555-0101')],
  ['weather block', full.includes('<h2>Weather</h2>')],
  ['golden hour', full.includes('8:00 PM–8:30 PM')],
  ['advance block', full.includes('Advance — Day 3')],
  ['advance location', full.includes('Point Reyes')],
  ['issued version in the subtitle', full.includes('Version 2')],
];

// An unissued sheet must say so rather than implying it is current.
const draft = buildCallSheetHtml(project, day, scenes, contactCrew, cast, times, { ...details, issuedAt: undefined });
more.push(['unissued says draft', draft.includes('Draft, not yet issued')]);
more.push(['unissued does not claim a version', !draft.includes('Version 2')]);

// Nothing filled in: the new sections must vanish, not print empty headings.
const bare = buildCallSheetHtml(project, day, scenes, crew, cast, times);
more.push(['no details, no safety block', !bare.includes('<h2>Safety</h2>')]);
more.push(['no details, no logistics block', !bare.includes('<h2>Logistics</h2>')]);
more.push(['no weather, no weather block', !bare.includes('<h2>Weather</h2>')]);
more.push(['no advance, no advance block', !bare.includes('<h2>Advance')]);
more.push(['crew without phones, no contacts block', !bare.includes('<h2>Key contacts</h2>')]);
more.push(['bare sheet still has scenes', bare.includes('<h2>Scenes')]);

// A details row that exists but is entirely blank must not print a heading either.
const empty = buildCallSheetHtml(project, day, scenes, crew, cast, times, {
  id: 'x', projectId: 'p1', scheduleDayId: 'd2', version: 1, createdAt: '',
} as any);
more.push(['blank details print no safety heading', !empty.includes('<h2>Safety</h2>')]);

checks.push(...more);

let fail = 0;
for (const [label, ok] of checks) {
  if (!ok) { fail++; console.log(`FAIL ${label}`); }
}
console.log(`${checks.length - fail} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
