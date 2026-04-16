/**
 * components/OnboardingFlow.tsx
 * 
 * Full-screen onboarding walkthrough rendered as an overlay.
 * No routing — just a callback when done.
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions,
  FlatList, Animated, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import {
  Clapperboard, Camera, CalendarDays, Wrench, ArrowRight,
  Film, ListChecks, Clock, Upload, Sparkles, ChevronRight,
} from 'lucide-react-native';
import Colors from '@/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Props {
  onComplete: () => void;
}

interface OnboardingSlide {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ElementType;
  iconColor: string;
  features?: { icon: React.ElementType; label: string }[];
}

const SLIDES: OnboardingSlide[] = [
  {
    id: 'welcome',
    title: 'Welcome to Mise',
    subtitle: 'Your Director\'s Companion',
    description: 'Everything you need to manage your film — from first draft to final cut — in one beautifully crafted app.',
    icon: Clapperboard,
    iconColor: Colors.accent.gold,
  },
  {
    id: 'projects',
    title: 'Organize Your Films',
    subtitle: 'Projects',
    description: 'Create projects for each film with full crew directories, budgets, locations, and production notes. Everything stays connected.',
    icon: Film,
    iconColor: '#60A5FA',
    features: [
      { icon: Film, label: 'Multiple projects' },
      { icon: ListChecks, label: 'Crew & cast management' },
      { icon: Upload, label: 'CSV & AI import' },
    ],
  },
  {
    id: 'planning',
    title: 'Plan Your Shoot',
    subtitle: 'Shots & Schedule',
    description: 'Build detailed shot lists with type, movement, and lens info. Create shoot day schedules with scene assignments and call times.',
    icon: Camera,
    iconColor: '#4ADE80',
    features: [
      { icon: Camera, label: 'Shot list builder' },
      { icon: CalendarDays, label: 'Day-by-day schedule' },
      { icon: ListChecks, label: 'Script breakdowns' },
    ],
  },
  {
    id: 'onset',
    title: 'Your Set Companion',
    subtitle: 'On-Set Tools',
    description: 'Digital slate, continuity notes, time tracking, blocking notes, and more — purpose-built tools for production day.',
    icon: Wrench,
    iconColor: '#F472B6',
    features: [
      { icon: Clock, label: 'Digital slate & timer' },
      { icon: ListChecks, label: 'Continuity tracking' },
      { icon: Sparkles, label: '25+ specialized tools' },
    ],
  },
  {
    id: 'start',
    title: 'Let\'s Make a Film',
    subtitle: 'Get Started',
    description: 'Your first project is waiting. Dive in and start building your production — Mise will keep everything organized.',
    icon: ArrowRight,
    iconColor: Colors.accent.gold,
  },
];

export default function OnboardingFlow({ onComplete }: Props) {
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: false }
  );

  const handleMomentumEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setCurrentIndex(index);
  }, []);

  const goToNext = useCallback(() => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
      setCurrentIndex(currentIndex + 1);
    }
  }, [currentIndex]);

  const isLastSlide = currentIndex === SLIDES.length - 1;

  return (
    <View style={styles.container}>
      {/* Skip button */}
      {!isLastSlide && (
        <TouchableOpacity style={styles.skipBtn} onPress={onComplete} activeOpacity={0.7}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={item => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={handleScroll}
        onMomentumScrollEnd={handleMomentumEnd}
        scrollEventThrottle={16}
        renderItem={({ item, index }) => (
          <SlideView slide={item} index={index} scrollX={scrollX} />
        )}
      />

      {/* Bottom section */}
      <View style={styles.bottomSection}>
        {/* Dot indicators */}
        <View style={styles.dotRow}>
          {SLIDES.map((_, i) => {
            const inputRange = [(i - 1) * SCREEN_WIDTH, i * SCREEN_WIDTH, (i + 1) * SCREEN_WIDTH];
            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [8, 24, 8],
              extrapolate: 'clamp',
            });
            const dotOpacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.3, 1, 0.3],
              extrapolate: 'clamp',
            });
            return (
              <Animated.View
                key={i}
                style={[styles.dot, { width: dotWidth, opacity: dotOpacity }]}
              />
            );
          })}
        </View>

        {/* Action button */}
        {isLastSlide ? (
          <TouchableOpacity style={styles.startBtn} onPress={onComplete} activeOpacity={0.8}>
            <Text style={styles.startBtnText}>Get Started</Text>
            <ArrowRight color={Colors.text.inverse} size={20} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.nextBtn} onPress={goToNext} activeOpacity={0.8}>
            <Text style={styles.nextBtnText}>Next</Text>
            <ChevronRight color={Colors.accent.gold} size={18} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── Slide View ──────────────────────────────────────────────────

function SlideView({ slide, index, scrollX }: {
  slide: OnboardingSlide;
  index: number;
  scrollX: Animated.Value;
}) {
  const Icon = slide.icon;

  const inputRange = [(index - 0.5) * SCREEN_WIDTH, index * SCREEN_WIDTH, (index + 0.5) * SCREEN_WIDTH];
  const scale = scrollX.interpolate({
    inputRange,
    outputRange: [0.8, 1, 0.8],
    extrapolate: 'clamp',
  });
  const opacity = scrollX.interpolate({
    inputRange,
    outputRange: [0, 1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
      <Animated.View style={[styles.slideContent, { opacity, transform: [{ scale }] }]}>
        <View style={[styles.iconContainer, { borderColor: slide.iconColor + '33' }]}>
          <View style={[styles.iconCircle, { backgroundColor: slide.iconColor + '15' }]}>
            <Icon color={slide.iconColor} size={40} />
          </View>
        </View>

        <Text style={styles.slideSubtitle}>{slide.subtitle}</Text>
        <Text style={styles.slideTitle}>{slide.title}</Text>
        <Text style={styles.slideDescription}>{slide.description}</Text>

        {slide.features && (
          <View style={styles.featureList}>
            {slide.features.map((feature, i) => {
              const FeatureIcon = feature.icon;
              return (
                <View key={i} style={styles.featurePill}>
                  <FeatureIcon color={Colors.accent.gold} size={14} />
                  <Text style={styles.featurePillText}>{feature.label}</Text>
                </View>
              );
            })}
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  skipBtn: { position: 'absolute', top: 60, right: 24, zIndex: 10, paddingVertical: 8, paddingHorizontal: 16 },
  skipText: { fontSize: 15, color: Colors.text.tertiary, fontWeight: '500' },
  slide: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  slideContent: { alignItems: 'center', maxWidth: 400 },
  iconContainer: { width: 100, height: 100, borderRadius: 30, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', marginBottom: 32 },
  iconCircle: { width: 80, height: 80, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  slideSubtitle: { fontSize: 12, fontWeight: '700', color: Colors.accent.gold, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 },
  slideTitle: { fontSize: 28, fontWeight: '800', color: Colors.text.primary, textAlign: 'center', letterSpacing: -0.5, marginBottom: 12 },
  slideDescription: { fontSize: 15, color: Colors.text.secondary, textAlign: 'center', lineHeight: 22, paddingHorizontal: 8 },
  featureList: { marginTop: 28, gap: 10, width: '100%' },
  featurePill: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, backgroundColor: Colors.bg.card, borderWidth: 0.5, borderColor: Colors.border.subtle },
  featurePillText: { fontSize: 14, color: Colors.text.primary, fontWeight: '500' },
  bottomSection: { paddingBottom: 50, paddingHorizontal: 24, alignItems: 'center', gap: 24 },
  dotRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { height: 8, borderRadius: 4, backgroundColor: Colors.accent.gold },
  nextBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 14, paddingHorizontal: 28, borderRadius: 12, borderWidth: 1.5, borderColor: Colors.accent.gold + '44', backgroundColor: Colors.accent.goldBg },
  nextBtnText: { fontSize: 16, fontWeight: '700', color: Colors.accent.gold },
  startBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16, paddingHorizontal: 36, borderRadius: 14, backgroundColor: Colors.accent.gold, shadowColor: Colors.accent.gold, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  startBtnText: { fontSize: 17, fontWeight: '800', color: Colors.text.inverse },
});
