/**
 * scripts/test-sync-roundtrip.ts
 *
 *   bun scripts/test-sync-roundtrip.ts
 *
 * A record pushed and then pulled back must be one record, not two.
 *
 * Until 1.3.3 local ids were Date.now() strings. The push rewrote them to
 * deterministicUUID(); the pull came back under that uuid, never matched the
 * numeric original, and stored a second copy of every synced record. These
 * assertions drive the push and pull row builders the sync engine uses, with
 * a stand-in for the server that stores exactly what was upserted.
 */
import { buildPushRow, buildUploadRow, mergePulledRows, dedupeById, softDeletePatch } from '@/lib/syncMerge';
import { deterministicUUID, ensureUUID, isValidUUID, mapRecordIds } from '@/lib/syncIds';
import { newId } from '@/lib/newId';

let pass = 0;
let fail = 0;

function ok(label: string, condition: boolean, detail = '') {
  if (condition) { pass++; return; }
  fail++;
  console.log(`FAIL ${label}${detail ? ` - ${detail}` : ''}`);
}

const USER = '11111111-2222-4333-8444-555555555555';
const OTHER = '99999999-8888-4777-a666-555555555555';
const T0 = '2026-11-01T10:00:00.000Z';
const T1 = '2026-11-01T11:00:00.000Z';

/** The server: upsert by id, return rows as stored. */
function server() {
  const rows = new Map<string, Record<string, any>>();
  return {
    upsert(row: Record<string, any>) { rows.set(row.id, { ...rows.get(row.id), ...row }); },
    all() { return Array.from(rows.values()); },
  };
}

// ─── newId ──────────────────────────────────────────────────────────────────

const ids = new Set(Array.from({ length: 500 }, () => newId()));
ok('newId returns a valid uuid', [...ids].every(isValidUUID));
ok('newId is version 4', [...ids].every((id) => id[14] === '4'));
ok('newId does not repeat in 500 calls', ids.size === 500);
ok('a newId passes through ensureUUID unchanged', [...ids].every((id) => ensureUUID(id) === id));

// ─── Round trip with a new uuid record ──────────────────────────────────────

{
  const db = server();
  const shotId = newId();
  const projectId = newId();
  const local = [{ id: shotId, projectId, description: 'Wide', updatedAt: T0, createdAt: T0 }];
  db.upsert(buildPushRow('shots', local[0], USER, 'insert', T1));
  const { items } = mergePulledRows('shots', local, db.all());
  ok('push then pull leaves one record', items.length === 1, `got ${items.length}`);
  ok('the pulled record keeps its id', items[0].id === shotId);
  ok('the pulled record carries the server user', items[0].userId === USER);
}

// ─── Round trip with a legacy numeric record, after the id migration ───────

{
  const db = server();
  const legacy = { id: '1730000000000', projectId: '1729999999999', description: 'Close', updatedAt: T0 };
  // What 1.3.2 pushed:
  db.upsert(buildPushRow('shots', legacy, USER, 'insert', T0));
  // What the migration leaves on the phone:
  const migrated = [mapRecordIds(legacy)];
  ok('the migrated id equals the server id', migrated[0].id === db.all()[0].id);
  ok('the migrated foreign key equals the server one', migrated[0].projectId === db.all()[0].project_id);
  const { items } = mergePulledRows('shots', migrated, db.all());
  ok('a migrated record pulls back as one record', items.length === 1, `got ${items.length}`);
}

// ─── The server id matches public.mise_project_uuid() ──────────────────────

// lpad(to_hex(1730000000000), 32, '0') then the 8-4-4-4-12 split with the
// version nibble forced to 4 and the variant nibble to a.
ok('deterministicUUID matches the SQL mirror for a Date.now() id',
  deterministicUUID('1730000000000') === '00000000-0000-4000-a000-0192cc091400',
  deterministicUUID('1730000000000'));

// ─── user_id is never overwritten ───────────────────────────────────────────

{
  const edited = { id: newId(), userId: OTHER, description: 'edited by crew' };
  ok('an update keeps the creator', buildPushRow('shots', edited, USER, 'update', T1).user_id === OTHER);
  ok('an insert keeps the creator too', buildPushRow('shots', edited, USER, 'insert', T1).user_id === OTHER);
  ok('the first upload keeps the creator', buildUploadRow('shots', edited, USER, T1).user_id === OTHER);
  ok('a row with no creator is stamped', buildPushRow('shots', { id: newId() }, USER, 'insert', T1).user_id === USER);
}

// ─── Empty foreign keys go up as null ───────────────────────────────────────

{
  const row = buildPushRow('time_entries', { id: newId(), projectId: newId(), crewMemberId: '' }, USER, 'insert', T1);
  ok('an empty uuid field is sent as null', row.crew_member_id === null, String(row.crew_member_id));
}

// ─── Soft delete moves updated_at ───────────────────────────────────────────

{
  const patch = softDeletePatch(T1);
  ok('soft delete sets deleted_at', patch.deleted_at === T1);
  ok('soft delete sets updated_at in the same write', patch.updated_at === T1);
}

// ─── Pull aliases and merge ─────────────────────────────────────────────────

{
  const id = newId();
  const local = [{ id, number: '4', cast: ['Ana'], synopsis: 'kept', updatedAt: T0 }];
  const remote = [{ id, number: '4A', cast_list: ['Ana', 'Ben'], synopsis: null, updated_at: T1 }];
  const { items } = mergePulledRows('scenes', local, remote);
  ok('cast_list comes back as cast', Array.isArray(items[0].cast) && items[0].cast.length === 2);
  ok('a null remote field keeps the local value', items[0].synopsis === 'kept');
  ok('a newer remote field wins', items[0].number === '4A');
}

{
  const id = newId();
  const local = [{ id, description: 'newer local', updatedAt: T1 }];
  const remote = [{ id, description: 'older remote', updated_at: T0 }];
  ok('an older remote row does not overwrite', mergePulledRows('shots', local, remote).items[0].description === 'newer local');
}

{
  const id = newId();
  const { items, changed } = mergePulledRows('shots', [{ id, updatedAt: T0 }], [{ id, deleted_at: T1, updated_at: T1 }]);
  ok('a soft-deleted remote row removes the local copy', items.length === 0 && changed === 1);
}

// ─── Existing duplicates are merged on pull ────────────────────────────────

{
  const id = newId();
  const { items, merged } = dedupeById([
    { id, a: 'old', b: 'only-old', updatedAt: T0 },
    { id, a: 'new', updatedAt: T1 },
  ]);
  ok('dedupe leaves one record', items.length === 1 && merged === 1);
  ok('dedupe keeps the newest value', items[0].a === 'new');
  ok('dedupe keeps a field only the older copy has', items[0].b === 'only-old');
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
