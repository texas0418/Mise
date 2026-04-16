#!/usr/bin/env node
/**
 * wire-import-buttons.mjs
 * Phase 2, Item 8: Wire ImportButton into all applicable tool screens
 *
 * Run from MiseApp root:
 *   node wire-import-buttons.mjs
 *
 * For each screen, this script:
 * 1. Adds `import ImportButton from '@/components/ImportButton';`
 * 2. Inserts `<ImportButton entityKey="..." variant="compact" />` in the stats/header area
 */

import fs from 'fs';
import path from 'path';

// ─── Screen configs ────────────────────────────────────────────────
// Each entry defines:
//   file: path from project root
//   entityKey: matches importRegistry key
//   importAfter: string to find in imports, we add our import after this line
//   insertAfter: unique string in JSX after which to insert the button
//   buttonJSX: the exact JSX to insert (indented to match context)

const SCREENS = [
  {
    file: 'app/crew-directory.tsx',
    entityKey: 'crew',
    importAfter: "import Colors from '@/constants/colors';",
    // Insert in the statsBar, right before the closing </View> of statsBar
    findLine: `<Text style={styles.statsDetail}>{Object.keys(deptCounts).length} dept{Object.keys(deptCounts).length !== 1 ? 's' : ''}</Text>`,
    insertAfter: true, // insert after this line
    buttonJSX: `        <ImportButton entityKey="crew" variant="compact" />`,
  },
  {
    file: 'app/budget.tsx',
    entityKey: 'budget',
    importAfter: "import Colors from '@/constants/colors';",
    // Insert after the sort button TouchableOpacity in the searchRow
    findLine: `<Text style={styles.progressText}>{spentPercent.toFixed(0)}% of budget used · {budget.length} items</Text>`,
    insertAfter: false, // insert before this line
    buttonJSX: `              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}><ImportButton entityKey="budget" /></View>`,
  },
  {
    file: 'app/(tabs)/shots/index.tsx',
    entityKey: 'shots',
    importAfter: "import Colors from '@/constants/colors';",
    // Insert in the statsRow area
    findLine: `<View style={styles.statsRow}>`,
    insertAfter: false,
    buttonJSX: `      <View style={{ position: 'absolute', top: 14, right: 20, zIndex: 10 }}><ImportButton entityKey="shots" variant="compact" /></View>`,
  },
  {
    file: 'app/(tabs)/schedule/index.tsx',
    entityKey: 'schedule',
    importAfter: "import Colors from '@/constants/colors';",
    findLine: `<View style={styles.statsRow}>`,
    insertAfter: false,
    buttonJSX: `      <View style={{ position: 'absolute', top: 14, right: 20, zIndex: 10 }}><ImportButton entityKey="schedule" variant="compact" /></View>`,
  },
  {
    file: 'app/script-breakdown.tsx',
    entityKey: 'sceneBreakdowns',
    importAfter: "import Colors from '@/constants/colors';",
    findLine: `<View style={styles.statsBar}>`,
    insertAfter: false,
    buttonJSX: `      <View style={{ position: 'absolute', top: 10, right: 16, zIndex: 10 }}><ImportButton entityKey="sceneBreakdowns" variant="compact" /></View>`,
  },
  {
    file: 'app/locations.tsx',
    entityKey: 'locations',
    importAfter: "import Colors from '@/constants/colors';",
    findLine: `<View style={styles.statsBar}>`,
    insertAfter: false,
    buttonJSX: `      <View style={{ position: 'absolute', top: 10, right: 16, zIndex: 10 }}><ImportButton entityKey="locations" variant="compact" /></View>`,
  },
  {
    file: 'app/cast-manager.tsx',
    entityKey: 'cast',
    importAfter: "import Colors from '@/constants/colors';",
    findLine: `<View style={styles.statsBar}>`,
    insertAfter: false,
    buttonJSX: `      <View style={{ position: 'absolute', top: 10, right: 16, zIndex: 10 }}><ImportButton entityKey="cast" variant="compact" /></View>`,
  },
  {
    file: 'app/vfx-tracker.tsx',
    entityKey: 'vfx',
    importAfter: "import Colors from '@/constants/colors';",
    findLine: `<View style={styles.statsBar}>`,
    insertAfter: false,
    buttonJSX: `      <View style={{ position: 'absolute', top: 10, right: 16, zIndex: 10 }}><ImportButton entityKey="vfx" variant="compact" /></View>`,
  },
  {
    file: 'app/festival-tracker.tsx',
    entityKey: 'festivals',
    importAfter: "import Colors from '@/constants/colors';",
    findLine: `<View style={styles.statsBar}>`,
    insertAfter: false,
    buttonJSX: `      <View style={{ position: 'absolute', top: 10, right: 16, zIndex: 10 }}><ImportButton entityKey="festivals" variant="compact" /></View>`,
  },
  {
    file: 'app/time-tracker.tsx',
    entityKey: 'timeEntries',
    importAfter: "import Colors from '@/constants/colors';",
    findLine: `<View style={styles.statsBar}>`,
    insertAfter: false,
    buttonJSX: `      <View style={{ position: 'absolute', top: 10, right: 16, zIndex: 10 }}><ImportButton entityKey="timeEntries" variant="compact" /></View>`,
  },
  {
    file: 'app/script-sides.tsx',
    entityKey: 'scriptSides',
    importAfter: "import Colors from '@/constants/colors';",
    findLine: `<View style={styles.statsBar}>`,
    insertAfter: false,
    buttonJSX: `      <View style={{ position: 'absolute', top: 10, right: 16, zIndex: 10 }}><ImportButton entityKey="scriptSides" variant="compact" /></View>`,
  },
  {
    file: 'app/continuity.tsx',
    entityKey: 'continuity',
    importAfter: "import Colors from '@/constants/colors';",
    findLine: `<View style={styles.statsBar}>`,
    insertAfter: false,
    buttonJSX: `      <View style={{ position: 'absolute', top: 10, right: 16, zIndex: 10 }}><ImportButton entityKey="continuity" variant="compact" /></View>`,
  },
  {
    file: 'app/wrap-reports.tsx',
    entityKey: 'wrapReports',
    importAfter: "import Colors from '@/constants/colors';",
    findLine: `<View style={styles.statsBar}>`,
    insertAfter: false,
    buttonJSX: `      <View style={{ position: 'absolute', top: 10, right: 16, zIndex: 10 }}><ImportButton entityKey="wrapReports" variant="compact" /></View>`,
  },
];

// ─── Processing ────────────────────────────────────────────────────

let successCount = 0;
let skipCount = 0;
let failCount = 0;

for (const screen of SCREENS) {
  const filePath = path.resolve(screen.file);

  if (!fs.existsSync(filePath)) {
    console.log(`  ⚠️  ${screen.file} — not found, skipping`);
    skipCount++;
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf-8');

  // Check if already wired
  if (content.includes('ImportButton')) {
    console.log(`  ✅ ${screen.file} — already has ImportButton`);
    skipCount++;
    continue;
  }

  // 1. Add import statement
  const importLine = `import ImportButton from '@/components/ImportButton';`;
  const importIdx = content.indexOf(screen.importAfter);
  if (importIdx === -1) {
    // Try alternate import anchor
    const altAnchor = "import Colors from '@/constants/colors'";
    const altIdx = content.indexOf(altAnchor);
    if (altIdx === -1) {
      console.log(`  ❌ ${screen.file} — could not find import anchor`);
      failCount++;
      continue;
    }
    const lineEnd = content.indexOf('\n', altIdx);
    content = content.slice(0, lineEnd + 1) + importLine + '\n' + content.slice(lineEnd + 1);
  } else {
    const lineEnd = content.indexOf('\n', importIdx);
    content = content.slice(0, lineEnd + 1) + importLine + '\n' + content.slice(lineEnd + 1);
  }

  // 2. Insert button JSX
  const findIdx = content.indexOf(screen.findLine);
  if (findIdx === -1) {
    // Fallback: try to find the FAB and insert before it as a floating button
    const fabIdx = content.indexOf('style={styles.fab}');
    if (fabIdx !== -1) {
      // Find the start of the <TouchableOpacity that contains the FAB
      const fabLineStart = content.lastIndexOf('<TouchableOpacity', fabIdx);
      const fallbackJSX = `      <View style={{ position: 'absolute', top: 80, right: 24, zIndex: 10 }}><ImportButton entityKey="${screen.entityKey}" variant="compact" /></View>\n\n`;
      content = content.slice(0, fabLineStart) + fallbackJSX + content.slice(fabLineStart);
      console.log(`  ✅ ${screen.file} → ${screen.entityKey} (fallback: before FAB)`);
    } else {
      console.log(`  ❌ ${screen.file} — could not find insertion point`);
      failCount++;
      continue;
    }
  } else {
    if (screen.insertAfter) {
      // Insert after the found line
      const lineEnd = content.indexOf('\n', findIdx);
      content = content.slice(0, lineEnd + 1) + screen.buttonJSX + '\n' + content.slice(lineEnd + 1);
    } else {
      // Insert before the found line
      const lineStart = content.lastIndexOf('\n', findIdx) + 1;
      content = content.slice(0, lineStart) + screen.buttonJSX + '\n' + content.slice(lineStart);
    }
    console.log(`  ✅ ${screen.file} → ${screen.entityKey}`);
  }

  fs.writeFileSync(filePath, content, 'utf-8');
  successCount++;
}

console.log(`\n🎬 Done! ${successCount} modified, ${skipCount} skipped, ${failCount} failed`);
console.log(`\nImportButton wired into ${successCount} screens.`);
console.log('Test: Open any tool screen and look for the upload icon button in the header area.');
