/**
 * scripts/test-sync-gate.ts
 *
 *   node --experimental-strip-types scripts/test-sync-gate.ts
 *
 * Who syncs (lib/syncGate.ts). Crew sync on their own Pro or on a seat from the
 * director's plan; a free account with neither must not sync (#43).
 */
import { isSyncAllowed, newlyJoined } from '../lib/syncGate.ts';

let pass = 0;
let fail = 0;

function ok(label: string, condition: boolean) {
  if (condition) { pass++; return; }
  fail++;
  console.log(`FAIL ${label}`);
}

ok('signed out never syncs', !isSyncAllowed({ signedIn: false, proEntitled: true, seatCovered: true }));
ok('Pro syncs', isSyncAllowed({ signedIn: true, proEntitled: true, seatCovered: false }));
ok('free with no seat does not sync', !isSyncAllowed({ signedIn: true, proEntitled: false, seatCovered: false }));
ok('free crew on a director seat syncs', isSyncAllowed({ signedIn: true, proEntitled: false, seatCovered: true }));

ok('a new membership is reported', newlyJoined(['a'], ['a', 'b']).join() === 'b');
ok('no change reports nothing', newlyJoined(['a', 'b'], ['b', 'a']).length === 0);
ok('leaving reports nothing', newlyJoined(['a', 'b'], ['a']).length === 0);

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
