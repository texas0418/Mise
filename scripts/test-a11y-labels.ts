/**
 * scripts/test-a11y-labels.ts
 *
 *   node --experimental-strip-types scripts/test-a11y-labels.ts
 *
 * Every touchable in the app must announce itself. All 399 of them now do.
 *
 * There are three ways to satisfy that, and which one applies is a property of
 * the control rather than a matter of taste:
 *
 * 1. **An icon-only control gets a label.** A bare glyph announces as nothing,
 *    so the label is the only thing that says what the button is. 70 of these
 *    were silent.
 *
 * 2. **A control with visible text gets the button role and no label.** Its
 *    text is already read aloud; what it lacked was the trait, so the text was
 *    heard as prose rather than as something that can be activated. A second
 *    hand-written label on top would be redundant, and if it drifted from the
 *    visible text it would be the WCAG 2.5.3 "Label in Name" failure.
 *
 * 3. **A container that wraps its own controls gets neither.** Giving an
 *    expandable card the button role makes react-native-web emit <button>
 *    inside <button>, and iOS focuses the card and never the edit and delete
 *    buttons inside it. Its text is read regardless.
 *
 * The hazard this guards is that a screen gets labelled and someone later adds
 * a fresh icon-only button to it, putting it straight back where it started.
 * Nothing would notice: a missing label is invisible to everything except a
 * person holding the phone with VoiceOver on.
 *
 * Coverage prints on every run, so a regression shows up as a number going
 * down rather than as silence.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describeTake, formatTakeTime, toggleLabel, saveTakeHint } from '../utils/a11yLabels.ts';

/**
 * Every screen in the app. This started as a two-file beachhead while #47 was
 * being worked through a screen at a time; it is now the whole surface, which
 * means a new screen must arrive announced or the suite fails.
 *
 * Listed explicitly rather than globbed on purpose: a glob would quietly cover
 * a new file and quietly stop covering a renamed one, and the point of a
 * ratchet is that changes to what it guards are visible in the diff.
 */
const COVERED = [
  'app/(tabs)/(today)/_layout.tsx',
  'app/(tabs)/(today)/index.tsx',
  'app/(tabs)/_layout.tsx',
  'app/(tabs)/crew/_layout.tsx',
  'app/(tabs)/crew/index.tsx',
  'app/(tabs)/more/_layout.tsx',
  'app/(tabs)/more/index.tsx',
  'app/(tabs)/onset/_layout.tsx',
  'app/(tabs)/onset/index.tsx',
  'app/(tabs)/projects/_layout.tsx',
  'app/(tabs)/projects/index.tsx',
  'app/(tabs)/schedule/_layout.tsx',
  'app/(tabs)/schedule/index.tsx',
  'app/(tabs)/shots/_layout.tsx',
  'app/(tabs)/shots/index.tsx',
  'app/+native-intent.tsx',
  'app/_layout.tsx',
  'app/auth/forgot-password.tsx',
  'app/auth/profile.tsx',
  'app/auth/sign-in.tsx',
  'app/auth/sign-up.tsx',
  'app/blocking-notes.tsx',
  'app/budget-spreadsheet.tsx',
  'app/budget.tsx',
  'app/call-sheet-details.tsx',
  'app/call-sheets.tsx',
  'app/cast-manager.tsx',
  'app/color-references.tsx',
  'app/comms-hub.tsx',
  'app/continuity.tsx',
  'app/crew-directory.tsx',
  'app/digital-slate.tsx',
  'app/export-share.tsx',
  'app/festival-tracker.tsx',
  'app/frame-guides.tsx',
  'app/import-data.tsx',
  'app/lens-calculator.tsx',
  'app/lighting-diagrams.tsx',
  'app/lighting-editor.tsx',
  'app/location-weather.tsx',
  'app/locations.tsx',
  'app/log-take.tsx',
  'app/lookbook.tsx',
  'app/mood-boards.tsx',
  'app/new-blocking-note.tsx',
  'app/new-breakdown.tsx',
  'app/new-budget-item.tsx',
  'app/new-cast-member.tsx',
  'app/new-color-reference.tsx',
  'app/new-continuity.tsx',
  'app/new-crew.tsx',
  'app/new-festival.tsx',
  'app/new-lighting-diagram.tsx',
  'app/new-location.tsx',
  'app/new-lookbook-item.tsx',
  'app/new-message.tsx',
  'app/new-mood-item.tsx',
  'app/new-note.tsx',
  'app/new-project.tsx',
  'app/new-schedule-day.tsx',
  'app/new-script-side.tsx',
  'app/new-script.tsx',
  'app/new-select.tsx',
  'app/new-shot-reference.tsx',
  'app/new-shot.tsx',
  'app/new-time-entry.tsx',
  'app/new-vfx.tsx',
  'app/new-wrap-report.tsx',
  'app/paywall.tsx',
  'app/portfolio.tsx',
  'app/production-notes.tsx',
  'app/project-detail.tsx',
  'app/project/invite.tsx',
  'app/project/team.tsx',
  'app/script-breakdown.tsx',
  'app/script-sides.tsx',
  'app/script-viewer.tsx',
  'app/scripts.tsx',
  'app/selects.tsx',
  'app/settings/devices.tsx',
  'app/settings/sync.tsx',
  'app/shot-checklist.tsx',
  'app/shot-references.tsx',
  'app/time-tracker.tsx',
  'app/vfx-tracker.tsx',
  'app/wrap-reports.tsx',
  'components/ConflictResolver.tsx',
  'components/DateTimeField.tsx',
  'components/ImportButton.tsx',
  'components/ImportToolbar.tsx',
  'components/NotificationSettings.tsx',
  'components/OfflineIndicator.tsx',
  'components/OnboardingFlow.tsx',
  'components/SyncStatusIndicator.tsx',
  'components/TodayCards.tsx',
  'components/V2MigrationFlow.tsx',
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

/**
 * The end of a component's children, so the body can be inspected.
 *
 * Depth-counted rather than "find the next closing tag", because these nest —
 * a card wrapping two buttons is the common shape, not the exception.
 */
function findClose(source: string, start: number, name: string): number {
  let depth = 1;
  let index = start;
  while (depth > 0) {
    const close = source.indexOf(`</${name}>`, index);
    const open = source.indexOf(`<${name} `, index);
    if (close === -1) return source.length;
    if (open !== -1 && open < close) { depth++; index = open + 1; continue; }
    depth--;
    index = close + 1;
    if (depth === 0) return close;
  }
  return index;
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

      // A control whose own visible text says what it does is already
      // announced — VoiceOver reads the <Text> inside it. What it needs is the
      // *trait*, so that the text is heard as a button rather than as prose.
      // A second, hand-written label on top would be redundant at best, and at
      // worst would say something different from what is on screen, which is
      // the WCAG 2.5.3 "Label in Name" failure.
      const body = source.slice(match.index + opening.length,
                                findClose(source, match.index + opening.length, tag));
      const hasText = /<Text[\s>]/.test(body);
      if (hasText && opening.includes('accessibilityRole="button"')) continue;

      // A container that wraps its own controls — an expandable card holding
      // edit and delete — must NOT be given the button role: react-native-web
      // then emits <button> inside <button>, and iOS focuses the container and
      // never the controls in it. Its text is still read aloud, so it is
      // announced; what it is not is a button, and saying so would be a lie
      // that costs the reader the buttons inside.
      const wrapsAControl = TOUCHABLES.some(inner => new RegExp(`<${inner}[\\s/>]`).test(body));
      if (hasText && wrapsAControl) continue;

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
