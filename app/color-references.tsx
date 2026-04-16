import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Plus, Paintbrush, AlertCircle, ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react-native';
import { useProjects, useProjectColorReferences } from '@/contexts/ProjectContext';
import { useLayout } from '@/utils/useLayout';
import Colors from '@/constants/colors';
import { ColorReference, LUTStyle } from '@/types';
import { LUT_STYLES } from '@/mocks/data';
import PermissionGate from '@/contexts/PermissionGate';

function ColorSwatch({ color, size = 24 }: { color: string; size?: number }) {
  return <View style={[styles.swatch, { backgroundColor: color, width: size, height: size, borderRadius: size / 4 }]} />;
}

function LutPreview({ lutStyle }: { lutStyle: LUTStyle }) {
  const lut = LUT_STYLES.find(l => l.value === lutStyle);
  if (!lut) return null;
  return (
    <View style={styles.lutPreview}>
      {lut.colors.map((c, i) => <View key={i} style={[styles.lutBar, { backgroundColor: c }]} />)}
    </View>
  );
}

function ColorRefCard({ item, isExpanded, onPress, onEdit, onDelete }: {
  item: ColorReference;
  isExpanded: boolean;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const lut = LUT_STYLES.find(l => l.value === item.lutStyle);

  const handleDelete = () => {
    Alert.alert('Delete Color Reference', `Remove "${item.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);
  };

  return (
    <TouchableOpacity
      style={[styles.card, isExpanded && styles.cardExpanded]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Header — always visible */}
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          {item.sceneNumber && <Text style={styles.sceneText}>Scene {item.sceneNumber}</Text>}
        </View>
        <View style={styles.headerRight}>
          <View style={styles.miniSwatches}>
            <ColorSwatch color={item.primaryColor} size={16} />
            <ColorSwatch color={item.secondaryColor} size={16} />
            <ColorSwatch color={item.accentColor} size={16} />
          </View>
          <LutPreview lutStyle={item.lutStyle} />
          {isExpanded ? <ChevronUp color={Colors.text.tertiary} size={14} /> : <ChevronDown color={Colors.text.tertiary} size={14} />}
        </View>
      </View>

      {/* Expanded body */}
      {isExpanded && (
        <View style={styles.expandedBody}>
          {/* Palette */}
          <View style={styles.paletteRow}>
            <View style={styles.paletteItem}>
              <ColorSwatch color={item.primaryColor} size={36} />
              <Text style={styles.paletteLabel}>Primary</Text>
              <Text style={styles.paletteHex}>{item.primaryColor}</Text>
            </View>
            <View style={styles.paletteItem}>
              <ColorSwatch color={item.secondaryColor} size={36} />
              <Text style={styles.paletteLabel}>Secondary</Text>
              <Text style={styles.paletteHex}>{item.secondaryColor}</Text>
            </View>
            <View style={styles.paletteItem}>
              <ColorSwatch color={item.accentColor} size={36} />
              <Text style={styles.paletteLabel}>Accent</Text>
              <Text style={styles.paletteHex}>{item.accentColor}</Text>
            </View>
          </View>

          {/* Attributes */}
          <View style={styles.attributeRow}>
            <View style={styles.attrChip}><Text style={styles.attrText}>{item.contrast} contrast</Text></View>
            <View style={styles.attrChip}><Text style={styles.attrText}>{item.saturation}</Text></View>
            <View style={styles.attrChip}><Text style={styles.attrText}>{item.temperature}</Text></View>
          </View>

          {/* LUT */}
          {lut && (
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>LUT STYLE</Text>
              <Text style={styles.lutLabelText}>{lut.label} — {lut.description}</Text>
            </View>
          )}

          {/* Reference film */}
          {item.referenceFilm && (
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>REFERENCE FILM</Text>
              <Text style={styles.refFilm}>{item.referenceFilm}</Text>
            </View>
          )}

          {/* Notes */}
          {item.notes ? (
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>NOTES</Text>
              <Text style={styles.notesText}>{item.notes}</Text>
            </View>
          ) : null}

          {/* Actions */}
          <View style={styles.cardActions}>
            <TouchableOpacity onPress={onEdit} style={styles.editBtn}>
              <Pencil color={Colors.accent.gold} size={15} />
              <Text style={styles.editBtnText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDelete} style={styles.deleteBtnAction}>
              <Trash2 color={Colors.status.error} size={15} />
              <Text style={styles.deleteBtnText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function ColorReferencesScreen() {
  const { activeProject, activeProjectId, deleteColorReference } = useProjects();
  const refs = useProjectColorReferences(activeProjectId);
  const router = useRouter();
  const { isTablet, contentPadding } = useLayout();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  if (!activeProject) {
    return (
      <View style={styles.empty}>
        <Stack.Screen options={{ title: 'Color & LUT Reference' }} />
        <AlertCircle color={Colors.text.tertiary} size={48} />
        <Text style={styles.emptyTitle}>No project selected</Text>
      </View>
    );
  }

  return (
    <PermissionGate resource="color_refs">
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Color & LUT Reference' }} />

      <TouchableOpacity style={styles.guideToggle} onPress={() => setShowGuide(!showGuide)}>
        <Text style={styles.guideToggleText}>{showGuide ? 'Hide' : 'Show'} LUT Style Guide</Text>
      </TouchableOpacity>

      {showGuide && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.guideScroll} contentContainerStyle={styles.guideContent}>
          {LUT_STYLES.map(lut => (
            <View key={lut.value} style={styles.guideCard}>
              <View style={styles.guideColors}>
                {lut.colors.map((c, i) => <View key={i} style={[styles.guideColorBar, { backgroundColor: c }]} />)}
              </View>
              <Text style={styles.guideName}>{lut.label}</Text>
              <Text style={styles.guideDesc}>{lut.description}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      <FlatList
        data={refs}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <ColorRefCard
            item={item}
            isExpanded={expandedId === item.id}
            onPress={() => setExpandedId(expandedId === item.id ? null : item.id)}
            onEdit={() => router.push(`/new-color-reference?id=${item.id}` as never)}
            onDelete={() => { deleteColorReference(item.id); setExpandedId(null); }}
          />
        )}
        contentContainerStyle={[styles.list, {
          paddingHorizontal: contentPadding,
          maxWidth: isTablet ? 800 : undefined,
          alignSelf: isTablet ? 'center' as const : undefined,
          width: isTablet ? '100%' : undefined,
        }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyInner}>
            <Paintbrush color={Colors.text.tertiary} size={48} />
            <Text style={styles.emptyTitle}>No color references</Text>
            <Text style={styles.emptySub}>Define the visual look per scene</Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/new-color-reference' as never)} activeOpacity={0.8}>
        <Plus color={Colors.text.inverse} size={24} />
      </TouchableOpacity>
    </View>
  </PermissionGate>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  list: { padding: 16, paddingBottom: 100 },
  guideToggle: { padding: 12, alignItems: 'center', backgroundColor: Colors.bg.secondary, borderBottomWidth: 0.5, borderBottomColor: Colors.border.subtle },
  guideToggleText: { fontSize: 13, fontWeight: '600' as const, color: Colors.accent.gold },
  guideScroll: { maxHeight: 140, backgroundColor: Colors.bg.secondary },
  guideContent: { padding: 12, gap: 10 },
  guideCard: { width: 120, backgroundColor: Colors.bg.card, borderRadius: 10, padding: 10, borderWidth: 0.5, borderColor: Colors.border.subtle },
  guideColors: { flexDirection: 'row', height: 30, borderRadius: 6, overflow: 'hidden', marginBottom: 6 },
  guideColorBar: { flex: 1 },
  guideName: { fontSize: 12, fontWeight: '700' as const, color: Colors.text.primary },
  guideDesc: { fontSize: 9, color: Colors.text.tertiary, marginTop: 2 },
  // Card
  card: { backgroundColor: Colors.bg.card, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 0.5, borderColor: Colors.border.subtle },
  cardExpanded: { borderColor: Colors.accent.gold + '44', borderWidth: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { flex: 1, marginRight: 10 },
  cardTitle: { fontSize: 15, fontWeight: '700' as const, color: Colors.text.primary },
  sceneText: { fontSize: 11, color: Colors.text.tertiary, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  miniSwatches: { flexDirection: 'row', gap: 3 },
  lutPreview: { flexDirection: 'row', width: 48, height: 16, borderRadius: 3, overflow: 'hidden' },
  lutBar: { flex: 1 },
  swatch: { borderWidth: 1, borderColor: Colors.border.subtle },
  // Expanded
  expandedBody: { marginTop: 12, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: Colors.border.subtle },
  paletteRow: { flexDirection: 'row', gap: 16, marginBottom: 12, justifyContent: 'center' },
  paletteItem: { alignItems: 'center', gap: 4 },
  paletteLabel: { fontSize: 9, color: Colors.text.tertiary, textTransform: 'uppercase' as const },
  paletteHex: { fontSize: 9, color: Colors.text.tertiary, fontVariant: ['tabular-nums'] },
  attributeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 12 },
  attrChip: { backgroundColor: Colors.bg.elevated, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  attrText: { fontSize: 10, color: Colors.text.secondary, fontWeight: '600' as const, textTransform: 'capitalize' as const },
  detailBlock: { marginBottom: 8 },
  detailLabel: { fontSize: 9, fontWeight: '700' as const, color: Colors.text.tertiary, letterSpacing: 0.8, marginBottom: 3 },
  lutLabelText: { fontSize: 12, color: Colors.text.secondary },
  refFilm: { fontSize: 12, color: Colors.accent.goldLight },
  notesText: { fontSize: 12, color: Colors.text.tertiary, fontStyle: 'italic' as const, lineHeight: 18 },
  // Actions
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 10, marginTop: 4, borderTopWidth: 0.5, borderTopColor: Colors.border.subtle },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.accent.goldBg, borderWidth: 0.5, borderColor: Colors.accent.gold + '44' },
  editBtnText: { fontSize: 12, fontWeight: '600' as const, color: Colors.accent.gold },
  deleteBtnAction: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.status.error + '12', borderWidth: 0.5, borderColor: Colors.status.error + '44' },
  deleteBtnText: { fontSize: 12, fontWeight: '600' as const, color: Colors.status.error },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.accent.gold, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.accent.gold, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  empty: { flex: 1, backgroundColor: Colors.bg.primary, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyInner: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600' as const, color: Colors.text.primary, marginTop: 16 },
  emptySub: { fontSize: 14, color: Colors.text.secondary, marginTop: 4, textAlign: 'center' },
});
