// ---------------------------------------------------------------------------
// lib/syncConfig.ts — Central mapping of all syncable tables
//
// Maps each entity to its Supabase table name, AsyncStorage key,
// React Query cache key, and whether it's project-scoped.
// Used by syncEngine, syncQueue, and realtimeSubscriptions.
// ---------------------------------------------------------------------------

export interface TableConfig {
  /** Supabase table name (snake_case) */
  table: string;
  /** AsyncStorage key for local data */
  storageKey: string;
  /** React Query cache key */
  queryKey: string;
  /** Whether records are scoped to a project (most are) */
  projectScoped: boolean;
  /** Foreign key field that references another table's ID (optional) */
  foreignKeys?: { field: string; referencesTable: string }[];
}

export const SYNCABLE_TABLES: TableConfig[] = [
  { table: 'projects', storageKey: 'mise_projects', queryKey: 'projects', projectScoped: false },
  { table: 'shots', storageKey: 'mise_shots', queryKey: 'shots', projectScoped: true },
  { table: 'schedule_days', storageKey: 'mise_schedule', queryKey: 'schedule', projectScoped: true },
  { table: 'crew_members', storageKey: 'mise_crew', queryKey: 'crew', projectScoped: true },
  { table: 'takes', storageKey: 'mise_takes', queryKey: 'takes', projectScoped: true },
  { table: 'scene_breakdowns', storageKey: 'mise_scene_breakdowns', queryKey: 'sceneBreakdowns', projectScoped: true },
  { table: 'location_scouts', storageKey: 'mise_locations', queryKey: 'locations', projectScoped: true },
  { table: 'budget_items', storageKey: 'mise_budget', queryKey: 'budget', projectScoped: true },
  { table: 'continuity_notes', storageKey: 'mise_continuity', queryKey: 'continuity', projectScoped: true },
  { table: 'vfx_shots', storageKey: 'mise_vfx', queryKey: 'vfx', projectScoped: true },
  { table: 'festival_submissions', storageKey: 'mise_festivals', queryKey: 'festivals', projectScoped: true },
  { table: 'production_notes', storageKey: 'mise_notes', queryKey: 'notes', projectScoped: true },
  { table: 'mood_board_items', storageKey: 'mise_mood_board', queryKey: 'moodBoard', projectScoped: true },
  { table: 'call_sheet_entries', storageKey: 'mise_call_sheets', queryKey: 'callSheets', projectScoped: true },
  { table: 'director_credits', storageKey: 'mise_credits', queryKey: 'credits', projectScoped: true },
  { table: 'shot_references', storageKey: 'mise_shot_references', queryKey: 'shotReferences', projectScoped: true },
  { table: 'wrap_reports', storageKey: 'mise_wrap_reports', queryKey: 'wrapReports', projectScoped: true },
  { table: 'location_weather', storageKey: 'mise_location_weather', queryKey: 'locationWeather', projectScoped: true },
  { table: 'blocking_notes', storageKey: 'mise_blocking_notes', queryKey: 'blockingNotes', projectScoped: true },
  { table: 'color_references', storageKey: 'mise_color_references', queryKey: 'colorReferences', projectScoped: true },
  { table: 'time_entries', storageKey: 'mise_time_entries', queryKey: 'timeEntries', projectScoped: true },
  { table: 'script_sides', storageKey: 'mise_script_sides', queryKey: 'scriptSides', projectScoped: true },
  { table: 'cast_members', storageKey: 'mise_cast', queryKey: 'cast', projectScoped: true },
  { table: 'lookbook_items', storageKey: 'mise_lookbook', queryKey: 'lookbook', projectScoped: true },
  { table: 'director_statements', storageKey: 'mise_director_statement', queryKey: 'directorStatement', projectScoped: true },
  { table: 'scene_selects', storageKey: 'mise_selects', queryKey: 'selects', projectScoped: true },
  { table: 'director_messages', storageKey: 'mise_messages', queryKey: 'messages', projectScoped: true },
];

/** Lookup table config by Supabase table name */
export function getTableConfig(tableName: string): TableConfig | undefined {
  return SYNCABLE_TABLES.find(t => t.table === tableName);
}

/** Lookup table config by React Query key */
export function getTableConfigByQueryKey(queryKey: string): TableConfig | undefined {
  return SYNCABLE_TABLES.find(t => t.queryKey === queryKey);
}

/** All Supabase table names */
export const ALL_TABLE_NAMES = SYNCABLE_TABLES.map(t => t.table);

// ---------------------------------------------------------------------------
// camelCase ↔ snake_case field mapping
//
// The app uses camelCase (TypeScript interfaces) but Supabase uses snake_case.
// These helpers convert records between the two formats.
// ---------------------------------------------------------------------------

export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

export function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/** Convert a camelCase record to snake_case for Supabase */
export function recordToSnake<T extends Record<string, any>>(record: T): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(record)) {
    result[toSnakeCase(key)] = value;
  }
  return result;
}

/** Convert a snake_case Supabase row to camelCase for the app */
export function recordToCamel<T>(row: Record<string, any>): T {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    result[toCamelCase(key)] = value;
  }
  return result as T;
}
