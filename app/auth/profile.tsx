import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { User, Lock, LogOut, Trash2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import Colors from '@/constants/colors';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, signOut, updateProfile, updatePassword } = useAuth();

  const [displayName, setDisplayName] = useState(
    user?.user_metadata?.display_name || ''
  );
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSaveProfile = useCallback(async () => {
    setSavingProfile(true);
    try {
      await updateProfile({ displayName: displayName.trim() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Saved', 'Your profile has been updated.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  }, [displayName, updateProfile]);

  const handleChangePassword = useCallback(async () => {
    if (newPassword.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      await updatePassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Updated', 'Your password has been changed.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to change password.');
    } finally {
      setSavingPassword(false);
    }
  }, [newPassword, confirmPassword, updatePassword]);

  const handleSignOut = useCallback(async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
            router.replace('/auth/sign-in');
          } catch (error: any) {
            Alert.alert('Error', error.message);
          }
        },
      },
    ]);
  }, [signOut, router]);

  const handleDeleteAccount = useCallback(async () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your production data from our servers. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you sure?',
              'All your projects, shots, budgets, lighting diagrams, and other data will be permanently deleted. This action is irreversible.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, Delete Everything',
                  style: 'destructive',
                  onPress: async () => {
                    setDeleting(true);
                    try {
                      const userId = user?.id;
                      if (!userId) throw new Error('No user ID found.');

                      // Delete all user data from every table
                      const tables = [
                        'shots', 'schedule_days', 'crew_members', 'takes',
                        'scene_breakdowns', 'location_scouts', 'budget_items',
                        'continuity_notes', 'vfx_shots', 'festival_submissions',
                        'production_notes', 'mood_board_items', 'call_sheet_entries',
                        'director_credits', 'shot_references', 'wrap_reports',
                        'location_weather', 'blocking_notes', 'color_references',
                        'time_entries', 'script_sides', 'cast_members',
                        'lookbook_items', 'director_statements', 'scene_selects',
                        'director_messages', 'script_annotations', 'script_pdfs',
                        'projects',
                      ];

                      for (const table of tables) {
                        await supabase.from(table).delete().eq('user_id', userId);
                      }

                      // Sign out and navigate to sign-in
                      await signOut();
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      router.replace('/auth/sign-in');
                    } catch (error: any) {
                      Alert.alert('Error', error.message || 'Failed to delete account. Please contact support at hello@mise.app.');
                    } finally {
                      setDeleting(false);
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  }, [user, signOut, router]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Account info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Email</Text>
          <Text style={styles.infoValue}>{user?.email || 'Not signed in'}</Text>
        </View>
      </View>

      {/* Display name */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Display Name</Text>
        <View style={styles.field}>
          <View style={styles.inputRow}>
            <User color={Colors.text.tertiary} size={18} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your name"
              placeholderTextColor={Colors.text.tertiary}
              autoCapitalize="words"
            />
          </View>
        </View>
        <TouchableOpacity
          style={[styles.saveButton, savingProfile && styles.buttonDisabled]}
          onPress={handleSaveProfile}
          activeOpacity={0.8}
          disabled={savingProfile}
        >
          {savingProfile ? (
            <ActivityIndicator color={Colors.text.inverse} size="small" />
          ) : (
            <Text style={styles.saveButtonText}>Save Name</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Change password */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Change Password</Text>
        <View style={styles.field}>
          <View style={styles.inputRow}>
            <Lock color={Colors.text.tertiary} size={18} style={styles.inputIcon} />
            <TextInput style={styles.input} value={newPassword} onChangeText={setNewPassword} placeholder="New password" placeholderTextColor={Colors.text.tertiary} secureTextEntry />
          </View>
        </View>
        <View style={styles.field}>
          <View style={styles.inputRow}>
            <Lock color={Colors.text.tertiary} size={18} style={styles.inputIcon} />
            <TextInput style={styles.input} value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm new password" placeholderTextColor={Colors.text.tertiary} secureTextEntry />
          </View>
        </View>
        <TouchableOpacity
          style={[styles.saveButton, savingPassword && styles.buttonDisabled]}
          onPress={handleChangePassword}
          activeOpacity={0.8}
          disabled={savingPassword}
        >
          {savingPassword ? (
            <ActivityIndicator color={Colors.text.inverse} size="small" />
          ) : (
            <Text style={styles.saveButtonText}>Update Password</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Sign out */}
      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} activeOpacity={0.7}>
        <LogOut color={Colors.status.error} size={18} />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      {/* Delete account */}
      <View style={styles.dangerZone}>
        <Text style={styles.dangerTitle}>Danger Zone</Text>
        <Text style={styles.dangerDesc}>
          Permanently delete your account and all production data from our servers. This cannot be undone.
        </Text>
        <TouchableOpacity
          style={[styles.deleteButton, deleting && styles.buttonDisabled]}
          onPress={handleDeleteAccount}
          activeOpacity={0.7}
          disabled={deleting}
        >
          {deleting ? (
            <ActivityIndicator color={Colors.status.error} size="small" />
          ) : (
            <>
              <Trash2 color={Colors.status.error} size={16} />
              <Text style={styles.deleteText}>Delete Account</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  content: { padding: 20, paddingBottom: 60 },
  section: { marginBottom: 32 },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: Colors.text.secondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  infoRow: { backgroundColor: Colors.bg.card, borderRadius: 10, padding: 14, borderWidth: 0.5, borderColor: Colors.border.subtle },
  infoLabel: { fontSize: 11, color: Colors.text.tertiary, marginBottom: 4 },
  infoValue: { fontSize: 16, color: Colors.text.primary },
  field: { marginBottom: 12 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg.input, borderRadius: 10, borderWidth: 0.5, borderColor: Colors.border.subtle },
  inputIcon: { marginLeft: 14 },
  input: { flex: 1, padding: 14, fontSize: 16, color: Colors.text.primary },
  saveButton: { backgroundColor: Colors.accent.gold, borderRadius: 10, padding: 14, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  saveButtonText: { fontSize: 14, fontWeight: '700', color: Colors.text.inverse },
  signOutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.bg.card, borderRadius: 12, padding: 16, borderWidth: 0.5, borderColor: Colors.border.subtle, marginBottom: 32 },
  signOutText: { fontSize: 16, fontWeight: '600', color: Colors.status.error },
  dangerZone: { borderTopWidth: 0.5, borderTopColor: Colors.status.error + '33', paddingTop: 24 },
  dangerTitle: { fontSize: 12, fontWeight: '700', color: Colors.status.error, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  dangerDesc: { fontSize: 13, color: Colors.text.tertiary, lineHeight: 19, marginBottom: 16 },
  deleteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: Colors.status.error + '44', backgroundColor: Colors.status.error + '0A' },
  deleteText: { fontSize: 15, fontWeight: '600', color: Colors.status.error },
});
