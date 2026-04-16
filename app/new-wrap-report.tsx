import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useProjects, useProjectShots, useProjectTakes, useProjectSchedule, useProjectWrapReports } from '@/contexts/ProjectContext';
import Colors from '@/constants/colors';

export default function NewWrapReportScreen() {
  const router = useRouter();
  const { activeProject, activeProjectId, addWrapReport, updateWrapReport } = useProjects();
  const shots = useProjectShots(activeProjectId);
  const takes = useProjectTakes(activeProjectId);
  const schedule = useProjectSchedule(activeProjectId);
  const reports = useProjectWrapReports(activeProjectId);
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id;
  const existingItem = editId ? reports.find(r => r.id === editId) : null;
  const isEditing = !!existingItem;

  const nextDay = (schedule.length > 0 ? Math.max(...schedule.map(d => d.dayNumber)) : 0) + 1;

  const [dayNumber, setDayNumber] = useState(String(nextDay));
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [callTime, setCallTime] = useState('6:00 AM');
  const [actualWrap, setActualWrap] = useState('6:00 PM');
  const [scheduledWrap, setScheduledWrap] = useState('6:00 PM');
  const [scenesScheduled, setScenesScheduled] = useState('');
  const [scenesCompleted, setScenesCompleted] = useState('');
  const [shotsPlanned, setShotsPlanned] = useState(String(shots.filter(s => s.status === 'planned' || s.status === 'ready').length));
  const [shotsCompleted, setShotsCompleted] = useState('0');
  const [totalTakesOverride, setTotalTakesOverride] = useState('');
  const [circledTakesOverride, setCircledTakesOverride] = useState('');
  const [ngTakesOverride, setNgTakesOverride] = useState('');
  const [overtimeMinutes, setOvertimeMinutes] = useState('0');
  const [notes, setNotes] = useState('');
  const [weatherConditions, setWeatherConditions] = useState('');

  // Pre-fill when editing
  useEffect(() => {
    if (existingItem) {
      setDayNumber(existingItem.dayNumber.toString());
      setDate(existingItem.date);
      setCallTime(existingItem.callTime);
      setActualWrap(existingItem.actualWrap);
      setScheduledWrap(existingItem.scheduledWrap || '');
      setScenesScheduled(existingItem.scenesScheduled);
      setScenesCompleted(existingItem.scenesCompleted);
      setShotsPlanned(existingItem.shotsPlanned.toString());
      setShotsCompleted(existingItem.shotsCompleted.toString());
      setTotalTakesOverride(existingItem.totalTakes.toString());
      setCircledTakesOverride(existingItem.circledTakes.toString());
      setNgTakesOverride(existingItem.ngTakes.toString());
      setOvertimeMinutes(existingItem.overtimeMinutes.toString());
      setNotes(existingItem.notes || '');
      setWeatherConditions(existingItem.weatherConditions || '');
    }
  }, [existingItem?.id]);

  const autoStats = useMemo(() => ({
    totalTakes: takes.length,
    circledTakes: takes.filter(t => t.isCircled).length,
    ngTakes: takes.filter(t => t.isNG).length,
  }), [takes]);

  const handleSave = () => {
    if (!activeProjectId) { Alert.alert('No Project', 'Select a project first.'); return; }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const data = {
      id: isEditing ? existingItem!.id : Date.now().toString(),
      projectId: activeProjectId,
      scheduleDayId: isEditing ? existingItem!.scheduleDayId : '',
      dayNumber: parseInt(dayNumber) || 1,
      date,
      callTime,
      actualWrap,
      scheduledWrap,
      scenesScheduled,
      scenesCompleted,
      shotsPlanned: parseInt(shotsPlanned) || 0,
      shotsCompleted: parseInt(shotsCompleted) || 0,
      totalTakes: isEditing ? (parseInt(totalTakesOverride) || 0) : autoStats.totalTakes,
      circledTakes: isEditing ? (parseInt(circledTakesOverride) || 0) : autoStats.circledTakes,
      ngTakes: isEditing ? (parseInt(ngTakesOverride) || 0) : autoStats.ngTakes,
      pagesScheduled: isEditing ? (existingItem!.pagesScheduled || '') : '',
      pagesCompleted: isEditing ? (existingItem!.pagesCompleted || '') : '',
      overtimeMinutes: parseInt(overtimeMinutes) || 0,
      notes,
      safetyIncidents: isEditing ? (existingItem!.safetyIncidents || '') : '',
      weatherConditions,
      createdAt: isEditing ? existingItem!.createdAt : new Date().toISOString(),
    };

    if (isEditing) { updateWrapReport(data); } else { addWrapReport(data); }
    router.back();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: isEditing ? 'Edit Wrap Report' : 'New Wrap Report' }} />

      {!isEditing && (
        <View style={styles.autoBox}>
          <Text style={styles.autoTitle}>Auto-calculated from logged takes</Text>
          <Text style={styles.autoText}>Takes: {autoStats.totalTakes} | Circled: {autoStats.circledTakes} | NG: {autoStats.ngTakes}</Text>
        </View>
      )}

      <Text style={styles.label}>Day Number</Text>
      <TextInput style={styles.input} value={dayNumber} onChangeText={setDayNumber} keyboardType="number-pad" placeholderTextColor={Colors.text.tertiary} />

      <Text style={styles.label}>Date</Text>
      <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.text.tertiary} />

      <View style={styles.row}>
        <View style={styles.half}><Text style={styles.label}>Call Time</Text><TextInput style={styles.input} value={callTime} onChangeText={setCallTime} placeholderTextColor={Colors.text.tertiary} /></View>
        <View style={styles.half}><Text style={styles.label}>Actual Wrap</Text><TextInput style={styles.input} value={actualWrap} onChangeText={setActualWrap} placeholderTextColor={Colors.text.tertiary} /></View>
      </View>

      <Text style={styles.label}>Scenes Scheduled</Text>
      <TextInput style={styles.input} value={scenesScheduled} onChangeText={setScenesScheduled} placeholder="e.g. Sc. 1, 5, 8" placeholderTextColor={Colors.text.tertiary} />

      <Text style={styles.label}>Scenes Completed</Text>
      <TextInput style={styles.input} value={scenesCompleted} onChangeText={setScenesCompleted} placeholder="e.g. Sc. 1, 5" placeholderTextColor={Colors.text.tertiary} />

      <View style={styles.row}>
        <View style={styles.half}><Text style={styles.label}>Shots Planned</Text><TextInput style={styles.input} value={shotsPlanned} onChangeText={setShotsPlanned} keyboardType="number-pad" placeholderTextColor={Colors.text.tertiary} /></View>
        <View style={styles.half}><Text style={styles.label}>Shots Completed</Text><TextInput style={styles.input} value={shotsCompleted} onChangeText={setShotsCompleted} keyboardType="number-pad" placeholderTextColor={Colors.text.tertiary} /></View>
      </View>

      {/* In edit mode, allow manual take count overrides */}
      {isEditing && (
        <View style={styles.row}>
          <View style={styles.third}><Text style={styles.label}>Total Takes</Text><TextInput style={styles.input} value={totalTakesOverride} onChangeText={setTotalTakesOverride} keyboardType="number-pad" placeholderTextColor={Colors.text.tertiary} /></View>
          <View style={styles.third}><Text style={styles.label}>Circled</Text><TextInput style={styles.input} value={circledTakesOverride} onChangeText={setCircledTakesOverride} keyboardType="number-pad" placeholderTextColor={Colors.text.tertiary} /></View>
          <View style={styles.third}><Text style={styles.label}>NG</Text><TextInput style={styles.input} value={ngTakesOverride} onChangeText={setNgTakesOverride} keyboardType="number-pad" placeholderTextColor={Colors.text.tertiary} /></View>
        </View>
      )}

      <Text style={styles.label}>Overtime (minutes)</Text>
      <TextInput style={styles.input} value={overtimeMinutes} onChangeText={setOvertimeMinutes} keyboardType="number-pad" placeholderTextColor={Colors.text.tertiary} />

      <Text style={styles.label}>Weather Conditions</Text>
      <TextInput style={styles.input} value={weatherConditions} onChangeText={setWeatherConditions} placeholder="e.g. Clear, 62°F, light wind" placeholderTextColor={Colors.text.tertiary} />

      <Text style={styles.label}>Notes</Text>
      <TextInput style={[styles.input, styles.multiline]} value={notes} onChangeText={setNotes} placeholder="Wrap notes..." placeholderTextColor={Colors.text.tertiary} multiline numberOfLines={4} />

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
        <Text style={styles.saveBtnText}>{isEditing ? 'Save Changes' : 'Save Wrap Report'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  content: { padding: 20, paddingBottom: 40 },
  autoBox: { backgroundColor: Colors.accent.goldBg, borderRadius: 10, padding: 12, marginBottom: 10 },
  autoTitle: { fontSize: 11, fontWeight: '700' as const, color: Colors.accent.gold, marginBottom: 4 },
  autoText: { fontSize: 13, color: Colors.accent.goldLight },
  label: { fontSize: 12, fontWeight: '700' as const, color: Colors.text.secondary, textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 6, marginTop: 16 },
  input: { backgroundColor: Colors.bg.input, borderRadius: 10, padding: 14, fontSize: 15, color: Colors.text.primary, borderWidth: 0.5, borderColor: Colors.border.subtle },
  multiline: { minHeight: 80, textAlignVertical: 'top' as const },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  third: { flex: 1 },
  saveBtn: { backgroundColor: Colors.accent.gold, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  saveBtnText: { fontSize: 16, fontWeight: '700' as const, color: Colors.text.inverse },
});
