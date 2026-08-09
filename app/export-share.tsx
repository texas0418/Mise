import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router';
import {
  FileText, Camera, CalendarDays, DollarSign, ClipboardList, AlertCircle,
  Star, Clapperboard, FileSpreadsheet, ChevronDown,
} from 'lucide-react-native';
import {
  useProjects, useProjectShots, useProjectSchedule, useProjectBudget,
  useProjectWrapReports, useProjectScenes, useProjectSelects, useProjectTakes, useProjectCrew,
  useProjectCast, useProjectLocations,
} from '@/contexts/ProjectContext';
import Colors from '@/constants/colors';
import PermissionGate from '@/contexts/PermissionGate';
import {
  buildShotListHtml, buildScheduleHtml, buildCallSheetHtml, buildWrapReportHtml,
  buildBudgetHtml, buildSelectsHtml, selectsCsv, takesCsv, budgetCsv,
} from '@/utils/exportDocuments';
import { toCsv } from '@/utils/csv';
import { castTimesForDay, advanceDay, matchLocation } from '@/utils/callSheet';
import { fetchDayWeather } from '@/utils/forecast';
import { sharePdf, shareCsv } from '@/utils/shareDocument';
import { ScheduleDay, WrapReport } from '@/types';

type Format = 'pdf' | 'csv';

interface ExportRow {
  key: string;
  icon: React.ElementType;
  title: string;
  description: string;
  color: string;
  formats: Format[];
  /** Documents about a single day need one chosen before they can be built. */
  needsDay?: 'schedule' | 'wrap';
}

const EXPORTS: ExportRow[] = [
  { key: 'shot-list', icon: Camera, title: 'Shot List', description: 'Grouped by scene, with headings and page counts', color: '#60A5FA', formats: ['pdf'] },
  { key: 'schedule', icon: CalendarDays, title: 'Shooting Schedule', description: 'Every day with scenes, pages, location and times', color: '#4ADE80', formats: ['pdf'] },
  { key: 'call-sheet', icon: ClipboardList, title: 'Call Sheet', description: 'One shoot day: scenes, pages, cast and crew', color: '#FB923C', formats: ['pdf'], needsDay: 'schedule' },
  { key: 'wrap-report', icon: FileText, title: 'Wrap Report', description: 'One day wrapped: times, coverage and overtime', color: '#A78BFA', formats: ['pdf'], needsDay: 'wrap' },
  { key: 'selects', icon: Star, title: 'Selects', description: 'Circled takes for the editor', color: '#F59E0B', formats: ['pdf', 'csv'] },
  { key: 'takes', icon: Clapperboard, title: 'Take Log', description: 'Every take logged on set', color: '#F87171', formats: ['csv'] },
  { key: 'budget', icon: DollarSign, title: 'Budget', description: 'By category with estimated, actual and variance', color: '#FBBF24', formats: ['pdf', 'csv'] },
];

function DayPicker<T extends { id: string; dayNumber: number; date: string }>({
  label, days, selectedId, onSelect,
}: {
  label: string; days: T[]; selectedId: string | null; onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = days.find(d => d.id === selectedId) ?? days[0];
  if (days.length === 0) return null;

  return (
    <View style={styles.dayPicker}>
      <Text style={styles.dayPickerLabel}>{label}</Text>
      <TouchableOpacity style={styles.dayPickerButton} onPress={() => setOpen(!open)} activeOpacity={0.7}>
        <Text style={styles.dayPickerValue}>
          {selected ? `Day ${selected.dayNumber} — ${selected.date}` : 'Choose a day'}
        </Text>
        <ChevronDown color={Colors.text.tertiary} size={16} />
      </TouchableOpacity>
      {open && (
        <View style={styles.dayList}>
          {days.map(d => (
            <TouchableOpacity
              key={d.id}
              style={[styles.dayOption, d.id === selected?.id && styles.dayOptionActive]}
              onPress={() => { onSelect(d.id); setOpen(false); }}
            >
              <Text style={[styles.dayOptionText, d.id === selected?.id && styles.dayOptionTextActive]}>
                Day {d.dayNumber} — {d.date}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

export default function ExportShareScreen() {
  const { activeProject, activeProjectId, castCallTimes, callSheetDetails } = useProjects();
  const crew = useProjectCrew(activeProjectId);
  const cast = useProjectCast(activeProjectId);
  const locations = useProjectLocations(activeProjectId);
  const shots = useProjectShots(activeProjectId);
  const schedule = useProjectSchedule(activeProjectId);
  const scenes = useProjectScenes(activeProjectId);
  const budget = useProjectBudget(activeProjectId);
  const wrapReports = useProjectWrapReports(activeProjectId);
  const selects = useProjectSelects(activeProjectId);
  const takes = useProjectTakes(activeProjectId);

  const [busy, setBusy] = useState<string | null>(null);
  // Which day each day-scoped document is about. Defaulting to the first is
  // fine as a starting value; the point is that it is now choosable at all —
  // the old export hardcoded schedule[0] and always produced Day 1 (#38).
  const [scheduleDayId, setScheduleDayId] = useState<string | null>(null);
  const [wrapReportId, setWrapReportId] = useState<string | null>(null);

  const pickDay = <T extends { id: string }>(list: T[], id: string | null): T | undefined =>
    list.find(d => d.id === id) ?? list[0];

  const shareCallSheet = useCallback(async (day: ScheduleDay) => {
    if (!activeProject) return;
    const details = (callSheetDetails ?? []).find(d => d.scheduleDayId === day.id) ?? null;
    const advance = advanceDay(schedule, day.id, scenes);

    // Weather is best-effort: fetchDayWeather returns null on any failure, and
    // a call sheet without a forecast is still a call sheet.
    const place = matchLocation(day.location, locations);
    const weather = place?.latitude !== undefined && place?.longitude !== undefined
      ? await fetchDayWeather(place.latitude, place.longitude, day.date)
      : null;

    await sharePdf(
      buildCallSheetHtml(
        activeProject, day, scenes, crew, cast,
        castTimesForDay(castCallTimes ?? [], day.id),
        details, advance, weather,
      ),
      `${activeProject.title} Call Sheet Day ${day.dayNumber}`,
    );
  }, [activeProject, schedule, scenes, crew, cast, castCallTimes, callSheetDetails, locations]);

  const run = useCallback(async (row: ExportRow, format: Format) => {
    if (!activeProject) return;
    setBusy(`${row.key}-${format}`);
    try {
      const name = `${activeProject.title} ${row.title}`;

      if (format === 'csv') {
        if (row.key === 'selects') { const { headers, rows } = selectsCsv(selects); await shareCsv(toCsv(headers, rows), name); }
        if (row.key === 'takes') { const { headers, rows } = takesCsv(takes); await shareCsv(toCsv(headers, rows), name); }
        if (row.key === 'budget') { const { headers, rows } = budgetCsv(budget); await shareCsv(toCsv(headers, rows), name); }
        return;
      }

      switch (row.key) {
        case 'shot-list':
          await sharePdf(buildShotListHtml(activeProject, shots, scenes), name); break;
        case 'schedule':
          await sharePdf(buildScheduleHtml(activeProject, schedule, scenes), name); break;
        case 'call-sheet': {
          const day = pickDay<ScheduleDay>(schedule, scheduleDayId);
          if (day) await shareCallSheet(day);
          break;
        }
        case 'wrap-report': {
          const report = pickDay<WrapReport>(wrapReports, wrapReportId);
          if (report) await sharePdf(buildWrapReportHtml(activeProject, report), `${activeProject.title} Wrap Day ${report.dayNumber}`);
          break;
        }
        case 'selects':
          await sharePdf(buildSelectsHtml(activeProject, selects), name); break;
        case 'budget':
          await sharePdf(buildBudgetHtml(activeProject, budget), name); break;
      }
    } finally {
      setBusy(null);
    }
  }, [activeProject, shots, scenes, schedule, budget, wrapReports,
      selects, takes, scheduleDayId, wrapReportId, shareCallSheet]);

  if (!activeProject) {
    return (
      <View style={styles.empty}>
        <Stack.Screen options={{ title: 'Export & Share' }} />
        <AlertCircle color={Colors.text.tertiary} size={48} />
        <Text style={styles.emptyTitle}>No project selected</Text>
      </View>
    );
  }

  return (
    <PermissionGate resource="export">
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Stack.Screen options={{ title: 'Export & Share' }} />

        <Text style={styles.headerTitle}>Export</Text>
        <Text style={styles.headerSub}>
          Documents for {activeProject.title}. PDFs are formatted to print and email.
        </Text>

        {EXPORTS.map(row => {
          const Icon = row.icon;
          const unavailable =
            (row.needsDay === 'schedule' && schedule.length === 0) ||
            (row.needsDay === 'wrap' && wrapReports.length === 0);

          return (
            <View key={row.key} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={[styles.iconWrap, { backgroundColor: row.color + '18' }]}>
                  <Icon color={row.color} size={22} />
                </View>
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle}>{row.title}</Text>
                  <Text style={styles.cardDesc}>{row.description}</Text>
                </View>
              </View>

              {row.needsDay === 'schedule' && (
                <DayPicker label="Shoot day" days={schedule} selectedId={scheduleDayId} onSelect={setScheduleDayId} />
              )}
              {row.needsDay === 'wrap' && (
                <DayPicker label="Wrap report" days={wrapReports} selectedId={wrapReportId} onSelect={setWrapReportId} />
              )}

              {unavailable ? (
                <Text style={styles.unavailable}>
                  {row.needsDay === 'schedule' ? 'Add a shoot day first.' : 'File a wrap report first.'}
                </Text>
              ) : (
                <View style={styles.formatRow}>
                  {row.formats.map(format => (
                    <TouchableOpacity
                      key={format}
                      style={styles.formatBtn}
                      onPress={() => run(row, format)}
                      disabled={busy !== null}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={`Export ${row.title} as ${format.toUpperCase()}`}
                    >
                      {busy === `${row.key}-${format}` ? (
                        <ActivityIndicator size="small" color={Colors.accent.gold} />
                      ) : (
                        <>
                          {format === 'pdf'
                            ? <FileText color={Colors.accent.gold} size={14} />
                            : <FileSpreadsheet color={Colors.accent.gold} size={14} />}
                          <Text style={styles.formatText}>{format.toUpperCase()}</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </PermissionGate>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  content: { padding: 16, paddingBottom: 40 },
  headerTitle: { fontSize: 20, fontWeight: '700' as const, color: Colors.text.primary, marginBottom: 4 },
  headerSub: { fontSize: 13, color: Colors.text.secondary, marginBottom: 20, lineHeight: 18 },
  card: { backgroundColor: Colors.bg.card, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 0.5, borderColor: Colors.border.subtle },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconWrap: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700' as const, color: Colors.text.primary },
  cardDesc: { fontSize: 12, color: Colors.text.tertiary, marginTop: 2 },
  formatRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  formatBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 9, paddingHorizontal: 18, borderRadius: 10,
    backgroundColor: Colors.accent.goldBg, borderWidth: 0.5, borderColor: Colors.accent.gold + '44',
    minWidth: 86, minHeight: 38,
  },
  formatText: { fontSize: 12, fontWeight: '700' as const, color: Colors.accent.gold, letterSpacing: 0.5 },
  unavailable: { fontSize: 12, color: Colors.text.tertiary, fontStyle: 'italic' as const, marginTop: 12 },
  dayPicker: { marginTop: 12 },
  dayPickerLabel: { fontSize: 10, fontWeight: '700' as const, color: Colors.text.tertiary, textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 6 },
  dayPickerButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.bg.input, borderRadius: 10, padding: 12, borderWidth: 0.5, borderColor: Colors.border.subtle },
  dayPickerValue: { fontSize: 14, color: Colors.text.primary },
  dayList: { backgroundColor: Colors.bg.elevated, borderRadius: 10, marginTop: 6, borderWidth: 0.5, borderColor: Colors.border.subtle, overflow: 'hidden' },
  dayOption: { padding: 12, borderBottomWidth: 0.5, borderBottomColor: Colors.border.subtle },
  dayOptionActive: { backgroundColor: Colors.accent.goldBg },
  dayOptionText: { fontSize: 13, color: Colors.text.secondary },
  dayOptionTextActive: { color: Colors.accent.gold, fontWeight: '600' as const },
  empty: { flex: 1, backgroundColor: Colors.bg.primary, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600' as const, color: Colors.text.primary, marginTop: 16 },
});
