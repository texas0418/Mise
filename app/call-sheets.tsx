import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ClipboardList, MapPin, Clock, Users, AlertCircle, Plus, ChevronDown, ChevronUp, Pencil, Trash2, Calendar } from 'lucide-react-native';
import { useProjects, useProjectSchedule } from '@/contexts/ProjectContext';
import { useLayout } from '@/utils/useLayout';
import Colors from '@/constants/colors';
import { ScheduleDay } from '@/types';
import PermissionGate from '@/contexts/PermissionGate';

function CallSheetCard({ day, crew, projectTitle, isExpanded, onPress, onEdit, onDelete }: {
  day: ScheduleDay;
  crew: { id: string; name: string; role: string; department: string }[];
  projectTitle: string;
  isExpanded: boolean;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const dateObj = new Date(day.date + 'T00:00:00');
  const dateStr = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const dateFull = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const handleDelete = () => {
    Alert.alert('Delete Call Sheet', `Remove Day ${day.dayNumber} call sheet?\n\nThis will also delete the schedule day.`, [
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
      {/* Collapsed header */}
      <View style={styles.cardHeader}>
        <View style={styles.dayBadge}>
          <Text style={styles.dayBadgeText}>{day.dayNumber}</Text>
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.headerDate}>{dateStr}</Text>
          <View style={styles.headerMeta}>
            <Clock color={Colors.text.tertiary} size={10} />
            <Text style={styles.headerMetaText}>{day.callTime} — {day.wrapTime}</Text>
            <MapPin color={Colors.text.tertiary} size={10} />
            <Text style={styles.headerMetaText} numberOfLines={1}>{day.location}</Text>
          </View>
        </View>
        {isExpanded ? <ChevronUp color={Colors.text.tertiary} size={18} /> : <ChevronDown color={Colors.text.tertiary} size={18} />}
      </View>

      {/* Expanded: full call sheet */}
      {isExpanded && (
        <View style={styles.sheetBody}>
          {/* Title block */}
          <View style={styles.sheetTitleBlock}>
            <Text style={styles.sheetTitle}>{projectTitle.toUpperCase()}</Text>
            <Text style={styles.sheetSubtitle}>CALL SHEET — DAY {day.dayNumber}</Text>
            <Text style={styles.sheetDateFull}>{dateFull}</Text>
          </View>

          {/* Call / Wrap */}
          <View style={styles.timeGrid}>
            <View style={styles.timeCell}>
              <Text style={styles.timeLabel}>GENERAL CALL</Text>
              <Text style={styles.timeValue}>{day.callTime}</Text>
            </View>
            <View style={styles.timeDivider} />
            <View style={styles.timeCell}>
              <Text style={styles.timeLabel}>EST. WRAP</Text>
              <Text style={styles.timeValue}>{day.wrapTime}</Text>
            </View>
          </View>

          {/* Location */}
          <View style={styles.detailSection}>
            <View style={styles.detailRow}>
              <MapPin color={Colors.accent.gold} size={14} />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>LOCATION</Text>
                <Text style={styles.detailValue}>{day.location}</Text>
              </View>
            </View>
          </View>

          {/* Scenes */}
          <View style={styles.detailSection}>
            <Text style={styles.detailLabel}>SCENES</Text>
            <Text style={styles.scenesText}>{day.scenes}</Text>
          </View>

          {/* Notes / Special Instructions */}
          {day.notes ? (
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>SPECIAL INSTRUCTIONS / NOTES</Text>
              <Text style={styles.notesText}>{day.notes}</Text>
            </View>
          ) : null}

          {/* Crew */}
          <View style={styles.crewSection}>
            <View style={styles.crewHeader}>
              <Users color={Colors.accent.gold} size={14} />
              <Text style={styles.crewTitle}>CREW ({crew.length})</Text>
            </View>
            <View style={styles.crewTableHeader}>
              <Text style={[styles.crewColHeader, { flex: 2 }]}>NAME</Text>
              <Text style={[styles.crewColHeader, { flex: 2 }]}>ROLE</Text>
              <Text style={[styles.crewColHeader, { flex: 1, textAlign: 'right' }]}>CALL</Text>
            </View>
            {crew.map(member => (
              <View key={member.id} style={styles.crewRow}>
                <Text style={[styles.crewName, { flex: 2 }]}>{member.name}</Text>
                <Text style={[styles.crewRole, { flex: 2 }]}>{member.role}</Text>
                <Text style={[styles.crewCall, { flex: 1, textAlign: 'right' }]}>{day.callTime}</Text>
              </View>
            ))}
          </View>

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

export default function CallSheetsScreen() {
  const { activeProject, activeProjectId, crew, deleteScheduleDay } = useProjects();
  const schedule = useProjectSchedule(activeProjectId);
  const router = useRouter();
  const { isTablet, contentPadding } = useLayout();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!activeProject) {
    return (
      <View style={styles.emptyContainer}>
        <Stack.Screen options={{ title: 'Call Sheets' }} />
        <AlertCircle color={Colors.text.tertiary} size={48} />
        <Text style={styles.emptyTitle}>No project selected</Text>
      </View>
    );
  }

  return (
    <PermissionGate resource="call_sheets">
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Call Sheets' }} />

      <View style={styles.statsBar}>
        <ClipboardList color={Colors.accent.gold} size={16} />
        <Text style={styles.statsText}>{schedule.length} call sheet{schedule.length !== 1 ? 's' : ''}</Text>
        <Text style={styles.statsDetail}>{crew.length} crew</Text>
      </View>

      <FlatList
        data={schedule}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <CallSheetCard
            day={item}
            crew={crew}
            projectTitle={activeProject.title}
            isExpanded={expandedId === item.id}
            onPress={() => setExpandedId(expandedId === item.id ? null : item.id)}
            onEdit={() => router.push(`/new-schedule-day?id=${item.id}` as never)}
            onDelete={() => deleteScheduleDay(item.id)}
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
            <ClipboardList color={Colors.text.tertiary} size={48} />
            <Text style={styles.emptyTitle}>No call sheets</Text>
            <Text style={styles.emptySubtitle}>Add a shoot day to generate a call sheet</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/new-schedule-day' as never)}
        activeOpacity={0.8}
      >
        <Plus color={Colors.text.inverse} size={24} />
      </TouchableOpacity>
    </View>
  </PermissionGate>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  statsBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: Colors.bg.secondary, borderBottomWidth: 0.5, borderBottomColor: Colors.border.subtle, gap: 8 },
  statsText: { flex: 1, fontSize: 14, fontWeight: '600' as const, color: Colors.text.primary },
  statsDetail: { fontSize: 12, color: Colors.text.tertiary },
  list: { padding: 16, paddingBottom: 100 },
  // Card
  card: { backgroundColor: Colors.bg.card, borderRadius: 14, marginBottom: 12, borderWidth: 0.5, borderColor: Colors.border.subtle, overflow: 'hidden' },
  cardExpanded: { borderColor: Colors.accent.gold + '44', borderWidth: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  dayBadge: { width: 44, height: 44, borderRadius: 10, backgroundColor: Colors.accent.goldBg, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.accent.gold + '33' },
  dayBadgeText: { fontSize: 18, fontWeight: '800' as const, color: Colors.accent.gold },
  headerCenter: { flex: 1 },
  headerDate: { fontSize: 15, fontWeight: '600' as const, color: Colors.text.primary },
  headerMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  headerMetaText: { fontSize: 11, color: Colors.text.tertiary, marginRight: 6 },
  // Sheet body
  sheetBody: { borderTopWidth: 0.5, borderTopColor: Colors.border.subtle },
  sheetTitleBlock: { alignItems: 'center', padding: 16, backgroundColor: Colors.bg.elevated, borderBottomWidth: 0.5, borderBottomColor: Colors.border.subtle },
  sheetTitle: { fontSize: 16, fontWeight: '800' as const, color: Colors.text.primary, letterSpacing: 1 },
  sheetSubtitle: { fontSize: 10, fontWeight: '700' as const, color: Colors.accent.gold, letterSpacing: 2, marginTop: 4 },
  sheetDateFull: { fontSize: 13, fontWeight: '500' as const, color: Colors.text.secondary, marginTop: 6 },
  // Time grid
  timeGrid: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: Colors.border.subtle },
  timeCell: { flex: 1, alignItems: 'center', padding: 14, gap: 4 },
  timeDivider: { width: 0.5, backgroundColor: Colors.border.subtle },
  timeLabel: { fontSize: 9, fontWeight: '700' as const, color: Colors.text.tertiary, letterSpacing: 1 },
  timeValue: { fontSize: 18, fontWeight: '700' as const, color: Colors.text.primary },
  // Details
  detailSection: { padding: 14, borderBottomWidth: 0.5, borderBottomColor: Colors.border.subtle },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  detailContent: { flex: 1 },
  detailLabel: { fontSize: 9, fontWeight: '700' as const, color: Colors.text.tertiary, letterSpacing: 1, marginBottom: 4 },
  detailValue: { fontSize: 14, color: Colors.text.primary, fontWeight: '500' as const },
  scenesText: { fontSize: 15, fontWeight: '600' as const, color: Colors.accent.goldLight },
  notesText: { fontSize: 13, color: Colors.text.secondary, lineHeight: 19 },
  // Crew
  crewSection: { padding: 14 },
  crewHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  crewTitle: { fontSize: 9, fontWeight: '700' as const, color: Colors.text.tertiary, letterSpacing: 1 },
  crewTableHeader: { flexDirection: 'row', paddingBottom: 6, borderBottomWidth: 0.5, borderBottomColor: Colors.border.subtle, marginBottom: 2 },
  crewColHeader: { fontSize: 9, fontWeight: '700' as const, color: Colors.text.tertiary, letterSpacing: 0.5 },
  crewRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: Colors.border.subtle },
  crewName: { fontSize: 13, fontWeight: '600' as const, color: Colors.text.primary },
  crewRole: { fontSize: 12, color: Colors.text.secondary },
  crewCall: { fontSize: 12, fontWeight: '600' as const, color: Colors.accent.gold, fontVariant: ['tabular-nums'] },
  // Actions
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 14, borderTopWidth: 0.5, borderTopColor: Colors.border.subtle },
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
