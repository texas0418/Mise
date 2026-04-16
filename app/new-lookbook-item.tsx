import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Image } from 'expo-image';
import { Camera } from 'lucide-react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { useProjects, useProjectLookbook } from '@/contexts/ProjectContext';
import { useLayout } from '@/utils/useLayout';
import { pickImage } from '@/utils/imagePicker';
import Colors from '@/constants/colors';
import { LookbookItem, LookbookSectionType } from '@/types';

const SECTION_OPTIONS: { value: LookbookSectionType; label: string }[] = [
  { value: 'tone', label: 'Tone & Mood' },
  { value: 'visual-style', label: 'Visual Style' },
  { value: 'color-palette', label: 'Color Palette' },
  { value: 'shot-style', label: 'Shot Style' },
  { value: 'reference-film', label: 'Reference Film' },
  { value: 'character-look', label: 'Character Look' },
  { value: 'world-building', label: 'World Building' },
  { value: 'sound-music', label: 'Sound & Music' },
  { value: 'custom', label: 'Custom' },
];

export default function NewLookbookItemScreen() {
  const { activeProjectId, addLookbookItem, updateLookbookItem } = useProjects();
  const existingItems = useProjectLookbook(activeProjectId);
  const router = useRouter();
  const { isTablet, contentPadding } = useLayout();
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id;
  const existingItem = editId ? existingItems.find(i => i.id === editId) : null;
  const isEditing = !!existingItem;

  const [section, setSection] = useState<LookbookSectionType>('tone');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined);
  const [referenceFilm, setReferenceFilm] = useState('');
  const [colorHex, setColorHex] = useState('');

  // Pre-fill form when editing
  useEffect(() => {
    if (existingItem) {
      setSection(existingItem.section);
      setTitle(existingItem.title);
      setDescription(existingItem.description);
      setImageUrl(existingItem.imageUrl);
      setReferenceFilm(existingItem.referenceFilm || '');
      setColorHex(existingItem.colorHex || '');
    }
  }, [existingItem?.id]);

  const handlePickImage = async () => {
    const result = await pickImage();
    if (result) setImageUrl(result);
  };

  const handleSave = () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Title is required.');
      return;
    }

    const itemData: LookbookItem = {
      id: isEditing ? existingItem!.id : Date.now().toString(),
      projectId: activeProjectId || '1',
      section,
      title: title.trim(),
      description: description.trim(),
      imageUrl,
      referenceFilm: referenceFilm.trim() || undefined,
      colorHex: colorHex.trim() || undefined,
      sortOrder: isEditing ? existingItem!.sortOrder : existingItems.length,
      createdAt: isEditing ? existingItem!.createdAt : new Date().toISOString(),
    };

    if (isEditing) {
      updateLookbookItem(itemData);
    } else {
      addLookbookItem(itemData);
    }
    router.back();
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: isEditing ? 'Edit Lookbook Item' : 'New Lookbook Item' }} />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, {
          paddingHorizontal: contentPadding,
          maxWidth: isTablet ? 700 : undefined,
          alignSelf: isTablet ? 'center' as const : undefined,
          width: isTablet ? '100%' : undefined,
        }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Section</Text>
        <View style={styles.optionsGrid}>
          {SECTION_OPTIONS.map(opt => (
            <TouchableOpacity key={opt.value}
              style={[styles.optionChip, section === opt.value && styles.optionChipActive]}
              onPress={() => setSection(opt.value)}>
              <Text style={[styles.optionChipText, section === opt.value && styles.optionChipTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Content</Text>

        <Text style={styles.label}>Title *</Text>
        <TextInput style={styles.input} value={title} onChangeText={setTitle}
          placeholder="e.g. Natural Light, Long Takes" placeholderTextColor={Colors.text.tertiary} />

        <Text style={styles.label}>Description</Text>
        <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription}
          placeholder="Describe this element of your vision..." placeholderTextColor={Colors.text.tertiary} multiline numberOfLines={5} />

        {/* Image */}
        <Text style={styles.label}>Reference Image</Text>
        <TouchableOpacity style={styles.imagePicker} onPress={handlePickImage}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.imagePreview} contentFit="cover" />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Camera color={Colors.text.tertiary} size={24} />
              <Text style={styles.imagePlaceholderText}>Add Image</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Conditional fields */}
        {section === 'reference-film' && (
          <>
            <Text style={styles.label}>Film Title</Text>
            <TextInput style={styles.input} value={referenceFilm} onChangeText={setReferenceFilm}
              placeholder="e.g. Paris, Texas (1984)" placeholderTextColor={Colors.text.tertiary} />
          </>
        )}

        {section === 'color-palette' && (
          <>
            <Text style={styles.label}>Color Hex (e.g. #D4A76A)</Text>
            <TextInput style={styles.input} value={colorHex} onChangeText={setColorHex}
              placeholder="#D4A76A" placeholderTextColor={Colors.text.tertiary} autoCapitalize="none" />
            {colorHex.match(/^#[0-9A-Fa-f]{6}$/) && (
              <View style={[styles.colorPreview, { backgroundColor: colorHex }]} />
            )}
          </>
        )}

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>{isEditing ? 'Save Changes' : 'Add to Lookbook'}</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  scrollContent: { padding: 16, paddingBottom: 40 },
  sectionTitle: { fontSize: 16, fontWeight: '700' as const, color: Colors.accent.gold, marginTop: 20, marginBottom: 12, letterSpacing: 0.3 },
  label: { fontSize: 12, fontWeight: '600' as const, color: Colors.text.secondary, marginBottom: 6, marginTop: 12, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  input: { backgroundColor: Colors.bg.card, borderRadius: 10, padding: 14, fontSize: 15, color: Colors.text.primary, borderWidth: 0.5, borderColor: Colors.border.subtle },
  textArea: { minHeight: 120, textAlignVertical: 'top' },
  optionsGrid: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  optionChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.bg.card, borderWidth: 0.5, borderColor: Colors.border.subtle },
  optionChipActive: { backgroundColor: Colors.accent.goldBg, borderColor: Colors.accent.gold + '44' },
  optionChipText: { fontSize: 12, color: Colors.text.secondary, fontWeight: '500' as const },
  optionChipTextActive: { color: Colors.accent.gold, fontWeight: '600' as const },
  imagePicker: { marginTop: 4 },
  imagePreview: { width: '100%', height: 200, borderRadius: 12 },
  imagePlaceholder: { width: '100%', height: 120, borderRadius: 12, backgroundColor: Colors.bg.card, borderWidth: 1, borderColor: Colors.border.subtle, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  imagePlaceholderText: { fontSize: 12, color: Colors.text.tertiary, marginTop: 6 },
  colorPreview: { width: '100%', height: 40, borderRadius: 8, marginTop: 8 },
  saveBtn: { backgroundColor: Colors.accent.gold, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  saveBtnText: { fontSize: 16, fontWeight: '700' as const, color: Colors.text.inverse },
});
