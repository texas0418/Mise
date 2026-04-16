import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useProjects, useProjectTimeEntries } from '@/contexts/ProjectContext';
import { DEPARTMENTS } from '@/mocks/data';
import Colors from '@/constants/colors';
import { Department } from '@/types';

export default function NewTimeEntryScreen() {
  const router = useRouter();
  const { activeProjectId, addTimeEntry, updateTimeEntry } = useProjects();
  const entries = useProjectTimeEntries(activeProjectId);
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id;
  const existingItem = editId ? entries.find(e => e.id === editId) : null;
  const isEditing = !!existingItem;

  const [department, setDepartment] = useState<Department>('camera');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [callTime, setCallTime] = useState('6:00 AM');
  const [wrapTime, setWrapTime] = useState('6:00 PM');
  const [lunchStart, setLunchStart] = useState('12:00 PM');
  const [lunchEnd, setLunchEnd] = useState('12:30 PM');
  const [scheduledHours, setScheduledHours] = useState('12');
  const [actualHours, setActualHours] = useState('12');
  const [overtimeHours, setOvertimeHours] = useState('0');
  const [notes, setNotes] = useState('');

  // Pre-fill when editing
  useEffect(() => {
    if (existingItem) {
      setDepartment(existingItem.department as Department || 'camera');
      setDate(existingItem.date);
      setCallTime(existingItem.callTime);
      setWrapTime(existingItem.wrapTime);
      setLunchStart(existingItem.lunchStart || '');
      setLunchEnd(existingItem.lunchEnd || '');
      setScheduledHours(existingItem.scheduledHours.toString());
      setActualHours(existingItem.actualHours.toString());
      setOvertimeHours(existingItem.overtimeHours.toString());
      setNotes(existingItem.notes || '');
    }
  }, [existingItem?.id]);

  const handleSave = () => {
    if (!activeProjectId) {
      Alert.alert('No Project', 'Select a project first.');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const data = {
      id: isEditing ? existingItem!.id : Date.now().toString(),
      projectId: activeProjectId,
      scheduleDayId: isEditing ? existingItem!.scheduleDayId : '',
      department,
      date,
      callTime,
      wrapTime,
      lunchStart,
      lunchEnd,
      scheduledHours: parseFloat(scheduledHours) || 0,
      actualHours: parseFloat(actualHours) || 0,
      overtimeHours: parseFloat(overtimeHours) || 0,
      notes: notes.trim(),
    };

    if (isEditing) {
      updateTimeEntry(data);
    } else {
      addTimeEntry(data);
    }
    router.back();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: isEditing ? 'Edit Time Entry' : 'New Time Entry' }} />

      <Text style={styles.label}>Department</Text>
      <View style={styles.chipRow}>
        {DEPARTMENTS.map(d => (
          <TouchableOpacity key={d.value}
            style={[styles.chip, department === d.value && styles.chipActive]}
            onPress={() => setDepartment(d.value as Department)}>
            <Text style={[styles.chipText, department === d.value && styles.chipTextActive]}>{d.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Date</Text>
      <TextInput style={styles.input} value={date} onChangeText={setDate}
        placeholder="YYYY-MM-DD" placeholderTextColor={Colors.text.tertiary} />

      <View style={styles.row}>
        <View style={styles.half}>
          <Text style={styles.label}>Call Time</Text>
          <TextInput style={styles.input} value={callTime} onChangeText={setCallTime} placeholderTextColor={Colors.text.tertiary} />
        </View>
        <View style={styles.half}>
          <Text style={styles.label}>Wrap Time</Text>
          <TextInput style={styles.input} value={wrapTime} onChangeText={setWrapTime} placeholderTextColor={Colors.text.tertiary} />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.half}>
          <Text style={styles.label}>Lunch Start</Text>
          <TextInput style={styles.input} value={lunchStart} onChangeText={setLunchStart} placeholderTextColor={Colors.text.tertiary} />
        </View>
        <View style={styles.half}>
          <Text style={styles.label}>Lunch End</Text>
          <TextInput style={styles.input} value={lunchEnd} onChangeText={setLunchEnd} placeholderTextColor={Colors.text.tertiary} />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.third}>
          <Text style={styles.label}>Scheduled (h)</Text>
          <TextInput style={styles.input} value={scheduledHours} onChangeText={setScheduledHours}
            keyboardType="decimal-pad" placeholderTextColor={Colors.text.tertiary} />
        </View>
        <View style={styles.third}>
          <Text style={styles.label}>Actual (h)</Text>
          <TextInput style={styles.input} value={actualHours} onChangeText={setActualHours}
            keyboardType="decimal-pad" placeholderTextColor={Colors.text.tertiary} />
        </View>
        <View style={styles.third}>
          <Text style={styles.label}>OT (h)</Text>
          <TextInput style={styles.input} value={overtimeHours} onChangeText={setOvertimeHours}
            keyboardType="decimal-pad" placeholderTextColor={Colors.text.tertiary} />
        </View>
      </View>

      <Text style={styles.label}>Notes</Text>
      <TextInput style={[styles.input, styles.multiline]} value={notes} onChangeText={setNotes}
        placeholder="Notes..." placeholderTextColor={Colors.text.tertiary} multiline />

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
        <Text style={styles.saveBtnText}>{isEditing ? 'Save Changes' : 'Save Time Entry'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  content: { padding: 20, paddingBottom: 40 },
  label: { fontSize: 12, fontWeight: '700' as const, color: Colors.text.secondary, textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 6, marginTop: 16 },
  input: { backgroundColor: Colors.bg.input, borderRadius: 10, padding: 14, fontSize: 15, color: Colors.text.primary, borderWidth: 0.5, borderColor: Colors.border.subtle },
  multiline: { minHeight: 70, textAlignVertical: 'top' as const },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: Colors.bg.elevated, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: Colors.border.subtle },
  chipActive: { backgroundColor: Colors.accent.goldBg, borderColor: Colors.accent.gold },
  chipText: { fontSize: 12, fontWeight: '600' as const, color: Colors.text.tertiary },
  chipTextActive: { color: Colors.accent.gold },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  third: { flex: 1 },
  saveBtn: { backgroundColor: Colors.accent.gold, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  saveBtnText: { fontSize: 16, fontWeight: '700' as const, color: Colors.text.inverse },
});
