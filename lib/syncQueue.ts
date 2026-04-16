// ---------------------------------------------------------------------------
// lib/syncQueue.ts — Persistent change queue for offline-first sync
//
// Every local mutation (add/update/delete) is recorded here before being
// pushed to Supabase. The queue persists to AsyncStorage so changes survive
// app restarts. Processed FIFO when connectivity is restored.
// ---------------------------------------------------------------------------

import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_STORAGE_KEY = 'mise_sync_queue';

export type SyncAction = 'insert' | 'update' | 'delete';

export interface SyncQueueItem {
  queueId: string;
  table: string;
  recordId: string;
  action: SyncAction;
  timestamp: string;
  data: Record<string, any> | null;
  retryCount: number;
  lastError?: string;
}

let queue: SyncQueueItem[] = [];
let loaded = false;

export async function loadQueue(): Promise<SyncQueueItem[]> {
  try {
    const stored = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    if (stored) queue = JSON.parse(stored);
  } catch (e) {
    console.warn('[SyncQueue] Failed to load:', e);
    queue = [];
  }
  loaded = true;
  return queue;
}

async function persistQueue(): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.warn('[SyncQueue] Failed to persist:', e);
  }
}

export async function enqueue(
  table: string,
  recordId: string,
  action: SyncAction,
  data: Record<string, any> | null
): Promise<void> {
  if (!loaded) await loadQueue();

  const existingIndex = queue.findIndex(
    (item) => item.table === table && item.recordId === recordId
  );

  if (existingIndex !== -1) {
    const existing = queue[existingIndex];
    if (existing.action === 'insert' && action === 'update') {
      queue[existingIndex] = { ...existing, data, timestamp: new Date().toISOString() };
      await persistQueue();
      return;
    }
    if (existing.action === 'insert' && action === 'delete') {
      queue.splice(existingIndex, 1);
      await persistQueue();
      return;
    }
    if (existing.action === 'update' && action === 'update') {
      queue[existingIndex] = { ...existing, data, timestamp: new Date().toISOString() };
      await persistQueue();
      return;
    }
    if (existing.action === 'update' && action === 'delete') {
      queue[existingIndex] = { ...existing, action: 'delete', data: null, timestamp: new Date().toISOString() };
      await persistQueue();
      return;
    }
  }

  queue.push({
    queueId: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    table,
    recordId,
    action,
    timestamp: new Date().toISOString(),
    data,
    retryCount: 0,
  });
  await persistQueue();
}

export function getPendingItems(): SyncQueueItem[] { return [...queue]; }
export function getPendingCount(): number { return queue.length; }
export function hasPendingChanges(): boolean { return queue.length > 0; }

export async function dequeue(queueId: string): Promise<void> {
  queue = queue.filter((item) => item.queueId !== queueId);
  await persistQueue();
}

export async function markFailed(queueId: string, error: string): Promise<void> {
  const item = queue.find((i) => i.queueId === queueId);
  if (item) { item.retryCount += 1; item.lastError = error; }
  await persistQueue();
}

export async function pruneFailedItems(maxRetries: number = 3): Promise<SyncQueueItem[]> {
  const pruned = queue.filter((item) => item.retryCount >= maxRetries);
  queue = queue.filter((item) => item.retryCount < maxRetries);
  await persistQueue();
  return pruned;
}

export async function clearQueue(): Promise<void> {
  queue = [];
  await persistQueue();
}

export function getRetryDelay(retryCount: number): number {
  return Math.min(1000 * Math.pow(2, retryCount), 8000);
}
