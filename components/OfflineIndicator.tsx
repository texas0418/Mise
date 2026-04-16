// ---------------------------------------------------------------------------
// components/OfflineIndicator.tsx — Shows "Offline" banner when disconnected
// ---------------------------------------------------------------------------

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useSync } from '@/contexts/SyncContext';
import Colors from '@/constants/colors';

export default function OfflineIndicator() {
  const { isOnline } = useNetworkStatus();
  const { pendingCount } = useSync();

  if (isOnline) return null;

  return (
    <View style={s.banner}>
      <WifiOff color="#fff" size={14} />
      <Text style={s.text}>
        Offline{pendingCount > 0 ? ` · ${pendingCount} pending change${pendingCount !== 1 ? 's' : ''}` : ''}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Colors.status.error,
    paddingVertical: 4,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
});
