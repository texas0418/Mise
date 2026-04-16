// ---------------------------------------------------------------------------
// lib/realtimeSubscriptions.ts — Live updates via Supabase Realtime
//
// Subscribes to Postgres changes on all syncable tables. When another device
// makes a change, it arrives via WebSocket and is merged into local
// AsyncStorage + invalidates React Query cache so UI re-renders.
// ---------------------------------------------------------------------------

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { SYNCABLE_TABLES, recordToCamel, type TableConfig } from '@/lib/syncConfig';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { QueryClient } from '@tanstack/react-query';

let activeChannel: RealtimeChannel | null = null;

export function subscribeToChanges(userId: string, queryClient: QueryClient): void {
  unsubscribeAll();

  const channel = supabase.channel(`user_${userId}_sync`);

  for (const config of SYNCABLE_TABLES) {
    channel.on(
      'postgres_changes' as any,
      { event: '*', schema: 'public', table: config.table },
      (payload: RealtimePostgresChangesPayload<Record<string, any>>) => {
        handleRealtimeEvent(payload, config, queryClient);
      }
    );
  }

  channel.subscribe((status: string) => {
    if (status === 'SUBSCRIBED') {
      console.log('[Realtime] Connected');
    } else if (status === 'CHANNEL_ERROR') {
      console.warn('[Realtime] Channel error');
    }
  });

  activeChannel = channel;
}

async function handleRealtimeEvent(
  payload: RealtimePostgresChangesPayload<Record<string, any>>,
  config: TableConfig,
  queryClient: QueryClient
): Promise<void> {
  const eventType = payload.eventType;

  try {
    const localRaw = await AsyncStorage.getItem(config.storageKey);
    let localItems: Record<string, any>[] = [];
    if (localRaw) {
      try { localItems = JSON.parse(localRaw); } catch { localItems = []; }
    }

    const localMap = new Map<string, Record<string, any>>();
    for (const item of localItems) localMap.set(item.id, item);

    if (eventType === 'INSERT' || eventType === 'UPDATE') {
      const newRow = payload.new as Record<string, any>;
      if (!newRow || !newRow.id) return;
      const camelRecord = recordToCamel<Record<string, any>>(newRow);

      if (camelRecord.deletedAt) {
        localMap.delete(camelRecord.id);
      } else {
        const existing = localMap.get(camelRecord.id);
        if (existing) {
          const remoteTime = new Date(camelRecord.updatedAt || 0).getTime();
          const localTime = new Date(existing.updatedAt || 0).getTime();
          if (remoteTime < localTime) return;
        }
        localMap.set(camelRecord.id, camelRecord);
      }
    }

    if (eventType === 'DELETE') {
      const oldRow = payload.old as Record<string, any>;
      if (oldRow?.id) localMap.delete(oldRow.id);
    }

    await AsyncStorage.setItem(config.storageKey, JSON.stringify(Array.from(localMap.values())));
    queryClient.invalidateQueries({ queryKey: [config.queryKey] });
  } catch (error: any) {
    console.warn(`[Realtime] Error ${eventType} on ${config.table}:`, error.message);
  }
}

export function unsubscribeAll(): void {
  if (activeChannel) {
    supabase.removeChannel(activeChannel);
    activeChannel = null;
  }
}

export function isRealtimeConnected(): boolean {
  return activeChannel !== null;
}
