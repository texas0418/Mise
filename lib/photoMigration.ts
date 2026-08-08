// ---------------------------------------------------------------------------
// lib/photoMigration.ts — Rescue photos stored as cache URIs
//
// Before utils/photoStorage.ts existed, picked photos were persisted as the
// raw expo-image-picker URI, which lives in the app's cache directory. iOS
// reclaims that directory under storage pressure, so those references rot.
//
// This runs once and, for every photo field on every record:
//   - copies the file into durable storage and rewrites the reference, if the
//     file is still there
//   - clears the reference, if the OS already reclaimed it
//
// Clearing is deliberate. A dangling URI renders as a permanently broken image
// with no explanation; an absent one lets the UI fall back to its empty state.
// The photo is gone either way — this only decides which of the two the user
// sees. Counts are returned so the caller can tell the user what was lost.
// ---------------------------------------------------------------------------

import AsyncStorage from '@react-native-async-storage/async-storage';
import { migratePhotoUri } from '@/utils/photoStorage';

const MIGRATION_KEY = 'mise_photo_migration_v1';

interface PhotoField {
  storageKey: string;
  /** Field holding a single photo reference. */
  field: string;
  /** True when the field holds an array of references. */
  isArray?: boolean;
}

const PHOTO_FIELDS: PhotoField[] = [
  { storageKey: 'mise_continuity',       field: 'photoUrl' },
  { storageKey: 'mise_locations',        field: 'photoUrls', isArray: true },
  { storageKey: 'mise_mood_board',       field: 'imageUrl' },
  { storageKey: 'mise_lookbook',         field: 'imageUrl' },
  { storageKey: 'mise_cast',             field: 'headshot' },
  { storageKey: 'mise_shot_references',  field: 'imageUrl' },
  { storageKey: 'mise_blocking_notes',   field: 'diagramUrl' },
  { storageKey: 'mise_projects',         field: 'imageUrl' },
];

export interface PhotoMigrationResult {
  /** Photos copied into durable storage. */
  rescued: number;
  /** References cleared because the file was already gone. */
  lost: number;
}

export async function hasRunPhotoMigration(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(MIGRATION_KEY)) === 'done';
  } catch {
    return false;
  }
}

/** Migrate one field on one record. Returns the new value and a tally delta. */
function migrateValue(value: unknown, result: PhotoMigrationResult): string | undefined {
  if (typeof value !== 'string' || !value) return undefined;

  const migrated = migratePhotoUri(value);
  if (migrated === value) return value;          // already durable
  if (migrated === null) {
    result.lost += 1;
    return undefined;                            // file gone — clear the reference
  }
  result.rescued += 1;
  return migrated;
}

function migrateRecord(record: Record<string, any>, config: PhotoField, result: PhotoMigrationResult): boolean {
  const current = record[config.field];

  if (config.isArray) {
    if (!Array.isArray(current) || current.length === 0) return false;
    const next = current
      .map(v => migrateValue(v, result))
      .filter((v): v is string => typeof v === 'string');
    if (next.length === current.length && next.every((v, i) => v === current[i])) return false;
    record[config.field] = next;
    return true;
  }

  if (typeof current !== 'string' || !current) return false;
  const next = migrateValue(current, result);
  if (next === current) return false;
  if (next === undefined) delete record[config.field];
  else record[config.field] = next;
  return true;
}

export async function runPhotoMigration(): Promise<PhotoMigrationResult> {
  const result: PhotoMigrationResult = { rescued: 0, lost: 0 };

  for (const config of PHOTO_FIELDS) {
    try {
      const raw = await AsyncStorage.getItem(config.storageKey);
      if (!raw) continue;

      let items: Record<string, any>[];
      try {
        items = JSON.parse(raw);
      } catch {
        continue;
      }
      if (!Array.isArray(items)) continue;

      let changed = false;
      for (const item of items) {
        if (item && typeof item === 'object' && migrateRecord(item, config, result)) {
          changed = true;
        }
      }

      if (changed) {
        await AsyncStorage.setItem(config.storageKey, JSON.stringify(items));
      }
    } catch (e) {
      console.warn(`[photoMigration] ${config.storageKey} failed:`, e);
    }
  }

  try {
    await AsyncStorage.setItem(MIGRATION_KEY, 'done');
  } catch {}

  return result;
}
