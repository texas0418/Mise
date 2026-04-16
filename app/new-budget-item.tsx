import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Switch } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { ChevronDown } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useProjects, useProjectBudget } from '@/contexts/ProjectContext';
import Colors from '@/constants/colors';
import { BudgetCategory } from '@/types';
import { BUDGET_CATEGORIES } from '@/mocks/data';

export default function NewBudgetItemScreen() {
  const router = useRouter();
  const { addBudgetItem, updateBudgetItem, activeProjectId, activeProject } = useProjects();
  const budgetItems = useProjectBudget(activeProjectId);
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id;
  const existingItem = editId ? budgetItems.find(b => b.id === editId) : null;
  const isEditing = !!existingItem;

  const [category, setCategory] = useState<BudgetCategory>('equipment');
  const [description, setDescription] = useState('');
  const [estimated, setEstimated] = useState('');
  const [actual, setActual] = useState('');
  const [notes, setNotes] = useState('');
  const [vendor, setVendor] = useState('');
  const [paid, setPaid] = useState(false);
  const [showCategories, setShowCategories] = useState(false);

  // Pre-fill form when editing
  useEffect(() => {
    if (existingItem) {
      setCategory(existingItem.category);
      setDescription(existingItem.description);
      setEstimated(existingItem.estimated.toString());
      setActual(existingItem.actual.toString());
      setNotes(existingItem.notes || '');
      setVendor(existingItem.vendor || '');
      setPaid(existingItem.paid);
    }
  }, [existingItem?.id]);

  const handleSave = useCallback(() => {
    if (!activeProjectId) {
      Alert.alert('No Project', 'Select a project first.');
      return;
    }
    if (!description.trim() || !estimated.trim()) {
      Alert.alert('Missing Info', 'Enter description and estimated amount.');
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const data = {
      id: isEditing ? existingItem!.id : Date.now().toString(),
      projectId: activeProjectId,
      category,
      description: description.trim(),
      estimated: parseFloat(estimated) || 0,
      actual: parseFloat(actual) || 0,
      notes: notes.trim(),
      vendor: vendor.trim() || undefined,
      paid,
    };

    if (isEditing) {
      updateBudgetItem(data);
    } else {
      addBudgetItem(data);
    }
    router.back();
  }, [activeProjectId, category, description, estimated, actual, notes, vendor, paid, addBudgetItem, updateBudgetItem, router, isEditing, existingItem]);

  if (!activeProject) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No project selected</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: isEditing ? 'Edit Budget Item' : 'New Budget Item' }} />

      <View style={styles.projectLabel}>
        <Text style={styles.projectLabelText}>
          {isEditing ? `Editing: ${existingItem!.description}` : `Budget for: ${activeProject.title}`}
        </Text>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Category</Text>
        <TouchableOpacity style={styles.selector} onPress={() => setShowCategories(!showCategories)}>
          <Text style={styles.selectorText}>{BUDGET_CATEGORIES.find(c => c.value === category)?.label}</Text>
          <ChevronDown color={Colors.text.tertiary} size={18} />
        </TouchableOpacity>
        {showCategories && (
          <View style={styles.optionsList}>
            {BUDGET_CATEGORIES.map(c => (
              <TouchableOpacity key={c.value}
                style={[styles.option, category === c.value && styles.optionActive]}
                onPress={() => { setCategory(c.value as BudgetCategory); setShowCategories(false); }}>
                <Text style={[styles.optionText, category === c.value && styles.optionTextActive]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Description</Text>
        <TextInput style={styles.input} value={description} onChangeText={setDescription}
          placeholder="What is this expense for?" placeholderTextColor={Colors.text.tertiary} />
      </View>

      <View style={styles.row}>
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.label}>Estimated ($)</Text>
          <TextInput style={styles.input} value={estimated} onChangeText={setEstimated}
            placeholder="0" placeholderTextColor={Colors.text.tertiary} keyboardType="decimal-pad" />
        </View>
        <View style={{ width: 12 }} />
        <View style={[styles.field, { flex: 1 }]}>
          <Text style={styles.label}>Actual ($)</Text>
          <TextInput style={styles.input} value={actual} onChangeText={setActual}
            placeholder="0" placeholderTextColor={Colors.text.tertiary} keyboardType="decimal-pad" />
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Vendor</Text>
        <TextInput style={styles.input} value={vendor} onChangeText={setVendor}
          placeholder="Vendor or supplier" placeholderTextColor={Colors.text.tertiary} />
      </View>

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Paid</Text>
        <Switch value={paid} onValueChange={setPaid}
          trackColor={{ true: Colors.accent.gold, false: Colors.bg.elevated }} thumbColor={Colors.text.primary} />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Notes</Text>
        <TextInput style={[styles.input, styles.textArea]} value={notes} onChangeText={setNotes}
          placeholder="Additional notes" placeholderTextColor={Colors.text.tertiary}
          multiline numberOfLines={3} textAlignVertical="top" />
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.8}>
        <Text style={styles.saveButtonText}>{isEditing ? 'Save Changes' : 'Add Budget Item'}</Text>
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
  selector: { backgroundColor: Colors.bg.input, borderRadius: 10, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 0.5, borderColor: Colors.border.subtle },
  selectorText: { fontSize: 16, color: Colors.text.primary },
  optionsList: { backgroundColor: Colors.bg.elevated, borderRadius: 10, marginTop: 8, borderWidth: 0.5, borderColor: Colors.border.subtle, overflow: 'hidden', maxHeight: 200 },
  option: { padding: 12, borderBottomWidth: 0.5, borderBottomColor: Colors.border.subtle },
  optionActive: { backgroundColor: Colors.accent.goldBg },
  optionText: { fontSize: 14, color: Colors.text.secondary },
  optionTextActive: { color: Colors.accent.gold, fontWeight: '600' as const },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: Colors.bg.card, borderRadius: 10, padding: 14, marginBottom: 20, borderWidth: 0.5, borderColor: Colors.border.subtle },
  switchLabel: { fontSize: 14, color: Colors.text.primary, fontWeight: '500' as const },
  saveButton: { backgroundColor: Colors.accent.gold, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 12 },
  saveButtonText: { fontSize: 16, fontWeight: '700' as const, color: Colors.text.inverse },
  emptyContainer: { flex: 1, backgroundColor: Colors.bg.primary, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600' as const, color: Colors.text.primary },
});
