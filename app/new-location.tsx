import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Switch } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Image } from 'expo-image';
import { Camera, ImagePlus, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useProjects, useProjectLocations } from '@/contexts/ProjectContext';
import { showImagePickerOptions } from '@/utils/imagePicker';
import Colors from '@/constants/colors';

export default function NewLocationScreen() {
  const router = useRouter();
  const { addLocation, updateLocation, activeProjectId, activeProject } = useProjects();
  const locations = useProjectLocations(activeProjectId);
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id;
  const existingItem = editId ? locations.find(l => l.id === editId) : null;
  const isEditing = !!existingItem;

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [permitRequired, setPermitRequired] = useState(false);
  const [permitStatus, setPermitStatus] = useState('');
  const [parkingNotes, setParkingNotes] = useState('');
  const [powerAvailable, setPowerAvailable] = useState(false);
  const [notes, setNotes] = useState('');
  const [rating, setRating] = useState(3);
  const [scenes, setScenes] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);

  // Pre-fill form when editing
  useEffect(() => {
    if (existingItem) {
      setName(existingItem.name);
      setAddress(existingItem.address);
      setContactName(existingItem.contactName || '');
      setContactPhone(existingItem.contactPhone || '');
      setPermitRequired(existingItem.permitRequired);
      setPermitStatus(existingItem.permitStatus || '');
      setParkingNotes(existingItem.parkingNotes || '');
      setPowerAvailable(existingItem.powerAvailable);
      setNotes(existingItem.notes || '');
      setRating(existingItem.rating);
      setScenes(existingItem.scenes.join(', '));
      setPhotoUrls(existingItem.photoUrls || []);
    }
  }, [existingItem?.id]);

  const handleAddPhoto = useCallback(() => {
    showImagePickerOptions((uri) => {
      setPhotoUrls(prev => [...prev, uri]);
    });
  }, []);

  const handleRemovePhoto = useCallback((index: number) => {
    setPhotoUrls(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleSave = useCallback(() => {
    if (!activeProjectId) {
      Alert.alert('No Project', 'Select a project first.');
      return;
    }
    if (!name.trim()) {
      Alert.alert('Missing Info', 'Enter a location name.');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const data = {
      id: isEditing ? existingItem!.id : Date.now().toString(),
      projectId: activeProjectId,
      name: name.trim(),
      address: address.trim(),
      contactName: contactName.trim(),
      contactPhone: contactPhone.trim(),
      permitRequired,
      permitStatus: permitStatus.trim() || (permitRequired ? 'Pending' : 'N/A'),
      parkingNotes: parkingNotes.trim(),
      powerAvailable,
      notes: notes.trim(),
      rating,
      photoUrls,
      scenes: scenes.trim() ? scenes.split(',').map(s => s.trim()) : [],
    };

    if (isEditing) {
      updateLocation(data);
    } else {
      addLocation(data);
    }
    router.back();
  }, [activeProjectId, name, address, contactName, contactPhone, permitRequired, permitStatus, parkingNotes, powerAvailable, notes, rating, scenes, photoUrls, addLocation, updateLocation, router, isEditing, existingItem]);

  if (!activeProject) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No project selected</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: isEditing ? 'Edit Location' : 'New Location' }} />

      <View style={styles.projectLabel}>
        <Text style={styles.projectLabelText}>
          {isEditing ? `Editing: ${existingItem!.name}` : `Location for: ${activeProject.title}`}
        </Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Location Name</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName}
          placeholder="e.g. Beach at Point Reyes" placeholderTextColor={Colors.text.tertiary} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Address</Text>
        <TextInput style={styles.input} value={address} onChangeText={setAddress}
          placeholder="Full address" placeholderTextColor={Colors.text.tertiary} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Scenes (comma separated)</Text>
        <TextInput style={styles.input} value={scenes} onChangeText={setScenes}
          placeholder="1, 5, 8" placeholderTextColor={Colors.text.tertiary} />
      </View>

      <View style={styles.row}>
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.label}>Contact Name</Text>
          <TextInput style={styles.input} value={contactName} onChangeText={setContactName}
            placeholder="Name" placeholderTextColor={Colors.text.tertiary} />
        </View>
        <View style={{ width: 12 }} />
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.label}>Contact Phone</Text>
          <TextInput style={styles.input} value={contactPhone} onChangeText={setContactPhone}
            placeholder="Phone" placeholderTextColor={Colors.text.tertiary} keyboardType="phone-pad" />
        </View>
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Permit Required</Text>
        <Switch value={permitRequired} onValueChange={setPermitRequired}
          trackColor={{ true: Colors.accent.gold, false: Colors.bg.elevated }} thumbColor={Colors.text.primary} />
      </View>

      {permitRequired && (
        <View style={styles.field}>
          <Text style={styles.label}>Permit Status</Text>
          <TextInput style={styles.input} value={permitStatus} onChangeText={setPermitStatus}
            placeholder="Pending, Approved, etc." placeholderTextColor={Colors.text.tertiary} />
        </View>
      )}

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Power Available</Text>
        <Switch value={powerAvailable} onValueChange={setPowerAvailable}
          trackColor={{ true: Colors.accent.gold, false: Colors.bg.elevated }} thumbColor={Colors.text.primary} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Parking Notes</Text>
        <TextInput style={styles.input} value={parkingNotes} onChangeText={setParkingNotes}
          placeholder="Parking availability" placeholderTextColor={Colors.text.tertiary} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Rating (1-5)</Text>
        <View style={styles.ratingRow}>
          {[1, 2, 3, 4, 5].map(r => (
            <TouchableOpacity key={r} style={[styles.ratingBtn, rating >= r && styles.ratingBtnActive]}
              onPress={() => setRating(r)}>
              <Text style={[styles.ratingText, rating >= r && styles.ratingTextActive]}>{r}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Location Photos</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
          {photoUrls.map((uri, i) => (
            <View key={i} style={styles.photoThumb}>
              <Image source={{ uri }} style={styles.photoImage} contentFit="cover" />
              <TouchableOpacity style={styles.photoRemove} onPress={() => handleRemovePhoto(i)}>
                <X color="#fff" size={12} />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={styles.addPhotoBtn} onPress={handleAddPhoto}>
            <ImagePlus color={Colors.accent.gold} size={24} />
            <Text style={styles.addPhotoText}>Add Photo</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Notes</Text>
        <TextInput style={[styles.input, styles.textArea]} value={notes} onChangeText={setNotes}
          placeholder="Power, parking, access notes..." placeholderTextColor={Colors.text.tertiary}
          multiline numberOfLines={3} textAlignVertical="top" />
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.8}>
        <Text style={styles.saveButtonText}>{isEditing ? 'Save Changes' : 'Add Location'}</Text>
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
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.bg.card, borderRadius: 10, padding: 14, marginBottom: 20, borderWidth: 0.5, borderColor: Colors.border.subtle },
  switchLabel: { fontSize: 14, color: Colors.text.primary, fontWeight: '500' as const },
  ratingRow: { flexDirection: 'row', gap: 8 },
  ratingBtn: { width: 44, height: 44, borderRadius: 10, backgroundColor: Colors.bg.elevated, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border.subtle },
  ratingBtnActive: { backgroundColor: Colors.accent.goldBg, borderColor: Colors.accent.gold + '44' },
  ratingText: { fontSize: 16, fontWeight: '700' as const, color: Colors.text.tertiary },
  ratingTextActive: { color: Colors.accent.gold },
  saveButton: { backgroundColor: Colors.accent.gold, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 12 },
  saveButtonText: { fontSize: 16, fontWeight: '700' as const, color: Colors.text.inverse },
  photoScroll: { flexDirection: 'row' },
  photoThumb: { width: 80, height: 80, borderRadius: 10, marginRight: 10, overflow: 'hidden' },
  photoImage: { width: 80, height: 80 },
  photoRemove: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' },
  addPhotoBtn: { width: 80, height: 80, borderRadius: 10, backgroundColor: Colors.bg.elevated, borderWidth: 1, borderColor: Colors.border.subtle, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', gap: 4 },
  addPhotoText: { fontSize: 9, color: Colors.accent.gold, fontWeight: '600' as const },
  emptyContainer: { flex: 1, backgroundColor: Colors.bg.primary, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600' as const, color: Colors.text.primary },
});
