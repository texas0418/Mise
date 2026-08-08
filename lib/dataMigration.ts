// ---------------------------------------------------------------------------
// lib/dataMigration.ts — Migrate v1 local data for v2 sync compatibility
//
// Tasks:
//   1. Ensure all records have an `updatedAt` timestamp
//   2. Detect and skip sample/demo data on first sync
//   3. Tag records with project_id if missing
// ---------------------------------------------------------------------------

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SYNCABLE_TABLES } from '@/lib/syncConfig';

const MIGRATION_KEY = 'mise_data_migration_v2';

// IDs of the fictional projects that shipped as seeded sample data before #35.
// These are literals rather than an import because the sample records they came
// from have been deleted; they exist only to recognise and clean up installs
// that were seeded by an earlier build.
//
// This list previously read ['1', '2'], which stopped matching when the samples
// moved to UUIDs — so sample detection had been silently failing.
export const SAMPLE_PROJECT_IDS = [
  'f47ac10b-58cc-4372-a567-0e02b2c3d479', // "The Last Light"
  'b8e1f2a3-c4d5-6789-bcde-f01234567891', // "Echoes of Tomorrow"
  'c9f2a3b4-d5e6-789a-cdef-012345678902', // "Paper Cranes"
];

export async function hasRunDataMigration(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(MIGRATION_KEY)) === 'done';
  } catch {
    return false;
  }
}

/**
 * Run the v1 → v2 data migration.
 * - Adds `updatedAt` to any records missing it
 * - Marks sample data so it can be excluded from first sync
 * - Returns count of records migrated
 */
export async function runDataMigration(): Promise<number> {
  let migrated = 0;

  for (const config of SYNCABLE_TABLES) {
    try {
      const raw = await AsyncStorage.getItem(config.storageKey);
      if (!raw) continue;

      let items: Record<string, any>[];
      try {
        items = JSON.parse(raw);
      } catch {
        continue;
      }

      if (!Array.isArray(items) || items.length === 0) continue;

      let changed = false;

      for (const item of items) {
        // Ensure updatedAt exists
        if (!item.updatedAt) {
          item.updatedAt = item.createdAt || new Date().toISOString();
          changed = true;
          migrated++;
        }

        // Ensure id is a string
        if (typeof item.id === 'number') {
          item.id = String(item.id);
          changed = true;
        }
      }

      if (changed) {
        await AsyncStorage.setItem(config.storageKey, JSON.stringify(items));
      }
    } catch (e) {
      console.warn(`[DataMigration] Error migrating ${config.storageKey}:`, e);
    }
  }

  await AsyncStorage.setItem(MIGRATION_KEY, 'done');
  return migrated;
}

/**
 * Check if the user's local data is all sample data (freshly installed).
 * If so, skip initial upload to avoid polluting the server with demo data.
 */
export async function isOnlySampleData(): Promise<boolean> {
  try {
    const projectsRaw = await AsyncStorage.getItem('mise_projects');
    if (!projectsRaw) return true;

    const projects: any[] = JSON.parse(projectsRaw);
    if (projects.length === 0) return true;

    // If all projects have IDs that match our sample data, it's just demo content
    const allSample = projects.every(p => SAMPLE_PROJECT_IDS.includes(String(p.id)));
    return allSample;
  } catch {
    return true;
  }
}

/**
 * Remove sample data before first sync to avoid duplicates.
 * Only removes data with known sample IDs.
 */
export async function removeSampleData(): Promise<void> {
  for (const config of SYNCABLE_TABLES) {
    try {
      const raw = await AsyncStorage.getItem(config.storageKey);
      if (!raw) continue;

      const items: any[] = JSON.parse(raw);
      const filtered = items.filter(item => {
        // Keep if not a sample project and not tied to a sample project
        const projectId = item.projectId || item.project_id;
        if (projectId && SAMPLE_PROJECT_IDS.includes(String(projectId))) return false;
        if (SAMPLE_PROJECT_IDS.includes(String(item.id)) && config.table === 'projects') return false;
        return true;
      });

      if (filtered.length !== items.length) {
        await AsyncStorage.setItem(config.storageKey, JSON.stringify(filtered));
      }
    } catch (e) {
      console.warn(`[DataMigration] Error removing samples from ${config.storageKey}:`, e);
    }
  }
}
