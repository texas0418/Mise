// ---------------------------------------------------------------------------
// lib/syncEngine.ts — Core sync logic for offline-first multi-device sync
//
// Design:
// 1. AsyncStorage is always the source of truth for instant local reads
// 2. Mutations are queued (syncQueue.ts) and pushed to Supabase in background
// 3. Remote changes are pulled incrementally (since last sync timestamp)
// 4. Conflicts resolved via last-write-wins on updated_at
// 5. Field-level merge: remote null/undefined fields never overwrite local values
// 6. Soft deletes (deleted_at) are synced then purged after 30 days
// ---------------------------------------------------------------------------
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import {
  SYNCABLE_TABLES,
  type TableConfig,
} from '@/lib/syncConfig';
import {
  getPendingItems,
  dequeue,
  markFailed,
  pruneFailedItems,
  clearQueue,
  type SyncQueueItem,
} from '@/lib/syncQueue';
import { isProEntitled } from '@/lib/entitlement';
import { ensureUUID } from '@/lib/syncIds';
import {
  buildPushRow,
  buildUploadRow,
  mergePulledRows,
  removeById,
  softDeletePatch,
} from '@/lib/syncMerge';
import { writeStoreFromSync } from '@/lib/storeWrites';
import {
  isSyncAllowed,
  getAcceptedProjectIds,
  setAcceptedProjectIds,
  getSeatCovered,
  setSeatCovered,
  newlyJoined,
} from '@/lib/syncGate';

// Ids, row shapes and merging live in lib/syncIds.ts and lib/syncMerge.ts,
// which have no React Native imports so the tests can drive them.
export { deterministicUUID, ensureUUID, isValidUUID } from '@/lib/syncIds';
export { mergeRecords } from '@/lib/syncMerge';

// ---------------------------------------------------------------------------
// Sync cursor
// ---------------------------------------------------------------------------
const SYNC_CURSOR_PREFIX = 'mise_sync_cursor_';

export async function getLastSyncTime(table: string): Promise<string | null> {
  return AsyncStorage.getItem(`${SYNC_CURSOR_PREFIX}${table}`);
}

export async function setLastSyncTime(table: string, timestamp: string): Promise<void> {
  await AsyncStorage.setItem(`${SYNC_CURSOR_PREFIX}${table}`, timestamp);
}

export async function clearAllSyncCursors(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const cursorKeys = keys.filter((k) => k.startsWith(SYNC_CURSOR_PREFIX));
  if (cursorKeys.length > 0) await AsyncStorage.multiRemove(cursorKeys);
}

// ---------------------------------------------------------------------------
// Sync status
// ---------------------------------------------------------------------------
export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';
type SyncStatusListener = (status: SyncStatus, detail?: string) => void;
const listeners: SyncStatusListener[] = [];
let currentStatus: SyncStatus = 'idle';

export function getSyncStatus(): SyncStatus {
  return currentStatus;
}

export function onSyncStatusChange(listener: SyncStatusListener): () => void {
  listeners.push(listener);
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}

function setStatus(status: SyncStatus, detail?: string) {
  currentStatus = status;
  listeners.forEach((fn) => fn(status, detail));
}

// ---------------------------------------------------------------------------
// Push local changes to Supabase
// ---------------------------------------------------------------------------
export async function pushLocalChanges(userId: string): Promise<{ pushed: number; failed: number }> {
  const items = getPendingItems();
  if (items.length === 0) return { pushed: 0, failed: 0 };

  let pushed = 0;
  let failed = 0;

  for (const item of items) {
    try {
      await pushSingleItem(item, userId);
      await dequeue(item.queueId);
      pushed++;
    } catch (error: any) {
      console.error(`[SyncEngine] Push failed for ${item.table}/${item.recordId}:`, error.message);
      await markFailed(item.queueId, error.message || 'Unknown error');
      failed++;
    }
  }

  const pruned = await pruneFailedItems(3);
  if (pruned.length > 0) console.warn(`[SyncEngine] Pruned ${pruned.length} permanently failed items`);

  return { pushed, failed };
}

async function pushSingleItem(item: SyncQueueItem, userId: string): Promise<void> {
  const { table, recordId, action, data } = item;
  const now = new Date().toISOString();

  if ((action === 'insert' || action === 'update') && data) {
    const row = buildPushRow(table, data, userId, action, now);
    const { error } = await supabase.from(table).upsert(row, { onConflict: 'id' });
    if (error) throw error;
  }

  if (action === 'delete') {
    const safeId = ensureUUID(recordId) || recordId;
    const { error } = await supabase
      .from(table)
      .update(softDeletePatch(now))
      .eq('id', safeId);
    if (error) throw error;
  }
}

// ---------------------------------------------------------------------------
// Memberships
// ---------------------------------------------------------------------------
const KNOWN_PROJECTS_KEY = 'mise_sync_known_projects';

/**
 * Read which projects this account has accepted a place on. Feeds the sync
 * gate (crew sync without Pro) and the full-pull check below. A failed read
 * keeps the last known list rather than locking a member out offline.
 */
export async function refreshMemberships(userId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('project_members')
      .select('project_id')
      .eq('user_id', userId)
      .not('accepted_at', 'is', null)
      .is('deleted_at', null);
    if (error) throw error;
    setAcceptedProjectIds((data ?? []).map((r: { project_id: string }) => r.project_id));
    const access = await supabase.rpc('mise_sync_access');
    if (access.error) throw access.error;
    setSeatCovered(!!(access.data as { seat_covered?: boolean } | null)?.seat_covered);
  } catch (e: any) {
    console.warn('[SyncEngine] Membership check failed:', e?.message || e);
  }
  return getAcceptedProjectIds();
}

async function readKnownProjects(): Promise<string[] | null> {
  const raw = await AsyncStorage.getItem(KNOWN_PROJECTS_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Pull remote changes from Supabase (incremental)
//
// The cursor is per table, not per project. A project this account has just
// joined has rows older than every cursor, so an incremental pull would never
// deliver them. When a new accepted membership or a project id never seen
// before turns up, the cursors are cleared and everything is pulled again.
// ---------------------------------------------------------------------------
export async function pullRemoteChanges(userId: string): Promise<{ tables: number; records: number }> {
  const memberships = await refreshMemberships(userId);
  const known = await readKnownProjects();
  let fullPull = known === null || newlyJoined(known, memberships).length > 0;
  if (fullPull) await clearAllSyncCursors();

  let totalRecords = 0;
  const seenProjects = new Set<string>([...(known ?? []), ...memberships]);

  for (const config of SYNCABLE_TABLES) {
    try {
      const pulled = await pullTableChanges(config);
      totalRecords += pulled.changed;
      if (config.table !== 'projects') continue;
      const appeared = newlyJoined([...seenProjects], pulled.ids);
      pulled.ids.forEach((id) => seenProjects.add(id));
      if (appeared.length > 0 && !fullPull) {
        fullPull = true;
        await clearChildCursors();
      }
    } catch (error: any) {
      console.warn(`[SyncEngine] Failed to pull ${config.table}:`, error.message);
    }
  }

  await AsyncStorage.setItem(KNOWN_PROJECTS_KEY, JSON.stringify([...seenProjects]));
  return { tables: SYNCABLE_TABLES.length, records: totalRecords };
}

async function clearChildCursors(): Promise<void> {
  const keys = SYNCABLE_TABLES
    .filter((t) => t.table !== 'projects')
    .map((t) => `${SYNC_CURSOR_PREFIX}${t.table}`);
  await AsyncStorage.multiRemove(keys);
}

const PULL_PAGE = 1000;
const MAX_PAGES = 20;

/** Pull one table page by page, merging each page on the store's write chain. */
async function pullTableChanges(config: TableConfig): Promise<{ changed: number; ids: string[] }> {
  let changed = 0;
  const ids: string[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const rows = await fetchPage(config.table, await getLastSyncTime(config.table));
    if (rows.length === 0) break;

    changed += await applyRemoteRows(config, rows);
    rows.forEach((r) => { if (r.id && !r.deleted_at) ids.push(r.id); });

    const latest = rows[rows.length - 1]?.updated_at;
    if (latest) await setLastSyncTime(config.table, latest);
    if (rows.length < PULL_PAGE || !latest) break;
  }
  return { changed, ids };
}

async function fetchPage(table: string, since: string | null): Promise<Record<string, any>[]> {
  /* No user_id filter, on projects or anything else: row-level security
   * decides what this account may see, and since crew sharing that includes
   * projects the user belongs to but did not create. */
  let query = supabase.from(table).select('*').order('updated_at', { ascending: true });
  if (since) query = query.gt('updated_at', since);
  const { data, error } = await query.limit(PULL_PAGE);
  if (error) throw error;
  return data ?? [];
}

/**
 * Merge server rows into a local store. The pull and the realtime listener
 * both come through here, so both apply the pull aliases, merge field by
 * field, and write on the store's chain.
 */
export function applyRemoteRows(config: TableConfig, rows: Record<string, any>[]): Promise<number> {
  return writeStoreFromSync(config.storageKey, (items) => mergePulledRows(config.table, items, rows));
}

/** A hard delete seen by realtime. */
export function applyRemoteDelete(config: TableConfig, id: string): Promise<number> {
  return writeStoreFromSync(config.storageKey, (items) => removeById(items, id));
}

// ---------------------------------------------------------------------------
// Full sync: push then pull
// ---------------------------------------------------------------------------
let syncInProgress = false;

export async function fullSync(userId: string): Promise<{ pushed: number; pulled: number; failed: number }> {
  if (syncInProgress) return { pushed: 0, pulled: 0, failed: 0 };
  syncInProgress = true;

  try {
    await refreshMemberships(userId);
    if (!isSyncEnabled(userId)) return { pushed: 0, pulled: 0, failed: 0 };
    setStatus('syncing');
    const pushResult = await pushLocalChanges(userId);
    const pullResult = await pullRemoteChanges(userId);
    setStatus('idle');
    return { pushed: pushResult.pushed, pulled: pullResult.records, failed: pushResult.failed };
  } catch (error: any) {
    console.error('[SyncEngine] Full sync failed:', error.message);
    setStatus('error', error.message);
    return { pushed: 0, pulled: 0, failed: 0 };
  } finally {
    syncInProgress = false;
  }
}

// ---------------------------------------------------------------------------
// Initial upload: push all local data for first-time sync
// ---------------------------------------------------------------------------
export async function initialUpload(userId: string): Promise<number> {
  let uploaded = 0;
  const now = new Date().toISOString();

  for (const config of SYNCABLE_TABLES) {
    try {
      const localRaw = await AsyncStorage.getItem(config.storageKey);
      if (!localRaw) continue;

      const items: Record<string, any>[] = JSON.parse(localRaw);
      if (items.length === 0) continue;

      // Never overwrites a user_id the row already has (M4).
      const rows = items.map((item) => buildUploadRow(config.table, item, userId, now));

      for (let i = 0; i < rows.length; i += 100) {
        const batch = rows.slice(i, i + 100);
        const { error } = await supabase.from(config.table).upsert(batch, { onConflict: 'id' });
        if (error) {
          console.error(`[SyncEngine] Upload error ${config.table}:`, error.message);
        } else {
          uploaded += batch.length;
        }
      }

      await setLastSyncTime(config.table, now);
    } catch (error: any) {
      console.error(`[SyncEngine] Upload failed ${config.table}:`, error.message);
    }
  }

  return uploaded;
}

// ---------------------------------------------------------------------------
// Clear this device: every store, the queue, the cursors (sign-out "clear")
// ---------------------------------------------------------------------------
export async function clearLocalSyncData(): Promise<void> {
  await clearQueue();
  await clearAllSyncCursors();
  setAcceptedProjectIds([]);
  setSeatCovered(false);
  await AsyncStorage.multiRemove([
    ...SYNCABLE_TABLES.map((t) => t.storageKey),
    KNOWN_PROJECTS_KEY,
    'mise_active_project',
    'mise_import_history',
  ]);
}

// ---------------------------------------------------------------------------
// Force full re-sync
// ---------------------------------------------------------------------------
export async function forceFullResync(userId: string): Promise<void> {
  await clearAllSyncCursors();
  await pullRemoteChanges(userId);
}

// ---------------------------------------------------------------------------
// One-time data migrations
// ---------------------------------------------------------------------------
const MIGRATION_VERSION = 'mise_migration_v2';

export async function runMigrationsIfNeeded(): Promise<boolean> {
  const done = await AsyncStorage.getItem(MIGRATION_VERSION);
  if (done) return false;

  console.log('[SyncEngine] Running one-time migration: clearing stale project cache');

  try {
    await AsyncStorage.removeItem('mise_projects');
    await clearAllSyncCursors();
    await AsyncStorage.setItem(MIGRATION_VERSION, 'done');
    console.log('[SyncEngine] Migration complete — projects cache cleared');
    return true;
  } catch (e: any) {
    console.warn('[SyncEngine] Migration failed:', e.message);
    return false;
  }
}

/**
 * Whether this device should push and pull right now.
 *
 * Being signed in used to be the whole test, so every free account pushed and
 * pulled against Supabase while the paywall advertised Multi-Device Sync as a
 * paid feature (#43). It then required Pro, which locked out the crew a
 * director invited. The rule itself is in lib/syncGate.ts.
 */
export function isSyncEnabled(userId: string | null | undefined): boolean {
  return isSyncAllowed({
    signedIn: !!userId,
    proEntitled: isProEntitled(),
    seatCovered: getSeatCovered(),
  });
}
