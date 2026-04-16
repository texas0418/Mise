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
// 'projects.imageUrl' auto-converts to 'image_url' but the DB column is 'cover_image'.
// Push aliases:  app camelCase field  → DB snake_case column  (before upsert)
// Pull aliases:  DB snake_case column → app camelCase field   (after fetch)
// ---------------------------------------------------------------------------
interface TableAliases {
  push: Record<string, string>;   // snake_case auto-name → correct DB column name
  pull: Record<string, string>;   // DB column name → camelCase app field name
}

const FIELD_ALIASES: Record<string, TableAliases> = {
  projects: {
    push: { image_url: 'cover_image' },   // 'imageUrl' auto-converts to 'image_url', remap to 'cover_image'
    pull: { cover_image: 'imageUrl' },    // 'cover_image' from DB should become 'imageUrl' in app
  },
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
 * e.g. 'coverImage' (from 'cover_image') → 'imageUrl'
 */
export function applyPullAliases(table: string, record: Record<string, any>): Record<string, any> {
  const aliases = FIELD_ALIASES[table]?.pull;
  if (!aliases) return record;
  const result = { ...record };
  for (const [dbColName, appFieldName] of Object.entries(aliases)) {
    // dbColName is snake_case, but recordToCamel already ran, so check camelCase version
    const camelDbName = toCamelCase(dbColName);
    if (camelDbName in result) {
      result[appFieldName] = result[camelDbName];
      if (camelDbName !== appFieldName) delete result[camelDbName];
    }
  }
  return result;
}
