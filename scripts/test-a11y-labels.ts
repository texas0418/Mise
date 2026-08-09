/**
 * scripts/test-a11y-labels.ts
 *
 *   node --experimental-strip-types scripts/test-a11y-labels.ts
 *
 * Every touchable on a covered screen must announce itself.
 *
 * #47 is being fixed a screen at a time — there are 63 of them and the on-set
 * path comes first. That creates the obvious hazard: a screen gets labelled,
 * and six weeks later someone adds a fresh icon-only button to it and puts it
 * straight back where it started. Nothing would notice, because a missing
 * label is invisible to everything except a person holding the phone with
 * VoiceOver on.
 *
 * So COVERED is a ratchet, not a to-do list. A file goes in once it is clean,
 * and from then on it has to stay clean. Adding a screen to the list is the
 * last step of doing the work, and the suite fails if the claim is untrue.
 *
 * It also prints app-wide coverage on every run, so the size of what is left
 * stays visible rather than being something you have to go and count.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describeTake, formatTakeTime, toggleLabel, saveTakeHint } from '../utils/a11yLabels.ts';

/**
 * Screens whose touchables are fully labelled. Only add a file after the suite
 * passes with it in.
 */
const COVERED = [
  'app/(tabs)/onset/index.tsx',
  'app/log-take.tsx',
];

/** Components that take a press and therefore need announcing. */
const TOUCHABLES = ['TouchableOpacity', 'TouchableHighlight', 'Pressable', 'TouchableWithoutFeedback'];

/**
 * A touchable is exempt when something else already announces it: an explicit
 * opt-out, a label inherited from a child, or a keyboard-dismiss wrapper that
 * is not a control at all.
 */
const EXEMPTIONS = ['accessibilityLabel', 'accessible={false}', 'importantForAccessibility="no'];

interface Finding {
  file: string;
  line: number;
  tag: string;
  snippet: string;
}

/**
 * Read an opening JSX tag from `<Tag` to the `>` that closes it.
 *
 * Walking the characters rather than pattern-matching, because props hold
 * braces, nested JSX, template literals and `>` inside arrow functions —
 * `/<TouchableOpacity[^>]*>/` stops at the first `>` in `onPress={() => …}`
 * and reports a label that is sitting two lines further down.
 */
function readOpeningTag(source: string, start: number): string {
  let depth = 0;
  let quote: string | null = null;
  for (let i = start; i < source.length; i++) {
    const char = source[i];

    if (quote) {
      if (char === quote && source[i - 1] !== '\\') quote = null;
      continue;
    }
    // A // comment between props is legal, and prose is full of ">". Skipping
    // to the end of the line stops a comment truncating the tag and reporting
    // a labelled control as unlabelled — which it did, on the take card.
    if (char === '/' && source[i + 1] === '/') {
      const eol = source.indexOf('\n', i);
      if (eol === -1) break;
      i = eol;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if (char === '{') { depth++; continue; }
    if (char === '}') { depth--; continue; }
    if (char === '>' && depth === 0) return source.slice(start, i + 1);
  }
  return source.slice(start);
}

function scan(file: string): { total: number; missing: Finding[] } {
  const source = readFileSync(file, 'utf8');
  const missing: Finding[] = [];
  let total = 0;

  for (const tag of TOUCHABLES) {
    const pattern = new RegExp(`<${tag}[\\s/>]`, 'g');
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) {
      // Skip the import line and any type-only mention.
      const lineStart = source.lastIndexOf('\n', match.index) + 1;
      const line = source.slice(lineStart, source.indexOf('\n', match.index));
      if (/^\s*(import|\/\/|\*)/.test(line)) continue;

      total++;
      const opening = readOpeningTag(source, match.index);
      if (EXEMPTIONS.some(prop => opening.includes(prop))) continue;

      missing.push({
        file,
        line: source.slice(0, match.index).split('\n').length,
        tag,
        snippet: opening.replace(/\s+/g, ' ').slice(0, 90),
      });
    }
  }
  return { total, missing };
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith('.tsx')) out.push(full);
  }
  return out;
}

let pass = 0;
let fail = 0;

// ─── The tag reader itself ──────────────────────────────────────────────────
// Everything below trusts this, and the naive version of it is wrong.

const withArrow = '<TouchableOpacity onPress={() => go(a > b)} accessibilityLabel="x">';
const tagRead = readOpeningTag(withArrow, 0);
if (tagRead === withArrow) pass++;
else { fail++; console.log(`FAIL reads past a > inside a prop — got ${tagRead}`); }

const withNested = '<Pressable style={{ a: 1 }} accessibilityLabel="y"><Icon /></Pressable>';
if (readOpeningTag(withNested, 0).endsWith('accessibilityLabel="y">')) pass++;
else { fail++; console.log('FAIL stops at the end of the opening tag'); }

const withString = `<TouchableOpacity accessibilityLabel={\`a > b\`}>`;
if (readOpeningTag(withString, 0) === withString) pass++;
else { fail++; console.log('FAIL handles a > inside a template literal'); }

const withComment = '<TouchableOpacity\n  // emits <button> inside <button>\n  accessibilityLabel="z">';
if (readOpeningTag(withComment, 0).includes('accessibilityLabel')) pass++;
else { fail++; console.log('FAIL a > inside a // comment truncates the tag'); }

// ─── The spoken descriptions ────────────────────────────────────────────────

const full = describeTake(
  { takeNumber: 4, sceneNumber: 12, shotNumber: '12B', isCircled: true }, '09:48 AM');
if (full === 'Take 4, scene 12, shot 12B, 09:48 AM, circled') pass++;
else { fail++; console.log(`FAIL full take description — got "${full}"`); }

const bare = describeTake({}, '—');
if (bare === 'Take') pass++;
else { fail++; console.log(`FAIL an empty take degrades to "Take" — got "${bare}"`); }

// The regression this module exists for.
const undefinedFree = !describeTake({ takeNumber: undefined, sceneNumber: null }, undefined)
  .includes('undefined');
if (undefinedFree) pass++;
else { fail++; console.log('FAIL a missing field announces as "undefined"'); }

if (!describeTake({}, 'Invalid Date').includes('Invalid')) pass++;
else { fail++; console.log('FAIL "Invalid Date" reaches the label'); }

if (formatTakeTime(undefined) === '—') pass++;
else { fail++; console.log('FAIL an unreadable timestamp is not an em dash'); }

if (formatTakeTime(null, new Date('2026-08-09T09:48:00')) === '09:48 AM') pass++;
else { fail++; console.log('FAIL a readable timestamp does not format'); }

// A zero take number is a real value, not an absent one.
if (describeTake({ takeNumber: 0 }).startsWith('Take 0')) pass++;
else { fail++; console.log('FAIL take 0 is dropped as falsy'); }

if (describeTake({ takeNumber: 2, notes: ' soft focus ' }) === 'Take 2. soft focus') pass++;
else { fail++; console.log(`FAIL notes — got "${describeTake({ takeNumber: 2, notes: ' soft focus ' })}"`); }

if (toggleLabel(true, 'Circled', 'Circle take') === 'Circled') pass++;
else { fail++; console.log('FAIL toggleLabel on'); }
if (toggleLabel(false, 'Circled', 'Circle take') === 'Circle take') pass++;
else { fail++; console.log('FAIL toggleLabel off'); }

if (saveTakeHint(true, '', '', '') === 'Saves your changes to this take') pass++;
else { fail++; console.log('FAIL editing hint'); }
if (saveTakeHint(false, 12, '12B', 3) === 'Logs scene 12, shot 12B, take 3') pass++;
else { fail++; console.log(`FAIL logging hint — got "${saveTakeHint(false, 12, '12B', 3)}"`); }
// An empty form must not offer to log "scene undefined".
if (saveTakeHint(false, '', undefined, null) === 'Logs scene blank, shot blank, take blank') pass++;
else { fail++; console.log(`FAIL blank hint — got "${saveTakeHint(false, '', undefined, null)}"`); }

// ─── The ratchet ────────────────────────────────────────────────────────────

for (const file of COVERED) {
  const { total, missing } = scan(file);
  if (missing.length === 0) {
    pass++;
  } else {
    fail++;
    console.log(`FAIL ${file} — ${missing.length} of ${total} touchables unlabelled:`);
    for (const m of missing) console.log(`       ${m.file}:${m.line}  ${m.snippet}`);
  }
}

// A covered file that stops existing, or gets renamed, should fail loudly
// rather than silently passing with nothing to check.
if (COVERED.length > 0) pass++;
else { fail++; console.log('FAIL COVERED is empty — nothing is being guarded'); }

// ─── Where the rest of it stands ────────────────────────────────────────────

const allFiles = [...walk('app'), ...walk('components')];
let appTotal = 0;
let appMissing = 0;
const worst: { file: string; missing: number }[] = [];

for (const file of allFiles) {
  const { total, missing } = scan(file);
  appTotal += total;
  appMissing += missing.length;
  if (missing.length > 0) worst.push({ file, missing: missing.length });
}

const covered = appTotal - appMissing;
const percent = appTotal === 0 ? 100 : Math.round((covered / appTotal) * 1000) / 10;
console.log(`\n  app-wide: ${covered} of ${appTotal} touchables labelled (${percent}%)`);
console.log(`  ${COVERED.length} screen(s) under the ratchet; ${worst.length} files still have gaps`);
worst.sort((a, b) => b.missing - a.missing);
for (const w of worst.slice(0, 5)) console.log(`    ${w.missing.toString().padStart(3)}  ${w.file}`);
console.log('');

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
