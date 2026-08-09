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
// Cast
// ---------------------------------------------------------------------------

export interface CastMemberLike {
  id: string;
  characterName: string;
  actorName: string;
  status?: string;
}

export interface CastCallTimeLike {
  castMemberId: string;
  makeupTime?: string;
  wardrobeTime?: string;
  onSetTime?: string;
}

export interface CastRow {
  castMemberId: string;
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

  return rows.sort((a, b) =>
    b.sceneNumbers.length - a.sceneNumbers.length ||
    a.character.localeCompare(b.character));
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
    character: member.characterName,
    actor: member.actorName,
    status: member.status ?? '',
    makeupTime: time(entry?.makeupTime),
    wardrobeTime: time(entry?.wardrobeTime),
    onSetTime: time(entry?.onSetTime),
    sceneNumbers,
  };
}
