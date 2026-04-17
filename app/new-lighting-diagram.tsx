import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { Lightbulb, Check, Star, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useProjects, useProjectLightingDiagrams } from '@/contexts/ProjectContext';
import Colors from '@/constants/colors';
import { LightingTemplateName, LightingElement } from '@/types';
import { LIGHTING_TEMPLATES, getTemplate, loadCustomTemplates, deleteCustomTemplate, CustomTemplate } from '@/utils/lightingTemplates';

export default function NewLightingDiagramScreen() {
  const router = useRouter();
  const { activeProjectId, activeProject, addLightingDiagram, updateLightingDiagram } = useProjects();
  const diagrams = useProjectLightingDiagrams(activeProjectId);
  const params = useLocalSearchParams<{ id?: string; scene?: string; shot?: string }>();
  const editId = params.id;
  const existingItem = editId ? diagrams.find(d => d.id === editId) : null;
  const isEditing = !!existingItem;

  const [title, setTitle] = useState('');
  const [sceneNumber, setSceneNumber] = useState(params.scene ?? '');
  const [shotNumber, setShotNumber] = useState(params.shot ?? '');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [templateName, setTemplateName] = useState<LightingTemplateName>('three-point');
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>([]);
  const [selectedCustomId, setSelectedCustomId] = useState<string | null>(null);

  // Load custom templates
  useEffect(() => {
    loadCustomTemplates().then(setCustomTemplates);
  }, []);

  const handleDeleteCustomTemplate = useCallback((tmpl: CustomTemplate) => {
    Alert.alert('Delete Template', `Remove "${tmpl.label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await deleteCustomTemplate(tmpl.id);
          setCustomTemplates(prev => prev.filter(t => t.id !== tmpl.id));
          if (selectedCustomId === tmpl.id) {
            setSelectedCustomId(null);
            setTemplateName('three-point');
          }
        },
      },
    ]);
  }, [selectedCustomId]);

  useEffect(() => {
    if (existingItem) {
      setTitle(existingItem.title);
      setSceneNumber(existingItem.sceneNumber?.toString() ?? '');
      setShotNumber(existingItem.shotNumber ?? '');
      setDescription(existingItem.description);
      setNotes(existingItem.notes);
      setTemplateName(existingItem.templateName);
    }
  }, [existingItem?.id]);

  const handleSave = useCallback(() => {
    if (!activeProjectId) {
      Alert.alert('No Project', 'Select a project first.');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Give your lighting diagram a name.');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const now = new Date().toISOString();

    if (isEditing) {
      // Update metadata only — don't overwrite elements
      updateLightingDiagram({
        ...existingItem!,
        title: title.trim(),
        sceneNumber: sceneNumber ? parseInt(sceneNumber) : undefined,
        shotNumber: shotNumber.trim() || undefined,
        description: description.trim(),
        notes: notes.trim(),
        // Don't change templateName or elements when editing metadata
        updatedAt: now,
      });
    } else {
      // Create new diagram with template elements
      let sourceElements: Omit<LightingElement, 'id'>[];
      const customTmpl = selectedCustomId ? customTemplates.find(t => t.id === selectedCustomId) : null;

      if (customTmpl) {
        sourceElements = customTmpl.elements;
      } else {
        const template = getTemplate(templateName);
        sourceElements = template.elements;
      }

      const elements: LightingElement[] = sourceElements.map((el, i) => ({
        ...el,
        id: `el-${Date.now()}-${i}`,
      }));

      addLightingDiagram({
        id: Date.now().toString(),
        projectId: activeProjectId,
        sceneNumber: sceneNumber ? parseInt(sceneNumber) : undefined,
        shotNumber: shotNumber.trim() || undefined,
        title: title.trim(),
        description: description.trim(),
        templateName: customTmpl ? 'blank' as LightingTemplateName : templateName,
        elements,
        bgStyle: 'dark',
        notes: notes.trim(),
        createdAt: now,
        updatedAt: now,
      });
    }

    router.back();
  }, [activeProjectId, title, sceneNumber, shotNumber, description, notes, templateName, selectedCustomId, customTemplates, isEditing, existingItem, addLightingDiagram, updateLightingDiagram, router]);

  if (!activeProject) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No project selected</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: isEditing ? 'Edit Diagram Info' : 'New Lighting Diagram' }} />

      {isEditing && (
        <View style={styles.projectLabel}>
          <Text style={styles.projectLabelText}>Editing: {existingItem!.title}</Text>
        </View>
      )}

      {/* Title */}
      <Text style={styles.label}>Title *</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Interview Setup — Scene 5"
        placeholderTextColor={Colors.text.tertiary}
      />

      {/* Scene / Shot link */}
      <View style={styles.row}>
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.label}>Scene Number</Text>
          <TextInput
            style={styles.input}
            value={sceneNumber}
            onChangeText={setSceneNumber}
            placeholder="—"
            placeholderTextColor={Colors.text.tertiary}
            keyboardType="number-pad"
          />
        </View>
        <View style={{ width: 12 }} />
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.label}>Shot Number</Text>
          <TextInput
            style={styles.input}
            value={shotNumber}
            onChangeText={setShotNumber}
            placeholder="e.g. 5A"
            placeholderTextColor={Colors.text.tertiary}
          />
        </View>
      </View>

      {/* Template picker — only for new diagrams */}
      {!isEditing && (
        <>
          <Text style={styles.label}>Starting Template</Text>
          <View style={styles.templateGrid}>
            {LIGHTING_TEMPLATES.map(tmpl => {
              const selected = !selectedCustomId && templateName === tmpl.name;
              return (
                <TouchableOpacity
                  key={tmpl.name}
                  style={[styles.templateCard, selected && styles.templateCardSelected]}
                  onPress={() => { setTemplateName(tmpl.name); setSelectedCustomId(null); }}
                  activeOpacity={0.7}
                >
                  <View style={styles.templateCardHeader}>
                    <Lightbulb color={selected ? Colors.accent.gold : Colors.text.tertiary} size={14} />
                    {selected && <Check color={Colors.accent.gold} size={14} />}
                  </View>
                  <Text style={[styles.templateLabel, selected && styles.templateLabelSelected]}>{tmpl.label}</Text>
                  <Text style={styles.templateDesc} numberOfLines={2}>{tmpl.description}</Text>
                  <Text style={styles.templateCount}>{tmpl.elements.length} elements</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Custom templates */}
          {customTemplates.length > 0 && (
            <>
              <Text style={[styles.label, { marginTop: 20 }]}>Your Saved Templates</Text>
              <View style={styles.templateGrid}>
                {customTemplates.map(tmpl => {
                  const selected = selectedCustomId === tmpl.id;
                  return (
                    <TouchableOpacity
                      key={tmpl.id}
                      style={[styles.templateCard, selected && styles.templateCardSelected]}
                      onPress={() => { setSelectedCustomId(tmpl.id); }}
                      onLongPress={() => handleDeleteCustomTemplate(tmpl)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.templateCardHeader}>
                        <Star color={selected ? Colors.accent.gold : '#FB923C'} size={14} />
                        {selected && <Check color={Colors.accent.gold} size={14} />}
                      </View>
                      <Text style={[styles.templateLabel, selected && styles.templateLabelSelected]}>{tmpl.label}</Text>
                      <Text style={styles.templateDesc} numberOfLines={2}>{tmpl.description}</Text>
                      <Text style={styles.templateCount}>{tmpl.elements.length} elements · long-press to delete</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
        </>
      )}

      {/* Description */}
      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={description}
        onChangeText={setDescription}
        placeholder="What's the lighting goal for this setup?"
        placeholderTextColor={Colors.text.tertiary}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
      />

      {/* Notes */}
      <Text style={styles.label}>Notes</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={notes}
        onChangeText={setNotes}
        placeholder="Gel colors, fixture specifics, safety notes..."
        placeholderTextColor={Colors.text.tertiary}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
      />

      {/* Save */}
      <TouchableOpacity
        style={[styles.saveButton, !title.trim() && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={!title.trim()}
        activeOpacity={0.8}
      >
        <Text style={styles.saveButtonText}>
          {isEditing ? 'Save Changes' : 'Create Diagram'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  content: { padding: 20, paddingBottom: 40 },
  projectLabel: { backgroundColor: Colors.accent.goldBg, borderRadius: 8, padding: 10, marginBottom: 16 },
  projectLabelText: { fontSize: 13, color: Colors.accent.gold, fontWeight: '600' as const },
  row: { flexDirection: 'row' },
  field: { marginBottom: 0 },
  label: {
    fontSize: 12, fontWeight: '700' as const, color: Colors.text.secondary,
    textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 8, marginTop: 18,
  },
  input: {
    backgroundColor: Colors.bg.input, borderRadius: 10, padding: 14,
    fontSize: 15, color: Colors.text.primary,
    borderWidth: 0.5, borderColor: Colors.border.subtle,
  },
  textArea: { minHeight: 80, paddingTop: 14 },

  // Template grid
  templateGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
  },
  templateCard: {
    width: '47%' as unknown as number, flexGrow: 0, flexShrink: 0, flexBasis: '47%',
    backgroundColor: Colors.bg.card, borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: Colors.border.subtle,
  },
  templateCardSelected: {
    borderColor: Colors.accent.gold + '88',
    backgroundColor: Colors.accent.goldBg,
  },
  templateCardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6,
  },
  templateLabel: { fontSize: 13, fontWeight: '700' as const, color: Colors.text.primary, marginBottom: 2 },
  templateLabelSelected: { color: Colors.accent.gold },
  templateDesc: { fontSize: 11, color: Colors.text.tertiary, lineHeight: 15, marginBottom: 4 },
  templateCount: { fontSize: 10, color: Colors.text.tertiary, fontWeight: '600' as const },

  // Save
  saveButton: {
    backgroundColor: Colors.accent.gold, borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 24,
  },
  saveButtonDisabled: { opacity: 0.4 },
  saveButtonText: { fontSize: 16, fontWeight: '700' as const, color: Colors.text.inverse },
  emptyContainer: { flex: 1, backgroundColor: Colors.bg.primary, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600' as const, color: Colors.text.primary },
});
