/**
 * utils/shotStatus.ts
 *
 * Moving a shot through planned → ready → shot → approved.
 *
 * Dependency-free so `node --experimental-strip-types` can run it. The rule
 * this module exists to hold is that the sequence does not wrap: tapping an
 * approved shot used to return it to planned, which quietly erased the record
 * that it had been shot at all (#49).
 */

export const STATUS_FLOW = ['planned', 'ready', 'shot', 'approved'] as const;

export type ShotStatusName = typeof STATUS_FLOW[number];

/** Where a status sits in the sequence, or -1 for anything unrecognised. */
export function statusIndex(status: string): number {
  return (STATUS_FLOW as readonly string[]).indexOf(status);
}

/**
 * The next status forward, or null at the end.
 *
 * Null rather than wrapping. A shot that is approved is finished, and the tap
 * that would have "advanced" it is nearly always a stray hand on a phone in a
 * pocket — on set, taps are fast and hands are busy.
 *
 * An unrecognised status starts the sequence rather than sticking, so a record
 * with bad data can still be moved.
 */
export function nextStatus(current: string): ShotStatusName | null {
  const index = statusIndex(current);
  if (index === -1) return STATUS_FLOW[0];
  if (index >= STATUS_FLOW.length - 1) return null;
  return STATUS_FLOW[index + 1];
}

/**
 * One step back, or null at the start.
 *
 * Going backwards is a correction, so it is deliberately not on the same tap
 * as going forwards — the screen puts it behind a long press.
 */
export function previousStatus(current: string): ShotStatusName | null {
  const index = statusIndex(current);
  if (index <= 0) return null;
  return STATUS_FLOW[index - 1];
}

/** True once a shot is in the can. */
export function isComplete(status: string): boolean {
  return status === 'shot' || status === 'approved';
}

/** What a tap will do, for the accessibility hint and the long-press prompt. */
export function describeTap(current: string): string {
  const next = nextStatus(current);
  if (next) return `Mark as ${next}`;
  return 'Already approved. Long press to move it back.';
}
