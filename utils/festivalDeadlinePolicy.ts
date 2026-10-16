/**
 * utils/festivalDeadlinePolicy.ts
 *
 * When a festival deadline alert should fire, and which tracked submissions
 * are closing soon. Pure arithmetic: no expo-notifications, no React, so the
 * rules can be tested without a native runtime. Same split as reviewPolicy.
 *
 * Two alerts per submission, seven days out and one day out, both at 9am
 * local. Seven days is enough to finish a cut or shoot a missing insert; one
 * day is the "pay the fee tonight" nudge. More than that is nagging, and this
 * app already asks for attention on set.
 */
import { FestivalSubmission } from '@/types';

/** Days before the deadline that we fire. Order is cosmetic, not load-bearing. */
export const LEAD_DAYS = [7, 1] as const;
/** 9am local. Early enough to act on, late enough not to wake anyone. */
const HOUR = 9;

export const idFor = (festivalId: string, lead: number) => `festival-${festivalId}-d${lead}`;

/** Every identifier this module could have scheduled for one submission. */
export function identifiersFor(festivalId: string): string[] {
  return LEAD_DAYS.map(d => idFor(festivalId, d));
}

/**
 * When a lead-time alert for this deadline would fire, or null when that
 * moment has already passed. Pure, so the tests can reason about it without
 * a notification runtime.
 */
export function fireDateFor(deadline: string, leadDays: number, now = new Date()): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return null;
  const due = new Date(`${deadline}T00:00:00`);
  if (Number.isNaN(due.getTime())) return null;
  const fire = new Date(due);
  fire.setDate(fire.getDate() - leadDays);
  fire.setHours(HOUR, 0, 0, 0);
  return fire.getTime() > now.getTime() ? fire : null;
}

/** Days from now until the deadline, or null when it is not a usable date. */
export function daysUntil(deadline: string, now = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return null;
  const due = new Date(`${deadline}T00:00:00`);
  if (Number.isNaN(due.getTime())) return null;
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - start.getTime()) / 86_400_000);
}

/** Tracked submissions closing within `days`, soonest first. */
export function closingWithin(
  festivals: FestivalSubmission[],
  days: number,
  now = new Date(),
): FestivalSubmission[] {
  return festivals
    .map(f => ({ f, d: daysUntil(f.deadline, now) }))
    .filter((x): x is { f: FestivalSubmission; d: number } =>
      x.d !== null && x.d >= 0 && x.d <= days)
    /* Already submitted is not a deadline any more. Awarded, rejected and
     * screening are all downstream of submitting, so none of them need a
     * reminder to submit. */
    .filter(x => x.f.status === 'researching')
    .sort((a, b) => a.d - b.d)
    .map(x => x.f);
}

