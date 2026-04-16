// app/project/invite.tsx — Invite a member to the current project
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Mail, ChevronDown, Send } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/contexts/AuthContext';
import { useProjects } from '@/contexts/ProjectContext';
import { supabase } from '@/lib/supabase';
import { ALL_ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS, type Role } from '@/lib/permissions';
import Colors from '@/constants/colors';

// Roles that can be assigned (not owner)
const ASSIGNABLE_ROLES = ALL_ROLES.filter(r => r !== 'owner');

export default function InviteScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { activeProjectId, activeProject } = useProjects();

  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState<Role>('crew');
  const [showRoles, setShowRoles] = useState(false);
  const [sending, setSending] = useState(false);

  const handleInvite = useCallback(async () => {
    if (!email.trim()) {
      Alert.alert('Missing Email', 'Enter the email of the person to invite.');
      return;
    }
    if (!activeProjectId || !user?.id) {
      Alert.alert('Error', 'No active project or not signed in.');
      return;
    }

    setSending(true);
    try {
      // Check if already invited
      const { data: existing } = await supabase
        .from('project_members')
        .select('id')
        .eq('project_id', activeProjectId)
        .eq('email', email.trim().toLowerCase())
        .is('deleted_at', null)
        .maybeSingle();

      if (existing) {
        Alert.alert('Already Invited', 'This person is already a member of this project.');
        setSending(false);
        return;
      }


      const { error } = await supabase
        .from('project_members')
        .insert({
          project_id: activeProjectId,
          user_id: null,
          email: email.trim().toLowerCase(),
          role: selectedRole,
          // invited_by: user.id,
          accepted_at: null, // Pending until they accept
        });

      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Invitation Sent',
        `Invited ${email.trim()} as ${ROLE_LABELS[selectedRole]}`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to send invitation.');
    } finally {
      setSending(false);
    }
  }, [email, selectedRole, activeProjectId, user, router]);

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.title}>Invite to {activeProject?.title || 'Project'}</Text>
      <Text style={s.subtitle}>They'll get an invitation to join with the role you assign.</Text>

      {/* Email */}
      <View style={s.field}>
        <Text style={s.label}>Email</Text>
        <View style={s.inputRow}>
          <Mail color={Colors.text.tertiary} size={18} style={s.inputIcon} />
          <TextInput
            style={s.input}
            value={email}
            onChangeText={setEmail}
            placeholder="colleague@example.com"
            placeholderTextColor={Colors.text.tertiary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!sending}
          />
        </View>
      </View>

      {/* Role selector */}
      <View style={s.field}>
        <Text style={s.label}>Role</Text>
        <TouchableOpacity
          style={s.selector}
          onPress={() => setShowRoles(!showRoles)}
          activeOpacity={0.7}
        >
          <Text style={s.selectorText}>{ROLE_LABELS[selectedRole]}</Text>
          <ChevronDown color={Colors.text.tertiary} size={18} />
        </TouchableOpacity>
        {showRoles && (
          <View style={s.optionsList}>
            {ASSIGNABLE_ROLES.map(r => (
              <TouchableOpacity
                key={r}
                style={[s.option, selectedRole === r && s.optionActive]}
                onPress={() => { setSelectedRole(r); setShowRoles(false); }}
              >
                <Text style={[s.optionTitle, selectedRole === r && s.optionTitleActive]}>
                  {ROLE_LABELS[r]}
                </Text>
                <Text style={s.optionDesc}>{ROLE_DESCRIPTIONS[r]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Send button */}
      <TouchableOpacity
        style={[s.sendButton, sending && s.buttonDisabled]}
        onPress={handleInvite}
        activeOpacity={0.8}
        disabled={sending}
      >
        {sending ? (
          <ActivityIndicator color={Colors.text.inverse} size="small" />
        ) : (
          <>
            <Send color={Colors.text.inverse} size={18} />
            <Text style={s.sendButtonText}>Send Invitation</Text>
          </>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  content: { padding: 24, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '700', color: Colors.text.primary, marginBottom: 4 },
  subtitle: { fontSize: 13, color: Colors.text.secondary, marginBottom: 28 },
  field: { marginBottom: 20 },
  label: { fontSize: 12, fontWeight: '600', color: Colors.text.secondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg.input, borderRadius: 10, borderWidth: 0.5, borderColor: Colors.border.subtle },
  inputIcon: { marginLeft: 14 },
  input: { flex: 1, padding: 14, fontSize: 16, color: Colors.text.primary },
  selector: { backgroundColor: Colors.bg.input, borderRadius: 10, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 0.5, borderColor: Colors.border.subtle },
  selectorText: { fontSize: 16, color: Colors.text.primary },
  optionsList: { backgroundColor: Colors.bg.elevated, borderRadius: 10, marginTop: 8, borderWidth: 0.5, borderColor: Colors.border.subtle, overflow: 'hidden' },
  option: { padding: 12, borderBottomWidth: 0.5, borderBottomColor: Colors.border.subtle },
  optionActive: { backgroundColor: Colors.accent.goldBg },
  optionTitle: { fontSize: 14, fontWeight: '600', color: Colors.text.secondary },
  optionTitleActive: { color: Colors.accent.gold },
  optionDesc: { fontSize: 11, color: Colors.text.tertiary, marginTop: 2 },
  sendButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.accent.gold, borderRadius: 12, padding: 16, marginTop: 12 },
  buttonDisabled: { opacity: 0.6 },
  sendButtonText: { fontSize: 16, fontWeight: '700', color: Colors.text.inverse },
});
