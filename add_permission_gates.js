#!/usr/bin/env node
/**
 * add_permission_gates.js
 * 
 * Adds PermissionGate to all Mise tool screens.
 * 
 * Run from the root of your MiseApp repo:
 *   node add_permission_gates.js
 * 
 * Then review with: git diff
 * Then commit: git add -A && git commit -m "feat: wire PermissionGate into all tool screens (4.6)"
 */

const fs = require('fs');
const path = require('path');

const IMPORT_LINE = `import PermissionGate from '@/contexts/PermissionGate';`;

// Map of file path -> resource name
const SCREENS = {
  'app/blocking-notes.tsx':           'blocking',
  'app/budget.tsx':                   'budget',
  'app/call-sheets.tsx':              'call_sheets',
  'app/cast-manager.tsx':             'cast',
  'app/color-references.tsx':         'color_refs',
  'app/comms-hub.tsx':                'messages',
  'app/continuity.tsx':               'continuity',
  'app/crew-directory.tsx':           'crew',
  'app/digital-slate.tsx':            'digital_slate',
  'app/export-share.tsx':             'export',
  'app/festival-tracker.tsx':         'festivals',
  'app/frame-guides.tsx':             'frame_guides',
  'app/lens-calculator.tsx':          'lens_calc',
  'app/location-weather.tsx':         'weather',
  'app/locations.tsx':                'locations',
  'app/lookbook.tsx':                 'lookbook',
  'app/mood-boards.tsx':              'mood_board',
  'app/portfolio.tsx':                'portfolio',
  'app/production-notes.tsx':         'notes',
  'app/script-breakdown.tsx':         'script_breakdown',
  'app/script-sides.tsx':             'script_sides',
  'app/selects.tsx':                  'selects',
  'app/shot-checklist.tsx':           'shot_checklist',
  'app/shot-references.tsx':          'shot_refs',
  'app/time-tracker.tsx':             'time_entries',
  'app/vfx-tracker.tsx':              'vfx',
  'app/wrap-reports.tsx':             'wrap_reports',
  'app/(tabs)/shots/index.tsx':       'shots',
  'app/(tabs)/schedule/index.tsx':    'schedule',
};

let updated = 0;
let skipped = 0;
let notFound = 0;

for (const [relPath, resource] of Object.entries(SCREENS)) {
  const fullPath = path.join(process.cwd(), relPath);

  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  NOT FOUND: ${relPath}`);
    notFound++;
    continue;
  }

  let content = fs.readFileSync(fullPath, 'utf8');

  // Skip if already wrapped
  if (content.includes('PermissionGate')) {
    console.log(`✅ ALREADY DONE: ${relPath}`);
    skipped++;
    continue;
  }

  // ── Step 1: Add import ──────────────────────────────────────────────────
  // Insert after the last consecutive import line
  const importBlockEnd = (() => {
    const lines = content.split('\n');
    let lastImportIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('import ')) lastImportIdx = i;
    }
    return lastImportIdx;
  })();

  if (importBlockEnd === -1) {
    console.log(`⚠️  SKIP (no imports found): ${relPath}`);
    skipped++;
    continue;
  }

  const lines = content.split('\n');
  lines.splice(importBlockEnd + 1, 0, IMPORT_LINE);
  content = lines.join('\n');

  // ── Step 2: Wrap return JSX ─────────────────────────────────────────────
  // Find the default export function
  const exportMatch = content.match(/export default function (\w+)/);
  if (!exportMatch) {
    console.log(`⚠️  SKIP (no default export): ${relPath}`);
    skipped++;
    continue;
  }

  // Find "return (" inside the default export and wrap the first JSX element
  // Pattern: return (\n    <SomeComponent
  // We wrap it to: return (\n    <PermissionGate resource="X">\n    <SomeComponent
  // And add </PermissionGate> before the closing );

  // Replace the first "return (" followed by whitespace and a JSX opening tag
  const returnPattern = /(\breturn\s*\()\s*\n(\s*)(<(?!PermissionGate))/;
  if (!returnPattern.test(content)) {
    console.log(`⚠️  SKIP (return pattern not matched): ${relPath}`);
    skipped++;
    continue;
  }

  content = content.replace(
    returnPattern,
    (_, ret, ws, tag) =>
      `${ret}\n${ws}<PermissionGate resource="${resource}">\n${ws}${tag}`
  );

  // Now find the closing ); that ends the return statement of the default export.
  // Strategy: find the LAST ); before the styles const or end of file.
  // We look for the pattern: \n    );\n} (closing the function body)
  const closePattern = /(\n(\s*))\);\s*(\n\s*(?:const styles|export\s+(?:default\s+)?(?:const|function)|$))/;
  if (!closePattern.test(content)) {
    // Fallback: just find last ); in file
    const lastReturn = content.lastIndexOf('\n  );');
    if (lastReturn !== -1) {
      content =
        content.slice(0, lastReturn) +
        `\n  </PermissionGate>` +
        content.slice(lastReturn);
    } else {
      console.log(`⚠️  SKIP (closing pattern not matched): ${relPath}`);
      skipped++;
      continue;
    }
  } else {
    content = content.replace(
      closePattern,
      (_, nl, ws, after) =>
        `\n${ws}</PermissionGate>${nl}${ws});${after}`
    );
  }

  fs.writeFileSync(fullPath, content, 'utf8');
  console.log(`🔧 WRAPPED [${resource}]: ${relPath}`);
  updated++;
}

console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`Updated : ${updated}`);
console.log(`Skipped : ${skipped}`);
console.log(`Not found: ${notFound}`);
console.log('');
console.log('Next steps:');
console.log('  git diff                          ← review all changes');
console.log('  git add -A && git commit -m "feat: wire PermissionGate into all tool screens (4.6)"');
