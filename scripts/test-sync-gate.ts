/**
 * scripts/test-sync-gate.ts
 *
 *   node --experimental-strip-types scripts/test-sync-gate.ts
 *
 * Who syncs (lib/syncGate.ts). Invited crew without Pro of their own used to
 * lose every edit; a free account with no shared project must still not sync
 * (#43).
 */
import { isSyncAllowed, CREW_SYNC_WITHOUT_PRO, newlyJoined } from '../lib/syncGate.ts';

let pass = 0;
let fail = 0;

function ok(label: string, condition: boolean) {
  if (condition) { pass++; return; }
  fail++;
  console.log(`FAIL ${label}`);
}

ok('signed out never syncs', !isSyncAllowed({ signedIn: false, proEntitled: true, acceptedMemberships: 3 }));
ok('Pro syncs', isSyncAllowed({ signedIn: true, proEntitled: true, acceptedMemberships: 0 }));
ok('free with no membership does not sync', !isSyncAllowed({ signedIn: true, proEntitled: false, acceptedMemberships: 0 }));
ok('free with an accepted membership follows the flag',
  isSyncAllowed({ signedIn: true, proEntitled: false, acceptedMemberships: 1 }) === CREW_SYNC_WITHOUT_PRO);

ok('a new membership is reported', newlyJoined(['a'], ['a', 'b']).join() === 'b');
ok('no change reports nothing', newlyJoined(['a', 'b'], ['b', 'a']).length === 0);
ok('leaving reports nothing', newlyJoined(['a', 'b'], ['a']).length === 0);

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
