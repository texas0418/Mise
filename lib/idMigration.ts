// ---------------------------------------------------------------------------
// lib/idMigration.ts: move every local id to the id the server uses
//
// Until 1.3.3 records were keyed by Date.now().toString(). The sync engine
// mapped those to deterministicUUID() on push, but a pulled row came back
// under the uuid and never matched the numeric original, so every synced
// record was stored twice. Project ids sent straight to Supabase (invite,
// team, role lookup) were the raw number and Postgres rejected them.
//
// This runs once at startup, before any provider mounts and before sync. It
// rewrites ids, foreign keys and id lists in every store with the exact
// mapping the push path has always used, so a local id ends up byte-identical
// to the server id, then merges the duplicates that the old pull left behind.
//
// Idempotent: a uuid maps to itself, and a store with no duplicates dedupes
// to itself, so a second run (a crash before the flag was written) is safe.
// No React Native imports, so scripts/test-id-migration.ts can drive it.
// ---------------------------------------------------------------------------
import { SYNCABLE_TABLES } from './syncConfig';
import { dedupeById } from './syncMerge';
import { ensureUUID, mapRecordIds } from './syncIds';

export const ID_MIGRATION_FLAG = 'mise_id_migration_v1';

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

const ACTIVE_PROJECT_KEY = 'mise_active_project';
const SYNC_QUEUE_KEY = 'mise_sync_queue';
const IMPORT_HISTORY_KEY = 'mise_import_history';

export interface IdMigrationResult {
  ran: boolean;
  stores: number;
  records: number;
  duplicatesMerged: number;
}

function parseList(raw: string | null): any[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Remap one store's records and merge the copies that share an id. */
export function migrateStoreItems(items: Record<string, any>[]): { items: Record<string, any>[]; merged: number } {
  const mapped = items.filter((i) => i && typeof i === 'object').map((i) => mapRecordIds(i));
  return dedupeById(mapped);
}

/** Remap a pending sync-queue item: its record id and the record it carries. */
export function migrateQueueItem(item: Record<string, any>): Record<string, any> {
  return {
    ...item,
    recordId: ensureUUID(item.recordId) ?? item.recordId,
    data: item.data && typeof item.data === 'object' ? mapRecordIds(item.data) : item.data,
  };
}

/** Remap the record ids an import batch remembers for undo. */
export function migrateImportBatch(batch: Record<string, any>): Record<string, any> {
  if (!Array.isArray(batch.itemIds)) return batch;
  return { ...batch, itemIds: batch.itemIds.map((id: unknown) => ensureUUID(id) ?? id) };
}

async function migrateListKey(
  storage: KeyValueStorage,
  key: string,
  map: (items: any[]) => { items: any[]; merged: number },
): Promise<{ records: number; merged: number } | null> {
  const items = parseList(await storage.getItem(key));
  if (!items) return null;
  const result = map(items);
  await storage.setItem(key, JSON.stringify(result.items));
  return { records: result.items.length, merged: result.merged };
}

/** Run the migration unless it has already run on this device. */
export async function runIdMigrationIfNeeded(storage: KeyValueStorage): Promise<IdMigrationResult> {
  if (await storage.getItem(ID_MIGRATION_FLAG)) {
    return { ran: false, stores: 0, records: 0, duplicatesMerged: 0 };
  }

  const result: IdMigrationResult = { ran: true, stores: 0, records: 0, duplicatesMerged: 0 };
  const tally = (r: { records: number; merged: number } | null) => {
    if (!r) return;
    result.stores++;
    result.records += r.records;
    result.duplicatesMerged += r.merged;
  };

  for (const config of SYNCABLE_TABLES) {
    tally(await migrateListKey(storage, config.storageKey, migrateStoreItems));
  }
  tally(await migrateListKey(storage, SYNC_QUEUE_KEY, (q) => ({ items: q.map(migrateQueueItem), merged: 0 })));
  tally(await migrateListKey(storage, IMPORT_HISTORY_KEY, (h) => ({ items: h.map(migrateImportBatch), merged: 0 })));

  const active = await storage.getItem(ACTIVE_PROJECT_KEY);
  const mappedActive = ensureUUID(active);
  if (active && mappedActive && mappedActive !== active) {
    await storage.setItem(ACTIVE_PROJECT_KEY, mappedActive);
  }

  await storage.setItem(ID_MIGRATION_FLAG, new Date().toISOString());
  return result;
}
