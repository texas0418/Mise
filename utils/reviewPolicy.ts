/**
 * utils/reviewPolicy.ts
 *
 * When it is fair to ask for a review. Kept dependency-free and separate from
 * the module that talks to StoreReview, so the rule itself can be reasoned
 * about and tested without a native runtime.
 */

/** Nobody has an opinion worth asking for on day one. */
export const MIN_DAYS_INSTALLED = 3;

/**
 * Planning rows that together mean a project was actually built out: scenes
 * broken down, shots listed, cast and crew entered, locations scouted.
 *
 * Twelve is deliberately above the handful you create while poking at a new
 * app and well below a finished schedule. A director planning one short film
 * passes it during the first real sitting; someone who opened Mise, made an
 * empty project and left does not.
 */
export const MIN_PLANNED_ITEMS = 12;

export interface ReviewSignals {
  /** Wrap reports filed — the strongest signal: a shoot day finished. */
  wrapReports: number;
  /** Takes logged — real on-set use. */
  takes: number;
  /** Projects created. */
  projects: number;
  /**
   * Scenes, shots, cast, crew and locations entered, summed across projects.
   * Pre-production work, which is most of what Mise is for and all of what
   * happens before a camera rolls.
   */
  plannedItems: number;
}

/**
 * Has this person actually got value out of Mise?
 *
 * Any one of these means real work happened: a shoot day was wrapped, a
 * meaningful number of takes were logged, they came back to start a second
 * production, or they built a project out properly.
 *
 * The fourth clause was added 2026-10-14. The first three all required a
 * shoot, and Mise is a pre-production tool for most of its life, so an
 * evaluator who spent an afternoon breaking down a script and never reached
 * a set was silently excluded. Five months live with 245 customers produced
 * zero ratings, which is its own kind of evidence: the bar was not measuring
 * value, it was measuring whether somebody had finished a film.
 *
 * Still not a launch count. Opening the app remains worth nothing here.
 */
export function hasEarnedTheAsk(signals: ReviewSignals): boolean {
  return (
    signals.wrapReports >= 1 ||
    signals.takes >= 20 ||
    signals.projects >= 2 ||
    signals.plannedItems >= MIN_PLANNED_ITEMS
  );
}
