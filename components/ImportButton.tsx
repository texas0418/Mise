/**
 * components/ImportButton.tsx
 *
 * Reusable Import Button for Mise App
 * Phase 2, Item 6 — Updated with Pro subscription gating
 *
 * A small button (Upload icon + "Import" label) that navigates to the
 * import-data screen with the target entity type. If the user doesn't
 * have a Pro subscription, it redirects to the paywall instead.
 *
 * NOTE: Uses useDeviceLicense().isPro as the single source of truth.
 * useSubscription().requiresPro() only knows about RevenueCat entitlement
 * and can desync from device license, causing Pro users to see locked
 * features. DeviceLicenseContext.isPro = (isDeviceLicensed || isRevenueCatPro)
 * is the correct combined signal.
 */

import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Upload, Lock } from 'lucide-react-native';
import { useDeviceLicense } from '@/contexts/DeviceLicenseContext';
import Colors from '@/constants/colors';

interface ImportButtonProps {
  /** The entity key matching importRegistry (e.g. 'crew', 'budget', 'shots') */
  entityKey: string;
  /** Optional: 'compact' shows just the icon, 'full' shows icon + label. Default: 'full' */
  variant?: 'compact' | 'full';
  /** Optional: custom label text. Default: 'Import' */
  label?: string;
}

export default function ImportButton({ entityKey, variant = 'full', label = 'Import' }: ImportButtonProps) {
  const router = useRouter();
  const { isPro } = useDeviceLicense();
  const needsPro = !isPro;

  const handlePress = () => {
    if (needsPro) {
      router.push('/paywall' as never);
    } else {
      router.push(`/import-data?entity=${entityKey}` as never);
    }
  };

  if (variant === 'compact') {
    return (
      <TouchableOpacity
        style={[styles.compactBtn, needsPro && styles.lockedBtn]}
        onPress={handlePress}
        activeOpacity={0.7}
        testID={`import-btn-${entityKey}`}
      >
        {needsPro ? (
          <Lock color={Colors.text.tertiary} size={14} />
        ) : (
          <Upload color={Colors.accent.gold} size={16} />
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.fullBtn, needsPro && styles.lockedBtn]}
      onPress={handlePress}
      activeOpacity={0.7}
      testID={`import-btn-${entityKey}`}
    >
      {needsPro ? (
        <>
          <Lock color={Colors.text.tertiary} size={12} />
          <Text style={[styles.fullBtnText, styles.lockedText]}>{label}</Text>
        </>
      ) : (
        <>
          <Upload color={Colors.accent.gold} size={14} />
          <Text style={styles.fullBtnText}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  compactBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.accent.goldBg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: Colors.accent.gold + '33',
  },
  fullBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: Colors.accent.goldBg,
    borderWidth: 0.5,
    borderColor: Colors.accent.gold + '33',
  },
  fullBtnText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.accent.gold,
  },
  lockedBtn: {
    backgroundColor: Colors.bg.tertiary,
    borderColor: Colors.border.subtle,
  },
  lockedText: {
    color: Colors.text.tertiary,
  },
});
