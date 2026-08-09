/**
 * scripts/test-entitlement.ts
 *
 * Assertions for the paid-feature gate.
 *
 *   node --experimental-strip-types scripts/test-entitlement.ts
 *
 * Two things are checked, and they fail in different ways.
 *
 * `lib/entitlement.ts` is dependency-free, so its behaviour is tested directly
 * — above all that it starts *false*. A gate that defaults to entitled hands
 * paid features to everyone for the moments before the licence resolves, and
 * on a failed resolve, forever.
 *
 * `isSyncEnabled` lives in lib/syncEngine.ts, which imports Supabase and
 * cannot run under node, so its composition is checked by reading the source.
 * That is deliberately a structural test: the risk is not that the expression
 * computes wrongly, it is that someone later relaxes it back to `!!userId`
 * and nothing notices until the Supabase bill does (#43).
 */
import { readFileSync } from 'node:fs';
import { isProEntitled, setProEntitled } from '../lib/entitlement.ts';

let pass = 0;
let fail = 0;

function ok(label: string, condition: boolean, detail = '') {
  if (condition) { pass++; return; }
  fail++;
  console.log(`FAIL ${label}${detail ? `\n  ${detail}` : ''}`);
}

// --- fail-closed default ---------------------------------------------------
// Read before anything writes: this is the state during app launch, and after
// a licence check that never completes.
ok('starts unentitled', isProEntitled() === false,
  'the gate must default to false, or paid features leak before the licence resolves');

// --- set / read ------------------------------------------------------------
setProEntitled(true);
ok('reads back true once entitled', isProEntitled() === true);

setProEntitled(false);
ok('revokes cleanly', isProEntitled() === false,
  'a lapsed subscription must be able to turn the gate back off');

setProEntitled(true);
setProEntitled(true);
ok('idempotent', isProEntitled() === true);

// --- the sync gate still requires both halves ------------------------------
const engine = readFileSync('lib/syncEngine.ts', 'utf8');
const start = engine.indexOf('export function isSyncEnabled(');
ok('isSyncEnabled found', start !== -1);
const body = engine.slice(start, engine.indexOf('}', start) + 1);

ok('sync still requires a session', body.includes('userId'),
  'isSyncEnabled must keep checking for a signed-in user');
ok('sync now also requires entitlement', body.includes('isProEntitled()'),
  `isSyncEnabled must gate on the paid entitlement — found:\n    ${body.replace(/\n/g, '\n    ')}`);
ok('the two are combined with AND, not OR', !body.includes('||'),
  'an OR here would let either half alone enable sync');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
