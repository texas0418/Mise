/**
 * supabase/functions/delete-account/tables.ts
 *
 * Every public table that holds rows keyed to an account by `user_id`, in the
 * order they are deleted: child tables first, projects after them, and the
 * account-level tables last. scripts/test-delete-account.ts checks that every
 * table the app syncs is here, so a table added later cannot be forgotten.
 *
 * project_members is handled separately: a member's row is theirs by
 * `user_id`, but a pending invite has no user yet and belongs to the project.
 */
export const USER_TABLES: readonly string[] = [
  'script_annotations',
  'script_pdfs',
  'shots',
  'schedule_days',
  'crew_assignments',
  'takes',
  'scenes',
  'scene_breakdowns',
  'location_weather',
  'location_scouts',
  'budget_items',
  'continuity_notes',
  'vfx_shots',
  'festival_submissions',
  'production_notes',
  'mood_board_items',
  'call_sheet_entries',
  'shot_references',
  'wrap_reports',
  'blocking_notes',
  'color_references',
  'time_entries',
  'script_sides',
  'cast_call_times',
  'call_sheet_details',
  'cast_members',
  'lookbook_items',
  'director_statements',
  'scene_selects',
  'director_messages',
  'lighting_diagrams',
  'crew_members',
  'director_credits',
  'projects',
  'devices',
  'entitlements',
];

/**
 * Tables with a project_id. When the account owns a project, other members'
 * rows in it go too: the film is deleted with its owner, and leftover rows
 * would otherwise block deleting the project row.
 */
export const PROJECT_TABLES: readonly string[] = USER_TABLES.filter(
  (t) => !['projects', 'devices', 'entitlements'].includes(t),
);

/** A table that is not on the server yet (lighting_diagrams before its migration). */
export function isMissingTable(code: string | undefined): boolean {
  return code === '42P01' || code === 'PGRST205';
}
