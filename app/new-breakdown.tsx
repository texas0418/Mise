import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { ChevronDown } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useProjects, useProjectBreakdowns } from '@/contexts/ProjectContext';
import Colors from '@/constants/colors';
import { SceneIntExt, SceneTimeOfDay } from '@/types';

const INT_EXT_OPTIONS: { label: string; value: SceneIntExt }[] = [
  { label: 'INT', value: 'INT' },
  { label: 'EXT', value: 'EXT' },
  { label: 'INT/EXT', value: 'INT/EXT' },
];

const TIME_OPTIONS: { label: string; value: SceneTimeOfDay }[] = [
  { label: 'Day', value: 'day' },
  { label: 'Night', value: 'night' },
  { label: 'Dawn', value: 'dawn' },
  { label: 'Dusk', value: 'dusk' },
  { label: 'Magic Hour', value: 'magic-hour' },
];

export default function NewBreakdownScreen() {
  const router = useRouter();
  const { addBreakdown, updateBreakdown, activeProjectId, activeProject } = useProjects();
  const breakdowns = useProjectBreakdowns(activeProjectId);
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id;
  const existingItem = editId ? breakdowns.find(b => b.id === editId) : null;
  const isEditing = !!existingItem;

  const [sceneNumber, setSceneNumber] = useState('');
  const [sceneName, setSceneName] = useState('');
  const [intExt, setIntExt] = useState<SceneIntExt>('INT');
  const [timeOfDay, setTimeOfDay] = useState<SceneTimeOfDay>('day');
  const [location, setLocation] = useState('');
  const [cast, setCast] = useState('');
  const [extras, setExtras] = useState('');
  const [props, setProps] = useState('');
  const [wardrobe, setWardrobe] = useState('');
  const [specialEquipment, setSpecialEquipment] = useState('');
  const [notes, setNotes] = useState('');
  const [pageCount, setPageCount] = useState('');
  const [showIntExt, setShowIntExt] = useState(false);
  const [showTime, setShowTime] = useState(false);

  // Pre-fill form when editing
  useEffect(() => {
    if (existingItem) {
      setSceneNumber(existingItem.sceneNumber.toString());
      setSceneName(existingItem.sceneName);
      setIntExt(existingItem.intExt);
      setTimeOfDay(existingItem.timeOfDay);
      setLocation(existingItem.location);
      setCast(existingItem.cast.join(', '));
      setExtras(existingItem.extras);
      setProps(existingItem.props.join(', '));
      setWardrobe(existingItem.wardrobe.join(', '));
      setSpecialEquipment(existingItem.specialEquipment.join(', '));
      setNotes(existingItem.notes);
      setPageCount(existingItem.pageCount);
    }
  }, [existingItem?.id]);

  const handleSave = useCallback(() => {
    if (!activeProjectId) {
      Alert.alert('No Project', 'Select a project first.');
      return;
    }
    if (!sceneNumber.trim() || !sceneName.trim()) {
      Alert.alert('Missing Info', 'Enter scene number and name.');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const data = {
      id: isEditing ? existingItem!.id : Date.now().toString(),
      projectId: activeProjectId,
      sceneNumber: parseInt(sceneNumber, 10) || 1,
      sceneName: sceneName.trim(),
      intExt,
      timeOfDay,
      location: location.trim(),
      cast: cast.trim() ? cast.split(',').map(s => s.trim()) : [],
      extras: extras.trim(),
      props: props.trim() ? props.split(',').map(s => s.trim()) : [],
      wardrobe: wardrobe.trim() ? wardrobe.split(',').map(s => s.trim()) : [],
      specialEquipment: specialEquipment.trim() ? specialEquipment.split(',').map(s => s.trim()) : [],
      notes: notes.trim(),
      pageCount: pageCount.trim() || '1',
    };

    if (isEditing) {
      updateBreakdown(data);
    } else {
      addBreakdown(data);
    }
    router.back();
  }, [activeProjectId, sceneNumber, sceneName, intExt, timeOfDay, location, cast, extras, props, wardrobe, specialEquipment, notes, pageCount, addBreakdown, updateBreakdown, router, isEditing, existingItem]);

  if (!activeProject) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No project selected</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: isEditing ? 'Edit Breakdown' : 'New Breakdown' }} />

      <View style={styles.projectLabel}>
        <Text style={styles.projectLabelText}>
          {isEditing ? `Editing: Sc. ${existingItem!.sceneNumber} — ${existingItem!.sceneName}` : `Breaking down: ${activeProject.title}`}
        </Text>
      </View>

      <View style={styles.row}>
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.label}>Scene #</Text>
          <TextInput style={styles.input} value={sceneNumber} onChangeText={setSceneNumber}
            placeholder="1" placeholderTextColor={Colors.text.tertiary} keyboardType="number-pad" />
        </View>
        <View style={{ width: 12 }} />
        <View style={[styles.field, { flex: 2 }]}>
          <Text style={styles.label}>Scene Name</Text>
          <TextInput style={styles.input} value={sceneName} onChangeText={setSceneName}
            placeholder="The Opening" placeholderTextColor={Colors.text.tertiary} />
        </View>
      </View>

      <View style={styles.row}>
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.label}>Int/Ext</Text>
          <TouchableOpacity style={styles.selector} onPress={() => setShowIntExt(!showIntExt)}>
            <Text style={styles.selectorText}>{intExt}</Text>
            <ChevronDown color={Colors.text.tertiary} size={18} />
          </TouchableOpacity>
          {showIntExt && (
            <View style={styles.optionsList}>
              {INT_EXT_OPTIONS.map(o => (
                <TouchableOpacity key={o.value}
                  style={[styles.option, intExt === o.value && styles.optionActive]}
                  onPress={() => { setIntExt(o.value); setShowIntExt(false); }}>
                  <Text style={[styles.optionText, intExt === o.value && styles.optionTextActive]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
        <View style={{ width: 12 }} />
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.label}>Time of Day</Text>
          <TouchableOpacity style={styles.selector} onPress={() => setShowTime(!showTime)}>
            <Text style={styles.selectorText}>{TIME_OPTIONS.find(t => t.value === timeOfDay)?.label}</Text>
            <ChevronDown color={Colors.text.tertiary} size={18} />
          </TouchableOpacity>
          {showTime && (
            <View style={styles.optionsList}>
              {TIME_OPTIONS.map(o => (
                <TouchableOpacity key={o.value}
                  style={[styles.option, timeOfDay === o.value && styles.optionActive]}
                  onPress={() => { setTimeOfDay(o.value); setShowTime(false); }}>
                  <Text style={[styles.optionText, timeOfDay === o.value && styles.optionTextActive]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Location</Text>
        <TextInput style={styles.input} value={location} onChangeText={setLocation}
          placeholder="Where is this scene set?" placeholderTextColor={Colors.text.tertiary} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Cast (comma separated)</Text>
        <TextInput style={styles.input} value={cast} onChangeText={setCast}
          placeholder="Actor 1, Actor 2" placeholderTextColor={Colors.text.tertiary} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Extras</Text>
        <TextInput style={styles.input} value={extras} onChangeText={setExtras}
          placeholder="Background actors description" placeholderTextColor={Colors.text.tertiary} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Props (comma separated)</Text>
        <TextInput style={styles.input} value={props} onChangeText={setProps}
          placeholder="Lantern, Journal" placeholderTextColor={Colors.text.tertiary} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Wardrobe (comma separated)</Text>
        <TextInput style={styles.input} value={wardrobe} onChangeText={setWardrobe}
          placeholder="Overcoat, Scarf" placeholderTextColor={Colors.text.tertiary} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Special Equipment (comma separated)</Text>
        <TextInput style={styles.input} value={specialEquipment} onChangeText={setSpecialEquipment}
          placeholder="Crane, Wind machine" placeholderTextColor={Colors.text.tertiary} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Page Count</Text>
        <TextInput style={styles.input} value={pageCount} onChangeText={setPageCount}
          placeholder="2 3/8" placeholderTextColor={Colors.text.tertiary} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Notes</Text>
        <TextInput style={[styles.input, styles.textArea]} value={notes} onChangeText={setNotes}
          placeholder="Additional breakdown notes" placeholderTextColor={Colors.text.tertiary}
          multiline numberOfLines={3} textAlignVertical="top" />
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.8}>
        <Text style={styles.saveButtonText}>{isEditing ? 'Save Changes' : 'Add Scene Breakdown'}</Text>
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
