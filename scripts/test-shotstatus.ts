/**
 * scripts/test-shotstatus.ts
 *
 * Assertions for utils/shotStatus.ts — the rule that the status sequence does
 * not wrap. Run from the repo root:
 *
 *   node --experimental-strip-types scripts/test-shotstatus.ts
 */
import {
  STATUS_FLOW, statusIndex, nextStatus, previousStatus, isComplete, describeTap,
} from '../utils/shotStatus.ts';

let pass = 0;
let fail = 0;

function eq(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { pass++; return; }
  fail++;
  console.log(`FAIL ${label}\n  expected ${e}\n  actual   ${a}`);
}

eq('the sequence', [...STATUS_FLOW], ['planned', 'ready', 'shot', 'approved']);

// --- statusIndex -----------------------------------------------------------
eq('index of planned', statusIndex('planned'), 0);
eq('index of approved', statusIndex('approved'), 3);
eq('index of nonsense', statusIndex('banana'), -1);

// --- nextStatus: the bug this module exists for ----------------------------
eq('planned advances', nextStatus('planned'), 'ready');
eq('ready advances', nextStatus('ready'), 'shot');
eq('shot advances', nextStatus('shot'), 'approved');
// It used to return 'planned' here, erasing the record that it had been shot.
eq('approved does NOT wrap to planned', nextStatus('approved'), null);
// Bad data should still be movable rather than stuck.
eq('unrecognised starts the sequence', nextStatus('banana'), 'planned');
eq('empty starts the sequence', nextStatus(''), 'planned');

// --- previousStatus --------------------------------------------------------
eq('approved steps back', previousStatus('approved'), 'shot');
eq('shot steps back', previousStatus('shot'), 'ready');
eq('ready steps back', previousStatus('ready'), 'planned');
eq('planned cannot go back', previousStatus('planned'), null);
eq('unrecognised cannot go back', previousStatus('banana'), null);

// Forward then back returns where it started, for every step.
for (const status of STATUS_FLOW) {
  const forward = nextStatus(status);
  if (forward) eq(`${status} round trips`, previousStatus(forward), status);
}

// --- isComplete ------------------------------------------------------------
eq('planned is not complete', isComplete('planned'), false);
eq('ready is not complete', isComplete('ready'), false);
eq('shot is complete', isComplete('shot'), true);
eq('approved is complete', isComplete('approved'), true);

// --- describeTap -----------------------------------------------------------
eq('hint for planned', describeTap('planned'), 'Mark as ready');
eq('hint for shot', describeTap('shot'), 'Mark as approved');
eq('hint at the end explains the long press',
  describeTap('approved'), 'Already approved. Long press to move it back.');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
