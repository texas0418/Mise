// ---------------------------------------------------------------------------
// components/V2MigrationFlow.tsx — Shown to existing v1 users on first v2 launch
//
// Offers: sign in to enable sync, or skip to stay local-only.
// If user signs in, triggers initial upload of local data to Supabase.
// ---------------------------------------------------------------------------

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { Cloud, CloudOff, ArrowRight, Upload, LogIn } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/AuthContext';
import { useSync } from '@/contexts/SyncContext';
import Colors from '@/constants/colors';

const V2_MIGRATION_KEY = 'mise_v2_migration_done';

export async function hasCompletedV2Migration(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(V2_MIGRATION_KEY)) === 'done';
  } catch {
    return false;
  }
}

export async function completeV2Migration(): Promise<void> {
  await AsyncStorage.setItem(V2_MIGRATION_KEY, 'done');
}

interface Props {
  onComplete: () => void;
}

export default function V2MigrationFlow({ onComplete }: Props) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { doInitialUpload } = useSync();

  const [step, setStep] = useState<'intro' | 'uploading' | 'done'>('intro');
  const [uploadCount, setUploadCount] = useState(0);

  const handleSignIn = useCallback(() => {
    // Navigate to sign-in, then come back
    router.push('/auth/sign-in');
  }, [router]);

  const handleUpload = useCallback(async () => {
    setStep('uploading');
    try {
      const count = await doInitialUpload();
      setUploadCount(count);
      setStep('done');
    } catch (e: any) {
      Alert.alert('Upload Error', e.message || 'Failed to upload data. You can try again later from Sync Settings.');
      setStep('done');
    }
  }, [doInitialUpload]);

  const handleSkip = useCallback(async () => {
    await completeV2Migration();
    onComplete();
  }, [onComplete]);

  const handleFinish = useCallback(async () => {
    await completeV2Migration();
    onComplete();
  }, [onComplete]);

  // If user signed in and came back, show upload option
  if (isAuthenticated && step === 'intro') {
    return (
      <View style={s.container}>
        <View style={s.content}>
          <View style={s.iconWrap}>
            <Upload color={Colors.accent.gold} size={40} />
          </View>
          <Text style={s.title}>Sync Your Data</Text>
          <Text style={s.desc}>
            You're signed in! Would you like to upload your existing projects
            to the cloud? This enables multi-device sync.
          </Text>
          <Text style={s.note}>
            Your local data stays intact either way.
          </Text>

          <TouchableOpacity style={s.primaryBtn} onPress={handleUpload} activeOpacity={0.8}>
            <Cloud color={Colors.text.inverse} size={18} />
            <Text style={s.primaryBtnText}>Upload & Enable Sync</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.skipBtn} onPress={handleSkip} activeOpacity={0.7}>
            <Text style={s.skipBtnText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (step === 'uploading') {
    return (
      <View style={s.container}>
        <View style={s.content}>
          <ActivityIndicator color={Colors.accent.gold} size="large" />
          <Text style={s.title}>Uploading...</Text>
          <Text style={s.desc}>Syncing your projects and data to the cloud.</Text>
        </View>
      </View>
    );
  }

  if (step === 'done') {
    return (
      <View style={s.container}>
        <View style={s.content}>
          <View style={s.iconWrap}>
            <Cloud color={Colors.accent.gold} size={40} />
          </View>
          <Text style={s.title}>All Set!</Text>
          <Text style={s.desc}>
            {uploadCount > 0
              ? `Uploaded ${uploadCount} records. Your data is now synced across devices.`
              : 'Sync is enabled. Any new changes will sync automatically.'
            }
          </Text>
          <TouchableOpacity style={s.primaryBtn} onPress={handleFinish} activeOpacity={0.8}>
            <ArrowRight color={Colors.text.inverse} size={18} />
            <Text style={s.primaryBtnText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Intro step — not signed in
  return (
    <View style={s.container}>
      <View style={s.content}>
        <View style={s.iconWrap}>
          <Cloud color={Colors.accent.gold} size={40} />
        </View>
        <Text style={s.title}>Mise 2.0</Text>
        <Text style={s.subtitle}>Multi-Device Sync</Text>
        <Text style={s.desc}>
          Sign in to sync your projects across all your devices.
          Your existing data will be uploaded to the cloud.
        </Text>

        <TouchableOpacity style={s.primaryBtn} onPress={handleSignIn} activeOpacity={0.8}>
          <LogIn color={Colors.text.inverse} size={18} />
          <Text style={s.primaryBtnText}>Sign In to Sync</Text>
        </TouchableOpacity>

        <TouchableOpacity style={s.skipBtn} onPress={handleSkip} activeOpacity={0.7}>
          <CloudOff color={Colors.text.tertiary} size={14} />
          <Text style={s.skipBtnText}>Continue without sync</Text>
        </TouchableOpacity>

        <Text style={s.footerNote}>
          You can always sign in later from Settings.
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary, justifyContent: 'center', alignItems: 'center' },
  content: { alignItems: 'center', paddingHorizontal: 40, maxWidth: 400 },
  iconWrap: { width: 80, height: 80, borderRadius: 24, backgroundColor: Colors.accent.goldBg, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '800', color: Colors.text.primary, marginBottom: 4, textAlign: 'center' },
  subtitle: { fontSize: 14, fontWeight: '600', color: Colors.accent.gold, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 16 },
  desc: { fontSize: 15, color: Colors.text.secondary, textAlign: 'center', lineHeight: 22, marginBottom: 8 },
  note: { fontSize: 12, color: Colors.text.tertiary, textAlign: 'center', marginBottom: 28 },
  footerNote: { fontSize: 12, color: Colors.text.tertiary, textAlign: 'center', marginTop: 20 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.accent.gold, borderRadius: 14, paddingVertical: 16, paddingHorizontal: 32, width: '100%', marginBottom: 12, marginTop: 16 },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: Colors.text.inverse },
  skipBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12 },
  skipBtnText: { fontSize: 14, color: Colors.text.tertiary },
});
