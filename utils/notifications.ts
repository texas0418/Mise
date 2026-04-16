/**
 * utils/notifications.ts
 * 
 * Push Notification Manager for Mise App
 * 
 * Handles:
 * - Permission requests
 * - Scheduling call time reminders
 * - Scheduling wrap time alerts
 * - Scheduling day-before prep reminders
 * - Canceling notifications when schedule changes
 * - Persisting notification preferences
 */

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { ScheduleDay } from '@/types';

// ─── Configuration ─────────────────────────────────────────────

// Set how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ─── Types ─────────────────────────────────────────────────────

export interface NotificationPreferences {
  /** Master toggle for all notifications */
  enabled: boolean;
  /** Reminder the evening before a shoot day (default: 8pm) */
  dayBeforeReminder: boolean;
  /** Call time reminder (minutes before call time) */
  callTimeReminder: boolean;
  callTimeMinutesBefore: number;
  /** Reminder a set time before wrap */
  wrapTimeReminder: boolean;
  wrapTimeMinutesBefore: number;
}

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  enabled: true,
  dayBeforeReminder: true,
  callTimeReminder: true,
  callTimeMinutesBefore: 60, // 1 hour before
  wrapTimeReminder: true,
  wrapTimeMinutesBefore: 30, // 30 min before wrap
};

const PREFS_KEY = 'mise_notification_prefs';

// ─── Preferences ───────────────────────────────────────────────

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  try {
    const stored = await AsyncStorage.getItem(PREFS_KEY);
    if (stored) {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
    }
  } catch {}
  return DEFAULT_PREFERENCES;
}

export async function saveNotificationPreferences(prefs: NotificationPreferences): Promise<void> {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

// ─── Permissions ───────────────────────────────────────────────

export async function requestPermissions(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();

  if (existingStatus === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function hasPermissions(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

// ─── Time Parsing ──────────────────────────────────────────────

/**
 * Parse a time string like "7:00 AM", "06:30", "6:30am" into hours and minutes.
 */
function parseTime(timeStr: string): { hours: number; minutes: number } | null {
  if (!timeStr) return null;

  const cleaned = timeStr.trim().toLowerCase();

  // Try 12-hour format: "7:00 AM", "7:00am", "7am"
  const match12 = cleaned.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (match12) {
    let hours = parseInt(match12[1]);
    const minutes = match12[2] ? parseInt(match12[2]) : 0;
    const period = match12[3].toLowerCase();
    if (period === 'pm' && hours < 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;
    return { hours, minutes };
  }

  // Try 24-hour format: "07:00", "18:30"
  const match24 = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    return { hours: parseInt(match24[1]), minutes: parseInt(match24[2]) };
  }

  return null;
}

/**
 * Create a Date object from a date string and time string.
 * Date format: "YYYY-MM-DD", Time: "7:00 AM" or "07:00"
 */
function createDateTime(dateStr: string, timeStr: string): Date | null {
  const time = parseTime(timeStr);
  if (!time) return null;

  const date = new Date(dateStr + 'T00:00:00');
  if (isNaN(date.getTime())) return null;

  date.setHours(time.hours, time.minutes, 0, 0);
  return date;
}

// ─── Notification IDs ──────────────────────────────────────────

// We use deterministic IDs based on schedule day so we can cancel them
function getDayBeforeId(dayId: string): string {
  return `day-before-${dayId}`;
}

function getCallTimeId(dayId: string): string {
  return `call-time-${dayId}`;
}

function getWrapTimeId(dayId: string): string {
  return `wrap-time-${dayId}`;
}

// ─── Schedule Notifications ────────────────────────────────────

/**
 * Schedule all notifications for a given shoot day.
 * Call this when a schedule day is created or updated.
 */
export async function scheduleNotificationsForDay(
  day: ScheduleDay,
  projectTitle?: string,
): Promise<void> {
  const prefs = await getNotificationPreferences();
  if (!prefs.enabled) return;

  const granted = await hasPermissions();
  if (!granted) return;

  // Cancel any existing notifications for this day first
  await cancelNotificationsForDay(day.id);

  const label = projectTitle ? `${projectTitle} — Day ${day.dayNumber}` : `Day ${day.dayNumber}`;

  // 1. Day-before reminder (8pm the evening before)
  if (prefs.dayBeforeReminder) {
    const shootDate = new Date(day.date + 'T00:00:00');
    const dayBefore = new Date(shootDate);
    dayBefore.setDate(dayBefore.getDate() - 1);
    dayBefore.setHours(20, 0, 0, 0); // 8pm

    if (dayBefore.getTime() > Date.now()) {
      await Notifications.scheduleNotificationAsync({
        identifier: getDayBeforeId(day.id),
        content: {
          title: '🎬 Shoot Day Tomorrow',
          body: `${label}\nCall: ${day.callTime} at ${day.location}\nScenes: ${day.scenes}`,
          data: { type: 'day-before', dayId: day.id },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: dayBefore,
        },
      });
    }
  }

  // 2. Call time reminder
  if (prefs.callTimeReminder) {
    const callDate = createDateTime(day.date, day.callTime);
    if (callDate) {
      const reminderDate = new Date(callDate.getTime() - prefs.callTimeMinutesBefore * 60 * 1000);

      if (reminderDate.getTime() > Date.now()) {
        const minLabel = prefs.callTimeMinutesBefore >= 60
          ? `${Math.floor(prefs.callTimeMinutesBefore / 60)}h${prefs.callTimeMinutesBefore % 60 > 0 ? ` ${prefs.callTimeMinutesBefore % 60}m` : ''}`
          : `${prefs.callTimeMinutesBefore}min`;

        await Notifications.scheduleNotificationAsync({
          identifier: getCallTimeId(day.id),
          content: {
            title: `⏰ Call Time in ${minLabel}`,
            body: `${label}\nCall: ${day.callTime} at ${day.location}`,
            data: { type: 'call-time', dayId: day.id },
            sound: true,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: reminderDate,
          },
        });
      }
    }
  }

  // 3. Wrap time reminder
  if (prefs.wrapTimeReminder) {
    const wrapDate = createDateTime(day.date, day.wrapTime);
    if (wrapDate) {
      const reminderDate = new Date(wrapDate.getTime() - prefs.wrapTimeMinutesBefore * 60 * 1000);

      if (reminderDate.getTime() > Date.now()) {
        await Notifications.scheduleNotificationAsync({
          identifier: getWrapTimeId(day.id),
          content: {
            title: `🎬 Wrap in ${prefs.wrapTimeMinutesBefore}min`,
            body: `${label}\nScheduled wrap: ${day.wrapTime}`,
            data: { type: 'wrap-time', dayId: day.id },
            sound: true,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: reminderDate,
          },
        });
      }
    }
  }
}

/**
 * Cancel all notifications for a given shoot day.
 */
export async function cancelNotificationsForDay(dayId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(getDayBeforeId(dayId)).catch(() => {});
  await Notifications.cancelScheduledNotificationAsync(getCallTimeId(dayId)).catch(() => {});
  await Notifications.cancelScheduledNotificationAsync(getWrapTimeId(dayId)).catch(() => {});
}

/**
 * Cancel all Mise notifications.
 */
export async function cancelAllNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

/**
 * Re-schedule notifications for all schedule days.
 * Useful after changing preferences.
 */
export async function rescheduleAll(
  days: ScheduleDay[],
  projectTitle?: string,
): Promise<void> {
  await cancelAllNotifications();

  const prefs = await getNotificationPreferences();
  if (!prefs.enabled) return;

  for (const day of days) {
    await scheduleNotificationsForDay(day, projectTitle);
  }
}

/**
 * Get count of currently scheduled notifications.
 */
export async function getScheduledCount(): Promise<number> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.length;
}
