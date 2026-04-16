import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { X, ChevronDown } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useProjects } from '@/contexts/ProjectContext';
import Colors from '@/constants/colors';
import { ProjectStatus } from '@/types';
import { PROJECT_STATUSES, GENRES } from '@/mocks/data';

export default function NewProjectScreen() {
  const router = useRouter();
  const { addProject } = useProjects();

  const [title, setTitle] = useState('');
  const [logline, setLogline] = useState('');
  const [genre, setGenre] = useState('Drama');
  const [format, setFormat] = useState('Short Film');
  const [status, setStatus] = useState<ProjectStatus>('development');
  const [showGenres, setShowGenres] = useState(false);
  const [showStatuses, setShowStatuses] = useState(false);
  const [showFormats, setShowFormats] = useState(false);

  const formats = ['Short Film', 'Feature Film', 'Documentary', 'Music Video', 'Web Series', 'Commercial'];

  const handleSave = useCallback(() => {
    if (!title.trim()) {
      Alert.alert('Missing Title', 'Please enter a project title.');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addProject({
      id: Date.now().toString(),
      title: title.trim(),
      logline: logline.trim(),
      genre,
      status,
      format,
      createdAt: new Date().toISOString().split('T')[0],
    });
    router.back();
  }, [title, logline, genre, status, format, addProject, router]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.field}>
        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Film title"
          placeholderTextColor={Colors.text.tertiary}
          testID="project-title-input"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Logline</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={logline}
          onChangeText={setLogline}
          placeholder="One-line summary of your film"
          placeholderTextColor={Colors.text.tertiary}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Genre</Text>
        <TouchableOpacity style={styles.selector} onPress={() => setShowGenres(!showGenres)} activeOpacity={0.7}>
          <Text style={styles.selectorText}>{genre}</Text>
          <ChevronDown color={Colors.text.tertiary} size={18} />
        </TouchableOpacity>
        {showGenres && (
          <View style={styles.optionsList}>
            {GENRES.map(g => (
              <TouchableOpacity
                key={g}
                style={[styles.option, genre === g && styles.optionActive]}
                onPress={() => { setGenre(g); setShowGenres(false); }}
              >
                <Text style={[styles.optionText, genre === g && styles.optionTextActive]}>{g}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Format</Text>
        <TouchableOpacity style={styles.selector} onPress={() => setShowFormats(!showFormats)} activeOpacity={0.7}>
          <Text style={styles.selectorText}>{format}</Text>
          <ChevronDown color={Colors.text.tertiary} size={18} />
        </TouchableOpacity>
        {showFormats && (
          <View style={styles.optionsList}>
            {formats.map(f => (
              <TouchableOpacity
                key={f}
                style={[styles.option, format === f && styles.optionActive]}
                onPress={() => { setFormat(f); setShowFormats(false); }}
              >
                <Text style={[styles.optionText, format === f && styles.optionTextActive]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Status</Text>
        <TouchableOpacity style={styles.selector} onPress={() => setShowStatuses(!showStatuses)} activeOpacity={0.7}>
          <Text style={styles.selectorText}>{PROJECT_STATUSES.find(s => s.value === status)?.label}</Text>
          <ChevronDown color={Colors.text.tertiary} size={18} />
        </TouchableOpacity>
        {showStatuses && (
          <View style={styles.optionsList}>
            {PROJECT_STATUSES.map(s => (
              <TouchableOpacity
                key={s.value}
                style={[styles.option, status === s.value && styles.optionActive]}
                onPress={() => { setStatus(s.value as ProjectStatus); setShowStatuses(false); }}
              >
                <Text style={[styles.optionText, status === s.value && styles.optionTextActive]}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={handleSave} activeOpacity={0.8} testID="save-project-button">
        <Text style={styles.saveButtonText}>Create Project</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.text.secondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.bg.input,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: Colors.text.primary,
    borderWidth: 0.5,
    borderColor: Colors.border.subtle,
  },
  textArea: {
    minHeight: 80,
    paddingTop: 14,
  },
  selector: {
    backgroundColor: Colors.bg.input,
    borderRadius: 10,
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: Colors.border.subtle,
  },
  selectorText: {
    fontSize: 16,
    color: Colors.text.primary,
  },
  optionsList: {
    backgroundColor: Colors.bg.elevated,
    borderRadius: 10,
    marginTop: 8,
    borderWidth: 0.5,
    borderColor: Colors.border.subtle,
    overflow: 'hidden',
  },
  option: {
    padding: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border.subtle,
  },
  optionActive: {
    backgroundColor: Colors.accent.goldBg,
  },
  optionText: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  optionTextActive: {
    color: Colors.accent.gold,
    fontWeight: '600' as const,
  },
  saveButton: {
    backgroundColor: Colors.accent.gold,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text.inverse,
  },
});
