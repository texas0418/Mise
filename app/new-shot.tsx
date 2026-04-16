import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronDown } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useProjects, useProjectShots } from '@/contexts/ProjectContext';
import Colors from '@/constants/colors';
import { ShotType, ShotMovement, ShotStatus } from '@/types';
import { SHOT_TYPES, SHOT_MOVEMENTS } from '@/mocks/data';

const STATUS_OPTIONS: { value: ShotStatus; label: string; color: string }[] = [
  { value: 'planned', label: 'Planned', color: Colors.text.tertiary },
  { value: 'ready', label: 'Ready', color: Colors.status.info },
  { value: 'shot', label: 'Shot', color: Colors.status.warning },
  { value: 'approved', label: 'Approved', color: Colors.status.active },
];

export default function NewShotScreen() {
  const router = useRouter();
  const { addShot, updateShot, activeProjectId, activeProject } = useProjects();
  const shots = useProjectShots(activeProjectId);
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id;
  const existingItem = editId ? shots.find(s => s.id === editId) : null;
  const isEditing = !!existingItem;

  const [sceneNumber, setSceneNumber] = useState('');
  const [shotNumber, setShotNumber] = useState('');
  const [type, setType] = useState<ShotType>('medium');
  const [movement, setMovement] = useState<ShotMovement>('static');
  const [lens, setLens] = useState('50mm');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<ShotStatus>('planned');
  const [showTypes, setShowTypes] = useState(false);
  const [showMovements, setShowMovements] = useState(false);
  const [showStatuses, setShowStatuses] = useState(false);

  // Pre-fill when editing
  useEffect(() => {
    if (existingItem) {
      setSceneNumber(existingItem.sceneNumber.toString());
      setShotNumber(existingItem.shotNumber);
      setType(existingItem.type);
      setMovement(existingItem.movement);
      setLens(existingItem.lens);
      setDescription(existingItem.description);
      setNotes(existingItem.notes || '');
      setStatus(existingItem.status);
    }
  }, [existingItem?.id]);

  const handleSave = useCallback(() => {
    if (!activeProjectId) {
      Alert.alert('No Project', 'Please select a project first.');
      return;
    }
    if (!sceneNumber.trim() || !shotNumber.trim()) {
      Alert.alert('Missing Info', 'Please enter scene and shot numbers.');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const shotData = {
      id: isEditing ? existingItem!.id : Date.now().toString(),
      projectId: activeProjectId,
      sceneNumber: parseInt(sceneNumber, 10) || 1,
      shotNumber: shotNumber.trim(),
      type,
      movement,
      lens: lens.trim() || '50mm',
      description: description.trim(),
      notes: notes.trim(),
      status: isEditing ? status : 'planned' as ShotStatus,
    };

    if (isEditing) {
      updateShot(shotData);
    } else {
      addShot(shotData);
    }
    router.back();
  }, [activeProjectId, sceneNumber, shotNumber, type, movement, lens, description, notes, status, isEditing, existingItem, addShot, updateShot, router]);

  if (!activeProject) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No project selected</Text>
        <Text style={styles.emptySubtitle}>Select a project from the Projects tab first</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: isEditing ? 'Edit Shot' : 'New Shot' }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.projectLabel}>
          <Text style={styles.projectLabelText}>
            {isEditing ? `Editing: Sc.${existingItem!.sceneNumber} / ${existingItem!.shotNumber}` : `Adding to: ${activeProject.title}`}
          </Text>
        </View>

        <View style={styles.row}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Scene #</Text>
            <TextInput style={styles.input} value={sceneNumber} onChangeText={setSceneNumber}
              placeholder="1" placeholderTextColor={Colors.text.tertiary} keyboardType="number-pad" />
          </View>
          <View style={{ width: 12 }} />
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Shot #</Text>
            <TextInput style={styles.input} value={shotNumber} onChangeText={setShotNumber}
              placeholder="1A" placeholderTextColor={Colors.text.tertiary} />
          </View>
          <View style={{ width: 12 }} />
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Lens</Text>
            <TextInput style={styles.input} value={lens} onChangeText={setLens}
              placeholder="50mm" placeholderTextColor={Colors.text.tertiary} />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Shot Type</Text>
          <TouchableOpacity style={styles.selector} onPress={() => setShowTypes(!showTypes)} activeOpacity={0.7}>
            <Text style={styles.selectorText}>{SHOT_TYPES.find(t => t.value === type)?.label}</Text>
            <ChevronDown color={Colors.text.tertiary} size={18} />
          </TouchableOpacity>
          {showTypes && (
            <View style={styles.optionsList}>
              {SHOT_TYPES.map(t => (
                <TouchableOpacity key={t.value} style={[styles.option, type === t.value && styles.optionActive]}
                  onPress={() => { setType(t.value as ShotType); setShowTypes(false); }}>
                  <Text style={[styles.optionText, type === t.value && styles.optionTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Camera Movement</Text>
          <TouchableOpacity style={styles.selector} onPress={() => setShowMovements(!showMovements)} activeOpacity={0.7}>
            <Text style={styles.selectorText}>{SHOT_MOVEMENTS.find(m => m.value === movement)?.label}</Text>
            <ChevronDown color={Colors.text.tertiary} size={18} />
          </TouchableOpacity>
          {showMovements && (
            <View style={styles.optionsList}>
              {SHOT_MOVEMENTS.map(m => (
                <TouchableOpacity key={m.value} style={[styles.option, movement === m.value && styles.optionActive]}
                  onPress={() => { setMovement(m.value as ShotMovement); setShowMovements(false); }}>
                  <Text style={[styles.optionText, movement === m.value && styles.optionTextActive]}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Status selector - only in edit mode */}
        {isEditing && (
          <View style={styles.field}>
            <Text style={styles.label}>Status</Text>
            <TouchableOpacity style={styles.selector} onPress={() => setShowStatuses(!showStatuses)} activeOpacity={0.7}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: STATUS_OPTIONS.find(s => s.value === status)?.color }} />
                <Text style={styles.selectorText}>{STATUS_OPTIONS.find(s => s.value === status)?.label}</Text>
              </View>
              <ChevronDown color={Colors.text.tertiary} size={18} />
            </TouchableOpacity>
            {showStatuses && (
              <View style={styles.optionsList}>
                {STATUS_OPTIONS.map(s => (
                  <TouchableOpacity key={s.value} style={[styles.option, status === s.value && styles.optionActive]}
                    onPress={() => { setStatus(s.value); setShowStatuses(false); }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: s.color }} />
                      <Text style={[styles.optionText, status === s.value && styles.optionTextActive]}>{s.label}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        <View style={styles.field}>
          <Text style={styles.label}>Description</Text>
          <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription}
            placeholder="Describe the shot" placeholderTextColor={Colors.text.tertiary}
            multiline numberOfLines={3} textAlignVertical="top" />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Notes</Text>
          <TextInput style={styles.input} value={notes} onChangeText={setNotes}
            placeholder="Additional notes" placeholderTextColor={Colors.text.tertiary} />
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.8} testID="save-shot-button">
          <Text style={styles.saveButtonText}>{isEditing ? 'Save Changes' : 'Add Shot'}</Text>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
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
  textArea: { minHeight: 80, paddingTop: 14 },
  selector: { backgroundColor: Colors.bg.input, borderRadius: 10, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 0.5, borderColor: Colors.border.subtle },
  selectorText: { fontSize: 16, color: Colors.text.primary },
  optionsList: { backgroundColor: Colors.bg.elevated, borderRadius: 10, marginTop: 8, borderWidth: 0.5, borderColor: Colors.border.subtle, overflow: 'hidden' },
  option: { padding: 12, borderBottomWidth: 0.5, borderBottomColor: Colors.border.subtle },
  optionActive: { backgroundColor: Colors.accent.goldBg },
  optionText: { fontSize: 14, color: Colors.text.secondary },
  optionTextActive: { color: Colors.accent.gold, fontWeight: '600' as const },
  saveButton: { backgroundColor: Colors.accent.gold, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 12 },
  saveButtonText: { fontSize: 16, fontWeight: '700' as const, color: Colors.text.inverse },
  emptyContainer: { flex: 1, backgroundColor: Colors.bg.primary, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600' as const, color: Colors.text.primary },
  emptySubtitle: { fontSize: 14, color: Colors.text.secondary, marginTop: 4 },
});
