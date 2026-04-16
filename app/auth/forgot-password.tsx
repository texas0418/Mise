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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Mail } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import Colors from '@/constants/colors';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { resetPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleReset = useCallback(async () => {
    if (!email.trim()) {
      Alert.alert('Missing Email', 'Please enter your email address.');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  }, [email, resetPassword]);

  if (sent) {
    return (
      <View style={[styles.container, styles.centeredContent]}>
        <View style={styles.successIcon}>
          <Mail color={Colors.accent.gold} size={40} />
        </View>
        <Text style={styles.title}>Check Your Email</Text>
        <Text style={styles.description}>
          We sent a password reset link to{'\n'}
          <Text style={styles.emailHighlight}>{email}</Text>
        </Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Back to Sign In</Text>
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
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.description}>
          Enter your email and we'll send you a link to reset your password.
        </Text>

        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <View style={styles.inputRow}>
            <Mail color={Colors.text.tertiary} size={18} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={Colors.text.tertiary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.buttonDisabled]}
          onPress={handleReset}
          activeOpacity={0.8}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.text.inverse} />
          ) : (
            <Text style={styles.primaryButtonText}>Send Reset Link</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <Text style={styles.backText}>Back to Sign In</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  content: { padding: 24, paddingTop: 20, paddingBottom: 40 },
  centeredContent: { justifyContent: 'center', alignItems: 'center', padding: 24 },
  successIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.accent.goldBg, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '700', color: Colors.text.primary, marginBottom: 8, textAlign: 'center' },
  description: { fontSize: 14, color: Colors.text.secondary, marginBottom: 32, lineHeight: 20, textAlign: 'center' },
  emailHighlight: { color: Colors.accent.gold, fontWeight: '600' },
  field: { marginBottom: 24 },
  label: { fontSize: 12, fontWeight: '600', color: Colors.text.secondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg.input, borderRadius: 10, borderWidth: 0.5, borderColor: Colors.border.subtle },
  inputIcon: { marginLeft: 14 },
  input: { flex: 1, padding: 14, fontSize: 16, color: Colors.text.primary },
  primaryButton: { backgroundColor: Colors.accent.gold, borderRadius: 12, padding: 16, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonText: { fontSize: 16, fontWeight: '700', color: Colors.text.inverse },
  backButton: { alignItems: 'center', marginTop: 20, padding: 12 },
  backText: { fontSize: 14, color: Colors.text.secondary },
});
