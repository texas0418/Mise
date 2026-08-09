// app/paywall.tsx
import React, { useState } from 'react';
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
import {
  Crown,
  Upload,
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
import { useGuardedRouter } from '@/utils/useGuardedRouter';

// ─── Feature list ───────────────────────────────────────────────────────────

const PRO_FEATURES = [
  {
    icon: Upload,
    title: 'Spreadsheet Import',
    description: 'Import crew lists, budgets, and shot lists from CSV & Excel files',
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

type BillingPeriod = 'monthly' | 'annual';

type PricingTiers = {
  baseMonthly: number;
  baseAnnual: number;
  additionalDeviceMonthly: number;
  additionalDeviceAnnual: number;
};

// ─── Pricing math ─────────────────────────────────────────────────────────────

// Pure derivation of the display strings/values for the selected billing period
// and device slot. Kept out of the component so the screen stays under the
// complexity limit and this stays unit-testable.
function computePricing(
  isFirstDevice: boolean,
  billingPeriod: BillingPeriod,
  pricing: PricingTiers,
) {
  const isAnnual = billingPeriod === 'annual';
  const displayPrice = isFirstDevice
    ? (isAnnual ? pricing.baseAnnual : pricing.baseMonthly)
    : (isAnnual ? pricing.additionalDeviceAnnual : pricing.additionalDeviceMonthly);
  const displayPeriodLabel = isAnnual ? 'per year' : 'per month';
  const displayDeviceLabel = isFirstDevice ? '1 device' : 'this device';
  const annualAsMonthly = isFirstDevice
    ? pricing.baseAnnual / 12
    : pricing.additionalDeviceAnnual / 12;
  const priceSuffix = isAnnual ? 'yr' : 'mo';
  const buttonLabel = isFirstDevice
    ? `Subscribe — $${displayPrice.toFixed(2)}/${priceSuffix}`
    : `Add Device — $${displayPrice.toFixed(2)}/${priceSuffix}`;
  const ButtonIcon = isFirstDevice ? Crown : Plus;
  return {
    displayPrice, displayPeriodLabel, displayDeviceLabel,
    annualAsMonthly, buttonLabel, ButtonIcon,
  };
}

// ─── Presentational sub-components ────────────────────────────────────────────
// State/handlers live in PaywallScreen; these are pure views over props and
// share the `styles` object defined below.

function PaywallSuccess({
  isLegacySubscriber, licensedCount, monthlyPrice, onClose, onContinue, onManageDevices,
}: {
  isLegacySubscriber: boolean;
  licensedCount: number;
  monthlyPrice: number;
  onClose: () => void;
  onContinue: () => void;
  onManageDevices: () => void;
}) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.closeButton}
        onPress={onClose}
        activeOpacity={0.7}
      >
        <X color={Colors.text.secondary} size={24} />
      </TouchableOpacity>

      <View style={styles.successContainer}>
        <View style={styles.successIconWrap}>
          <Crown color={Colors.accent.gold} size={48} />
        </View>

        <Text style={styles.successTitle}>You&apos;re a Pro!</Text>

        <Text style={styles.successSubtitle}>
          {isLegacySubscriber
            ? 'Your existing subscription has been applied to this device.'
            : `${licensedCount} device${licensedCount !== 1 ? 's' : ''} licensed · $${monthlyPrice.toFixed(2)}/mo`}
        </Text>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={onContinue}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Continue</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.manageButton}
          onPress={onManageDevices}
          activeOpacity={0.7}
        >
          <Smartphone color={Colors.text.secondary} size={14} />
          <Text style={styles.manageButtonText}>Manage Devices</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function FeatureList() {
  return (
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
  );
}

function AddDeviceCard({
  licensedCount, pricing,
}: {
  licensedCount: number;
  pricing: PricingTiers;
}) {
  return (
    <View style={styles.addDeviceCard}>
      <Smartphone color={Colors.accent.gold} size={32} style={{ marginBottom: 12 }} />
      <Text style={styles.addDeviceTitle}>
        {licensedCount} device{licensedCount !== 1 ? 's' : ''} already licensed
      </Text>
      <Text style={styles.addDeviceDesc}>
        Your account has an active Mise Pro subscription. Add this device for an
        additional ${pricing.additionalDeviceMonthly.toFixed(2)}/month or ${pricing.additionalDeviceAnnual.toFixed(2)}/year.
      </Text>
    </View>
  );
}

function BillingToggle({
  billingPeriod, onSelect,
}: {
  billingPeriod: BillingPeriod;
  onSelect: (period: BillingPeriod) => void;
}) {
  return (
    <View style={styles.toggleContainer}>
      <TouchableOpacity
        style={[
          styles.toggleOption,
          billingPeriod === 'monthly' && styles.toggleOptionActive,
        ]}
        onPress={() => onSelect('monthly')}
        activeOpacity={0.8}
      >
        <Text
          style={[
            styles.toggleText,
            billingPeriod === 'monthly' && styles.toggleTextActive,
          ]}
        >
          Monthly
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.toggleOption,
          billingPeriod === 'annual' && styles.toggleOptionActive,
        ]}
        onPress={() => onSelect('annual')}
        activeOpacity={0.8}
      >
        <View style={styles.toggleAnnualWrap}>
          <Text
            style={[
              styles.toggleText,
              billingPeriod === 'annual' && styles.toggleTextActive,
            ]}
          >
            Annual
          </Text>
          <View style={styles.savingsBadge}>
            <Text style={styles.savingsBadgeText}>SAVE 17%</Text>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

function PricingCard({
  displayPrice, displayPeriodLabel, displayDeviceLabel,
  billingPeriod, isFirstDevice, annualAsMonthly, pricing,
}: {
  displayPrice: number;
  displayPeriodLabel: string;
  displayDeviceLabel: string;
  billingPeriod: BillingPeriod;
  isFirstDevice: boolean;
  annualAsMonthly: number;
  pricing: PricingTiers;
}) {
  return (
    <View style={styles.pricingCard}>
      <Text style={styles.priceAmount}>${displayPrice.toFixed(2)}</Text>
      <Text style={styles.pricePeriod}>{displayPeriodLabel} · {displayDeviceLabel}</Text>

      {billingPeriod === 'annual' && (
        <Text style={styles.priceEquivalent}>
          Just ${annualAsMonthly.toFixed(2)}/mo, billed annually
        </Text>
      )}

      {isFirstDevice && (
        <>
          <View style={styles.priceDivider} />
          <Text style={styles.priceAdditional}>
            +${billingPeriod === 'annual'
              ? pricing.additionalDeviceAnnual.toFixed(2) + '/yr'
              : pricing.additionalDeviceMonthly.toFixed(2) + '/mo'} per additional device
          </Text>
        </>
      )}

      <Text style={styles.priceNote}>Cancel anytime. No long-term commitment.</Text>
    </View>
  );
}

function LegalFooter({
  onTerms, onPrivacy,
}: {
  onTerms: () => void;
  onPrivacy: () => void;
}) {
  return (
    <View style={styles.legalFooter}>
      <Text style={styles.legalText}>
        Payment will be charged to your Apple ID account at confirmation of purchase.
        Subscription automatically renews unless canceled at least 24 hours before the
        end of the current period. You can manage and cancel your subscriptions in your
        App Store account settings.
      </Text>
      <View style={styles.legalLinks}>
        <TouchableOpacity onPress={onTerms} style={styles.legalLink}>
          <Text style={styles.legalLinkText}>Terms of Use</Text>
          <ExternalLink color={Colors.text.tertiary} size={10} />
        </TouchableOpacity>
        <Text style={styles.legalDot}>·</Text>
        <TouchableOpacity onPress={onPrivacy} style={styles.legalLink}>
          <Text style={styles.legalLinkText}>Privacy Policy</Text>
          <ExternalLink color={Colors.text.tertiary} size={10} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function PaywallScreen() {
  const router = useGuardedRouter();

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
    purchaseBaseAnnualAndActivate,
    purchaseAdditionalAndActivate,
    purchaseAdditionalAnnualAndActivate,
    restoreAndActivate,
  } = useDeviceLicense();

  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');

  const isLoading = rcLoading || deviceLoading;

  // ─── Handlers ────────────────────────────────────────────────────────────

  // Shown after a successful anonymous purchase or restore. Lets the user
  // continue using Pro on this device immediately, or sign in so the device
  // can be linked to their account for sync and crew collaboration.
  const promptSignInAfterPurchase = (titleSuccess: string, bodySuccess: string) => {
    Alert.alert(
      titleSuccess,
      `${bodySuccess}\n\nSign in to sync across your devices and invite your crew. You can also do this later from Settings.`,
      [
        {
          text: 'Not Now',
          style: 'cancel',
          onPress: () => router.back(),
        },
        {
          text: 'Sign In',
          onPress: () => {
            router.back();
            router.push('/auth/sign-up');
          },
        },
      ],
    );
  };

  const handlePurchase = async () => {
    // Route to the correct product based on device count + billing period
    let result;
    if (isFirstDevice) {
      result = billingPeriod === 'annual'
        ? await purchaseBaseAnnualAndActivate()
        : await purchaseBaseAndActivate();
    } else {
      result = billingPeriod === 'annual'
        ? await purchaseAdditionalAnnualAndActivate()
        : await purchaseAdditionalAndActivate();
    }

    if (result.success) {
      if (result.needsSignIn) {
        promptSignInAfterPurchase(
          'Welcome to Pro!',
          'This device is now licensed. All features are unlocked.',
        );
      } else {
        Alert.alert(
          'Welcome to Pro!',
          'This device is now licensed. All features are unlocked.',
          [{ text: 'Continue', onPress: () => router.back() }],
        );
      }
    } else if (result.error) {
      Alert.alert('Purchase Failed', result.error);
    }
    // If no error and no success = user cancelled, do nothing
  };

  const handleRestore = async () => {
    const result = await restoreAndActivate();

    if (result.success) {
      if (result.needsSignIn) {
        promptSignInAfterPurchase(
          'Restored!',
          'Your subscription has been restored on this device.',
        );
      } else {
        Alert.alert(
          'Restored!',
          'Your subscription and device license have been restored.',
          [{ text: 'Continue', onPress: () => router.back() }],
        );
      }
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
    Linking.openURL('https://page4films.com/mise/privacy.html');

  // ─── Already Pro — success state ─────────────────────────────────────────

  if (isPro) {
    return (
      <PaywallSuccess
        isLegacySubscriber={isLegacySubscriber}
        licensedCount={licensedCount}
        monthlyPrice={monthlyPrice}
        onClose={() => router.back()}
        onContinue={() => router.back()}
        onManageDevices={() => {
          router.back();
          router.push('/settings/devices');
        }}
      />
    );
  }

  // ─── Purchase flow ───────────────────────────────────────────────────────

  const {
    displayPrice, displayPeriodLabel, displayDeviceLabel,
    annualAsMonthly, buttonLabel, ButtonIcon,
  } = computePricing(isFirstDevice, billingPeriod, pricing);

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
        {isFirstDevice && <FeatureList />}

        {/* ── Additional device context card ── */}
        {!isFirstDevice && (
          <AddDeviceCard licensedCount={licensedCount} pricing={pricing} />
        )}

        {/* ── Billing period toggle ── */}
        <BillingToggle billingPeriod={billingPeriod} onSelect={setBillingPeriod} />

        {/* ── Pricing card ── */}
        <PricingCard
          displayPrice={displayPrice}
          displayPeriodLabel={displayPeriodLabel}
          displayDeviceLabel={displayDeviceLabel}
          billingPeriod={billingPeriod}
          isFirstDevice={isFirstDevice}
          annualAsMonthly={annualAsMonthly}
          pricing={pricing}
        />

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
        <LegalFooter onTerms={openTerms} onPrivacy={openPrivacy} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

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
  },

  // Billing period toggle
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.bg.tertiary,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    gap: 4,
  },
  toggleOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleOptionActive: {
    backgroundColor: Colors.bg.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleAnnualWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  toggleTextActive: {
    color: Colors.text.primary,
  },
  savingsBadge: {
    backgroundColor: Colors.accent.gold,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  savingsBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text.inverse,
    letterSpacing: 0.3,
  },

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
  priceEquivalent: {
    fontSize: 12,
    color: Colors.accent.goldLight,
    marginTop: 6,
    fontStyle: 'italic',
  },
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
    fontSize: 12,
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
    fontSize: 12,
    color: Colors.text.tertiary,
    textDecorationLine: 'underline',
  },
  legalDot: { color: Colors.text.tertiary, fontSize: 12 },

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
