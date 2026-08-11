/**
 * components/TodayCards.tsx
 *
 * The pieces the Today view is assembled from. Presentational only — every one
 * of them takes finished numbers and renders them. The arithmetic lives in
 * utils/today.ts, where it can be tested without a renderer.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import {
  Clock, MapPin, Navigation, Sunrise, Sunset, CloudRain,
  Camera, Image as ImageIcon, StickyNote, Users, Film,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { formatEighths } from '@/utils/eighths';
import {
  formatClock, formatDuration, type DayProgress, type Pace, type WorkSummary,
} from '@/utils/today';
import type { DayWeather } from '@/utils/forecast';
import { useTypography } from '@/utils/useTypography';

// ─── Header ──────────────────────────────────────────────────────

export function DayHeader({ dayNumber, totalDays, dateLabel, projectTitle, relationLabel }: {
  dayNumber: number;
  totalDays: number;
  dateLabel: string;
  projectTitle: string;
  relationLabel: string | null;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <Text style={styles.headerDay}>DAY {dayNumber}</Text>
        <Text style={styles.headerOf}>of {totalDays}</Text>
        {relationLabel ? (
          <View style={styles.relationPill}>
            <Text style={styles.relationText}>{relationLabel}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.headerDate}>{dateLabel}</Text>
      <Text style={styles.headerProject} numberOfLines={1}>{projectTitle}</Text>
    </View>
  );
}

// ─── Card header ─────────────────────────────────────────────────

/**
 * The title row every card starts with: an icon, a heading, and whatever
 * trailing meta the card wants pushed to the right.
 *
 * Those three compete for one line, and past the accessibility text sizes there
 * is no line left to compete for — on a real iPad "TODAY'S WORK" ran off the
 * right edge and "PACE" wrapped one letter per line, squeezed by the status
 * pill beside it. The answer is not to shrink the text a reader has explicitly
 * asked to be bigger; it is to stop asking for one line. Past the threshold the
 * row becomes two rows and the trailing meta loses its `marginLeft: auto`,
 * which is why that lives on this wrapper rather than on the meta styles.
 */
function CardHeader({ icon: Icon, title, children }: {
  icon: React.ComponentType<{ color?: string; size?: number }>;
  title: string;
  children?: React.ReactNode;
}) {
  const { icon, isLargeText } = useTypography();

  return (
    <View style={[styles.cardHeader, isLargeText && styles.cardHeaderStacked]}>
      <View style={styles.cardHeaderTitle}>
        <Icon color={Colors.accent.gold} size={icon(14)} />
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      {children ? (
        <View style={isLargeText ? styles.cardHeaderTrailingStacked : styles.cardHeaderTrailing}>
          {children}
        </View>
      ) : null}
    </View>
  );
}

// ─── Times ───────────────────────────────────────────────────────

function TimeCell({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View style={styles.timeCell}>
      <Text style={styles.timeLabel}>{label}</Text>
      <Text style={[styles.timeValue, tone ? { color: tone } : null]}>{value}</Text>
    </View>
  );
}

/** What the progress line says depends entirely on where in the day we are. */
function progressCaption(progress: DayProgress): string {
  if (progress.phase === 'before-call') return `Call in ${formatDuration(progress.untilCallMinutes)}`;
  if (progress.phase === 'wrapped') return 'Wrapped';
  if (progress.phase === 'shooting') {
    return `${formatDuration(progress.elapsedMinutes)} in · ${formatDuration(progress.remainingMinutes)} to wrap`;
  }
  return 'No call or wrap time set';
}

/**
 * `captionOverride` carries the cases progress cannot describe — a day that is
 * still three days out has a call time but no elapsed anything, and letting
 * dayProgress narrate that would produce "Call in 7h" for tomorrow morning.
 */
export function TimesCard({ callTime, wrapTime, nowLabel, progress, captionOverride }: {
  callTime: string | null;
  wrapTime: string | null;
  nowLabel: string;
  progress: DayProgress;
  captionOverride?: string | null;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, progress.fraction)) * 100);

  return (
    <View style={styles.card} testID="today-times-card">
      <View style={styles.timeRow}>
        <TimeCell label="CALL" value={callTime ?? '—'} tone={Colors.status.active} />
        <TimeCell label="NOW" value={nowLabel} />
        <TimeCell label="WRAP" value={wrapTime ?? '—'} tone={Colors.status.error} />
      </View>

      {captionOverride ? null : (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct}%` }]} />
        </View>
      )}

      <View style={styles.progressCaptionRow}>
        <Clock color={Colors.text.tertiary} size={12} />
        <Text style={styles.progressCaption} testID="today-progress-caption">
          {captionOverride ?? progressCaption(progress)}
        </Text>
      </View>
    </View>
  );
}

// ─── Work ────────────────────────────────────────────────────────

export interface SceneLine {
  id: string;
  number: string;
  heading: string;
  pageEighths: number;
  shotsPlanned: number;
  shotsCompleted: number;
}

function SceneRow({ scene, onPress }: { scene: SceneLine; onPress: () => void }) {
  const done = scene.shotsPlanned > 0 && scene.shotsCompleted === scene.shotsPlanned;
  return (
    <TouchableOpacity
      style={styles.sceneRow}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Scene ${scene.number}, ${scene.heading}, ${scene.shotsCompleted} of ${scene.shotsPlanned} shots complete`}
      testID={`today-scene-${scene.id}`}
    >
      <View style={[styles.sceneDot, done && styles.sceneDotDone]} />
      <Text style={styles.sceneNumber}>{scene.number}</Text>
      <Text style={styles.sceneHeading} numberOfLines={1}>{scene.heading || 'No slugline'}</Text>
      <Text style={styles.sceneShots}>
        {scene.shotsPlanned > 0 ? `${scene.shotsCompleted}/${scene.shotsPlanned}` : '—'}
      </Text>
      <Text style={styles.scenePages}>{formatEighths(scene.pageEighths)}</Text>
    </TouchableOpacity>
  );
}

export function WorkCard({ scenes, work, title, onScenePress }: {
  scenes: SceneLine[];
  work: WorkSummary;
  title: string;
  onScenePress: (sceneId: string) => void;
}) {
  return (
    <View style={styles.card} testID="today-work-card">
      <CardHeader icon={Film} title={title}>
        {scenes.length > 0 ? (
          <Text style={styles.cardMeta} testID="today-work-meta">
            {work.shotsCompleted}/{work.shotsPlanned} shots · {formatEighths(work.eighthsCompleted)} of {formatEighths(work.eighthsPlanned)} pages
          </Text>
        ) : null}
      </CardHeader>

      {scenes.length === 0 ? (
        <Text style={styles.emptyLine}>No scenes are linked to this day yet.</Text>
      ) : (
        scenes.map(scene => (
          <SceneRow key={scene.id} scene={scene} onPress={() => onScenePress(scene.id)} />
        ))
      )}
    </View>
  );
}

// ─── Pace ────────────────────────────────────────────────────────

const PACE_TONE: Record<Pace['status'], string> = {
  ahead: Colors.status.active,
  'on-track': Colors.accent.gold,
  behind: Colors.status.error,
  unknown: Colors.text.tertiary,
};

const PACE_LABEL: Record<Pace['status'], string> = {
  ahead: 'AHEAD',
  'on-track': 'ON SCHEDULE',
  behind: 'BEHIND',
  unknown: 'NOT YET',
};

/** Why there is no projection — each dead end has its own reason. */
function paceExplanation(phase: DayProgress['phase'], hasWork: boolean): string {
  if (!hasWork) return 'No scenes or shots are linked to today yet.';
  if (phase === 'unknown') return 'Pace needs a call time and a wrap time on this day.';
  if (phase === 'before-call') return 'Pace starts at call.';
  if (phase === 'wrapped') return 'The scheduled day is over.';
  return 'Nothing shot yet, so there is no rate to project from.';
}

/**
 * Past this much overrun the extrapolation has stopped being a wrap time and
 * started being a warning, and printing a clock time for it would be a lie
 * dressed as precision.
 */
const WONT_FINISH_MINUTES = 240;

export function PaceCard({ pace, progress, hasWork }: {
  pace: Pace;
  progress: DayProgress;
  hasWork: boolean;
}) {
  const tone = PACE_TONE[pace.status];
  const over = pace.overrunMinutes;
  const wontFinish = over !== null && over > WONT_FINISH_MINUTES;

  return (
    <View style={styles.card} testID="today-pace-card">
      <CardHeader icon={Clock} title="PACE">
        <View style={[styles.pacePill, { backgroundColor: tone + '22', borderColor: tone + '55' }]}>
          <Text style={[styles.pacePillText, { color: tone }]} testID="today-pace-status">
            {PACE_LABEL[pace.status]}
          </Text>
        </View>
      </CardHeader>

      <View style={styles.paceBars}>
        <PaceBar label="Work" fraction={pace.workFraction} tone={tone} />
        <PaceBar label="Day" fraction={pace.timeFraction} tone={Colors.text.tertiary} />
      </View>

      {pace.projectedWrapMinutes === null ? (
        <Text style={styles.emptyLine} testID="today-pace-explanation">
          {paceExplanation(progress.phase, hasWork)}
        </Text>
      ) : null}

      {wontFinish ? (
        <Text style={[styles.paceProjection, { color: Colors.status.error }]} testID="today-pace-projection">
          At this rate the day does not finish — {Math.round(pace.workFraction * 100)}% of the work
          in {Math.round(pace.timeFraction * 100)}% of the hours.
        </Text>
      ) : null}

      {pace.projectedWrapMinutes !== null && !wontFinish ? (
        <Text style={styles.paceProjection} testID="today-pace-projection">
          At this rate: wrap {formatClock(pace.projectedWrapMinutes)}
          {over !== null && Math.abs(over) >= 15
            ? ` · ${formatDuration(Math.abs(over))} ${over > 0 ? 'over' : 'under'}`
            : ''}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * "Work 62% ▓▓▓▓░░░" — a label, a track and a percentage on one line.
 *
 * The label and percentage were pinned to `width: 30` and `width: 34`, which is
 * exactly as wide as "Work" and "100%" at the default setting and narrower than
 * a single character at the largest. That is what produced the `W/o/r/k` column
 * on the iPad: not a wrapping bug, a box that never grew. Past the threshold
 * the label and percentage share a line of their own above a full-width track.
 */
function PaceBar({ label, fraction, tone }: { label: string; fraction: number; tone: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
  const { isLargeText } = useTypography();

  if (isLargeText) {
    return (
      <View>
        <View style={styles.paceBarCaption}>
          <Text style={styles.paceBarLabelStacked}>{label}</Text>
          <Text style={styles.paceBarPctStacked}>{pct}%</Text>
        </View>
        <View style={styles.paceTrackStacked}>
          <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: tone }]} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.paceBarRow}>
      <Text style={styles.paceBarLabel}>{label}</Text>
      <View style={styles.paceTrack}>
        <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: tone }]} />
      </View>
      <Text style={styles.paceBarPct}>{pct}%</Text>
    </View>
  );
}

// ─── Called today ────────────────────────────────────────────────

export interface CalledPerson {
  id: string;
  primary: string;
  secondary: string;
  callTime?: string;
}

/**
 * One person on the call: who they are, what they do, and when they are
 * wanted.
 *
 * `numberOfLines={1}` and a `maxWidth: '45%'` keep this a row at the default
 * setting and turn it into "Dana Whitfie… Unit Pr…" at the accessibility ones —
 * a name and a role are the two things on this card that a reader who has
 * turned text up cannot afford to lose. Past the threshold the row stacks and
 * both are allowed to wrap in full.
 */
function PersonRow({ person, testID }: { person: CalledPerson; testID?: string }) {
  const { isLargeText } = useTypography();

  return (
    <View style={[styles.personRow, isLargeText && styles.personRowStacked]} testID={testID}>
      <Text
        style={[styles.personPrimary, isLargeText && styles.personTextStacked]}
        numberOfLines={isLargeText ? undefined : 1}
      >
        {person.primary}
      </Text>
      <Text
        style={[styles.personSecondary, isLargeText && styles.personTextStacked]}
        numberOfLines={isLargeText ? undefined : 1}
      >
        {person.secondary}
      </Text>
      {person.callTime ? <Text style={styles.personTime}>{person.callTime}</Text> : null}
    </View>
  );
}

export function CalledCard({ cast, crewWithOwnCalls, generalCall, title }: {
  cast: CalledPerson[];
  crewWithOwnCalls: CalledPerson[];
  generalCall: string | null;
  title: string;
}) {
  return (
    <View style={styles.card} testID="today-called-card">
      <CardHeader icon={Users} title={title}>
        <Text style={styles.cardMeta}>{cast.length} cast</Text>
      </CardHeader>

      {cast.length === 0 ? (
        <Text style={styles.emptyLine}>
          No cast matched this day&apos;s scenes. Cast are matched by character name.
        </Text>
      ) : (
        cast.map(person => (
          <PersonRow key={person.id} person={person} testID={`today-cast-${person.id}`} />
        ))
      )}

      {crewWithOwnCalls.length > 0 ? (
        <View style={styles.subSection}>
          <Text style={styles.subSectionTitle}>
            EARLY AND LATE CALLS{generalCall ? ` · GENERAL ${generalCall}` : ''}
          </Text>
          {crewWithOwnCalls.map(person => (
            <PersonRow key={person.id} person={person} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

// ─── Location ────────────────────────────────────────────────────

export function LocationCard({ name, address, parkingNotes, onDirections }: {
  name: string;
  address: string;
  parkingNotes: string;
  onDirections: (() => void) | null;
}) {
  return (
    <View style={styles.card} testID="today-location-card">
      <CardHeader icon={MapPin} title="LOCATION" />

      <Text style={styles.locationName}>{name || 'No location set'}</Text>
      {address ? <Text style={styles.locationAddress}>{address}</Text> : null}
      {parkingNotes ? (
        <Text style={styles.locationParking}>Parking: {parkingNotes}</Text>
      ) : null}

      {onDirections ? (
        <TouchableOpacity
          style={styles.directionsButton}
          onPress={onDirections}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Get directions to ${name}`}
          testID="today-directions-button"
        >
          <Navigation color={Colors.text.inverse} size={14} />
          <Text style={styles.directionsText}>Directions</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ─── Weather ─────────────────────────────────────────────────────

export function WeatherCard({ weather, coverSet }: { weather: DayWeather; coverSet: boolean }) {
  return (
    <View style={styles.card} testID="today-weather-card">
      <CardHeader icon={CloudRain} title="WEATHER">
        <Text style={styles.cardMeta}>
          {weather.conditionLabel} · {weather.tempHigh}° / {weather.tempLow}°
        </Text>
      </CardHeader>

      {coverSet ? (
        <Text style={styles.coverSet} testID="today-cover-set">
          {weather.conditionLabel} forecast, {weather.precipChance}% chance — worth a cover set.
        </Text>
      ) : null}

      <View style={styles.sunRow}>
        <View style={styles.sunCell}>
          <Sunrise color={Colors.accent.goldLight} size={13} />
          <Text style={styles.sunLabel}>Sunrise</Text>
          <Text style={styles.sunValue}>{weather.sunrise}</Text>
        </View>
        <View style={styles.sunCell}>
          <Sunset color={Colors.accent.goldLight} size={13} />
          <Text style={styles.sunLabel}>Sunset</Text>
          <Text style={styles.sunValue}>{weather.sunset}</Text>
        </View>
      </View>

      {weather.goldenHourPM ? (
        <Text style={styles.goldenHour}>
          Golden hour {weather.goldenHourAM} and {weather.goldenHourPM}
        </Text>
      ) : null}
    </View>
  );
}

// ─── Quick actions ───────────────────────────────────────────────

export function QuickActions({ onLogTake, onContinuity, onNote }: {
  onLogTake: () => void;
  onContinuity: () => void;
  onNote: () => void;
}) {
  return (
    <View style={styles.actionRow}>
      <ActionButton label="Log Take" icon={Camera} onPress={onLogTake} testID="today-action-take" primary />
      <ActionButton label="Continuity" icon={ImageIcon} onPress={onContinuity} testID="today-action-continuity" />
      <ActionButton label="Note" icon={StickyNote} onPress={onNote} testID="today-action-note" />
    </View>
  );
}

function ActionButton({ label, icon: Icon, onPress, testID, primary }: {
  label: string;
  icon: React.ElementType;
  onPress: () => void;
  testID: string;
  primary?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionButton, primary && styles.actionButtonPrimary]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
    >
      <Icon color={primary ? Colors.text.inverse : Colors.accent.gold} size={18} />
      <Text style={[styles.actionText, primary && styles.actionTextPrimary]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Header
  header: { paddingHorizontal: 4, paddingTop: 4, paddingBottom: 16 },
  headerTop: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  headerDay: { fontSize: 32, fontWeight: '800' as const, color: Colors.text.primary, letterSpacing: -1 },
  headerOf: { fontSize: 15, color: Colors.text.tertiary, fontWeight: '600' as const },
  relationPill: {
    marginLeft: 'auto', backgroundColor: Colors.accent.goldBg, borderWidth: 1,
    borderColor: Colors.accent.goldDim + '55', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  relationText: { fontSize: 14, fontWeight: '800' as const, color: Colors.accent.gold, letterSpacing: 0.8 },
  headerDate: { fontSize: 14, color: Colors.text.secondary, marginTop: 2 },
  headerProject: { fontSize: 14, color: Colors.accent.goldLight, fontWeight: '600' as const, marginTop: 6 },

  // Card shell
  card: {
    backgroundColor: Colors.bg.card, borderRadius: 14, padding: 14, marginBottom: 12,
    borderWidth: 0.5, borderColor: Colors.border.subtle,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  cardHeaderStacked: { flexDirection: 'column', alignItems: 'flex-start' },
  cardHeaderTitle: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  cardHeaderTrailing: { marginLeft: 'auto', flexShrink: 1 },
  cardHeaderTrailingStacked: { marginLeft: 0 },
  cardTitle: {
    fontSize: 14, fontWeight: '800' as const, color: Colors.text.primary,
    letterSpacing: 1, flexShrink: 1,
  },
  cardMeta: { fontSize: 14, color: Colors.text.tertiary, fontVariant: ['tabular-nums'] },
  emptyLine: { fontSize: 14, color: Colors.text.tertiary, lineHeight: 18 },

  // Times
  timeRow: { flexDirection: 'row' },
  timeCell: { flex: 1, alignItems: 'center' },
  timeLabel: { fontSize: 14, fontWeight: '700' as const, color: Colors.text.tertiary, letterSpacing: 1.2 },
  timeValue: {
    fontSize: 19, fontWeight: '700' as const, color: Colors.text.primary,
    marginTop: 3, fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    flex: 1, height: 5, backgroundColor: Colors.bg.elevated, borderRadius: 3,
    overflow: 'hidden', marginTop: 12,
  },
  progressFill: { height: '100%', backgroundColor: Colors.accent.gold, borderRadius: 3 },
  progressCaptionRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  progressCaption: { fontSize: 14, color: Colors.text.secondary, fontVariant: ['tabular-nums'] },

  // Scenes
  sceneRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7,
    borderTopWidth: 0.5, borderTopColor: Colors.border.subtle,
  },
  sceneDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.border.medium },
  sceneDotDone: { backgroundColor: Colors.status.active },
  sceneNumber: {
    fontSize: 14, fontWeight: '700' as const, color: Colors.accent.gold,
    minWidth: 34, fontVariant: ['tabular-nums'],
  },
  sceneHeading: { flex: 1, fontSize: 14, color: Colors.text.secondary },
  sceneShots: { fontSize: 14, color: Colors.text.primary, fontVariant: ['tabular-nums'], minWidth: 32, textAlign: 'right' },
  scenePages: { fontSize: 14, color: Colors.text.tertiary, fontVariant: ['tabular-nums'], minWidth: 34, textAlign: 'right' },

  // Pace
  pacePill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  pacePillText: { fontSize: 14, fontWeight: '800' as const, letterSpacing: 0.8 },
  paceBars: { gap: 6, marginBottom: 10 },
  paceBarRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  /*
   * `minWidth`, not `width`. These were pinned at 30 and 34, which is narrower
   * than the words they hold: "Work" at 14pt needs about 33, so the label wrapped
   * to "Wor / k" on an iPad at the *default* text size. The handoff filed that
   * under the large-text findings; it was there at 1x the whole time. The minimum
   * is what keeps the two tracks starting at the same x — growing past it costs
   * nothing, since the track beside it is `flex: 1`.
   */
  paceBarLabel: { fontSize: 14, color: Colors.text.tertiary, minWidth: 30, fontWeight: '600' as const },
  paceBarPct: { fontSize: 14, color: Colors.text.tertiary, minWidth: 34, textAlign: 'right', fontVariant: ['tabular-nums'] },
  /** The shared `progressTrack` carries a `marginTop: 12` for the day bar it was written for. */
  paceTrack: { flex: 1, height: 5, backgroundColor: Colors.bg.elevated, borderRadius: 3, overflow: 'hidden' },
  paceBarCaption: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  paceBarLabelStacked: { fontSize: 14, color: Colors.text.tertiary, fontWeight: '600' as const, flexShrink: 1 },
  paceBarPctStacked: { fontSize: 14, color: Colors.text.tertiary, fontVariant: ['tabular-nums'] },
  paceTrackStacked: {
    height: 5, backgroundColor: Colors.bg.elevated, borderRadius: 3,
    overflow: 'hidden', marginTop: 4,
  },
  paceProjection: { fontSize: 14, color: Colors.text.secondary, fontVariant: ['tabular-nums'] },

  // People
  personRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6,
    borderTopWidth: 0.5, borderTopColor: Colors.border.subtle,
  },
  personRowStacked: { flexDirection: 'column', alignItems: 'flex-start', gap: 0 },
  personPrimary: { fontSize: 14, color: Colors.text.primary, fontWeight: '600' as const, maxWidth: '45%' },
  personSecondary: { flex: 1, fontSize: 14, color: Colors.text.tertiary },
  /** Undoes the row-mode width constraints — both must go, or the other still clips. */
  personTextStacked: { maxWidth: undefined, flex: 0, alignSelf: 'stretch' },
  personTime: { fontSize: 14, color: Colors.status.active, fontWeight: '700' as const, fontVariant: ['tabular-nums'] },
  subSection: { marginTop: 12, paddingTop: 4 },
  subSectionTitle: { fontSize: 14, fontWeight: '700' as const, color: Colors.text.tertiary, letterSpacing: 1, marginBottom: 2 },

  // Location
  locationName: { fontSize: 15, fontWeight: '600' as const, color: Colors.text.primary },
  locationAddress: { fontSize: 14, color: Colors.text.secondary, marginTop: 3, lineHeight: 17 },
  locationParking: { fontSize: 14, color: Colors.text.tertiary, marginTop: 6, lineHeight: 17 },
  directionsButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: Colors.accent.gold,
  },
  directionsText: { fontSize: 14, fontWeight: '700' as const, color: Colors.text.inverse },

  // Weather
  coverSet: { fontSize: 14, color: Colors.status.warning, marginBottom: 10, lineHeight: 17 },
  sunRow: { flexDirection: 'row', gap: 10 },
  sunCell: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.bg.elevated, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10,
  },
  sunLabel: { fontSize: 14, color: Colors.text.tertiary, fontWeight: '600' as const },
  sunValue: { marginLeft: 'auto', fontSize: 14, color: Colors.text.primary, fontVariant: ['tabular-nums'] },
  goldenHour: { fontSize: 14, color: Colors.accent.goldLight, marginTop: 8, fontVariant: ['tabular-nums'] },

  // Actions
  actionRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  actionButton: {
    flex: 1, alignItems: 'center', gap: 5, paddingVertical: 12, borderRadius: 12,
    backgroundColor: Colors.bg.card, borderWidth: 0.5, borderColor: Colors.border.subtle,
  },
  actionButtonPrimary: { backgroundColor: Colors.accent.gold, borderColor: Colors.accent.gold },
  actionText: { fontSize: 14, fontWeight: '700' as const, color: Colors.accent.gold },
  actionTextPrimary: { color: Colors.text.inverse },
});
