/**
 * utils/exportDocuments.ts
 *
 * Builds the markup for each production document. Pure: takes records, returns
 * HTML. Nothing here touches the filesystem or the share sheet, so every
 * document can be built and inspected without a device.
 */

import {
  Project, Shot, ScheduleDay, Scene, BudgetItem, WrapReport, SceneSelect, Take,
  CastMember, CastCallTime, CallSheetDetails,
} from '@/types';
import type { AssignedCrew } from '@/contexts/ProjectContext';
import { renderDocument, renderTable, escapeHtml, DocumentMeta } from '@/utils/documentStyle';
import { formatEighths, totalEighths, compareSceneNumbers } from '@/utils/eighths';
import { castRows, keyContacts, orderCrew, type AdvanceDay } from '@/utils/callSheet';
import type { DayWeather } from '@/utils/forecast';

function meta(project: Project, documentTitle: string, subtitle?: string): DocumentMeta {
  return {
    projectTitle: project.title,
    documentTitle,
    subtitle,
    generatedAt: new Date().toISOString(),
  };
}

const scenesFor = (day: ScheduleDay, scenes: Scene[]): Scene[] => {
  if (!day.sceneIds?.length) return [];
  const byId = new Map(scenes.map(s => [s.id, s]));
  return day.sceneIds.map(id => byId.get(id)).filter((s): s is Scene => !!s);
};

const dayScenesLabel = (day: ScheduleDay, scenes: Scene[]): string => {
  const linked = scenesFor(day, scenes);
  return linked.length > 0 ? linked.map(s => s.number).join(', ') : day.scenes || '—';
};

// ─── Shot list ──────────────────────────────────────────────────────────────

export function buildShotListHtml(project: Project, shots: Shot[], scenes: Scene[]): string {
  const grouped = new Map<string, Shot[]>();
  for (const shot of shots) {
    const scene = scenes.find(s => s.id === shot.sceneId)
      ?? scenes.find(s => s.number === String(shot.sceneNumber));
    const key = scene ? scene.number : String(shot.sceneNumber);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(shot);
  }

  const sections = Array.from(grouped.entries())
    .sort(([a], [b]) => compareSceneNumbers(a, b))
    .map(([number, sceneShots]) => {
      const scene = scenes.find(s => s.number === number);
      const heading = scene
        ? `Scene ${escapeHtml(number)} — ${escapeHtml(scene.heading)}` +
          (scene.pageEighths ? ` <span class="muted">(${formatEighths(scene.pageEighths)} pg)</span>` : '')
        : `Scene ${escapeHtml(number)}`;
      const rows = sceneShots.map(s => [
        `<span class="num">${escapeHtml(s.shotNumber)}</span>`,
        escapeHtml(s.description),
        escapeHtml(s.type),
        escapeHtml(s.movement),
        `<span class="num">${escapeHtml(s.lens)}</span>`,
        escapeHtml(s.status),
      ]);
      return `<h2>${heading}</h2>` +
             renderTable(['Shot', 'Description', 'Type', 'Movement', 'Lens', 'Status'], rows);
    }).join('');

  const done = shots.filter(s => s.status === 'shot' || s.status === 'approved').length;
  const summary = `<p class="note">${shots.length} shots · ${done} completed · ${shots.length - done} remaining</p>`;

  return renderDocument(meta(project, 'Shot List'),
    (sections || '<p class="empty">No shots yet.</p>') + summary);
}

// ─── Schedule (one-liner) ───────────────────────────────────────────────────

export function buildScheduleHtml(project: Project, schedule: ScheduleDay[], scenes: Scene[]): string {
  const rows = schedule.map(day => {
    const linked = scenesFor(day, scenes);
    const pages = linked.length > 0 ? formatEighths(totalEighths(linked.map(s => s.pageEighths))) : '—';
    return [
      `<span class="num">${day.dayNumber}</span>`,
      `<span class="num">${escapeHtml(day.date)}</span>`,
      escapeHtml(dayScenesLabel(day, scenes)),
      `<span class="num">${escapeHtml(pages)}</span>`,
      escapeHtml(day.location),
      `<span class="num">${escapeHtml(day.callTime)}</span>`,
      `<span class="num">${escapeHtml(day.wrapTime)}</span>`,
    ];
  });

  const totalPages = formatEighths(totalEighths(
    schedule.flatMap(d => scenesFor(d, scenes).map(s => s.pageEighths)),
  ));
  const table = renderTable(
    ['Day', 'Date', 'Scenes', 'Pages', 'Location', 'Call', 'Wrap'], rows, 'No shoot days scheduled.');

  return renderDocument(meta(project, 'Shooting Schedule'),
    table + `<p class="note">${schedule.length} days · ${totalPages} pages scheduled</p>`);
}

// ─── Call sheet ─────────────────────────────────────────────────────────────

/** Label / value pairs, skipping anything blank so empty sections do not print. */
function definitionRows(pairs: [string, string | undefined][]): string[][] {
  return pairs
    .filter(([, value]) => String(value ?? '').trim().length > 0)
    .map(([label, value]) => [escapeHtml(label), escapeHtml(String(value).trim())]);
}

function labelledBlock(title: string, pairs: [string, string | undefined][]): string {
  const rows = definitionRows(pairs);
  if (rows.length === 0) return '';
  return `<h2>${escapeHtml(title)}</h2>` + renderTable(['', ''], rows, undefined, 'defs');
}

/** Safety first, literally: the hospital is the reason this block exists. */
function safetyHtml(details: CallSheetDetails | null): string {
  if (!details) return '';
  return labelledBlock('Safety', [
    ['Nearest hospital', details.hospitalName],
    ['Address', details.hospitalAddress],
    ['Phone', details.hospitalPhone],
    ['Notes', details.safetyNotes],
  ]);
}

function logisticsHtml(details: CallSheetDetails | null): string {
  if (!details) return '';
  return labelledBlock('Logistics', [
    ['Parking', details.parkingNotes],
    ['Basecamp', details.basecampNotes],
    ['Crew park', details.crewParkNotes],
    ['Nearest bathroom', details.nearestBathroom],
    ['Walkie channels', details.walkieChannels],
    ['Company moves', details.companyMoves],
    ['Breakfast', details.breakfastTime],
    ['Lunch', details.lunchTime],
    ['Catering', details.cateringLocation],
  ]);
}

function contactsHtml(crew: AssignedCrew[]): string {
  const contacts = keyContacts(crew);
  if (contacts.length === 0) return '';
  return '<h2>Key contacts</h2>' + renderTable(
    ['Role', 'Name', 'Phone'],
    contacts.map(c => [
      escapeHtml(c.title),
      escapeHtml(c.name),
      `<span class="num">${escapeHtml(c.phone)}</span>`,
    ]));
}

function weatherHtml(weather: DayWeather | null): string {
  if (!weather) return '';
  return labelledBlock('Weather', [
    ['Conditions', `${weather.conditionLabel}, ${weather.tempHigh}° / ${weather.tempLow}°`],
    ['Precipitation', `${weather.precipChance}%`],
    ['Sunrise', weather.sunrise],
    ['Sunset', weather.sunset],
    ['Golden hour', [weather.goldenHourAM, weather.goldenHourPM].filter(Boolean).join(' and ')],
  ]);
}

/** Tomorrow, read off the schedule so it cannot contradict it. */
function advanceHtml(advance: AdvanceDay | null): string {
  if (!advance) return '';
  return labelledBlock(`Advance — Day ${advance.dayNumber}`, [
    ['Date', advance.date],
    ['Call', advance.callTime],
    ['Location', advance.location],
    ['Scenes', advance.sceneNumbers.join(', ')],
    ['Pages', advance.eighths > 0 ? formatEighths(advance.eighths) : ''],
  ]);
}

export function buildCallSheetHtml(
  project: Project, day: ScheduleDay, scenes: Scene[], crew: AssignedCrew[],
  cast: CastMember[] = [], castTimes: Map<string, CastCallTime> | null = null,
  details: CallSheetDetails | null = null,
  advance: AdvanceDay | null = null,
  weather: DayWeather | null = null,
): string {
  const linked = scenesFor(day, scenes);
  const pages = linked.length > 0 ? formatEighths(totalEighths(linked.map(s => s.pageEighths))) : '—';

  const times = `<h2>Times</h2>` + renderTable(
    ['General call', 'Estimated wrap', 'Location'],
    [[
      `<span class="num">${escapeHtml(day.callTime)}</span>`,
      `<span class="num">${escapeHtml(day.wrapTime)}</span>`,
      escapeHtml(day.location),
    ]]);

  const sceneRows = linked.map(s => [
    `<span class="num">${escapeHtml(s.number)}</span>`,
    escapeHtml(s.heading),
    escapeHtml(s.intExt),
    escapeHtml(String(s.timeOfDay).replace(/-/g, ' ')),
    `<span class="num">${escapeHtml(formatEighths(s.pageEighths))}</span>`,
    escapeHtml((s.cast ?? []).join(', ')),
  ]);
  const sceneTable = `<h2>Scenes — ${escapeHtml(pages)} pages</h2>` + (
    linked.length > 0
      ? renderTable(['Scene', 'Heading', 'I/E', 'D/N', 'Pages', 'Cast'], sceneRows)
      : `<p class="empty">${escapeHtml(day.scenes || 'No scenes listed.')}</p>`
  );

  // Cast, with the three times that decide when an actor leaves the house. A
  // blank cell means the general call, which is what an untouched sheet says.
  const called = castRows(cast, linked, castTimes);
  const castHtml = `<h2>Cast (${called.length})</h2>` + renderTable(
    ['#', 'Character', 'Actor', 'Scenes', 'Makeup', 'Wardrobe', 'On set'],
    called.map(row => [
      `<span class="num">${row.castNumber ?? ''}</span>`,
      escapeHtml(row.character),
      escapeHtml(row.actor),
      `<span class="num">${escapeHtml(row.sceneNumbers.join(', '))}</span>`,
      `<span class="num">${escapeHtml(row.makeupTime || day.callTime)}</span>`,
      `<span class="num">${escapeHtml(row.wardrobeTime || day.callTime)}</span>`,
      `<span class="num">${escapeHtml(row.onSetTime || day.callTime)}</span>`,
    ]),
    'No cast matched the scenes scheduled for this day.');

  // Each person's own call where they have one, the general call otherwise.
  const crewRows = orderCrew(crew).map(c => [
    escapeHtml(c.name), escapeHtml(c.projectRole), escapeHtml(c.department),
    `<span class="num">${escapeHtml(c.callTime ?? day.callTime)}</span>`,
  ]);
  const crewTable = `<h2>Crew (${crew.length})</h2>` +
    renderTable(['Name', 'Role', 'Department', 'Call'], crewRows, 'No crew added.');

  const notes = day.notes
    ? `<h2>Notes</h2><p class="note">${escapeHtml(day.notes)}</p>` : '';

  const dateLabel = new Date(day.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  // Which sheet this is. Crew compare the number against the one in their
  // hand, so an unissued draft says so rather than implying it is current.
  const version = details?.issuedAt
    ? `${dateLabel} · Version ${details.version}`
    : `${dateLabel} · Draft, not yet issued`;

  return renderDocument(
    meta(project, `Call Sheet — Day ${day.dayNumber}`, version),
    times + safetyHtml(details) + sceneTable + castHtml + crewTable
      + contactsHtml(crew) + logisticsHtml(details) + weatherHtml(weather)
      + advanceHtml(advance) + notes,
  );
}

// ─── Wrap report ────────────────────────────────────────────────────────────

export function buildWrapReportHtml(project: Project, report: WrapReport): string {
  const stat = (label: string, value: string) =>
    [escapeHtml(label), `<span class="num">${escapeHtml(value)}</span>`];

  const rows = [
    stat('Call', report.callTime),
    stat('Scheduled wrap', report.scheduledWrap),
    stat('Actual wrap', report.actualWrap),
    stat('Overtime', report.overtimeMinutes > 0 ? `${(report.overtimeMinutes / 60).toFixed(1)} h` : 'None'),
    stat('Scenes scheduled', report.scenesScheduled || '—'),
    stat('Scenes completed', report.scenesCompleted || '—'),
    stat('Pages scheduled', report.pagesScheduled || '—'),
    stat('Pages completed', report.pagesCompleted || '—'),
    stat('Shots', `${report.shotsCompleted} of ${report.shotsPlanned}`),
    stat('Takes', `${report.totalTakes} (${report.circledTakes} circled, ${report.ngTakes} NG)`),
  ];

  const extras = [
    report.weatherConditions ? `<h2>Weather</h2><p class="note">${escapeHtml(report.weatherConditions)}</p>` : '',
    report.safetyIncidents ? `<h2>Safety</h2><p class="note">${escapeHtml(report.safetyIncidents)}</p>` : '',
    report.notes ? `<h2>Notes</h2><p class="note">${escapeHtml(report.notes)}</p>` : '',
  ].join('');

  return renderDocument(
    meta(project, `Wrap Report — Day ${report.dayNumber}`, report.date),
    renderTable(['', ''], rows) + extras,
  );
}

// ─── Budget ─────────────────────────────────────────────────────────────────

/** Category keys are stored lowercase; a printed budget is not. */
const titleCase = (text: string) =>
  text.replace(/\b[a-z]/g, letter => letter.toUpperCase());

// The sign goes outside the currency symbol. `$${n}` printed an overspend as
// "$-2,100", which is not how money is written anywhere and reads as a typo on
// a document that goes to a financier. Caught by printing the budget.
const money = (n: number) => {
  const value = n || 0;
  const magnitude = Math.abs(value).toLocaleString('en-US', { maximumFractionDigits: 0 });
  return `${value < 0 ? '-' : ''}$${magnitude}`;
};

export function buildBudgetHtml(project: Project, items: BudgetItem[]): string {
  const byCategory = new Map<string, { est: number; act: number }>();
  for (const item of items) {
    const bucket = byCategory.get(item.category) ?? { est: 0, act: 0 };
    bucket.est += item.estimated || 0;
    bucket.act += item.actual || 0;
    byCategory.set(item.category, bucket);
  }

  const rows = Array.from(byCategory.entries()).map(([category, v]) => [
    escapeHtml(titleCase(category.replace(/-/g, ' '))),
    `<span class="num">${money(v.est)}</span>`,
    `<span class="num">${money(v.act)}</span>`,
    `<span class="num">${money(v.est - v.act)}</span>`,
  ]);

  const totalEst = items.reduce((s, i) => s + (i.estimated || 0), 0);
  const totalAct = items.reduce((s, i) => s + (i.actual || 0), 0);
  const totals = [
    'Total',
    `<span class="num">${money(totalEst)}</span>`,
    `<span class="num">${money(totalAct)}</span>`,
    `<span class="num">${money(totalEst - totalAct)}</span>`,
  ];

  return renderDocument(meta(project, 'Budget Summary'),
    renderTable(['Category', 'Estimated', 'Actual', 'Variance'], rows,
      'No budget items.', 'money', totals));
}

// ─── Selects (the editor's copy) ────────────────────────────────────────────

export function buildSelectsHtml(project: Project, selects: SceneSelect[]): string {
  const rows = selects.map(s => [
    `<span class="num">${escapeHtml(String(s.sceneNumber))}</span>`,
    `<span class="num">${escapeHtml(s.shotNumber)}</span>`,
    `<span class="num">${escapeHtml(String(s.takeNumber))}</span>`,
    `<span class="num">${escapeHtml(s.timecode ?? '—')}</span>`,
    escapeHtml('★'.repeat(s.rating)),
    s.isCircled ? 'Circled' : (s.isAlt ? 'Alt' : ''),
    escapeHtml([s.editorNote, s.performanceNote, s.technicalNote].filter(Boolean).join(' · ')),
  ]);

  return renderDocument(meta(project, 'Selects'),
    renderTable(['Scene', 'Shot', 'Take', 'Timecode', 'Rating', '', 'Notes'], rows,
      'No selects marked.'));
}

// ─── CSV rows (shared by the CSV exports) ───────────────────────────────────

export const selectsCsv = (selects: SceneSelect[]) => ({
  headers: ['Scene', 'Shot', 'Take', 'Timecode', 'Rating', 'Circled', 'Alt', 'Editor note', 'Performance note', 'Technical note'],
  rows: selects.map(s => [
    s.sceneNumber, s.shotNumber, s.takeNumber, s.timecode ?? '', s.rating,
    s.isCircled ? 'yes' : 'no', s.isAlt ? 'yes' : 'no',
    s.editorNote, s.performanceNote, s.technicalNote,
  ]),
});

export const takesCsv = (takes: Take[]) => ({
  headers: ['Scene', 'Shot', 'Take', 'Circled', 'NG', 'Logged at', 'Notes'],
  rows: takes.map(t => [
    t.sceneNumber, t.shotNumber, t.takeNumber,
    t.isCircled ? 'yes' : 'no', t.isNG ? 'yes' : 'no', t.timestamp, t.notes,
  ]),
});

export const budgetCsv = (items: BudgetItem[]) => ({
  headers: ['Category', 'Description', 'Vendor', 'Estimated', 'Actual', 'Variance', 'Paid', 'Notes'],
  rows: items.map(i => [
    i.category, i.description, i.vendor ?? '', i.estimated, i.actual,
    (i.estimated || 0) - (i.actual || 0), i.paid ? 'yes' : 'no', i.notes,
  ]),
});
