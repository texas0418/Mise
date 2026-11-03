// app/auth/set-new-password.tsx: the end of a password reset
//
// A reset email lands on app/auth/callback.tsx, which signs the user in from
// the link and sends them here to choose the new password.
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Lock } from 'lucide-react-native';
import { useLayout } from '@/utils/useLayout';
import { appAlert } from '@/lib/appAlert';
import { useAuth } from '@/contexts/AuthContext';
import Colors from '@/constants/colors';
import { useGuardedRouter } from '@/utils/useGuardedRouter';

const MIN_LENGTH = 6;

export default function SetNewPasswordScreen() {
  const { formColumn } = useLayout();
  const router = useGuardedRouter();
  const { updatePassword, isAuthenticated } = useAuth();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSave = useCallback(async () => {
    if (password.length < MIN_LENGTH) {
      appAlert('Password Too Short', `Use at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      appAlert('Passwords Differ', 'The two passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await updatePassword(password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      appAlert('Password Changed', 'Your new password is set.', [
        { text: 'OK', onPress: () => router.replace('/' as never) },
      ]);
    } catch (error: any) {
      appAlert('Error', error.message || 'Failed to change the password.');
    } finally {
      setLoading(false);
    }
  }, [password, confirm, updatePassword, router]);

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, styles.centeredContent]}>
        <Text style={styles.title}>Link Expired</Text>
        <Text style={styles.description}>
          This reset link is no longer signed in. Request a new one from Sign In.
        </Text>
        <TouchableOpacity accessibilityRole="button"
          style={styles.primaryButton}
          onPress={() => router.replace('/auth/forgot-password' as never)}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Send a New Link</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={[styles.content, formColumn]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Choose a New Password</Text>
        <Text style={styles.description}>You will use it the next time you sign in.</Text>

        {[
          { label: 'New Password', value: password, onChange: setPassword },
          { label: 'Confirm Password', value: confirm, onChange: setConfirm },
        ].map(field => (
          <View key={field.label} style={styles.field}>
            <Text style={styles.label}>{field.label}</Text>
            <View style={styles.inputRow}>
              <Lock color={Colors.text.tertiary} size={18} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={field.value}
                onChangeText={field.onChange}
                placeholder="••••••••"
                placeholderTextColor={Colors.text.tertiary}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="newPassword"
                accessibilityLabel={field.label}
                editable={!loading}
              />
            </View>
          </View>
        ))}

        <TouchableOpacity accessibilityRole="button"
          style={[styles.primaryButton, loading && styles.buttonDisabled]}
          onPress={handleSave}
          activeOpacity={0.8}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.text.inverse} />
          ) : (
            <Text style={styles.primaryButtonText}>Save Password</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  content: { padding: 24, paddingTop: 20, paddingBottom: 40 },
  centeredContent: { justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: '700', color: Colors.text.primary, marginBottom: 8, textAlign: 'center' },
  description: { fontSize: 14, color: Colors.text.secondary, marginBottom: 32, lineHeight: 20, textAlign: 'center' },
  field: { marginBottom: 24 },
  label: { fontSize: 12, fontWeight: '600', color: Colors.text.secondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg.input, borderRadius: 10, borderWidth: 0.5, borderColor: Colors.border.subtle },
  inputIcon: { marginLeft: 14 },
  input: { flex: 1, padding: 14, fontSize: 16, color: Colors.text.primary },
  primaryButton: { backgroundColor: Colors.accent.gold, borderRadius: 12, padding: 16, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonText: { fontSize: 16, fontWeight: '700', color: Colors.text.inverse },
});
