import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';
import Colors from '@/constants/colors';
import PermissionGate from '@/contexts/PermissionGate';

const ASPECT_RATIOS = [
  { label: '2.39:1', value: 2.39, name: 'Anamorphic / Scope', desc: 'Epic, cinematic feel. Used in blockbusters and prestige films. Think Blade Runner 2049, Lawrence of Arabia.' },
  { label: '2.00:1', value: 2.0, name: 'Univisium', desc: 'Proposed by Vittorio Storaro. Compromise between scope and standard. Netflix default for many originals.' },
  { label: '1.85:1', value: 1.85, name: 'Theatrical Wide', desc: 'US theatrical standard. Slightly wider than 16:9. Natural, versatile framing.' },
  { label: '16:9', value: 16 / 9, name: 'HD / Broadcast', desc: 'Television and streaming standard. Most common format for digital distribution.' },
  { label: '1.5:1', value: 1.5, name: 'ARRI Open Gate', desc: 'Full sensor capture on ARRI cameras. Provides maximum flexibility in post.' },
  { label: '4:3', value: 4 / 3, name: 'Academy', desc: 'Classic film ratio. Intimate, portrait-friendly. Used in The Lighthouse, First Reformed.' },
  { label: '1:1', value: 1, name: 'Square', desc: 'Instagram format. Used artistically in Mommy (Dolan) and experimental work.' },
  { label: '9:16', value: 9 / 16, name: 'Vertical', desc: 'Mobile-first content. TikTok, Instagram Stories, vertical filmmaking.' },
  { label: '1.33:1', value: 1.33, name: 'Full Frame / Silent Era', desc: 'Original motion picture format before optical sound. Authentic vintage feel.' },
  { label: '2.76:1', value: 2.76, name: 'Ultra Panavision 70', desc: 'Extremely wide format. Used in Ben-Hur and The Hateful Eight.' },
];

export default function FrameGuidesScreen() {
  const [selected, setSelected] = useState<number | null>(0);

  return (
    <PermissionGate resource="frame_guides">
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Stack.Screen options={{ title: 'Frame Guides' }} />

      <Text style={styles.intro}>Tap any ratio to see details and a proportional frame preview.</Text>

      {ASPECT_RATIOS.map((ratio, i) => {
        const isSelected = selected === i;
        const frameWidth = 280;
        const frameHeight = frameWidth / ratio.value;
        const maxHeight = 200;
        const displayHeight = Math.min(frameHeight, maxHeight);
        const displayWidth = displayHeight * ratio.value;

        return (
          <TouchableOpacity
            key={ratio.label}
            style={[styles.ratioCard, isSelected && styles.ratioCardActive]}
            onPress={() => setSelected(isSelected ? null : i)}
            activeOpacity={0.7}
          >
            <View style={styles.ratioHeader}>
              <View style={styles.ratioLabelWrap}>
                <Text style={[styles.ratioLabel, isSelected && styles.ratioLabelActive]}>{ratio.label}</Text>
                <Text style={styles.ratioName}>{ratio.name}</Text>
              </View>
            </View>

            {isSelected && (
              <View style={styles.ratioDetail}>
                <View style={styles.frameContainer}>
                  <View style={[styles.frame, { width: Math.min(displayWidth, frameWidth), height: displayHeight }]}>
                    <View style={styles.frameInner}>
                      <View style={styles.crossH} />
                      <View style={styles.crossV} />
                      <View style={styles.thirdH1} />
                      <View style={styles.thirdH2} />
                      <View style={styles.thirdV1} />
                      <View style={styles.thirdV2} />
                    </View>
                    <Text style={styles.frameLabel}>{ratio.label}</Text>
                  </View>
                </View>
                <Text style={styles.ratioDesc}>{ratio.desc}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  </PermissionGate>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  content: { padding: 16, paddingBottom: 40 },
  intro: { fontSize: 13, color: Colors.text.secondary, marginBottom: 16, lineHeight: 19 },
  ratioCard: { backgroundColor: Colors.bg.card, borderRadius: 12, marginBottom: 8, borderWidth: 0.5, borderColor: Colors.border.subtle, overflow: 'hidden' },
  ratioCardActive: { borderColor: Colors.accent.gold + '44' },
  ratioHeader: { padding: 14 },
  ratioLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ratioLabel: { fontSize: 18, fontWeight: '800' as const, color: Colors.text.primary, minWidth: 60 },
  ratioLabelActive: { color: Colors.accent.gold },
  ratioName: { fontSize: 13, color: Colors.text.secondary },
  ratioDetail: { paddingHorizontal: 14, paddingBottom: 14 },
  frameContainer: { alignItems: 'center', marginBottom: 12, paddingVertical: 12, backgroundColor: Colors.bg.elevated, borderRadius: 8 },
  frame: { borderWidth: 2, borderColor: Colors.accent.gold, borderRadius: 4, position: 'relative', overflow: 'hidden' },
  frameInner: { flex: 1, position: 'relative' },
  crossH: { position: 'absolute', top: '50%', left: 0, right: 0, height: 0.5, backgroundColor: Colors.accent.gold + '33' },
  crossV: { position: 'absolute', left: '50%', top: 0, bottom: 0, width: 0.5, backgroundColor: Colors.accent.gold + '33' },
  thirdH1: { position: 'absolute', top: '33.3%', left: 0, right: 0, height: 0.5, backgroundColor: Colors.text.tertiary + '44' },
  thirdH2: { position: 'absolute', top: '66.6%', left: 0, right: 0, height: 0.5, backgroundColor: Colors.text.tertiary + '44' },
  thirdV1: { position: 'absolute', left: '33.3%', top: 0, bottom: 0, width: 0.5, backgroundColor: Colors.text.tertiary + '44' },
  thirdV2: { position: 'absolute', left: '66.6%', top: 0, bottom: 0, width: 0.5, backgroundColor: Colors.text.tertiary + '44' },
  frameLabel: { position: 'absolute', bottom: 4, right: 6, fontSize: 9, color: Colors.accent.gold + '88', fontWeight: '700' as const },
  ratioDesc: { fontSize: 13, color: Colors.text.secondary, lineHeight: 19 },
});
