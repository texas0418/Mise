import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Stack } from 'expo-router';
import { Plus, X, MessageSquare, Camera, Users, Eye } from 'lucide-react-native';
import { useProjects, useProjectScriptSides } from '@/contexts/ProjectContext';
import { useLayout } from '@/utils/useLayout';
import Colors from '@/constants/colors';
import { ScriptSide, SidesStatus, SideAnnotation } from '@/types';

const STATUS_OPTIONS: { value: SidesStatus; label: string }[] = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'shooting-today', label: 'Shooting Today' },
  { value: 'completed', label: 'Completed' },
  { value: 'revised', label: 'Revised' },
];

const REVISION_COLORS = ['white', 'blue', 'pink', 'yellow', 'green', 'goldenrod', 'buff', 'salmon', 'cherry'];
const REVISION_HEX: Record<string, string> = {
  'white': '#FFFFFF', 'blue': '#60A5FA', 'pink': '#F472B6', 'yellow': '#FBBF24',
  'green': '#4ADE80', 'goldenrod': '#DAA520', 'buff': '#F0DC82', 'salmon': '#FA8072', 'cherry': '#DE3163',
};

const ANNOTATION_TYPES: { value: string; label: string; icon: React.ElementType }[] = [
  { value: 'camera', label: 'Camera', icon: Camera },
  { value: 'blocking', label: 'Blocking', icon: Users },
  { value: 'performance', label: 'Performance', icon: Eye },
  { value: 'general', label: 'General', icon: MessageSquare },
];

export default function NewScriptSideScreen() {
  const { activeProjectId, addScriptSide, updateScriptSide } = useProjects();
  const sides = useProjectScriptSides(activeProjectId);
  const router = useRouter();
  const { isTablet, contentPadding } = useLayout();
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id;
  const existingSide = editId ? sides.find(s => s.id === editId) : null;
  const isEditing = !!existingSide;

  const [sceneNumber, setSceneNumber] = useState('');
  const [sceneHeader, setSceneHeader] = useState('');
  const [pageStart, setPageStart] = useState('');
  const [pageEnd, setPageEnd] = useState('');
  const [pageCount, setPageCount] = useState('');
  const [shootDate, setShootDate] = useState('');
  const [status, setStatus] = useState<SidesStatus>('upcoming');
  const [synopsis, setSynopsis] = useState('');
  const [castInput, setCastInput] = useState('');
  const [revisionColor, setRevisionColor] = useState<string | undefined>(undefined);
  const [notes, setNotes] = useState('');
  const [annotations, setAnnotations] = useState<SideAnnotation[]>([]);
  const [newAnnotationText, setNewAnnotationText] = useState('');
  const [newAnnotationType, setNewAnnotationType] = useState<string>('general');

  // Pre-fill form when editing
  useEffect(() => {
    if (existingSide) {
      setSceneNumber(existingSide.sceneNumber.toString());
      setSceneHeader(existingSide.sceneHeader);
      setPageStart(existingSide.pageStart);
      setPageEnd(existingSide.pageEnd);
      setPageCount(existingSide.pageCount.toString());
      setShootDate(existingSide.shootDate);
      setStatus(existingSide.status);
      setSynopsis(existingSide.synopsis);
      setCastInput(existingSide.castIds.join(', '));
      setRevisionColor(existingSide.revisionColor);
      setNotes(existingSide.notes);
      setAnnotations(existingSide.annotations || []);
    }
  }, [existingSide?.id]);

  const addAnnotation = () => {
    if (!newAnnotationText.trim()) return;
    const annotation: SideAnnotation = {
      id: `ann-${Date.now()}`,
      text: newAnnotationText.trim(),
      type: newAnnotationType as SideAnnotation['type'],
      timestamp: new Date().toISOString(),
    };
    setAnnotations([...annotations, annotation]);
    setNewAnnotationText('');
  };

  const removeAnnotation = (id: string) => {
    setAnnotations(annotations.filter(a => a.id !== id));
  };

  const handleSave = () => {
    if (!sceneNumber.trim() || !sceneHeader.trim()) {
      Alert.alert('Required', 'Scene number and header are required.');
      return;
    }

    const sideData: ScriptSide = {
      id: isEditing ? existingSide!.id : Date.now().toString(),
      projectId: activeProjectId || '1',
      sceneNumber: parseInt(sceneNumber) || 0,
      sceneHeader: sceneHeader.trim(),
      pageStart: pageStart.trim() || '1',
      pageEnd: pageEnd.trim() || pageStart.trim() || '1',
      pageCount: parseFloat(pageCount) || 1,
      shootDate: shootDate.trim() || new Date().toISOString().split('T')[0],
      status,
      synopsis: synopsis.trim(),
      castIds: castInput.split(',').map(c => c.trim()).filter(Boolean),
      linkedShotIds: isEditing ? existingSide!.linkedShotIds : [],
      annotations,
      revisionColor,
      revisionDate: revisionColor ? new Date().toISOString().split('T')[0] : undefined,
      notes: notes.trim(),
      createdAt: isEditing ? existingSide!.createdAt : new Date().toISOString(),
    };

    if (isEditing) {
      updateScriptSide(sideData);
    } else {
      addScriptSide(sideData);
    }
    router.back();
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: isEditing ? 'Edit Side' : 'New Side' }} />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, {
          paddingHorizontal: contentPadding,
          maxWidth: isTablet ? 700 : undefined,
          alignSelf: isTablet ? 'center' as const : undefined,
          width: isTablet ? '100%' : undefined,
        }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Scene Info</Text>

        <View style={styles.row}>
          <View style={styles.fieldSmall}>
            <Text style={styles.label}>Scene #</Text>
            <TextInput style={styles.input} value={sceneNumber} onChangeText={setSceneNumber}
              placeholder="e.g. 5" placeholderTextColor={Colors.text.tertiary} keyboardType="number-pad" />
          </View>
          <View style={styles.fieldLarge}>
            <Text style={styles.label}>Scene Header</Text>
            <TextInput style={styles.input} value={sceneHeader} onChangeText={setSceneHeader}
              placeholder="INT. APARTMENT - NIGHT" placeholderTextColor={Colors.text.tertiary} autoCapitalize="characters" />
          </View>
        </View>

        <View style={styles.row}>
          <View style={styles.fieldSmall}>
            <Text style={styles.label}>Page Start</Text>
            <TextInput style={styles.input} value={pageStart} onChangeText={setPageStart}
              placeholder="12" placeholderTextColor={Colors.text.tertiary} />
          </View>
          <View style={styles.fieldSmall}>
            <Text style={styles.label}>Page End</Text>
            <TextInput style={styles.input} value={pageEnd} onChangeText={setPageEnd}
              placeholder="14A" placeholderTextColor={Colors.text.tertiary} />
          </View>
          <View style={styles.fieldSmall}>
            <Text style={styles.label}>Page Count</Text>
            <TextInput style={styles.input} value={pageCount} onChangeText={setPageCount}
              placeholder="2.5" placeholderTextColor={Colors.text.tertiary} keyboardType="decimal-pad" />
          </View>
        </View>

        <Text style={styles.label}>Shoot Date (YYYY-MM-DD)</Text>
        <TextInput style={styles.input} value={shootDate} onChangeText={setShootDate}
          placeholder="2025-03-20" placeholderTextColor={Colors.text.tertiary} />

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

        <Text style={styles.sectionTitle}>Details</Text>

        <Text style={styles.label}>Synopsis</Text>
        <TextInput style={[styles.input, styles.textArea]} value={synopsis} onChangeText={setSynopsis}
          placeholder="Brief description of the scene action..." placeholderTextColor={Colors.text.tertiary} multiline numberOfLines={4} />

        <Text style={styles.label}>Cast (comma-separated)</Text>
        <TextInput style={styles.input} value={castInput} onChangeText={setCastInput}
          placeholder="Marcus, Elena, Ray" placeholderTextColor={Colors.text.tertiary} />

        <Text style={styles.label}>Revision Color</Text>
        <View style={styles.colorRow}>
          <TouchableOpacity style={[styles.colorChip, !revisionColor && styles.colorChipActive]}
            onPress={() => setRevisionColor(undefined)}>
            <Text style={styles.colorChipText}>None</Text>
          </TouchableOpacity>
          {REVISION_COLORS.map(c => (
            <TouchableOpacity key={c} style={[styles.colorChip, revisionColor === c && styles.colorChipActive]}
              onPress={() => setRevisionColor(c)}>
              <View style={[styles.colorDot, { backgroundColor: REVISION_HEX[c] }]} />
              <Text style={styles.colorChipText}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Annotations</Text>
        {annotations.map(ann => (
          <View key={ann.id} style={styles.annotationRow}>
            <View style={styles.annotationContent}>
              <Text style={styles.annotationTypeLabel}>{ann.type.toUpperCase()}</Text>
              <Text style={styles.annotationTextPreview}>{ann.text}</Text>
            </View>
            <TouchableOpacity onPress={() => removeAnnotation(ann.id)}>
              <X color={Colors.status.error} size={16} />
            </TouchableOpacity>
          </View>
        ))}

        <Text style={styles.label}>Add Annotation</Text>
        <View style={styles.annotationTypeRow}>
          {ANNOTATION_TYPES.map(at => {
            const Icon = at.icon;
            return (
              <TouchableOpacity key={at.value}
                style={[styles.annotationTypeChip, newAnnotationType === at.value && styles.annotationTypeChipActive]}
                onPress={() => setNewAnnotationType(at.value)}>
                <Icon color={newAnnotationType === at.value ? Colors.accent.gold : Colors.text.tertiary} size={14} />
                <Text style={[styles.annotationTypeChipText, newAnnotationType === at.value && { color: Colors.accent.gold }]}>{at.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.annotationInputRow}>
          <TextInput style={[styles.input, { flex: 1 }]} value={newAnnotationText} onChangeText={setNewAnnotationText}
            placeholder="Note about this scene..." placeholderTextColor={Colors.text.tertiary} />
          <TouchableOpacity style={styles.addAnnotationBtn} onPress={addAnnotation}>
            <Plus color={Colors.text.inverse} size={18} />
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Director's Notes</Text>
        <TextInput style={[styles.input, styles.textArea]} value={notes} onChangeText={setNotes}
          placeholder="Any additional notes for this scene..." placeholderTextColor={Colors.text.tertiary} multiline numberOfLines={3} />

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>{isEditing ? 'Save Changes' : 'Add Scene to Sides'}</Text>
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
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 10 },
  fieldSmall: { flex: 1 },
  fieldLarge: { flex: 2.5 },
  optionsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  optionChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.bg.card, borderWidth: 0.5, borderColor: Colors.border.subtle },
  optionChipActive: { backgroundColor: Colors.accent.goldBg, borderColor: Colors.accent.gold + '44' },
  optionChipText: { fontSize: 13, color: Colors.text.secondary, fontWeight: '500' as const },
  optionChipTextActive: { color: Colors.accent.gold, fontWeight: '600' as const },
  colorRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  colorChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: Colors.bg.card, borderWidth: 0.5, borderColor: Colors.border.subtle },
  colorChipActive: { borderColor: Colors.accent.gold + '66', backgroundColor: Colors.accent.goldBg },
  colorDot: { width: 10, height: 10, borderRadius: 5 },
  colorChipText: { fontSize: 11, color: Colors.text.secondary, textTransform: 'capitalize' as const },
  annotationRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg.card, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 0.5, borderColor: Colors.border.subtle },
  annotationContent: { flex: 1 },
  annotationTypeLabel: { fontSize: 9, fontWeight: '700' as const, color: Colors.accent.goldDim, letterSpacing: 0.8, marginBottom: 2 },
  annotationTextPreview: { fontSize: 13, color: Colors.text.secondary },
  annotationTypeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  annotationTypeChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: Colors.bg.card, borderWidth: 0.5, borderColor: Colors.border.subtle },
  annotationTypeChipActive: { borderColor: Colors.accent.gold + '44', backgroundColor: Colors.accent.goldBg },
  annotationTypeChipText: { fontSize: 11, color: Colors.text.secondary },
  annotationInputRow: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' },
  addAnnotationBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.accent.gold, justifyContent: 'center', alignItems: 'center' },
  saveBtn: { backgroundColor: Colors.accent.gold, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  saveBtnText: { fontSize: 16, fontWeight: '700' as const, color: Colors.text.inverse },
});
