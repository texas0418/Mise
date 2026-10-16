/**
 * utils/festivalDeadlines.ts
 *
 * Local reminders for festival deadlines a director is tracking.
 *
 * Two alerts per submission, seven days out and one day out, both at 9am
 * local. Seven days is enough time to finish a cut or shoot a missing insert;
 * one day is the "pay the fee tonight" nudge. Anything more is nagging, and
 * this app already asks for attention on set.
 *
 * Scheduled locally through expo-notifications, which Mise already depends on
 * for call times, so this adds no native module and works with no server and
 * no account.
 *
 * Pro only, by Simon's decision. Browsing the calendar is free for everyone;
 * being reminded is the paid part. The gate lives at the call site rather
 * than in here, so this module stays a pure scheduler that can be tested.
 */
import * as Notifications from 'expo-notifications';
import { FestivalSubmission } from '@/types';
import { LEAD_DAYS, fireDateFor, identifiersFor, idFor } from '@/utils/festivalDeadlinePolicy';

export * from '@/utils/festivalDeadlinePolicy';

/**
 * Schedule both alerts for one submission, replacing any it already had.
 * Silently does nothing without permission or a real deadline.
 */
export async function scheduleDeadlineAlerts(festival: FestivalSubmission): Promise<number> {
  await cancelDeadlineAlerts(festival.id);
  if (!festival.deadline) return 0;

  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return 0;

  let scheduled = 0;
  for (const lead of LEAD_DAYS) {
    const fire = fireDateFor(festival.deadline, lead);
    if (!fire) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: idFor(festival.id, lead),
      content: {
        title: lead === 1 ? 'Festival deadline tomorrow' : 'Festival deadline in a week',
        body: `${festival.festivalName}${festival.location ? ` — ${festival.location}` : ''}\nCloses ${festival.deadline}`,
        data: { type: 'festival-deadline', festivalId: festival.id, leadDays: lead },
        sound: true,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fire },
    });
    scheduled += 1;
  }
  return scheduled;
}

export async function cancelDeadlineAlerts(festivalId: string): Promise<void> {
  for (const id of identifiersFor(festivalId)) {
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  }
}

/**
 * Re-schedule every tracked submission. Called after a subscription changes,
 * because a lapsed Pro must stop getting alerts and a new one must start.
 */
export async function rescheduleAllDeadlines(
  festivals: FestivalSubmission[],
  isPro: boolean,
): Promise<number> {
  for (const f of festivals) await cancelDeadlineAlerts(f.id);
  if (!isPro) return 0;
  let n = 0;
  for (const f of festivals) n += await scheduleDeadlineAlerts(f);
  return n;
}
