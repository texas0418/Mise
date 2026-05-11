import { useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import createContextHook from '@nkzw/create-context-hook';
import { supabase } from '@/lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Native Apple Sign In — only available on iOS
// ---------------------------------------------------------------------------
let AppleAuthentication: any = null;
try {
  if (Platform.OS === 'ios') {
    AppleAuthentication = require('expo-apple-authentication');
  }
} catch {
  // expo-apple-authentication not installed or not on iOS
}

// ---------------------------------------------------------------------------
// Auth Context — provides authentication state and actions to the entire app.
//
// Wrap this provider around the app (outside ProjectProvider) so all
// downstream contexts can access the current user.
//
// Usage:
//   const { user, session, signIn, signUp, signOut, isLoading } = useAuth();
// ---------------------------------------------------------------------------

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // -----------------------------------------------------------------------
  // Restore session on mount + listen for auth state changes
  // -----------------------------------------------------------------------
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // -----------------------------------------------------------------------
  // Sign up with email & password
  // -----------------------------------------------------------------------
  const signUp = useCallback(
    async (email: string, password: string, displayName?: string) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
        },
      });
      if (error) throw error;
      return data;
    },
    []
  );

  // -----------------------------------------------------------------------
  // Sign in with email & password
  // -----------------------------------------------------------------------
  const signIn = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      return data;
    },
    []
  );

  // -----------------------------------------------------------------------
  // Sign in with magic link (passwordless)
  // -----------------------------------------------------------------------
  const signInWithMagicLink = useCallback(
    async (email: string) => {
      const { data, error } = await supabase.auth.signInWithOtp({
        email,
      });
      if (error) throw error;
      return data;
    },
    []
  );

  // -----------------------------------------------------------------------
  // Sign in with Apple — NATIVE iOS flow
  //
  // Uses expo-apple-authentication to present the native Apple Sign In
  // dialog, gets an identity token, then passes it to Supabase via
  // signInWithIdToken().
  //
  // The old OAuth redirect approach (signInWithOAuth) does NOT work on
  // native iOS apps because there is no browser to handle the redirect.
  // This was the cause of the App Store rejection (Guideline 2.1a).
  //
  // Requirements:
  //   1. expo-apple-authentication installed (npx expo install expo-apple-authentication)
  //   2. app.json: ios.usesAppleSignIn = true
  //   3. "expo-apple-authentication" in app.json plugins array
  //   4. Apple Sign In enabled in Supabase Auth > Providers dashboard
  // -----------------------------------------------------------------------
  const signInWithApple = useCallback(async () => {
    if (!AppleAuthentication) {
      throw new Error('Apple Sign In is only available on iOS devices.');
    }

    // Check if Apple Sign In is available on this device
    const isAvailable = await AppleAuthentication.isAvailableAsync();
    if (!isAvailable) {
      throw new Error('Apple Sign In is not available on this device. Please use email sign in.');
    }

    // Present the native Apple Sign In dialog
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      throw new Error('Apple Sign In did not return an identity token. Please try again.');
    }

    // Pass the Apple identity token to Supabase
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    });

    if (error) throw error;

    // Apple only provides the user's name on the very first sign-in.
    // Capture it and store it in the Supabase user profile.
    if (credential.fullName?.givenName || credential.fullName?.familyName) {
      const displayName = [
        credential.fullName?.givenName,
        credential.fullName?.familyName,
      ].filter(Boolean).join(' ');

      if (displayName) {
        await supabase.auth.updateUser({
          data: { display_name: displayName },
        });
      }
    }

    return data;
  }, []);

  // -----------------------------------------------------------------------
  // Sign out — clears session from device
  // -----------------------------------------------------------------------
  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  // -----------------------------------------------------------------------
  // Password reset — sends a reset email
  // -----------------------------------------------------------------------
  const resetPassword = useCallback(async (email: string) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
    return data;
  }, []);

  // -----------------------------------------------------------------------
  // Update profile (display name, avatar, etc.)
  // -----------------------------------------------------------------------
  const updateProfile = useCallback(
    async (updates: { displayName?: string; avatarUrl?: string }) => {
      const { data, error } = await supabase.auth.updateUser({
        data: {
          display_name: updates.displayName,
          avatar_url: updates.avatarUrl,
        },
      });
      if (error) throw error;
      return data;
    },
    []
  );

  // -----------------------------------------------------------------------
  // Update password (while signed in)
  // -----------------------------------------------------------------------
  const updatePassword = useCallback(async (newPassword: string) => {
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) throw error;
    return data;
  }, []);

  return {
    // State
    session,
    user,
    isLoading,
    isAuthenticated: !!session,

    // Actions
    signUp,
    signIn,
    signInWithMagicLink,
    signInWithApple,
    signOut,
    resetPassword,
    updateProfile,
    updatePassword,
  };
});
