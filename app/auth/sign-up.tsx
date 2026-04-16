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
import { Mail, Lock, User } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/contexts/AuthContext';
import Colors from '@/constants/colors';

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useAuth();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = useCallback(async () => {
    if (!email.trim()) {
      Alert.alert('Missing Email', 'Please enter your email address.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await signUp(email.trim(), password, displayName.trim() || undefined);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        'Check Your Email',
        'We sent you a confirmation link. Please verify your email to sign in.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Sign Up Failed', error.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [email, password, confirmPassword, displayName, signUp, router]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>
          Sign up to sync your projects across devices.
        </Text>

        {/* Display name */}
        <View style={styles.field}>
          <Text style={styles.label}>Name (optional)</Text>
          <View style={styles.inputRow}>
            <User color={Colors.text.tertiary} size={18} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your name"
              placeholderTextColor={Colors.text.tertiary}
              autoCapitalize="words"
              editable={!loading}
            />
          </View>
        </View>

        {/* Email */}
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

        {/* Password */}
        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputRow}>
            <Lock color={Colors.text.tertiary} size={18} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="At least 6 characters"
              placeholderTextColor={Colors.text.tertiary}
              secureTextEntry
              editable={!loading}
            />
          </View>
        </View>

        {/* Confirm password */}
        <View style={styles.field}>
          <Text style={styles.label}>Confirm Password</Text>
          <View style={styles.inputRow}>
            <Lock color={Colors.text.tertiary} size={18} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Re-enter password"
              placeholderTextColor={Colors.text.tertiary}
              secureTextEntry
              editable={!loading}
            />
          </View>
        </View>

        {/* Sign up button */}
        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.buttonDisabled]}
          onPress={handleSignUp}
          activeOpacity={0.8}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.text.inverse} />
          ) : (
            <Text style={styles.primaryButtonText}>Create Account</Text>
          )}
        </TouchableOpacity>

        {/* Sign in link */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={styles.footerLink}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
  },
  content: {
    padding: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 32,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.input,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: Colors.border.subtle,
  },
  inputIcon: {
    marginLeft: 14,
  },
  input: {
    flex: 1,
    padding: 14,
    fontSize: 16,
    color: Colors.text.primary,
  },
  primaryButton: {
    backgroundColor: Colors.accent.gold,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.inverse,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.accent.gold,
  },
});
