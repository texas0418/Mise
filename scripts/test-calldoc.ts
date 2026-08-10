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
import { buildCallSheetHtml, buildBudgetHtml } from '@/utils/exportDocuments';
import { castRows, crewRank } from '@/utils/callSheet';

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

// ─── What printing one actually caught ─────────────────────────────────────
//
// These three were invisible to every assertion above: the markup was present
// and correct, and the document still looked wrong on paper. They are pinned
// here because the next person to touch renderTable will not be printing one.

const printed = buildCallSheetHtml(project, day, scenes, contactCrew, cast, times, details, advance, weather);
// An all-blank header row printed an empty header band — a stray rule and a
// finger of dead space under Safety, Logistics, Weather and Advance.
more.push(['no empty header cells anywhere', !printed.includes('<th></th>')]);
more.push(['label blocks carry the defs class', printed.includes('<table class="defs">')]);
more.push(['tables that do have headers keep them', printed.includes('<thead>')]);

// Budget: the sign belongs outside the currency symbol, the figures right-align
// as a column, and the totals row sits in the same table as the rows it totals
// — three separate tables cannot share column widths.
const overspent = buildBudgetHtml(project, [
  { id: 'b1', projectId: 'p1', category: 'camera', description: '', estimated: 1000, actual: 3100, notes: '', paid: true },
] as any);
more.push(['overspend reads -$2,100', overspent.includes('-$2,100')]);
more.push(['overspend is never $-2,100', !overspent.includes('$-')]);
more.push(['money table right-aligns', overspent.includes('<table class="money">')]);
more.push(['one table, not two', (overspent.match(/<table/g) || []).length === 1]);
more.push(['totals row is inside it', overspent.includes('<tr class="total">')]);
more.push(['category is title-cased', overspent.includes('>Camera<')]);

// ─── What a real call sheet on a real iPad showed ──────────────────────────
//
// Printed from the device on 2026-08-10, all three of these were wrong on a
// document that goes to a crew.

// Page 2 of the crew table arrived with no column headers: four unlabelled
// columns of names, roles, departments and times. Chrome repeats <thead>
// across page breaks by default and WKWebView does not, so the headless proof
// could not see it.
more.push(['table headers repeat across pages', full.includes('display: table-header-group')]);
more.push(['a heading stays with its table', full.includes('page-break-after: avoid')]);

// Crew ran alphabetically by department, which put the 1st AC first and the
// director ninth. A call sheet is read by someone hunting for one person.
const unordered = [
  { id: 'c1', assignmentId: 'a1', name: 'Zoe Vance', projectRole: 'Production Assistant', department: 'production', phone: '', email: '' },
  { id: 'c2', assignmentId: 'a2', name: 'Ada Reeve', projectRole: '1st AC', department: 'camera', phone: '', email: '' },
  { id: 'c3', assignmentId: 'a3', name: 'Mo Kane', projectRole: 'Director', department: 'production', phone: '555-1', email: '' },
  { id: 'c4', assignmentId: 'a4', name: 'Bo Frank', projectRole: '1st AD', department: 'production', phone: '555-2', email: '' },
] as any;
const orderedSheet = buildCallSheetHtml(project, day, scenes, unordered, cast, times);
const seq = ['Mo Kane', 'Bo Frank', 'Ada Reeve', 'Zoe Vance'].map(n => orderedSheet.indexOf(n));
more.push(['director is first in the crew list', seq[0] < seq[1] && seq[1] < seq[2] && seq[2] < seq[3]],);
more.push(['an unknown role sorts last', crewRank('Balloon Wrangler') > crewRank('Gaffer')]);
more.push(['the director outranks the 1st AC', crewRank('Director') < crewRank('1st AC')]);

// Cast ran by how many of the day's scenes someone was in, so the running
// order reshuffled between days. Cast numbers are stable for the shoot.
const numbered = [
  { id: 'n1', projectId: 'p1', actorName: 'Third Billing', characterName: 'MAREN', status: 'confirmed', castNumber: 3 },
  { id: 'n2', projectId: 'p1', actorName: 'The Lead', characterName: 'The Keeper', status: 'confirmed', castNumber: 1 },
] as any;
const byNumber = castRows(numbered, scenes, null);
more.push(['cast sorts by number, not scene count', byNumber[0].actor === 'The Lead']);
more.push(['the number reaches the row', byNumber[0].castNumber === 1]);
more.push(['unnumbered cast keep a stable order',
  castRows([{ id: 'u1', characterName: 'MAREN', actorName: 'A' },
            { id: 'u2', characterName: 'The Keeper', actorName: 'B' }] as any, scenes, null)[0].actor === 'A']);
more.push(['numbered cast come before unnumbered',
  castRows([{ id: 'u1', characterName: 'MAREN', actorName: 'No number' },
            { id: 'u2', characterName: 'The Keeper', actorName: 'Lead', castNumber: 1 }] as any,
           scenes, null)[0].actor === 'Lead']);
more.push(['the printed sheet has a number column', full.includes('<th>#</th>')]);

checks.push(...more);

let fail = 0;
for (const [label, ok] of checks) {
  if (!ok) { fail++; console.log(`FAIL ${label}`); }
}
console.log(`${checks.length - fail} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
