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
import { Mail, Lock, Clapperboard } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/contexts/AuthContext';
import Colors from '@/constants/colors';

export default function SignInScreen() {
  const router = useRouter();
  const { signIn, signInWithMagicLink, signInWithApple } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  // -----------------------------------------------------------------------
  // Email + Password sign in
  // -----------------------------------------------------------------------
  const handleSignIn = useCallback(async () => {
    if (!email.trim()) {
      Alert.alert('Missing Email', 'Please enter your email address.');
      return;
    }
    if (!password.trim()) {
      Alert.alert('Missing Password', 'Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      await signIn(email.trim(), password);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)');
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Sign In Failed', error.message || 'Please check your credentials.');
    } finally {
      setLoading(false);
    }
  }, [email, password, signIn, router]);

  // -----------------------------------------------------------------------
  // Magic link (passwordless)
  // -----------------------------------------------------------------------
  const handleMagicLink = useCallback(async () => {
    if (!email.trim()) {
      Alert.alert('Missing Email', 'Please enter your email to receive a magic link.');
      return;
    }

    setLoading(true);
    try {
      await signInWithMagicLink(email.trim());
      setMagicLinkSent(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Check Your Email', 'We sent you a magic link. Tap it to sign in.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send magic link.');
    } finally {
      setLoading(false);
    }
  }, [email, signInWithMagicLink]);

  // -----------------------------------------------------------------------
  // Apple sign in
  // -----------------------------------------------------------------------
  const handleAppleSignIn = useCallback(async () => {
    setLoading(true);
    try {
      await signInWithApple();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Apple Sign In Failed', error.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [signInWithApple]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo / Brand */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Clapperboard color={Colors.accent.gold} size={48} />
          </View>
          <Text style={styles.appName}>Mise</Text>
          <Text style={styles.tagline}>Your film, organized.</Text>
        </View>

        {/* Email field */}
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

        {/* Password field */}
        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputRow}>
            <Lock color={Colors.text.tertiary} size={18} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              placeholderTextColor={Colors.text.tertiary}
              secureTextEntry
              editable={!loading}
            />
          </View>
        </View>

        {/* Forgot password */}
        <TouchableOpacity
          style={styles.forgotButton}
          onPress={() => router.push('/auth/forgot-password')}
          activeOpacity={0.7}
        >
          <Text style={styles.forgotText}>Forgot password?</Text>
        </TouchableOpacity>

        {/* Sign in button */}
        <TouchableOpacity
          style={[styles.primaryButton, loading && styles.buttonDisabled]}
          onPress={handleSignIn}
          activeOpacity={0.8}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={Colors.text.inverse} />
          ) : (
            <Text style={styles.primaryButtonText}>Sign In</Text>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Magic link */}
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleMagicLink}
          activeOpacity={0.7}
          disabled={loading}
        >
          <Mail color={Colors.accent.gold} size={18} />
          <Text style={styles.secondaryButtonText}>Send Magic Link</Text>
        </TouchableOpacity>

        {/* Apple sign in */}
        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={styles.appleButton}
            onPress={handleAppleSignIn}
            activeOpacity={0.7}
            disabled={loading}
          >
            <Text style={styles.appleButtonText}> Sign in with Apple</Text>
          </TouchableOpacity>
        )}

        {/* Sign up link */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/auth/sign-up')} activeOpacity={0.7}>
            <Text style={styles.footerLink}>Create one</Text>
          </TouchableOpacity>
        </View>

        {/* Skip / Continue without account */}
        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => router.replace('/(tabs)')}
          activeOpacity={0.7}
        >
          <Text style={styles.skipText}>Continue without account</Text>
        </TouchableOpacity>
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
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: Colors.accent.goldBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  appName: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 4,
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
  forgotButton: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotText: {
    fontSize: 13,
    color: Colors.accent.gold,
  },
  primaryButton: {
    backgroundColor: Colors.accent.gold,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.inverse,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 0.5,
    backgroundColor: Colors.border.medium,
  },
  dividerText: {
    fontSize: 13,
    color: Colors.text.tertiary,
    marginHorizontal: 12,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.bg.input,
    borderRadius: 12,
    padding: 16,
    borderWidth: 0.5,
    borderColor: Colors.border.subtle,
    marginBottom: 12,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.accent.gold,
  },
  appleButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  appleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
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
  skipButton: {
    alignItems: 'center',
    marginTop: 16,
    padding: 12,
  },
  skipText: {
    fontSize: 13,
    color: Colors.text.tertiary,
  },
});
