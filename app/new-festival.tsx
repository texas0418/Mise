import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronDown } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useProjects, useProjectFestivals } from '@/contexts/ProjectContext';
import Colors from '@/constants/colors';
import { FestivalStatus } from '@/types';

const STATUS_OPTIONS: { label: string; value: FestivalStatus }[] = [
  { label: 'Researching', value: 'researching' },
  { label: 'Submitted', value: 'submitted' },
  { label: 'Accepted', value: 'accepted' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Screening', value: 'screening' },
  { label: 'Awarded', value: 'awarded' },
];

export default function NewFestivalScreen() {
  const router = useRouter();
  const { addFestival, updateFestival, activeProjectId, activeProject } = useProjects();
  const festivals = useProjectFestivals(activeProjectId);
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id;
  const existingItem = editId ? festivals.find(f => f.id === editId) : null;
  const isEditing = !!existingItem;

  const [festivalName, setFestivalName] = useState('');
  const [location, setLocation] = useState('');
  const [deadline, setDeadline] = useState('');
  const [fee, setFee] = useState('');
  const [status, setStatus] = useState<FestivalStatus>('researching');
  const [category, setCategory] = useState('');
  const [platformUrl, setPlatformUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [showStatus, setShowStatus] = useState(false);

  useEffect(() => {
    if (existingItem) {
      setFestivalName(existingItem.festivalName);
      setLocation(existingItem.location || '');
      setDeadline(existingItem.deadline || '');
      setFee(existingItem.fee.toString());
      setStatus(existingItem.status);
      setCategory(existingItem.category || '');
      setPlatformUrl(existingItem.platformUrl || '');
      setNotes(existingItem.notes || '');
    }
  }, [existingItem?.id]);

  const handleSave = useCallback(() => {
    if (!activeProjectId) { Alert.alert('No Project', 'Select a project first.'); return; }
    if (!festivalName.trim()) { Alert.alert('Missing Info', 'Enter the festival name.'); return; }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const data = {
      id: isEditing ? existingItem!.id : Date.now().toString(),
      projectId: activeProjectId,
      festivalName: festivalName.trim(),
      location: location.trim(),
      deadline: deadline.trim(),
      submissionDate: isEditing ? existingItem!.submissionDate : '',
      fee: parseFloat(fee) || 0,
      status,
      category: category.trim(),
      platformUrl: platformUrl.trim(),
      notes: notes.trim(),
      notificationDate: isEditing ? existingItem!.notificationDate : '',
    };

    if (isEditing) { updateFestival(data); } else { addFestival(data); }
    router.back();
  }, [activeProjectId, festivalName, location, deadline, fee, status, category, platformUrl, notes, isEditing, existingItem, addFestival, updateFestival, router]);

  if (!activeProject) { return (<View style={styles.emptyContainer}><Text style={styles.emptyTitle}>No project selected</Text></View>); }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: isEditing ? 'Edit Festival' : 'New Festival' }} />
      <View style={styles.projectLabel}>
        <Text style={styles.projectLabelText}>{isEditing ? `Editing: ${existingItem!.festivalName}` : `Festival for: ${activeProject.title}`}</Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Festival Name</Text>
        <TextInput style={styles.input} value={festivalName} onChangeText={setFestivalName} placeholder="e.g. Sundance Film Festival" placeholderTextColor={Colors.text.tertiary} />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Location</Text>
        <TextInput style={styles.input} value={location} onChangeText={setLocation} placeholder="City, State/Country" placeholderTextColor={Colors.text.tertiary} />
      </View>
      <View style={styles.row}>
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.label}>Deadline</Text>
          <TextInput style={styles.input} value={deadline} onChangeText={setDeadline} placeholder="YYYY-MM-DD" placeholderTextColor={Colors.text.tertiary} />
        </View>
        <View style={{ width: 12 }} />
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.label}>Fee ($)</Text>
          <TextInput style={styles.input} value={fee} onChangeText={setFee} placeholder="0" placeholderTextColor={Colors.text.tertiary} keyboardType="decimal-pad" />
        </View>
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Status</Text>
        <TouchableOpacity style={styles.selector} onPress={() => setShowStatus(!showStatus)}>
          <Text style={styles.selectorText}>{STATUS_OPTIONS.find(s => s.value === status)?.label}</Text>
          <ChevronDown color={Colors.text.tertiary} size={18} />
        </TouchableOpacity>
        {showStatus && (
          <View style={styles.optionsList}>
            {STATUS_OPTIONS.map(s => (
              <TouchableOpacity key={s.value} style={[styles.option, status === s.value && styles.optionActive]}
                onPress={() => { setStatus(s.value); setShowStatus(false); }}>
                <Text style={[styles.optionText, status === s.value && styles.optionTextActive]}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Category</Text>
        <TextInput style={styles.input} value={category} onChangeText={setCategory} placeholder="e.g. Narrative Short, Documentary" placeholderTextColor={Colors.text.tertiary} />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Submission URL</Text>
        <TextInput style={styles.input} value={platformUrl} onChangeText={setPlatformUrl} placeholder="FilmFreeway / Withoutabox link" placeholderTextColor={Colors.text.tertiary} autoCapitalize="none" keyboardType="url" />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Notes</Text>
        <TextInput style={[styles.input, styles.textArea]} value={notes} onChangeText={setNotes} placeholder="Premiere requirements, tips, contacts..." placeholderTextColor={Colors.text.tertiary} multiline numberOfLines={3} textAlignVertical="top" />
      </View>
      <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.8}>
        <Text style={styles.saveButtonText}>{isEditing ? 'Save Changes' : 'Add Festival'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary }, content: { padding: 20, paddingBottom: 40 },
  projectLabel: { backgroundColor: Colors.accent.goldBg, borderRadius: 8, padding: 10, marginBottom: 20 },
  projectLabelText: { fontSize: 13, color: Colors.accent.gold, fontWeight: '600' as const },
  row: { flexDirection: 'row' }, field: { marginBottom: 20 },
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
