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
  refreshMemberships,
  clearLocalSyncData,
  type SyncStatus,
} from '@/lib/syncEngine';
import { onProEntitledChange } from '@/lib/entitlement';
import { onAcceptedProjectsChange } from '@/lib/syncGate';
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

  /* Whether the queue is pushed and the server pulled. Recomputed whenever
   * the entitlement or the account's memberships change, not only when this
   * provider happens to re-render: it used to be read into a ref during
   * render, so buying Pro left sync off until something else re-rendered. */
  const [syncEnabled, setSyncEnabled] = useState(() => isSyncEnabled(userId));
  useEffect(() => {
    const recompute = () => setSyncEnabled(isSyncEnabled(userId));
    recompute();
    const offPro = onProEntitledChange(recompute);
    const offMembers = onAcceptedProjectsChange(recompute);
    return () => { offPro(); offMembers(); };
  }, [userId]);

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

  const doSync = useCallback(async (uid: string) => {
    if (!uid) return;
    setIsSyncing(true);
    try {
      // fullSync re-reads memberships and applies the gate itself.
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

  // Becoming entitled (a purchase, or accepting an invite) syncs right away.
  const wasEnabled = useRef(syncEnabled);
  useEffect(() => {
    const turnedOn = syncEnabled && !wasEnabled.current;
    wasEnabled.current = syncEnabled;
    if (turnedOn && userId && hasCompletedInitialSync) void doSync(userId);
  }, [syncEnabled, userId, hasCompletedInitialSync, doSync]);

  // Subscribe to realtime while sync is on. A change to this account's own
  // memberships re-reads them and syncs, which does a full pull on a join.
  useEffect(() => {
    if (!isAuthenticated || !userId || !syncEnabled) {
      unsubscribeAll();
      return;
    }
    subscribeToChanges(userId, queryClient, () => {
      void refreshMemberships(userId).then(() => doSync(userId));
    });
    return () => unsubscribeAll();
  }, [isAuthenticated, userId, syncEnabled, queryClient, doSync]);

  // Sync on app foreground. fullSync checks the gate, and checking it there
  // also re-reads memberships, which is how a newly invited member turns on.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active' && userId) void doSync(userId);
    });
    return () => sub.remove();
  }, [userId, doSync]);

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

  const syncNow = useCallback(async () => {
    if (userId) await doSync(userId);
  }, [userId, doSync]);

  const enqueueMutation = useCallback(async (
    table: string,
    recordId: string,
    action: SyncAction,
    data: Record<string, any> | null,
  ) => {
    // Always queued, entitled or not. Only the push is gated, so an edit made
    // before sync turns on (a purchase, an accepted invite) is not lost.
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

  /**
   * Stop syncing this account on this device. With `clearData`, also remove
   * every local record, the queue and the cursors, so the next account to
   * sign in here neither sees nor pushes the previous one's data.
   */
  const resetSync = useCallback(async (options?: { clearData?: boolean }) => {
    unsubscribeAll();
    if (options?.clearData) {
      await clearLocalSyncData();
      await queryClient.resetQueries();
    } else {
      await clearQueue();
    }
    setPendingCount(0);
    setLastSyncedAt(null);
    setHasCompletedInitialSync(false);
    setSyncStatus('idle');
  }, [queryClient]);

  return {
    syncStatus,
    pendingCount,
    lastSyncedAt,
    isSyncing,
    isSyncEnabled: syncEnabled,
    syncNow,
    enqueueMutation,
    doInitialUpload,
    doForceResync,
    resetSync,
  };
});
