/**
 * utils/today.ts
 *
 * The arithmetic behind the Today view: which shoot day is happening now, how
 * far into it we are, how much of the day's work is done, and who was called.
 *
 * Dependency-free on purpose, like utils/eighths.ts — no imports at all, not
 * even sibling modules, so the whole thing runs under
 * `node --experimental-strip-types` without a bundler. The date handling in
 * here is the part most worth testing, and it is untestable the moment this
 * file reaches for a native module.
 */

const MINUTES_PER_DAY = 24 * 60;

// ---------------------------------------------------------------------------
// Structural inputs
//
// Declared locally rather than imported from @/types: the alias needs a
// bundler to resolve, which would cost this module its node-testability. Every
// shape below is a subset of the real entity, so the real ones satisfy it.
// ---------------------------------------------------------------------------

export interface ShootDayLike {
  id: string;
  /** YYYY-MM-DD, the way ScheduleDay stores it. */
  date: string;
  dayNumber: number;
  callTime?: string;
  wrapTime?: string;
  sceneIds?: string[];
}

export interface SceneLike {
  id: string;
  /** As written on the page — "14", "14A". */
  number: string;
  pageEighths: number;
  cast?: string[];
}

export interface ShotLike {
  id: string;
  sceneId?: string;
  sceneNumber: number | string;
  status: string;
}

export interface CastLike {
  id: string;
  characterName: string;
  scenes?: number[];
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

/**
 * Today, as the YYYY-MM-DD key a ScheduleDay is stored under.
 *
 * Built from the local calendar fields rather than `toISOString().slice(0,10)`,
 * which is UTC: anywhere west of Greenwich that shortcut rolls over to tomorrow
 * during the evening, so a director in New York would lose the current shoot
 * day from 8pm onwards — exactly when a night shoot is running.
 */
export function localDateKey(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Minutes elapsed in the local day, which is what the clock arithmetic uses. */
export function localMinutes(now: Date): number {
  return now.getHours() * 60 + now.getMinutes();
}

/** Whole days from one YYYY-MM-DD key to another; negative when `to` is earlier. */
export function daysBetweenKeys(from: string, to: string): number {
  const start = parseDateKey(from);
  const end = parseDateKey(to);
  if (start === null || end === null) return 0;
  return Math.round((end - start) / (MINUTES_PER_DAY * 60 * 1000));
}

/** Local midnight for a YYYY-MM-DD key, as epoch ms. Null when unparseable. */
function parseDateKey(key: string): number | null {
  const m = String(key ?? '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
}

// ---------------------------------------------------------------------------
// Clock times
//
// Call and wrap are free text typed by a human, so they arrive in every shape
// a person writes a time in. Anything unrecognised returns null and the screen
// shows nothing rather than a made-up hour.
// ---------------------------------------------------------------------------

/** Minutes since local midnight for "7:00 AM", "0700", "17:30", "5:30p". */
export function parseClockTime(input: string | null | undefined): number | null {
  const text = String(input ?? '').trim().toLowerCase().replace(/\./g, '');
  if (!text) return null;

  const meridiem = text.match(/^(\d{1,2})(?::?(\d{2}))?\s*([ap])m?$/);
  if (meridiem) {
    const hour = Number(meridiem[1]);
    const minute = Number(meridiem[2] ?? '0');
    if (hour < 1 || hour > 12 || minute > 59) return null;
    const base = (hour % 12) * 60 + minute;
    return meridiem[3] === 'p' ? base + 12 * 60 : base;
  }

  const colon = text.match(/^(\d{1,2}):(\d{2})$/);
  if (colon) return clampTimeOfDay(Number(colon[1]), Number(colon[2]));

  // "0700" and "700" — how a call sheet abbreviates it.
  const bare = text.match(/^(\d{3,4})$/);
  if (bare) {
    const digits = bare[1];
    const hour = Number(digits.slice(0, digits.length - 2));
    return clampTimeOfDay(hour, Number(digits.slice(-2)));
  }

  return null;
}

function clampTimeOfDay(hour: number, minute: number): number | null {
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

/** Render minutes-since-midnight the way a call sheet prints it: "7:00 AM". */
export function formatClock(minutes: number): string {
  const total = ((Math.round(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hour24 = Math.floor(total / 60);
  const minute = total % 60;
  const suffix = hour24 < 12 ? 'AM' : 'PM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

/** "3h 20m", "45m", "0m" — durations, not times of day. */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

// ---------------------------------------------------------------------------
// Which day is it
// ---------------------------------------------------------------------------

export type DayRelation = 'today' | 'upcoming' | 'wrapped' | 'none';

export interface DaySelection<T extends ShootDayLike> {
  day: T | null;
  relation: DayRelation;
  /** Days from today to that day: 0 today, positive future, negative past. */
  daysAway: number;
}

/**
 * The shoot day to show: today's if there is one, otherwise the next one
 * coming, otherwise the last one shot.
 *
 * The fallbacks matter more than the hit. Most days of a production are not
 * shoot days, and a screen that says only "nothing today" on those days is a
 * screen nobody opens in prep.
 */
export function pickShootDay<T extends ShootDayLike>(days: T[], todayKey: string): DaySelection<T> {
  const dated = (days ?? []).filter(d => parseDateKey(d.date) !== null);
  if (dated.length === 0) return { day: null, relation: 'none', daysAway: 0 };

  const sorted = [...dated].sort((a, b) => a.date.localeCompare(b.date));

  const current = sorted.find(d => d.date === todayKey);
  if (current) return { day: current, relation: 'today', daysAway: 0 };

  const next = sorted.find(d => d.date > todayKey);
  if (next) return { day: next, relation: 'upcoming', daysAway: daysBetweenKeys(todayKey, next.date) };

  const last = sorted[sorted.length - 1];
  return { day: last, relation: 'wrapped', daysAway: daysBetweenKeys(todayKey, last.date) };
}

/**
 * How many days the production runs to — the "of 12" beside "Day 4".
 *
 * The highest day number, not the number of records: deleting day 2 of a
 * three-day shoot leaves two records and a day still numbered 3, and counting
 * records would print "Day 3 of 2".
 */
export function totalDayCount(days: ShootDayLike[]): number {
  let highest = 0;
  for (const day of days ?? []) {
    const n = Number(day.dayNumber);
    if (Number.isFinite(n) && n > highest) highest = n;
  }
  return Math.max(highest, (days ?? []).length);
}

/**
 * Same choice, but aware that a night shoot outlives its own date.
 *
 * Call 6pm, wrap 4am: at 1am the calendar has already rolled over, so a plain
 * date match drops the day the unit is still standing on and offers tomorrow's
 * instead. Yesterday's day wins while its window is still open.
 */
export function resolveCurrentDay<T extends ShootDayLike>(days: T[], now: Date): DaySelection<T> {
  const todayKey = localDateKey(now);
  const direct = pickShootDay(days, todayKey);
  if (direct.relation === 'today') return direct;

  const nowMinutes = localMinutes(now);
  const yesterdayKey = localDateKey(new Date(now.getTime() - MINUTES_PER_DAY * 60 * 1000));
  const yesterday = (days ?? []).find(d => d.date === yesterdayKey);
  if (!yesterday) return direct;

  const call = parseClockTime(yesterday.callTime);
  const wrap = parseClockTime(yesterday.wrapTime);
  // Only an overnight window can still be running, and only until it wraps.
  if (call === null || wrap === null || wrap > call || nowMinutes >= wrap) return direct;

  return { day: yesterday, relation: 'today', daysAway: 0 };
}

// ---------------------------------------------------------------------------
// Where we are in the day
// ---------------------------------------------------------------------------

export type DayPhase = 'unknown' | 'before-call' | 'shooting' | 'wrapped';

export interface DayProgress {
  phase: DayPhase;
  /** Minutes since call, 0 before it. */
  elapsedMinutes: number;
  /** Minutes to wrap, 0 once past it. */
  remainingMinutes: number;
  /** Call to wrap. 0 when either end is unreadable. */
  totalMinutes: number;
  /** How much of the scheduled day has gone, 0–1. */
  fraction: number;
  /** Minutes until call; 0 once called. */
  untilCallMinutes: number;
}

/**
 * Position in the shooting day.
 *
 * A wrap at or before the call means an overnight day, so the window is pushed
 * into tomorrow rather than treated as negative-length — and a `now` that sits
 * before the call inside such a window is the small hours of that same night,
 * not the morning before it.
 */
export function dayProgress(
  callMinutes: number | null,
  wrapMinutes: number | null,
  nowMinutes: number,
): DayProgress {
  const empty: DayProgress = {
    phase: 'unknown', elapsedMinutes: 0, remainingMinutes: 0,
    totalMinutes: 0, fraction: 0, untilCallMinutes: 0,
  };
  if (callMinutes === null || wrapMinutes === null) return empty;

  const end = wrapMinutes <= callMinutes ? wrapMinutes + MINUTES_PER_DAY : wrapMinutes;
  const overnight = end > MINUTES_PER_DAY;
  const current = overnight && nowMinutes < callMinutes && nowMinutes + MINUTES_PER_DAY <= end
    ? nowMinutes + MINUTES_PER_DAY
    : nowMinutes;

  const totalMinutes = end - callMinutes;

  if (current < callMinutes) {
    return {
      phase: 'before-call', elapsedMinutes: 0, remainingMinutes: totalMinutes,
      totalMinutes, fraction: 0, untilCallMinutes: callMinutes - current,
    };
  }

  if (current >= end) {
    return {
      phase: 'wrapped', elapsedMinutes: totalMinutes, remainingMinutes: 0,
      totalMinutes, fraction: 1, untilCallMinutes: 0,
    };
  }

  const elapsedMinutes = current - callMinutes;
  return {
    phase: 'shooting',
    elapsedMinutes,
    remainingMinutes: end - current,
    totalMinutes,
    fraction: totalMinutes > 0 ? elapsedMinutes / totalMinutes : 0,
    untilCallMinutes: 0,
  };
}

// ---------------------------------------------------------------------------
// The day's work
// ---------------------------------------------------------------------------

/** Scenes scheduled for a day, in the order the day lists them. */
export function scenesForDay<T extends SceneLike>(day: ShootDayLike | null, scenes: T[]): T[] {
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
 * Shots belonging to a set of scenes.
 *
 * An explicit `sceneId` is the whole answer when a shot has one; the loose
 * number is consulted only for shots that have no link, which is what it exists
 * for. Treating the two as alternatives instead double-counts: a shot on scene
 * 12A stores `sceneNumber: 12`, because that field is a number and `parseInt`
 * threw the letter away, so it would be claimed by scene 12 as well as by the
 * 12A it is actually linked to.
 */
export function shotsForScenes<T extends ShotLike>(shots: T[], scenes: SceneLike[]): T[] {
  if (scenes.length === 0) return [];
  const ids = new Set(scenes.map(s => s.id));
  const numbers = new Set(scenes.map(s => normalizeSceneNumber(s.number)));

  return (shots ?? []).filter(shot => shot.sceneId
    ? ids.has(shot.sceneId)
    : numbers.has(normalizeSceneNumber(shot.sceneNumber)));
}

function normalizeSceneNumber(value: string | number | undefined | null): string {
  return String(value ?? '').trim().toUpperCase();
}

/** A shot counts as done once it is in the can; approved is done twice over. */
export function isShotComplete(status: string): boolean {
  return status === 'shot' || status === 'approved';
}

export interface WorkSummary {
  sceneCount: number;
  scenesCompleted: number;
  shotsPlanned: number;
  shotsCompleted: number;
  eighthsPlanned: number;
  eighthsCompleted: number;
}

/**
 * What the day holds and how much of it is behind us.
 *
 * Pages only count when the whole scene is covered: half a scene shot is not
 * half its pages in the can, and a scene with no shots listed cannot be judged
 * complete at all, so it stays outstanding rather than flattering the number.
 */
export function summarizeWork(scenes: SceneLike[], shots: ShotLike[]): WorkSummary {
  const dayShots = shotsForScenes(shots, scenes);
  const shotsByScene = groupShotsByScene(scenes, dayShots);

  let scenesCompleted = 0;
  let eighthsPlanned = 0;
  let eighthsCompleted = 0;

  for (const scene of scenes) {
    const own = shotsByScene.get(scene.id) ?? [];
    const eighths = Math.max(0, scene.pageEighths || 0);
    eighthsPlanned += eighths;
    if (own.length > 0 && own.every(s => isShotComplete(s.status))) {
      scenesCompleted += 1;
      eighthsCompleted += eighths;
    }
  }

  return {
    sceneCount: scenes.length,
    scenesCompleted,
    shotsPlanned: dayShots.length,
    shotsCompleted: dayShots.filter(s => isShotComplete(s.status)).length,
    eighthsPlanned,
    eighthsCompleted,
  };
}

function groupShotsByScene(scenes: SceneLike[], shots: ShotLike[]): Map<string, ShotLike[]> {
  const idByNumber = new Map(scenes.map(s => [normalizeSceneNumber(s.number), s.id]));
  const grouped = new Map<string, ShotLike[]>();

  for (const shot of shots) {
    // Same precedence as shotsForScenes: the link if there is one, the number
    // only when there is not.
    const id = shot.sceneId ?? idByNumber.get(normalizeSceneNumber(shot.sceneNumber));
    if (!id) continue;
    const bucket = grouped.get(id);
    if (bucket) bucket.push(shot); else grouped.set(id, [shot]);
  }

  return grouped;
}

// ---------------------------------------------------------------------------
// Who is called
// ---------------------------------------------------------------------------

/**
 * Cast working in the day's scenes.
 *
 * Scenes hold character names and cast records hold a character name plus a
 * list of scene numbers, so either link is enough to be called. Names are
 * compared case- and space-insensitively because they are typed twice, in two
 * different screens, by the same person on different days.
 */
export function castCalledFor<T extends CastLike>(cast: T[], scenes: SceneLike[]): T[] {
  if (scenes.length === 0) return [];
  const characters = new Set<string>();
  const numbers = new Set<string>();

  for (const scene of scenes) {
    numbers.add(normalizeSceneNumber(scene.number));
    for (const name of scene.cast ?? []) characters.add(normalizeName(name));
  }

  return (cast ?? []).filter(member =>
    characters.has(normalizeName(member.characterName)) ||
    (member.scenes ?? []).some(n => numbers.has(normalizeSceneNumber(n))));
}

function normalizeName(value: string): string {
  return String(value ?? '').trim().toUpperCase().replace(/\s+/g, ' ');
}

// ---------------------------------------------------------------------------
// Pace
// ---------------------------------------------------------------------------

export type PaceStatus = 'ahead' | 'on-track' | 'behind' | 'unknown';

export interface Pace {
  /** Share of the day's work done, 0–1. */
  workFraction: number;
  /** Share of the day's hours gone, 0–1. */
  timeFraction: number;
  status: PaceStatus;
  /** Where the day lands at the current rate, in minutes since midnight. */
  projectedWrapMinutes: number | null;
  /**
   * Minutes past the scheduled wrap that lands on; negative is early.
   *
   * Computed here rather than by subtracting the wrap time on screen, because
   * an overnight wrap is a smaller number than its call — comparing the two
   * raw would have called a 30-hour overrun 54 hours.
   */
  overrunMinutes: number | null;
}

/** Anything inside this of the clock is on schedule, not ahead or behind. */
const PACE_TOLERANCE = 0.05;

/**
 * Are we making the day?
 *
 * Measured in pages when the scenes have page counts, and in shots when they
 * do not — pages are how a day is actually judged, but an unbroken-down script
 * still deserves an answer.
 *
 * The projection is a straight extrapolation of the rate so far, which is
 * honest about the morning being slower than the afternoon only in that it
 * makes no claim to know better.
 */
export function computePace(
  work: WorkSummary,
  progress: DayProgress,
  callMinutes: number | null,
): Pace {
  const workFraction = work.eighthsPlanned > 0
    ? work.eighthsCompleted / work.eighthsPlanned
    : (work.shotsPlanned > 0 ? work.shotsCompleted / work.shotsPlanned : 0);

  const timeFraction = progress.fraction;
  const measurable = (work.eighthsPlanned > 0 || work.shotsPlanned > 0) && progress.phase === 'shooting';

  if (!measurable) {
    return {
      workFraction, timeFraction, status: 'unknown',
      projectedWrapMinutes: null, overrunMinutes: null,
    };
  }

  const delta = workFraction - timeFraction;
  let status: PaceStatus = 'on-track';
  if (delta > PACE_TOLERANCE) status = 'ahead';
  else if (delta < -PACE_TOLERANCE) status = 'behind';

  // Nothing shot yet extrapolates to infinity, so it stays unanswered.
  const canProject = workFraction > 0 && progress.elapsedMinutes > 0 && callMinutes !== null;
  if (!canProject) {
    return { workFraction, timeFraction, status, projectedWrapMinutes: null, overrunMinutes: null };
  }

  const projectedWrapMinutes = callMinutes + Math.round(progress.elapsedMinutes / workFraction);
  // The scheduled end in the same unwrapped frame the projection uses.
  const scheduledEnd = callMinutes + progress.totalMinutes;

  return {
    workFraction, timeFraction, status,
    projectedWrapMinutes,
    overrunMinutes: projectedWrapMinutes - scheduledEnd,
  };
}
