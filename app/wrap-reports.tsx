import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Plus, FileText, AlertCircle, ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react-native';
import { useProjects, useProjectWrapReports } from '@/contexts/ProjectContext';
import { useLayout } from '@/utils/useLayout';
import Colors from '@/constants/colors';
import ImportButton from '@/components/ImportButton';
import AIImportButton from '@/components/AIImportButton';
import { WrapReport } from '@/types';
import PermissionGate from '@/contexts/PermissionGate';

function StatBadge({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <View style={styles.statBadge}>
      <Text style={[styles.statBadgeValue, color ? { color } : {}]}>{value}</Text>
      <Text style={styles.statBadgeLabel}>{label}</Text>
    </View>
  );
}

function WrapCard({ item, isExpanded, onPress, onEdit, onDelete }: {
  item: WrapReport; isExpanded: boolean; onPress: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const otHours = item.overtimeMinutes > 0 ? `${(item.overtimeMinutes / 60).toFixed(1)}h OT` : 'No OT';
  const dateStr = new Date(item.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const handleDelete = () => {
    Alert.alert('Delete Wrap Report', `Remove Day ${item.dayNumber} report?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);
  };

  return (
    <TouchableOpacity style={[styles.card, isExpanded && styles.cardExpanded]} onPress={onPress} activeOpacity={0.7}>
      {/* Header — always visible */}
      <View style={styles.cardHeader}>
        <View style={styles.dayBadge}><Text style={styles.dayText}>DAY {item.dayNumber}</Text></View>
        <Text style={styles.dateText}>{dateStr}</Text>
        <Text style={styles.compactTimes}>{item.callTime} – {item.actualWrap}</Text>
        {isExpanded ? <ChevronUp color={Colors.text.tertiary} size={14} /> : <ChevronDown color={Colors.text.tertiary} size={14} />}
      </View>

      {/* Collapsed compact */}
      {!isExpanded && (
        <View style={styles.compactRow}>
          <Text style={styles.compactText}>{item.shotsCompleted}/{item.shotsPlanned} shots</Text>
          <Text style={[styles.compactText, item.overtimeMinutes > 0 && { color: Colors.status.warning }]}>{otHours}</Text>
        </View>
      )}

      {/* Expanded */}
      {isExpanded && (
        <View style={styles.expandedBody}>
          <View style={styles.timeRow}>
            <Text style={styles.timeLabel}>Call: <Text style={styles.timeValue}>{item.callTime}</Text></Text>
            <Text style={styles.timeLabel}>Wrap: <Text style={styles.timeValue}>{item.actualWrap}</Text></Text>
            <Text style={[styles.timeLabel, item.overtimeMinutes > 0 && { color: Colors.status.warning }]}>{otHours}</Text>
          </View>

          <View style={styles.statsRow}>
            <StatBadge label="Shots" value={`${item.shotsCompleted}/${item.shotsPlanned}`} />
            <StatBadge label="Takes" value={item.totalTakes} />
            <StatBadge label="Circled" value={item.circledTakes} color={Colors.status.active} />
            <StatBadge label="NG" value={item.ngTakes} color={Colors.status.error} />
          </View>

          <View style={styles.scenesRow}>
            <Text style={styles.scenesLabel}>Scheduled:</Text>
            <Text style={styles.scenesText}>{item.scenesScheduled}</Text>
          </View>
          <View style={styles.scenesRow}>
            <Text style={styles.scenesLabel}>Completed:</Text>
            <Text style={[styles.scenesText, { color: Colors.status.active }]}>{item.scenesCompleted}</Text>
          </View>

          {item.weatherConditions ? <Text style={styles.weatherText}>🌤 {item.weatherConditions}</Text> : null}
          {item.notes ? <Text style={styles.notesText}>{item.notes}</Text> : null}

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

export default function WrapReportsScreen() {
  const { activeProject, activeProjectId, deleteWrapReport } = useProjects();
  const reports = useProjectWrapReports(activeProjectId);
  const router = useRouter();
  const { isTablet, contentPadding } = useLayout();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const totals = useMemo(() => ({
    days: reports.length,
    totalShots: reports.reduce((s, r) => s + r.shotsCompleted, 0),
    totalTakes: reports.reduce((s, r) => s + r.totalTakes, 0),
    totalOT: reports.reduce((s, r) => s + r.overtimeMinutes, 0),
  }), [reports]);

  if (!activeProject) {
    return <View style={styles.empty}><Stack.Screen options={{ title: 'Wrap Reports' }} /><AlertCircle color={Colors.text.tertiary} size={48} /><Text style={styles.emptyTitle}>No project selected</Text></View>;
  }

  return (
    <PermissionGate resource="wrap_reports">
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Wrap Reports' }} />
      {reports.length > 0 && (
        <View style={styles.summaryBar}>
          <StatBadge label="Days" value={totals.days} />
          <StatBadge label="Shots" value={totals.totalShots} />
          <StatBadge label="Takes" value={totals.totalTakes} />
          <StatBadge label="OT" value={totals.totalOT > 0 ? `${(totals.totalOT / 60).toFixed(1)}h` : '0'} color={totals.totalOT > 0 ? Colors.status.warning : undefined} />
        </View>
      )}

      <FlatList data={reports} keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <WrapCard item={item} isExpanded={expandedId === item.id}
            onPress={() => setExpandedId(expandedId === item.id ? null : item.id)}
            onEdit={() => router.push(`/new-wrap-report?id=${item.id}` as never)}
            onDelete={() => { deleteWrapReport(item.id); setExpandedId(null); }} />
        )}
        contentContainerStyle={[styles.list, { paddingHorizontal: contentPadding, maxWidth: isTablet ? 800 : undefined, alignSelf: isTablet ? 'center' as const : undefined, width: isTablet ? '100%' : undefined }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<View style={styles.emptyInner}><FileText color={Colors.text.tertiary} size={48} /><Text style={styles.emptyTitle}>No wrap reports yet</Text><Text style={styles.emptySub}>Generate a report after each shoot day</Text></View>}
      />
            <View style={{ position: 'absolute', top: 80, right: 24, zIndex: 10 }}><ImportButton entityKey="wrapReports" variant="compact" />
        <AIImportButton entityKey="wrapReports" variant="compact" /></View>

<TouchableOpacity style={styles.fab} onPress={() => router.push('/new-wrap-report' as never)} activeOpacity={0.8}><Plus color={Colors.text.inverse} size={24} /></TouchableOpacity>
    </View>
  </PermissionGate>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  list: { padding: 16, paddingBottom: 100 },
  summaryBar: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: Colors.bg.secondary, borderBottomWidth: 0.5, borderBottomColor: Colors.border.subtle },
  card: { backgroundColor: Colors.bg.card, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 0.5, borderColor: Colors.border.subtle },
  cardExpanded: { borderColor: Colors.accent.gold + '44', borderWidth: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dayBadge: { backgroundColor: Colors.accent.goldBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  dayText: { fontSize: 11, fontWeight: '800' as const, color: Colors.accent.gold, letterSpacing: 1 },
  dateText: { fontSize: 13, color: Colors.text.secondary, fontWeight: '500' as const },
  compactTimes: { flex: 1, fontSize: 11, color: Colors.text.tertiary, textAlign: 'right' },
  compactRow: { flexDirection: 'row', gap: 16, marginTop: 6, paddingLeft: 4 },
  compactText: { fontSize: 12, color: Colors.text.secondary },
  expandedBody: { marginTop: 12, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: Colors.border.subtle },
  timeRow: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  timeLabel: { fontSize: 12, color: Colors.text.tertiary },
  timeValue: { color: Colors.text.primary, fontWeight: '600' as const },
  statsRow: { flexDirection: 'row', marginBottom: 12 },
  statBadge: { flex: 1, alignItems: 'center' },
  statBadgeValue: { fontSize: 18, fontWeight: '700' as const, color: Colors.text.primary },
  statBadgeLabel: { fontSize: 9, color: Colors.text.tertiary, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginTop: 2 },
  scenesRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  scenesLabel: { fontSize: 12, color: Colors.text.tertiary, width: 80 },
  scenesText: { fontSize: 12, color: Colors.text.primary, fontWeight: '500' as const, flex: 1 },
  weatherText: { fontSize: 11, color: Colors.text.secondary, marginTop: 8 },
  notesText: { fontSize: 12, color: Colors.text.secondary, marginTop: 8, lineHeight: 18 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 10, marginTop: 8, borderTopWidth: 0.5, borderTopColor: Colors.border.subtle },
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
