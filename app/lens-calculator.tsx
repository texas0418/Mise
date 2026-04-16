import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';
import { Aperture } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { LENS_DATA } from '@/mocks/data';
import PermissionGate from '@/contexts/PermissionGate';

const SENSOR_SIZES = [
  { label: 'Full Frame', width: 36, height: 24 },
  { label: 'Super 35', width: 24.89, height: 18.66 },
  { label: 'APS-C', width: 23.5, height: 15.6 },
  { label: 'Micro 4/3', width: 17.3, height: 13 },
  { label: 'S16mm', width: 12.52, height: 7.41 },
];

const ASPECT_RATIOS = [
  { label: '2.39:1', value: 2.39, name: 'Anamorphic' },
  { label: '2.00:1', value: 2.0, name: 'Univisium' },
  { label: '1.85:1', value: 1.85, name: 'Theatrical Wide' },
  { label: '16:9', value: 16 / 9, name: 'HD Standard' },
  { label: '4:3', value: 4 / 3, name: 'Academy' },
  { label: '1:1', value: 1, name: 'Square' },
];

export default function LensCalculatorScreen() {
  const [selectedSensor, setSelectedSensor] = useState(1);
  const [selectedLens, setSelectedLens] = useState<number | null>(null);

  const sensor = SENSOR_SIZES[selectedSensor];

  const lensInfo = useMemo(() => {
    return LENS_DATA.map(lens => {
      const hFov = 2 * Math.atan(sensor.width / (2 * lens.focal)) * (180 / Math.PI);
      const vFov = 2 * Math.atan(sensor.height / (2 * lens.focal)) * (180 / Math.PI);
      const cropFactor = 36 / sensor.width;
      const equiv35 = Math.round(lens.focal * cropFactor);
      return { ...lens, hFov: hFov.toFixed(1), vFov: vFov.toFixed(1), equiv35 };
    });
  }, [sensor]);

  return (
    <PermissionGate resource="lens_calc">
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Stack.Screen options={{ title: 'Lens Calculator' }} />

      <View style={styles.sensorSection}>
        <Text style={styles.sectionTitle}>Sensor Format</Text>
        <View style={styles.sensorRow}>
          {SENSOR_SIZES.map((s, i) => (
            <TouchableOpacity
              key={s.label}
              style={[styles.sensorChip, selectedSensor === i && styles.sensorChipActive]}
              onPress={() => setSelectedSensor(i)}
            >
              <Text style={[styles.sensorChipText, selectedSensor === i && styles.sensorChipTextActive]}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.sensorInfo}>{sensor.width}mm × {sensor.height}mm</Text>
      </View>

      <View style={styles.aspectSection}>
        <Text style={styles.sectionTitle}>Common Aspect Ratios</Text>
        <View style={styles.aspectGrid}>
          {ASPECT_RATIOS.map(ar => (
            <View key={ar.label} style={styles.aspectCard}>
              <View style={[styles.aspectPreview, { aspectRatio: ar.value }]}>
                <View style={styles.aspectInner} />
              </View>
              <Text style={styles.aspectLabel}>{ar.label}</Text>
              <Text style={styles.aspectName}>{ar.name}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.lensSection}>
        <Text style={styles.sectionTitle}>Focal Length Reference</Text>
        {lensInfo.map((lens, i) => (
          <TouchableOpacity
            key={lens.focal}
            style={[styles.lensCard, selectedLens === i && styles.lensCardActive]}
            onPress={() => setSelectedLens(selectedLens === i ? null : i)}
            activeOpacity={0.7}
          >
            <View style={styles.lensLeft}>
              <Text style={styles.lensFocal}>{lens.focal}mm</Text>
              <Text style={styles.lensType}>{lens.type}</Text>
            </View>
            <View style={styles.lensCenter}>
              <View style={styles.fovBar}>
                <View style={[styles.fovFill, { width: `${Math.min(100, parseFloat(lens.hFov))}%` as unknown as number }]} />
              </View>
              <Text style={styles.fovText}>H: {lens.hFov}° / V: {lens.vFov}°</Text>
            </View>
            <View style={styles.lensRight}>
              <Text style={styles.equivText}>{lens.equiv35}mm</Text>
              <Text style={styles.equivLabel}>35mm eq.</Text>
            </View>
            {selectedLens === i && (
              <View style={styles.lensDetail}>
                <Text style={styles.lensUseText}>{lens.use}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  </PermissionGate>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  content: { padding: 16, paddingBottom: 40 },
  sectionTitle: { fontSize: 11, fontWeight: '700' as const, color: Colors.text.tertiary, textTransform: 'uppercase' as const, letterSpacing: 1.2, marginBottom: 10 },
  sensorSection: { marginBottom: 24 },
  sensorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sensorChip: { backgroundColor: Colors.bg.card, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 0.5, borderColor: Colors.border.subtle },
  sensorChipActive: { backgroundColor: Colors.accent.goldBg, borderColor: Colors.accent.gold + '44' },
  sensorChipText: { fontSize: 12, fontWeight: '600' as const, color: Colors.text.secondary },
  sensorChipTextActive: { color: Colors.accent.gold },
  sensorInfo: { fontSize: 11, color: Colors.text.tertiary, marginTop: 8 },
  aspectSection: { marginBottom: 24 },
  aspectGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  aspectCard: { width: '30%' as unknown as number, alignItems: 'center', backgroundColor: Colors.bg.card, borderRadius: 10, padding: 10, borderWidth: 0.5, borderColor: Colors.border.subtle, flexGrow: 0, flexShrink: 0, flexBasis: '30%' },
  aspectPreview: { width: '80%' as unknown as number, backgroundColor: Colors.bg.elevated, borderRadius: 4, overflow: 'hidden', borderWidth: 1, borderColor: Colors.accent.gold + '33', marginBottom: 6 },
  aspectInner: { flex: 1 },
  aspectLabel: { fontSize: 12, fontWeight: '700' as const, color: Colors.text.primary },
  aspectName: { fontSize: 9, color: Colors.text.tertiary, marginTop: 1 },
  lensSection: { marginBottom: 24 },
  lensCard: { backgroundColor: Colors.bg.card, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 0.5, borderColor: Colors.border.subtle, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  lensCardActive: { borderColor: Colors.accent.gold + '44' },
  lensLeft: { width: 70 },
  lensFocal: { fontSize: 16, fontWeight: '700' as const, color: Colors.text.primary },
  lensType: { fontSize: 10, color: Colors.text.tertiary, marginTop: 1 },
  lensCenter: { flex: 1, paddingHorizontal: 10 },
  fovBar: { height: 4, backgroundColor: Colors.bg.elevated, borderRadius: 2, overflow: 'hidden' },
  fovFill: { height: 4, backgroundColor: Colors.accent.gold, borderRadius: 2 },
  fovText: { fontSize: 10, color: Colors.text.tertiary, marginTop: 4 },
  lensRight: { alignItems: 'flex-end' },
  equivText: { fontSize: 13, fontWeight: '600' as const, color: Colors.text.secondary },
  equivLabel: { fontSize: 9, color: Colors.text.tertiary },
  lensDetail: { width: '100%', marginTop: 10, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: Colors.border.subtle },
  lensUseText: { fontSize: 12, color: Colors.text.secondary, lineHeight: 18 },
});
