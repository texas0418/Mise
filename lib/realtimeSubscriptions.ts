// ---------------------------------------------------------------------------
// lib/realtimeSubscriptions.ts: live updates via Supabase Realtime
//
// Subscribes to Postgres changes on all syncable tables. When another device
// makes a change, it arrives via WebSocket and goes through the same path as a
// pull (applyRemoteRows): pull aliases applied, merged field by field rather
// than replacing the local record, and written on the store's write chain.
// It used to skip all three, so a scene edited elsewhere lost its cast.
//
// The account's own project_members rows are watched too. A new accepted
// membership changes who may sync and needs a full pull (see syncEngine.ts).
// ---------------------------------------------------------------------------

import { supabase } from '@/lib/supabase';
import { SYNCABLE_TABLES, type TableConfig } from '@/lib/syncConfig';
import { applyRemoteRows, applyRemoteDelete } from '@/lib/syncEngine';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { QueryClient } from '@tanstack/react-query';

let activeChannel: RealtimeChannel | null = null;

export function subscribeToChanges(
  userId: string,
  queryClient: QueryClient,
  onMembershipChange?: () => void,
): void {
  unsubscribeAll();

  const channel = supabase.channel(`user_${userId}_sync`);

  for (const config of SYNCABLE_TABLES) {
    channel.on(
      'postgres_changes' as any,
      { event: '*', schema: 'public', table: config.table },
      (payload: RealtimePostgresChangesPayload<Record<string, any>>) => {
        void handleRealtimeEvent(payload, config, queryClient);
      }
    );
  }

  if (onMembershipChange) {
    channel.on(
      'postgres_changes' as any,
      { event: '*', schema: 'public', table: 'project_members', filter: `user_id=eq.${userId}` },
      () => onMembershipChange(),
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
    let changed = 0;
    if (eventType === 'INSERT' || eventType === 'UPDATE') {
      const newRow = payload.new as Record<string, any>;
      if (!newRow?.id) return;
      changed = await applyRemoteRows(config, [newRow]);
    } else if (eventType === 'DELETE') {
      const oldRow = payload.old as Record<string, any>;
      if (!oldRow?.id) return;
      changed = await applyRemoteDelete(config, oldRow.id);
    }
    // The write already updated the cache; this only refreshes derived queries.
    if (changed > 0) queryClient.invalidateQueries({ queryKey: [config.queryKey] });
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
