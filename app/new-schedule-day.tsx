import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useProjects, useProjectSchedule } from '@/contexts/ProjectContext';
import Colors from '@/constants/colors';
import { scheduleNotificationsForDay } from '@/utils/notifications';

export default function NewScheduleDayScreen() {
  const router = useRouter();
  const { addScheduleDay, updateScheduleDay, activeProjectId, activeProject, schedule } = useProjects();
  const projectSchedule = useProjectSchedule(activeProjectId);
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id;
  const existingItem = editId ? projectSchedule.find(d => d.id === editId) : null;
  const isEditing = !!existingItem;

  const [date, setDate] = useState('');
  const [scenes, setScenes] = useState('');
  const [location, setLocation] = useState('');
  const [callTime, setCallTime] = useState('7:00 AM');
  const [wrapTime, setWrapTime] = useState('6:00 PM');
  const [notes, setNotes] = useState('');

  const nextDayNumber = (schedule.filter(d => d.projectId === activeProjectId).length) + 1;

  // Pre-fill form when editing
  useEffect(() => {
    if (existingItem) {
      setDate(existingItem.date);
      setScenes(existingItem.scenes);
      setLocation(existingItem.location);
      setCallTime(existingItem.callTime);
      setWrapTime(existingItem.wrapTime);
      setNotes(existingItem.notes);
    }
  }, [existingItem?.id]);

  const handleSave = useCallback(() => {
    if (!activeProjectId) {
      Alert.alert('No Project', 'Please select a project first.');
      return;
    }
    if (!date.trim() || !location.trim()) {
      Alert.alert('Missing Info', 'Please enter date and location.');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const data = {
      id: isEditing ? existingItem!.id : Date.now().toString(),
      projectId: activeProjectId,
      date: date.trim(),
      dayNumber: isEditing ? existingItem!.dayNumber : nextDayNumber,
      scenes: scenes.trim(),
      location: location.trim(),
      callTime: callTime.trim(),
      wrapTime: wrapTime.trim(),
      notes: notes.trim(),
    };

    if (isEditing) {
      updateScheduleDay(data);
    } else {
      addScheduleDay(data);
    }
    // Schedule notifications for new day
      // scheduleNotificationsForDay(newDay, activeProject?.title).catch(() => {});
      router.back();
  }, [activeProjectId, date, scenes, location, callTime, wrapTime, notes, nextDayNumber, addScheduleDay, updateScheduleDay, router, isEditing, existingItem]);

  if (!activeProject) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No project selected</Text>
        <Text style={styles.emptySubtitle}>Select a project from the Projects tab first</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: isEditing ? 'Edit Call Sheet' : 'New Shoot Day' }} />

      <View style={styles.projectLabel}>
        <Text style={styles.projectLabelText}>
          {isEditing ? `Editing: Day ${existingItem!.dayNumber} — ${existingItem!.location}` : `Day ${nextDayNumber} for: ${activeProject.title}`}
        </Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
        <TextInput style={styles.input} value={date} onChangeText={setDate}
          placeholder="2026-03-20" placeholderTextColor={Colors.text.tertiary} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Scenes</Text>
        <TextInput style={styles.input} value={scenes} onChangeText={setScenes}
          placeholder="e.g. Sc. 1, 5, 8" placeholderTextColor={Colors.text.tertiary} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Location</Text>
        <TextInput style={styles.input} value={location} onChangeText={setLocation}
          placeholder="Shooting location" placeholderTextColor={Colors.text.tertiary} />
      </View>

      <View style={styles.row}>
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.label}>Call Time</Text>
          <TextInput style={styles.input} value={callTime} onChangeText={setCallTime}
            placeholder="7:00 AM" placeholderTextColor={Colors.text.tertiary} />
        </View>
        <View style={{ width: 12 }} />
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.label}>Wrap Time</Text>
          <TextInput style={styles.input} value={wrapTime} onChangeText={setWrapTime}
            placeholder="6:00 PM" placeholderTextColor={Colors.text.tertiary} />
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Notes / Special Instructions</Text>
        <TextInput style={[styles.input, styles.textArea]} value={notes} onChangeText={setNotes}
          placeholder="Weather contingency, parking info, nearest hospital, special equipment..." placeholderTextColor={Colors.text.tertiary}
          multiline numberOfLines={4} textAlignVertical="top" />
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.8} testID="save-schedule-button">
        <Text style={styles.saveButtonText}>{isEditing ? 'Save Changes' : 'Add Shoot Day'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  content: { padding: 20, paddingBottom: 40 },
  projectLabel: { backgroundColor: Colors.accent.goldBg, borderRadius: 8, padding: 10, marginBottom: 20 },
  projectLabelText: { fontSize: 13, color: Colors.accent.gold, fontWeight: '600' as const },
  row: { flexDirection: 'row' },
  field: { marginBottom: 20 },
  label: { fontSize: 12, fontWeight: '600' as const, color: Colors.text.secondary, textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 8 },
  input: { backgroundColor: Colors.bg.input, borderRadius: 10, padding: 14, fontSize: 16, color: Colors.text.primary, borderWidth: 0.5, borderColor: Colors.border.subtle },
  textArea: { minHeight: 100, paddingTop: 14 },
  saveButton: { backgroundColor: Colors.accent.gold, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 12 },
  saveButtonText: { fontSize: 16, fontWeight: '700' as const, color: Colors.text.inverse },
  emptyContainer: { flex: 1, backgroundColor: Colors.bg.primary, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600' as const, color: Colors.text.primary },
  emptySubtitle: { fontSize: 14, color: Colors.text.secondary, marginTop: 4 },
});
