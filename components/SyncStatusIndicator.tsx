// --------------------------------------------------------------------------- //  components/SyncStatusIndicator.tsx
//
//  A compact, tap-able sync status pill for use in navigation headers or
//  settings rows.  Shows one of four states:
//    • idle / synced  → green checkmark  "Synced"
//    • syncing        → animated spinner "Syncing…"
//    • pending        → amber dot        "3 pending"
//    • error          → red dot          "Sync error"
//    • offline        → grey dot         "Offline"
//
//  Usage:
//    import SyncStatusIndicator from '@/components/SyncStatusIndicator';
//    <SyncStatusIndicator />                    // minimal pill
//    <SyncStatusIndicator showLabel />          // pill + text
//    <SyncStatusIndicator onPress={…} />        // tap to open sync settings
// --------------------------------------------------------------------------- 
import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { CheckCircle, AlertCircle, WifiOff, Cloud } from 'lucide-react-native';
import { useSync } from '@/contexts/SyncContext';
import Colors from '@/constants/colors';

interface SyncStatusIndicatorProps {
  /** Show the text label alongside the icon (default: true) */
  showLabel?: boolean;
  /** Called when the indicator is pressed (e.g. navigate to sync settings) */
  onPress?: () => void;
  /** Additional style overrides for the outer container */
  style?: object;
}

export default function SyncStatusIndicator({
  showLabel = true,
  onPress,
  style,
}: SyncStatusIndicatorProps) {
  const { syncStatus, pendingCount, isSyncing, lastSyncedAt, isSyncEnabled } = useSync();

  // ── Pulse animation for "pending" state ─────────────────────────────────
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (pendingCount > 0 && !isSyncing) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.4,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [pendingCount, isSyncing]);

  // ── Derive display props ─────────────────────────────────────────────────
  const getDisplay = () => {
    if (!isSyncEnabled) {
      return {
        label: 'Not signed in',
        color: Colors.text.tertiary,
        icon: <Cloud color={Colors.text.tertiary} size={14} />,
      };
    }
    if (syncStatus === 'offline') {
      return {
        label: 'Offline',
        color: Colors.text.tertiary,
        icon: <WifiOff color={Colors.text.tertiary} size={14} />,
      };
    }
    if (syncStatus === 'error') {
      return {
        label: 'Sync error',
        color: Colors.status?.error ?? '#F87171',
        icon: <AlertCircle color={Colors.status?.error ?? '#F87171'} size={14} />,
      };
    }
    if (isSyncing) {
      return {
        label: 'Syncing…',
        color: Colors.accent.gold,
        icon: (
          <ActivityIndicator
            size={12}
            color={Colors.accent.gold}
            style={{ marginRight: 2 }}
          />
        ),
      };
    }
    if (pendingCount > 0) {
      return {
        label: `${pendingCount} pending`,
        color: Colors.status?.warning ?? '#FBBF24',
        icon: (
          <Animated.View style={{ opacity: pulseAnim }}>
            <View style={[styles.dot, { backgroundColor: Colors.status?.warning ?? '#FBBF24' }]} />
          </Animated.View>
        ),
      };
    }
    // idle / synced
    return {
      label: lastSyncedAt ? 'Synced' : 'Ready',
      color: Colors.status?.success ?? '#34D399',
      icon: <CheckCircle color={Colors.status?.success ?? '#34D399'} size={14} />,
    };
  };

  const { label, color, icon } = getDisplay();

  const pill = (
    <View style={[styles.pill, style]}>
      {icon}
      {showLabel && (
        <Text style={[styles.label, { color }]} numberOfLines={1}>
          {label}
        </Text>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        {pill}
      </TouchableOpacity>
    );
  }
  return pill;
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
  },
});
