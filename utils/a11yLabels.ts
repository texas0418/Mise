/**
 * utils/a11yLabels.ts
 *
 * Spoken descriptions of records, composed from whatever is actually there.
 *
 * Written as pure functions rather than inline template literals for two
 * reasons. The first is that composing a label inline produced
 * "Take undefined, scene undefined shot undefined, Invalid Date" the moment a
 * record was missing a field — a sentence that is worse than silence, and one
 * that is invisible on screen because the row renders as an unremarkable
 * "Sc. /". The second is that a label built out of six ternaries pushes its
 * component past the repo's complexity limit, and the fix for that should not
 * be a shorter, worse label.
 *
 * Kept dependency-free so node can assert on the output.
 */

export interface TakeLike {
  takeNumber?: number | string | null;
  sceneNumber?: number | string | null;
  shotNumber?: number | string | null;
  isCircled?: boolean | null;
  isNG?: boolean | null;
  notes?: string | null;
}

/** Present, and not an empty string once trimmed. */
const has = (value: unknown): boolean =>
  value !== null && value !== undefined && String(value).trim().length > 0;

/** Something of the shape "09:48 AM" — a reading, not a placeholder. */
const isClockTime = (value: unknown): value is string =>
  typeof value === 'string' && /\d:\d/.test(value);

/**
 * A clock time, or an em dash when the timestamp cannot be read.
 *
 * `new Date(undefined).toLocaleTimeString()` returns the literal string
 * "Invalid Date", which was being printed into the take row and read out as
 * part of its label.
 */
export function formatTakeTime(timestamp: unknown, now: Date | null = null): string {
  const date = now ?? new Date(timestamp as string);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

/**
 * "Take 4, scene 12, shot 12B, 09:48 AM, circled"
 *
 * Every part is dropped when absent, so a half-written record degrades to
 * "Take" rather than announcing its own gaps.
 */
export function describeTake(take: TakeLike, timeStr?: string): string {
  const parts = [
    has(take.takeNumber) ? `Take ${take.takeNumber}` : 'Take',
    has(take.sceneNumber) ? `scene ${take.sceneNumber}` : null,
    has(take.shotNumber) ? `shot ${take.shotNumber}` : null,
    // Only a real clock reading. "Invalid Date" is what an unreadable
    // timestamp formats to, and it must never reach a spoken label.
    isClockTime(timeStr) ? timeStr : null,
    take.isCircled ? 'circled' : null,
    take.isNG ? 'no good' : null,
  ].filter(Boolean);

  const summary = parts.join(', ');
  return has(take.notes) ? `${summary}. ${String(take.notes).trim()}` : summary;
}

/** The label for a control that toggles between two states. */
export const toggleLabel = (isOn: boolean, onLabel: string, offLabel: string): string =>
  isOn ? onLabel : offLabel;

/**
 * The hint on the take form's save button.
 *
 * Here rather than in the screen because the branches count against that
 * component's complexity budget, and it is already near the limit. A hint is
 * not worth making worse to save a branch.
 */
export function saveTakeHint(
  isEditing: boolean,
  sceneNumber: unknown,
  shotNumber: unknown,
  takeNumber: unknown,
): string {
  if (isEditing) return 'Saves your changes to this take';
  const field = (value: unknown) => (has(value) ? String(value).trim() : 'blank');
  return `Logs scene ${field(sceneNumber)}, shot ${field(shotNumber)}, take ${field(takeNumber)}`;
}
