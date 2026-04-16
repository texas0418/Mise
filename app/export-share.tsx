import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Share } from 'react-native';
import { Stack } from 'expo-router';
import { Share2 as ShareIcon, FileText, Camera, CalendarDays, DollarSign, ClipboardList, AlertCircle, Download } from 'lucide-react-native';
import { useProjects, useProjectShots, useProjectSchedule, useProjectBudget, useProjectWrapReports } from '@/contexts/ProjectContext';
import Colors from '@/constants/colors';
import PermissionGate from '@/contexts/PermissionGate';

interface ExportOption {
  icon: React.ElementType;
  title: string;
  description: string;
  color: string;
  type: string;
}

const EXPORT_OPTIONS: ExportOption[] = [
  { icon: Camera, title: 'Shot List', description: 'All shots grouped by scene with status, lens, and movement', color: '#60A5FA', type: 'shot-list' },
  { icon: CalendarDays, title: 'Schedule', description: 'Shoot days with scenes, locations, and call times', color: '#4ADE80', type: 'schedule' },
  { icon: ClipboardList, title: 'Call Sheet', description: 'Daily crew call sheet with roles and times', color: '#FB923C', type: 'call-sheet' },
  { icon: FileText, title: 'Wrap Report', description: 'Daily wrap summary with stats and notes', color: '#A78BFA', type: 'wrap-report' },
  { icon: DollarSign, title: 'Budget Summary', description: 'Budget breakdown by category with actuals', color: '#FBBF24', type: 'budget-summary' },
];

function generateExportText(type: string, project: any, shots: any[], schedule: any[], budget: any[], wrapReports: any[]): string {
  const divider = '─'.repeat(40);
  let text = `${project.title}\n${divider}\n\n`;

  switch (type) {
    case 'shot-list': {
      text += `SHOT LIST\nGenerated: ${new Date().toLocaleDateString()}\n\n`;
      const grouped: Record<number, any[]> = {};
      shots.forEach(s => {
        if (!grouped[s.sceneNumber]) grouped[s.sceneNumber] = [];
        grouped[s.sceneNumber].push(s);
      });
      Object.entries(grouped).sort(([a], [b]) => Number(a) - Number(b)).forEach(([scene, ss]) => {
        text += `SCENE ${scene}\n`;
        ss.forEach(s => {
          text += `  ${s.shotNumber} | ${s.type} | ${s.movement} | ${s.lens} | ${s.status.toUpperCase()}\n    ${s.description}\n${s.notes ? `    Note: ${s.notes}\n` : ''}\n`;
        });
      });
      text += `\nTotal: ${shots.length} shots | Approved: ${shots.filter(s => s.status === 'approved').length} | Remaining: ${shots.filter(s => s.status !== 'approved').length}`;
      break;
    }
    case 'schedule': {
      text += `SHOOTING SCHEDULE\n\n`;
      schedule.forEach(d => {
        text += `DAY ${d.dayNumber} — ${d.date}\nLocation: ${d.location}\nScenes: ${d.scenes}\nCall: ${d.callTime} | Wrap: ${d.wrapTime}\n${d.notes ? `Notes: ${d.notes}\n` : ''}${divider}\n\n`;
      });
      break;
    }
    case 'budget-summary': {
      text += `BUDGET SUMMARY\n\n`;
      const totalEst = budget.reduce((s, b) => s + b.estimated, 0);
      const totalAct = budget.reduce((s, b) => s + b.actual, 0);
      const cats: Record<string, { est: number; act: number }> = {};
      budget.forEach(b => {
        if (!cats[b.category]) cats[b.category] = { est: 0, act: 0 };
        cats[b.category].est += b.estimated;
        cats[b.category].act += b.actual;
      });
      Object.entries(cats).forEach(([cat, vals]) => {
        text += `${cat.toUpperCase().replace('-', ' ')}\n  Estimated: $${vals.est.toLocaleString()} | Actual: $${vals.act.toLocaleString()} | Variance: $${(vals.est - vals.act).toLocaleString()}\n\n`;
      });
      text += `${divider}\nTOTAL Estimated: $${totalEst.toLocaleString()} | Actual: $${totalAct.toLocaleString()} | Remaining: $${(totalEst - totalAct).toLocaleString()}`;
      break;
    }
    case 'wrap-report': {
      text += `WRAP REPORTS\n\n`;
      wrapReports.forEach(r => {
        text += `DAY ${r.dayNumber} — ${r.date}\nCall: ${r.callTime} | Wrap: ${r.actualWrap}${r.overtimeMinutes > 0 ? ` | OT: ${(r.overtimeMinutes / 60).toFixed(1)}h` : ''}\nShots: ${r.shotsCompleted}/${r.shotsPlanned} | Takes: ${r.totalTakes} | Circled: ${r.circledTakes}\nScenes completed: ${r.scenesCompleted}\n${r.notes ? `Notes: ${r.notes}\n` : ''}${divider}\n\n`;
      });
      break;
    }
    case 'call-sheet': {
      text += `CALL SHEET\n\n`;
      if (schedule.length > 0) {
        const day = schedule[0];
        text += `Day ${day.dayNumber} — ${day.date}\nLocation: ${day.location}\nCall: ${day.callTime} | Wrap: ${day.wrapTime}\nScenes: ${day.scenes}\n`;
      } else {
        text += 'No schedule data available.\n';
      }
      break;
    }
    default:
      text += 'Export type not supported.';
  }

  return text;
}

export default function ExportShareScreen() {
  const { activeProject, activeProjectId } = useProjects();
  const shots = useProjectShots(activeProjectId);
  const schedule = useProjectSchedule(activeProjectId);
  const budget = useProjectBudget(activeProjectId);
  const wrapReports = useProjectWrapReports(activeProjectId);

  if (!activeProject) {
    return (
      <View style={styles.empty}>
        <AlertCircle color={Colors.text.tertiary} size={48} />
        <Text style={styles.emptyTitle}>No project selected</Text>
      </View>
    );
  }

  const handleExport = async (type: string) => {
    const text = generateExportText(type, activeProject, shots, schedule, budget, wrapReports);
    try {
      await Share.share({
        message: text,
        title: `${activeProject.title} - ${type.replace(/-/g, ' ')}`,
      });
    } catch (e) {
      Alert.alert('Share Error', 'Could not open the share sheet. Please try again.');
    }
  };

  return (
    <PermissionGate resource="export">
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Stack.Screen options={{ title: 'Export & Share' }} />

      <Text style={styles.headerTitle}>Share Project Data</Text>
      <Text style={styles.headerSub}>Generate and share formatted reports for {activeProject.title}</Text>

      {EXPORT_OPTIONS.map(opt => {
        const Icon = opt.icon;
        return (
          <TouchableOpacity key={opt.type} style={styles.card} onPress={() => handleExport(opt.type)} activeOpacity={0.7}>
            <View style={[styles.iconWrap, { backgroundColor: opt.color + '18' }]}>
              <Icon color={opt.color} size={24} />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{opt.title}</Text>
              <Text style={styles.cardDesc}>{opt.description}</Text>
            </View>
            <ShareIcon color={Colors.text.tertiary} size={18} />
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  </PermissionGate>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  content: { padding: 16, paddingBottom: 40 },
  headerTitle: { fontSize: 20, fontWeight: '700' as const, color: Colors.text.primary, marginBottom: 4 },
  headerSub: { fontSize: 13, color: Colors.text.secondary, marginBottom: 20 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg.card, borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 0.5, borderColor: Colors.border.subtle, gap: 14 },
  iconWrap: { width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700' as const, color: Colors.text.primary },
  cardDesc: { fontSize: 12, color: Colors.text.tertiary, marginTop: 2 },
  empty: { flex: 1, backgroundColor: Colors.bg.primary, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600' as const, color: Colors.text.primary, marginTop: 16 },
});
