// ---------------------------------------------------------------------------
// lib/sceneMigration.ts — Derive Scene records from existing data
//
// Scenes used to exist only as a loose `sceneNumber: number` scattered across
// shots, breakdowns, sides, continuity and selects (#53). This runs once and
// builds real Scene records from what the user already has:
//
//   1. Every SceneBreakdown becomes a Scene — it already carried the heading,
//      INT/EXT, time of day, location, cast and page count.
//   2. Every scene number referenced by a shot but with no breakdown becomes a
//      stub Scene, so nothing a user has shot-listed disappears from the list.
//   3. Shots are backfilled with `sceneId`.
//
// Breakdown records are left in place rather than deleted. They are no longer
// read, but keeping them means this migration is reversible if a scene turns
// out to have been derived wrongly, and it costs one unread storage key.
// ---------------------------------------------------------------------------

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Scene, SceneBreakdown, Shot, SceneIntExt, SceneTimeOfDay } from '@/types';
import { parseEighths } from '@/utils/eighths';

const MIGRATION_KEY = 'mise_scene_migration_v1';
const SCENES_KEY = 'mise_scenes';
const BREAKDOWNS_KEY = 'mise_scene_breakdowns';
const SHOTS_KEY = 'mise_shots';

export interface SceneMigrationResult {
  /** Scenes built from existing breakdown records. */
  fromBreakdowns: number;
  /** Stub scenes created for shot-only scene numbers. */
  fromShots: number;
  /** Shots given a sceneId. */
  shotsLinked: number;
}

export async function hasRunSceneMigration(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(MIGRATION_KEY)) === 'done';
  } catch {
    return false;
  }
}

async function readArray<T>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

/** Build the slugline a breakdown implies, e.g. "INT. LIGHTHOUSE - NIGHT". */
function buildHeading(intExt: string, name: string, location: string, timeOfDay: string): string {
  const where = (name || location || '').trim();
  const when = String(timeOfDay || '').replace(/-/g, ' ').toUpperCase();
  const prefix = String(intExt || 'INT').toUpperCase();
  if (!where) return `${prefix}. ${when}`.trim();
  return `${prefix}. ${where.toUpperCase()}${when ? ` - ${when}` : ''}`;
}

function sceneFromBreakdown(b: SceneBreakdown): Scene {
  const stamp = nowIso();
  return {
    id: `scene-${b.id}`,
    projectId: b.projectId,
    number: String(b.sceneNumber ?? '').trim() || '1',
    heading: buildHeading(b.intExt, b.sceneName, b.location, b.timeOfDay),
    intExt: (b.intExt ?? 'INT') as SceneIntExt,
    timeOfDay: (b.timeOfDay ?? 'day') as SceneTimeOfDay,
    location: b.location ?? '',
    pageEighths: parseEighths(b.pageCount),
    cast: Array.isArray(b.cast) ? b.cast : [],
    extras: b.extras ?? '',
    props: Array.isArray(b.props) ? b.props : [],
    wardrobe: Array.isArray(b.wardrobe) ? b.wardrobe : [],
    specialEquipment: Array.isArray(b.specialEquipment) ? b.specialEquipment : [],
    synopsis: b.sceneName ?? '',
    notes: b.notes ?? '',
    createdAt: stamp,
    updatedAt: stamp,
  };
}

function stubScene(projectId: string, number: string): Scene {
  const stamp = nowIso();
  return {
    id: `scene-stub-${projectId}-${number}`,
    projectId,
    number,
    heading: `Scene ${number}`,
    intExt: 'INT',
    timeOfDay: 'day',
    location: '',
    pageEighths: 0,
    cast: [],
    extras: '',
    props: [],
    wardrobe: [],
    specialEquipment: [],
    synopsis: '',
    notes: '',
    createdAt: stamp,
    updatedAt: stamp,
  };
}

const keyOf = (projectId: string, number: string) =>
  `${projectId}::${String(number).trim().toUpperCase()}`;

/** Fold breakdown records and shot-only scene numbers into the scene index. */
function collectScenes(
  byNumber: Map<string, Scene>,
  breakdowns: SceneBreakdown[],
  shots: Shot[],
  result: SceneMigrationResult,
): void {
  for (const breakdown of breakdowns) {
    if (!breakdown?.projectId) continue;
    const scene = sceneFromBreakdown(breakdown);
    if (byNumber.has(keyOf(scene.projectId, scene.number))) continue;
    byNumber.set(keyOf(scene.projectId, scene.number), scene);
    result.fromBreakdowns += 1;
  }

  for (const shot of shots) {
    if (!shot?.projectId) continue;
    const number = String(shot.sceneNumber ?? '').trim();
    if (!number) continue;
    if (byNumber.has(keyOf(shot.projectId, number))) continue;
    byNumber.set(keyOf(shot.projectId, number), stubScene(shot.projectId, number));
    result.fromShots += 1;
  }
}

export async function runSceneMigration(): Promise<SceneMigrationResult> {
  const result: SceneMigrationResult = { fromBreakdowns: 0, fromShots: 0, shotsLinked: 0 };

  const [existingScenes, breakdowns, shots] = await Promise.all([
    readArray<Scene>(SCENES_KEY),
    readArray<SceneBreakdown>(BREAKDOWNS_KEY),
    readArray<Shot>(SHOTS_KEY),
  ]);

  // Index by project + scene number so a re-run cannot duplicate a scene.
  const byNumber = new Map<string, Scene>();
  for (const scene of existingScenes) byNumber.set(keyOf(scene.projectId, scene.number), scene);

  collectScenes(byNumber, breakdowns, shots, result);

  const scenes = Array.from(byNumber.values());

  // Backfill shot -> scene links.
  let shotsChanged = false;
  const linkedShots = shots.map(shot => {
    if (shot?.sceneId || !shot?.projectId) return shot;
    const scene = byNumber.get(keyOf(shot.projectId, String(shot.sceneNumber ?? '')));
    if (!scene) return shot;
    shotsChanged = true;
    result.shotsLinked += 1;
    return { ...shot, sceneId: scene.id };
  });

  if (scenes.length > 0) {
    await AsyncStorage.setItem(SCENES_KEY, JSON.stringify(scenes));
  }
  if (shotsChanged) {
    await AsyncStorage.setItem(SHOTS_KEY, JSON.stringify(linkedShots));
  }

  try {
    await AsyncStorage.setItem(MIGRATION_KEY, 'done');
  } catch {}

  return result;
}
