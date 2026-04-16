import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Plus, Trophy, AlertCircle, Calendar, DollarSign, ChevronDown, ChevronUp, Pencil, Trash2, ExternalLink } from 'lucide-react-native';
import { useProjects, useProjectFestivals } from '@/contexts/ProjectContext';
import { useLayout } from '@/utils/useLayout';
import Colors from '@/constants/colors';
import ImportButton from '@/components/ImportButton';
import AIImportButton from '@/components/AIImportButton';
import { FestivalSubmission, FestivalStatus } from '@/types';
import PermissionGate from '@/contexts/PermissionGate';

const STATUS_CONFIG: Record<FestivalStatus, { color: string; label: string }> = {
  'researching': { color: Colors.text.tertiary, label: 'Researching' },
  'submitted': { color: Colors.status.info, label: 'Submitted' },
  'accepted': { color: Colors.status.active, label: 'Accepted' },
  'rejected': { color: Colors.status.error, label: 'Rejected' },
  'screening': { color: Colors.accent.gold, label: 'Screening' },
  'awarded': { color: '#F59E0B', label: 'Awarded' },
};

function FestivalCard({ item, isExpanded, onPress, onEdit, onDelete }: {
  item: FestivalSubmission; isExpanded: boolean; onPress: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const status = STATUS_CONFIG[item.status];
  const handleDelete = () => {
    Alert.alert('Delete Festival', `Remove "${item.festivalName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);
  };

  return (
    <TouchableOpacity style={[styles.card, isExpanded && styles.cardExpanded]} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardHeader}>
        <View style={styles.headerLeft}>
          <Trophy color={status.color} size={18} />
          <View style={styles.headerText}>
            <Text style={styles.festName} numberOfLines={isExpanded ? undefined : 1}>{item.festivalName}</Text>
            <Text style={styles.festLocation}>{item.location}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: status.color + '18' }]}>
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
        {isExpanded ? <ChevronUp color={Colors.text.tertiary} size={14} /> : <ChevronDown color={Colors.text.tertiary} size={14} />}
      </View>

      {/* Collapsed: compact info */}
      {!isExpanded && (
        <View style={styles.compactRow}>
          <Text style={styles.compactText}>Due: {item.deadline || 'TBD'}</Text>
          <Text style={styles.compactText}>${item.fee}</Text>
        </View>
      )}

      {isExpanded && (
        <View style={styles.expandedBody}>
          <View style={styles.detailGrid}>
            <View style={styles.detailItem}>
              <Calendar color={Colors.text.tertiary} size={12} />
              <Text style={styles.detailLabel}>DEADLINE</Text>
              <Text style={styles.detailValue}>{item.deadline || 'TBD'}</Text>
            </View>
            <View style={styles.detailItem}>
              <DollarSign color={Colors.text.tertiary} size={12} />
              <Text style={styles.detailLabel}>FEE</Text>
              <Text style={styles.detailValue}>${item.fee}</Text>
            </View>
            {item.category ? (
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>CATEGORY</Text>
                <Text style={styles.detailValue}>{item.category}</Text>
              </View>
            ) : null}
          </View>
          {item.platformUrl ? (
            <View style={styles.urlRow}>
              <ExternalLink color={Colors.status.info} size={12} />
              <Text style={styles.urlText} numberOfLines={1}>{item.platformUrl}</Text>
            </View>
          ) : null}
          {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}

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

export default function FestivalTrackerScreen() {
  const { activeProject, activeProjectId, deleteFestival } = useProjects();
  const festivals = useProjectFestivals(activeProjectId);
  const router = useRouter();
  const { isTablet, contentPadding } = useLayout();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FestivalStatus | null>(null);

  const filtered = useMemo(() => filterStatus ? festivals.filter(f => f.status === filterStatus) : festivals, [festivals, filterStatus]);

  const stats = useMemo(() => ({
    total: festivals.length,
    submitted: festivals.filter(f => f.status === 'submitted').length,
    accepted: festivals.filter(f => f.status === 'accepted' || f.status === 'screening' || f.status === 'awarded').length,
    totalFees: festivals.reduce((s, f) => s + f.fee, 0),
  }), [festivals]);

  if (!activeProject) {
    return (<View style={styles.emptyContainer}><Stack.Screen options={{ title: 'Festivals' }} /><AlertCircle color={Colors.text.tertiary} size={48} /><Text style={styles.emptyTitle}>No project selected</Text></View>);
  }

  return (
    <PermissionGate resource="festivals">
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Festival Tracker' }} />
      <View style={styles.statsRow}>
        <View style={styles.statBox}><Text style={styles.statValue}>{stats.total}</Text><Text style={styles.statLabel}>Tracked</Text></View>
        <View style={styles.statBox}><Text style={[styles.statValue, { color: Colors.status.info }]}>{stats.submitted}</Text><Text style={styles.statLabel}>Submitted</Text></View>
        <View style={styles.statBox}><Text style={[styles.statValue, { color: Colors.status.active }]}>{stats.accepted}</Text><Text style={styles.statLabel}>Accepted</Text></View>
        <View style={styles.statBox}><Text style={[styles.statValue, { color: Colors.accent.gold }]}>${stats.totalFees}</Text><Text style={styles.statLabel}>Fees</Text></View>
      </View>

      <View style={styles.filterRow}>
        {[{ label: 'All', value: null as FestivalStatus | null }, ...Object.entries(STATUS_CONFIG).map(([v, c]) => ({ label: c.label, value: v as FestivalStatus }))].map(f => {
          const isActive = filterStatus === f.value;
          const color = f.value ? STATUS_CONFIG[f.value].color : Colors.accent.gold;
          return (
            <TouchableOpacity key={f.label} style={[styles.filterChip, isActive && { backgroundColor: color + '18', borderColor: color + '44' }]}
              onPress={() => setFilterStatus(isActive ? null : f.value)}>
              {f.value && <View style={[styles.filterDot, { backgroundColor: color }]} />}
              <Text style={[styles.filterChipText, isActive && { color }]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList data={filtered} keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <FestivalCard item={item} isExpanded={expandedId === item.id}
            onPress={() => setExpandedId(expandedId === item.id ? null : item.id)}
            onEdit={() => router.push(`/new-festival?id=${item.id}` as never)}
            onDelete={() => { deleteFestival(item.id); setExpandedId(null); }} />
        )}
        contentContainerStyle={[styles.list, { paddingHorizontal: contentPadding, maxWidth: isTablet ? 800 : undefined, alignSelf: isTablet ? 'center' as const : undefined, width: isTablet ? '100%' : undefined }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<View style={styles.emptyInner}><Trophy color={Colors.text.tertiary} size={48} /><Text style={styles.emptyTitle}>No festivals tracked</Text><Text style={styles.emptySubtitle}>Track your festival submission strategy</Text></View>}
      />
            <View style={{ position: 'absolute', top: 80, right: 24, zIndex: 10 }}><ImportButton entityKey="festivals" variant="compact" />
        <AIImportButton entityKey="festivals" variant="compact" /></View>

<TouchableOpacity style={styles.fab} onPress={() => router.push('/new-festival' as never)} activeOpacity={0.8}><Plus color={Colors.text.inverse} size={24} /></TouchableOpacity>
    </View>
  </PermissionGate>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  statBox: { flex: 1, backgroundColor: Colors.bg.card, borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 0.5, borderColor: Colors.border.subtle },
  statValue: { fontSize: 18, fontWeight: '700' as const, color: Colors.text.primary },
  statLabel: { fontSize: 9, color: Colors.text.tertiary, marginTop: 2, fontWeight: '600' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, paddingBottom: 10 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: Colors.bg.elevated, borderWidth: 0.5, borderColor: Colors.border.subtle },
  filterDot: { width: 5, height: 5, borderRadius: 2.5 },
  filterChipText: { fontSize: 11, fontWeight: '600' as const, color: Colors.text.tertiary },
  list: { padding: 16, paddingBottom: 100 },
  card: { backgroundColor: Colors.bg.card, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 0.5, borderColor: Colors.border.subtle },
  cardExpanded: { borderColor: Colors.accent.gold + '44', borderWidth: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  headerText: { flex: 1 },
  festName: { fontSize: 15, fontWeight: '600' as const, color: Colors.text.primary },
  festLocation: { fontSize: 12, color: Colors.text.secondary, marginTop: 1 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 10, fontWeight: '700' as const, letterSpacing: 0.5 },
  compactRow: { flexDirection: 'row', gap: 16, marginTop: 6, paddingLeft: 28 },
  compactText: { fontSize: 11, color: Colors.text.tertiary },
  expandedBody: { marginTop: 12, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: Colors.border.subtle },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginBottom: 10 },
  detailItem: { minWidth: 80, gap: 2 },
  detailLabel: { fontSize: 9, fontWeight: '700' as const, color: Colors.text.tertiary, letterSpacing: 0.8 },
  detailValue: { fontSize: 13, color: Colors.text.secondary, fontWeight: '500' as const },
  urlRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  urlText: { fontSize: 11, color: Colors.status.info },
  notes: { fontSize: 11, color: Colors.text.tertiary, fontStyle: 'italic' as const, marginBottom: 4 },
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
