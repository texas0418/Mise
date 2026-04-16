import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Plus, Sparkles, AlertCircle, ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react-native';
import { useProjects, useProjectVFX } from '@/contexts/ProjectContext';
import { useLayout } from '@/utils/useLayout';
import Colors from '@/constants/colors';
import ImportButton from '@/components/ImportButton';
import AIImportButton from '@/components/AIImportButton';
import { VFXShot, VFXShotStatus, VFXComplexity } from '@/types';
import PermissionGate from '@/contexts/PermissionGate';

const STATUS_CONFIG: Record<VFXShotStatus, { color: string; label: string }> = {
  'pending': { color: Colors.text.tertiary, label: 'Pending' },
  'in-progress': { color: Colors.status.info, label: 'In Progress' },
  'review': { color: Colors.status.warning, label: 'Review' },
  'approved': { color: Colors.status.active, label: 'Approved' },
  'final': { color: Colors.accent.gold, label: 'Final' },
};

const COMPLEXITY_CONFIG: Record<VFXComplexity, { color: string; label: string }> = {
  'simple': { color: Colors.status.active, label: 'Simple' },
  'moderate': { color: Colors.status.info, label: 'Moderate' },
  'complex': { color: Colors.status.warning, label: 'Complex' },
  'hero': { color: Colors.status.error, label: 'Hero' },
};

const STATUS_FILTERS: { label: string; value: VFXShotStatus | null }[] = [
  { label: 'All', value: null },
  { label: 'Pending', value: 'pending' },
  { label: 'In Progress', value: 'in-progress' },
  { label: 'Review', value: 'review' },
  { label: 'Approved', value: 'approved' },
  { label: 'Final', value: 'final' },
];

function VFXCard({ item, isExpanded, onPress, onEdit, onDelete }: {
  item: VFXShot;
  isExpanded: boolean;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const status = STATUS_CONFIG[item.status];
  const complexity = COMPLEXITY_CONFIG[item.complexity];

  const handleDelete = () => {
    Alert.alert('Delete VFX Shot', `Remove Sc.${item.sceneNumber}/${item.shotNumber}?`, [
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
        <View style={styles.shotRef}>
          <Text style={styles.shotRefText}>Sc.{item.sceneNumber} / {item.shotNumber}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: status.color + '18' }]}>
          <View style={[styles.statusDot, { backgroundColor: status.color }]} />
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
        {isExpanded ? <ChevronUp color={Colors.text.tertiary} size={14} /> : <ChevronDown color={Colors.text.tertiary} size={14} />}
      </View>

      <Text style={styles.descText} numberOfLines={isExpanded ? undefined : 1}>{item.description}</Text>

      {/* Collapsed meta */}
      {!isExpanded && (
        <View style={styles.metaRow}>
          <View style={[styles.complexBadge, { backgroundColor: complexity.color + '15' }]}>
            <Text style={[styles.complexText, { color: complexity.color }]}>{complexity.label}</Text>
          </View>
          <Text style={styles.costText}>${item.estimatedCost.toLocaleString()}</Text>
        </View>
      )}

      {/* Expanded body */}
      {isExpanded && (
        <View style={styles.expandedBody}>
          <View style={styles.detailGrid}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>COMPLEXITY</Text>
              <View style={[styles.complexBadge, { backgroundColor: complexity.color + '15' }]}>
                <Text style={[styles.complexText, { color: complexity.color }]}>{complexity.label}</Text>
              </View>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>EST. COST</Text>
              <Text style={styles.costValueLarge}>${item.estimatedCost.toLocaleString()}</Text>
            </View>
            {item.vendor ? (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>VENDOR</Text>
                <Text style={styles.detailValue}>{item.vendor}</Text>
              </View>
            ) : null}
            {item.deadline ? (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>DEADLINE</Text>
                <Text style={styles.detailValue}>{item.deadline}</Text>
              </View>
            ) : null}
          </View>

          {item.notes ? (
            <View style={styles.notesBlock}>
              <Text style={styles.detailLabel}>NOTES</Text>
              <Text style={styles.notes}>{item.notes}</Text>
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

export default function VFXTrackerScreen() {
  const { activeProject, activeProjectId, deleteVFXShot } = useProjects();
  const vfxShots = useProjectVFX(activeProjectId);
  const router = useRouter();
  const { isTablet, contentPadding } = useLayout();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<VFXShotStatus | null>(null);

  const filtered = useMemo(() => {
    return filterStatus ? vfxShots.filter(v => v.status === filterStatus) : vfxShots;
  }, [vfxShots, filterStatus]);

  const stats = useMemo(() => ({
    total: vfxShots.length,
    completed: vfxShots.filter(v => v.status === 'approved' || v.status === 'final').length,
    totalCost: vfxShots.reduce((s, v) => s + v.estimatedCost, 0),
  }), [vfxShots]);

  if (!activeProject) {
    return (
      <View style={styles.emptyContainer}>
        <Stack.Screen options={{ title: 'VFX Tracker' }} />
        <AlertCircle color={Colors.text.tertiary} size={48} />
        <Text style={styles.emptyTitle}>No project selected</Text>
      </View>
    );
  }

  return (
    <PermissionGate resource="vfx">
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'VFX Tracker' }} />

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Shots</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: Colors.status.active }]}>{stats.completed}</Text>
          <Text style={styles.statLabel}>Done</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: Colors.status.warning }]}>${stats.totalCost.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Est. Cost</Text>
        </View>
      </View>

      {/* Status filter chips */}
      <View style={styles.filterRow}>
        {STATUS_FILTERS.map(f => {
          const isActive = filterStatus === f.value;
          const statusColor = f.value ? STATUS_CONFIG[f.value].color : Colors.accent.gold;
          return (
            <TouchableOpacity
              key={f.label}
              style={[styles.filterChip, isActive && { backgroundColor: statusColor + '18', borderColor: statusColor + '44' }]}
              onPress={() => setFilterStatus(isActive ? null : f.value)}
            >
              {f.value && <View style={[styles.filterDot, { backgroundColor: statusColor }]} />}
              <Text style={[styles.filterChipText, isActive && { color: statusColor }]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <VFXCard
            item={item}
            isExpanded={expandedId === item.id}
            onPress={() => setExpandedId(expandedId === item.id ? null : item.id)}
            onEdit={() => router.push(`/new-vfx?id=${item.id}` as never)}
            onDelete={() => { deleteVFXShot(item.id); setExpandedId(null); }}
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
            <Sparkles color={Colors.text.tertiary} size={48} />
            <Text style={styles.emptyTitle}>No VFX shots</Text>
            <Text style={styles.emptySubtitle}>Track visual effects work</Text>
          </View>
        }
      />

            <View style={{ position: 'absolute', top: 80, right: 24, zIndex: 10 }}><ImportButton entityKey="vfx" variant="compact" />
        <AIImportButton entityKey="vfx" variant="compact" /></View>

<TouchableOpacity style={styles.fab} onPress={() => router.push('/new-vfx' as never)} activeOpacity={0.8}>
        <Plus color={Colors.text.inverse} size={24} />
      </TouchableOpacity>
    </View>
  </PermissionGate>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  statBox: { flex: 1, backgroundColor: Colors.bg.card, borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 0.5, borderColor: Colors.border.subtle },
  statValue: { fontSize: 20, fontWeight: '700' as const, color: Colors.text.primary },
  statLabel: { fontSize: 10, color: Colors.text.tertiary, marginTop: 2, fontWeight: '600' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  // Filter
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, paddingBottom: 10 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: Colors.bg.elevated, borderWidth: 0.5, borderColor: Colors.border.subtle },
  filterDot: { width: 5, height: 5, borderRadius: 2.5 },
  filterChipText: { fontSize: 11, fontWeight: '600' as const, color: Colors.text.tertiary },
  list: { padding: 16, paddingBottom: 100 },
  // Card
  card: { backgroundColor: Colors.bg.card, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 0.5, borderColor: Colors.border.subtle },
  cardExpanded: { borderColor: Colors.accent.gold + '44', borderWidth: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  shotRef: { backgroundColor: Colors.bg.elevated, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  shotRefText: { fontSize: 12, fontWeight: '700' as const, color: Colors.text.primary, fontVariant: ['tabular-nums'] },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, gap: 4, flex: 1 },
  statusDot: { width: 5, height: 5, borderRadius: 2.5 },
  statusText: { fontSize: 10, fontWeight: '700' as const, letterSpacing: 0.5 },
  descText: { fontSize: 14, color: Colors.text.primary, marginBottom: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  complexBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  complexText: { fontSize: 10, fontWeight: '700' as const },
  costText: { fontSize: 12, fontWeight: '600' as const, color: Colors.accent.gold },
  // Expanded
  expandedBody: { marginTop: 8, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: Colors.border.subtle },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 10 },
  detailItem: { minWidth: 100 },
  detailLabel: { fontSize: 9, fontWeight: '700' as const, color: Colors.text.tertiary, letterSpacing: 0.8, marginBottom: 3 },
  detailValue: { fontSize: 13, color: Colors.text.secondary, fontWeight: '500' as const },
  costValueLarge: { fontSize: 16, fontWeight: '700' as const, color: Colors.accent.gold },
  notesBlock: { marginBottom: 8 },
  notes: { fontSize: 12, color: Colors.text.tertiary, fontStyle: 'italic' as const, lineHeight: 18 },
  // Actions
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 10, marginTop: 4, borderTopWidth: 0.5, borderTopColor: Colors.border.subtle },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.accent.goldBg, borderWidth: 0.5, borderColor: Colors.accent.gold + '44' },
  editBtnText: { fontSize: 12, fontWeight: '600' as const, color: Colors.accent.gold },
  deleteBtnAction: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.status.error + '12', borderWidth: 0.5, borderColor: Colors.status.error + '44' },
  deleteBtnText: { fontSize: 12, fontWeight: '600' as const, color: Colors.status.error },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.accent.gold, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.accent.gold, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  emptyContainer: { flex: 1, backgroundColor: Colors.bg.primary, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyInner: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600' as const, color: Colors.text.primary, marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: Colors.text.secondary, marginTop: 4, textAlign: 'center' },
});
