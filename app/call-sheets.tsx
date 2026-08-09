import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, TextInput } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { ClipboardList, MapPin, Clock, Users, Drama, AlertCircle, Plus, ChevronDown, ChevronUp, Pencil, Trash2, Calendar } from 'lucide-react-native';
import {
  useProjects, useProjectSchedule, useProjectCrew, useProjectScenes,
  useProjectCast, useDayCastCallTimes, AssignedCrew,
} from '@/contexts/ProjectContext';
import { useLayout } from '@/utils/useLayout';
import { formatEighths } from '@/utils/eighths';
import { sceneRows, dayTotals, sceneListLabel, resolveDayScenes, castRows } from '@/utils/callSheet';
import Colors from '@/constants/colors';
import { ScheduleDay, Scene, CastMember, CastCallTime } from '@/types';
import PermissionGate from '@/contexts/PermissionGate';

/** Which of an actor's three times is being edited. */
type CastTimeField = 'makeupTime' | 'wardrobeTime' | 'onSetTime';

/**
 * The scenes block.
 *
 * This used to print `day.scenes` — the free-text string someone typed — so the
 * screen said "Sc. 12, 12A" while the exported PDF listed those same scenes
 * with headings, page counts and cast. The document and the screen disagreed
 * about what the day was. Both read the linked Scene records now, and the typed
 * string survives only as the fallback for days the migration could not resolve.
 */
function SceneTable({ day, scenes }: { day: ScheduleDay; scenes: Scene[] }) {
  const linked = resolveDayScenes(day, scenes);
  const rows = sceneRows(linked);
  const totals = dayTotals(linked);

  if (rows.length === 0) {
    return (
      <View style={styles.detailSection}>
        <Text style={styles.detailLabel}>SCENES</Text>
        <Text style={styles.scenesText}>{sceneListLabel(day, scenes)}</Text>
        <Text style={styles.sceneFallbackNote}>
          Not linked to scene records, so there are no page counts. Importing or
          adding the scenes fills this in.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.detailSection}>
      <View style={styles.sceneHeaderRow}>
        <Text style={styles.detailLabel}>SCENES</Text>
        <Text style={styles.sceneTotals} testID="call-sheet-scene-totals">
          {totals.sceneCount} scene{totals.sceneCount === 1 ? '' : 's'} · {formatEighths(totals.eighths)} pages
        </Text>
      </View>

      <View style={styles.sceneTableHeader}>
        <Text style={[styles.sceneColHeader, styles.colScene]}>SC</Text>
        <Text style={[styles.sceneColHeader, styles.colIntExt]}>I/E</Text>
        <Text style={[styles.sceneColHeader, styles.colDayNight]}>D/N</Text>
        <Text style={[styles.sceneColHeader, styles.colHeading]}>DESCRIPTION</Text>
        <Text style={[styles.sceneColHeader, styles.colPages]}>PGS</Text>
      </View>

      {rows.map(row => (
        <View key={row.id} style={styles.sceneRow} testID={`call-sheet-scene-${row.id}`}>
          <Text style={[styles.sceneNumber, styles.colScene]}>{row.number}</Text>
          <Text style={[styles.sceneCell, styles.colIntExt]}>{row.intExt}</Text>
          <Text style={[styles.sceneCell, styles.colDayNight]}>{row.dayNight}</Text>
          <View style={styles.colHeading}>
            <Text style={styles.sceneHeading} numberOfLines={1}>{row.heading || 'No slugline'}</Text>
            {row.cast.length > 0 ? (
              <Text style={styles.sceneCast} numberOfLines={1}>{row.cast.join(', ')}</Text>
            ) : null}
          </View>
          <Text style={[styles.scenePages, styles.colPages]}>{formatEighths(row.pageEighths)}</Text>
        </View>
      ))}
    </View>
  );
}

/** Set one of the three times without widening CastCallTime to a string map. */
function applyCastTime(entry: CastCallTime, field: CastTimeField, value: string): CastCallTime {
  if (field === 'makeupTime') return { ...entry, makeupTime: value };
  if (field === 'wardrobeTime') return { ...entry, wardrobeTime: value };
  return { ...entry, onSetTime: value };
}

/** The three times an actor is given, in the order they happen. */
const CAST_TIME_FIELDS: { key: CastTimeField; label: string }[] = [
  { key: 'makeupTime', label: 'MAKEUP' },
  { key: 'wardrobeTime', label: 'WARDROBE' },
  { key: 'onSetTime', label: 'ON SET' },
];

/**
 * The cast table.
 *
 * Two rows per person rather than five columns: three editable times plus a
 * character and an actor do not fit across a phone, and the times are what
 * someone is here to change.
 *
 * A blank field means the general call, so an untouched sheet is still correct
 * — the same rule the crew calls follow (#39).
 */
function CastTable({ day, cast, scenes, onSetCastTime }: {
  day: ScheduleDay;
  cast: CastMember[];
  scenes: Scene[];
  onSetCastTime: (dayId: string, castMemberId: string, field: CastTimeField, value: string) => void;
}) {
  const times = useDayCastCallTimes(day.id);
  const rows = castRows(cast, resolveDayScenes(day, scenes), times);

  return (
    <View style={styles.castSection}>
      <View style={styles.crewHeader}>
        <Drama color={Colors.accent.gold} size={14} />
        <Text style={styles.crewTitle}>CAST ({rows.length})</Text>
      </View>

      {rows.length === 0 ? (
        <Text style={styles.castEmpty}>
          No cast matched today&apos;s scenes. Cast are matched to a scene by character name.
        </Text>
      ) : rows.map(row => (
        <View key={row.castMemberId} style={styles.castRow} testID={`call-sheet-cast-${row.castMemberId}`}>
          <View style={styles.castIdentity}>
            <Text style={styles.castCharacter} numberOfLines={1}>{row.character}</Text>
            <Text style={styles.castActor} numberOfLines={1}>{row.actor}</Text>
            <Text style={styles.castScenes}>Sc. {row.sceneNumbers.join(', ')}</Text>
          </View>
          <View style={styles.castTimes}>
            {CAST_TIME_FIELDS.map(field => (
              <View key={field.key} style={styles.castTimeCell}>
                <Text style={styles.castTimeLabel}>{field.label}</Text>
                <TextInput
                  style={styles.castTimeInput}
                  value={row[field.key]}
                  placeholder={day.callTime}
                  placeholderTextColor={Colors.text.tertiary}
                  onChangeText={value => onSetCastTime(day.id, row.castMemberId, field.key, value)}
                  textAlign="center"
                  accessibilityLabel={`${field.label.toLowerCase()} time for ${row.character}`}
                  testID={`cast-time-${row.castMemberId}-${field.key}`}
                />
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function CallSheetCard({ day, crew, scenes, cast, projectTitle, isExpanded, onPress, onEdit, onDelete, onSetCallTime, onSetCastTime }: {
  day: ScheduleDay;
  crew: AssignedCrew[];
  scenes: Scene[];
  cast: CastMember[];
  projectTitle: string;
  isExpanded: boolean;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSetCallTime: (assignmentId: string, callTime: string) => void;
  onSetCastTime: (dayId: string, castMemberId: string, field: CastTimeField, value: string) => void;
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

          <SceneTable day={day} scenes={scenes} />

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
              <View key={member.assignmentId} style={styles.crewRow}>
                <Text style={[styles.crewName, { flex: 2 }]}>{member.name}</Text>
                <Text style={[styles.crewRole, { flex: 2 }]}>{member.projectRole}</Text>
                {/* Their own call when they have one, otherwise the general
                    call — which is what everyone used to get (#39). */}
                {/* Editable: this is the whole point of a call sheet. Blank
                    means they are on the general call. */}
                <TextInput
                  style={[styles.crewCall, styles.crewCallInput, { flex: 1 }]}
                  value={member.callTime ?? ''}
                  placeholder={day.callTime}
                  placeholderTextColor={Colors.text.tertiary}
                  onChangeText={t => onSetCallTime(member.assignmentId, t)}
                  textAlign="right"
                  accessibilityLabel={`Call time for ${member.name}`}
                />
              </View>
            ))}
          </View>

          <CastTable day={day} cast={cast} scenes={scenes} onSetCastTime={onSetCastTime} />

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
  const { activeProject, activeProjectId, deleteScheduleDay } = useProjects();
  const crew = useProjectCrew(activeProjectId);
  const scenes = useProjectScenes(activeProjectId);
  const cast = useProjectCast(activeProjectId);
  const { crewAssignments, updateCrewAssignment, upsertCastCallTime } = useProjects();

  // Create-or-edit, decided inside the write chain rather than from this
  // render's snapshot — see the note on useEntityStore.upsert.
  const setCastTime = useCallback((
    dayId: string, castMemberId: string, field: CastTimeField, value: string,
  ) => {
    if (!activeProjectId) return;
    upsertCastCallTime(
      (entry: CastCallTime) => entry.scheduleDayId === dayId && entry.castMemberId === castMemberId,
      (existing: CastCallTime | null) => applyCastTime(existing ?? {
        id: Date.now().toString(),
        projectId: activeProjectId,
        scheduleDayId: dayId,
        castMemberId,
        makeupTime: '',
        wardrobeTime: '',
        onSetTime: '',
        notes: '',
        createdAt: new Date().toISOString(),
      }, field, value),
    );
  }, [activeProjectId, upsertCastCallTime]);

  const setCallTime = useCallback((assignmentId: string, callTime: string) => {
    const assignment = (crewAssignments ?? []).find(a => a.id === assignmentId);
    if (!assignment) return;
    updateCrewAssignment({ ...assignment, callTime });
  }, [crewAssignments, updateCrewAssignment]);
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
            scenes={scenes}
            cast={cast}
            projectTitle={activeProject.title}
            isExpanded={expandedId === item.id}
            onPress={() => setExpandedId(expandedId === item.id ? null : item.id)}
            onEdit={() => router.push(`/new-schedule-day?id=${item.id}` as never)}
            onDelete={() => deleteScheduleDay(item.id)}
            onSetCallTime={setCallTime}
            onSetCastTime={setCastTime}
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
  sceneFallbackNote: { fontSize: 11, color: Colors.text.tertiary, marginTop: 6, lineHeight: 16 },
  // Scene table
  sceneHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  sceneTotals: { fontSize: 11, color: Colors.accent.goldLight, fontWeight: '600' as const, fontVariant: ['tabular-nums'] },
  sceneTableHeader: { flexDirection: 'row', alignItems: 'center', paddingBottom: 5, borderBottomWidth: 0.5, borderBottomColor: Colors.border.subtle },
  sceneColHeader: { fontSize: 9, fontWeight: '700' as const, color: Colors.text.tertiary, letterSpacing: 0.5 },
  sceneRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 0.5, borderBottomColor: Colors.border.subtle },
  colScene: { width: 40 },
  colIntExt: { width: 46 },
  colDayNight: { width: 46 },
  colHeading: { flex: 1, paddingRight: 8 },
  colPages: { width: 42, textAlign: 'right' as const },
  sceneNumber: { fontSize: 13, fontWeight: '700' as const, color: Colors.accent.gold, fontVariant: ['tabular-nums'] },
  sceneCell: { fontSize: 11, color: Colors.text.secondary },
  sceneHeading: { fontSize: 12, color: Colors.text.primary, fontWeight: '500' as const },
  sceneCast: { fontSize: 10, color: Colors.text.tertiary, marginTop: 2 },
  scenePages: { fontSize: 11, color: Colors.text.secondary, fontVariant: ['tabular-nums'] },
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
  crewCallInput: { paddingVertical: 2, paddingHorizontal: 4, borderRadius: 4, backgroundColor: Colors.bg.elevated, minWidth: 68 },
  // Cast
  castSection: { padding: 14, borderTopWidth: 0.5, borderTopColor: Colors.border.subtle },
  castEmpty: { fontSize: 11, color: Colors.text.tertiary, lineHeight: 16 },
  castRow: { paddingVertical: 9, borderBottomWidth: 0.5, borderBottomColor: Colors.border.subtle },
  castIdentity: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  castCharacter: { fontSize: 13, fontWeight: '700' as const, color: Colors.text.primary, maxWidth: '40%' },
  castActor: { flex: 1, fontSize: 11, color: Colors.text.secondary },
  castScenes: { fontSize: 10, color: Colors.accent.goldLight, fontVariant: ['tabular-nums'] },
  castTimes: { flexDirection: 'row', gap: 8, marginTop: 7 },
  castTimeCell: { flex: 1 },
  castTimeLabel: { fontSize: 8, fontWeight: '700' as const, color: Colors.text.tertiary, letterSpacing: 0.8, marginBottom: 3, textAlign: 'center' as const },
  castTimeInput: { fontSize: 12, fontWeight: '600' as const, color: Colors.accent.gold, fontVariant: ['tabular-nums'], paddingVertical: 5, borderRadius: 6, backgroundColor: Colors.bg.elevated, borderWidth: 0.5, borderColor: Colors.border.subtle },
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
