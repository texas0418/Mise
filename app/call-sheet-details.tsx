/**
 * app/call-sheet-details.tsx
 *
 * The call sheet's header block for one shoot day: safety, logistics, meals.
 *
 * A separate screen rather than more fields on the expanded card — a dozen
 * inputs inline would bury the scenes, cast and crew that are the reason the
 * card is open. Everything here is optional; a blank field simply means the
 * section does not print.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView,
} from 'react-native';
import { KEYBOARD_BEHAVIOR } from '@/utils/keyboardAvoiding';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { ShieldAlert, Truck, UtensilsCrossed, Send } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useProjects, useProjectSchedule, useCallSheetDetails } from '@/contexts/ProjectContext';
import { useNavigateOnce } from '@/utils/useNavigateOnce';
import Colors from '@/constants/colors';
import { CallSheetDetails } from '@/types';

/** Every editable field, in the order a call sheet reads. */
type DetailField = Exclude<keyof CallSheetDetails, 'id' | 'projectId' | 'scheduleDayId' | 'version' | 'issuedAt' | 'createdAt'>;

interface FieldSpec {
  key: DetailField;
  label: string;
  placeholder: string;
  multiline?: boolean;
}

const SAFETY_FIELDS: FieldSpec[] = [
  { key: 'hospitalName', label: 'Nearest hospital', placeholder: 'Grady Memorial' },
  { key: 'hospitalAddress', label: 'Hospital address', placeholder: '80 Jesse Hill Jr Dr SE, Atlanta' },
  { key: 'hospitalPhone', label: 'Hospital phone', placeholder: '404-616-1000' },
  { key: 'safetyNotes', label: 'Safety notes', placeholder: 'Wet floors on the stair unit. Hard hats in the rigging bay.', multiline: true },
];

const LOGISTICS_FIELDS: FieldSpec[] = [
  { key: 'parkingNotes', label: 'Parking', placeholder: 'Lot C off Brady Ave' },
  { key: 'basecampNotes', label: 'Basecamp', placeholder: 'North side of the lot' },
  { key: 'crewParkNotes', label: 'Crew park', placeholder: 'Street parking on Foster' },
  { key: 'nearestBathroom', label: 'Nearest bathroom', placeholder: 'Stage B, ground floor' },
  { key: 'walkieChannels', label: 'Walkie channels', placeholder: '1 Production · 2 Camera · 3 Grip' },
  { key: 'companyMoves', label: 'Company moves', placeholder: 'Move to the jetty after lunch' },
];

const MEAL_FIELDS: FieldSpec[] = [
  { key: 'breakfastTime', label: 'Breakfast', placeholder: '6:30 AM' },
  { key: 'lunchTime', label: 'Lunch', placeholder: '1:00 PM' },
  { key: 'cateringLocation', label: 'Catering location', placeholder: 'Basecamp tent' },
];

function Section({ title, icon: Icon, fields, values, onChange }: {
  title: string;
  icon: React.ElementType;
  fields: FieldSpec[];
  values: Record<string, string>;
  onChange: (key: DetailField, value: string) => void;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Icon color={Colors.accent.gold} size={15} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {fields.map(field => (
        <View key={field.key} style={styles.field}>
          <Text style={styles.label}>{field.label}</Text>
          <TextInput
            style={[styles.input, field.multiline && styles.textArea]}
            value={values[field.key] ?? ''}
            onChangeText={value => onChange(field.key, value)}
            placeholder={field.placeholder}
            placeholderTextColor={Colors.text.tertiary}
            multiline={field.multiline}
            accessibilityLabel={field.label}
            testID={`detail-${field.key}`}
          />
        </View>
      ))}
    </View>
  );
}

export default function CallSheetDetailsScreen() {
  const router = useRouter();
  // Two taps on Save wrote once but called back() twice, which the navigator
  // complains about because the second has nowhere to go (#78's shape).
  const once = useNavigateOnce();
  const { activeProjectId, upsertCallSheetDetails } = useProjects();
  const params = useLocalSearchParams<{ dayId?: string }>();
  const dayId = params.dayId ?? null;
  const schedule = useProjectSchedule(activeProjectId);
  const day = schedule.find(d => d.id === dayId) ?? null;
  const existing = useCallSheetDetails(dayId);

  const [values, setValues] = useState<Record<string, string>>({});

  // Load once per day. Keyed on the record id rather than the object so typing
  // does not get overwritten by the store echoing the same values back.
  useEffect(() => {
    if (!existing) return;
    const loaded: Record<string, string> = {};
    for (const field of [...SAFETY_FIELDS, ...LOGISTICS_FIELDS, ...MEAL_FIELDS]) {
      loaded[field.key] = existing[field.key] ?? '';
    }
    setValues(loaded);
    // Keyed on the record id, not the record. Depending on `existing` itself
    // would re-run every time the store hands back a new object and overwrite
    // whatever is being typed with what was last persisted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id]);

  const onChange = useCallback((key: DetailField, value: string) => {
    setValues(prev => ({ ...prev, [key]: value }));
  }, []);

  const persist = useCallback((bumpVersion: boolean) => {
    if (!activeProjectId || !dayId) return;
    upsertCallSheetDetails(
      (entry: CallSheetDetails) => entry.scheduleDayId === dayId,
      (found: CallSheetDetails | null) => {
        const base: CallSheetDetails = found ?? {
          id: Date.now().toString(),
          projectId: activeProjectId,
          scheduleDayId: dayId,
          version: 1,
          createdAt: new Date().toISOString(),
        };
        if (!bumpVersion) return { ...base, ...values, version: base.version ?? 1 };
        // The first issue is version 1, not 2 — the number counts sheets that
        // have gone out, so it only advances once one already has.
        const alreadyIssued = Boolean(base.issuedAt);
        return {
          ...base,
          ...values,
          version: alreadyIssued ? (base.version ?? 1) + 1 : 1,
          issuedAt: new Date().toISOString(),
        };
      },
    );
  }, [activeProjectId, dayId, values, upsertCallSheetDetails]);

  const handleSave = useCallback(() => {
    once(() => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      persist(false);
      router.back();
    });
  }, [once, persist, router]);

  // Issuing is the act that makes a version real. Crew read the number to know
  // whether the sheet in their hand is the current one, so it only moves when
  // a sheet is actually sent — not every time someone corrects a typo.
  const handleIssue = useCallback(() => {
    Alert.alert(
      existing?.issuedAt ? 'Reissue call sheet' : 'Mark as issued',
      existing?.issuedAt
        ? `This becomes version ${(existing.version ?? 1) + 1}. Crew will see that the sheet has changed.`
        : 'Marks this sheet as issued, so later changes are numbered against it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: existing?.issuedAt ? 'Reissue' : 'Issue',
          onPress: () => once(() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            persist(true);
            router.back();
          }),
        },
      ],
    );
  }, [existing, once, persist, router]);

  if (!day) {
    return (
      <View style={styles.emptyContainer}>
        <Stack.Screen options={{ title: 'Call Sheet Details' }} />
        <Text style={styles.emptyTitle}>Shoot day not found</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={KEYBOARD_BEHAVIOR}>
      <Stack.Screen options={{ title: `Day ${day.dayNumber} Details` }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.projectLabel}>
          <Text style={styles.projectLabelText}>
            Day {day.dayNumber} · {day.location || 'No location'}
            {existing?.issuedAt ? ` · issued v${existing.version}` : ' · not yet issued'}
          </Text>
        </View>

        <Section title="SAFETY" icon={ShieldAlert} fields={SAFETY_FIELDS} values={values} onChange={onChange} />
        <Section title="LOGISTICS" icon={Truck} fields={LOGISTICS_FIELDS} values={values} onChange={onChange} />
        <Section title="MEALS" icon={UtensilsCrossed} fields={MEAL_FIELDS} values={values} onChange={onChange} />

        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Save call sheet details"
          testID="save-details-button"
        >
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.issueButton}
          onPress={handleIssue}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={existing?.issuedAt ? 'Reissue this call sheet' : 'Mark this call sheet as issued'}
          testID="issue-details-button"
        >
          <Send color={Colors.accent.gold} size={15} />
          <Text style={styles.issueButtonText}>
            {existing?.issuedAt ? `Save and reissue as v${(existing.version ?? 1) + 1}` : 'Save and mark as issued'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  content: { padding: 20, paddingBottom: 40 },
  projectLabel: { backgroundColor: Colors.accent.goldBg, borderRadius: 8, padding: 10, marginBottom: 20 },
  projectLabelText: { fontSize: 13, color: Colors.accent.gold, fontWeight: '600' as const },
  section: { marginBottom: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 },
  sectionTitle: { fontSize: 11, fontWeight: '800' as const, color: Colors.text.primary, letterSpacing: 1 },
  field: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '600' as const, color: Colors.text.secondary, textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 8 },
  input: { backgroundColor: Colors.bg.input, borderRadius: 10, padding: 14, fontSize: 16, color: Colors.text.primary, borderWidth: 0.5, borderColor: Colors.border.subtle },
  textArea: { minHeight: 90, paddingTop: 14 },
  saveButton: { backgroundColor: Colors.accent.gold, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 12 },
  saveButtonText: { fontSize: 16, fontWeight: '700' as const, color: Colors.text.inverse },
  issueButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, padding: 14, marginTop: 12, borderWidth: 1, borderColor: Colors.accent.gold + '55', backgroundColor: Colors.accent.goldBg },
  issueButtonText: { fontSize: 14, fontWeight: '700' as const, color: Colors.accent.gold },
  emptyContainer: { flex: 1, backgroundColor: Colors.bg.primary, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600' as const, color: Colors.text.primary },
});
