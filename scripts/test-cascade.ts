/**
 * scripts/test-cascade.ts
 *
 * Guards the one way deleting a project can go wrong quietly.
 *
 *   node --experimental-strip-types scripts/test-cascade.ts
 *
 * The cascade in `deleteProject` names its stores explicitly. That is the right
 * call — deriving them would hide what is being destroyed — but it means a new
 * project-scoped table can be added and simply forgotten, and the symptom is
 * invisible: rows nobody sees, kept forever, on the device and on the server.
 *
 * So rather than testing the cascade's behaviour, this reads the source and
 * checks its *coverage*: every table registered as `projectScoped: true` must
 * have its store removed in `deleteProject`. It fails the day someone adds a
 * table and does not.
 */
import { readFileSync } from 'node:fs';

let pass = 0;
let fail = 0;

function ok(label: string, condition: boolean, detail = '') {
  if (condition) { pass++; return; }
  fail++;
  console.log(`FAIL ${label}${detail ? `\n  ${detail}` : ''}`);
}

const syncConfig = readFileSync('lib/syncConfig.ts', 'utf8');
const context = readFileSync('contexts/ProjectContext.tsx', 'utf8');

// --- every table the sync layer considers project-scoped -------------------
const projectScoped = new Set<string>();
for (const line of syncConfig.split('\n')) {
  const m = line.match(/\{\s*table:\s*'([^']+)'[^}]*projectScoped:\s*true/);
  if (m) projectScoped.add(m[1]);
}
ok('found project-scoped tables', projectScoped.size > 10, `found ${projectScoped.size}`);

// --- which store variable owns each table ----------------------------------
const storeForTable = new Map<string, string>();
const declaration = /const\s+(\w+)\s*=\s*useEntityStore<[^>]+>\(\s*'[^']+',\s*STORAGE_KEYS\.\w+,\s*\[\],\s*'([^']+)'/g;
for (const m of context.matchAll(declaration)) {
  storeForTable.set(m[2], m[1]);
}
ok('found store declarations', storeForTable.size > 10, `found ${storeForTable.size}`);

// --- what deleteProject actually removes -----------------------------------
const start = context.indexOf('const deleteProject = (projectId: string) => {');
ok('deleteProject found', start !== -1);
const end = context.indexOf('\n  };', start);
const body = context.slice(start, end);

const removed = new Set<string>();
for (const m of body.matchAll(/void\s+(\w+)\.removeWhere\(/g)) removed.add(m[1]);
ok('cascade removes several stores', removed.size > 10, `removes ${removed.size}`);
ok('the project itself is removed last',
  body.includes('projectStore.remove(projectId)'),
  'deleteProject must remove the project row too');

// --- the actual assertion --------------------------------------------------
const missing: string[] = [];
for (const table of projectScoped) {
  const store = storeForTable.get(table);
  if (!store) {
    missing.push(`${table} (no store declaration found)`);
    continue;
  }
  if (!removed.has(store)) missing.push(`${table} -> ${store}`);
}
ok('every project-scoped table is cascaded', missing.length === 0,
  missing.length ? `not removed on project delete:\n    ${missing.join('\n    ')}` : '');

// --- and nothing global is swept up ----------------------------------------
// Contacts and portfolio credits outlive any one film, so they must NOT be in
// the cascade. crew_members has no projectId at all (#40); credits has none.
for (const globalStore of ['crewStore', 'creditStore']) {
  ok(`${globalStore} is left alone`, !removed.has(globalStore),
    `${globalStore} is global and must survive a project delete`);
}

// Location weather hangs off a location, so it needs the special case rather
// than a projectId filter it does not have.
ok('location weather is handled via its locations',
  body.includes('locationWeatherStore.removeWhere') && body.includes('locationIds'),
  'location_weather has no projectId; it must be resolved through its locations');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail === 0) {
  console.log(`covered ${projectScoped.size} project-scoped tables`);
}
process.exit(fail === 0 ? 0 : 1);
