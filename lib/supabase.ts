import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

// ---------------------------------------------------------------------------
// Supabase credentials
// The anon key is safe for client-side use — RLS protects all data access.
// Replace YOUR_ANON_KEY_HERE with the anon key from:
//   Supabase Dashboard → Settings → API Keys → Legacy tab → anon public
// ---------------------------------------------------------------------------
const SUPABASE_URL = 'https://mnzkjdpwaibufwhirkon.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1uemtqZHB3YWlidWZ3aGlya29uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1MDM4MTYsImV4cCI6MjA4ODA3OTgxNn0.LotUiQJWvsFZj5OesnzkqgpZ0ExT9_p9yejuCRlF1Jc'; // TODO: paste your anon key

// ---------------------------------------------------------------------------
// Supabase client — singleton, import this throughout the app
//
// Uses AsyncStorage for session persistence (already a project dependency).
// Supabase sessions can exceed 2048 bytes, which is expo-secure-store's
// limit, so AsyncStorage is the safer default. The session is still
// protected by Supabase's JWT expiry and refresh token rotation.
// ---------------------------------------------------------------------------
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Prevents issues with Expo deep linking
  },
});

// ---------------------------------------------------------------------------
// Auto-refresh session when app returns to foreground
// This ensures the auth token stays fresh across background/foreground cycles.
// ---------------------------------------------------------------------------
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
