import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useProjects, useProjectBlockingNotes } from '@/contexts/ProjectContext';
import Colors from '@/constants/colors';

export default function NewBlockingNoteScreen() {
  const router = useRouter();
  const { activeProjectId, addBlockingNote, updateBlockingNote } = useProjects();
  const blockingNotes = useProjectBlockingNotes(activeProjectId);
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id;
  const existingItem = editId ? blockingNotes.find(n => n.id === editId) : null;
  const isEditing = !!existingItem;

  const [sceneNumber, setSceneNumber] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [actorPositions, setActorPositions] = useState('');
  const [cameraPosition, setCameraPosition] = useState('');
  const [movementNotes, setMovementNotes] = useState('');
  const [notes, setNotes] = useState('');

  // Pre-fill form when editing
  useEffect(() => {
    if (existingItem) {
      setSceneNumber(existingItem.sceneNumber.toString());
      setTitle(existingItem.title);
      setDescription(existingItem.description);
      setActorPositions(existingItem.actorPositions);
      setCameraPosition(existingItem.cameraPosition);
      setMovementNotes(existingItem.movementNotes);
      setNotes(existingItem.notes);
    }
  }, [existingItem?.id]);

  const handleSave = () => {
    if (!title.trim() || !sceneNumber || !activeProjectId) return;

    const data = {
      id: isEditing ? existingItem!.id : Date.now().toString(),
      projectId: activeProjectId,
      sceneNumber: parseInt(sceneNumber),
      title: title.trim(),
      description: description.trim(),
      actorPositions: actorPositions.trim(),
      cameraPosition: cameraPosition.trim(),
      movementNotes: movementNotes.trim(),
      notes: notes.trim(),
      createdAt: isEditing ? existingItem!.createdAt : new Date().toISOString(),
      diagramUrl: isEditing ? existingItem!.diagramUrl : undefined,
    };

    if (isEditing) {
      updateBlockingNote(data);
    } else {
      addBlockingNote(data);
    }
    router.back();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: isEditing ? 'Edit Blocking Note' : 'New Blocking Note' }} />

      {isEditing && (
        <View style={styles.projectLabel}>
          <Text style={styles.projectLabelText}>Editing: Sc. {existingItem!.sceneNumber} — {existingItem!.title}</Text>
        </View>
      )}

      <Text style={styles.label}>Scene Number *</Text>
      <TextInput style={styles.input} value={sceneNumber} onChangeText={setSceneNumber}
        keyboardType="number-pad" placeholder="1" placeholderTextColor={Colors.text.tertiary} />

      <Text style={styles.label}>Title *</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle}
        placeholder="e.g. Keeper approaches lighthouse" placeholderTextColor={Colors.text.tertiary} />

      <Text style={styles.label}>Description</Text>
      <TextInput style={[styles.input, styles.multiline]} value={description} onChangeText={setDescription}
        placeholder="What happens in this blocking..." placeholderTextColor={Colors.text.tertiary} multiline />

      <Text style={styles.label}>Actor Positions</Text>
      <TextInput style={[styles.input, styles.multiline]} value={actorPositions} onChangeText={setActorPositions}
        placeholder="Start/end positions, marks..." placeholderTextColor={Colors.text.tertiary} multiline />

      <Text style={styles.label}>Camera Position</Text>
      <TextInput style={[styles.input, styles.multiline]} value={cameraPosition} onChangeText={setCameraPosition}
        placeholder="Camera A/B placement, angle..." placeholderTextColor={Colors.text.tertiary} multiline />

      <Text style={styles.label}>Movement Notes</Text>
      <TextInput style={[styles.input, styles.multiline]} value={movementNotes} onChangeText={setMovementNotes}
        placeholder="Pacing, direction, key beats..." placeholderTextColor={Colors.text.tertiary} multiline />

      <Text style={styles.label}>Additional Notes</Text>
      <TextInput style={[styles.input, styles.multiline]} value={notes} onChangeText={setNotes}
        placeholder="Safety, props, wardrobe notes..." placeholderTextColor={Colors.text.tertiary} multiline />

      <TouchableOpacity
        style={[styles.saveBtn, (!title.trim() || !sceneNumber) && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={!title.trim() || !sceneNumber}
      >
        <Text style={styles.saveBtnText}>{isEditing ? 'Save Changes' : 'Save Blocking Note'}</Text>
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
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  saveBtn: { backgroundColor: Colors.accent.gold, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontSize: 16, fontWeight: '700' as const, color: Colors.text.inverse },
});
