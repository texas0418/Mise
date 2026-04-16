// --------------------------------------------------------------------------- //  app/settings/sync.tsx — Sync Settings Screen
//
//  Surfaces all sync controls and status in one place:
//    • Live sync status (status, pending count, last synced)
//    • Sync Now — triggers a full push + pull
//    • Upload Local Data — initial upload of all AsyncStorage → Supabase
//    • Force Full Re-Sync — clears cursors + re-downloads everything
//    • Clear Sync Data — flushes queue + disconnects realtime
//    • Conflict Log — shows failed queue items (coming soon placeholder)
// ---------------------------------------------------------------------------
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  RefreshCw,
  Trash2,
  Upload,
  Cloud,
  CloudOff,
  CheckCircle,
  AlertCircle,
  WifiOff,
  ChevronLeft,
  Info,
} from 'lucide-react-native';
import { useSync } from '@/contexts/SyncContext';
import { useAuth } from '@/contexts/AuthContext';
import Colors from '@/constants/colors';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return 'Never';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 10) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return new Date(isoString).toLocaleDateString();
}

// ── Sub-components ───────────────────────────────────────────────────────────

function StatusCard({
  syncStatus,
  pendingCount,
  lastSyncedAt,
  isSyncing,
  isSyncEnabled,
  isAuthenticated,
}: {
  syncStatus: string;
  pendingCount: number;
  lastSyncedAt: string | null;
  isSyncing: boolean;
  isSyncEnabled: boolean;
  isAuthenticated: boolean;
}) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (pendingCount > 0 && !isSyncing) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.3, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
    pulseAnim.setValue(1);
  }, [pendingCount, isSyncing]);

  const getStatusConfig = () => {
    if (!isAuthenticated || !isSyncEnabled) {
      return {
        icon: <CloudOff color={Colors.text.tertiary} size={20} />,
        label: 'Sync Disabled',
        sublabel: 'Sign in to sync across devices',
        color: Colors.text.tertiary,
        bg: Colors.bg.tertiary,
      };
    }
    if (syncStatus === 'offline') {
      return {
        icon: <WifiOff color={Colors.text.secondary} size={20} />,
        label: 'Offline',
        sublabel: 'Changes will sync when reconnected',
        color: Colors.text.secondary,
        bg: Colors.bg.tertiary,
      };
    }
    if (syncStatus === 'error') {
      return {
        icon: <AlertCircle color={Colors.status?.error ?? '#F87171'} size={20} />,
        label: 'Sync Error',
        sublabel: 'Tap "Sync Now" to retry',
        color: Colors.status?.error ?? '#F87171',
        bg: (Colors.status?.error ?? '#F87171') + '18',
      };
    }
    if (isSyncing) {
      return {
        icon: <ActivityIndicator size={18} color={Colors.accent.gold} />,
        label: 'Syncing…',
        sublabel: 'Pushing and pulling latest changes',
        color: Colors.accent.gold,
        bg: Colors.accent.goldBg,
      };
    }
    if (pendingCount > 0) {
      return {
        icon: (
          <Animated.View style={{ opacity: pulseAnim }}>
            <Cloud color={Colors.status?.warning ?? '#FBBF24'} size={20} />
          </Animated.View>
        ),
        label: `${pendingCount} Pending Change${pendingCount !== 1 ? 's' : ''}`,
        sublabel: 'Waiting to push to cloud',
        color: Colors.status?.warning ?? '#FBBF24',
        bg: (Colors.status?.warning ?? '#FBBF24') + '18',
      };
    }
    return {
      icon: <CheckCircle color={Colors.status?.success ?? '#34D399'} size={20} />,
      label: 'Synced',
      sublabel: `Last synced ${formatRelativeTime(lastSyncedAt)}`,
      color: Colors.status?.success ?? '#34D399',
      bg: (Colors.status?.success ?? '#34D399') + '18',
    };
  };

  const cfg = getStatusConfig();

  return (
    <View style={styles.statusCard}>
      <View style={[styles.statusIconWrap, { backgroundColor: cfg.bg }]}>
        {cfg.icon}
      </View>
      <View style={styles.statusTextWrap}>
        <Text style={[styles.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
        <Text style={styles.statusSublabel}>{cfg.sublabel}</Text>
      </View>
    </View>
  );
}

function StatsRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <View style={styles.statsRow}>
      <Text style={styles.statsLabel}>{label}</Text>
      <Text style={[styles.statsValue, valueColor ? { color: valueColor } : null]}>
        {value}
      </Text>
    </View>
  );
}

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
  warning?: boolean;
  loading?: boolean;
}

function ActionButton({
  icon,
  label,
  sublabel,
  onPress,
  disabled,
  destructive,
  warning,
  loading,
}: ActionButtonProps) {
  const color = destructive
    ? Colors.status?.error ?? '#F87171'
    : warning
    ? Colors.status?.warning ?? '#FBBF24'
    : Colors.accent.gold;

  return (
    <TouchableOpacity
      style={[styles.actionBtn, (disabled || loading) && styles.actionBtnDisabled]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      <View style={[styles.actionIconWrap, { backgroundColor: color + '18' }]}>
        {loading ? <ActivityIndicator size={16} color={color} /> : icon}
      </View>
      <View style={styles.actionTextWrap}>
        <Text style={[styles.actionLabel, { color }]}>{label}</Text>
        {sublabel && <Text style={styles.actionSublabel}>{sublabel}</Text>}
      </View>
    </TouchableOpacity>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function SyncSettingsScreen() {
  const router = useRouter();
  const {
    syncStatus,
    pendingCount,
    lastSyncedAt,
    isSyncing,
    isSyncEnabled,
    syncNow,
    doInitialUpload,
    doForceResync,
    resetSync,
  } = useSync();
  const { isAuthenticated, user } = useAuth();

  const [uploading, setUploading] = useState(false);
  const [resyncing, setResyncing] = useState(false);

  // ── Live relative-time ticker ──────────────────────────────────────────
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────
  const handleSyncNow = useCallback(async () => {
    await syncNow();
  }, [syncNow]);

  const handleUpload = useCallback(async () => {
    Alert.alert(
      'Upload Local Data',
      'Push all local data to the cloud. Existing cloud records will be updated only if your local version is newer.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Upload',
          onPress: async () => {
            setUploading(true);
            try {
              const count = await doInitialUpload();
              Alert.alert('Upload Complete', `Uploaded ${count} record${count !== 1 ? 's' : ''} to the cloud.`);
            } catch (e: any) {
              Alert.alert('Upload Failed', e.message ?? 'An error occurred.');
            } finally {
              setUploading(false);
            }
          },
        },
      ]
    );
  }, [doInitialUpload]);

  const handleForceResync = useCallback(() => {
    Alert.alert(
      'Force Full Re-Sync',
      'This will clear your sync history and re-download all data from the cloud. Your local data will be merged — nothing will be deleted. This may take a moment.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Re-Sync',
          style: 'destructive',
          onPress: async () => {
            setResyncing(true);
            try {
              await doForceResync();
              Alert.alert('Re-Sync Complete', 'All data has been refreshed from the cloud.');
            } catch (e: any) {
              Alert.alert('Re-Sync Failed', e.message ?? 'An error occurred.');
            } finally {
              setResyncing(false);
            }
          },
        },
      ]
    );
  }, [doForceResync]);

  const handleClear = useCallback(() => {
    Alert.alert(
      'Clear Sync Data',
      'This clears the pending queue and disconnects real-time updates. Your local data is not affected. You can re-sync at any time.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            resetSync();
            Alert.alert('Cleared', 'Sync queue cleared and realtime disconnected.');
          },
        },
      ]
    );
  }, [resetSync]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Back header ──────────────────────────────────────────────── */}
      <TouchableOpacity style={styles.backRow} onPress={() => router.back()} activeOpacity={0.7}>
        <ChevronLeft color={Colors.text.secondary} size={20} />
        <Text style={styles.backText}>Sync Settings</Text>
      </TouchableOpacity>

      {/* ── Status card ─────────────────────────────────────────────── */}
      <StatusCard
        syncStatus={syncStatus}
        pendingCount={pendingCount}
        lastSyncedAt={lastSyncedAt}
        isSyncing={isSyncing}
        isSyncEnabled={isSyncEnabled}
        isAuthenticated={isAuthenticated}
      />

      {/* ── Stats ───────────────────────────────────────────────────── */}
      {isAuthenticated && (
        <View style={styles.statsCard}>
          <StatsRow label="Account" value={user?.email ?? '—'} />
          <View style={styles.statsDivider} />
          <StatsRow
            label="Pending changes"
            value={String(pendingCount)}
            valueColor={
              pendingCount > 0 ? (Colors.status?.warning ?? '#FBBF24') : undefined
            }
          />
          <View style={styles.statsDivider} />
          <StatsRow
            label="Last synced"
            value={formatRelativeTime(lastSyncedAt)}
          />
          <View style={styles.statsDivider} />
          <StatsRow
            label="Sync status"
            value={
              isSyncing
                ? 'Syncing…'
                : syncStatus.charAt(0).toUpperCase() + syncStatus.slice(1)
            }
          />
        </View>
      )}

      {/* ── Actions ──────────────────────────────────────────────────── */}
      {isAuthenticated ? (
        <>
          <Text style={styles.sectionHeader}>Actions</Text>

          <ActionButton
            icon={<RefreshCw color={Colors.accent.gold} size={18} />}
            label="Sync Now"
            sublabel="Push pending changes and pull latest from cloud"
            onPress={handleSyncNow}
            loading={isSyncing && !uploading && !resyncing}
            disabled={uploading || resyncing}
          />

          <ActionButton
            icon={<Upload color={Colors.accent.gold} size={18} />}
            label="Upload Local Data"
            sublabel="Push all local records to cloud for first-time setup"
            onPress={handleUpload}
            loading={uploading}
            disabled={isSyncing || resyncing}
          />

          <Text style={styles.sectionHeader}>Advanced</Text>

          <ActionButton
            icon={<RefreshCw color={Colors.status?.warning ?? '#FBBF24'} size={18} />}
            label="Force Full Re-Sync"
            sublabel="Clear sync history and re-download all data"
            onPress={handleForceResync}
            loading={resyncing}
            disabled={isSyncing || uploading}
            warning
          />

          <ActionButton
            icon={<Trash2 color={Colors.status?.error ?? '#F87171'} size={18} />}
            label="Clear Sync Data"
            sublabel="Flush queue and disconnect realtime"
            onPress={handleClear}
            disabled={isSyncing || uploading || resyncing}
            destructive
          />
        </>
      ) : (
        /* ── Not signed in ─────────────────────────────────────────── */
        <View style={styles.infoCard}>
          <Info color={Colors.text.tertiary} size={18} />
          <Text style={styles.infoText}>
            Sign in to enable multi-device sync. Your local data is stored securely on this
            device and will be uploaded automatically when you sign in.
          </Text>
        </View>
      )}

      {/* ── Info footer ─────────────────────────────────────────────── */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Mise uses offline-first sync — your data is always available on this device, even
          without a connection. Changes are pushed to the cloud in the background and arrive
          on other devices in real time.
        </Text>
      </View>
    </ScrollView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 48,
  },

  // Back header
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 20,
  },
  backText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },

  // Status card
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.card,
    borderRadius: 16,
    padding: 16,
    gap: 14,
    borderWidth: 0.5,
    borderColor: Colors.border.subtle,
    marginBottom: 12,
  },
  statusIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusTextWrap: {
    flex: 1,
  },
  statusLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  statusSublabel: {
    fontSize: 12,
    color: Colors.text.tertiary,
    marginTop: 2,
  },

  // Stats card
  statsCard: {
    backgroundColor: Colors.bg.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 0.5,
    borderColor: Colors.border.subtle,
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  statsLabel: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
  statsValue: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.primary,
    textAlign: 'right',
    maxWidth: '60%',
  },
  statsDivider: {
    height: 0.5,
    backgroundColor: Colors.border.subtle,
  },

  // Section header
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 10,
    marginTop: 4,
  },

  // Action buttons
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: Colors.border.subtle,
    gap: 14,
  },
  actionBtnDisabled: {
    opacity: 0.45,
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionTextWrap: {
    flex: 1,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionSublabel: {
    fontSize: 11,
    color: Colors.text.tertiary,
    marginTop: 2,
    lineHeight: 15,
  },

  // Not signed in info card
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.bg.card,
    borderRadius: 14,
    padding: 16,
    gap: 12,
    borderWidth: 0.5,
    borderColor: Colors.border.subtle,
    marginBottom: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 19,
  },

  // Footer
  footer: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border.subtle,
  },
  footerText: {
    fontSize: 12,
    color: Colors.text.tertiary,
    lineHeight: 18,
    textAlign: 'center',
  },
});
