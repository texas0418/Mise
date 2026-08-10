/**
 * components/DateTimeField.tsx
 *
 * The date and time fields, with a picker behind them.
 *
 * ## Why this exists
 *
 * Every date and time in Mise was a free-text `TextInput` on a QWERTY keyboard:
 * "Date (YYYY-MM-DD)" with a hint, and a director typing it on set in the dark.
 * That is the input side of the crash class behind #90 — it is what manufactures
 * the unparseable dates the formatters in utils/formatRecord.ts now have to
 * defend against. Guarding the read end was the right first move; it does not
 * stop the bad value being written.
 *
 * ## The contract these fields keep
 *
 * The stored shapes do not change. A date is still `YYYY-MM-DD` and a time is
 * still `7:00 AM`, because `utils/today.ts` and `utils/formatRecord.ts` already
 * read exactly those, the call sheet renderer prints them, and every record
 * already in a user's storage — and in Supabase — is written that way.
 *
 * So these fields do not invent a format. They round-trip through the functions
 * that already own it:
 *
 *   read   `toDate` / `parseClockTime`      — the same guards the app reads with
 *   write  `localDateKey` / `formatClock`   — the same shapes the app writes
 *
 * That is deliberate and worth keeping. A picker that emitted, say, an ISO
 * timestamp would look correct in the form and quietly break the call sheet,
 * the Today view and every existing record at once.
 *
 * `localDateKey` rather than `toISOString().slice(0, 10)`: the latter is a day
 * out for anyone west of Greenwich for part of every day, which is the bug
 * utils/today.ts was already written to avoid.
 */
import React, { useState } from 'react';
import {
  View, Text, Pressable, StyleSheet, Platform, Modal,
  type StyleProp, type TextStyle,
} from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import Colors from '@/constants/colors';
import { toDate } from '@/utils/formatRecord';
import { parseClockTime, formatClock, localDateKey } from '@/utils/today';
import { useTypography } from '@/utils/useTypography';

/** How a chosen date reads back to the user. Not the stored shape. */
const DATE_DISPLAY: Intl.DateTimeFormatOptions = {
  weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
};

interface FieldProps {
  /** The stored value: `YYYY-MM-DD` for a date, `7:00 AM` for a time. */
  value: string;
  onChange: (next: string) => void;
  /**
   * What the field is, for VoiceOver. The visible text is a date, which says
   * nothing about *which* date this is — "Call time" does.
   */
  accessibilityLabel: string;
  /** Shown when there is no value yet. */
  placeholder?: string;
  testID?: string;
}

function FieldShell({ open, onPress, filled, text, accessibilityLabel, testID, children }: {
  open: boolean;
  onPress: () => void;
  filled: boolean;
  text: string;
  accessibilityLabel: string;
  testID?: string;
  children: React.ReactNode;
}) {
  return (
    <View>
      <Pressable
        onPress={onPress}
        style={[styles.field, open && styles.fieldOpen]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ expanded: open }}
        testID={testID}
      >
        <Text style={filled ? styles.value : styles.placeholder}>{text}</Text>
      </Pressable>
      {children}
    </View>
  );
}

/**
 * A `YYYY-MM-DD` field.
 *
 * An unreadable or empty stored value opens the picker on today rather than
 * refusing to open. Today is a guess, but it is a guess the user can see and
 * correct, which is more than the text field offered.
 */
export function DateField({ value, onChange, accessibilityLabel, placeholder = 'Choose a date', testID }: FieldProps) {
  const [open, setOpen] = useState(false);
  const parsed = toDate(value);

  const handle = (event: DateTimePickerEvent, picked?: Date) => {
    if (Platform.OS === 'android') setOpen(false);
    if (event.type === 'dismissed' || !picked) return;
    onChange(localDateKey(picked));
  };

  return (
    <FieldShell
      open={open}
      onPress={() => setOpen(o => !o)}
      filled={parsed !== null}
      text={parsed === null ? placeholder : parsed.toLocaleDateString('en-US', DATE_DISPLAY)}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {open ? (
        <PickerHost>
          <DateTimePicker
            value={parsed ?? new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={handle}
            themeVariant="dark"
            accentColor={Colors.accent.gold}
          />
        </PickerHost>
      ) : null}
    </FieldShell>
  );
}

/** A `7:00 AM` field. */
export function TimeField({ value, onChange, accessibilityLabel, placeholder = 'Choose a time', testID }: FieldProps) {
  const [open, setOpen] = useState(false);
  const minutes = parseClockTime(value);

  const asDate = new Date();
  if (minutes !== null) asDate.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);

  const handle = (event: DateTimePickerEvent, picked?: Date) => {
    if (Platform.OS === 'android') setOpen(false);
    if (event.type === 'dismissed' || !picked) return;
    onChange(formatClock(picked.getHours() * 60 + picked.getMinutes()));
  };

  return (
    <FieldShell
      open={open}
      onPress={() => setOpen(o => !o)}
      filled={minutes !== null}
      text={minutes === null ? placeholder : formatClock(minutes)}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      {open ? (
        <PickerHost>
          <DateTimePicker
            value={asDate}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handle}
            themeVariant="dark"
            accentColor={Colors.accent.gold}
          />
        </PickerHost>
      ) : null}
    </FieldShell>
  );
}

/**
 * A time in a table cell: the per-person call times on a call sheet.
 *
 * Same contract as `TimeField`, different shape and different way of opening.
 * The cast table is a grid — character, actor, scenes, then makeup, wardrobe
 * and on-set times across — and expanding a picker inline would shove every row
 * below it down the screen. So this one opens over the table instead, with the
 * person and the field named at the top, because "MAKEUP" in a column header is
 * not enough to know whose makeup call you are setting once the picker covers
 * the row.
 *
 * Blank is meaningful here and must stay reachable: an empty cell means the
 * person is on the general call. Hence Clear, and hence the placeholder showing
 * the general call time rather than the word "none".
 */
export function CompactTimeField({
  value, onChange, accessibilityLabel, title, placeholder, style, testID,
}: FieldProps & { title: string; style?: StyleProp<TextStyle> }) {
  const [open, setOpen] = useState(false);
  const minutes = parseClockTime(value);

  /*
   * A blank cell opens on the general call, not on the current time.
   *
   * Seeding from `new Date()` put the wheel on whatever o'clock it happened to
   * be — 3am, on the night this was tested — when the thing the user is doing
   * is nudging one person off a 7:00 AM general call by half an hour. The
   * placeholder is already that general call, so the picker should start where
   * the cell is visibly sitting.
   */
  const seed = minutes ?? parseClockTime(placeholder);
  const asDate = new Date();
  if (seed !== null) asDate.setHours(Math.floor(seed / 60), seed % 60, 0, 0);

  const commit = (event: DateTimePickerEvent, picked?: Date) => {
    if (Platform.OS === 'android') setOpen(false);
    if (event.type === 'dismissed' || !picked) return;
    onChange(formatClock(picked.getHours() * 60 + picked.getMinutes()));
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        style={styles.compact}
      >
        <Text style={[style, minutes === null && styles.compactEmpty]} numberOfLines={1}>
          {minutes === null ? (placeholder ?? '—') : formatClock(minutes)}
        </Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.scrim} onPress={() => setOpen(false)} accessibilityLabel="Close the time picker">
          {/* Stops a tap inside the sheet closing it on the way through. */}
          <Pressable style={styles.sheet} onPress={() => {}} accessible={false}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <DateTimePicker
              value={asDate}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={commit}
              themeVariant="dark"
              accentColor={Colors.accent.gold}
            />
            <View style={styles.sheetActions}>
              <Pressable
                onPress={() => { onChange(''); setOpen(false); }}
                accessibilityRole="button"
                accessibilityLabel="Clear this time and use the general call"
                style={styles.sheetButton}
              >
                <Text style={styles.sheetClear}>Use general call</Text>
              </Pressable>
              <Pressable
                onPress={() => setOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Done"
                style={styles.sheetButton}
              >
                <Text style={styles.sheetDone}>Done</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

/**
 * On iOS the picker is a view that has to be given somewhere to live; on
 * Android it presents its own dialog and must not be wrapped in a box, or an
 * empty panel appears in the form behind it.
 */
function PickerHost({ children }: { children: React.ReactNode }) {
  const { space } = useTypography();
  if (Platform.OS !== 'ios') return <>{children}</>;
  return <View style={[styles.picker, { marginTop: space(8) }]}>{children}</View>;
}

const styles = StyleSheet.create({
  // Matches the `input` style the forms already use, so a date field does not
  // read as a different kind of thing from the text field above it.
  field: {
    backgroundColor: Colors.bg.input,
    borderRadius: 10,
    padding: 14,
    borderWidth: 0.5,
    borderColor: Colors.border.subtle,
    // The forms' inputs are ~48pt tall at the default size; a tap target that
    // matches means the row does not jump when a text field becomes a picker.
    minHeight: 48,
    justifyContent: 'center',
  },
  fieldOpen: { borderColor: Colors.accent.gold },
  value: { fontSize: 16, color: Colors.text.primary },
  placeholder: { fontSize: 16, color: Colors.text.tertiary },
  picker: {
    backgroundColor: Colors.bg.input,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: Colors.border.subtle,
    overflow: 'hidden',
  },

  // A table cell keeps the caller's text style so the column still lines up;
  // only the tap target is this component's business. 44pt is Apple's minimum
  // and these sit three-to-a-row on a call sheet.
  compact: { minHeight: 44, justifyContent: 'center' },
  compactEmpty: { opacity: 0.55 },
  scrim: {
    flex: 1,
    backgroundColor: '#000000AA',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  sheet: {
    backgroundColor: Colors.bg.card,
    borderRadius: 16,
    padding: 16,
    minWidth: 300,
    maxWidth: 420,
    borderWidth: 0.5,
    borderColor: Colors.border.subtle,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: 4,
  },
  sheetActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  sheetButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  sheetClear: { fontSize: 15, color: Colors.text.tertiary },
  sheetDone: { fontSize: 16, fontWeight: '700', color: Colors.accent.gold },
});
