import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Send, Zap } from 'lucide-react-native';
import { useProjects } from '@/contexts/ProjectContext';
import { MESSAGE_TEMPLATES } from '@/mocks/data';
import { useLayout } from '@/utils/useLayout';
import Colors from '@/constants/colors';
import { DirectorMessage, MessagePriority, MessageCategory } from '@/types';

const PRIORITY_OPTIONS: { key: MessagePriority; label: string; color: string }[] = [
  { key: 'normal', label: 'Normal', color: Colors.text.secondary },
  { key: 'urgent', label: 'Urgent', color: '#EF4444' },
  { key: 'fyi', label: 'FYI', color: '#60A5FA' },
];

const RECIPIENT_OPTIONS = ['All Departments', 'Camera', 'Sound', 'Lighting', 'Art', 'Production', 'Talent', 'Post'];

export default function NewMessageScreen() {
  const { activeProjectId, addMessage } = useProjects();
  const router = useRouter();
  const { isTablet, contentPadding } = useLayout();

  const [showTemplates, setShowTemplates] = useState(true);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [priority, setPriority] = useState<MessagePriority>('normal');
  const [category, setCategory] = useState<MessageCategory>('general');
  const [recipients, setRecipients] = useState<string[]>(['All Departments']);
  const [sceneNumber, setSceneNumber] = useState('');

  const toggleRecipient = (r: string) => {
    if (r === 'All Departments') {
      setRecipients(['All Departments']);
      return;
    }
    let next = recipients.filter(x => x !== 'All Departments');
    if (next.includes(r)) {
      next = next.filter(x => x !== r);
    } else {
      next.push(r);
    }
    setRecipients(next.length === 0 ? ['All Departments'] : next);
  };

  const applyTemplate = (template: typeof MESSAGE_TEMPLATES[0]) => {
    setSubject(template.subject);
    setBody(template.body);
    setCategory(template.category);
    setRecipients(template.defaultRecipients);
    setShowTemplates(false);
  };

  const handleSend = () => {
    if (!subject.trim()) {
      Alert.alert('Required', 'Subject is required.');
      return;
    }

    const msg: DirectorMessage = {
      id: Date.now().toString(),
      projectId: activeProjectId || '1',
      category,
      priority,
      subject: subject.trim(),
      body: body.trim(),
      recipients,
      sentAt: new Date().toISOString(),
      sceneNumber: sceneNumber ? parseInt(sceneNumber) : undefined,
    };

    addMessage(msg);
    router.back();
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, {
          paddingHorizontal: contentPadding,
          maxWidth: isTablet ? 700 : undefined,
          alignSelf: isTablet ? 'center' as const : undefined,
          width: isTablet ? '100%' : undefined,
        }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Quick Templates */}
        {showTemplates && (
          <View style={styles.templateSection}>
            <View style={styles.templateHeader}>
              <Zap color={Colors.accent.gold} size={16} />
              <Text style={styles.templateTitle}>Quick Templates</Text>
            </View>
            <View style={styles.templateGrid}>
              {MESSAGE_TEMPLATES.map((t, i) => (
                <TouchableOpacity key={i} style={styles.templateChip} onPress={() => applyTemplate(t)}>
                  <Text style={styles.templateChipText}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={() => setShowTemplates(false)}>
              <Text style={styles.skipText}>Or write from scratch ↓</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Priority */}
        <Text style={styles.sectionTitle}>Priority</Text>
        <View style={styles.optionsRow}>
          {PRIORITY_OPTIONS.map(p => (
            <TouchableOpacity
              key={p.key}
              style={[styles.priChip, priority === p.key && { borderColor: p.color + '66', backgroundColor: p.color + '12' }]}
              onPress={() => setPriority(p.key)}
            >
              <Text style={[styles.priChipText, priority === p.key && { color: p.color }]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Subject */}
        <Text style={styles.label}>Subject *</Text>
        <TextInput
          style={styles.input}
          value={subject}
          onChangeText={setSubject}
          placeholder="Moving on from Scene 5..."
          placeholderTextColor={Colors.text.tertiary}
        />

        {/* Scene (optional) */}
        <Text style={styles.label}>Scene # (optional)</Text>
        <TextInput
          style={[styles.input, { width: 100 }]}
          value={sceneNumber}
          onChangeText={setSceneNumber}
          placeholder="5"
          placeholderTextColor={Colors.text.tertiary}
          keyboardType="number-pad"
        />

        {/* Body */}
        <Text style={styles.label}>Message</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={body}
          onChangeText={setBody}
          placeholder="Fill in the details. Use {scene}, {time}, {reason} as placeholders..."
          placeholderTextColor={Colors.text.tertiary}
          multiline
          numberOfLines={5}
        />

        {/* Recipients */}
        <Text style={styles.sectionTitle}>Recipients</Text>
        <View style={styles.recipientGrid}>
          {RECIPIENT_OPTIONS.map(r => {
            const selected = recipients.includes(r);
            return (
              <TouchableOpacity
                key={r}
                style={[styles.recipientChip, selected && styles.recipientChipActive]}
                onPress={() => toggleRecipient(r)}
              >
                <Text style={[styles.recipientChipText, selected && styles.recipientChipTextActive]}>{r}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Send */}
        <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
          <Send color={Colors.text.inverse} size={18} />
          <Text style={styles.sendBtnText}>Send Message</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  scrollContent: { padding: 16, paddingBottom: 40 },
  templateSection: { backgroundColor: Colors.bg.card, borderRadius: 12, padding: 16, marginBottom: 20, borderWidth: 0.5, borderColor: Colors.border.subtle },
  templateHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  templateTitle: { fontSize: 14, fontWeight: '700', color: Colors.accent.gold, letterSpacing: 0.3 },
  templateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  templateChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.bg.tertiary, borderWidth: 0.5, borderColor: Colors.border.subtle },
  templateChipText: { fontSize: 13, fontWeight: '500', color: Colors.text.primary },
  skipText: { fontSize: 12, color: Colors.text.tertiary, textAlign: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.accent.gold, marginTop: 20, marginBottom: 12, letterSpacing: 0.3 },
  label: { fontSize: 12, fontWeight: '600', color: Colors.text.secondary, marginBottom: 6, marginTop: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: Colors.bg.card, borderRadius: 10, padding: 14, fontSize: 15, color: Colors.text.primary, borderWidth: 0.5, borderColor: Colors.border.subtle },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  optionsRow: { flexDirection: 'row', gap: 10 },
  priChip: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.bg.card, borderWidth: 0.5, borderColor: Colors.border.subtle, alignItems: 'center' },
  priChipText: { fontSize: 13, fontWeight: '600', color: Colors.text.secondary },
  recipientGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  recipientChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: Colors.bg.card, borderWidth: 0.5, borderColor: Colors.border.subtle },
  recipientChipActive: { backgroundColor: Colors.accent.goldBg, borderColor: Colors.accent.gold + '44' },
  recipientChipText: { fontSize: 13, fontWeight: '500', color: Colors.text.secondary },
  recipientChipTextActive: { color: Colors.accent.gold, fontWeight: '600' },
  sendBtn: { flexDirection: 'row', backgroundColor: Colors.accent.gold, borderRadius: 12, padding: 16, alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 24 },
  sendBtnText: { fontSize: 16, fontWeight: '700', color: Colors.text.inverse },
});
