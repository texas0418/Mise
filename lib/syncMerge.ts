// ---------------------------------------------------------------------------
// lib/syncMerge.ts: how a local record becomes a server row, and back
//
// Pure functions with no React Native imports, so the push and pull paths can
// be exercised by scripts/test-sync-roundtrip.ts without a device. The sync
// engine and the realtime listener both go through mergePulledRows(), so a
// row arriving by WebSocket is treated exactly like one arriving by pull.
// ---------------------------------------------------------------------------
import {
  recordToSnake,
  recordToCamel,
  applyPushAliases,
  applyPullAliases,
} from './syncConfig';
import { mapRecordIds } from './syncIds';

// ---------------------------------------------------------------------------
// Known Supabase columns per table
// Generated from: SELECT table_name, column_name FROM information_schema.columns
// WHERE table_schema = 'public' ORDER BY table_name, ordinal_position;
// ---------------------------------------------------------------------------
export const KNOWN_COLUMNS: Record<string, string[] | null> = {
  projects: ['id', 'user_id', 'title', 'logline', 'genre', 'status', 'format', 'image_url', 'budget', 'director', 'producer', 'created_at', 'updated_at', 'archived_at', 'deleted_at'],
  shots: ['id', 'user_id', 'project_id', 'scene_number', 'shot_number', 'type', 'movement', 'lens', 'description', 'notes', 'status', 'created_at', 'updated_at', 'deleted_at'],
  schedule_days: ['id', 'user_id', 'project_id', 'date', 'day_number', 'scenes', 'location', 'call_time', 'wrap_time', 'notes', 'created_at', 'updated_at', 'deleted_at'],
  crew_members: ['id', 'user_id', 'project_id', 'name', 'role', 'department', 'phone', 'email', 'created_at', 'updated_at', 'deleted_at'],
  crew_assignments: ['id', 'user_id', 'project_id', 'crew_member_id', 'role', 'call_time', 'created_at', 'updated_at', 'deleted_at'],
  takes: ['id', 'user_id', 'project_id', 'scene_number', 'shot_number', 'take_number', 'is_circled', 'is_ng', 'notes', 'timestamp', 'created_at', 'updated_at', 'deleted_at'],
  scenes: ['id', 'user_id', 'project_id', 'number', 'heading', 'int_ext', 'time_of_day', 'location', 'page_eighths', 'cast_list', 'extras', 'props', 'wardrobe', 'special_equipment', 'synopsis', 'notes', 'created_at', 'updated_at', 'deleted_at'],
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
  call_sheet_details: ['id', 'user_id', 'project_id', 'schedule_day_id', 'hospital_name', 'hospital_address', 'hospital_phone', 'safety_notes', 'parking_notes', 'basecamp_notes', 'crew_park_notes', 'nearest_bathroom', 'walkie_channels', 'catering_location', 'breakfast_time', 'lunch_time', 'company_moves', 'version', 'issued_at', 'created_at', 'updated_at', 'deleted_at'],
  cast_call_times: ['id', 'user_id', 'project_id', 'schedule_day_id', 'cast_member_id', 'makeup_time', 'wardrobe_time', 'on_set_time', 'notes', 'created_at', 'updated_at', 'deleted_at'],
  lookbook_items: ['id', 'user_id', 'project_id', 'section', 'title', 'description', 'image_url', 'reference_film', 'color_hex', 'sort_order', 'created_at', 'updated_at', 'deleted_at'],
  director_statements: ['id', 'user_id', 'project_id', 'text', 'created_at', 'updated_at', 'deleted_at'],
  scene_selects: ['id', 'user_id', 'project_id', 'scene_number', 'shot_number', 'take_number', 'rating', 'is_circled', 'is_alt', 'editor_note', 'performance_note', 'technical_note', 'timecode', 'created_at', 'updated_at', 'deleted_at'],
  director_messages: ['id', 'user_id', 'project_id', 'category', 'priority', 'subject', 'body', 'recipients', 'sent_at', 'scene_number', 'created_at', 'updated_at', 'deleted_at'],
  script_annotations: ['id', 'script_pdf_id', 'project_id', 'user_id', 'page_number', 'type', 'color', 'x', 'y', 'width', 'height', 'text_content', 'path_data', 'stroke_width', 'created_at', 'updated_at', 'deleted_at'],
  script_pdfs: ['id', 'project_id', 'user_id', 'title', 'file_path', 'file_size', 'page_count', 'version', 'color_code', 'uploaded_at', 'created_at', 'updated_at', 'deleted_at'],
  // Server table from supabase/migrations/20261103_lighting_diagrams_table.sql.
  lighting_diagrams: ['id', 'user_id', 'project_id', 'scene_number', 'shot_number', 'title', 'description', 'template_name', 'elements', 'bg_style', 'notes', 'created_at', 'updated_at', 'deleted_at'],
};

export function stripUnknownColumns(table: string, row: Record<string, any>): Record<string, any> {
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
export function mergeRecords(
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

function writtenAt(record: Record<string, any>): number {
  const t = new Date(record.updatedAt || record.createdAt || 0).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Collapse records that share an id into one, oldest first, so the most
 * recently written copy wins every field it has a value for. Keeps the
 * position of the first copy, so list order does not jump.
 */
export function dedupeById(items: Record<string, any>[]): { items: Record<string, any>[]; merged: number } {
  const groups = new Map<string, Record<string, any>[]>();
  const order: string[] = [];
  for (const item of items) {
    const key = String(item?.id ?? '');
    const group = groups.get(key);
    if (group) group.push(item);
    else { groups.set(key, [item]); order.push(key); }
  }
  let merged = 0;
  const out = order.map((key) => {
    const group = groups.get(key)!;
    if (group.length === 1) return group[0];
    merged += group.length - 1;
    const sorted = [...group].sort((a, b) => writtenAt(a) - writtenAt(b));
    return sorted.reduce((acc, next) => mergeRecords(acc, next));
  });
  return { items: out, merged };
}

// ---------------------------------------------------------------------------
// Push
// ---------------------------------------------------------------------------

/**
 * The row to upsert for a queued insert or update.
 *
 * user_id is the row's CREATOR and must survive edits by other members of the
 * project, and a second account signing in on the same phone, so it is only
 * stamped on rows that have none.
 */
export function buildPushRow(
  table: string,
  data: Record<string, any>,
  userId: string,
  action: 'insert' | 'update',
  nowIso: string,
): Record<string, any> {
  let row = recordToSnake(data);
  if (!row.user_id) row.user_id = userId;
  row = mapRecordIds(row);
  row.updated_at = nowIso;
  if (action === 'insert') row.created_at = row.created_at || nowIso;
  row = applyPushAliases(table, row);
  return stripUnknownColumns(table, row);
}

/** The row for a first upload, which keeps the record's own timestamps. */
export function buildUploadRow(
  table: string,
  item: Record<string, any>,
  userId: string,
  nowIso: string,
): Record<string, any> {
  let row = recordToSnake(item);
  if (!row.user_id) row.user_id = userId;
  row = mapRecordIds(row);
  row.updated_at = row.updated_at || nowIso;
  row.created_at = row.created_at || nowIso;
  row = applyPushAliases(table, row);
  return stripUnknownColumns(table, row);
}

/** A soft delete moves updated_at too, so other devices' cursors pick it up. */
export function softDeletePatch(nowIso: string): { deleted_at: string; updated_at: string } {
  return { deleted_at: nowIso, updated_at: nowIso };
}

// ---------------------------------------------------------------------------
// Pull
// ---------------------------------------------------------------------------

/** A server row in the shape the app stores. */
export function rowToRecord(table: string, row: Record<string, any>): Record<string, any> {
  return applyPullAliases(table, recordToCamel<Record<string, any>>(row));
}

/**
 * Merge server rows into a local list. A soft-deleted row removes the local
 * copy; otherwise last write wins, field by field. `changed` is how many
 * local records were added, replaced or removed.
 */
export function mergePulledRows(
  table: string,
  localItems: Record<string, any>[],
  rows: Record<string, any>[],
): { items: Record<string, any>[]; changed: number } {
  const localMap = new Map<string, Record<string, any>>();
  for (const item of dedupeById(localItems).items) localMap.set(item.id, item);

  let changed = 0;
  for (const row of rows) {
    const remote = rowToRecord(table, row);
    if (!remote.id) continue;
    if (remote.deletedAt) {
      if (localMap.delete(remote.id)) changed++;
      continue;
    }
    const local = localMap.get(remote.id);
    if (!local) {
      localMap.set(remote.id, remote);
      changed++;
    } else if (new Date(remote.updatedAt || 0).getTime() >= writtenAt(local)) {
      localMap.set(remote.id, mergeRecords(local, remote));
      changed++;
    }
  }
  return { items: Array.from(localMap.values()), changed };
}

/** Remove one record by id, for a hard DELETE seen by realtime. */
export function removeById(
  localItems: Record<string, any>[],
  id: string,
): { items: Record<string, any>[]; changed: number } {
  const items = localItems.filter((i) => i.id !== id);
  return { items, changed: localItems.length - items.length };
}
