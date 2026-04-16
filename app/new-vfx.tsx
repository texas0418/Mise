import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronDown } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useProjects, useProjectVFX } from '@/contexts/ProjectContext';
import Colors from '@/constants/colors';
import { VFXComplexity, VFXShotStatus } from '@/types';

const COMPLEXITY_OPTIONS: { label: string; value: VFXComplexity }[] = [
  { label: 'Simple', value: 'simple' },
  { label: 'Moderate', value: 'moderate' },
  { label: 'Complex', value: 'complex' },
  { label: 'Hero Shot', value: 'hero' },
];

const STATUS_OPTIONS: { label: string; value: VFXShotStatus }[] = [
  { label: 'Pending', value: 'pending' },
  { label: 'In Progress', value: 'in-progress' },
  { label: 'Review', value: 'review' },
  { label: 'Approved', value: 'approved' },
  { label: 'Final', value: 'final' },
];

export default function NewVFXScreen() {
  const router = useRouter();
  const { addVFXShot, updateVFXShot, activeProjectId, activeProject } = useProjects();
  const vfxShots = useProjectVFX(activeProjectId);
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id;
  const existingItem = editId ? vfxShots.find(v => v.id === editId) : null;
  const isEditing = !!existingItem;

  const [sceneNumber, setSceneNumber] = useState('');
  const [shotNumber, setShotNumber] = useState('');
  const [description, setDescription] = useState('');
  const [complexity, setComplexity] = useState<VFXComplexity>('moderate');
  const [status, setStatus] = useState<VFXShotStatus>('pending');
  const [vendor, setVendor] = useState('');
  const [deadline, setDeadline] = useState('');
  const [notes, setNotes] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [showComplexity, setShowComplexity] = useState(false);
  const [showStatus, setShowStatus] = useState(false);

  // Pre-fill when editing
  useEffect(() => {
    if (existingItem) {
      setSceneNumber(existingItem.sceneNumber.toString());
      setShotNumber(existingItem.shotNumber);
      setDescription(existingItem.description);
      setComplexity(existingItem.complexity);
      setStatus(existingItem.status);
      setVendor(existingItem.vendor || '');
      setDeadline(existingItem.deadline || '');
      setNotes(existingItem.notes || '');
      setEstimatedCost(existingItem.estimatedCost.toString());
    }
  }, [existingItem?.id]);

  const handleSave = useCallback(() => {
    if (!activeProjectId) {
      Alert.alert('No Project', 'Select a project first.');
      return;
    }
    if (!sceneNumber.trim() || !description.trim()) {
      Alert.alert('Missing Info', 'Enter scene number and description.');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const data = {
      id: isEditing ? existingItem!.id : Date.now().toString(),
      projectId: activeProjectId,
      sceneNumber: parseInt(sceneNumber, 10) || 1,
      shotNumber: shotNumber.trim() || '1A',
      description: description.trim(),
      complexity,
      status: isEditing ? status : 'pending' as VFXShotStatus,
      vendor: vendor.trim(),
      deadline: deadline.trim(),
      notes: notes.trim(),
      estimatedCost: parseFloat(estimatedCost) || 0,
    };

    if (isEditing) {
      updateVFXShot(data);
    } else {
      addVFXShot(data);
    }
    router.back();
  }, [activeProjectId, sceneNumber, shotNumber, description, complexity, status, vendor, deadline, notes, estimatedCost, isEditing, existingItem, addVFXShot, updateVFXShot, router]);

  if (!activeProject) {
    return (<View style={styles.emptyContainer}><Text style={styles.emptyTitle}>No project selected</Text></View>);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: isEditing ? 'Edit VFX Shot' : 'New VFX Shot' }} />

      <View style={styles.projectLabel}>
        <Text style={styles.projectLabelText}>
          {isEditing ? `Editing: Sc.${existingItem!.sceneNumber}/${existingItem!.shotNumber}` : `VFX for: ${activeProject.title}`}
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
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Description</Text>
        <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription}
          placeholder="Describe the VFX work needed" placeholderTextColor={Colors.text.tertiary}
          multiline numberOfLines={3} textAlignVertical="top" />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Complexity</Text>
        <TouchableOpacity style={styles.selector} onPress={() => { setShowComplexity(!showComplexity); setShowStatus(false); }}>
          <Text style={styles.selectorText}>{COMPLEXITY_OPTIONS.find(c => c.value === complexity)?.label}</Text>
          <ChevronDown color={Colors.text.tertiary} size={18} />
        </TouchableOpacity>
        {showComplexity && (
          <View style={styles.optionsList}>
            {COMPLEXITY_OPTIONS.map(c => (
              <TouchableOpacity key={c.value}
                style={[styles.option, complexity === c.value && styles.optionActive]}
                onPress={() => { setComplexity(c.value); setShowComplexity(false); }}>
                <Text style={[styles.optionText, complexity === c.value && styles.optionTextActive]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Status selector — only in edit mode */}
      {isEditing && (
        <View style={styles.field}>
          <Text style={styles.label}>Status</Text>
          <TouchableOpacity style={styles.selector} onPress={() => { setShowStatus(!showStatus); setShowComplexity(false); }}>
            <Text style={styles.selectorText}>{STATUS_OPTIONS.find(s => s.value === status)?.label}</Text>
            <ChevronDown color={Colors.text.tertiary} size={18} />
          </TouchableOpacity>
          {showStatus && (
            <View style={styles.optionsList}>
              {STATUS_OPTIONS.map(s => (
                <TouchableOpacity key={s.value}
                  style={[styles.option, status === s.value && styles.optionActive]}
                  onPress={() => { setStatus(s.value); setShowStatus(false); }}>
                  <Text style={[styles.optionText, status === s.value && styles.optionTextActive]}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      <View style={styles.field}>
        <Text style={styles.label}>Vendor</Text>
        <TextInput style={styles.input} value={vendor} onChangeText={setVendor}
          placeholder="VFX vendor name" placeholderTextColor={Colors.text.tertiary} />
      </View>

      <View style={styles.row}>
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.label}>Deadline</Text>
          <TextInput style={styles.input} value={deadline} onChangeText={setDeadline}
            placeholder="YYYY-MM-DD" placeholderTextColor={Colors.text.tertiary} />
        </View>
        <View style={{ width: 12 }} />
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.label}>Est. Cost ($)</Text>
          <TextInput style={styles.input} value={estimatedCost} onChangeText={setEstimatedCost}
            placeholder="0" placeholderTextColor={Colors.text.tertiary} keyboardType="decimal-pad" />
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Notes</Text>
        <TextInput style={styles.input} value={notes} onChangeText={setNotes}
          placeholder="Reference notes, style guidance..." placeholderTextColor={Colors.text.tertiary} />
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.8}>
        <Text style={styles.saveButtonText}>{isEditing ? 'Save Changes' : 'Add VFX Shot'}</Text>
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
});
