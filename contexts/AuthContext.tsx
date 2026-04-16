import { useEffect, useState, useCallback } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { supabase } from '@/lib/supabase';
import type { Session, User } from '@supabase/supabase-js';

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
    // 1. Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    // 2. Listen for sign in, sign out, token refresh
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
  // Sign in with Apple (required for App Store apps with auth)
  // Uses Supabase's built-in Apple OAuth provider.
  // Requires Apple Sign In capability in Xcode + Supabase Auth config.
  // -----------------------------------------------------------------------
  const signInWithApple = useCallback(async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
    });
    if (error) throw error;
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
