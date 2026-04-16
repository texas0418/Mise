import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Image } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Camera, X, Image as ImageIcon } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useProjects, useProjectContinuity } from '@/contexts/ProjectContext';
import { showImagePickerOptions } from '@/utils/imagePicker';
import Colors from '@/constants/colors';

export default function NewContinuityScreen() {
  const router = useRouter();
  const { addContinuityNote, updateContinuityNote, activeProjectId, activeProject } = useProjects();
  const notes = useProjectContinuity(activeProjectId);
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id;
  const existingItem = editId ? notes.find(n => n.id === editId) : null;
  const isEditing = !!existingItem;

  const [sceneNumber, setSceneNumber] = useState('');
  const [shotNumber, setShotNumber] = useState('');
  const [description, setDescription] = useState('');
  const [details, setDetails] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  // Pre-fill when editing
  useEffect(() => {
    if (existingItem) {
      setSceneNumber(existingItem.sceneNumber.toString());
      setShotNumber(existingItem.shotNumber);
      setDescription(existingItem.description);
      setDetails(existingItem.details || '');
      setPhotoUrl((existingItem as any).photoUrl || null);
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

    const data: any = {
      id: isEditing ? existingItem!.id : Date.now().toString(),
      projectId: activeProjectId,
      sceneNumber: parseInt(sceneNumber, 10) || 1,
      shotNumber: shotNumber.trim() || '1A',
      description: description.trim(),
      details: details.trim(),
      timestamp: isEditing ? existingItem!.timestamp : new Date().toISOString(),
      photoUrl: photoUrl || undefined,
    };

    if (isEditing) {
      updateContinuityNote(data);
    } else {
      addContinuityNote(data);
    }
    router.back();
  }, [activeProjectId, sceneNumber, shotNumber, description, details, photoUrl, isEditing, existingItem, addContinuityNote, updateContinuityNote, router]);

  const handleAddPhoto = () => {
    showImagePickerOptions((uri) => {
      setPhotoUrl(uri);
    });
  };

  if (!activeProject) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No project selected</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: isEditing ? 'Edit Continuity Note' : 'New Continuity Note' }} />

      <View style={styles.projectLabel}>
        <Text style={styles.projectLabelText}>
          {isEditing ? `Editing: Sc.${existingItem!.sceneNumber}/${existingItem!.shotNumber}` : `Continuity for: ${activeProject.title}`}
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
        <Text style={styles.label}>What to track</Text>
        <TextInput style={styles.input} value={description} onChangeText={setDescription}
          placeholder="e.g. Hair position, Prop placement" placeholderTextColor={Colors.text.tertiary} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Details</Text>
        <TextInput style={[styles.input, styles.textArea]} value={details} onChangeText={setDetails}
          placeholder="Describe the exact state for continuity matching..."
          placeholderTextColor={Colors.text.tertiary} multiline numberOfLines={5} textAlignVertical="top" />
      </View>

      {/* Photo section */}
      <View style={styles.field}>
        <Text style={styles.label}>Reference Photo</Text>

        {photoUrl ? (
          <View style={styles.photoContainer}>
            <Image source={{ uri: photoUrl }} style={styles.photoPreview} resizeMode="cover" />
            <View style={styles.photoActions}>
              <TouchableOpacity onPress={handleAddPhoto} style={styles.photoChangeBtn}>
                <Camera color={Colors.accent.gold} size={14} />
                <Text style={styles.photoChangeBtnText}>Change</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setPhotoUrl(null)} style={styles.photoRemoveBtn}>
                <X color={Colors.status.error} size={14} />
                <Text style={styles.photoRemoveBtnText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={styles.photoPlaceholder} onPress={handleAddPhoto} activeOpacity={0.7}>
            <Camera color={Colors.text.tertiary} size={28} />
            <Text style={styles.photoPlaceholderText}>Take Photo or Choose from Library</Text>
            <Text style={styles.photoPlaceholderHint}>Tap to add a reference photo</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.8}>
        <Text style={styles.saveButtonText}>{isEditing ? 'Save Changes' : 'Add Continuity Note'}</Text>
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
  textArea: { minHeight: 120, paddingTop: 14 },
  // Photo
  photoPlaceholder: { backgroundColor: Colors.bg.card, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.border.subtle, borderStyle: 'dashed', padding: 30, alignItems: 'center', justifyContent: 'center', gap: 8 },
  photoPlaceholderText: { fontSize: 14, fontWeight: '600' as const, color: Colors.text.secondary },
  photoPlaceholderHint: { fontSize: 11, color: Colors.text.tertiary },
  photoContainer: { borderRadius: 12, overflow: 'hidden', borderWidth: 0.5, borderColor: Colors.border.subtle },
  photoPreview: { width: '100%', height: 220, backgroundColor: Colors.bg.elevated },
  photoActions: { flexDirection: 'row', justifyContent: 'center', gap: 16, padding: 10, backgroundColor: Colors.bg.card },
  photoChangeBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.accent.goldBg, borderWidth: 0.5, borderColor: Colors.accent.gold + '44' },
  photoChangeBtnText: { fontSize: 12, fontWeight: '600' as const, color: Colors.accent.gold },
  photoRemoveBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.status.error + '12', borderWidth: 0.5, borderColor: Colors.status.error + '44' },
  photoRemoveBtnText: { fontSize: 12, fontWeight: '600' as const, color: Colors.status.error },
  // Save
  saveButton: { backgroundColor: Colors.accent.gold, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 12 },
  saveButtonText: { fontSize: 16, fontWeight: '700' as const, color: Colors.text.inverse },
  emptyContainer: { flex: 1, backgroundColor: Colors.bg.primary, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600' as const, color: Colors.text.primary },
});
