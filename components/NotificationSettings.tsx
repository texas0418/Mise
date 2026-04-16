/**
 * components/NotificationSettings.tsx
 * 
 * A card component for managing notification preferences.
 * Can be placed on the schedule screen or a settings screen.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Switch, TouchableOpacity, Alert,
  ActivityIndicator,
} from 'react-native';
import { Bell, BellOff, Clock, Moon, ChevronDown, ChevronUp } from 'lucide-react-native';
import Colors from '@/constants/colors';
import {
  NotificationPreferences,
  getNotificationPreferences,
  saveNotificationPreferences,
  requestPermissions,
  hasPermissions,
  getScheduledCount,
} from '@/utils/notifications';

interface Props {
  /** Called after preferences change so parent can reschedule */
  onPrefsChanged?: (prefs: NotificationPreferences) => void;
}

const MINUTE_OPTIONS = [15, 30, 45, 60, 90, 120];

function minuteLabel(mins: number): string {
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h} hour${h > 1 ? 's' : ''}`;
  }
  return `${mins} min`;
}

export default function NotificationSettings({ onPrefsChanged }: Props) {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [permitted, setPermitted] = useState<boolean | null>(null);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [showCallPicker, setShowCallPicker] = useState(false);
  const [showWrapPicker, setShowWrapPicker] = useState(false);

  useEffect(() => {
    Promise.all([
      getNotificationPreferences(),
      hasPermissions(),
      getScheduledCount(),
    ]).then(([p, perm, count]) => {
      setPrefs(p);
      setPermitted(perm);
      setScheduledCount(count);
    });
  }, []);

  const updatePref = useCallback(async (updates: Partial<NotificationPreferences>) => {
    if (!prefs) return;
    const newPrefs = { ...prefs, ...updates };
    setPrefs(newPrefs);
    await saveNotificationPreferences(newPrefs);
    onPrefsChanged?.(newPrefs);
  }, [prefs, onPrefsChanged]);

  const handleToggleMaster = useCallback(async (enabled: boolean) => {
    if (enabled && !permitted) {
      const granted = await requestPermissions();
      if (!granted) {
        Alert.alert(
          'Notifications Disabled',
          'Enable notifications in your device Settings to receive call time reminders.',
        );
        return;
      }
      setPermitted(true);
    }
    updatePref({ enabled });
  }, [permitted, updatePref]);

  if (!prefs) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color={Colors.accent.gold} />
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {/* Header */}
      <TouchableOpacity
        style={styles.headerRow}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          {prefs.enabled ? (
            <Bell color={Colors.accent.gold} size={18} />
          ) : (
            <BellOff color={Colors.text.tertiary} size={18} />
          )}
          <View>
            <Text style={styles.headerTitle}>Notifications</Text>
            {prefs.enabled && (
              <Text style={styles.headerSubtitle}>
                {scheduledCount} scheduled
              </Text>
            )}
          </View>
        </View>
        <View style={styles.headerRight}>
          <Switch
            value={prefs.enabled}
            onValueChange={handleToggleMaster}
            trackColor={{ false: Colors.bg.elevated, true: Colors.accent.gold + '66' }}
            thumbColor={prefs.enabled ? Colors.accent.gold : Colors.text.tertiary}
          />
          {expanded ? (
            <ChevronUp color={Colors.text.tertiary} size={16} />
          ) : (
            <ChevronDown color={Colors.text.tertiary} size={16} />
          )}
        </View>
      </TouchableOpacity>

      {/* Expanded settings */}
      {expanded && prefs.enabled && (
        <View style={styles.settingsBody}>
          <View style={styles.divider} />

          {/* Day-before reminder */}
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Moon color={Colors.text.secondary} size={14} />
              <View>
                <Text style={styles.settingLabel}>Day Before</Text>
                <Text style={styles.settingHint}>8pm the evening before</Text>
              </View>
            </View>
            <Switch
              value={prefs.dayBeforeReminder}
              onValueChange={(v) => updatePref({ dayBeforeReminder: v })}
              trackColor={{ false: Colors.bg.elevated, true: Colors.accent.gold + '66' }}
              thumbColor={prefs.dayBeforeReminder ? Colors.accent.gold : Colors.text.tertiary}
            />
          </View>

          {/* Call time reminder */}
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Clock color={Colors.status.active} size={14} />
              <View>
                <Text style={styles.settingLabel}>Call Time</Text>
                <Text style={styles.settingHint}>
                  {minuteLabel(prefs.callTimeMinutesBefore)} before call
                </Text>
              </View>
            </View>
            <View style={styles.settingRight}>
              <TouchableOpacity
                style={styles.minuteBtn}
                onPress={() => { setShowCallPicker(!showCallPicker); setShowWrapPicker(false); }}
                activeOpacity={0.7}
              >
                <Text style={styles.minuteBtnText}>
                  {minuteLabel(prefs.callTimeMinutesBefore)}
                </Text>
              </TouchableOpacity>
              <Switch
                value={prefs.callTimeReminder}
                onValueChange={(v) => updatePref({ callTimeReminder: v })}
                trackColor={{ false: Colors.bg.elevated, true: Colors.accent.gold + '66' }}
                thumbColor={prefs.callTimeReminder ? Colors.accent.gold : Colors.text.tertiary}
              />
            </View>
          </View>

          {showCallPicker && (
            <View style={styles.pickerRow}>
              {MINUTE_OPTIONS.map(m => (
                <TouchableOpacity
                  key={m}
                  style={[styles.pickerChip, prefs.callTimeMinutesBefore === m && styles.pickerChipActive]}
                  onPress={() => { updatePref({ callTimeMinutesBefore: m }); setShowCallPicker(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pickerChipText, prefs.callTimeMinutesBefore === m && styles.pickerChipTextActive]}>
                    {minuteLabel(m)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Wrap time reminder */}
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <Clock color={Colors.status.error} size={14} />
              <View>
                <Text style={styles.settingLabel}>Wrap Time</Text>
                <Text style={styles.settingHint}>
                  {minuteLabel(prefs.wrapTimeMinutesBefore)} before wrap
                </Text>
              </View>
            </View>
            <View style={styles.settingRight}>
              <TouchableOpacity
                style={styles.minuteBtn}
                onPress={() => { setShowWrapPicker(!showWrapPicker); setShowCallPicker(false); }}
                activeOpacity={0.7}
              >
                <Text style={styles.minuteBtnText}>
                  {minuteLabel(prefs.wrapTimeMinutesBefore)}
                </Text>
              </TouchableOpacity>
              <Switch
                value={prefs.wrapTimeReminder}
                onValueChange={(v) => updatePref({ wrapTimeReminder: v })}
                trackColor={{ false: Colors.bg.elevated, true: Colors.accent.gold + '66' }}
                thumbColor={prefs.wrapTimeReminder ? Colors.accent.gold : Colors.text.tertiary}
              />
            </View>
          </View>

          {showWrapPicker && (
            <View style={styles.pickerRow}>
              {MINUTE_OPTIONS.map(m => (
                <TouchableOpacity
                  key={m}
                  style={[styles.pickerChip, prefs.wrapTimeMinutesBefore === m && styles.pickerChipActive]}
                  onPress={() => { updatePref({ wrapTimeMinutesBefore: m }); setShowWrapPicker(false); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pickerChipText, prefs.wrapTimeMinutesBefore === m && styles.pickerChipTextActive]}>
                    {minuteLabel(m)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bg.card,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: Colors.border.subtle,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 14, fontWeight: '600', color: Colors.text.primary },
  headerSubtitle: { fontSize: 10, color: Colors.text.tertiary, marginTop: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  settingsBody: { paddingHorizontal: 14, paddingBottom: 14 },
  divider: { height: 0.5, backgroundColor: Colors.border.subtle, marginBottom: 12 },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10,
  },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  settingLabel: { fontSize: 13, fontWeight: '500', color: Colors.text.primary },
  settingHint: { fontSize: 10, color: Colors.text.tertiary, marginTop: 1 },
  settingRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  minuteBtn: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6,
    backgroundColor: Colors.bg.elevated, borderWidth: 0.5, borderColor: Colors.border.subtle,
  },
  minuteBtnText: { fontSize: 11, fontWeight: '600', color: Colors.accent.gold },
  pickerRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    paddingVertical: 8, paddingLeft: 24,
  },
  pickerChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    backgroundColor: Colors.bg.elevated, borderWidth: 0.5, borderColor: Colors.border.subtle,
  },
  pickerChipActive: {
    backgroundColor: Colors.accent.goldBg, borderColor: Colors.accent.gold + '44',
  },
  pickerChipText: { fontSize: 11, fontWeight: '500', color: Colors.text.secondary },
  pickerChipTextActive: { color: Colors.accent.gold, fontWeight: '700' },
});
