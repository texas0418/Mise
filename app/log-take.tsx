import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { CircleCheck, CircleX } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useProjects } from '@/contexts/ProjectContext';
import Colors from '@/constants/colors';

export default function LogTakeScreen() {
  const router = useRouter();
  const { addTake, activeProjectId, activeProject } = useProjects();

  const [sceneNumber, setSceneNumber] = useState('');
  const [shotNumber, setShotNumber] = useState('');
  const [takeNumber, setTakeNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [isCircled, setIsCircled] = useState(false);
  const [isNG, setIsNG] = useState(false);

  const handleSave = useCallback(() => {
    if (!activeProjectId) {
      Alert.alert('No Project', 'Please select a project first.');
      return;
    }
    if (!sceneNumber.trim() || !shotNumber.trim() || !takeNumber.trim()) {
      Alert.alert('Missing Info', 'Please enter scene, shot, and take numbers.');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addTake({
      id: Date.now().toString(),
      projectId: activeProjectId,
      sceneNumber: parseInt(sceneNumber, 10) || 1,
      shotNumber: shotNumber.trim(),
      takeNumber: parseInt(takeNumber, 10) || 1,
      isCircled,
      isNG,
      notes: notes.trim(),
      timestamp: new Date().toISOString(),
    });
    router.back();
  }, [activeProjectId, sceneNumber, shotNumber, takeNumber, isCircled, isNG, notes, addTake, router]);

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
      <View style={styles.projectLabel}>
        <Text style={styles.projectLabelText}>Logging for: {activeProject.title}</Text>
      </View>

      <View style={styles.row}>
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.label}>Scene #</Text>
          <TextInput
            style={styles.input}
            value={sceneNumber}
            onChangeText={setSceneNumber}
            placeholder="1"
            placeholderTextColor={Colors.text.tertiary}
            keyboardType="number-pad"
          />
        </View>
        <View style={{ width: 12 }} />
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.label}>Shot #</Text>
          <TextInput
            style={styles.input}
            value={shotNumber}
            onChangeText={setShotNumber}
            placeholder="1A"
            placeholderTextColor={Colors.text.tertiary}
          />
        </View>
        <View style={{ width: 12 }} />
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.label}>Take #</Text>
          <TextInput
            style={styles.input}
            value={takeNumber}
            onChangeText={setTakeNumber}
            placeholder="1"
            placeholderTextColor={Colors.text.tertiary}
            keyboardType="number-pad"
          />
        </View>
      </View>

      <View style={styles.statusRow}>
        <TouchableOpacity
          style={[styles.statusBtn, isCircled && styles.statusBtnCircled]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setIsCircled(!isCircled);
            if (!isCircled) setIsNG(false);
          }}
          activeOpacity={0.7}
        >
          <CircleCheck color={isCircled ? Colors.status.active : Colors.text.tertiary} size={24} />
          <Text style={[styles.statusBtnText, isCircled && { color: Colors.status.active }]}>Circle Take</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.statusBtn, isNG && styles.statusBtnNG]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setIsNG(!isNG);
            if (!isNG) setIsCircled(false);
          }}
          activeOpacity={0.7}
        >
          <CircleX color={isNG ? Colors.status.error : Colors.text.tertiary} size={24} />
          <Text style={[styles.statusBtnText, isNG && { color: Colors.status.error }]}>No Good</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Performance notes, technical issues, etc."
          placeholderTextColor={Colors.text.tertiary}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.8} testID="save-take-button">
        <Text style={styles.saveButtonText}>Log Take</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  projectLabel: {
    backgroundColor: Colors.accent.goldBg,
    borderRadius: 8,
    padding: 10,
    marginBottom: 20,
  },
  projectLabelText: {
    fontSize: 13,
    color: Colors.accent.gold,
    fontWeight: '600' as const,
  },
  row: {
    flexDirection: 'row',
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.text.secondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.bg.input,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: Colors.text.primary,
    borderWidth: 0.5,
    borderColor: Colors.border.subtle,
  },
  textArea: {
    minHeight: 100,
    paddingTop: 14,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statusBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.bg.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.border.subtle,
  },
  statusBtnCircled: {
    borderColor: Colors.status.active + '55',
    backgroundColor: Colors.status.active + '0A',
  },
  statusBtnNG: {
    borderColor: Colors.status.error + '44',
    backgroundColor: Colors.status.error + '08',
  },
  statusBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text.tertiary,
  },
  saveButton: {
    backgroundColor: Colors.accent.gold,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text.inverse,
  },
  emptyContainer: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text.primary,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 4,
  },
});
