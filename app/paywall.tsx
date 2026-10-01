// app/paywall.tsx — tier picker
//
// One screen for both jobs: a free account subscribes here, and a subscribed
// account changes tier here (that is the only route to more devices — the
// per-device add-on purchase is gone because it could never complete past
// two devices). The ladder lives in lib/tiers.ts; live store prices come
// from the RevenueCat `tiers` offering with the table as display fallback.
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { appAlert } from '@/lib/appAlert';
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
  Check,
} from 'lucide-react-native';
import { useSubscription, tierPackageKey } from '@/contexts/SubscriptionContext';
import { useDeviceLicense } from '@/contexts/DeviceLicenseContext';
import {
  TIERS,
  getTier,
  type DeviceTier,
  type TierId,
  type BillingPeriod,
} from '@/lib/tiers';
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

// ─── Pricing math ─────────────────────────────────────────────────────────────

// Pure derivations, kept out of the components so the screen stays under the
// complexity limit and this stays unit-testable.

/** The billing period a tier can actually be bought at. Studio and Slate are
 * monthly-only, so an annual toggle quietly falls back for them. */
function effectivePeriod(tier: DeviceTier, period: BillingPeriod): BillingPeriod {
  return period === 'annual' && tier.annualPrice !== null ? 'annual' : 'monthly';
}

/** Display price for a tier at a period: the live store string when the RC
 * package is loaded, the ladder's fallback number otherwise. */
function tierPriceLabel(
  tier: DeviceTier,
  period: BillingPeriod,
  tierPackages: Record<string, any>
): string {
  const p = effectivePeriod(tier, period);
  const pkg = tierPackages[tierPackageKey(tier.id, p)];
  const live = pkg?.product?.priceString;
  const fallback = p === 'annual' && tier.annualPrice !== null
    ? tier.annualPrice
    : tier.monthlyPrice;
  const amount = live ?? `$${fallback.toFixed(2)}`;
  return `${amount}/${p === 'annual' ? 'yr' : 'mo'}`;
}

function deviceCountLabel(tier: DeviceTier): string {
  return tier.deviceLimit === 1 ? '1 device' : `Up to ${tier.deviceLimit} devices`;
}

/** What the big button should say and whether it can do anything. */
function buttonState(
  selected: DeviceTier,
  activeTierId: TierId | null,
  priceLabel: string
): { label: string; disabled: boolean } {
  if (!activeTierId) {
    return { label: `Subscribe — ${priceLabel}`, disabled: false };
  }
  if (activeTierId === selected.id) {
    return { label: 'Current Plan', disabled: true };
  }
  const active = getTier(activeTierId);
  const verb = selected.deviceLimit > active.deviceLimit ? 'Upgrade to' : 'Switch to';
  return { label: `${verb} ${selected.name} — ${priceLabel}`, disabled: false };
}

// ─── Presentational sub-components ────────────────────────────────────────────
// State/handlers live in PaywallScreen; these are pure views over props and
// share the `styles` object defined below.

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

function CurrentPlanCard({
  activeTier, legacyAddonActive, licensedCount, deviceLimit, onManageDevices,
}: {
  activeTier: DeviceTier;
  legacyAddonActive: boolean;
  licensedCount: number;
  deviceLimit: number;
  onManageDevices: () => void;
}) {
  return (
    <View style={styles.currentPlanCard}>
      <Crown color={Colors.accent.gold} size={28} style={{ marginBottom: 8 }} />
      <Text style={styles.currentPlanTitle}>
        You&apos;re on {activeTier.name}
      </Text>
      <Text style={styles.currentPlanDesc}>
        {licensedCount} of {deviceLimit} device{deviceLimit !== 1 ? 's' : ''} licensed
        {legacyAddonActive ? ' (includes your additional-device subscription)' : ''}.
        Pick a bigger plan below to license more devices — the store prorates
        the change automatically.
      </Text>
      <TouchableOpacity accessibilityRole="button"
        style={styles.manageButton}
        onPress={onManageDevices}
        activeOpacity={0.7}
      >
        <Smartphone color={Colors.text.secondary} size={14} />
        <Text style={styles.manageButtonText}>Manage Devices</Text>
      </TouchableOpacity>
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
      <TouchableOpacity accessibilityRole="button"
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
      <TouchableOpacity accessibilityRole="button"
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

function TierCard({
  tier, selected, isCurrent, billingPeriod, tierPackages, onSelect,
}: {
  tier: DeviceTier;
  selected: boolean;
  isCurrent: boolean;
  billingPeriod: BillingPeriod;
  tierPackages: Record<string, any>;
  onSelect: (id: TierId) => void;
}) {
  const monthlyOnly = billingPeriod === 'annual' && tier.annualPrice === null;
  return (
    <TouchableOpacity accessibilityRole="button"
      style={[styles.tierCard, selected && styles.tierCardSelected]}
      onPress={() => onSelect(tier.id)}
      activeOpacity={0.8}
    >
      <View style={styles.tierRadio}>
        {selected && <Check color={Colors.accent.gold} size={16} />}
      </View>
      <View style={styles.tierInfo}>
        <View style={styles.tierNameRow}>
          <Text style={styles.tierName}>{tier.name}</Text>
          {isCurrent && (
            <View style={styles.currentBadge}>
              <Text style={styles.currentBadgeText}>Current</Text>
            </View>
          )}
        </View>
        <Text style={styles.tierDevices}>{deviceCountLabel(tier)}</Text>
      </View>
      <View style={styles.tierPriceWrap}>
        <Text style={styles.tierPrice}>
          {tierPriceLabel(tier, billingPeriod, tierPackages)}
        </Text>
        {monthlyOnly && <Text style={styles.tierPriceNote}>Monthly only</Text>}
      </View>
    </TouchableOpacity>
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
        <TouchableOpacity accessibilityRole="button" onPress={onTerms} style={styles.legalLink}>
          <Text style={styles.legalLinkText}>Terms of Use</Text>
          <ExternalLink color={Colors.text.tertiary} size={10} />
        </TouchableOpacity>
        <Text style={styles.legalDot}>·</Text>
        <TouchableOpacity accessibilityRole="button" onPress={onPrivacy} style={styles.legalLink}>
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

  const { isLoading: rcLoading, tierPackages } = useSubscription();

  const {
    isPro,
    activeTierId,
    legacyAddonActive,
    licensedCount,
    deviceLimit,
    isLoading: deviceLoading,
    isPurchasing,
    purchaseError,
    purchaseTierAndActivate,
    restoreAndActivate,
  } = useDeviceLicense();

  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [selectedTierId, setSelectedTierId] = useState<TierId>(activeTierId ?? 'solo');

  const isLoading = rcLoading || deviceLoading;
  const selectedTier = getTier(selectedTierId);
  const activeTier = activeTierId ? getTier(activeTierId) : null;

  // ─── Handlers ────────────────────────────────────────────────────────────

  // Shown after a successful anonymous purchase or restore. Lets the user
  // continue using Pro on this device immediately, or sign in so the device
  // can be linked to their account for sync and crew collaboration.
  const promptSignInAfterPurchase = (titleSuccess: string, bodySuccess: string) => {
    appAlert(
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
    const period = effectivePeriod(selectedTier, billingPeriod);
    const result = await purchaseTierAndActivate(selectedTierId, period);

    if (result.success) {
      const body = activeTier
        ? `Your plan is now ${selectedTier.name} — up to ${selectedTier.deviceLimit} device${selectedTier.deviceLimit !== 1 ? 's' : ''}.`
        : 'This device is now licensed. All features are unlocked.';
      if (result.needsSignIn) {
        promptSignInAfterPurchase('Welcome to Pro!', body);
      } else {
        appAlert(
          activeTier ? 'Plan Changed' : 'Welcome to Pro!',
          body,
          [{ text: 'Continue', onPress: () => router.back() }],
        );
      }
    } else if (result.error) {
      appAlert('Purchase Failed', result.error);
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
        appAlert(
          'Restored!',
          'Your subscription and device license have been restored.',
          [{ text: 'Continue', onPress: () => router.back() }],
        );
      }
    } else {
      appAlert(
        'Nothing to Restore',
        result.error ?? 'No active Pro subscription was found for this Apple ID.',
      );
    }
  };

  const openTerms = () =>
    Linking.openURL('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/');
  const openPrivacy = () =>
    Linking.openURL('https://page4films.com/mise/privacy.html');

  // ─── Render ──────────────────────────────────────────────────────────────

  const priceLabel = tierPriceLabel(selectedTier, billingPeriod, tierPackages);
  const { label: purchaseLabel, disabled: purchaseDisabled } = buttonState(
    selectedTier,
    activeTierId,
    priceLabel
  );

  const isBusy = isLoading || isPurchasing;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.closeButton}
        onPress={() => router.back()}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Close"
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
            {isPro
              ? 'Change your plan to license more devices'
              : 'Unlock the full power of your director\'s toolkit'}
          </Text>
        </View>

        {/* ── Current plan context (subscribed) or feature list (free) ── */}
        {activeTier ? (
          <CurrentPlanCard
            activeTier={activeTier}
            legacyAddonActive={legacyAddonActive}
            licensedCount={licensedCount}
            deviceLimit={deviceLimit}
            onManageDevices={() => {
              router.back();
              router.push('/settings/devices');
            }}
          />
        ) : (
          <FeatureList />
        )}

        {/* ── Billing period toggle ── */}
        <BillingToggle billingPeriod={billingPeriod} onSelect={setBillingPeriod} />

        {/* ── Tier ladder ── */}
        <View style={styles.tierList}>
          {TIERS.map(tier => (
            <TierCard
              key={tier.id}
              tier={tier}
              selected={tier.id === selectedTierId}
              isCurrent={tier.id === activeTierId}
              billingPeriod={billingPeriod}
              tierPackages={tierPackages}
              onSelect={setSelectedTierId}
            />
          ))}
        </View>

        <Text style={styles.priceNote}>Cancel anytime. No long-term commitment.</Text>

        {/* ── Error message ── */}
        {purchaseError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{purchaseError}</Text>
          </View>
        ) : null}

        {/* ── Purchase button ── */}
        <TouchableOpacity accessibilityRole="button"
          style={[styles.primaryButton, (isBusy || purchaseDisabled) && styles.buttonDisabled]}
          onPress={handlePurchase}
          activeOpacity={0.8}
          disabled={isBusy || purchaseDisabled}
        >
          {isBusy ? (
            <ActivityIndicator color={Colors.text.inverse} size="small" />
          ) : (
            <>
              <Crown color={Colors.text.inverse} size={18} />
              <Text style={styles.primaryButtonText}>{purchaseLabel}</Text>
            </>
          )}
        </TouchableOpacity>

        {/* ── Restore ── */}
        <TouchableOpacity accessibilityRole="button"
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
  header: { alignItems: 'center', marginBottom: 28 },
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
  featureList: { marginBottom: 24 },
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

  // Current plan card
  currentPlanCard: {
    backgroundColor: Colors.bg.card,
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.accent.gold + '30',
  },
  currentPlanTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  currentPlanDesc: {
    fontSize: 13,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
  },
  manageButtonText: { fontSize: 14, color: Colors.text.secondary },

  // Billing period toggle
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.bg.tertiary,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
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

  // Tier cards
  tierList: { marginBottom: 12, gap: 10 },
  tierCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    gap: 12,
  },
  tierCardSelected: {
    borderColor: Colors.accent.gold,
    backgroundColor: Colors.accent.goldBg,
  },
  tierRadio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border.subtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tierInfo: { flex: 1 },
  tierNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tierName: { fontSize: 16, fontWeight: '700', color: Colors.text.primary },
  currentBadge: {
    backgroundColor: Colors.accent.gold,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  currentBadgeText: { fontSize: 12, fontWeight: '700', color: Colors.text.inverse },
  tierDevices: { fontSize: 13, color: Colors.text.secondary, marginTop: 2 },
  tierPriceWrap: { alignItems: 'flex-end' },
  tierPrice: { fontSize: 15, fontWeight: '700', color: Colors.accent.gold },
  tierPriceNote: { fontSize: 12, color: Colors.text.tertiary, marginTop: 2 },

  priceNote: {
    fontSize: 13,
    color: Colors.text.tertiary,
    textAlign: 'center',
    marginBottom: 16,
  },

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
});
