import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { CircleCheck, CircleX, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useProjects, useProjectTakes } from '@/contexts/ProjectContext';
import Colors from '@/constants/colors';
import { Take } from '@/types';

/** Existing take -> form field values. Module-level so the screen stays under
 *  the lint complexity ceiling. */
function takeToFormValues(t: Take) {
  return {
    sceneNumber: String(t.sceneNumber ?? ''),
    shotNumber: t.shotNumber ?? '',
    takeNumber: String(t.takeNumber ?? ''),
    notes: t.notes ?? '',
    isCircled: !!t.isCircled,
    isNG: !!t.isNG,
  };
}

/** Circle / NG selector. Extracted so the screen stays under the lint
 *  complexity ceiling; the two are mutually exclusive. */
function TakeStatusRow({ isCircled, isNG, onToggleCircle, onToggleNG }: {
  isCircled: boolean;
  isNG: boolean;
  onToggleCircle: () => void;
  onToggleNG: () => void;
}) {
  const press = (fn: () => void) => () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    fn();
  };
  return (
    <View style={styles.statusRow}>
      <TouchableOpacity
        style={[styles.statusBtn, isCircled && styles.statusBtnCircled]}
        onPress={press(onToggleCircle)}
        activeOpacity={0.7}
      >
        <CircleCheck color={isCircled ? Colors.status.active : Colors.text.tertiary} size={24} />
        <Text style={[styles.statusBtnText, isCircled && { color: Colors.status.active }]}>Circle Take</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.statusBtn, isNG && styles.statusBtnNG]}
        onPress={press(onToggleNG)}
        activeOpacity={0.7}
      >
        <CircleX color={isNG ? Colors.status.error : Colors.text.tertiary} size={24} />
        <Text style={[styles.statusBtnText, isNG && { color: Colors.status.error }]}>No Good</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function LogTakeScreen() {
  const router = useRouter();
  const { addTake, updateTake, deleteTake, activeProjectId, activeProject } = useProjects();
  const takes = useProjectTakes(activeProjectId);

  // `id` opens an existing take for correction; scene/shot/take carry the
  // slate's current state so the modal opens ready to save (#41).
  const params = useLocalSearchParams<{
    id?: string; scene?: string; shot?: string; take?: string;
  }>();
  const editId = params.id;
  const existingItem = editId ? takes.find(t => t.id === editId) : null;
  const isEditing = !!existingItem;

  const [sceneNumber, setSceneNumber] = useState(params.scene ?? '');
  const [shotNumber, setShotNumber] = useState(params.shot ?? '');
  const [takeNumber, setTakeNumber] = useState(params.take ?? '');
  const [notes, setNotes] = useState('');
  const [isCircled, setIsCircled] = useState(false);
  const [isNG, setIsNG] = useState(false);

  useEffect(() => {
    if (!existingItem) return;
    const v = takeToFormValues(existingItem);
    setSceneNumber(v.sceneNumber);
    setShotNumber(v.shotNumber);
    setTakeNumber(v.takeNumber);
    setNotes(v.notes);
    setIsCircled(v.isCircled);
    setIsNG(v.isNG);
  }, [existingItem?.id]);

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

    const fields = {
      sceneNumber: parseInt(sceneNumber, 10) || 1,
      shotNumber: shotNumber.trim(),
      takeNumber: parseInt(takeNumber, 10) || 1,
      isCircled,
      isNG,
      notes: notes.trim(),
    };

    if (isEditing) {
      // Keep the original timestamp — it records when the take was shot, not
      // when the note was tidied up.
      updateTake({ ...existingItem!, ...fields });
    } else {
      addTake({
        id: Date.now().toString(),
        projectId: activeProjectId,
        ...fields,
        timestamp: new Date().toISOString(),
      });
    }
    router.back();
  }, [activeProjectId, sceneNumber, shotNumber, takeNumber, isCircled, isNG, notes,
      isEditing, existingItem, addTake, updateTake, router]);

  const handleDelete = useCallback(() => {
    if (!existingItem) return;
    Alert.alert(
      'Delete Take',
      `Delete take ${existingItem.takeNumber} of Sc.${existingItem.sceneNumber}/${existingItem.shotNumber}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => { deleteTake(existingItem.id); router.back(); },
        },
      ],
    );
  }, [existingItem, deleteTake, router]);

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
      <Stack.Screen options={{ title: isEditing ? 'Edit Take' : 'Log Take' }} />

      <View style={styles.projectLabel}>
        <Text style={styles.projectLabelText}>
          {isEditing ? 'Editing take for' : 'Logging for'}: {activeProject.title}
        </Text>
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

      <TakeStatusRow
        isCircled={isCircled}
        isNG={isNG}
        onToggleCircle={() => { setIsCircled(!isCircled); if (!isCircled) setIsNG(false); }}
        onToggleNG={() => { setIsNG(!isNG); if (!isNG) setIsCircled(false); }}
      />

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
        <Text style={styles.saveButtonText}>{isEditing ? 'Save Take' : 'Log Take'}</Text>
      </TouchableOpacity>

      {isEditing && (
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDelete}
          activeOpacity={0.8}
          testID="delete-take-button"
        >
          <Trash2 color={Colors.status.error} size={16} />
          <Text style={styles.deleteButtonText}>Delete Take</Text>
        </TouchableOpacity>
      )}
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
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
    borderWidth: 0.5,
    borderColor: Colors.status.error + '55',
    backgroundColor: Colors.status.error + '10',
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.status.error,
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
