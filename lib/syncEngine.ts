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
  recordToSnake,
  recordToCamel,
  applyPushAliases,
  applyPullAliases,
} from '@/lib/syncConfig';
import {
  getPendingItems,
  dequeue,
  markFailed,
  pruneFailedItems,
  type SyncQueueItem,
} from '@/lib/syncQueue';

// ---------------------------------------------------------------------------
// UUID helpers — app uses numeric IDs, Supabase expects UUIDs
// ---------------------------------------------------------------------------
function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

function deterministicUUID(input: string): string {
  let hex: string;
  try {
    hex = BigInt(input).toString(16).padStart(32, '0').slice(0, 32);
  } catch {
    let h1 = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
      h1 ^= input.charCodeAt(i);
      h1 = Math.imul(h1, 0x01000193);
    }
    let h2 = 0x1234abcd;
    for (let i = 0; i < input.length; i++) {
      h2 ^= input.charCodeAt(i);
      h2 = Math.imul(h2, 0x5bd1e995);
    }
    hex = ((Math.abs(h1) >>> 0).toString(16).padStart(8, '0') +
      (Math.abs(h2) >>> 0).toString(16).padStart(8, '0')).padEnd(32, '0');
  }
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function ensureUUID(value: string | null | undefined): string | null | undefined {
  if (!value) return value;
  if (typeof value !== 'string') value = String(value);
  if (isValidUUID(value)) return value;
  return deterministicUUID(value);
}

function convertRowIds(row: Record<string, any>): Record<string, any> {
  for (const key of Object.keys(row)) {
    if ((key === 'id' || key.endsWith('_id')) && row[key] && typeof row[key] === 'string') {
      if (!isValidUUID(row[key])) {
        row[key] = deterministicUUID(row[key]);
      }
    }
  }
  return row;
}

// ---------------------------------------------------------------------------
// Known Supabase columns per table
// ---------------------------------------------------------------------------
const KNOWN_COLUMNS: Record<string, string[] | null> = {
  projects: ['id', 'user_id', 'title', 'logline', 'genre', 'format', 'status', 'cover_image', 'created_at', 'updated_at', 'deleted_at', 'project_id'],
  shots: ['id', 'user_id', 'project_id', 'scene', 'shot_number', 'shot_type', 'shot_size', 'movement', 'lens', 'description', 'notes', 'duration', 'location', 'status', 'sort_order', 'created_at', 'updated_at', 'deleted_at'],
  schedule_days: ['id', 'user_id', 'project_id', 'date', 'title', 'description', 'status', 'scenes', 'call_time', 'wrap_time', 'location', 'notes', 'created_at', 'updated_at', 'deleted_at'],
  crew_members: ['id', 'user_id', 'project_id', 'name', 'role', 'department', 'email', 'phone', 'notes', 'created_at', 'updated_at', 'deleted_at'],
  takes: ['id', 'user_id', 'project_id', 'shot_id', 'take_number', 'is_circled', 'notes', 'duration', 'timecode_in', 'timecode_out', 'rating', 'created_at', 'updated_at', 'deleted_at'],
  scene_breakdowns: ['id', 'user_id', 'project_id', 'scene_number', 'title', 'description', 'cast', 'extras', 'props', 'wardrobe', 'vehicles', 'special_equipment', 'notes', 'created_at', 'updated_at', 'deleted_at'],
  location_scouts: ['id', 'user_id', 'project_id', 'name', 'address', 'description', 'contact', 'phone', 'notes', 'photos', 'rating', 'status', 'latitude', 'longitude', 'created_at', 'updated_at', 'deleted_at'],
  budget_items: ['id', 'user_id', 'project_id', 'category', 'description', 'estimated', 'actual', 'notes', 'status', 'vendor', 'created_at', 'updated_at', 'deleted_at'],
  continuity_notes: ['id', 'user_id', 'project_id', 'scene', 'shot', 'description', 'notes', 'photos', 'created_at', 'updated_at', 'deleted_at'],
  vfx_shots: ['id', 'user_id', 'project_id', 'shot_id', 'description', 'status', 'vendor', 'complexity', 'deadline', 'notes', 'created_at', 'updated_at', 'deleted_at'],
  festival_submissions: ['id', 'user_id', 'project_id', 'festival_name', 'deadline', 'status', 'category', 'fee', 'notes', 'submission_date', 'notification_date', 'created_at', 'updated_at', 'deleted_at'],
  production_notes: ['id', 'user_id', 'project_id', 'title', 'content', 'category', 'tags', 'created_at', 'updated_at', 'deleted_at'],
  mood_board_items: ['id', 'user_id', 'project_id', 'title', 'image_url', 'description', 'category', 'tags', 'sort_order', 'created_at', 'updated_at', 'deleted_at'],
  director_credits: ['id', 'user_id', 'project_id', 'title', 'role', 'year', 'description', 'created_at', 'updated_at', 'deleted_at'],
  shot_references: ['id', 'user_id', 'project_id', 'title', 'image_url', 'description', 'source', 'tags', 'created_at', 'updated_at', 'deleted_at'],
  wrap_reports: ['id', 'user_id', 'project_id', 'date', 'scenes_completed', 'setups', 'notes', 'call_time', 'wrap_time', 'created_at', 'updated_at', 'deleted_at'],
  location_weather: ['id', 'user_id', 'project_id', 'location', 'date', 'temperature', 'conditions', 'wind', 'humidity', 'sunrise', 'sunset', 'golden_hour_am', 'golden_hour_pm', 'notes', 'created_at', 'updated_at', 'deleted_at'],
  blocking_notes: ['id', 'user_id', 'project_id', 'scene', 'title', 'description', 'diagram', 'notes', 'created_at', 'updated_at', 'deleted_at'],
  color_references: ['id', 'user_id', 'project_id', 'title', 'description', 'image_url', 'lut_name', 'notes', 'tags', 'created_at', 'updated_at', 'deleted_at'],
  time_entries: ['id', 'user_id', 'project_id', 'crew_member_id', 'date', 'call_time', 'wrap_time', 'meal_start', 'meal_end', 'notes', 'overtime', 'created_at', 'updated_at', 'deleted_at'],
  script_sides: ['id', 'user_id', 'project_id', 'scene', 'pages', 'date', 'notes', 'created_at', 'updated_at', 'deleted_at'],
  cast_members: ['id', 'user_id', 'project_id', 'name', 'character', 'email', 'phone', 'agent', 'notes', 'created_at', 'updated_at', 'deleted_at'],
  lookbook_items: ['id', 'user_id', 'project_id', 'title', 'image_url', 'description', 'category', 'tags', 'sort_order', 'created_at', 'updated_at', 'deleted_at'],
  director_statements: ['id', 'user_id', 'project_id', 'title', 'content', 'created_at', 'updated_at', 'deleted_at'],
  scene_selects: ['id', 'user_id', 'project_id', 'scene', 'take_id', 'shot_id', 'notes', 'rating', 'is_selected', 'created_at', 'updated_at', 'deleted_at'],
  director_messages: ['id', 'user_id', 'project_id', 'to', 'subject', 'body', 'sent_at', 'created_at', 'updated_at', 'deleted_at'],
};

function stripUnknownColumns(table: string, row: Record<string, any>): Record<string, any> {
  const known = KNOWN_COLUMNS[table];
  if (!known) return row;
  const cleaned: Record<string, any> = {};
  for (const key of Object.keys(row)) {
    if (known.includes(key)) cleaned[key] = row[key];
  }
  return cleaned;
}

// ---------------------------------------------------------------------------
// Field-level merge: remote wins for non-null fields when timestamps tie/remote wins;
// local fields are KEPT if the remote value is null/undefined.
// This prevents sparse Supabase rows (e.g. seeded with only title+id) from
// wiping rich local data like coverImage, genre, status, etc.
// ---------------------------------------------------------------------------
function mergeRecords(
  local: Record<string, any>,
  remote: Record<string, any>,
): Record<string, any> {
  const merged = { ...local };
  for (const key of Object.keys(remote)) {
    const remoteVal = remote[key];
    // Only overwrite local value if remote has a real (non-null) value
    if (remoteVal !== null && remoteVal !== undefined) {
      merged[key] = remoteVal;
    }
    // If remote is null/undefined, keep whatever local has
  }
  return merged;
}

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

  if ((action === 'insert' || action === 'update') && data) {
    let row = recordToSnake(data);
    row.user_id = userId;
    convertRowIds(row);
    row.updated_at = new Date().toISOString();
    // FIX: provide created_at fallback instead of deleting it —
    // some tables have created_at NOT NULL with no database default
    if (action === 'insert') row.created_at = row.created_at || new Date().toISOString();
    row = applyPushAliases(table, row); // remap imageUrl→cover_image etc.
    row = stripUnknownColumns(table, row);
    const { error } = await supabase.from(table).upsert(row, { onConflict: 'id' });
    if (error) throw error;
  }

  if (action === 'delete') {
    const safeId = ensureUUID(recordId) || recordId;
    const { error } = await supabase
      .from(table)
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', safeId);
    if (error) throw error;
  }
}

// ---------------------------------------------------------------------------
// Pull remote changes from Supabase (incremental)
// ---------------------------------------------------------------------------
export async function pullRemoteChanges(userId: string): Promise<{ tables: number; records: number }> {
  let totalRecords = 0;

  for (const config of SYNCABLE_TABLES) {
    try {
      const pulled = await pullTableChanges(config, userId);
      totalRecords += pulled;
    } catch (error: any) {
      console.warn(`[SyncEngine] Failed to pull ${config.table}:`, error.message);
    }
  }

  return { tables: SYNCABLE_TABLES.length, records: totalRecords };
}

async function pullTableChanges(config: TableConfig, userId: string): Promise<number> {
  const lastSync = await getLastSyncTime(config.table);

  let query = supabase
    .from(config.table)
    .select('*')
    .order('updated_at', { ascending: true });

  if (config.table === 'projects') {
    query = query.eq('user_id', userId);
  }

  if (lastSync) {
    query = query.gt('updated_at', lastSync);
  }

  query = query.limit(1000);

  const { data: rows, error } = await query;
  if (error) throw error;
  if (!rows || rows.length === 0) return 0;

  // Load local data
  const localRaw = await AsyncStorage.getItem(config.storageKey);
  let localItems: Record<string, any>[] = [];
  if (localRaw) {
    try {
      localItems = JSON.parse(localRaw);
    } catch {
      localItems = [];
    }
  }

  const localMap = new Map<string, Record<string, any>>();
  for (const item of localItems) localMap.set(item.id, item);

  let mergedCount = 0;

  for (const row of rows) {
    let camelRecord = recordToCamel<Record<string, any>>(row);
    camelRecord = applyPullAliases(config.table, camelRecord); // cover_image → imageUrl etc.

    // Soft-deleted remote record — remove locally
    if (camelRecord.deletedAt) {
      localMap.delete(camelRecord.id);
      mergedCount++;
      continue;
    }

    const localItem = localMap.get(camelRecord.id);

    if (!localItem) {
      // New remote record not in local — add it
      localMap.set(camelRecord.id, camelRecord);
      mergedCount++;
      continue;
    }

    // Both exist — last-write-wins on timestamp, but with field-level merge
    const remoteTime = new Date(camelRecord.updatedAt || 0).getTime();
    const localTime = new Date(localItem.updatedAt || localItem.createdAt || 0).getTime();

    if (remoteTime >= localTime) {
      // Remote is newer — merge but preserve local fields where remote is null
      localMap.set(camelRecord.id, mergeRecords(localItem, camelRecord));
      mergedCount++;
    }
    // else: local is newer, keep local as-is
  }

  await AsyncStorage.setItem(config.storageKey, JSON.stringify(Array.from(localMap.values())));

  const latestRow = rows[rows.length - 1];
  if (latestRow?.updated_at) {
    await setLastSyncTime(config.table, latestRow.updated_at);
  }

  return mergedCount;
}

// ---------------------------------------------------------------------------
// Full sync — push then pull
// ---------------------------------------------------------------------------
let syncInProgress = false;

export async function fullSync(userId: string): Promise<{ pushed: number; pulled: number; failed: number }> {
  if (syncInProgress) return { pushed: 0, pulled: 0, failed: 0 };
  syncInProgress = true;
  setStatus('syncing');

  try {
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
// Initial upload — push all local data for first-time sync
// ---------------------------------------------------------------------------
export async function initialUpload(userId: string): Promise<number> {
  let uploaded = 0;

  for (const config of SYNCABLE_TABLES) {
    try {
      const localRaw = await AsyncStorage.getItem(config.storageKey);
      if (!localRaw) continue;

      const items: Record<string, any>[] = JSON.parse(localRaw);
      if (items.length === 0) continue;

      const rows = items.map((item) => {
        let row = recordToSnake(item);
        row.user_id = userId;
        convertRowIds(row);
        row.updated_at = row.updated_at || new Date().toISOString();
        // FIX: always provide created_at — some tables have NOT NULL with no default
        row.created_at = row.created_at || new Date().toISOString();
        row = applyPushAliases(config.table, row); // remap imageUrl→cover_image etc.
        row = stripUnknownColumns(config.table, row);
        return row;
      });

      for (let i = 0; i < rows.length; i += 100) {
        const batch = rows.slice(i, i + 100);
        const { error } = await supabase.from(config.table).upsert(batch, { onConflict: 'id' });
        if (error) {
          console.error(`[SyncEngine] Upload error ${config.table}:`, error.message);
        } else {
          uploaded += batch.length;
        }
      }

      await setLastSyncTime(config.table, new Date().toISOString());
    } catch (error: any) {
      console.error(`[SyncEngine] Upload failed ${config.table}:`, error.message);
    }
  }

  return uploaded;
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
// Bump MIGRATION_VERSION to force a fresh re-seed from mock data on next launch.
// ---------------------------------------------------------------------------
const MIGRATION_VERSION = 'mise_migration_v2'; // bump this string to trigger reset

export async function runMigrationsIfNeeded(): Promise<boolean> {
  const done = await AsyncStorage.getItem(MIGRATION_VERSION);
  if (done) return false; // already ran

  console.log('[SyncEngine] Running one-time migration: clearing stale project cache');

  // Clear only the projects storage key — forces reload from SAMPLE_PROJECTS fallback.
  // Also clear all sync cursors so a fresh pull happens after re-seed.
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

export function isSyncEnabled(userId: string | null | undefined): boolean {
  return !!userId;
}
