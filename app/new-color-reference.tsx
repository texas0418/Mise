import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useProjects, useProjectColorReferences } from '@/contexts/ProjectContext';
import { LUT_STYLES } from '@/mocks/data';
import Colors from '@/constants/colors';
import { LUTStyle } from '@/types';

export default function NewColorReferenceScreen() {
  const router = useRouter();
  const { activeProjectId, addColorReference, updateColorReference } = useProjects();
  const colorRefs = useProjectColorReferences(activeProjectId);
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id;
  const existingItem = editId ? colorRefs.find(r => r.id === editId) : null;
  const isEditing = !!existingItem;

  const [name, setName] = useState('');
  const [sceneNumber, setSceneNumber] = useState('');
  const [lutStyle, setLutStyle] = useState<LUTStyle>('neutral');
  const [primaryColor, setPrimaryColor] = useState('#1a2940');
  const [secondaryColor, setSecondaryColor] = useState('#c8a04a');
  const [accentColor, setAccentColor] = useState('#e8d5b7');
  const [contrast, setContrast] = useState<'low' | 'medium' | 'high'>('medium');
  const [saturation, setSaturation] = useState<'desaturated' | 'natural' | 'saturated'>('natural');
  const [temperature, setTemperature] = useState<'cool' | 'neutral' | 'warm'>('neutral');
  const [referenceFilm, setReferenceFilm] = useState('');
  const [notes, setNotes] = useState('');

  // Pre-fill form when editing
  useEffect(() => {
    if (existingItem) {
      setName(existingItem.name);
      setSceneNumber(existingItem.sceneNumber?.toString() || '');
      setLutStyle(existingItem.lutStyle);
      setPrimaryColor(existingItem.primaryColor);
      setSecondaryColor(existingItem.secondaryColor);
      setAccentColor(existingItem.accentColor);
      setContrast(existingItem.contrast);
      setSaturation(existingItem.saturation);
      setTemperature(existingItem.temperature);
      setReferenceFilm(existingItem.referenceFilm || '');
      setNotes(existingItem.notes || '');
    }
  }, [existingItem?.id]);

  const handleSave = () => {
    if (!name.trim() || !activeProjectId) return;

    const data = {
      id: isEditing ? existingItem!.id : Date.now().toString(),
      projectId: activeProjectId,
      name: name.trim(),
      sceneNumber: sceneNumber ? parseInt(sceneNumber) : undefined,
      lutStyle,
      primaryColor,
      secondaryColor,
      accentColor,
      contrast,
      saturation,
      temperature,
      referenceFilm: referenceFilm.trim() || undefined,
      notes: notes.trim(),
    };

    if (isEditing) {
      updateColorReference(data);
    } else {
      addColorReference(data);
    }
    router.back();
  };

  const ChipRow = ({ label, options, value, onChange }: { label: string; options: { l: string; v: string }[]; value: string; onChange: (v: any) => void }) => (
    <View style={styles.chipSection}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map(o => (
          <TouchableOpacity key={o.v} style={[styles.chip, value === o.v && styles.chipActive]} onPress={() => onChange(o.v)}>
            <Text style={[styles.chipText, value === o.v && styles.chipTextActive]}>{o.l}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: isEditing ? 'Edit Color Reference' : 'New Color Reference' }} />

      {isEditing && (
        <View style={styles.projectLabel}>
          <Text style={styles.projectLabelText}>Editing: {existingItem!.name}</Text>
        </View>
      )}

      <Text style={styles.label}>Name *</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName}
        placeholder="e.g. Exterior Dusk" placeholderTextColor={Colors.text.tertiary} />

      <Text style={styles.label}>Scene Number</Text>
      <TextInput style={styles.input} value={sceneNumber} onChangeText={setSceneNumber}
        keyboardType="number-pad" placeholder="Optional" placeholderTextColor={Colors.text.tertiary} />

      <Text style={styles.label}>LUT Style</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.lutScroll}>
        {LUT_STYLES.map(lut => (
          <TouchableOpacity key={lut.value}
            style={[styles.lutCard, lutStyle === lut.value && styles.lutCardActive]}
            onPress={() => setLutStyle(lut.value as LUTStyle)}>
            <View style={styles.lutColors}>
              {lut.colors.map((c, i) => <View key={i} style={[styles.lutColorBar, { backgroundColor: c }]} />)}
            </View>
            <Text style={[styles.lutName, lutStyle === lut.value && styles.lutNameActive]}>{lut.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.colorRow}>
        <View style={styles.colorInput}>
          <Text style={styles.label}>Primary</Text>
          <View style={styles.colorPreview}>
            <View style={[styles.colorDot, { backgroundColor: primaryColor }]} />
            <TextInput style={styles.colorField} value={primaryColor} onChangeText={setPrimaryColor} placeholderTextColor={Colors.text.tertiary} />
          </View>
        </View>
        <View style={styles.colorInput}>
          <Text style={styles.label}>Secondary</Text>
          <View style={styles.colorPreview}>
            <View style={[styles.colorDot, { backgroundColor: secondaryColor }]} />
            <TextInput style={styles.colorField} value={secondaryColor} onChangeText={setSecondaryColor} placeholderTextColor={Colors.text.tertiary} />
          </View>
        </View>
        <View style={styles.colorInput}>
          <Text style={styles.label}>Accent</Text>
          <View style={styles.colorPreview}>
            <View style={[styles.colorDot, { backgroundColor: accentColor }]} />
            <TextInput style={styles.colorField} value={accentColor} onChangeText={setAccentColor} placeholderTextColor={Colors.text.tertiary} />
          </View>
        </View>
      </View>

      <ChipRow label="Contrast" options={[{ l: 'Low', v: 'low' }, { l: 'Medium', v: 'medium' }, { l: 'High', v: 'high' }]} value={contrast} onChange={setContrast} />
      <ChipRow label="Saturation" options={[{ l: 'Desat', v: 'desaturated' }, { l: 'Natural', v: 'natural' }, { l: 'Saturated', v: 'saturated' }]} value={saturation} onChange={setSaturation} />
      <ChipRow label="Temperature" options={[{ l: 'Cool', v: 'cool' }, { l: 'Neutral', v: 'neutral' }, { l: 'Warm', v: 'warm' }]} value={temperature} onChange={setTemperature} />

      <Text style={styles.label}>Reference Film</Text>
      <TextInput style={styles.input} value={referenceFilm} onChangeText={setReferenceFilm}
        placeholder="e.g. Blade Runner 2049" placeholderTextColor={Colors.text.tertiary} />

      <Text style={styles.label}>Notes</Text>
      <TextInput style={[styles.input, styles.multiline]} value={notes} onChangeText={setNotes}
        placeholder="Color notes..." placeholderTextColor={Colors.text.tertiary} multiline />

      <TouchableOpacity
        style={[styles.saveBtn, !name.trim() && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={!name.trim()}
      >
        <Text style={styles.saveBtnText}>{isEditing ? 'Save Changes' : 'Save Color Reference'}</Text>
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
  lutScroll: { marginVertical: 4 },
  lutCard: { width: 90, backgroundColor: Colors.bg.card, borderRadius: 8, padding: 8, marginRight: 8, borderWidth: 1.5, borderColor: Colors.border.subtle },
  lutCardActive: { borderColor: Colors.accent.gold },
  lutColors: { flexDirection: 'row', height: 24, borderRadius: 4, overflow: 'hidden', marginBottom: 4 },
  lutColorBar: { flex: 1 },
  lutName: { fontSize: 10, fontWeight: '600' as const, color: Colors.text.tertiary, textAlign: 'center' },
  lutNameActive: { color: Colors.accent.gold },
  colorRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  colorInput: { flex: 1 },
  colorPreview: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.bg.input, borderRadius: 10, padding: 8, borderWidth: 0.5, borderColor: Colors.border.subtle },
  colorDot: { width: 24, height: 24, borderRadius: 6, borderWidth: 1, borderColor: Colors.border.subtle },
  colorField: { flex: 1, fontSize: 12, color: Colors.text.primary, padding: 0 },
  chipSection: { marginTop: 4 },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: { backgroundColor: Colors.bg.elevated, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: Colors.border.subtle },
  chipActive: { backgroundColor: Colors.accent.goldBg, borderColor: Colors.accent.gold },
  chipText: { fontSize: 13, fontWeight: '600' as const, color: Colors.text.tertiary },
  chipTextActive: { color: Colors.accent.gold },
  saveBtn: { backgroundColor: Colors.accent.gold, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontSize: 16, fontWeight: '700' as const, color: Colors.text.inverse },
});
