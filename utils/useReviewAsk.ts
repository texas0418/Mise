/**
 * utils/useReviewAsk.ts
 *
 * The review prompt from any calm surface, with one set of signals.
 *
 * The prompt used to fire only from the Projects tab, and the app opens on
 * Today, so most people who had earned the ask never reached it. It now also
 * runs on Today, after a PDF export or share, and after a wrap report is
 * saved. The gate is unchanged (utils/reviewPolicy.ts and maybeAskForReview),
 * with one addition: nothing is asked on a shoot day, because "never on set"
 * is the rule that matters most here. Saving the wrap report is the one
 * exception: it is written after the last shot, so the set has wrapped.
 */
import { useCallback } from 'react';
import { useProjects } from '@/contexts/ProjectContext';
import { maybeAskForReview } from '@/utils/reviewPrompt';
import { localDateKey } from '@/utils/today';

export function useReviewAsk(): (options?: { afterWrap?: boolean }) => void {
  const {
    projects, takes, wrapReports, scenes, shots, castMembers, crew, locations, schedule,
  } = useProjects();

  return useCallback((options?: { afterWrap?: boolean }) => {
    const today = localDateKey(new Date());
    if (!options?.afterWrap && schedule.some(day => day.date === today)) return;
    void maybeAskForReview({
      wrapReports: wrapReports.length,
      takes: takes.length,
      projects: projects.length,
      plannedItems: scenes.length + shots.length + castMembers.length + crew.length + locations.length,
    });
  }, [projects, takes, wrapReports, scenes, shots, castMembers, crew, locations, schedule]);
}
