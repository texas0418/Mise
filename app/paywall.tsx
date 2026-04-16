// app/paywall.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Crown,
  Upload,
  Sparkles,
  FolderOpen,
  FileSpreadsheet,
  History,
  X,
  ExternalLink,
  RotateCcw,
  Smartphone,
  Monitor,
  Plus,
} from 'lucide-react-native';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useDeviceLicense } from '@/contexts/DeviceLicenseContext';
import Colors from '@/constants/colors';

// ─── Feature list ─────────────────────────────────────────────────────────────

const PRO_FEATURES = [
  {
    icon: Upload,
    title: 'Spreadsheet Import',
    description: 'Import crew lists, budgets, and shot lists from CSV & Excel files',
  },
  {
    icon: Sparkles,
    title: 'AI Import',
    description: 'Describe your data in plain language or photograph handwritten sheets',
  },
  {
    icon: FolderOpen,
    title: 'Unlimited Projects',
    description: 'Manage as many productions as you need simultaneously',
  },
  {
    icon: FileSpreadsheet,
    title: 'CSV Templates',
    description: 'Download pre-formatted templates for every data type',
  },
  {
    icon: History,
    title: 'Import History & Undo',
    description: 'Track and reverse bulk imports with one tap',
  },
  {
    icon: Monitor,
    title: 'Multi-Device Sync',
    description: 'Sync your projects across all your devices in real-time',
  },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PaywallScreen() {
  const router = useRouter();

  const { isLoading: rcLoading } = useSubscription();

  const {
    isPro,
    isDeviceLicensed,
    isFirstDevice,
    isLegacySubscriber,
    licensedCount,
    monthlyPrice,
    nextDevicePrice,
    pricing,
    currentDevice,
    isLoading: deviceLoading,
    isPurchasing,
    purchaseError,
    purchaseBaseAndActivate,
    purchaseAdditionalAndActivate,
    restoreAndActivate,
  } = useDeviceLicense();

  const isLoading = rcLoading || deviceLoading;

  // ─── Handlers ───────────────────────────────────────────────────────────

  const handlePurchase = async () => {
    // Route to the correct product based on device count
    const result = isFirstDevice
      ? await purchaseBaseAndActivate()
      : await purchaseAdditionalAndActivate();

    if (result.success) {
      Alert.alert(
        'Welcome to Pro!',
        'This device is now licensed. All features are unlocked.',
        [{ text: 'Continue', onPress: () => router.back() }]
      );
    } else if (result.error) {
      Alert.alert('Purchase Failed', result.error);
    }
    // If no error and no success = user cancelled, do nothing
  };

  const handleRestore = async () => {
    const result = await restoreAndActivate();

    if (result.success) {
      Alert.alert(
        'Restored!',
        'Your subscription and device license have been restored.',
        [{ text: 'Continue', onPress: () => router.back() }]
      );
    } else {
      Alert.alert(
        'Nothing to Restore',
        result.error ?? 'No active Pro subscription was found for this Apple ID.',
      );
    }
  };

  const openTerms = () =>
    Linking.openURL('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/');
  const openPrivacy = () =>
    Linking.openURL('https://texas0418.github.io/MiseApp/');

  // ─── Already Pro — success state ────────────────────────────────────────

  if (isPro) {
    return (
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <X color={Colors.text.secondary} size={24} />
        </TouchableOpacity>

        <View style={styles.successContainer}>
          <View style={styles.successIconWrap}>
            <Crown color={Colors.accent.gold} size={48} />
          </View>

          <Text style={styles.successTitle}>You're a Pro!</Text>

          <Text style={styles.successSubtitle}>
            {isLegacySubscriber
              ? 'Your existing subscription has been applied to this device.'
              : `${licensedCount} device${licensedCount !== 1 ? 's' : ''} licensed · $${monthlyPrice.toFixed(2)}/mo`}
          </Text>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Continue</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.manageButton}
            onPress={() => {
              router.back();
              router.push('/settings/devices');
            }}
            activeOpacity={0.7}
          >
            <Smartphone color={Colors.text.secondary} size={14} />
            <Text style={styles.manageButtonText}>Manage Devices</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ─── Purchase flow ───────────────────────────────────────────────────────

  // Button label + price change based on whether this is first or additional device
  const buttonLabel = isFirstDevice
    ? 'Subscribe to Mise Pro'
    : 'Add This Device — $' + pricing.additionalDeviceMonthly.toFixed(2) + '/mo';

  const buttonIcon = isFirstDevice ? Crown : Plus;
  const ButtonIcon = buttonIcon;

  const isBusy = isLoading || isPurchasing;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.closeButton}
        onPress={() => router.back()}
        activeOpacity={0.7}
      >
        <X color={Colors.text.secondary} size={24} />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.crownContainer}>
            <View style={styles.crownGlow} />
            <Crown color={Colors.accent.gold} size={40} />
          </View>
          <Text style={styles.title}>Mise Pro</Text>
          <Text style={styles.subtitle}>
            {isFirstDevice
              ? 'Unlock the full power of your director\'s toolkit'
              : 'Add this device to your Pro subscription'}
          </Text>
        </View>

        {/* ── Feature list (only show on first device) ── */}
        {isFirstDevice && (
          <View style={styles.featureList}>
            {PRO_FEATURES.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <View key={index} style={styles.featureRow}>
                  <View style={styles.featureIconWrap}>
                    <Icon color={Colors.accent.gold} size={20} />
                  </View>
                  <View style={styles.featureTextWrap}>
                    <Text style={styles.featureTitle}>{feature.title}</Text>
                    <Text style={styles.featureDesc}>{feature.description}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Additional device context card ── */}
        {!isFirstDevice && (
          <View style={styles.addDeviceCard}>
            <Smartphone color={Colors.accent.gold} size={32} style={{ marginBottom: 12 }} />
            <Text style={styles.addDeviceTitle}>
              {licensedCount} device{licensedCount !== 1 ? 's' : ''} already licensed
            </Text>
            <Text style={styles.addDeviceDesc}>
              Your account has an active Mise Pro subscription. Add this device for an
              additional ${pricing.additionalDeviceMonthly.toFixed(2)}/month.
            </Text>
            <View style={styles.addDevicePriceRow}>
              <Text style={styles.addDevicePriceLabel}>Current monthly total</Text>
              <Text style={styles.addDevicePriceCurrent}>${monthlyPrice.toFixed(2)}/mo</Text>
            </View>
            <View style={styles.addDevicePriceRow}>
              <Text style={styles.addDevicePriceLabel}>After adding this device</Text>
              <Text style={styles.addDevicePriceNew}>
                ${(monthlyPrice + pricing.additionalDeviceMonthly).toFixed(2)}/mo
              </Text>
            </View>
          </View>
        )}

        {/* ── Pricing card (first device only) ── */}
        {isFirstDevice && (
          <View style={styles.pricingCard}>
            <Text style={styles.priceAmount}>${pricing.baseMonthly.toFixed(2)}</Text>
            <Text style={styles.pricePeriod}>per month · 1 device</Text>
            <View style={styles.priceDivider} />
            <Text style={styles.priceAdditional}>
              +${pricing.additionalDeviceMonthly.toFixed(2)}/mo per additional device
            </Text>
            <Text style={styles.priceNote}>Cancel anytime. No long-term commitment.</Text>
          </View>
        )}

        {/* ── Error message ── */}
        {purchaseError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{purchaseError}</Text>
          </View>
        ) : null}

        {/* ── Purchase button ── */}
        <TouchableOpacity
          style={[styles.primaryButton, isBusy && styles.buttonDisabled]}
          onPress={handlePurchase}
          activeOpacity={0.8}
          disabled={isBusy}
        >
          {isBusy ? (
            <ActivityIndicator color={Colors.text.inverse} size="small" />
          ) : (
            <>
              <ButtonIcon color={Colors.text.inverse} size={18} />
              <Text style={styles.primaryButtonText}>{buttonLabel}</Text>
            </>
          )}
        </TouchableOpacity>

        {/* ── Restore ── */}
        <TouchableOpacity
          style={styles.restoreButton}
          onPress={handleRestore}
          activeOpacity={0.7}
          disabled={isBusy}
        >
          {isPurchasing ? (
            <ActivityIndicator color={Colors.text.secondary} size="small" />
          ) : (
            <>
              <RotateCcw color={Colors.text.secondary} size={14} />
              <Text style={styles.restoreButtonText}>Restore Purchases</Text>
            </>
          )}
        </TouchableOpacity>

        {/* ── Legal ── */}
        <View style={styles.legalFooter}>
          <Text style={styles.legalText}>
            Payment will be charged to your Apple ID account at confirmation of purchase.
            Subscription automatically renews unless canceled at least 24 hours before the
            end of the current period. You can manage and cancel your subscriptions in your
            App Store account settings.
          </Text>
          <View style={styles.legalLinks}>
            <TouchableOpacity onPress={openTerms} style={styles.legalLink}>
              <Text style={styles.legalLinkText}>Terms of Use</Text>
              <ExternalLink color={Colors.text.tertiary} size={10} />
            </TouchableOpacity>
            <Text style={styles.legalDot}>·</Text>
            <TouchableOpacity onPress={openPrivacy} style={styles.legalLink}>
              <Text style={styles.legalLinkText}>Privacy Policy</Text>
              <ExternalLink color={Colors.text.tertiary} size={10} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.bg.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },

  // Header
  header: { alignItems: 'center', marginBottom: 32 },
  crownContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.accent.goldBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  crownGlow: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.accent.gold + '08',
  },
  title: { fontSize: 28, fontWeight: '700', color: Colors.accent.gold, marginBottom: 8 },
  subtitle: {
    fontSize: 15,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },

  // Feature list
  featureList: { marginBottom: 28 },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border.subtle,
    gap: 14,
  },
  featureIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.accent.goldBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  featureTextWrap: { flex: 1 },
  featureTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 3,
  },
  featureDesc: { fontSize: 13, color: Colors.text.secondary, lineHeight: 18 },

  // Additional device card
  addDeviceCard: {
    backgroundColor: Colors.bg.card,
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.accent.gold + '30',
  },
  addDeviceTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  addDeviceDesc: {
    fontSize: 13,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  addDevicePriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 8,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border.subtle,
  },
  addDevicePriceLabel: { fontSize: 13, color: Colors.text.secondary },
  addDevicePriceCurrent: { fontSize: 13, fontWeight: '600', color: Colors.text.primary },
  addDevicePriceNew: { fontSize: 13, fontWeight: '700', color: Colors.accent.gold },

  // Pricing card
  pricingCard: {
    alignItems: 'center',
    backgroundColor: Colors.bg.card,
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.accent.gold + '30',
  },
  priceAmount: { fontSize: 36, fontWeight: '700', color: Colors.accent.gold },
  pricePeriod: { fontSize: 14, color: Colors.text.secondary, marginTop: 2 },
  priceDivider: {
    width: 40,
    height: 1,
    backgroundColor: Colors.border.subtle,
    marginVertical: 16,
  },
  priceAdditional: { fontSize: 13, color: Colors.accent.goldLight, marginBottom: 8 },
  priceNote: { fontSize: 13, color: Colors.text.tertiary, marginTop: 8 },

  // Error
  errorBanner: {
    backgroundColor: Colors.status.error + '18',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: Colors.status.error + '40',
  },
  errorText: { fontSize: 13, color: Colors.status.error, textAlign: 'center' },

  // Buttons
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.accent.gold,
    borderRadius: 14,
    paddingVertical: 16,
    marginBottom: 12,
  },
  primaryButtonText: { fontSize: 16, fontWeight: '700', color: Colors.text.inverse },
  buttonDisabled: { opacity: 0.6 },
  restoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginBottom: 24,
  },
  restoreButtonText: { fontSize: 14, color: Colors.text.secondary },

  // Legal
  legalFooter: { paddingTop: 16, borderTopWidth: 0.5, borderTopColor: Colors.border.subtle },
  legalText: {
    fontSize: 10,
    color: Colors.text.tertiary,
    lineHeight: 15,
    textAlign: 'center',
    marginBottom: 12,
  },
  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  legalLink: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  legalLinkText: {
    fontSize: 11,
    color: Colors.text.tertiary,
    textDecorationLine: 'underline',
  },
  legalDot: { color: Colors.text.tertiary, fontSize: 10 },

  // Success state
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  successIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.accent.goldBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.accent.gold,
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 15,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
  },
  manageButtonText: { fontSize: 14, color: Colors.text.secondary },
});
