#!/usr/bin/env node
/**
 * wire-ai-import-buttons.mjs
 * Phase 3, Item 13: Wire AIImportButton into all applicable tool screens
 *
 * Run from MiseApp root:
 *   node wire-ai-import-buttons.mjs
 *
 * This script finds the existing ImportButton in each screen and adds
 * an AIImportButton right next to it.
 */

import fs from 'fs';
import path from 'path';

const SCREENS = [
  { file: 'app/crew-directory.tsx', entityKey: 'crew' },
  { file: 'app/budget.tsx', entityKey: 'budget' },
  { file: 'app/(tabs)/shots/index.tsx', entityKey: 'shots' },
  { file: 'app/(tabs)/schedule/index.tsx', entityKey: 'schedule' },
  { file: 'app/script-breakdown.tsx', entityKey: 'sceneBreakdowns' },
  { file: 'app/locations.tsx', entityKey: 'locations' },
  { file: 'app/cast-manager.tsx', entityKey: 'cast' },
  { file: 'app/vfx-tracker.tsx', entityKey: 'vfx' },
  { file: 'app/festival-tracker.tsx', entityKey: 'festivals' },
  { file: 'app/time-tracker.tsx', entityKey: 'timeEntries' },
  { file: 'app/script-sides.tsx', entityKey: 'scriptSides' },
  { file: 'app/continuity.tsx', entityKey: 'continuity' },
  { file: 'app/wrap-reports.tsx', entityKey: 'wrapReports' },
];

let successCount = 0;
let skipCount = 0;

for (const screen of SCREENS) {
  const filePath = path.resolve(screen.file);

  if (!fs.existsSync(filePath)) {
    console.log(`  ⚠️  ${screen.file} — not found, skipping`);
    skipCount++;
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf-8');

  // Check if already wired
  if (content.includes('AIImportButton')) {
    console.log(`  ✅ ${screen.file} — already has AIImportButton`);
    skipCount++;
    continue;
  }

  // Check that ImportButton exists (from Phase 2)
  if (!content.includes('ImportButton')) {
    console.log(`  ⚠️  ${screen.file} — no ImportButton found, skipping`);
    skipCount++;
    continue;
  }

  // 1. Add AIImportButton import after the ImportButton import
  const importLine = `import AIImportButton from '@/components/AIImportButton';`;
  const importBtnIdx = content.indexOf("import ImportButton from '@/components/ImportButton';");
  if (importBtnIdx !== -1) {
    const lineEnd = content.indexOf('\n', importBtnIdx);
    content = content.slice(0, lineEnd + 1) + importLine + '\n' + content.slice(lineEnd + 1);
  } else {
    // Fallback: add after Colors import
    const colorsIdx = content.indexOf("import Colors from");
    if (colorsIdx !== -1) {
      const lineEnd = content.indexOf('\n', colorsIdx);
      content = content.slice(0, lineEnd + 1) + importLine + '\n' + content.slice(lineEnd + 1);
    }
  }

  // 2. Find the ImportButton JSX and add AIImportButton next to it
  // Pattern: <ImportButton entityKey="xxx" variant="compact" />
  const importBtnJSX = `<ImportButton entityKey="${screen.entityKey}" variant="compact" />`;
  const jsxIdx = content.indexOf(importBtnJSX);

  if (jsxIdx !== -1) {
    // Insert AIImportButton right after ImportButton
    const insertPos = jsxIdx + importBtnJSX.length;
    const aiBtn = `\n        <AIImportButton entityKey="${screen.entityKey}" variant="compact" />`;
    content = content.slice(0, insertPos) + aiBtn + content.slice(insertPos);
    console.log(`  ✅ ${screen.file} → ${screen.entityKey} (next to ImportButton)`);
  } else {
    // Fallback: look for the ImportButton with any props
    const regex = new RegExp(`<ImportButton[^/]*/>`);
    const match = content.match(regex);
    if (match && match.index !== undefined) {
      const insertPos = match.index + match[0].length;
      const aiBtn = `\n        <AIImportButton entityKey="${screen.entityKey}" variant="compact" />`;
      content = content.slice(0, insertPos) + aiBtn + content.slice(insertPos);
      console.log(`  ✅ ${screen.file} → ${screen.entityKey} (fallback match)`);
    } else {
      console.log(`  ⚠️  ${screen.file} — could not find ImportButton JSX`);
      skipCount++;
      continue;
    }
  }

  fs.writeFileSync(filePath, content, 'utf-8');
  successCount++;
}

console.log(`\n✨ Done! ${successCount} modified, ${skipCount} skipped`);
console.log('AI Import buttons are now wired into all tool screens.');
