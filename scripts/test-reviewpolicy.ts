/**
 * scripts/test-reviewpolicy.ts
 *
 *   node --experimental-strip-types scripts/test-reviewpolicy.ts
 *
 * The rule that decides whether Mise is allowed to ask for a review.
 *
 * This suite exists because the policy was wrong for five months in a way
 * nothing could have caught. Every clause required a shoot to have happened:
 * a wrap report filed, twenty takes logged, or a second production started.
 * Mise is a pre-production tool for most of its life, so an evaluator who
 * spent an afternoon breaking a script down and never reached a set was
 * silently excluded. 245 customers produced zero App Store ratings.
 *
 * The hazard now is the opposite one: that somebody later lowers the bar to
 * something a first launch clears, and the app starts asking people who have
 * done nothing. The cases below pin both edges.
 */
import { hasEarnedTheAsk, MIN_DAYS_INSTALLED, MIN_PLANNED_ITEMS } from '../utils/reviewPolicy.ts';

let pass = 0, fail = 0;
function ok(name: string, cond: boolean, why = '') {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${why ? `\n       ${why}` : ''}`); }
}
const none = { wrapReports: 0, takes: 0, projects: 0, plannedItems: 0 };

console.log('review policy');

// --- nobody gets asked for nothing -----------------------------------------
ok('a fresh install is never asked', hasEarnedTheAsk(none) === false,
  'opening the app must never be enough; that measures nothing');
ok('one empty project is not enough', hasEarnedTheAsk({ ...none, projects: 1 }) === false,
  'creating a project and leaving is the single most common no-value session');
ok('a handful of rows is not enough', hasEarnedTheAsk({ ...none, plannedItems: MIN_PLANNED_ITEMS - 1 }) === false,
  'poking at a new app produces a few rows; that is not value');
ok('a few takes is not enough', hasEarnedTheAsk({ ...none, takes: 19 }) === false);

// --- the shoot-side signals still work --------------------------------------
ok('one wrap report earns it', hasEarnedTheAsk({ ...none, wrapReports: 1 }) === true,
  'finishing a shoot day is the strongest signal there is');
ok('twenty takes earns it', hasEarnedTheAsk({ ...none, takes: 20 }) === true);
ok('a second project earns it', hasEarnedTheAsk({ ...none, projects: 2 }) === true,
  'coming back to start another production is a verdict in itself');

// --- the planning signal, which is the point of this change ------------------
ok('a built-out project earns it', hasEarnedTheAsk({ ...none, projects: 1, plannedItems: MIN_PLANNED_ITEMS }) === true,
  'the whole reason this clause exists: pre-production IS the product');
ok('planning counts without any shoot', hasEarnedTheAsk({ ...none, plannedItems: 40 }) === true,
  'never require a camera to have rolled');

// --- the bar stays meaningful ----------------------------------------------
ok('the planning bar is above a trivial poke', MIN_PLANNED_ITEMS >= 10,
  'below about ten rows this stops distinguishing use from curiosity');
ok('the planning bar is reachable in one sitting', MIN_PLANNED_ITEMS <= 25,
  'above this it becomes the old mistake again: only finished films qualify');
ok('still a waiting period', MIN_DAYS_INSTALLED >= 3,
  'day-one opinions are not worth asking for and Apple spends a prompt on them');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
