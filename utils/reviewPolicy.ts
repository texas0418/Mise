/**
 * utils/reviewPolicy.ts
 *
 * When it is fair to ask for a review. Kept dependency-free and separate from
 * the module that talks to StoreReview, so the rule itself can be reasoned
 * about and tested without a native runtime.
 */

/** Nobody has an opinion worth asking for on day one. */
export const MIN_DAYS_INSTALLED = 3;

export interface ReviewSignals {
  /** Wrap reports filed — the strongest signal: a shoot day finished. */
  wrapReports: number;
  /** Takes logged — real on-set use. */
  takes: number;
  /** Projects created. */
  projects: number;
}

/**
 * Has this person actually got value out of Mise?
 *
 * Any one of these means real work happened: a shoot day was wrapped, a
 * meaningful number of takes were logged, or they came back to start a second
 * production. Creating one empty project is not enough — the bar is having
 * made something, not having opened the app.
 */
export function hasEarnedTheAsk(signals: ReviewSignals): boolean {
  return signals.wrapReports >= 1 || signals.takes >= 20 || signals.projects >= 2;
}
