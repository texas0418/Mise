import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Camera, User } from 'lucide-react-native';
import { useProjects, useProjectCast } from '@/contexts/ProjectContext';
import { useLayout } from '@/utils/useLayout';
import { pickImage } from '@/utils/imagePicker';
import Colors from '@/constants/colors';
import { CastMember, CastStatus } from '@/types';

const STATUS_OPTIONS: { value: CastStatus; label: string }[] = [
  { value: 'wishlist', label: 'Wishlist' },
  { value: 'auditioned', label: 'Auditioned' },
  { value: 'in-talks', label: 'In Talks' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'wrapped', label: 'Wrapped' },
];

export default function NewCastMemberScreen() {
  const { activeProjectId, addCastMember, updateCastMember } = useProjects();
  const cast = useProjectCast(activeProjectId);
  const router = useRouter();
  const { isTablet, contentPadding } = useLayout();
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id;
  const existingMember = editId ? cast.find(c => c.id === editId) : null;
  const isEditing = !!existingMember;

  const [actorName, setActorName] = useState('');
  const [characterName, setCharacterName] = useState('');
  const [characterDescription, setCharacterDescription] = useState('');
  const [status, setStatus] = useState<CastStatus>('wishlist');
  const [headshot, setHeadshot] = useState<string | undefined>(undefined);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [agentName, setAgentName] = useState('');
  const [agentContact, setAgentContact] = useState('');
  const [scenesInput, setScenesInput] = useState('');
  const [shootDaysInput, setShootDaysInput] = useState('');
  const [availability, setAvailability] = useState('');
  const [performanceNotes, setPerformanceNotes] = useState('');
  const [costumeNotes, setCostumeNotes] = useState('');

  // Pre-fill form when editing
  useEffect(() => {
    if (existingMember) {
      setActorName(existingMember.actorName || '');
      setCharacterName(existingMember.characterName);
      setCharacterDescription(existingMember.characterDescription || '');
      setStatus(existingMember.status);
      setHeadshot(existingMember.headshot);
      setEmail(existingMember.email || '');
      setPhone(existingMember.phone || '');
      setAgentName(existingMember.agentName || '');
      setAgentContact(existingMember.agentContact || '');
      setScenesInput(existingMember.scenes.join(', '));
      setShootDaysInput(existingMember.shootDays.join(', '));
      setAvailability(existingMember.availability || '');
      setPerformanceNotes(existingMember.performanceNotes || '');
      setCostumeNotes(existingMember.costumeNotes || '');
    }
  }, [existingMember?.id]);

  const handlePickHeadshot = async () => {
    const result = await pickImage();
    if (result) setHeadshot(result);
  };

  const handleSave = () => {
    if (!characterName.trim()) {
      Alert.alert('Required', 'Character name is required.');
      return;
    }

    const memberData: CastMember = {
      id: isEditing ? existingMember!.id : Date.now().toString(),
      projectId: activeProjectId || '1',
      actorName: actorName.trim(),
      characterName: characterName.trim(),
      characterDescription: characterDescription.trim(),
      status,
      headshot,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      agentName: agentName.trim() || undefined,
      agentContact: agentContact.trim() || undefined,
      scenes: scenesInput.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)),
      shootDays: shootDaysInput.split(',').map(d => d.trim()).filter(Boolean),
      availability: availability.trim(),
      performanceNotes: performanceNotes.trim(),
      costumeNotes: costumeNotes.trim() || undefined,
      createdAt: isEditing ? existingMember!.createdAt : new Date().toISOString(),
    };

    if (isEditing) {
      updateCastMember(memberData);
    } else {
      addCastMember(memberData);
    }
    router.back();
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: isEditing ? 'Edit Cast Member' : 'New Cast Member' }} />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, {
          paddingHorizontal: contentPadding,
          maxWidth: isTablet ? 700 : undefined,
          alignSelf: isTablet ? 'center' as const : undefined,
          width: isTablet ? '100%' : undefined,
        }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Headshot picker */}
        <TouchableOpacity style={styles.headshotPicker} onPress={handlePickHeadshot}>
          {headshot ? (
            <Image source={{ uri: headshot }} style={styles.headshotPreview} contentFit="cover" />
          ) : (
            <View style={styles.headshotPlaceholder}>
              <Camera color={Colors.text.tertiary} size={28} />
              <Text style={styles.headshotPlaceholderText}>Add Headshot</Text>
            </View>
          )}
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Character</Text>

        <Text style={styles.label}>Character Name *</Text>
        <TextInput style={styles.input} value={characterName} onChangeText={setCharacterName}
          placeholder="e.g. Marcus" placeholderTextColor={Colors.text.tertiary} />

        <Text style={styles.label}>Character Description</Text>
        <TextInput style={[styles.input, styles.textArea]} value={characterDescription} onChangeText={setCharacterDescription}
          placeholder="Age, personality, role in story..." placeholderTextColor={Colors.text.tertiary} multiline numberOfLines={3} />

        <Text style={styles.label}>Status</Text>
        <View style={styles.optionsRow}>
          {STATUS_OPTIONS.map(opt => (
            <TouchableOpacity key={opt.value}
              style={[styles.optionChip, status === opt.value && styles.optionChipActive]}
              onPress={() => setStatus(opt.value)}>
              <Text style={[styles.optionChipText, status === opt.value && styles.optionChipTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Actor</Text>

        <Text style={styles.label}>Actor Name</Text>
        <TextInput style={styles.input} value={actorName} onChangeText={setActorName}
          placeholder="Leave blank if uncast" placeholderTextColor={Colors.text.tertiary} />

        <View style={styles.row}>
          <View style={styles.fieldHalf}>
            <Text style={styles.label}>Email</Text>
            <TextInput style={styles.input} value={email} onChangeText={setEmail}
              placeholder="actor@email.com" placeholderTextColor={Colors.text.tertiary} keyboardType="email-address" autoCapitalize="none" />
          </View>
          <View style={styles.fieldHalf}>
            <Text style={styles.label}>Phone</Text>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone}
              placeholder="(310) 555-0000" placeholderTextColor={Colors.text.tertiary} keyboardType="phone-pad" />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.fieldHalf}>
            <Text style={styles.label}>Agent Name</Text>
            <TextInput style={styles.input} value={agentName} onChangeText={setAgentName}
              placeholder="Agent name" placeholderTextColor={Colors.text.tertiary} />
          </View>
          <View style={styles.fieldHalf}>
            <Text style={styles.label}>Agent Contact</Text>
            <TextInput style={styles.input} value={agentContact} onChangeText={setAgentContact}
              placeholder="agent@agency.com" placeholderTextColor={Colors.text.tertiary} autoCapitalize="none" />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Production</Text>

        <Text style={styles.label}>Scenes (comma-separated numbers)</Text>
        <TextInput style={styles.input} value={scenesInput} onChangeText={setScenesInput}
          placeholder="1, 5, 8, 12" placeholderTextColor={Colors.text.tertiary} keyboardType="numbers-and-punctuation" />

        <Text style={styles.label}>Shoot Days (comma-separated dates)</Text>
        <TextInput style={styles.input} value={shootDaysInput} onChangeText={setShootDaysInput}
          placeholder="2025-03-15, 2025-03-17" placeholderTextColor={Colors.text.tertiary} />

        <Text style={styles.label}>Availability</Text>
        <TextInput style={[styles.input, styles.textArea]} value={availability} onChangeText={setAvailability}
          placeholder="Available dates, conflicts, hard outs..." placeholderTextColor={Colors.text.tertiary} multiline numberOfLines={3} />

        <Text style={styles.sectionTitle}>Director's Notes</Text>

        <Text style={styles.label}>Performance Notes</Text>
        <TextInput style={[styles.input, styles.textArea]} value={performanceNotes} onChangeText={setPerformanceNotes}
          placeholder="Acting notes, what works, what to watch for..." placeholderTextColor={Colors.text.tertiary} multiline numberOfLines={4} />

        <Text style={styles.label}>Wardrobe / Costume Notes</Text>
        <TextInput style={[styles.input, styles.textArea]} value={costumeNotes} onChangeText={setCostumeNotes}
          placeholder="Character's look, key wardrobe pieces..." placeholderTextColor={Colors.text.tertiary} multiline numberOfLines={3} />

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>{isEditing ? 'Save Changes' : 'Add Cast Member'}</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  scrollContent: { padding: 16, paddingBottom: 40 },
  headshotPicker: { alignSelf: 'center', marginBottom: 16, marginTop: 8 },
  headshotPreview: { width: 100, height: 130, borderRadius: 14 },
  headshotPlaceholder: { width: 100, height: 130, borderRadius: 14, backgroundColor: Colors.bg.card, borderWidth: 1, borderColor: Colors.border.subtle, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  headshotPlaceholderText: { fontSize: 10, color: Colors.text.tertiary, marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700' as const, color: Colors.accent.gold, marginTop: 20, marginBottom: 12, letterSpacing: 0.3 },
  label: { fontSize: 12, fontWeight: '600' as const, color: Colors.text.secondary, marginBottom: 6, marginTop: 12, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  input: { backgroundColor: Colors.bg.card, borderRadius: 10, padding: 14, fontSize: 15, color: Colors.text.primary, borderWidth: 0.5, borderColor: Colors.border.subtle },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 10 },
  fieldHalf: { flex: 1 },
  optionsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  optionChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.bg.card, borderWidth: 0.5, borderColor: Colors.border.subtle },
  optionChipActive: { backgroundColor: Colors.accent.goldBg, borderColor: Colors.accent.gold + '44' },
  optionChipText: { fontSize: 13, color: Colors.text.secondary, fontWeight: '500' as const },
  optionChipTextActive: { color: Colors.accent.gold, fontWeight: '600' as const },
  saveBtn: { backgroundColor: Colors.accent.gold, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  saveBtnText: { fontSize: 16, fontWeight: '700' as const, color: Colors.text.inverse },
});
