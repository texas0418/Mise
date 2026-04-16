// app/settings/devices.tsx — Manage registered devices
import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { Smartphone, Tablet, Monitor, Trash2, ShieldCheck, ShieldOff } from 'lucide-react-native';
import { useDeviceLicense } from '@/contexts/DeviceLicenseContext';
import Colors from '@/constants/colors';

function DeviceIcon({ platform, size = 20 }: { platform: string; size?: number }) {
  if (platform === 'ios') return <Smartphone color={Colors.text.secondary} size={size} />;
  if (platform === 'android') return <Tablet color={Colors.text.secondary} size={size} />;
  return <Monitor color={Colors.text.secondary} size={size} />;
}

export default function DevicesScreen() {
  const {
    devices, currentDeviceUuid, licensedCount, monthlyPrice, pricing,
    deactivateDeviceById, removeDeviceById, refreshDevices, isLoading,
  } = useDeviceLicense();

  const handleDeactivate = useCallback((deviceId: string, name: string) => {
    Alert.alert('Deactivate Device', `Remove Pro access from "${name}"? You can reactivate later.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Deactivate', style: 'destructive', onPress: () => deactivateDeviceById(deviceId) },
    ]);
  }, [deactivateDeviceById]);

  const handleRemove = useCallback((deviceId: string, name: string) => {
    Alert.alert('Remove Device', `Remove "${name}" from your account? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeDeviceById(deviceId) },
    ]);
  }, [removeDeviceById]);

  const formatLastActive = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    if (diff < 60000) return 'Active now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(iso).toLocaleDateString();
  };

  if (isLoading) {
    return <View style={s.center}><ActivityIndicator color={Colors.accent.gold} size="large" /></View>;
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Summary card */}
      <View style={s.card}>
        <Text style={s.cardTitle}>Your Devices</Text>
        <Text style={s.cardStat}>{licensedCount} licensed of {devices.length} registered</Text>
        <View style={s.priceRow}>
          <Text style={s.priceLabel}>Monthly total</Text>
          <Text style={s.priceValue}>${monthlyPrice.toFixed(2)}/mo</Text>
        </View>
        <Text style={s.priceNote}>
          Base: ${pricing.baseMonthly}/mo (1 device) + ${pricing.additionalDeviceMonthly}/mo each additional
        </Text>
      </View>

      {/* Device list */}
      {devices.map((device) => {
        const isCurrent = device.deviceUuid === currentDeviceUuid;
        return (
          <View key={device.id} style={[s.deviceCard, isCurrent && s.deviceCardCurrent]}>
            <View style={s.deviceHeader}>
              <DeviceIcon platform={device.platform} />
              <View style={s.deviceInfo}>
                <View style={s.deviceNameRow}>
                  <Text style={s.deviceName}>{device.deviceName}</Text>
                  {isCurrent && <View style={s.currentBadge}><Text style={s.currentBadgeText}>This device</Text></View>}
                </View>
                <Text style={s.deviceModel}>{device.deviceModel} · {device.platform}</Text>
                <Text style={s.deviceTime}>{formatLastActive(device.lastActiveAt)}</Text>
              </View>
              {device.isLicensed
                ? <ShieldCheck color={Colors.status.active} size={20} />
                : <ShieldOff color={Colors.text.tertiary} size={20} />
              }
            </View>

            {/* Actions */}
            <View style={s.deviceActions}>
              {device.isLicensed && (
                <TouchableOpacity style={s.actionBtn} onPress={() => handleDeactivate(device.id, device.deviceName)} activeOpacity={0.7}>
                  <ShieldOff color={Colors.status.warning} size={14} />
                  <Text style={[s.actionText, { color: Colors.status.warning }]}>Deactivate</Text>
                </TouchableOpacity>
              )}
              {!isCurrent && (
                <TouchableOpacity style={s.actionBtn} onPress={() => handleRemove(device.id, device.deviceName)} activeOpacity={0.7}>
                  <Trash2 color={Colors.status.error} size={14} />
                  <Text style={[s.actionText, { color: Colors.status.error }]}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}

      {devices.length === 0 && (
        <Text style={s.emptyText}>No devices registered yet. Sign in to register this device.</Text>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg.primary },
  card: { backgroundColor: Colors.bg.card, borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 0.5, borderColor: Colors.border.subtle },
  cardTitle: { fontSize: 16, fontWeight: '600', color: Colors.text.primary, marginBottom: 4 },
  cardStat: { fontSize: 13, color: Colors.text.secondary, marginBottom: 12 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  priceLabel: { fontSize: 13, color: Colors.text.secondary },
  priceValue: { fontSize: 15, fontWeight: '700', color: Colors.accent.gold },
  priceNote: { fontSize: 11, color: Colors.text.tertiary, marginTop: 8 },
  deviceCard: { backgroundColor: Colors.bg.card, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 0.5, borderColor: Colors.border.subtle },
  deviceCardCurrent: { borderColor: Colors.accent.gold + '40' },
  deviceHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  deviceInfo: { flex: 1 },
  deviceNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deviceName: { fontSize: 15, fontWeight: '600', color: Colors.text.primary },
  currentBadge: { backgroundColor: Colors.accent.goldBg, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  currentBadgeText: { fontSize: 10, fontWeight: '600', color: Colors.accent.gold },
  deviceModel: { fontSize: 12, color: Colors.text.secondary, marginTop: 2 },
  deviceTime: { fontSize: 11, color: Colors.text.tertiary, marginTop: 1 },
  deviceActions: { flexDirection: 'row', gap: 16, marginTop: 10, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: Colors.border.subtle },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: 13, fontWeight: '500' },
  emptyText: { fontSize: 14, color: Colors.text.tertiary, textAlign: 'center', marginTop: 40 },
});
