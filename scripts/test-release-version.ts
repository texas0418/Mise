/**
 * scripts/test-release-version.ts
 *
 *   node --experimental-strip-types scripts/test-release-version.ts
 *
 * The app can actually be submitted.
 *
 * ## Why this exists
 *
 * Mise shipped 1.0.0 in May and then accumulated 33+ commits that never went
 * out. Part of that was work in progress, but the mechanical blocker was this:
 * `app.json` still said `version: "1.0.0"` and had **no `ios.buildNumber` at
 * all**. App Store Connect rejects an upload whose version and build already
 * exist, so nothing could be submitted whatever state the code was in — and
 * nothing anywhere said so. Every session read "33 commits unshipped" as a
 * scheduling fact rather than a broken field.
 *
 * A test cannot know when a release is due. What it can do is refuse to let the
 * two fields go missing or malformed again, so the next person who tries to
 * ship finds out here rather than from a rejected upload.
 *
 * ## Why app.json and nothing else
 *
 * `ios/` and `android/` are gitignored — this is a Continuous Native
 * Generation project, so the native projects are regenerated from `app.json`
 * and any `Info.plist` sitting on disk is a stale artefact of the last
 * prebuild. `app.json` is the only source of truth there is to check.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const app = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8')).expo;

let pass = 0;
let fail = 0;

function ok(label: string, condition: boolean, detail = '') {
  if (condition) { pass++; return; }
  fail++;
  console.log(`FAIL ${label}${detail ? ` — ${detail}` : ''}`);
}

// ─── The marketing version ──────────────────────────────────────────────────

ok('a version is set', typeof app.version === 'string' && app.version.length > 0);
ok('the version is three dot-separated numbers',
  /^\d+\.\d+\.\d+$/.test(app.version ?? ''), String(app.version));

/*
 * 1.0.0 is what has been live on the App Store since 2026-05-25. Leaving it
 * there is the state that blocked every submission after it, so it is worth
 * naming rather than describing.
 */
ok('the version has moved past the released 1.0.0', app.version !== '1.0.0', String(app.version));

// ─── The build number ───────────────────────────────────────────────────────

/*
 * This is the field that was absent entirely. ASC treats it as the unique
 * identifier of an upload within a version, and Expo omits it from the
 * generated Info.plist when it is missing, which is how it went unnoticed.
 */
ok('ios.buildNumber is set', typeof app.ios?.buildNumber === 'string' && app.ios.buildNumber.length > 0);
ok('ios.buildNumber is a string, not a number',
  app.ios?.buildNumber === undefined || typeof app.ios.buildNumber === 'string',
  `got ${typeof app.ios?.buildNumber}`);
ok('ios.buildNumber is digits', /^\d+(\.\d+)*$/.test(String(app.ios?.buildNumber ?? '')),
  String(app.ios?.buildNumber));
ok('ios.buildNumber has moved past the released build 1',
  Number(app.ios?.buildNumber) > 1, String(app.ios?.buildNumber));

/* Android is not shipping yet, but a missing versionCode is the same trap. */
ok('android.versionCode is set', typeof app.android?.versionCode === 'number');
ok('android.versionCode is a whole number above zero',
  Number.isInteger(app.android?.versionCode) && app.android.versionCode > 0,
  String(app.android?.versionCode));

// ─── Things a submission needs that are easy to lose ────────────────────────

ok('the iOS bundle identifier is unchanged',
  app.ios?.bundleIdentifier === 'com.mise.film-director-suite', String(app.ios?.bundleIdentifier));
ok('the encryption declaration is present, or review will ask for it',
  app.ios?.infoPlist?.ITSAppUsesNonExemptEncryption === false);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
