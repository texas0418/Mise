import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { ImagePlus } from 'lucide-react-native';
import { useProjects, useProjectShotReferences } from '@/contexts/ProjectContext';
import { showImagePickerOptions } from '@/utils/imagePicker';
import Colors from '@/constants/colors';

export default function NewShotReferenceScreen() {
  const router = useRouter();
  const { activeProjectId, addShotReference, updateShotReference } = useProjects();
  const references = useProjectShotReferences(activeProjectId);
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id;
  const existingItem = editId ? references.find(r => r.id === editId) : null;
  const isEditing = !!existingItem;

  const [title, setTitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [sceneNumber, setSceneNumber] = useState('');
  const [lightingStyle, setLightingStyle] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');

  // Pre-fill form when editing
  useEffect(() => {
    if (existingItem) {
      setTitle(existingItem.title);
      setImageUrl(existingItem.imageUrl || '');
      setSceneNumber(existingItem.sceneNumber?.toString() || '');
      setLightingStyle(existingItem.lightingStyle || '');
      setNotes(existingItem.notes || '');
      setTags(existingItem.tags?.join(', ') || '');
    }
  }, [existingItem?.id]);

  const handleSave = () => {
    if (!title.trim() || !activeProjectId) return;

    const data = {
      id: isEditing ? existingItem!.id : Date.now().toString(),
      projectId: activeProjectId,
      title: title.trim(),
      imageUrl: imageUrl.trim() || '',
      shotId: isEditing ? existingItem!.shotId : undefined,
      shotType: isEditing ? existingItem!.shotType : undefined,
      sceneNumber: sceneNumber ? parseInt(sceneNumber) : undefined,
      lightingStyle: lightingStyle.trim() || undefined,
      notes: notes.trim(),
      tags: tags.split(',').map(t => t.trim()).filter(Boolean),
    };

    if (isEditing) {
      updateShotReference(data);
    } else {
      addShotReference(data);
    }
    router.back();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: isEditing ? 'Edit Reference' : 'New Shot Reference' }} />

      {isEditing && (
        <View style={styles.projectLabel}>
          <Text style={styles.projectLabelText}>Editing: {existingItem!.title}</Text>
        </View>
      )}

      <Text style={styles.label}>Title *</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle}
        placeholder="e.g. Blade Runner alley lighting" placeholderTextColor={Colors.text.tertiary} />

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
        placeholder="https://..." placeholderTextColor={Colors.text.tertiary} autoCapitalize="none" />

      <Text style={styles.label}>Scene Number</Text>
      <TextInput style={styles.input} value={sceneNumber} onChangeText={setSceneNumber}
        placeholder="Optional" placeholderTextColor={Colors.text.tertiary} keyboardType="number-pad" />

      <Text style={styles.label}>Lighting Style</Text>
      <TextInput style={styles.input} value={lightingStyle} onChangeText={setLightingStyle}
        placeholder="e.g. Natural dusk, Neon practicals" placeholderTextColor={Colors.text.tertiary} />

      <Text style={styles.label}>Tags (comma separated)</Text>
      <TextInput style={styles.input} value={tags} onChangeText={setTags}
        placeholder="e.g. wide, golden-hour, moody" placeholderTextColor={Colors.text.tertiary} />

      <Text style={styles.label}>Notes</Text>
      <TextInput style={[styles.input, styles.multiline]} value={notes} onChangeText={setNotes}
        placeholder="Reference notes..." placeholderTextColor={Colors.text.tertiary}
        multiline numberOfLines={3} />

      <TouchableOpacity
        style={[styles.saveBtn, !title.trim() && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={!title.trim()}
      >
        <Text style={styles.saveBtnText}>{isEditing ? 'Save Changes' : 'Save Reference'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  content: { padding: 20, paddingBottom: 40 },
  projectLabel: { backgroundColor: Colors.accent.goldBg, borderRadius: 8, padding: 10, marginBottom: 10 },
  projectLabelText: { fontSize: 13, color: Colors.accent.gold, fontWeight: '600' as const },
  label: { fontSize: 12, fontWeight: '700' as const, color: Colors.text.secondary, textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 6, marginTop: 16 },
  input: { backgroundColor: Colors.bg.input, borderRadius: 10, padding: 14, fontSize: 15, color: Colors.text.primary, borderWidth: 0.5, borderColor: Colors.border.subtle },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  saveBtn: { backgroundColor: Colors.accent.gold, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontSize: 16, fontWeight: '700' as const, color: Colors.text.inverse },
  pickImageBtn: { backgroundColor: Colors.bg.elevated, borderRadius: 12, borderWidth: 1, borderColor: Colors.border.subtle, borderStyle: 'dashed', padding: 24, alignItems: 'center', gap: 8 },
  pickImageText: { fontSize: 13, color: Colors.accent.gold, fontWeight: '600' as const },
  imagePreviewWrap: { borderRadius: 12, overflow: 'hidden', marginBottom: 8 },
  imagePreview: { width: '100%', height: 200, borderRadius: 12 },
  changePhotoBtn: { position: 'absolute', bottom: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  changePhotoText: { fontSize: 12, color: '#fff', fontWeight: '600' as const },
  orText: { fontSize: 11, color: Colors.text.tertiary, marginTop: 10, marginBottom: 6 },
});
