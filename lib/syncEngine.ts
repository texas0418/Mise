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
// Generated from: SELECT table_name, column_name FROM information_schema.columns
// WHERE table_schema = 'public' ORDER BY table_name, ordinal_position;
// ---------------------------------------------------------------------------
const KNOWN_COLUMNS: Record<string, string[] | null> = {
  projects: ['id', 'user_id', 'title', 'logline', 'genre', 'status', 'format', 'image_url', 'budget', 'director', 'producer', 'created_at', 'updated_at', 'deleted_at'],
  shots: ['id', 'user_id', 'project_id', 'scene_number', 'shot_number', 'type', 'movement', 'lens', 'description', 'notes', 'status', 'created_at', 'updated_at', 'deleted_at'],
  schedule_days: ['id', 'user_id', 'project_id', 'date', 'day_number', 'scenes', 'location', 'call_time', 'wrap_time', 'notes', 'created_at', 'updated_at', 'deleted_at'],
  crew_members: ['id', 'user_id', 'project_id', 'name', 'role', 'department', 'phone', 'email', 'created_at', 'updated_at', 'deleted_at'],
  takes: ['id', 'user_id', 'project_id', 'scene_number', 'shot_number', 'take_number', 'is_circled', 'is_ng', 'notes', 'timestamp', 'created_at', 'updated_at', 'deleted_at'],
  scene_breakdowns: ['id', 'user_id', 'project_id', 'scene_number', 'scene_name', 'int_ext', 'time_of_day', 'location', 'cast_list', 'extras', 'props', 'wardrobe', 'special_equipment', 'notes', 'page_count', 'created_at', 'updated_at', 'deleted_at'],
  location_scouts: ['id', 'user_id', 'project_id', 'name', 'address', 'contact_name', 'contact_phone', 'permit_required', 'permit_status', 'parking_notes', 'power_available', 'notes', 'rating', 'photo_urls', 'scenes', 'latitude', 'longitude', 'created_at', 'updated_at', 'deleted_at'],
  budget_items: ['id', 'user_id', 'project_id', 'category', 'description', 'estimated', 'actual', 'notes', 'vendor', 'paid', 'created_at', 'updated_at', 'deleted_at'],
  continuity_notes: ['id', 'user_id', 'project_id', 'scene_number', 'shot_number', 'description', 'details', 'timestamp', 'created_at', 'updated_at', 'deleted_at'],
  vfx_shots: ['id', 'user_id', 'project_id', 'scene_number', 'shot_number', 'description', 'complexity', 'status', 'vendor', 'deadline', 'notes', 'estimated_cost', 'created_at', 'updated_at', 'deleted_at'],
  festival_submissions: ['id', 'user_id', 'project_id', 'festival_name', 'location', 'deadline', 'submission_date', 'fee', 'status', 'category', 'platform_url', 'notes', 'notification_date', 'created_at', 'updated_at', 'deleted_at'],
  production_notes: ['id', 'user_id', 'project_id', 'title', 'content', 'category', 'pinned', 'created_at', 'updated_at', 'deleted_at'],
  mood_board_items: ['id', 'user_id', 'project_id', 'board_name', 'type', 'image_url', 'color', 'note', 'label', 'created_at', 'updated_at', 'deleted_at'],
  call_sheet_entries: ['id', 'user_id', 'project_id', 'schedule_day_id', 'crew_member_id', 'call_time', 'role', 'notes', 'created_at', 'updated_at', 'deleted_at'],
  director_credits: ['id', 'user_id', 'project_id', 'title', 'role', 'year', 'format', 'festival', 'award', 'notes', 'created_at', 'updated_at', 'deleted_at'],
  shot_references: ['id', 'user_id', 'project_id', 'shot_id', 'scene_number', 'title', 'image_url', 'shot_type', 'lighting_style', 'notes', 'tags', 'created_at', 'updated_at', 'deleted_at'],
  wrap_reports: ['id', 'user_id', 'project_id', 'schedule_day_id', 'day_number', 'date', 'call_time', 'actual_wrap', 'scheduled_wrap', 'scenes_scheduled', 'scenes_completed', 'shots_planned', 'shots_completed', 'total_takes', 'circled_takes', 'ng_takes', 'pages_scheduled', 'pages_completed', 'overtime_minutes', 'notes', 'safety_incidents', 'weather_conditions', 'created_at', 'updated_at', 'deleted_at'],
  location_weather: ['id', 'user_id', 'project_id', 'location_id', 'date', 'sunrise', 'sunset', 'golden_hour_am', 'golden_hour_pm', 'temp_high', 'temp_low', 'condition', 'wind_speed', 'humidity', 'precip_chance', 'notes', 'created_at', 'updated_at', 'deleted_at'],
  blocking_notes: ['id', 'user_id', 'project_id', 'scene_number', 'title', 'description', 'actor_positions', 'camera_position', 'movement_notes', 'diagram_url', 'notes', 'created_at', 'updated_at', 'deleted_at'],
  color_references: ['id', 'user_id', 'project_id', 'scene_number', 'name', 'lut_style', 'primary_color', 'secondary_color', 'accent_color', 'contrast', 'saturation', 'temperature', 'reference_film', 'notes', 'created_at', 'updated_at', 'deleted_at'],
  time_entries: ['id', 'user_id', 'project_id', 'schedule_day_id', 'crew_member_id', 'department', 'date', 'call_time', 'wrap_time', 'lunch_start', 'lunch_end', 'scheduled_hours', 'actual_hours', 'overtime_hours', 'rate', 'notes', 'created_at', 'updated_at', 'deleted_at'],
  script_sides: ['id', 'user_id', 'project_id', 'scene_number', 'scene_header', 'page_start', 'page_end', 'page_count', 'shoot_date', 'status', 'synopsis', 'cast_ids', 'linked_shot_ids', 'annotations', 'revision_color', 'revision_date', 'notes', 'created_at', 'updated_at', 'deleted_at'],
  cast_members: ['id', 'user_id', 'project_id', 'actor_name', 'character_name', 'character_description', 'status', 'headshot', 'email', 'phone', 'agent_name', 'agent_contact', 'scenes', 'shoot_days', 'availability', 'performance_notes', 'preferred_takes', 'costume_notes', 'created_at', 'updated_at', 'deleted_at'],
  lookbook_items: ['id', 'user_id', 'project_id', 'section', 'title', 'description', 'image_url', 'reference_film', 'color_hex', 'sort_order', 'created_at', 'updated_at', 'deleted_at'],
  director_statements: ['id', 'user_id', 'project_id', 'text', 'created_at', 'updated_at', 'deleted_at'],
  scene_selects: ['id', 'user_id', 'project_id', 'scene_number', 'shot_number', 'take_number', 'rating', 'is_circled', 'is_alt', 'editor_note', 'performance_note', 'technical_note', 'timecode', 'created_at', 'updated_at', 'deleted_at'],
  director_messages: ['id', 'user_id', 'project_id', 'category', 'priority', 'subject', 'body', 'recipients', 'sent_at', 'scene_number', 'created_at', 'updated_at', 'deleted_at'],
  script_annotations: ['id', 'script_pdf_id', 'project_id', 'user_id', 'page_number', 'type', 'color', 'x', 'y', 'width', 'height', 'text_content', 'path_data', 'stroke_width', 'created_at', 'updated_at', 'deleted_at'],
  script_pdfs: ['id', 'project_id', 'user_id', 'title', 'file_path', 'file_size', 'page_count', 'version', 'color_code', 'uploaded_at', 'created_at', 'updated_at', 'deleted_at'],
  // lighting_diagrams not yet in Supabase — will pass through without stripping
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
// ---------------------------------------------------------------------------
function mergeRecords(
  local: Record<string, any>,
  remote: Record<string, any>,
): Record<string, any> {
  const merged = { ...local };
  for (const key of Object.keys(remote)) {
    const remoteVal = remote[key];
    if (remoteVal !== null && remoteVal !== undefined) {
      merged[key] = remoteVal;
    }
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
    if (action === 'insert') row.created_at = row.created_at || new Date().toISOString();
    row = applyPushAliases(table, row);
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
    camelRecord = applyPullAliases(config.table, camelRecord);

    // Soft-deleted remote record — remove locally
    if (camelRecord.deletedAt) {
      localMap.delete(camelRecord.id);
      mergedCount++;
      continue;
    }

    const localItem = localMap.get(camelRecord.id);

    if (!localItem) {
      localMap.set(camelRecord.id, camelRecord);
      mergedCount++;
      continue;
    }

    // Both exist — last-write-wins on timestamp, but with field-level merge
    const remoteTime = new Date(camelRecord.updatedAt || 0).getTime();
    const localTime = new Date(localItem.updatedAt || localItem.createdAt || 0).getTime();

    if (remoteTime >= localTime) {
      localMap.set(camelRecord.id, mergeRecords(localItem, camelRecord));
      mergedCount++;
    }
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
        row.created_at = row.created_at || new Date().toISOString();
        row = applyPushAliases(config.table, row);
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

export function isSyncEnabled(userId: string | null | undefined): boolean {
  return !!userId;
}
