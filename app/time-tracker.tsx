import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Plus, Clock, AlertCircle, AlertTriangle, ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react-native';
import { useProjects, useProjectTimeEntries } from '@/contexts/ProjectContext';
import { useLayout } from '@/utils/useLayout';
import Colors from '@/constants/colors';
import ImportButton from '@/components/ImportButton';
import AIImportButton from '@/components/AIImportButton';
import { TimeEntry } from '@/types';
import PermissionGate from '@/contexts/PermissionGate';

const DEPT_COLORS: Record<string, string> = {
  direction: Colors.department.direction,
  camera: Colors.department.camera,
  sound: Colors.department.sound,
  art: Colors.department.art,
  lighting: Colors.department.lighting,
  production: Colors.department.production,
  talent: Colors.department.talent,
  postProduction: Colors.department.postProduction,
};

function TimeCard({ item, isExpanded, onPress, onEdit, onDelete }: {
  item: TimeEntry;
  isExpanded: boolean;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const deptColor = item.department ? DEPT_COLORS[item.department] ?? Colors.text.tertiary : Colors.text.tertiary;
  const hasOT = item.overtimeHours > 0;
  const dateStr = new Date(item.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const handleDelete = () => {
    Alert.alert('Delete Entry', `Remove time entry for ${dateStr}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);
  };

  return (
    <TouchableOpacity
      style={[styles.card, hasOT && styles.cardOT, isExpanded && styles.cardExpanded]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Header — always visible */}
      <View style={styles.cardHeader}>
        <View style={[styles.deptBadge, { backgroundColor: deptColor + '20' }]}>
          <Text style={[styles.deptText, { color: deptColor }]}>{(item.department ?? 'general').toUpperCase()}</Text>
        </View>
        <Text style={styles.dateText}>{dateStr}</Text>
        <Text style={styles.compactTimes}>{item.callTime} – {item.wrapTime}</Text>
        {hasOT && <AlertTriangle color={Colors.status.warning} size={12} />}
        {isExpanded ? <ChevronUp color={Colors.text.tertiary} size={14} /> : <ChevronDown color={Colors.text.tertiary} size={14} />}
      </View>

      {/* Collapsed: compact hours row */}
      {!isExpanded && (
        <View style={styles.compactHours}>
          <Text style={styles.compactHourText}>{item.actualHours}h actual</Text>
          {hasOT && <Text style={[styles.compactHourText, { color: Colors.status.warning }]}>+{item.overtimeHours}h OT</Text>}
        </View>
      )}

      {/* Expanded body */}
      {isExpanded && (
        <View style={styles.expandedBody}>
          <View style={styles.timeRow}>
            <View style={styles.timeBlock}>
              <Text style={styles.timeLabel}>CALL</Text>
              <Text style={styles.timeValue}>{item.callTime}</Text>
            </View>
            <View style={styles.timeBlock}>
              <Text style={styles.timeLabel}>WRAP</Text>
              <Text style={styles.timeValue}>{item.wrapTime}</Text>
            </View>
            {item.lunchStart && (
              <View style={styles.timeBlock}>
                <Text style={styles.timeLabel}>LUNCH</Text>
                <Text style={styles.timeValue}>{item.lunchStart}–{item.lunchEnd}</Text>
              </View>
            )}
          </View>

          <View style={styles.hoursRow}>
            <View style={styles.hourItem}>
              <Text style={styles.hourValue}>{item.scheduledHours}h</Text>
              <Text style={styles.hourLabel}>Scheduled</Text>
            </View>
            <View style={styles.hourItem}>
              <Text style={styles.hourValue}>{item.actualHours}h</Text>
              <Text style={styles.hourLabel}>Actual</Text>
            </View>
            <View style={styles.hourItem}>
              <Text style={[styles.hourValue, hasOT ? { color: Colors.status.warning } : {}]}>{item.overtimeHours}h</Text>
              <Text style={styles.hourLabel}>Overtime</Text>
              {hasOT && <AlertTriangle color={Colors.status.warning} size={10} style={{ marginTop: 2 }} />}
            </View>
          </View>

          {item.notes ? <Text style={styles.notesText}>{item.notes}</Text> : null}

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

export default function TimeTrackerScreen() {
  const { activeProject, activeProjectId, deleteTimeEntry } = useProjects();
  const entries = useProjectTimeEntries(activeProjectId);
  const router = useRouter();
  const { isTablet, contentPadding } = useLayout();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const summary = useMemo(() => {
    const totalScheduled = entries.reduce((s, e) => s + e.scheduledHours, 0);
    const totalActual = entries.reduce((s, e) => s + e.actualHours, 0);
    const totalOT = entries.reduce((s, e) => s + e.overtimeHours, 0);
    return { totalScheduled, totalActual, totalOT, entries: entries.length };
  }, [entries]);

  if (!activeProject) {
    return <View style={styles.empty}><Stack.Screen options={{ title: 'Time Tracker' }} /><AlertCircle color={Colors.text.tertiary} size={48} /><Text style={styles.emptyTitle}>No project selected</Text></View>;
  }

  return (
    <PermissionGate resource="time_entries">
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Time Tracker' }} />

      {entries.length > 0 && (
        <View style={styles.summaryBar}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{summary.totalScheduled}h</Text>
            <Text style={styles.summaryLabel}>Scheduled</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{summary.totalActual}h</Text>
            <Text style={styles.summaryLabel}>Actual</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, summary.totalOT > 0 ? { color: Colors.status.warning } : {}]}>{summary.totalOT}h</Text>
            <Text style={styles.summaryLabel}>Overtime</Text>
          </View>
        </View>
      )}

      <FlatList
        data={entries}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TimeCard
            item={item}
            isExpanded={expandedId === item.id}
            onPress={() => setExpandedId(expandedId === item.id ? null : item.id)}
            onEdit={() => router.push(`/new-time-entry?id=${item.id}` as never)}
            onDelete={() => { deleteTimeEntry(item.id); setExpandedId(null); }}
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
            <Clock color={Colors.text.tertiary} size={48} />
            <Text style={styles.emptyTitle}>No time entries</Text>
            <Text style={styles.emptySub}>Track hours and overtime per department</Text>
          </View>
        }
      />

            <View style={{ position: 'absolute', top: 80, right: 24, zIndex: 10 }}><ImportButton entityKey="timeEntries" variant="compact" />
        <AIImportButton entityKey="timeEntries" variant="compact" /></View>

<TouchableOpacity style={styles.fab} onPress={() => router.push('/new-time-entry' as never)} activeOpacity={0.8}>
        <Plus color={Colors.text.inverse} size={24} />
      </TouchableOpacity>
    </View>
  </PermissionGate>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  list: { padding: 16, paddingBottom: 100 },
  summaryBar: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: Colors.bg.secondary, borderBottomWidth: 0.5, borderBottomColor: Colors.border.subtle },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: 20, fontWeight: '700' as const, color: Colors.text.primary },
  summaryLabel: { fontSize: 9, color: Colors.text.tertiary, textTransform: 'uppercase' as const, letterSpacing: 0.5, marginTop: 2 },
  // Card
  card: { backgroundColor: Colors.bg.card, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 0.5, borderColor: Colors.border.subtle },
  cardOT: { borderColor: Colors.status.warning + '40' },
  cardExpanded: { borderColor: Colors.accent.gold + '44', borderWidth: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deptBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  deptText: { fontSize: 9, fontWeight: '800' as const, letterSpacing: 0.8 },
  dateText: { fontSize: 12, fontWeight: '600' as const, color: Colors.text.primary },
  compactTimes: { flex: 1, fontSize: 11, color: Colors.text.tertiary, textAlign: 'right' },
  compactHours: { flexDirection: 'row', gap: 10, marginTop: 6 },
  compactHourText: { fontSize: 12, color: Colors.text.secondary, fontWeight: '500' as const },
  // Expanded
  expandedBody: { marginTop: 12, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: Colors.border.subtle },
  timeRow: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  timeBlock: {},
  timeLabel: { fontSize: 10, color: Colors.text.tertiary, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  timeValue: { fontSize: 14, fontWeight: '600' as const, color: Colors.text.primary, marginTop: 2 },
  hoursRow: { flexDirection: 'row', marginBottom: 8 },
  hourItem: { flex: 1, alignItems: 'center' },
  hourValue: { fontSize: 16, fontWeight: '700' as const, color: Colors.text.primary },
  hourLabel: { fontSize: 9, color: Colors.text.tertiary, textTransform: 'uppercase' as const, marginTop: 2 },
  notesText: { fontSize: 11, color: Colors.text.tertiary, fontStyle: 'italic' as const, marginTop: 8, marginBottom: 4 },
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
