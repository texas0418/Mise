/**
 * scripts/test-id-migration.ts
 *
 *   bun scripts/test-id-migration.ts
 *
 * The one-time move from Date.now() ids to the server's uuids
 * (lib/idMigration.ts). Every assertion here protects real data on a phone
 * that already holds a production: an id mapped differently from the push
 * path orphans the server copy, a foreign key left behind detaches a shot
 * from its film, and a second run must change nothing.
 */
import { runIdMigrationIfNeeded, ID_MIGRATION_FLAG, type KeyValueStorage } from '@/lib/idMigration';
import { deterministicUUID, isValidUUID } from '@/lib/syncIds';

let pass = 0;
let fail = 0;

function ok(label: string, condition: boolean, detail = '') {
  if (condition) { pass++; return; }
  fail++;
  console.log(`FAIL ${label}${detail ? ` - ${detail}` : ''}`);
}

function memoryStorage(initial: Record<string, unknown>): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  for (const [k, v] of Object.entries(initial)) data.set(k, typeof v === 'string' ? v : JSON.stringify(v));
  return {
    data,
    async getItem(key) { return data.has(key) ? data.get(key)! : null; },
    async setItem(key, value) { data.set(key, value); },
  };
}

const read = (s: { data: Map<string, string> }, key: string) => JSON.parse(s.data.get(key) ?? 'null');

const P = '1730000000000';
const SHOT = '1730000000001';
const CAST = '1730000000002';
const DAY = '1730000000003';
const P_UUID = deterministicUUID(P);
const SHOT_UUID = deterministicUUID(SHOT);
const T0 = '2026-10-01T10:00:00.000Z';
const T1 = '2026-10-02T10:00:00.000Z';

const storage = memoryStorage({
  mise_projects: [
    { id: P, title: 'Local title', logline: 'only local', updatedAt: T0 },
    // The copy the old pull added under the server id:
    { id: P_UUID, title: 'Server title', userId: '11111111-2222-4333-8444-555555555555', updatedAt: T1 },
  ],
  mise_shots: [{ id: SHOT, projectId: P, sceneId: 'scene-5', description: 'Wide' }],
  mise_script_sides: [{ id: '1730000000009', projectId: P, castIds: [CAST, ''], linkedShotIds: [SHOT] }],
  mise_time_entries: [{ id: '1730000000010', projectId: P, scheduleDayId: DAY, crewMemberId: '' }],
  mise_crew_assignments: [{ id: `assign-${P}-42`, projectId: P, crewMemberId: '42' }],
  mise_lighting_diagrams: [{ id: '1730000000011', projectId: P, elements: [{ id: 'el-1', type: 'light' }] }],
  mise_active_project: P,
  mise_sync_queue: [
    { queueId: 'q1', table: 'shots', recordId: SHOT, action: 'update', data: { id: SHOT, projectId: P }, retryCount: 0 },
    { queueId: 'q2', table: 'shots', recordId: '1730000000099', action: 'delete', data: null, retryCount: 0 },
  ],
  mise_import_history: [{ id: 'batch-1', entityKey: 'shots', itemIds: [SHOT] }],
  mise_review_asked: 'true',
});

const first = await runIdMigrationIfNeeded(storage);
ok('the first run runs', first.ran);
ok('the flag is written', storage.data.has(ID_MIGRATION_FLAG));

// ─── Ids and foreign keys ──────────────────────────────────────────────────

const projects = read(storage, 'mise_projects');
ok('a numeric id becomes the server uuid', projects.every((p: any) => p.id === P_UUID));
const shots = read(storage, 'mise_shots');
ok('the shot id is mapped', shots[0].id === SHOT_UUID);
ok('the shot projectId is mapped', shots[0].projectId === P_UUID);
ok('a non-numeric local link is mapped the push way', shots[0].sceneId === deterministicUUID('scene-5'));
const assignment = read(storage, 'mise_crew_assignments')[0];
ok('a hashed id is mapped the push way', assignment.id === deterministicUUID(`assign-${P}-42`));
ok('every id in every store is a uuid', [projects, shots, read(storage, 'mise_crew_assignments')]
  .flat().every((r: any) => isValidUUID(r.id)));

// ─── Arrays of ids ─────────────────────────────────────────────────────────

const side = read(storage, 'mise_script_sides')[0];
ok('castIds are mapped', side.castIds[0] === deterministicUUID(CAST));
ok('linkedShotIds are mapped', side.linkedShotIds[0] === SHOT_UUID);
ok('an empty id in a list is left as it was', side.castIds[1] === '');

// ─── Empty foreign keys, nested ids ────────────────────────────────────────

const entry = read(storage, 'mise_time_entries')[0];
ok('an empty foreign key becomes null', entry.crewMemberId === null);
ok('a populated foreign key is mapped', entry.scheduleDayId === deterministicUUID(DAY));
const diagram = read(storage, 'mise_lighting_diagrams')[0];
ok('nested element ids are not touched', diagram.elements[0].id === 'el-1');

// ─── Dedupe ────────────────────────────────────────────────────────────────

ok('the duplicate project is merged into one', projects.length === 1, `got ${projects.length}`);
ok('the newer copy wins a field both have', projects[0].title === 'Server title');
ok('a field only the older copy has survives', projects[0].logline === 'only local');
ok('the server user id survives the merge', projects[0].userId === '11111111-2222-4333-8444-555555555555');
ok('the result counts the merge', first.duplicatesMerged === 1);

// ─── Active project, queue, import history ─────────────────────────────────

ok('the active project id is mapped', storage.data.get('mise_active_project') === P_UUID);
const queue = read(storage, 'mise_sync_queue');
ok('a queued recordId is mapped', queue[0].recordId === SHOT_UUID);
ok('queued data is mapped', queue[0].data.id === SHOT_UUID && queue[0].data.projectId === P_UUID);
ok('a queued delete is mapped', queue[1].recordId === deterministicUUID('1730000000099'));
ok('import undo ids are mapped', read(storage, 'mise_import_history')[0].itemIds[0] === SHOT_UUID);
ok('unrelated keys are untouched', storage.data.get('mise_review_asked') === 'true');

// ─── Idempotence ───────────────────────────────────────────────────────────

const snapshot = JSON.stringify([...storage.data.entries()].filter(([k]) => k !== ID_MIGRATION_FLAG));
const second = await runIdMigrationIfNeeded(storage);
ok('a second run is skipped by the flag', second.ran === false);

storage.data.delete(ID_MIGRATION_FLAG);
const forced = await runIdMigrationIfNeeded(storage);
const after = JSON.stringify([...storage.data.entries()].filter(([k]) => k !== ID_MIGRATION_FLAG));
ok('a rerun without the flag changes nothing', forced.ran && after === snapshot);
ok('a rerun merges nothing', forced.duplicatesMerged === 0);

// ─── Bad data does not stop it ─────────────────────────────────────────────

const broken = memoryStorage({ mise_shots: 'not json', mise_takes: { not: 'a list' } });
const r = await runIdMigrationIfNeeded(broken);
ok('unreadable stores are skipped, not fatal', r.ran && broken.data.get('mise_shots') === 'not json');

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
