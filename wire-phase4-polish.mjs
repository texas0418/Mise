#!/usr/bin/env node
/**
 * wire-phase4-polish.mjs
 * Phase 4, Items 14-15: Add CSV templates & import history/undo
 *
 * Run from MiseApp root:
 *   node wire-phase4-polish.mjs
 *
 * This script patches:
 * 1. app/import-data.tsx — adds template download button + records import history
 * 2. app/ai-import.tsx — records import history
 */

import fs from 'fs';

// ─── Patch import-data.tsx ─────────────────────────────────────────

const importDataFile = 'app/import-data.tsx';
if (fs.existsSync(importDataFile)) {
  let content = fs.readFileSync(importDataFile, 'utf-8');

  if (content.includes('csvTemplates') || content.includes('importHistory')) {
    console.log('  ✅ import-data.tsx — already patched');
  } else {
    // 1. Add imports for csvTemplates and importHistory
    const oldImport = "import { getEntityConfig, EntityConfig } from '@/utils/importRegistry';";
    const newImport = `import { getEntityConfig, EntityConfig } from '@/utils/importRegistry';
import { shareCSVTemplate } from '@/utils/csvTemplates';
import { recordImport } from '@/utils/importHistory';`;
    content = content.replace(oldImport, newImport);

    // 2. Add Download icon to lucide imports
    const oldLucide = "Upload, FileSpreadsheet, ArrowRight, ArrowLeft, Check, X,";
    const newLucide = "Upload, FileSpreadsheet, ArrowRight, ArrowLeft, Check, X, Download,";
    content = content.replace(oldLucide, newLucide);

    // 3. Record import after successful bulk add — find the success Alert
    const oldAlert = `Alert.alert(
        'Import Complete',
        \`Successfully imported \${convertedRows.length} \${entityConfig.label.toLowerCase()}.\`,
        [{ text: 'Done', onPress: () => router.back() }]
      );`;
    const newAlert = `// Record import for undo
      const importedIds = itemsWithMeta
        ? itemsWithMeta.map((item: Record<string, unknown>) => item.id as string)
        : convertedRows.map((_, i) => \`import-\${Date.now()}-\${i}\`);
      await recordImport({
        entityKey: entityConfig.key,
        entityLabel: entityConfig.label,
        itemIds: importedIds,
        count: convertedRows.length,
        method: 'spreadsheet',
        fileName: parsedData?.fileName,
      });

      Alert.alert(
        'Import Complete',
        \`Successfully imported \${convertedRows.length} \${entityConfig.label.toLowerCase()}.\`,
        [{ text: 'Done', onPress: () => router.back() }]
      );`;
    content = content.replace(oldAlert, newAlert);

    // 4. Track itemsWithMeta outside the if/else so the history recorder can access it
    const oldBulkCheck = `// Check for addBulk first, fall back to individual adds
      const bulkAddFn`;
    const newBulkCheck = `let itemsWithMeta: Record<string, unknown>[] | null = null;

      // Check for addBulk first, fall back to individual adds
      const bulkAddFn`;
    content = content.replace(oldBulkCheck, newBulkCheck);

    // Fix the itemsWithMeta reference in bulk add
    const oldBulkItems = `const itemsWithMeta = convertedRows.map((row, i) => ({`;
    const newBulkItems = `itemsWithMeta = convertedRows.map((row, i) => ({`;
    content = content.replace(oldBulkItems, newBulkItems);

    // 5. Add template download button in PickStep — find the formatsRow and add after it
    const oldFormatsRow = `{/* Supported formats */}
        <View style={styles.formatsRow}>
          {['CSV', 'TSV', 'XLSX', 'XLS'].map(fmt => (
            <View key={fmt} style={styles.formatBadge}>
              <Text style={styles.formatBadgeText}>.{fmt.toLowerCase()}</Text>
            </View>
          ))}
        </View>`;
    const newFormatsRow = `{/* Supported formats */}
        <View style={styles.formatsRow}>
          {['CSV', 'TSV', 'XLSX', 'XLS'].map(fmt => (
            <View key={fmt} style={styles.formatBadge}>
              <Text style={styles.formatBadgeText}>.{fmt.toLowerCase()}</Text>
            </View>
          ))}
        </View>

        {/* Download template */}
        <TouchableOpacity
          style={styles.templateBtn}
          onPress={() => shareCSVTemplate(entityConfig.key).catch(e =>
            Alert.alert('Error', e instanceof Error ? e.message : 'Could not share template')
          )}
          activeOpacity={0.7}
        >
          <Download color={Colors.accent.gold} size={14} />
          <Text style={styles.templateBtnText}>Download CSV Template</Text>
        </TouchableOpacity>`;
    content = content.replace(oldFormatsRow, newFormatsRow);

    // 6. Add template button style
    const oldFab = `formatBadgeText: { fontSize: 11, fontWeight: '600' as const, color: Colors.text.tertiary },`;
    const newFab = `formatBadgeText: { fontSize: 11, fontWeight: '600' as const, color: Colors.text.tertiary },
  templateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8,
    backgroundColor: Colors.bg.card, borderWidth: 0.5, borderColor: Colors.accent.gold + '33',
    marginTop: 4,
  },
  templateBtnText: { fontSize: 12, fontWeight: '600' as const, color: Colors.accent.gold },`;
    content = content.replace(oldFab, newFab);

    fs.writeFileSync(importDataFile, content, 'utf-8');
    console.log('  ✅ import-data.tsx — patched (template download + import history)');
  }
} else {
  console.log('  ⚠️  import-data.tsx — not found');
}

// ─── Patch ai-import.tsx ───────────────────────────────────────────

const aiImportFile = 'app/ai-import.tsx';
if (fs.existsSync(aiImportFile)) {
  let content = fs.readFileSync(aiImportFile, 'utf-8');

  if (content.includes('importHistory') || content.includes('recordImport')) {
    console.log('  ✅ ai-import.tsx — already patched');
  } else {
    // 1. Add import for importHistory
    const oldImport = "import { sendCompletion, getApiKey, saveApiKey, hasApiKey } from '@/utils/anthropicClient';";
    const newImport = `import { sendCompletion, getApiKey, saveApiKey, hasApiKey } from '@/utils/anthropicClient';
import { recordImport } from '@/utils/importHistory';`;
    content = content.replace(oldImport, newImport);

    // 2. Record import after successful AI import — find the success Alert in handleConfirmImport
    const oldAIAlert = `Alert.alert(
        'Import Complete',
        \`Successfully imported \${parsedRows.length} \${entityConfig.label.toLowerCase()}.\`,
        [{ text: 'Done', onPress: () => router.back() }]
      );`;
    const newAIAlert = `// Record import for undo
      await recordImport({
        entityKey: entityConfig.key,
        entityLabel: entityConfig.label,
        itemIds: itemsWithMeta.map(item => item.id as string),
        count: parsedRows.length,
        method: 'ai',
      });

      Alert.alert(
        'Import Complete',
        \`Successfully imported \${parsedRows.length} \${entityConfig.label.toLowerCase()}.\`,
        [{ text: 'Done', onPress: () => router.back() }]
      );`;
    content = content.replace(oldAIAlert, newAIAlert);

    fs.writeFileSync(aiImportFile, content, 'utf-8');
    console.log('  ✅ ai-import.tsx — patched (import history recording)');
  }
} else {
  console.log('  ⚠️  ai-import.tsx — not found');
}

console.log('\n🎬 Phase 4 patching complete!');
console.log('New files to add:');
console.log('  • utils/csvTemplates.ts');
console.log('  • utils/importHistory.ts');
console.log('\nDependency needed:');
console.log('  npx expo install expo-sharing');
