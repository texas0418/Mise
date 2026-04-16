// contexts/SyncContext.tsx — Orchestrates sync engine + realtime + UI state
import { useEffect, useState, useCallback, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import createContextHook from '@nkzw/create-context-hook';
import { useAuth } from '@/contexts/AuthContext';
import {
  fullSync,
  initialUpload,
  forceFullResync,
  isSyncEnabled,
  onSyncStatusChange,
  runMigrationsIfNeeded,
  type SyncStatus,
} from '@/lib/syncEngine';
import {
  loadQueue,
  enqueue as queueEnqueue,
  getPendingCount,
  clearQueue,
  type SyncAction,
} from '@/lib/syncQueue';
import { subscribeToChanges, unsubscribeAll } from '@/lib/realtimeSubscriptions';

export const [SyncProvider, useSync] = createContextHook(() => {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hasCompletedInitialSync, setHasCompletedInitialSync] = useState(false);

  const userId = user?.id ?? null;
  const syncEnabledRef = useRef(false);
  syncEnabledRef.current = isSyncEnabled(userId);

  // Load queue on mount
  useEffect(() => {
    loadQueue().then(() => setPendingCount(getPendingCount()));
  }, []);

  // Listen to sync status changes
  useEffect(() => {
    return onSyncStatusChange((s) => {
      setSyncStatus(s);
      setIsSyncing(s === 'syncing');
    });
  }, []);

  // Subscribe to realtime when authenticated
  useEffect(() => {
    if (isAuthenticated && userId) subscribeToChanges(userId, queryClient);
    else unsubscribeAll();
    return () => unsubscribeAll();
  }, [isAuthenticated, userId, queryClient]);

  // Sync on app foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active' && syncEnabledRef.current && userId) doSync(userId);
    });
    return () => sub.remove();
  }, [userId]);

  // Run migrations then initial sync when user first authenticates
  useEffect(() => {
    if (isAuthenticated && userId && !hasCompletedInitialSync) {
      (async () => {
        // Run any pending one-time migrations first (clears stale cache if needed)
        const migrated = await runMigrationsIfNeeded();
        if (migrated) {
          // Force React Query to reload from AsyncStorage after cache clear
          queryClient.invalidateQueries();
        }
        await doSync(userId);
        setHasCompletedInitialSync(true);
      })();
    }
  }, [isAuthenticated, userId]);

  const doSync = useCallback(async (uid: string) => {
    if (!uid) return;
    setIsSyncing(true);
    try {
      const result = await fullSync(uid);
      setLastSyncedAt(new Date().toISOString());
      setPendingCount(getPendingCount());
      if (result.pulled > 0) queryClient.invalidateQueries();
    } catch (e: any) {
      console.warn('[SyncContext] Sync failed:', e.message);
    } finally {
      setIsSyncing(false);
    }
  }, [queryClient]);

  const syncNow = useCallback(async () => {
    if (userId) await doSync(userId);
  }, [userId, doSync]);

  const enqueueMutation = useCallback(async (
    table: string,
    recordId: string,
    action: SyncAction,
    data: Record<string, any> | null,
  ) => {
    if (!syncEnabledRef.current) return;
    await queueEnqueue(table, recordId, action, data);
    setPendingCount(getPendingCount());
  }, []);

  const doInitialUpload = useCallback(async () => {
    if (!userId) return 0;
    setIsSyncing(true);
    try {
      const c = await initialUpload(userId);
      setLastSyncedAt(new Date().toISOString());
      return c;
    } finally {
      setIsSyncing(false);
    }
  }, [userId]);

  const doForceResync = useCallback(async () => {
    if (!userId) return;
    setIsSyncing(true);
    try {
      await forceFullResync(userId);
      setLastSyncedAt(new Date().toISOString());
      queryClient.invalidateQueries();
    } finally {
      setIsSyncing(false);
    }
  }, [userId, queryClient]);

  const resetSync = useCallback(async () => {
    await clearQueue();
    unsubscribeAll();
    setPendingCount(0);
    setLastSyncedAt(null);
    setHasCompletedInitialSync(false);
    setSyncStatus('idle');
  }, []);

  return {
    syncStatus,
    pendingCount,
    lastSyncedAt,
    isSyncing,
    isSyncEnabled: syncEnabledRef.current,
    syncNow,
    enqueueMutation,
    doInitialUpload,
    doForceResync,
    resetSync,
  };
});
