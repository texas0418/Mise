import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Image } from 'expo-image';
import { ChevronDown, ImagePlus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useProjects, useProjectMoodBoard } from '@/contexts/ProjectContext';
import { showImagePickerOptions } from '@/utils/imagePicker';
import Colors from '@/constants/colors';
import { MoodBoardItemType } from '@/types';

const TYPE_OPTIONS: { label: string; value: MoodBoardItemType }[] = [
  { label: 'Color Swatch', value: 'color' },
  { label: 'Image Reference', value: 'reference' },
  { label: 'Note', value: 'note' },
];

export default function NewMoodItemScreen() {
  const router = useRouter();
  const { addMoodBoardItem, updateMoodBoardItem, activeProjectId, activeProject } = useProjects();
  const moodItems = useProjectMoodBoard(activeProjectId);
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id;
  const existingItem = editId ? moodItems.find(m => m.id === editId) : null;
  const isEditing = !!existingItem;

  const [boardName, setBoardName] = useState('Visual Tone');
  const [type, setType] = useState<MoodBoardItemType>('reference');
  const [label, setLabel] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [color, setColor] = useState('#');
  const [note, setNote] = useState('');
  const [showType, setShowType] = useState(false);

  // Pre-fill form when editing
  useEffect(() => {
    if (existingItem) {
      setBoardName(existingItem.boardName);
      setType(existingItem.type);
      setLabel(existingItem.label);
      setImageUrl(existingItem.imageUrl || '');
      setColor(existingItem.color || '#');
      setNote(existingItem.note || '');
    }
  }, [existingItem?.id]);

  const handleSave = useCallback(() => {
    if (!activeProjectId) {
      Alert.alert('No Project', 'Select a project first.');
      return;
    }
    if (!label.trim()) {
      Alert.alert('Missing Label', 'Enter a label for this item.');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const data = {
      id: isEditing ? existingItem!.id : Date.now().toString(),
      projectId: activeProjectId,
      boardName: boardName.trim() || 'Visual Tone',
      type,
      label: label.trim(),
      imageUrl: type === 'reference' ? imageUrl.trim() : undefined,
      color: type === 'color' ? color.trim() : undefined,
      note: type === 'note' ? note.trim() : undefined,
    };

    if (isEditing) {
      updateMoodBoardItem(data);
    } else {
      addMoodBoardItem(data);
    }
    router.back();
  }, [activeProjectId, boardName, type, label, imageUrl, color, note, addMoodBoardItem, updateMoodBoardItem, router, isEditing, existingItem]);

  if (!activeProject) {
    return (<View style={styles.emptyContainer}><Text style={styles.emptyTitle}>No project selected</Text></View>);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: isEditing ? 'Edit Mood Board Item' : 'New Mood Board Item' }} />

      <View style={styles.projectLabel}>
        <Text style={styles.projectLabelText}>
          {isEditing ? `Editing: ${existingItem!.label}` : `Mood board for: ${activeProject.title}`}
        </Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Board Name</Text>
        <TextInput style={styles.input} value={boardName} onChangeText={setBoardName}
          placeholder="Visual Tone" placeholderTextColor={Colors.text.tertiary} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Item Type</Text>
        <TouchableOpacity style={styles.selector} onPress={() => setShowType(!showType)}>
          <Text style={styles.selectorText}>{TYPE_OPTIONS.find(t => t.value === type)?.label}</Text>
          <ChevronDown color={Colors.text.tertiary} size={18} />
        </TouchableOpacity>
        {showType && (
          <View style={styles.optionsList}>
            {TYPE_OPTIONS.map(t => (
              <TouchableOpacity key={t.value}
                style={[styles.option, type === t.value && styles.optionActive]}
                onPress={() => { setType(t.value); setShowType(false); }}>
                <Text style={[styles.optionText, type === t.value && styles.optionTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Label</Text>
        <TextInput style={styles.input} value={label} onChangeText={setLabel}
          placeholder="Name this item" placeholderTextColor={Colors.text.tertiary} />
      </View>

      {type === 'reference' && (
        <View style={styles.field}>
          <Text style={styles.label}>Image</Text>
          {imageUrl ? (
            <View style={styles.imagePreviewWrap}>
              <Image source={{ uri: imageUrl }} style={styles.imagePreview} contentFit="cover" />
              <TouchableOpacity style={styles.changePhotoBtn} onPress={() => {
                showImagePickerOptions((uri) => setImageUrl(uri));
              }}>
                <Text style={styles.changePhotoText}>Change Photo</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.pickImageBtn} onPress={() => {
              showImagePickerOptions((uri) => setImageUrl(uri));
            }}>
              <ImagePlus color={Colors.accent.gold} size={28} />
              <Text style={styles.pickImageText}>Choose from Library or Camera</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.orText}>or paste a URL:</Text>
          <TextInput style={styles.input} value={imageUrl} onChangeText={setImageUrl}
            placeholder="https://..." placeholderTextColor={Colors.text.tertiary}
            autoCapitalize="none" keyboardType="url" />
        </View>
      )}

      {type === 'color' && (
        <View style={styles.field}>
          <Text style={styles.label}>Color (hex)</Text>
          <View style={styles.colorRow}>
            <TextInput style={[styles.input, { flex: 1 }]} value={color} onChangeText={setColor}
              placeholder="#C8A04A" placeholderTextColor={Colors.text.tertiary} autoCapitalize="none" />
            <View style={[styles.colorPreview, { backgroundColor: color.startsWith('#') && color.length >= 4 ? color : '#333' }]} />
          </View>
        </View>
      )}

      {type === 'note' && (
        <View style={styles.field}>
          <Text style={styles.label}>Note</Text>
          <TextInput style={[styles.input, styles.textArea]} value={note} onChangeText={setNote}
            placeholder="Describe the visual direction..." placeholderTextColor={Colors.text.tertiary}
            multiline numberOfLines={5} textAlignVertical="top" />
        </View>
      )}

      <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.8}>
        <Text style={styles.saveButtonText}>{isEditing ? 'Save Changes' : 'Add to Mood Board'}</Text>
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
  textArea: { minHeight: 120, paddingTop: 14 },
  colorRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  colorPreview: { width: 48, height: 48, borderRadius: 10, borderWidth: 1, borderColor: Colors.border.medium },
  selector: { backgroundColor: Colors.bg.input, borderRadius: 10, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 0.5, borderColor: Colors.border.subtle },
  selectorText: { fontSize: 16, color: Colors.text.primary },
  optionsList: { backgroundColor: Colors.bg.elevated, borderRadius: 10, marginTop: 8, borderWidth: 0.5, borderColor: Colors.border.subtle, overflow: 'hidden' },
  option: { padding: 12, borderBottomWidth: 0.5, borderBottomColor: Colors.border.subtle },
  optionActive: { backgroundColor: Colors.accent.goldBg },
  optionText: { fontSize: 14, color: Colors.text.secondary },
  optionTextActive: { color: Colors.accent.gold, fontWeight: '600' as const },
  saveButton: { backgroundColor: Colors.accent.gold, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 12 },
  saveButtonText: { fontSize: 16, fontWeight: '700' as const, color: Colors.text.inverse },
  pickImageBtn: { backgroundColor: Colors.bg.elevated, borderRadius: 12, borderWidth: 1, borderColor: Colors.border.subtle, borderStyle: 'dashed', padding: 24, alignItems: 'center', gap: 8 },
  pickImageText: { fontSize: 13, color: Colors.accent.gold, fontWeight: '600' as const },
  imagePreviewWrap: { borderRadius: 12, overflow: 'hidden', marginBottom: 8 },
  imagePreview: { width: '100%', height: 180, borderRadius: 12 },
  changePhotoBtn: { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  changePhotoText: { fontSize: 12, color: '#fff', fontWeight: '600' as const },
  orText: { fontSize: 11, color: Colors.text.tertiary, marginTop: 10, marginBottom: 6 },
  emptyContainer: { flex: 1, backgroundColor: Colors.bg.primary, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600' as const, color: Colors.text.primary },
});
