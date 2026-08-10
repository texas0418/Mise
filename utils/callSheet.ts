/**
 * utils/callSheet.ts
 *
 * Turning a shoot day's scenes into the rows a call sheet prints.
 *
 * Dependency-free like utils/eighths.ts — no imports at all, so
 * `node --experimental-strip-types` runs it without a bundler. Page counts are
 * returned as raw eighths rather than formatted here, which keeps this module
 * free of even a sibling import and leaves formatting to whoever renders.
 */

export interface DayLike {
  /** Scenes linked to the day. Absent on days that predate the Scene entity. */
  sceneIds?: string[];
  /** The legacy free-text list ("Sc. 1, 5, 8"), used only as a fallback label. */
  scenes?: string;
}

export interface SceneLike {
  id: string;
  number: string;
  heading: string;
  intExt: string;
  timeOfDay: string;
  pageEighths: number;
  cast?: string[];
}

export interface SceneRow {
  id: string;
  number: string;
  heading: string;
  /** "INT", "EXT", "INT/EXT" — as written on the slugline. */
  intExt: string;
  /** The D/N column: "D", "N", "DAWN", "DUSK", "MAGIC". */
  dayNight: string;
  pageEighths: number;
  /** Character names in the scene, in the order the breakdown lists them. */
  cast: string[];
}

export interface DayTotals {
  sceneCount: number;
  eighths: number;
  castCount: number;
}

/**
 * The day's scenes, in the order the day lists them.
 *
 * Order is the day's, not the script's: a shoot day is deliberately ordered for
 * the shoot — company moves, actor availability, the light — and re-sorting it
 * into scene order would throw away the only schedule anyone follows.
 */
export function resolveDayScenes<T extends SceneLike>(day: DayLike | null, scenes: T[]): T[] {
  if (!day?.sceneIds?.length) return [];
  const byId = new Map((scenes ?? []).map(s => [s.id, s]));
  const out: T[] = [];
  for (const id of day.sceneIds) {
    const scene = byId.get(id);
    if (scene) out.push(scene);
  }
  return out;
}

/**
 * The D/N column. A call sheet abbreviates it, because the column is one
 * character wide and everyone reading it already knows the convention.
 */
export function dayNightCode(timeOfDay: string): string {
  const value = String(timeOfDay ?? '').trim().toLowerCase();
  if (value === 'day') return 'D';
  if (value === 'night') return 'N';
  if (value === 'dawn') return 'DAWN';
  if (value === 'dusk') return 'DUSK';
  if (value === 'magic-hour' || value === 'magic hour') return 'MAGIC';
  return value ? value.toUpperCase() : '—';
}

/** One printable row per scene. */
export function sceneRows(scenes: SceneLike[]): SceneRow[] {
  return (scenes ?? []).map(scene => ({
    id: scene.id,
    number: scene.number,
    heading: scene.heading,
    intExt: scene.intExt,
    dayNight: dayNightCode(scene.timeOfDay),
    pageEighths: Math.max(0, scene.pageEighths || 0),
    cast: (scene.cast ?? []).filter(name => String(name ?? '').trim().length > 0),
  }));
}

/**
 * What the day adds up to.
 *
 * `castCount` counts distinct characters across the day's scenes, not the sum
 * per scene — an actor in four scenes is one person to feed and one person to
 * call, and the sum would say four.
 */
export function dayTotals(scenes: SceneLike[]): DayTotals {
  const characters = new Set<string>();
  let eighths = 0;

  for (const scene of scenes ?? []) {
    eighths += Math.max(0, scene.pageEighths || 0);
    for (const name of scene.cast ?? []) {
      const key = String(name ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
      if (key) characters.add(key);
    }
  }

  return { sceneCount: (scenes ?? []).length, eighths, castCount: characters.size };
}

/**
 * What to print where the scene list goes.
 *
 * Linked scenes win; the typed string is the fallback for days that predate
 * the Scene entity and could not be resolved by the migration.
 */
export function sceneListLabel(day: DayLike | null, scenes: SceneLike[]): string {
  const linked = resolveDayScenes(day, scenes);
  if (linked.length > 0) return linked.map(s => s.number).join(', ');
  const text = String(day?.scenes ?? '').trim();
  return text.length > 0 ? text : '—';
}

// ---------------------------------------------------------------------------
// Location
// ---------------------------------------------------------------------------

export interface LocationLike {
  name: string;
  address?: string;
  parkingNotes?: string;
  latitude?: number;
  longitude?: number;
}

/**
 * The scouted location behind a shoot day's free-text location field.
 *
 * A day stores a typed string, not a link, so this matches on the name and
 * accepts containment either way — "Stage B" against "Stage B - Lighthouse
 * Interior" is the same place, and it is what people type. The two-character
 * floor stops a location called "A" from matching every address on the slate.
 */
export function matchLocation<T extends LocationLike>(dayLocation: string, locations: T[]): T | null {
  const wanted = String(dayLocation ?? '').trim().toLowerCase();
  if (!wanted) return null;

  const exact = (locations ?? []).find(l => String(l.name ?? '').trim().toLowerCase() === wanted);
  if (exact) return exact;

  return (locations ?? []).find(l => {
    const name = String(l.name ?? '').trim().toLowerCase();
    return name.length > 2 && (wanted.includes(name) || name.includes(wanted));
  }) ?? null;
}

// ---------------------------------------------------------------------------
// Safety and logistics
// ---------------------------------------------------------------------------

export interface DetailsLike {
  hospitalName?: string;
  hospitalAddress?: string;
  hospitalPhone?: string;
  safetyNotes?: string;
  parkingNotes?: string;
  basecampNotes?: string;
  crewParkNotes?: string;
  nearestBathroom?: string;
  walkieChannels?: string;
  companyMoves?: string;
  breakfastTime?: string;
  lunchTime?: string;
  cateringLocation?: string;
}

/** Label / field pairs in the order a call sheet reads them. */
const SUMMARY_FIELDS: { label: string; key: keyof DetailsLike }[] = [
  { label: 'Hospital phone', key: 'hospitalPhone' },
  { label: 'Safety', key: 'safetyNotes' },
  { label: 'Parking', key: 'parkingNotes' },
  { label: 'Basecamp', key: 'basecampNotes' },
  { label: 'Crew park', key: 'crewParkNotes' },
  { label: 'Bathroom', key: 'nearestBathroom' },
  { label: 'Walkies', key: 'walkieChannels' },
  { label: 'Company moves', key: 'companyMoves' },
  { label: 'Breakfast', key: 'breakfastTime' },
  { label: 'Lunch', key: 'lunchTime' },
  { label: 'Catering', key: 'cateringLocation' },
];

/**
 * The filled-in parts of the safety and logistics block, as label/value pairs.
 *
 * Blank fields are dropped rather than printed empty — a call sheet listing
 * "Parking:" with nothing after it reads as an oversight, not as "no parking
 * notes". Hospital name and address join into one line because that is how it
 * is read out.
 */
export function detailSummaryLines(details: DetailsLike | null | undefined): [string, string][] {
  if (!details) return [];
  const lines: [string, string][] = [];

  const hospital = [details.hospitalName, details.hospitalAddress]
    .map(part => String(part ?? '').trim())
    .filter(part => part.length > 0)
    .join(' — ');
  if (hospital) lines.push(['Hospital', hospital]);

  for (const field of SUMMARY_FIELDS) {
    const value = String(details[field.key] ?? '').trim();
    if (value) lines.push([field.label, value]);
  }

  return lines;
}

// ---------------------------------------------------------------------------
// Key contacts
// ---------------------------------------------------------------------------

export interface CrewLike {
  assignmentId?: string;
  name: string;
  projectRole: string;
  phone?: string;
  email?: string;
}

export interface KeyContact {
  /** The call sheet's word for the job, not whatever was typed. */
  title: string;
  name: string;
  phone: string;
}

/**
 * The handful of people a call sheet prints numbers for, in the order it
 * prints them. Matched on words that appear in the typed role, because roles
 * are free text: "1st AD", "First Assistant Director" and "AD" are one job.
 */
const KEY_ROLES: { title: string; patterns: RegExp }[] = [
  { title: 'Director', patterns: /^(the )?director$/i },
  { title: '1st AD', patterns: /\b(1st|first)\s*(ad|assistant director)\b|^ad$/i },
  { title: 'UPM', patterns: /\bupm\b|unit production manager/i },
  { title: 'Producer', patterns: /^(line |executive |co-)?producer$/i },
  { title: 'Location Manager', patterns: /location manager/i },
  { title: 'Cinematographer', patterns: /\b(dp|dop)\b|director of photography|cinematographer/i },
];

/**
 * The order a unit is listed in on a call sheet.
 *
 * Not alphabetical, and not by department. A call sheet is read in a hurry by
 * someone looking for a specific person, and the convention every crew already
 * knows puts the people who run the day at the top: director, then the ADs,
 * then production, then camera, then the departments.
 *
 * Printed alphabetically by department, a real sheet put the 1st AC first and
 * the director ninth (2026-08-10, on a device). That is not a cosmetic
 * complaint — it is the difference between finding a number and scanning for
 * it.
 *
 * Roles are free text, so this matches rather than switches. Anything
 * unrecognised sorts after everything known, alphabetically, so a unit full of
 * unusual titles still comes out in a stable, readable order.
 */
const ROLE_RANK: RegExp[] = [
  /^(the )?director$/i,
  /\b(1st|first)\s*(ad|assistant director)\b|^ad$/i,
  /\b(2nd|second)\s*(ad|assistant director)\b/i,
  /^(line |executive |co-)?producer$/i,
  /\bupm\b|unit production manager/i,
  /production manager|production coordinator/i,
  /\b(dp|dop)\b|director of photography|cinematographer/i,
  /camera operator|\bcam op\b/i,
  /\b1st ac\b|first assistant camera|focus puller/i,
  /\b2nd ac\b|second assistant camera|clapper/i,
  /\bdit\b|digital imaging/i,
  /^gaffer$|chief lighting/i,
  /best boy electric|\bbbe\b/i,
  /electrician|\bspark\b/i,
  /key grip/i,
  /best boy grip/i,
  /dolly grip|grip/i,
  /sound mixer|production sound/i,
  /boom/i,
  /production designer/i,
  /art director/i,
  /set dec/i,
  /costume|wardrobe/i,
  /hair|makeup|\bhmu\b/i,
  /script supervisor|\bscripty\b/i,
  /location manager/i,
  /medic/i,
  /transport/i,
  /craft|catering/i,
  /production assistant|\bpa\b/i,
];

/** Where a role sits in the running order; unknown roles go last. */
export function crewRank(role: string): number {
  const text = String(role ?? '').trim();
  const index = ROLE_RANK.findIndex(pattern => pattern.test(text));
  return index === -1 ? ROLE_RANK.length : index;
}

/**
 * A unit in call sheet order. Does not mutate the input — the caller's array
 * is a React prop more often than not.
 */
export function orderCrew<T extends { name: string; projectRole?: string; role?: string }>(
  crew: T[],
): T[] {
  return [...(crew ?? [])].sort((a, b) => {
    const rankA = crewRank(a.projectRole ?? a.role ?? '');
    const rankB = crewRank(b.projectRole ?? b.role ?? '');
    return rankA - rankB || String(a.name ?? '').localeCompare(String(b.name ?? ''));
  });
}

/**
 * Key contacts, read out of the crew already assigned to the production
 * rather than typed a second time.
 *
 * Retyping them would mean two sources for one phone number, and the one on
 * the call sheet would be the stale one. Anyone without a number is skipped —
 * a contact line with no way to contact them is worse than an absent row.
 */
export function keyContacts(crew: CrewLike[]): KeyContact[] {
  const contacts: KeyContact[] = [];
  const used = new Set<string>();

  for (const { title, patterns } of KEY_ROLES) {
    const match = (crew ?? []).find(person =>
      !used.has(person.name) &&
      patterns.test(String(person.projectRole ?? '').trim()) &&
      String(person.phone ?? '').trim().length > 0);
    if (!match) continue;
    used.add(match.name);
    contacts.push({ title, name: match.name, phone: String(match.phone).trim() });
  }

  return contacts;
}

// ---------------------------------------------------------------------------
// Tomorrow
// ---------------------------------------------------------------------------

export interface AdvanceDay {
  dayNumber: number;
  date: string;
  location: string;
  callTime: string;
  sceneNumbers: string[];
  eighths: number;
}

/**
 * The advance block — what is coming after this day.
 *
 * Read from the schedule rather than typed, so it cannot contradict it. The
 * next day by date, not by day number: days get renumbered and reordered, and
 * the crew care about which morning arrives next.
 */
export function advanceDay<T extends DayLike & { id: string; date: string; dayNumber: number; location?: string; callTime?: string }>(
  schedule: T[],
  currentDayId: string,
  scenes: SceneLike[],
): AdvanceDay | null {
  const current = (schedule ?? []).find(d => d.id === currentDayId);
  if (!current) return null;

  const later = (schedule ?? [])
    .filter(d => d.id !== currentDayId && String(d.date ?? '') > String(current.date ?? ''))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const next = later[0];
  if (!next) return null;

  const nextScenes = resolveDayScenes(next, scenes);
  return {
    dayNumber: next.dayNumber,
    date: next.date,
    location: String(next.location ?? ''),
    callTime: String(next.callTime ?? ''),
    sceneNumbers: nextScenes.length > 0
      ? nextScenes.map(s => s.number)
      : (sceneListLabel(next, scenes) === '—' ? [] : [sceneListLabel(next, scenes)]),
    eighths: dayTotals(nextScenes).eighths,
  };
}

// ---------------------------------------------------------------------------
// Cast
// ---------------------------------------------------------------------------

export interface CastMemberLike {
  id: string;
  characterName: string;
  actorName: string;
  status?: string;
  /**
   * The production's cast number — #1 is the lead. Set once and stable for the
   * whole shoot, which is the point: crew say "cast 3" and mean the same
   * person on every day.
   */
  castNumber?: number | null;
  /** Fallback ordering when no number has been assigned. */
  createdAt?: string;
}

export interface CastCallTimeLike {
  castMemberId: string;
  makeupTime?: string;
  wardrobeTime?: string;
  onSetTime?: string;
}

export interface CastRow {
  castMemberId: string;
  /** The production's cast number, or null when none is assigned. */
  castNumber: number | null;
  character: string;
  actor: string;
  status: string;
  /** Blank means this person is on the general call. */
  makeupTime: string;
  wardrobeTime: string;
  onSetTime: string;
  /** The day's scenes this character appears in, in the day's order. */
  sceneNumbers: string[];
}

/**
 * One day's cast times, keyed by cast member.
 *
 * A Map because every lookup is "what is this person's makeup call", and the
 * absence of a row is the normal case — nobody has to be given a time for the
 * sheet to be correct.
 */
export function castTimesForDay<T extends CastCallTimeLike & { scheduleDayId: string }>(
  entries: T[],
  scheduleDayId: string | null,
): Map<string, T> {
  const byCastMember = new Map<string, T>();
  if (!scheduleDayId) return byCastMember;
  for (const entry of entries ?? []) {
    if (entry.scheduleDayId === scheduleDayId) byCastMember.set(entry.castMemberId, entry);
  }
  return byCastMember;
}

/**
 * Character names are typed twice — once on the breakdown, once on the cast
 * card — by the same person on different days, so they are compared without
 * case or repeated spaces.
 */
export function normalizeCharacterName(value: string): string {
  return String(value ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
}

/**
 * The cast table: everyone working that day, with their times.
 *
 * Ordered by how much of the day they carry — most scenes first — because that
 * is the order a first AD reads the table in, not alphabetically.
 */
export function castRows(
  cast: CastMemberLike[],
  scenes: SceneLike[],
  times: Map<string, CastCallTimeLike> | null,
): CastRow[] {
  const scenesByCharacter = indexScenesByCharacter(scenes);

  const rows: CastRow[] = [];
  for (const member of cast ?? []) {
    const sceneNumbers = scenesByCharacter.get(normalizeCharacterName(member.characterName));
    if (!sceneNumbers?.length) continue;
    rows.push(buildCastRow(member, sceneNumbers, times?.get(member.id)));
  }

  // Cast number first, because that is the order a crew reads. Sorting by how
  // many of the day's scenes someone is in looks like importance and is not:
  // it reshuffles the running order every day, so the lead is first on Monday
  // and third on Tuesday. Unnumbered cast keep a stable order behind the
  // numbered ones, by when they were added rather than by anything per-day.
  const order = new Map((cast ?? []).map((m, i) => [m.id, i]));
  return rows.sort((a, b) => {
    if (a.castNumber !== b.castNumber) {
      if (a.castNumber === null) return 1;
      if (b.castNumber === null) return -1;
      return a.castNumber - b.castNumber;
    }
    return (order.get(a.castMemberId) ?? 0) - (order.get(b.castMemberId) ?? 0);
  });
}

/** Which of the day's scenes each character appears in, in the day's order. */
function indexScenesByCharacter(scenes: SceneLike[]): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const scene of scenes ?? []) {
    for (const name of scene.cast ?? []) {
      const key = normalizeCharacterName(name);
      if (!key) continue;
      const list = index.get(key);
      if (list) list.push(scene.number); else index.set(key, [scene.number]);
    }
  }
  return index;
}

/** A blank time means the general call, so absence reads as '' and never undefined. */
function buildCastRow(
  member: CastMemberLike,
  sceneNumbers: string[],
  entry: CastCallTimeLike | undefined,
): CastRow {
  const time = (value: string | undefined) => String(value ?? '').trim();
  return {
    castMemberId: member.id,
    castNumber: Number.isFinite(member.castNumber as number)
      ? (member.castNumber as number) : null,
    character: member.characterName,
    actor: member.actorName,
    status: member.status ?? '',
    makeupTime: time(entry?.makeupTime),
    wardrobeTime: time(entry?.wardrobeTime),
    onSetTime: time(entry?.onSetTime),
    sceneNumbers,
  };
}
