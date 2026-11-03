// app/auth/callback.tsx: where a magic link or password reset email lands
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import {
  parseAuthLink,
  hasAuthCredential,
  destinationFor,
  takePendingAuthLink,
  type AuthLink,
} from '@/lib/authLinks';
import Colors from '@/constants/colors';
import { useGuardedRouter } from '@/utils/useGuardedRouter';

async function incomingLink(): Promise<string | null> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') return window.location.href;
  return takePendingAuthLink() ?? (await Linking.getInitialURL());
}

/** Turn the link into a session. Returns an error message, or null. */
async function completeSignIn(link: AuthLink): Promise<string | null> {
  if (link.error) return link.error;
  if (!hasAuthCredential(link)) return 'This link has no sign-in code. Ask for a new one.';
  const { error } = link.code
    ? await supabase.auth.exchangeCodeForSession(link.code)
    : await supabase.auth.setSession({
        access_token: link.accessToken!,
        refresh_token: link.refreshToken!,
      });
  return error ? error.message : null;
}

export default function AuthCallbackScreen() {
  const router = useGuardedRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const link = parseAuthLink(await incomingLink());
      const message = await completeSignIn(link);
      if (cancelled) return;
      if (message) {
        setError(message);
        return;
      }
      // Keep the code out of the address bar and the browser history.
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.history.replaceState(null, '', '/');
      }
      router.replace(destinationFor(link) as never);
    })();
    return () => { cancelled = true; };
  }, [router]);

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>That link did not work</Text>
        <Text style={styles.body}>
          {error}
          {'\n\n'}Links expire after a while and work only once. Request a new one and open it on this device.
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.button}
          onPress={() => router.replace('/auth/sign-in' as never)}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Back to Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.accent.gold} />
      <Text style={styles.body}>Signing you in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 22, fontWeight: '700', color: Colors.text.primary, marginBottom: 12, textAlign: 'center' },
  body: { fontSize: 14, color: Colors.text.secondary, lineHeight: 20, textAlign: 'center', marginTop: 16, maxWidth: 420 },
  button: { backgroundColor: Colors.accent.gold, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 28, minWidth: 220 },
  buttonText: { fontSize: 16, fontWeight: '700', color: Colors.text.inverse },
});
