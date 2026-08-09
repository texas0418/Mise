/**
 * app/(tabs)/(today)/index.tsx
 *
 * Day-of-shoot, as the thing the app opens on.
 *
 * Everywhere else in Mise is organised around entities — shots, days, cast —
 * while the job is organised around days (#50). This screen answers the
 * questions asked at 5:40am in a van: what day is it, when is call, where, who
 * is in it, what are we shooting, and are we making it.
 *
 * All of the arithmetic is in utils/today.ts and all of the rendering is in
 * components/TodayCards.tsx. What is left here is the wiring: which records
 * belong to the day, and where a tap goes.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, Linking } from 'react-native';
import { CalendarDays, AlertCircle, Plus } from 'lucide-react-native';
import {
  useProjects, useProjectSchedule, useProjectScenes, useProjectShots,
  useProjectCast, useProjectCrew, useProjectLocations,
} from '@/contexts/ProjectContext';
import { useLayout } from '@/utils/useLayout';
import Colors from '@/constants/colors';
import {
  resolveCurrentDay, scenesForDay, shotsForScenes, summarizeWork, isShotComplete,
  castCalledFor, computePace, dayProgress, parseClockTime,
  localMinutes, formatClock, totalDayCount, type DayRelation,
} from '@/utils/today';
import { fetchDayWeather, needsCoverSet, type DayWeather } from '@/utils/forecast';
import { matchLocation } from '@/utils/callSheet';
import {
  DayHeader, TimesCard, WorkCard, PaceCard, CalledCard,
  LocationCard, WeatherCard, QuickActions, type SceneLine, type CalledPerson,
} from '@/components/TodayCards';
import type { LocationScout, Project, ScheduleDay } from '@/types';
import { useGuardedRouter } from '@/utils/useGuardedRouter';

/** Minutes tick over, so anything finer is a re-render for nothing. */
const CLOCK_INTERVAL_MS = 15_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** What to print for a call or wrap: the tidied time, or the raw text if it did not parse. */
function displayTime(minutes: number | null, raw: string): string | null {
  if (minutes !== null) return formatClock(minutes);
  const text = String(raw ?? '').trim();
  return text.length > 0 ? text : null;
}

/** Location details, falling back to the day's own text when nothing is scouted. */
function locationFields(location: LocationScout | null, dayLocation: string) {
  if (!location) return { name: dayLocation, address: '', parkingNotes: '' };
  return {
    name: location.name || dayLocation,
    address: location.address || '',
    parkingNotes: location.parkingNotes || '',
  };
}

/** "Sunday, August 9" — the way a call sheet dates itself. */
function formatDateLabel(dateKey: string): string {
  const parsed = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateKey;
  return parsed.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function relationLabel(relation: DayRelation, daysAway: number): string | null {
  if (relation === 'today') return null;
  if (relation === 'wrapped') return 'LAST SHOOT DAY';
  if (daysAway === 1) return 'TOMORROW';
  return `IN ${daysAway} DAYS`;
}

function relationCaption(relation: DayRelation, daysAway: number): string | null {
  if (relation === 'today') return null;
  if (relation === 'wrapped') return 'This day has wrapped.';
  return daysAway === 1 ? 'Call is tomorrow.' : `Call is in ${daysAway} days.`;
}

function directionsUrl(location: LocationScout | null, fallbackName: string): string | null {
  const coords = location && location.latitude !== undefined && location.longitude !== undefined
    ? `${location.latitude},${location.longitude}`
    : '';
  const query = coords || String(location?.address || location?.name || fallbackName || '').trim();
  if (!query) return null;

  const encoded = encodeURIComponent(query);
  return Platform.OS === 'ios'
    ? `https://maps.apple.com/?q=${encoded}`
    : `https://www.google.com/maps/search/?api=1&query=${encoded}`;
}

function contentStyle(isTablet: boolean, paddingHorizontal: number) {
  if (!isTablet) return { paddingHorizontal };
  return { paddingHorizontal, maxWidth: 800, alignSelf: 'center' as const, width: '100%' as const };
}

// ---------------------------------------------------------------------------
// Empty states
// ---------------------------------------------------------------------------

function EmptyState({ title, subtitle, cta }: {
  title: string;
  subtitle: string;
  cta?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.emptyContainer}>
      <AlertCircle color={Colors.text.tertiary} size={44} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
      {cta ? (
        <TouchableOpacity
          style={styles.emptyCta}
          onPress={cta.onPress}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={cta.label}
          testID="today-empty-cta"
        >
          <Plus color={Colors.text.inverse} size={16} />
          <Text style={styles.emptyCtaText}>{cta.label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Weather, fetched for whichever day is on screen
// ---------------------------------------------------------------------------

function useDayWeather(location: LocationScout | null, dateKey: string): DayWeather | null {
  const [weather, setWeather] = useState<DayWeather | null>(null);
  const latitude = location?.latitude;
  const longitude = location?.longitude;

  useEffect(() => {
    if (latitude === undefined || longitude === undefined) {
      setWeather(null);
      return;
    }
    let live = true;
    fetchDayWeather(latitude, longitude, dateKey).then(result => {
      if (live) setWeather(result);
    });
    return () => { live = false; };
  }, [latitude, longitude, dateKey]);

  return weather;
}

// ---------------------------------------------------------------------------
// The day itself
//
// Split from the screen so every hook below runs with a day in hand. Folding
// this back into TodayScreen would mean hooks above the "no shoot days" guard
// and a pile of optional chaining under it.
// ---------------------------------------------------------------------------

interface ShootDayViewProps {
  project: Project;
  projectId: string;
  day: ScheduleDay;
  relation: DayRelation;
  daysAway: number;
  totalDays: number;
  now: Date;
}

function ShootDayView({ project, projectId, day, relation, daysAway, totalDays, now }: ShootDayViewProps) {
  const scenes = useProjectScenes(projectId);
  const shots = useProjectShots(projectId);
  const cast = useProjectCast(projectId);
  const crew = useProjectCrew(projectId);
  const locations = useProjectLocations(projectId);
  const router = useGuardedRouter();
  const { contentPadding, isTablet } = useLayout();

  const isToday = relation === 'today';

  const dayScenes = useMemo(() => scenesForDay(day, scenes), [day, scenes]);
  const work = useMemo(() => summarizeWork(dayScenes, shots), [dayScenes, shots]);

  const callMinutes = parseClockTime(day.callTime);
  const wrapMinutes = parseClockTime(day.wrapTime);
  const progress = useMemo(
    () => dayProgress(callMinutes, wrapMinutes, localMinutes(now)),
    [callMinutes, wrapMinutes, now],
  );
  const pace = useMemo(() => computePace(work, progress, callMinutes), [work, progress, callMinutes]);

  const sceneLines: SceneLine[] = useMemo(() => dayScenes.map(scene => {
    const own = shotsForScenes(shots, [scene]);
    return {
      id: scene.id,
      number: scene.number,
      heading: scene.heading,
      pageEighths: scene.pageEighths,
      shotsPlanned: own.length,
      shotsCompleted: own.filter(s => isShotComplete(s.status)).length,
    };
  }), [dayScenes, shots]);

  const castToday: CalledPerson[] = useMemo(
    () => castCalledFor(cast, dayScenes).map(member => ({
      id: member.id,
      primary: member.characterName,
      secondary: member.actorName,
    })),
    [cast, dayScenes],
  );

  // Only the calls that differ from the general one are worth the space — the
  // rest are on the day's call time and repeating it per person is noise.
  const crewWithOwnCalls: CalledPerson[] = useMemo(
    () => crew
      .filter(member => member.callTime && parseClockTime(member.callTime) !== callMinutes)
      .map(member => ({
        id: member.assignmentId,
        primary: member.name,
        secondary: member.projectRole,
        callTime: member.callTime,
      })),
    [crew, callMinutes],
  );

  const location = useMemo(() => matchLocation(day.location, locations), [day.location, locations]);
  const weather = useDayWeather(location, day.date);
  const directions = directionsUrl(location, day.location);

  const handleDirections = useCallback(() => {
    if (directions) Linking.openURL(directions).catch(() => {});
  }, [directions]);

  // The first scene of the day is the one being shot, so it is the sensible
  // default for a take logged from here.
  const firstSceneNumber = dayScenes.length > 0 ? dayScenes[0].number : '';
  // No local debounce needed: useGuardedRouter throttles repeats per
  // destination, so a double tap on any of these opens one screen (#78).
  const handleLogTake = useCallback(
    () => router.push(`/log-take?scene=${encodeURIComponent(firstSceneNumber)}` as never),
    [router, firstSceneNumber],
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, contentStyle(isTablet, contentPadding)]}
      showsVerticalScrollIndicator={false}
      testID="today-screen"
    >
      <DayHeader
        dayNumber={day.dayNumber}
        totalDays={totalDays}
        dateLabel={formatDateLabel(day.date)}
        projectTitle={project.title}
        relationLabel={relationLabel(relation, daysAway)}
      />

      <TimesCard
        callTime={displayTime(callMinutes, day.callTime)}
        wrapTime={displayTime(wrapMinutes, day.wrapTime)}
        nowLabel={formatClock(localMinutes(now))}
        progress={progress}
        captionOverride={relationCaption(relation, daysAway)}
      />

      {isToday ? (
        <QuickActions
          onLogTake={handleLogTake}
          onContinuity={() => router.push('/new-continuity' as never)}
          onNote={() => router.push('/new-note' as never)}
        />
      ) : null}

      <WorkCard
        scenes={sceneLines}
        work={work}
        title={isToday ? "TODAY'S WORK" : "THE DAY'S WORK"}
        onScenePress={() => router.push('/script-breakdown' as never)}
      />

      {isToday ? (
        <PaceCard
          pace={pace}
          progress={progress}
          hasWork={work.eighthsPlanned > 0 || work.shotsPlanned > 0}
        />
      ) : null}

      <CalledCard
        cast={castToday}
        crewWithOwnCalls={crewWithOwnCalls}
        generalCall={displayTime(callMinutes, day.callTime)}
        title={isToday ? 'CALLED TODAY' : 'CALLED THAT DAY'}
      />

      <LocationCard
        {...locationFields(location, day.location)}
        onDirections={directions ? handleDirections : null}
      />

      {weather ? (
        <WeatherCard
          weather={weather}
          coverSet={needsCoverSet(weather.conditionCode, weather.precipChance)}
        />
      ) : null}

      <TouchableOpacity
        style={styles.scheduleLink}
        onPress={() => router.push('/(tabs)/schedule' as never)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Open the full schedule"
        testID="today-schedule-link"
      >
        <CalendarDays color={Colors.text.tertiary} size={14} />
        <Text style={styles.scheduleLinkText}>Full schedule · {totalDays} days</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function TodayScreen() {
  const { activeProject, activeProjectId } = useProjects();
  const schedule = useProjectSchedule(activeProjectId);
  const router = useGuardedRouter();

  // A live clock, and with it a live answer to "which day is it" — a day that
  // rolls over or a call that arrives while the screen is open both land here.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), CLOCK_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  const selection = useMemo(() => resolveCurrentDay(schedule, now), [schedule, now]);

  if (!activeProject || !activeProjectId) {
    return (
      <EmptyState
        title="No project selected"
        subtitle="Pick a production from the Projects tab and its shoot days appear here."
      />
    );
  }

  if (!selection.day) {
    return (
      <EmptyState
        title="No shoot days scheduled"
        subtitle={`${activeProject.title} has no days on the schedule yet. Add one and this becomes your day-of-shoot view.`}
        cta={{ label: 'Add a shoot day', onPress: () => router.push('/new-schedule-day' as never) }}
      />
    );
  }

  return (
    <ShootDayView
      project={activeProject}
      projectId={activeProjectId}
      day={selection.day}
      relation={selection.relation}
      daysAway={selection.daysAway}
      totalDays={totalDayCount(schedule)}
      now={now}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  content: { paddingTop: 12, paddingBottom: 40 },

  emptyContainer: {
    flex: 1, backgroundColor: Colors.bg.primary,
    justifyContent: 'center', alignItems: 'center', padding: 40,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600' as const, color: Colors.text.primary, marginTop: 16 },
  emptySubtitle: {
    fontSize: 14, color: Colors.text.secondary, marginTop: 8,
    textAlign: 'center', lineHeight: 20,
  },
  emptyCta: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24,
    paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, backgroundColor: Colors.accent.gold,
  },
  emptyCtaText: { fontSize: 14, fontWeight: '700' as const, color: Colors.text.inverse },

  scheduleLink: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12,
  },
  scheduleLinkText: { fontSize: 14, color: Colors.text.tertiary, fontWeight: '600' as const },
});
