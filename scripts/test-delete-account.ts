/**
 * scripts/test-delete-account.ts
 *
 *   node --experimental-strip-types scripts/test-delete-account.ts
 *
 * The delete-account function must reach every table the app syncs. The old
 * client-side delete missed several, and nothing noticed, because a table
 * that is not deleted fails silently: the data simply stays.
 */
import { USER_TABLES, isMissingTable } from '../supabase/functions/delete-account/tables.ts';
import { SYNCABLE_TABLES } from '../lib/syncConfig.ts';

let pass = 0;
let fail = 0;

function ok(label: string, condition: boolean) {
  if (condition) { pass++; return; }
  fail++;
  console.log(`FAIL ${label}`);
}

for (const { table } of SYNCABLE_TABLES) {
  ok(`${table} is deleted with the account`, USER_TABLES.includes(table));
}
ok('call_sheet_entries is deleted too', USER_TABLES.includes('call_sheet_entries'));
ok('devices are deleted', USER_TABLES.includes('devices'));
ok('entitlements are deleted', USER_TABLES.includes('entitlements'));
ok('no table is listed twice', new Set(USER_TABLES).size === USER_TABLES.length);

const at = (t: string) => USER_TABLES.indexOf(t);
for (const { table, projectScoped } of SYNCABLE_TABLES) {
  if (projectScoped) ok(`${table} goes before projects`, at(table) < at('projects'));
}
ok('annotations go before their scripts', at('script_annotations') < at('script_pdfs'));

ok('a missing table is recognized', isMissingTable('42P01') && isMissingTable('PGRST205'));
ok('another error is not', !isMissingTable('42501') && !isMissingTable(undefined));

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
