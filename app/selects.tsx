import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, SectionList, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, Star, Circle, CircleDot, Trash2, Clock, MessageSquare, Camera, AlertTriangle, ChevronDown, ChevronUp, Pencil } from 'lucide-react-native';
import { useProjects, useProjectSelects } from '@/contexts/ProjectContext';
import { useLayout } from '@/utils/useLayout';
import Colors from '@/constants/colors';
import { SceneSelect } from '@/types';
import PermissionGate from '@/contexts/PermissionGate';

function StarRating({ rating, size = 12 }: { rating: number; size?: number }) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} color={i <= rating ? Colors.accent.gold : Colors.bg.tertiary}
          fill={i <= rating ? Colors.accent.gold : 'transparent'} size={size} />
      ))}
    </View>
  );
}

function SelectCard({ select, onEdit, onDelete }: {
  select: SceneSelect; onEdit: () => void; onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const handleDelete = () => {
    Alert.alert('Remove Select', `Remove Sc.${select.sceneNumber} / ${select.shotNumber} Tk.${select.takeNumber}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: onDelete },
    ]);
  };

  return (
    <TouchableOpacity
      style={[styles.selectCard, select.isCircled && styles.circledCard]}
      onPress={() => setExpanded(!expanded)}
      activeOpacity={0.7}
    >
      <View style={styles.cardTop}>
        {/* Circle indicator */}
        <View style={styles.circleCol}>
          {select.isCircled ? (
            <CircleDot color={Colors.accent.gold} size={22} />
          ) : select.isAlt ? (
            <Circle color="#60A5FA" size={22} />
          ) : (
            <Circle color={Colors.text.tertiary} size={22} />
          )}
        </View>

        {/* Main info */}
        <View style={styles.cardInfo}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.shotLabel}>
              {select.shotNumber} — Take {select.takeNumber}
            </Text>
            {select.isCircled && <Text style={styles.circledBadge}>CIRCLE</Text>}
            {select.isAlt && !select.isCircled && <Text style={styles.altBadge}>ALT</Text>}
          </View>
          <StarRating rating={select.rating} />
          {select.timecode && (
            <View style={styles.timecodeRow}>
              <Clock color={Colors.text.tertiary} size={10} />
              <Text style={styles.timecodeText}>{select.timecode}</Text>
            </View>
          )}
          <Text style={styles.editorNote} numberOfLines={expanded ? undefined : 2}>{select.editorNote}</Text>
        </View>

        {/* Chevron */}
        <View style={styles.chevronCol}>
          {expanded ? <ChevronUp color={Colors.text.tertiary} size={14} /> : <ChevronDown color={Colors.text.tertiary} size={14} />}
        </View>
      </View>

      {/* Expanded notes + actions */}
      {expanded && (
        <View style={styles.expandedNotes}>
          {select.performanceNote ? (
            <View style={styles.noteBlock}>
              <View style={styles.noteLabelRow}>
                <Camera color="#F472B6" size={11} />
                <Text style={[styles.noteLabel, { color: '#F472B6' }]}>PERFORMANCE</Text>
              </View>
              <Text style={styles.noteText}>{select.performanceNote}</Text>
            </View>
          ) : null}
          {select.technicalNote ? (
            <View style={styles.noteBlock}>
              <View style={styles.noteLabelRow}>
                <AlertTriangle color="#FBBF24" size={11} />
                <Text style={[styles.noteLabel, { color: '#FBBF24' }]}>TECHNICAL</Text>
              </View>
              <Text style={styles.noteText}>{select.technicalNote}</Text>
            </View>
          ) : null}

          {/* Edit / Delete actions */}
          <View style={styles.actionRow}>
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

export default function SelectsScreen() {
  const { activeProjectId, deleteSceneSelect } = useProjects();
  const selects = useProjectSelects(activeProjectId);
  const router = useRouter();
  const { isTablet, contentPadding } = useLayout();
  const [filter, setFilter] = useState<'all' | 'circled' | 'alt'>('all');

  const filtered = useMemo(() => {
    if (filter === 'circled') return selects.filter(s => s.isCircled);
    if (filter === 'alt') return selects.filter(s => s.isAlt);
    return selects;
  }, [selects, filter]);

  const sections = useMemo(() => {
    const sceneMap = new Map<number, SceneSelect[]>();
    filtered.forEach(s => {
      const list = sceneMap.get(s.sceneNumber) || [];
      list.push(s);
      sceneMap.set(s.sceneNumber, list);
    });
    return Array.from(sceneMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([sceneNumber, data]) => ({ sceneNumber, data }));
  }, [filtered]);

  const circledCount = selects.filter(s => s.isCircled).length;
  const altCount = selects.filter(s => s.isAlt).length;
  const avgRating = selects.length > 0
    ? (selects.reduce((sum, s) => sum + s.rating, 0) / selects.length).toFixed(1)
    : '—';
  const scenesWithSelects = new Set(selects.map(s => s.sceneNumber)).size;

  return (
    <PermissionGate resource="selects">
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <SelectCard
            select={item}
            onEdit={() => router.push(`/new-select?id=${item.id}` as never)}
            onDelete={() => deleteSceneSelect(item.id)}
          />
        )}
        renderSectionHeader={({ section }) => {
          const s = section as typeof sections[0];
          const scCircled = s.data.filter(d => d.isCircled).length;
          return (
            <View style={styles.sceneHeader}>
              <Text style={styles.sceneTitle}>Scene {s.sceneNumber}</Text>
              <Text style={styles.sceneCount}>
                {s.data.length} select{s.data.length !== 1 ? 's' : ''} · {scCircled} circled
              </Text>
            </View>
          );
        }}
        contentContainerStyle={[styles.list, {
          paddingHorizontal: contentPadding,
          maxWidth: isTablet ? 800 : undefined,
          alignSelf: isTablet ? 'center' as const : undefined,
          width: isTablet ? '100%' : undefined,
        }]}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <View>
            <View style={styles.statsBar}>
              <View style={styles.statItem}><Text style={styles.statValue}>{selects.length}</Text><Text style={styles.statLabel}>Selects</Text></View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}><Text style={[styles.statValue, { color: Colors.accent.gold }]}>{circledCount}</Text><Text style={styles.statLabel}>Circled</Text></View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}><Text style={[styles.statValue, { color: '#60A5FA' }]}>{altCount}</Text><Text style={styles.statLabel}>Alts</Text></View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}><Text style={styles.statValue}>{avgRating}</Text><Text style={styles.statLabel}>Avg Rating</Text></View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}><Text style={styles.statValue}>{scenesWithSelects}</Text><Text style={styles.statLabel}>Scenes</Text></View>
            </View>
            <View style={styles.filterRow}>
              {([
                { key: 'all', label: 'All' },
                { key: 'circled', label: 'Circled' },
                { key: 'alt', label: 'Alternates' },
              ] as const).map(f => (
                <TouchableOpacity key={f.key} style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
                  onPress={() => setFilter(f.key)}>
                  <Text style={[styles.filterChipText, filter === f.key && styles.filterChipTextActive]}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Star color={Colors.text.tertiary} size={48} />
            <Text style={styles.emptyTitle}>No selects yet</Text>
            <Text style={styles.emptySubtitle}>Mark your best takes for the editor</Text>
          </View>
        }
      />
      <TouchableOpacity style={styles.fab} onPress={() => router.push('/new-select' as never)} activeOpacity={0.8}>
        <Plus color={Colors.text.inverse} size={24} />
      </TouchableOpacity>
    </View>
  </PermissionGate>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  list: { padding: 16, paddingBottom: 100 },
  statsBar: { flexDirection: 'row', backgroundColor: Colors.bg.card, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 0.5, borderColor: Colors.border.subtle, justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '700' as const, color: Colors.text.primary },
  statLabel: { fontSize: 10, color: Colors.text.tertiary, marginTop: 2, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  statDivider: { width: 1, backgroundColor: Colors.border.subtle },
  filterRow: { flexDirection: 'row', marginBottom: 16, gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.bg.card, borderWidth: 0.5, borderColor: Colors.border.subtle },
  filterChipActive: { backgroundColor: Colors.accent.goldBg, borderColor: Colors.accent.gold + '44' },
  filterChipText: { fontSize: 12, fontWeight: '600' as const, color: Colors.text.secondary },
  filterChipTextActive: { color: Colors.accent.gold },
  sceneHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, paddingVertical: 8, marginTop: 8 },
  sceneTitle: { fontSize: 15, fontWeight: '700' as const, color: Colors.text.primary },
  sceneCount: { fontSize: 11, color: Colors.text.tertiary },
  selectCard: { backgroundColor: Colors.bg.card, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 0.5, borderColor: Colors.border.subtle },
  circledCard: { borderColor: Colors.accent.gold + '44', borderWidth: 1 },
  cardTop: { flexDirection: 'row', gap: 10 },
  circleCol: { paddingTop: 2 },
  cardInfo: { flex: 1 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  shotLabel: { fontSize: 15, fontWeight: '700' as const, color: Colors.text.primary },
  circledBadge: { fontSize: 9, fontWeight: '700' as const, color: Colors.accent.gold, backgroundColor: Colors.accent.goldBg, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, letterSpacing: 0.5 },
  altBadge: { fontSize: 9, fontWeight: '700' as const, color: '#60A5FA', backgroundColor: '#60A5FA18', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, letterSpacing: 0.5 },
  starRow: { flexDirection: 'row', gap: 2, marginBottom: 4 },
  timecodeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  timecodeText: { fontSize: 11, color: Colors.text.tertiary, fontFamily: 'monospace' },
  editorNote: { fontSize: 13, color: Colors.text.secondary, lineHeight: 19 },
  chevronCol: { alignItems: 'center', paddingTop: 2 },
  expandedNotes: { marginTop: 12, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: Colors.border.subtle },
  noteBlock: { marginBottom: 10 },
  noteLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  noteLabel: { fontSize: 10, fontWeight: '700' as const, letterSpacing: 0.8 },
  noteText: { fontSize: 12, color: Colors.text.secondary, lineHeight: 18 },
  // Actions
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 10, marginTop: 4, borderTopWidth: 0.5, borderTopColor: Colors.border.subtle },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.accent.goldBg, borderWidth: 0.5, borderColor: Colors.accent.gold + '44' },
  editBtnText: { fontSize: 12, fontWeight: '600' as const, color: Colors.accent.gold },
  deleteBtnAction: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.status.error + '12', borderWidth: 0.5, borderColor: Colors.status.error + '44' },
  deleteBtnText: { fontSize: 12, fontWeight: '600' as const, color: Colors.status.error },
  emptyContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600' as const, color: Colors.text.primary, marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: Colors.text.secondary, marginTop: 4 },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.accent.gold, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.accent.gold, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
});
