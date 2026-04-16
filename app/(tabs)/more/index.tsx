import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Linking, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { FileText, Users2, MapPin, DollarSign, Clapperboard, BookOpen, BookOpenCheck, Aperture, Sparkles, Trophy, Palette, StickyNote, ClipboardList, User, Users, Layers, Image, CloudSun, Share2, Move, Paintbrush, Clock, Drama, ListChecks, BookHeart, Star as StarIcon, Megaphone, Crown, Shield, ExternalLink, RotateCcw, LogIn, UserCircle, Smartphone, Cloud } from 'lucide-react-native';
import { useProjects } from '@/contexts/ProjectContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useDeviceLicense } from '@/contexts/DeviceLicenseContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLayout } from '@/utils/useLayout';
import Colors from '@/constants/colors';

interface ToolItem {
  icon: React.ElementType;
  label: string;
  subtitle: string;
  route: string;
  color: string;
  badge?: string;
}

const PRE_PROD_TOOLS: ToolItem[] = [
  { icon: BookOpenCheck, label: 'Script Sides', subtitle: 'Daily shooting pages', route: '/script-sides', color: '#F59E0B' },
  { icon: Drama, label: 'Cast', subtitle: 'Actors & characters', route: '/cast-manager', color: '#FB7185' },
  { icon: BookHeart, label: 'Lookbook', subtitle: 'Director\'s vision deck', route: '/lookbook', color: '#C084FC' },
  { icon: FileText, label: 'Script Breakdown', subtitle: 'Tag scenes & elements', route: '/script-breakdown', color: '#60A5FA' },
  { icon: MapPin, label: 'Locations', subtitle: 'Scout & manage sites', route: '/locations', color: '#4ADE80' },
  { icon: DollarSign, label: 'Budget', subtitle: 'Track spending', route: '/budget', color: '#FBBF24' },
  { icon: ClipboardList, label: 'Call Sheets', subtitle: 'Daily crew sheets', route: '/call-sheets', color: '#FB923C' },
  { icon: Palette, label: 'Mood Boards', subtitle: 'Visual references', route: '/mood-boards', color: '#F472B6' },
  { icon: Users, label: 'Crew', subtitle: 'Cast & crew directory', route: '/crew-directory', color: '#A78BFA' },
  { icon: Image, label: 'Shot References', subtitle: 'Visual shot library', route: '/shot-references', color: '#38BDF8' },
  { icon: Move, label: 'Blocking', subtitle: 'Rehearsal & staging', route: '/blocking-notes', color: '#34D399' },
  { icon: Paintbrush, label: 'Color / LUTs', subtitle: 'Look & grade references', route: '/color-references', color: '#E879F9' },
  { icon: CloudSun, label: 'Weather', subtitle: 'Location forecasts', route: '/location-weather', color: '#06B6D4' },
];

const ON_SET_TOOLS: ToolItem[] = [
  { icon: ListChecks, label: 'Shot Checklist', subtitle: 'Daily shot progress', route: '/shot-checklist', color: '#4ADE80' },
  { icon: Megaphone, label: 'Comms Hub', subtitle: 'Quick crew messages', route: '/comms-hub', color: '#F59E0B' },
  { icon: Clapperboard, label: 'Digital Slate', subtitle: 'Clapperboard', route: '/digital-slate', color: '#F87171' },
  { icon: BookOpen, label: 'Continuity', subtitle: 'Script supervisor notes', route: '/continuity', color: '#34D399' },
  { icon: StickyNote, label: 'Notes', subtitle: 'Production notes', route: '/production-notes', color: '#FCD34D' },
  { icon: Clock, label: 'Time Tracker', subtitle: 'Hours & overtime', route: '/time-tracker', color: '#FB923C' },
];

const POST_TOOLS: ToolItem[] = [
  { icon: StarIcon, label: 'Selects', subtitle: 'Circle takes for editor', route: '/selects', color: '#F59E0B' },
  { icon: Sparkles, label: 'VFX Tracker', subtitle: 'Visual effects shots', route: '/vfx-tracker', color: '#818CF8' },
  { icon: Trophy, label: 'Festivals', subtitle: 'Submissions & deadlines', route: '/festival-tracker', color: '#F59E0B' },
  { icon: FileText, label: 'Wrap Reports', subtitle: 'Daily wrap summaries', route: '/wrap-reports', color: '#A78BFA' },
];

const REFERENCE_TOOLS: ToolItem[] = [
  { icon: Aperture, label: 'Lens Calculator', subtitle: 'FOV & focal lengths', route: '/lens-calculator', color: '#06B6D4' },
  { icon: User, label: 'Portfolio', subtitle: 'Your credits & reel', route: '/portfolio', color: Colors.accent.gold },
  { icon: Layers, label: 'Frame Guides', subtitle: 'Aspect ratio previews', route: '/frame-guides', color: '#E879F9' },
  { icon: Share2, label: 'Export & Share', subtitle: 'Share project data', route: '/export-share', color: '#94A3B8' },
];

function ToolCard({ tool, index }: { tool: ToolItem; index: number }) {
  const router = useRouter();
  const { isTablet, gridColumns } = useLayout();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, delay: index * 40, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, delay: index * 40, useNativeDriver: true, tension: 100, friction: 8 }),
    ]).start();
  }, []);

  const Icon = tool.icon;
  const cardBasis = isTablet ? `${100 / Math.min(gridColumns, 3) - 2}%` : '48%';

  return (
    <Animated.View style={[styles.toolCardWrapper, { opacity: fadeAnim, transform: [{ scale: scaleAnim }], flexBasis: cardBasis as unknown as number }]}>
      <TouchableOpacity style={styles.toolCard} onPress={() => router.push(tool.route as never)} activeOpacity={0.7}>
        <View style={[styles.toolIconWrap, { backgroundColor: tool.color + '18' }]}>
          <Icon color={tool.color} size={22} />
        </View>
        <View style={styles.toolText}>
          <Text style={styles.toolLabel}>{tool.label}</Text>
          <Text style={styles.toolSubtitle}>{tool.subtitle}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function ToolSection({ title, tools }: { title: string; tools: ToolItem[] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.toolGrid}>
        {tools.map((tool, i) => (
          <ToolCard key={tool.label} tool={tool} index={i} />
        ))}
      </View>
    </View>
  );
}

export default function MoreScreen() {
  const { activeProject } = useProjects();
  useSubscription(); // kept for RC SDK initialization
  const { isPro, restoreAndActivate, isPurchasing } = useDeviceLicense();
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();

  const handleRestore = async () => {
    const result = await restoreAndActivate();
    if (result.success) {
      Alert.alert(
        'Restored!',
        'Your subscription and device license have been restored.',
        [{ text: 'Great', onPress: () => router.push('/paywall' as never) }]
      );
    } else {
      Alert.alert(
        'Nothing to Restore',
        result.error ?? 'No active Pro subscription was found for this Apple ID.',
      );
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {activeProject && (
        <View style={styles.projectContext}>
          <View style={styles.contextDot} />
          <Text style={styles.contextText}>{activeProject.title}</Text>
        </View>
      )}

      <ToolSection title="Pre-Production" tools={PRE_PROD_TOOLS} />
      <ToolSection title="On Set" tools={ON_SET_TOOLS} />
      <ToolSection title="Post-Production" tools={POST_TOOLS} />
      <ToolSection title="Reference & Profile" tools={REFERENCE_TOOLS} />

      {/* Subscription & Settings Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>

        {/* ── Sign In / Profile ── */}
        {isAuthenticated ? (
          <TouchableOpacity style={styles.subscriptionCard} onPress={() => router.push('/auth/profile' as never)} activeOpacity={0.7}>
            <View style={[styles.subIconWrap, { backgroundColor: '#34D39918' }]}>
              <UserCircle color="#34D399" size={22} />
            </View>
            <View style={styles.subTextWrap}>
              <Text style={styles.subTitle}>{user?.user_metadata?.display_name || 'My Account'}</Text>
              <Text style={styles.subSubtitle}>{user?.email || 'Signed in'}</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.subscriptionCard} onPress={() => router.push('/auth/sign-in' as never)} activeOpacity={0.7}>
            <View style={[styles.subIconWrap, { backgroundColor: '#60A5FA18' }]}>
              <LogIn color="#60A5FA" size={22} />
            </View>
            <View style={styles.subTextWrap}>
              <Text style={styles.subTitle}>Sign In</Text>
              <Text style={styles.subSubtitle}>Sync across devices & collaborate</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* ── Sync / Devices / Team ── */}
        {isAuthenticated && (
          <View style={styles.settingsGroup}>
            <TouchableOpacity style={styles.settingsRow} onPress={() => router.push('/settings/sync' as never)} activeOpacity={0.7}>
              <Cloud color={Colors.text.secondary} size={18} />
              <Text style={styles.settingsRowText}>Sync Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingsRow} onPress={() => router.push('/settings/devices' as never)} activeOpacity={0.7}>
              <Smartphone color={Colors.text.secondary} size={18} />
              <Text style={styles.settingsRowText}>My Devices</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.settingsRowLast, !activeProject && styles.settingsRowDisabled]}
              onPress={() => { if (activeProject) router.push('/project/team' as never); }}
              activeOpacity={activeProject ? 0.7 : 1}
            >
              <Users2 color={activeProject ? Colors.text.secondary : Colors.text.tertiary} size={18} />
              <Text style={[styles.settingsRowText, !activeProject && styles.settingsRowTextDisabled]}>
                Project Team
              </Text>
              {!activeProject && <Text style={styles.settingsRowHint}>Open a project first</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* ── Pro Status / Upgrade ── */}
        <TouchableOpacity style={styles.subscriptionCard} onPress={() => router.push('/paywall' as never)} activeOpacity={0.7}>
          <View style={[styles.subIconWrap, isPro ? styles.subIconPro : styles.subIconFree]}>
            <Crown color={isPro ? Colors.accent.gold : Colors.text.tertiary} size={22} />
          </View>
          <View style={styles.subTextWrap}>
            <Text style={styles.subTitle}>{isPro ? 'Mise Pro' : 'Upgrade to Pro'}</Text>
            <Text style={styles.subSubtitle}>
              {isPro ? 'All premium features unlocked' : 'Unlock import, AI tools & more'}
            </Text>
          </View>
          {!isPro && (
            <View style={styles.proBadge}>
              <Text style={styles.proBadgeText}>PRO</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* ── Manage Subscription (Pro only) ── */}
        {isPro && (
          <View style={styles.settingsGroup}>
            <TouchableOpacity
              style={styles.settingsRowLast}
              onPress={() => Linking.openURL('https://apps.apple.com/account/subscriptions')}
              activeOpacity={0.7}
            >
              <Shield color={Colors.text.secondary} size={18} />
              <Text style={styles.settingsRowText}>Manage Subscription</Text>
              <ExternalLink color={Colors.text.tertiary} size={14} />
            </TouchableOpacity>
          </View>
        )}

        {/* ── Restore Purchases + Privacy Policy ── */}
        <View style={styles.settingsGroup}>
          <TouchableOpacity
            style={styles.settingsRow}
            onPress={handleRestore}
            activeOpacity={0.7}
            disabled={isPurchasing}
          >
            {isPurchasing ? (
              <ActivityIndicator size="small" color={Colors.text.secondary} />
            ) : (
              <RotateCcw color={Colors.text.secondary} size={18} />
            )}
            <Text style={[styles.settingsRowText, isPurchasing && { opacity: 0.5 }]}>
              {isPurchasing ? 'Restoring…' : 'Restore Purchases'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingsRowLast}
            onPress={() => Linking.openURL('https://texas0418.github.io/MiseApp/')}
            activeOpacity={0.7}
          >
            <Shield color={Colors.text.secondary} size={18} />
            <Text style={styles.settingsRowText}>Privacy Policy</Text>
            <ExternalLink color={Colors.text.tertiary} size={14} />
          </TouchableOpacity>
        </View>

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  content: { paddingBottom: 40 },
  projectContext: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, backgroundColor: Colors.accent.goldBg, gap: 8 },
  contextDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.accent.gold },
  contextText: { fontSize: 12, fontWeight: '600' as const, color: Colors.accent.gold, letterSpacing: 0.3 },
  section: { paddingHorizontal: 16, paddingTop: 20 },
  sectionTitle: { fontSize: 11, fontWeight: '700' as const, color: Colors.text.tertiary, textTransform: 'uppercase' as const, letterSpacing: 1.2, marginBottom: 10, paddingHorizontal: 4 },
  toolGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  toolCardWrapper: { width: '48.5%' as unknown as number, flexGrow: 0, flexShrink: 0, flexBasis: '48%' },
  toolCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg.card, borderRadius: 12, padding: 12, borderWidth: 0.5, borderColor: Colors.border.subtle, gap: 10 },
  toolIconWrap: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  toolText: { flex: 1 },
  toolLabel: { fontSize: 13, fontWeight: '600' as const, color: Colors.text.primary },
  toolSubtitle: { fontSize: 10, color: Colors.text.tertiary, marginTop: 1 },
  subscriptionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg.card, borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: Colors.border.subtle, gap: 12, marginBottom: 8 },
  subIconWrap: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  subIconPro: { backgroundColor: Colors.accent.goldBg },
  subIconFree: { backgroundColor: Colors.bg.tertiary },
  subTextWrap: { flex: 1 },
  subTitle: { fontSize: 14, fontWeight: '600', color: Colors.text.primary },
  subSubtitle: { fontSize: 11, color: Colors.text.tertiary, marginTop: 2 },
  proBadge: { backgroundColor: Colors.accent.gold, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  proBadgeText: { fontSize: 10, fontWeight: '700', color: Colors.text.inverse, letterSpacing: 0.5 },
  settingsGroup: { backgroundColor: Colors.bg.card, borderRadius: 12, borderWidth: 0.5, borderColor: Colors.border.subtle, marginBottom: 8, overflow: 'hidden' },
  settingsRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, gap: 12, borderBottomWidth: 0.5, borderBottomColor: Colors.border.subtle },
  settingsRowLast: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, gap: 12 },
  settingsRowDisabled: { opacity: 0.4 },
  settingsRowText: { flex: 1, fontSize: 14, color: Colors.text.primary },
  settingsRowTextDisabled: { color: Colors.text.tertiary },
  settingsRowHint: { fontSize: 11, color: Colors.text.tertiary, fontStyle: 'italic' },
});
