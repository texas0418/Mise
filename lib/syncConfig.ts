// ---------------------------------------------------------------------------
// lib/syncConfig.ts — Central mapping of all syncable tables
// ---------------------------------------------------------------------------
export interface TableConfig {
  table: string;
  storageKey: string;
  queryKey: string;
  projectScoped: boolean;
  foreignKeys?: { field: string; referencesTable: string }[];
}

export const SYNCABLE_TABLES: TableConfig[] = [
  { table: 'projects',            storageKey: 'mise_projects',          queryKey: 'projects',         projectScoped: false },
  { table: 'shots',               storageKey: 'mise_shots',             queryKey: 'shots',            projectScoped: true },
  { table: 'schedule_days',       storageKey: 'mise_schedule',          queryKey: 'schedule',         projectScoped: true },
  { table: 'crew_members',        storageKey: 'mise_crew',              queryKey: 'crew',             projectScoped: true },
  { table: 'takes',               storageKey: 'mise_takes',             queryKey: 'takes',            projectScoped: true },
  { table: 'scene_breakdowns',    storageKey: 'mise_scene_breakdowns',  queryKey: 'sceneBreakdowns',  projectScoped: true },
  { table: 'location_scouts',     storageKey: 'mise_locations',         queryKey: 'locations',        projectScoped: true },
  { table: 'budget_items',        storageKey: 'mise_budget',            queryKey: 'budget',           projectScoped: true },
  { table: 'continuity_notes',    storageKey: 'mise_continuity',        queryKey: 'continuity',       projectScoped: true },
  { table: 'vfx_shots',           storageKey: 'mise_vfx',              queryKey: 'vfx',              projectScoped: true },
  { table: 'festival_submissions', storageKey: 'mise_festivals',        queryKey: 'festivals',        projectScoped: true },
  { table: 'production_notes',    storageKey: 'mise_notes',             queryKey: 'notes',            projectScoped: true },
  { table: 'mood_board_items',    storageKey: 'mise_mood_board',        queryKey: 'moodBoard',        projectScoped: true },
  { table: 'call_sheet_entries',  storageKey: 'mise_call_sheets',       queryKey: 'callSheets',       projectScoped: true },
  { table: 'director_credits',    storageKey: 'mise_credits',           queryKey: 'credits',          projectScoped: true },
  { table: 'shot_references',     storageKey: 'mise_shot_references',   queryKey: 'shotReferences',   projectScoped: true },
  { table: 'wrap_reports',        storageKey: 'mise_wrap_reports',      queryKey: 'wrapReports',      projectScoped: true },
  { table: 'location_weather',    storageKey: 'mise_location_weather',  queryKey: 'locationWeather',  projectScoped: false },
  { table: 'blocking_notes',      storageKey: 'mise_blocking_notes',    queryKey: 'blockingNotes',    projectScoped: true },
  { table: 'color_references',    storageKey: 'mise_color_references',  queryKey: 'colorReferences',  projectScoped: true },
  { table: 'time_entries',        storageKey: 'mise_time_entries',      queryKey: 'timeEntries',      projectScoped: true },
  { table: 'script_sides',        storageKey: 'mise_script_sides',      queryKey: 'scriptSides',      projectScoped: true },
  { table: 'cast_members',        storageKey: 'mise_cast',              queryKey: 'cast',             projectScoped: true },
  { table: 'lookbook_items',      storageKey: 'mise_lookbook',          queryKey: 'lookbook',         projectScoped: true },
  { table: 'director_statements', storageKey: 'mise_director_statement',queryKey: 'directorStatement',projectScoped: true },
  { table: 'scene_selects',       storageKey: 'mise_selects',           queryKey: 'selects',          projectScoped: true },
  { table: 'director_messages',   storageKey: 'mise_messages',          queryKey: 'messages',         projectScoped: true },
  { table: 'script_pdfs',         storageKey: 'mise_script_pdfs',       queryKey: 'scriptPDFs',       projectScoped: true },
  { table: 'script_annotations',  storageKey: 'mise_script_annotations',queryKey: 'scriptAnnotations',projectScoped: true },
  { table: 'lighting_diagrams',   storageKey: 'mise_lighting_diagrams', queryKey: 'lightingDiagrams', projectScoped: true },
];

export function getTableConfig(tableName: string): TableConfig | undefined {
  return SYNCABLE_TABLES.find(t => t.table === tableName);
}

export function getTableConfigByQueryKey(queryKey: string): TableConfig | undefined {
  return SYNCABLE_TABLES.find(t => t.queryKey === queryKey);
}

export const ALL_TABLE_NAMES = SYNCABLE_TABLES.map(t => t.table);

// ---------------------------------------------------------------------------
// camelCase ↔ snake_case conversion
// ---------------------------------------------------------------------------
export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

export function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

export function recordToSnake<T extends Record<string, any>>(record: T): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(record)) {
    result[toSnakeCase(key)] = value;
  }
  return result;
}

export function recordToCamel<T>(row: Record<string, any>): T {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    result[toCamelCase(key)] = value;
  }
  return result as T;
}

// ---------------------------------------------------------------------------
// Field aliases — for cases where auto snake_case produces the wrong DB column
//
// 'projects.imageUrl' auto-converts to 'image_url' which IS the correct DB column.
// The old alias mapping to 'cover_image' was WRONG — the DB column is actually 'image_url'.
// Only add aliases here when the auto-conversion genuinely produces the wrong name.
// ---------------------------------------------------------------------------
interface TableAliases {
  push: Record<string, string>;   // snake_case auto-name → correct DB column name
  pull: Record<string, string>;   // DB column name → camelCase app field name
}

const FIELD_ALIASES: Record<string, TableAliases> = {
  // projects.imageUrl → image_url is correct auto-conversion, no alias needed
  // Add aliases here only if a mismatch is discovered
};

/**
 * Apply push aliases to a snake_case row before upserting to Supabase.
 * Call this AFTER recordToSnake(), BEFORE stripUnknownColumns().
 */
export function applyPushAliases(table: string, row: Record<string, any>): Record<string, any> {
  const aliases = FIELD_ALIASES[table]?.push;
  if (!aliases) return row;
  const result = { ...row };
  for (const [wrongName, correctName] of Object.entries(aliases)) {
    if (wrongName in result) {
      result[correctName] = result[wrongName];
      delete result[wrongName];
    }
  }
  return result;
}

/**
 * Apply pull aliases to a camelCase record after recordToCamel().
 * Renames DB-specific camelCase fields to app field names.
 */
export function applyPullAliases(table: string, record: Record<string, any>): Record<string, any> {
  const aliases = FIELD_ALIASES[table]?.pull;
  if (!aliases) return record;
  const result = { ...record };
  for (const [dbColName, appFieldName] of Object.entries(aliases)) {
    const camelDbName = toCamelCase(dbColName);
    if (camelDbName in result) {
      result[appFieldName] = result[camelDbName];
      if (camelDbName !== appFieldName) delete result[camelDbName];
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Known Supabase columns per table — generated from information_schema
//
// stripUnknownColumns() removes any keys NOT in this list before upserting,
// preventing "column does not exist" errors from Supabase.
// ---------------------------------------------------------------------------
const KNOWN_COLUMNS: Record<string, string[] | null> = {
  blocking_notes: ['id', 'user_id', 'project_id', 'scene_number', 'title', 'description', 'actor_positions', 'camera_position', 'movement_notes', 'diagram_url', 'notes', 'created_at', 'updated_at', 'deleted_at'],
  budget_items: ['id', 'user_id', 'project_id', 'category', 'description', 'estimated', 'actual', 'notes', 'vendor', 'paid', 'created_at', 'updated_at', 'deleted_at'],
  call_sheet_entries: ['id', 'user_id', 'project_id', 'schedule_day_id', 'crew_member_id', 'call_time', 'role', 'notes', 'created_at', 'updated_at', 'deleted_at'],
  cast_members: ['id', 'user_id', 'project_id', 'actor_name', 'character_name', 'character_description', 'status', 'headshot', 'email', 'phone', 'agent_name', 'agent_contact', 'scenes', 'shoot_days', 'availability', 'performance_notes', 'preferred_takes', 'costume_notes', 'created_at', 'updated_at', 'deleted_at'],
  color_references: ['id', 'user_id', 'project_id', 'scene_number', 'name', 'lut_style', 'primary_color', 'secondary_color', 'accent_color', 'contrast', 'saturation', 'temperature', 'reference_film', 'notes', 'created_at', 'updated_at', 'deleted_at'],
  continuity_notes: ['id', 'user_id', 'project_id', 'scene_number', 'shot_number', 'description', 'details', 'timestamp', 'created_at', 'updated_at', 'deleted_at'],
  crew_members: ['id', 'user_id', 'project_id', 'name', 'role', 'department', 'phone', 'email', 'created_at', 'updated_at', 'deleted_at'],
  director_credits: ['id', 'user_id', 'project_id', 'title', 'role', 'year', 'format', 'festival', 'award', 'notes', 'created_at', 'updated_at', 'deleted_at'],
  director_messages: ['id', 'user_id', 'project_id', 'category', 'priority', 'subject', 'body', 'recipients', 'sent_at', 'scene_number', 'created_at', 'updated_at', 'deleted_at'],
  director_statements: ['id', 'user_id', 'project_id', 'text', 'created_at', 'updated_at', 'deleted_at'],
  festival_submissions: ['id', 'user_id', 'project_id', 'festival_name', 'location', 'deadline', 'submission_date', 'fee', 'status', 'category', 'platform_url', 'notes', 'notification_date', 'created_at', 'updated_at', 'deleted_at'],
  location_scouts: ['id', 'user_id', 'project_id', 'name', 'address', 'contact_name', 'contact_phone', 'permit_required', 'permit_status', 'parking_notes', 'power_available', 'notes', 'rating', 'photo_urls', 'scenes', 'latitude', 'longitude', 'created_at', 'updated_at', 'deleted_at'],
  location_weather: ['id', 'user_id', 'project_id', 'location_id', 'date', 'sunrise', 'sunset', 'golden_hour_am', 'golden_hour_pm', 'temp_high', 'temp_low', 'condition', 'wind_speed', 'humidity', 'precip_chance', 'notes', 'created_at', 'updated_at', 'deleted_at'],
  lookbook_items: ['id', 'user_id', 'project_id', 'section', 'title', 'description', 'image_url', 'reference_film', 'color_hex', 'sort_order', 'created_at', 'updated_at', 'deleted_at'],
  mood_board_items: ['id', 'user_id', 'project_id', 'board_name', 'type', 'image_url', 'color', 'note', 'label', 'created_at', 'updated_at', 'deleted_at'],
  production_notes: ['id', 'user_id', 'project_id', 'title', 'content', 'category', 'pinned', 'created_at', 'updated_at', 'deleted_at'],
  projects: ['id', 'user_id', 'title', 'logline', 'genre', 'status', 'format', 'image_url', 'budget', 'director', 'producer', 'created_at', 'updated_at', 'deleted_at'],
  scene_breakdowns: ['id', 'user_id', 'project_id', 'scene_number', 'scene_name', 'int_ext', 'time_of_day', 'location', 'cast_list', 'extras', 'props', 'wardrobe', 'special_equipment', 'notes', 'page_count', 'created_at', 'updated_at', 'deleted_at'],
  scene_selects: ['id', 'user_id', 'project_id', 'scene_number', 'shot_number', 'take_number', 'rating', 'is_circled', 'is_alt', 'editor_note', 'performance_note', 'technical_note', 'timecode', 'created_at', 'updated_at', 'deleted_at'],
  schedule_days: ['id', 'user_id', 'project_id', 'date', 'day_number', 'scenes', 'location', 'call_time', 'wrap_time', 'notes', 'created_at', 'updated_at', 'deleted_at'],
  script_annotations: ['id', 'script_pdf_id', 'project_id', 'user_id', 'page_number', 'type', 'color', 'x', 'y', 'width', 'height', 'text_content', 'path_data', 'stroke_width', 'created_at', 'updated_at', 'deleted_at'],
  script_pdfs: ['id', 'project_id', 'user_id', 'title', 'file_path', 'file_size', 'page_count', 'version', 'color_code', 'uploaded_at', 'created_at', 'updated_at', 'deleted_at'],
  script_sides: ['id', 'user_id', 'project_id', 'scene_number', 'scene_header', 'page_start', 'page_end', 'page_count', 'shoot_date', 'status', 'synopsis', 'cast_ids', 'linked_shot_ids', 'annotations', 'revision_color', 'revision_date', 'notes', 'created_at', 'updated_at', 'deleted_at'],
  shot_references: ['id', 'user_id', 'project_id', 'shot_id', 'scene_number', 'title', 'image_url', 'shot_type', 'lighting_style', 'notes', 'tags', 'created_at', 'updated_at', 'deleted_at'],
  shots: ['id', 'user_id', 'project_id', 'scene_number', 'shot_number', 'type', 'movement', 'lens', 'description', 'notes', 'status', 'created_at', 'updated_at', 'deleted_at'],
  takes: ['id', 'user_id', 'project_id', 'scene_number', 'shot_number', 'take_number', 'is_circled', 'is_ng', 'notes', 'timestamp', 'created_at', 'updated_at', 'deleted_at'],
  time_entries: ['id', 'user_id', 'project_id', 'schedule_day_id', 'crew_member_id', 'department', 'date', 'call_time', 'wrap_time', 'lunch_start', 'lunch_end', 'scheduled_hours', 'actual_hours', 'overtime_hours', 'rate', 'notes', 'created_at', 'updated_at', 'deleted_at'],
  vfx_shots: ['id', 'user_id', 'project_id', 'scene_number', 'shot_number', 'description', 'complexity', 'status', 'vendor', 'deadline', 'notes', 'estimated_cost', 'created_at', 'updated_at', 'deleted_at'],
  wrap_reports: ['id', 'user_id', 'project_id', 'schedule_day_id', 'day_number', 'date', 'call_time', 'actual_wrap', 'scheduled_wrap', 'scenes_scheduled', 'scenes_completed', 'shots_planned', 'shots_completed', 'total_takes', 'circled_takes', 'ng_takes', 'pages_scheduled', 'pages_completed', 'overtime_minutes', 'notes', 'safety_incidents', 'weather_conditions', 'created_at', 'updated_at', 'deleted_at'],
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
