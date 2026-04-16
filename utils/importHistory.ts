/**
 * utils/importHistory.ts
 * 
 * Import History & Undo for Mise App
 * Phase 4, Item 15
 * 
 * Tracks the last import batch so users can "Undo Last Import" if
 * something went wrong. Stores the batch info (entity type, item IDs,
 * timestamp) in AsyncStorage.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ─────────────────────────────────────────────────────────

export interface ImportBatch {
  /** Unique batch ID */
  id: string;
  /** Entity type key (e.g. 'crew', 'budget') */
  entityKey: string;
  /** Human-readable entity label */
  entityLabel: string;
  /** IDs of all items created in this batch */
  itemIds: string[];
  /** Number of items imported */
  count: number;
  /** Import method: 'spreadsheet' or 'ai' */
  method: 'spreadsheet' | 'ai';
  /** When the import happened */
  timestamp: string;
  /** Original filename (for spreadsheet imports) */
  fileName?: string;
}

// ─── Storage ───────────────────────────────────────────────────────

const HISTORY_KEY = 'mise_import_history';
const MAX_HISTORY = 10; // Keep last 10 imports

/**
 * Get the full import history (most recent first).
 */
export async function getImportHistory(): Promise<ImportBatch[]> {
  try {
    const stored = await AsyncStorage.getItem(HISTORY_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Get the most recent import batch.
 */
export async function getLastImport(): Promise<ImportBatch | null> {
  const history = await getImportHistory();
  return history.length > 0 ? history[0] : null;
}

/**
 * Record a new import batch.
 */
export async function recordImport(batch: Omit<ImportBatch, 'id' | 'timestamp'>): Promise<ImportBatch> {
  const fullBatch: ImportBatch = {
    ...batch,
    id: `batch-${Date.now()}`,
    timestamp: new Date().toISOString(),
  };

  const history = await getImportHistory();
  // Add to front, trim to max
  const updated = [fullBatch, ...history].slice(0, MAX_HISTORY);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));

  return fullBatch;
}

/**
 * Remove a batch from history (after undo).
 */
export async function removeBatchFromHistory(batchId: string): Promise<void> {
  const history = await getImportHistory();
  const updated = history.filter(b => b.id !== batchId);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
}

/**
 * Clear all import history.
 */
export async function clearImportHistory(): Promise<void> {
  await AsyncStorage.removeItem(HISTORY_KEY);
}

/**
 * Perform undo: removes all items from the last import batch.
 * 
 * @param removeFn - The entity store's remove function (e.g. deleteCrewMember)
 * @returns The undone batch, or null if nothing to undo
 */
export async function undoLastImport(
  removeFn: (id: string) => void
): Promise<ImportBatch | null> {
  const batch = await getLastImport();
  if (!batch) return null;

  // Remove each item from the entity store
  for (const id of batch.itemIds) {
    removeFn(id);
  }

  // Remove from history
  await removeBatchFromHistory(batch.id);

  return batch;
}
