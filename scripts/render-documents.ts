/**
 * scripts/render-documents.ts
 *
 *   bun run scripts/render-documents.ts [outDir]
 *
 * Writes every production document to disk as HTML so it can be *looked at*.
 *
 * `scripts/test-calldoc.ts` asserts on the markup: that a section exists, that
 * a name appears, that cast sorts before crew. None of that can see a page
 * break landing mid-table, a column overflowing the printable width, or the
 * whole document coming out white-on-white. Those are render failures, and the
 * only way to find them is to render one.
 *
 * `Print.printToFileAsync` is native and still has not run on a device. This is
 * the next best thing: the exact same HTML, in a real browser engine, printed
 * with the same `@page` rules. It cannot catch a WKWebView-only quirk — see
 * the README note beside the output — but everything upstream of that is here.
 *
 * The fixture is deliberately a *full* day rather than a minimal one. A sheet
 * with two scenes and one crew member fits on any page; the failures worth
 * finding only appear when the document is the length a real Thursday is.
 *
 * Bun rather than node: these modules import through the `@/` alias.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildCallSheetHtml, buildShotListHtml, buildScheduleHtml,
  buildWrapReportHtml, buildBudgetHtml, buildSelectsHtml,
} from '@/utils/exportDocuments';
import type { AdvanceDay } from '@/utils/callSheet';
import type { DayWeather } from '@/utils/forecast';
import type {
  Project, Scene, ScheduleDay, Shot, CastMember, CastCallTime,
  CallSheetDetails, WrapReport, BudgetItem, SceneSelect,
} from '@/types';
import type { AssignedCrew } from '@/contexts/ProjectContext';

const outDir = process.argv[2] ?? join(import.meta.dir, '..', '.render');

// ─── The film ───────────────────────────────────────────────────────────────

const project: Project = {
  id: 'p1',
  title: 'The Lighthouse Keeper',
  logline: 'A keeper who has not seen the mainland in nine years receives a visitor.',
  genre: 'Drama',
  status: 'production',
  format: 'Feature',
  director: 'Simon Shih',
  producer: 'Alma Reyes',
  createdAt: '2026-04-02T10:00:00.000Z',
};

// Scene numbers include a letter and a page-count spread, because "12A" is the
// case that has bitten this codebase before and long headings are what wrap.
const scenes: Scene[] = [
  scene('s12', '12', 'INT. LIGHTHOUSE — LAMP ROOM — NIGHT', 'INT', 'night', 'Stage B', 12, ['MAREN', 'THE KEEPER']),
  scene('s12a', '12A', 'INT. LIGHTHOUSE — SPIRAL STAIRWELL — CONTINUOUS', 'INT', 'night', 'Stage B', 4, ['MAREN']),
  scene('s13', '13', 'EXT. GALLERY DECK — NIGHT', 'EXT', 'night', 'Stage B Exterior', 21, ['MAREN', 'THE KEEPER', 'DEV']),
  scene('s14', '14', 'INT. KEEPER’S QUARTERS — NIGHT', 'INT', 'night', 'Stage B', 17, ['THE KEEPER', 'DEV']),
  scene('s15', '15', 'EXT. LANDING — DUSK', 'EXT', 'dusk', 'Point Reyes — North Landing', 9, ['MAREN', 'ELLIS']),
  scene('s16', '16', 'INT. RADIO ROOM — NIGHT', 'INT', 'night', 'Stage B', 26, ['THE KEEPER', 'MAREN', 'VOICE ON RADIO']),
  scene('s17', '17', 'EXT. ROCKS BELOW THE LIGHT — NIGHT', 'EXT', 'night', 'Point Reyes — Tide Pools', 14, ['DEV', 'ELLIS']),
  scene('s18', '18', 'INT. LIGHTHOUSE — LAMP ROOM — DAWN', 'INT', 'dawn', 'Stage B', 6, ['MAREN']),
];

function scene(
  id: string, number: string, heading: string, intExt: string,
  timeOfDay: string, location: string, pageEighths: number, cast: string[],
): Scene {
  return {
    id, projectId: 'p1', number, heading,
    intExt: intExt as Scene['intExt'],
    timeOfDay: timeOfDay as Scene['timeOfDay'],
    location, pageEighths, cast,
    extras: '', props: [], wardrobe: [], specialEquipment: [],
    synopsis: '', notes: '', createdAt: '', updatedAt: '',
  };
}

const day: ScheduleDay = {
  id: 'd14', projectId: 'p1', date: '2026-08-13', dayNumber: 14,
  sceneIds: ['s12', 's12a', 's13', 's14', 's15', 's16', 's17', 's18'],
  scenes: 'Sc. 12, 12A, 13, 14, 15, 16, 17, 18',
  location: 'Stage B, Marin Studios — 1400 Anderson Dr, San Rafael',
  callTime: '5:30 PM', wrapTime: '5:30 AM',
  notes: 'Night exteriors on the deck are weather-dependent; cover set is Sc. 16 in the radio room. '
       + 'Practical lamp is a working carbon arc — do not touch without the gaffer.',
};

const tomorrow: ScheduleDay = {
  id: 'd15', projectId: 'p1', date: '2026-08-14', dayNumber: 15,
  sceneIds: ['s18'], scenes: 'Sc. 18',
  location: 'Stage B, Marin Studios',
  callTime: '6:00 PM', wrapTime: '4:00 AM', notes: '',
};

const schedule: ScheduleDay[] = [day, tomorrow];

// ─── Who is there ───────────────────────────────────────────────────────────

const cast: CastMember[] = [
  castMember('ca1', 'Ada Lyle', 'Maren'),
  castMember('ca2', 'Ross Vane', 'the keeper'),   // deliberate case mismatch
  castMember('ca3', 'Jo Marsh', 'Dev'),
  castMember('ca4', 'Ngozi Abara-Whitfield', 'Ellis'),
  castMember('ca5', 'Tom Break', 'Voice on Radio'),
  castMember('ca6', 'Unused Actor', 'Harbourmaster'), // not in today's scenes
];

function castMember(id: string, actorName: string, characterName: string): CastMember {
  return {
    id, projectId: 'p1', actorName, characterName,
    characterDescription: '', status: 'confirmed',
    scenes: [], shootDays: [], availability: '',
    performanceNotes: '', createdAt: '',
  };
}

const castTimes = new Map<string, CastCallTime>([
  ['ca1', time('ca1', '4:00 PM', '4:45 PM', '5:30 PM')],
  ['ca2', time('ca2', '3:30 PM', '4:30 PM', '5:30 PM')],
  ['ca4', time('ca4', '6:00 PM', '6:30 PM', '7:15 PM')],
  // ca3 and ca5 deliberately have none — they must fall back to the general call.
]);

function time(castMemberId: string, makeupTime: string, wardrobeTime: string, onSetTime: string): CastCallTime {
  return {
    id: `t-${castMemberId}`, projectId: 'p1', scheduleDayId: 'd14',
    castMemberId, makeupTime, wardrobeTime, onSetTime, createdAt: '',
  };
}

// A real unit, at the length that actually tests a page break.
const crew: AssignedCrew[] = [
  person('Simon Shih', 'Director', 'production', '5:30 PM', '415-555-0142'),
  person('Priya Raghunathan', 'First Assistant Director', 'production', '5:00 PM', '415-555-0117'),
  person('Alma Reyes', 'Producer', 'production', '5:30 PM', '415-555-0188'),
  person('Ben Okonkwo', 'Unit Production Manager', 'production', '4:30 PM', '415-555-0131'),
  person('Nia Okafor', 'Director of Photography', 'camera', '4:00 PM', '415-555-0164'),
  person('Marcus Feld', 'Location Manager', 'production', '3:00 PM', '415-555-0109'),
  person('Ivy Chen', 'Second Assistant Director', 'production', '4:30 PM', ''),
  person('Dario Sette', 'A-Camera Operator', 'camera', '4:00 PM', ''),
  person('Lena Vasquez', '1st AC', 'camera', '3:30 PM', ''),
  person('Otis Bramble', '2nd AC', 'camera', '3:30 PM', ''),
  person('Kit Sorensen', 'DIT', 'camera', '4:00 PM', ''),
  person('Hollis Grant', 'Gaffer', 'electric', '3:00 PM', '415-555-0173'),
  person('Rae Dunmore', 'Best Boy Electric', 'electric', '3:00 PM', ''),
  person('Sam Iyer', 'Electrician', 'electric', '3:00 PM', ''),
  person('Frankie Bell', 'Key Grip', 'grip', '3:00 PM', ''),
  person('Tobias Nwachukwu', 'Best Boy Grip', 'grip', '3:00 PM', ''),
  person('June Halloway', 'Dolly Grip', 'grip', '3:30 PM', ''),
  person('Aurelio Marchetti', 'Production Sound Mixer', 'sound', '4:30 PM', ''),
  person('Cass Boone', 'Boom Operator', 'sound', '4:30 PM', ''),
  person('Wren Abbott', 'Production Designer', 'art', '2:00 PM', ''),
  person('Del Ferraro', 'Art Director', 'art', '2:00 PM', ''),
  person('Suki Yamamoto', 'Set Decorator', 'art', '2:00 PM', ''),
  person('Marguerite Oyelaran-Cole', 'Costume Designer', 'wardrobe', '2:30 PM', ''),
  person('Theo Blackwood', 'Key Hair & Makeup', 'wardrobe', '3:00 PM', ''),
  person('Nadia Prosper', 'Script Supervisor', 'production', '5:00 PM', ''),
  person('Emmett Chao', 'Gaffer’s Assistant', 'electric', '3:00 PM', ''),
  person('Rosalind Pike-Adeyemi', 'Medic', 'production', '5:00 PM', '415-555-0199'),
  person('Yusuf Karim', 'Craft Service', 'catering', '3:00 PM', ''),
  person('Birdie Lomax', 'Transport Captain', 'transport', '2:00 PM', ''),
  person('Ana Sotelo', 'Production Assistant', 'production', '4:00 PM', ''),
];

function person(
  name: string, projectRole: string, department: string,
  callTime: string, phone: string,
): AssignedCrew {
  const id = name.toLowerCase().replace(/[^a-z]+/g, '-');
  return {
    id, assignmentId: `as-${id}`, name, role: projectRole, projectRole,
    department, phone, email: '', callTime,
  } as AssignedCrew;
}

// ─── The document's own facts ───────────────────────────────────────────────

const details: CallSheetDetails = {
  id: 'cs1', projectId: 'p1', scheduleDayId: 'd14',
  hospitalName: 'MarinHealth Medical Center — Emergency',
  hospitalAddress: '250 Bon Air Rd, Greenbrae, CA 94904',
  hospitalPhone: '(415) 925-7000',
  safetyNotes: 'Working at height on the gallery deck — harness required above the rail line, '
             + 'and nobody goes out there alone. Wet deck: non-slip footwear mandatory. '
             + 'Carbon arc practical is hot and stays hot; only the gaffer strikes it. '
             + 'Tide comes in at 02:10 — the rocks unit clears the lower pools by 01:30, no exceptions.',
  parkingNotes: 'Crew park in Lot D off Anderson. Do not park on Woodland Ave — residential, and we will lose the location.',
  basecampNotes: 'Basecamp is the north apron behind Stage B. Cast trailers nearest the stage door.',
  crewParkNotes: 'Lot D, overflow in Lot F after 6:00 PM.',
  nearestBathroom: 'Stage B south corridor, and two units at basecamp.',
  walkieChannels: '1 Production · 2 Camera · 3 Grip/Electric · 4 Art · 5 Transport · 6 Medic',
  cateringLocation: 'Basecamp tent, north apron',
  breakfastTime: '5:00 PM (walking breakfast)',
  lunchTime: '11:30 PM',
  companyMoves: 'One move to Point Reyes for Sc. 15 and 17 at approximately 9:00 PM. '
              + 'Convoy leaves from Lot D — 40 minutes, no stragglers.',
  version: 3,
  issuedAt: '2026-08-12T18:04:00.000Z',
  createdAt: '2026-08-10T09:00:00.000Z',
};

const advance: AdvanceDay = {
  dayNumber: 15, date: '2026-08-14',
  location: 'Stage B, Marin Studios',
  callTime: '6:00 PM', sceneNumbers: ['18'], eighths: 6,
};

const weather: DayWeather = {
  date: '2026-08-13', tempHigh: 68, tempLow: 51,
  conditionCode: 45, conditionLabel: 'Fog, clearing after midnight',
  precipChance: 20, windSpeed: 12,
  sunrise: '6:22 AM', sunset: '8:04 PM',
  goldenHourAM: '6:22–7:01 AM', goldenHourPM: '7:25–8:04 PM',
};

// ─── The other documents ────────────────────────────────────────────────────

const shots: Shot[] = [
  shot('sh1', 's12', 12, '12A', 'wide', 'static', '24mm', 'Lamp room, full. Maren enters frame left.', 'approved'),
  shot('sh2', 's12', 12, '12B', 'medium', 'handheld', '35mm', 'Maren at the lamp housing.', 'shot'),
  shot('sh3', 's12', 12, '12C', 'close-up', 'static', '85mm', 'Her hand on the brass.', 'shot'),
  shot('sh4', 's12a', 12, '12A-1', 'wide', 'steadicam', '18mm', 'Descending the stairwell, following.', 'planned'),
  shot('sh5', 's13', 13, '13A', 'wide', 'crane', '32mm', 'Deck, rising to reveal the water.', 'planned'),
  shot('sh6', 's13', 13, '13B', 'two-shot', 'static', '50mm', 'Maren and the Keeper at the rail.', 'planned'),
  shot('sh7', 's16', 16, '16A', 'medium', 'static', '40mm', 'Radio room. The Keeper listening.', 'planned'),
  shot('sh8', 's16', 16, '16B', 'insert', 'static', '100mm macro', 'The dial, moving on its own.', 'planned'),
];

function shot(
  id: string, sceneId: string, sceneNumber: number, shotNumber: string,
  type: string, movement: string, lens: string, description: string, status: string,
): Shot {
  return {
    id, projectId: 'p1', sceneId, sceneNumber, shotNumber,
    type: type as Shot['type'], movement: movement as Shot['movement'],
    lens, description, notes: '', status: status as Shot['status'],
  };
}

const wrapReport: WrapReport = {
  id: 'w13', projectId: 'p1', scheduleDayId: 'd13', dayNumber: 13,
  date: '2026-08-12', callTime: '5:30 PM',
  actualWrap: '6:12 AM', scheduledWrap: '5:30 AM',
  scenesScheduled: '9, 10, 11', scenesCompleted: '9, 10',
  shotsPlanned: 14, shotsCompleted: 11,
  totalTakes: 63, circledTakes: 12, ngTakes: 9,
  pagesScheduled: '4 2/8', pagesCompleted: '3 1/8',
  overtimeMinutes: 42,
  notes: 'Lost an hour to fog on the deck. Sc. 11 pushed to Day 16.',
  safetyIncidents: 'None.',
  weatherConditions: 'Heavy fog until 01:00, clearing.',
  createdAt: '2026-08-13T06:30:00.000Z',
};

const budget: BudgetItem[] = [
  budgetItem('b1', 'camera', 'Camera package — 4 week rental', 48000, 46250, 'Keslow Camera', true),
  budgetItem('b2', 'lighting', 'Lighting and grip truck', 32000, 34100, 'Cinelease', true),
  budgetItem('b3', 'cast', 'Principal cast — SAG ultra low', 96000, 96000, '', true),
  budgetItem('b4', 'crew', 'Crew — 24 shoot days', 214000, 219400, '', false),
  budgetItem('b5', 'locations', 'Point Reyes permits and fees', 8500, 11200, 'NPS', true),
  budgetItem('b6', 'art', 'Lighthouse lamp room build', 41000, 38700, '', true),
  budgetItem('b7', 'post', 'Picture edit and finishing', 65000, 0, '', false),
];

function budgetItem(
  id: string, category: string, description: string,
  estimated: number, actual: number, vendor: string, paid: boolean,
): BudgetItem {
  return {
    id, projectId: 'p1', category: category as BudgetItem['category'],
    description, estimated, actual, notes: '', vendor, paid,
  };
}

const selects: SceneSelect[] = [
  select('sl1', 12, '12B', 4, 5, true, false, 'Use this one.', 'She finds the stillness.', 'Slight boom dip at the end — trimmable.'),
  select('sl2', 12, '12B', 6, 4, false, true, 'Alt, warmer.', '', ''),
  select('sl3', 12, '12C', 2, 5, true, false, '', 'Hand shakes, and it should.', ''),
  select('sl4', 13, '13A', 1, 3, false, false, 'Crane hunts a little.', '', 'Regrade — moon is green.'),
];

function select(
  id: string, sceneNumber: number, shotNumber: string, takeNumber: number,
  rating: SceneSelect['rating'], isCircled: boolean, isAlt: boolean,
  editorNote: string, performanceNote: string, technicalNote: string,
): SceneSelect {
  return {
    id, projectId: 'p1', sceneNumber, shotNumber, takeNumber,
    rating, isCircled, isAlt,
    editorNote, performanceNote, technicalNote, createdAt: '',
  };
}

// ─── Write ──────────────────────────────────────────────────────────────────

const documents: [string, string][] = [
  ['call-sheet', buildCallSheetHtml(project, day, scenes, crew, cast, castTimes, details, advance, weather)],
  // The same day with nothing filled in: every optional block must vanish
  // rather than print an empty heading.
  ['call-sheet-bare', buildCallSheetHtml(project, day, scenes, crew)],
  ['shot-list', buildShotListHtml(project, shots, scenes)],
  ['schedule', buildScheduleHtml(project, schedule, scenes)],
  ['wrap-report', buildWrapReportHtml(project, wrapReport)],
  ['budget', buildBudgetHtml(project, budget)],
  ['selects', buildSelectsHtml(project, selects)],
];

mkdirSync(outDir, { recursive: true });
for (const [name, html] of documents) {
  const path = join(outDir, `${name}.html`);
  writeFileSync(path, html, 'utf8');
  console.log(`${name.padEnd(17)} ${String(html.length).padStart(7)} bytes  ${path}`);
}
console.log(`\n${documents.length} documents written to ${outDir}`);
