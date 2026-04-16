import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Switch } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronDown } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useProjects, useProjectNotes } from '@/contexts/ProjectContext';
import Colors from '@/constants/colors';
import { NoteCategory } from '@/types';

const CATEGORY_OPTIONS: { label: string; value: NoteCategory }[] = [
  { label: 'General', value: 'general' },
  { label: 'Creative', value: 'creative' },
  { label: 'Technical', value: 'technical' },
  { label: 'Logistics', value: 'logistics' },
  { label: 'Feedback', value: 'feedback' },
  { label: 'Revision', value: 'revision' },
];

export default function NewNoteScreen() {
  const router = useRouter();
  const { addNote, updateNote, activeProjectId, activeProject } = useProjects();
  const notes = useProjectNotes(activeProjectId);
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id;
  const existingItem = editId ? notes.find(n => n.id === editId) : null;
  const isEditing = !!existingItem;

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<NoteCategory>('general');
  const [pinned, setPinned] = useState(false);
  const [showCategories, setShowCategories] = useState(false);

  // Pre-fill when editing
  useEffect(() => {
    if (existingItem) {
      setTitle(existingItem.title);
      setContent(existingItem.content || '');
      setCategory(existingItem.category);
      setPinned(existingItem.pinned);
    }
  }, [existingItem?.id]);

  const handleSave = useCallback(() => {
    if (!activeProjectId) {
      Alert.alert('No Project', 'Select a project first.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Enter a note title.');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const now = new Date().toISOString();
    const data = {
      id: isEditing ? existingItem!.id : Date.now().toString(),
      projectId: activeProjectId,
      title: title.trim(),
      content: content.trim(),
      category,
      createdAt: isEditing ? existingItem!.createdAt : now,
      updatedAt: now,
      pinned,
    };

    if (isEditing) {
      updateNote(data);
    } else {
      addNote(data);
    }
    router.back();
  }, [activeProjectId, title, content, category, pinned, isEditing, existingItem, addNote, updateNote, router]);

  if (!activeProject) {
    return (<View style={styles.emptyContainer}><Text style={styles.emptyTitle}>No project selected</Text></View>);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: isEditing ? 'Edit Note' : 'New Note' }} />

      <View style={styles.projectLabel}>
        <Text style={styles.projectLabelText}>
          {isEditing ? `Editing: ${existingItem!.title}` : `Note for: ${activeProject.title}`}
        </Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Title</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle}
          placeholder="Note title" placeholderTextColor={Colors.text.tertiary} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Category</Text>
        <TouchableOpacity style={styles.selector} onPress={() => setShowCategories(!showCategories)}>
          <Text style={styles.selectorText}>{CATEGORY_OPTIONS.find(c => c.value === category)?.label}</Text>
          <ChevronDown color={Colors.text.tertiary} size={18} />
        </TouchableOpacity>
        {showCategories && (
          <View style={styles.optionsList}>
            {CATEGORY_OPTIONS.map(c => (
              <TouchableOpacity key={c.value}
                style={[styles.option, category === c.value && styles.optionActive]}
                onPress={() => { setCategory(c.value); setShowCategories(false); }}>
                <Text style={[styles.optionText, category === c.value && styles.optionTextActive]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Pin Note</Text>
        <Switch value={pinned} onValueChange={setPinned}
          trackColor={{ true: Colors.accent.gold, false: Colors.bg.elevated }}
          thumbColor={Colors.text.primary} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Content</Text>
        <TextInput style={[styles.input, styles.textArea]} value={content} onChangeText={setContent}
          placeholder="Write your note here..." placeholderTextColor={Colors.text.tertiary}
          multiline numberOfLines={8} textAlignVertical="top" />
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.8}>
        <Text style={styles.saveButtonText}>{isEditing ? 'Save Changes' : 'Save Note'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  content: { padding: 20, paddingBottom: 40 },
  projectLabel: { backgroundColor: Colors.accent.goldBg, borderRadius: 8, padding: 10, marginBottom: 20 },
  projectLabelText: { fontSize: 13, color: Colors.accent.gold, fontWeight: '600' as const },
  field: { marginBottom: 20 },
  label: { fontSize: 12, fontWeight: '600' as const, color: Colors.text.secondary, textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 8 },
  input: { backgroundColor: Colors.bg.input, borderRadius: 10, padding: 14, fontSize: 16, color: Colors.text.primary, borderWidth: 0.5, borderColor: Colors.border.subtle },
  textArea: { minHeight: 180, paddingTop: 14 },
  selector: { backgroundColor: Colors.bg.input, borderRadius: 10, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 0.5, borderColor: Colors.border.subtle },
  selectorText: { fontSize: 16, color: Colors.text.primary },
  optionsList: { backgroundColor: Colors.bg.elevated, borderRadius: 10, marginTop: 8, borderWidth: 0.5, borderColor: Colors.border.subtle, overflow: 'hidden' },
  option: { padding: 12, borderBottomWidth: 0.5, borderBottomColor: Colors.border.subtle },
  optionActive: { backgroundColor: Colors.accent.goldBg },
  optionText: { fontSize: 14, color: Colors.text.secondary },
  optionTextActive: { color: Colors.accent.gold, fontWeight: '600' as const },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.bg.card, borderRadius: 10, padding: 14, marginBottom: 20, borderWidth: 0.5, borderColor: Colors.border.subtle },
  switchLabel: { fontSize: 14, color: Colors.text.primary, fontWeight: '500' as const },
  saveButton: { backgroundColor: Colors.accent.gold, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 12 },
  saveButtonText: { fontSize: 16, fontWeight: '700' as const, color: Colors.text.inverse },
  emptyContainer: { flex: 1, backgroundColor: Colors.bg.primary, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600' as const, color: Colors.text.primary },
});
