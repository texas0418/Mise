#!/usr/bin/env node
/**
 * wire-notifications.mjs
 * Patches schedule and new-schedule-day screens to integrate push notifications.
 *
 * Run from MiseApp root:
 *   node wire-notifications.mjs
 */

import fs from 'fs';

// ─── Patch schedule/index.tsx ──────────────────────────────────

const scheduleFile = 'app/(tabs)/schedule/index.tsx';
if (fs.existsSync(scheduleFile)) {
  let content = fs.readFileSync(scheduleFile, 'utf-8');

  if (content.includes('NotificationSettings')) {
    console.log('  ✅ schedule/index.tsx — already patched');
  } else {
    // 1. Add imports
    const oldImport = "import AIImportButton from '@/components/AIImportButton';";
    const newImport = `import AIImportButton from '@/components/AIImportButton';
import NotificationSettings from '@/components/NotificationSettings';
import { rescheduleAll } from '@/utils/notifications';`;
    content = content.replace(oldImport, newImport);

    // 2. Add the NotificationSettings card above the FlatList in the schedule screen
    // Find the FlatList and add NotificationSettings as ListHeaderComponent
    const oldFlatList = `<FlatList
      data={schedule}
      keyExtractor={item => item.id}
      renderItem={({ item }) => (
        <ScheduleCard day={item} onDelete={() => handleDelete(item)} />
      )}
      contentContainerStyle={[
        styles.list,`;
    const newFlatList = `<FlatList
      data={schedule}
      keyExtractor={item => item.id}
      renderItem={({ item }) => (
        <ScheduleCard day={item} onDelete={() => handleDelete(item)} />
      )}
      ListHeaderComponent={
        <View style={{ marginBottom: 12 }}>
          <NotificationSettings onPrefsChanged={() => rescheduleAll(schedule, activeProject?.title)} />
        </View>
      }
      contentContainerStyle={[
        styles.list,`;
    content = content.replace(oldFlatList, newFlatList);

    fs.writeFileSync(scheduleFile, content, 'utf-8');
    console.log('  ✅ schedule/index.tsx — patched (NotificationSettings + rescheduleAll)');
  }
} else {
  console.log('  ⚠️  schedule/index.tsx — not found');
}

// ─── Patch new-schedule-day.tsx ────────────────────────────────

const newDayFile = 'app/new-schedule-day.tsx';
if (fs.existsSync(newDayFile)) {
  let content = fs.readFileSync(newDayFile, 'utf-8');

  if (content.includes('scheduleNotificationsForDay')) {
    console.log('  ✅ new-schedule-day.tsx — already patched');
  } else {
    // 1. Add import
    const colorsImport = "import Colors from '@/constants/colors';";
    const newColorsImport = `import Colors from '@/constants/colors';
import { scheduleNotificationsForDay } from '@/utils/notifications';`;
    content = content.replace(colorsImport, newColorsImport);

    // 2. Find the addScheduleDay call and add notification scheduling after it
    // Look for the pattern where addScheduleDay is called then router.back()
    const addDayPattern = /addScheduleDay\(([^)]+)\);?\s*\n(\s*)router\.back\(\)/;
    const match = content.match(addDayPattern);

    if (match) {
      const varName = match[1].trim();
      const indent = match[2];
      const replacement = `addScheduleDay(${varName});\n${indent}// Schedule push notifications for this day\n${indent}scheduleNotificationsForDay(${varName} as any, activeProject?.title).catch(() => {});\n${indent}router.back()`;
      content = content.replace(addDayPattern, replacement);
      console.log('  ✅ new-schedule-day.tsx — patched (auto-schedule notifications on create)');
    } else {
      // Fallback: try simpler pattern
      const simplePattern = 'router.back();';
      const firstIdx = content.lastIndexOf(simplePattern);
      if (firstIdx !== -1) {
        const before = content.slice(0, firstIdx);
        const after = content.slice(firstIdx);
        content = before + '// Schedule notifications for new day\n      // scheduleNotificationsForDay(newDay, activeProject?.title).catch(() => {});\n      ' + after;
        console.log('  ✅ new-schedule-day.tsx — patched (fallback, needs manual wiring)');
      } else {
        console.log('  ⚠️  new-schedule-day.tsx — could not find insertion point');
      }
    }

    fs.writeFileSync(newDayFile, content, 'utf-8');
  }
} else {
  console.log('  ⚠️  new-schedule-day.tsx — not found');
}

console.log('\n🔔 Notification wiring complete!');
console.log('\nDependency needed:');
console.log('  npx expo install expo-notifications');
