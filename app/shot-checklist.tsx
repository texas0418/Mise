import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, SectionList, TouchableOpacity, Alert } from 'react-native';
import { Camera, Check, CheckCheck, Circle, CircleDot, RotateCcw, ChevronDown, ChevronUp, Plus } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useProjects, useProjectShots } from '@/contexts/ProjectContext';
import { useLayout } from '@/utils/useLayout';
import Colors from '@/constants/colors';
import { Shot, ShotStatus } from '@/types';
import PermissionGate from '@/contexts/PermissionGate';

const STATUS_FLOW: ShotStatus[] = ['planned', 'ready', 'shot', 'approved'];
const STATUS_CONFIG: Record<ShotStatus, { label: string; color: string; icon: React.ElementType }> = {
  'planned': { label: 'Planned', color: Colors.text.tertiary, icon: Circle },
  'ready': { label: 'Ready', color: '#60A5FA', icon: CircleDot },
  'shot': { label: 'Shot', color: '#FBBF24', icon: Check },
  'approved': { label: 'Approved', color: '#4ADE80', icon: CheckCheck },
};

function ShotRow({ shot, onCycleStatus }: { shot: Shot; onCycleStatus: () => void }) {
  const status = STATUS_CONFIG[shot.status];
  const StatusIcon = status.icon;
  const isDone = shot.status === 'shot' || shot.status === 'approved';

  return (
    <TouchableOpacity
      style={[styles.shotRow, isDone && styles.shotRowDone]}
      onPress={onCycleStatus}
      activeOpacity={0.6}
    >
      <View style={[styles.statusCircle, { borderColor: status.color }]}>
        <StatusIcon color={status.color} size={16} />
      </View>
      <View style={styles.shotInfo}>
        <View style={styles.shotTopRow}>
          <Text style={[styles.shotNumber, isDone && styles.shotNumberDone]}>
            {shot.sceneNumber}.{shot.shotNumber}
          </Text>
          <Text style={[styles.shotType, { color: status.color }]}>{shot.type}</Text>
          <Text style={styles.shotLens}>{shot.lens}</Text>
        </View>
        <Text style={[styles.shotDesc, isDone && styles.shotDescDone]} numberOfLines={2}>
          {shot.description}
        </Text>
        {shot.movement !== 'static' && (
          <Text style={styles.shotMovement}>{shot.movement}</Text>
        )}
      </View>
      <View style={[styles.statusTag, { backgroundColor: status.color + '18', borderColor: status.color + '44' }]}>
        <Text style={[styles.statusTagText, { color: status.color }]}>{status.label}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function ShotChecklistScreen() {
  const { activeProjectId, updateShot } = useProjects();
  const shots = useProjectShots(activeProjectId);
  const { isTablet, contentPadding } = useLayout();
  const router = useRouter();
  const [collapsedScenes, setCollapsedScenes] = useState<Set<number>>(new Set());

  const cycleStatus = useCallback((shot: Shot) => {
    const currentIndex = STATUS_FLOW.indexOf(shot.status);
    const nextIndex = (currentIndex + 1) % STATUS_FLOW.length;
    updateShot({ ...shot, status: STATUS_FLOW[nextIndex] });
  }, [updateShot]);

  const resetAll = useCallback(() => {
    Alert.alert('Reset All Shots', 'Mark all shots as "Planned"?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset', style: 'destructive', onPress: () => {
          shots.forEach(shot => {
            if (shot.status !== 'planned') {
              updateShot({ ...shot, status: 'planned' });
            }
          });
        },
      },
    ]);
  }, [shots, updateShot]);

  const toggleScene = useCallback((sceneNumber: number) => {
    setCollapsedScenes(prev => {
      const next = new Set(prev);
      if (next.has(sceneNumber)) next.delete(sceneNumber);
      else next.add(sceneNumber);
      return next;
    });
  }, []);

  const sections = useMemo(() => {
    const sceneMap = new Map<number, Shot[]>();
    shots.forEach(shot => {
      const list = sceneMap.get(shot.sceneNumber) || [];
      list.push(shot);
      sceneMap.set(shot.sceneNumber, list);
    });
    return Array.from(sceneMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([sceneNumber, scenShots]) => ({
        sceneNumber,
        data: collapsedScenes.has(sceneNumber) ? [] : scenShots,
        allShots: scenShots,
      }));
  }, [shots, collapsedScenes]);

  const totalShots = shots.length;
  const shotCount = shots.filter(s => s.status === 'shot' || s.status === 'approved').length;
  const approvedCount = shots.filter(s => s.status === 'approved').length;
  const readyCount = shots.filter(s => s.status === 'ready').length;
  const progressPct = totalShots > 0 ? Math.round((shotCount / totalShots) * 100) : 0;

  return (
    <PermissionGate resource="shot_checklist">
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <ShotRow shot={item} onCycleStatus={() => cycleStatus(item)} />
        )}
        renderSectionHeader={({ section }) => {
          const s = section as typeof sections[0];
          const sceneDone = s.allShots.filter(sh => sh.status === 'shot' || sh.status === 'approved').length;
          const sceneTotal = s.allShots.length;
          const isCollapsed = collapsedScenes.has(s.sceneNumber);
          const allDone = sceneDone === sceneTotal;
          return (
            <TouchableOpacity
              style={[styles.sceneHeader, allDone && styles.sceneHeaderDone]}
              onPress={() => toggleScene(s.sceneNumber)}
              activeOpacity={0.7}
            >
              <View style={styles.sceneHeaderLeft}>
                <Text style={[styles.sceneTitle, allDone && styles.sceneTitleDone]}>
                  Scene {s.sceneNumber}
                </Text>
                <View style={styles.sceneProgress}>
                  <View style={styles.sceneProgressTrack}>
                    <View style={[styles.sceneProgressFill, { width: `${sceneTotal > 0 ? (sceneDone / sceneTotal) * 100 : 0}%` }]} />
                  </View>
                  <Text style={styles.sceneProgressText}>{sceneDone}/{sceneTotal}</Text>
                </View>
              </View>
              {isCollapsed ? <ChevronDown color={Colors.text.tertiary} size={16} /> : <ChevronUp color={Colors.text.tertiary} size={16} />}
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={[styles.list, {
          paddingHorizontal: contentPadding,
          maxWidth: isTablet ? 800 : undefined,
          alignSelf: isTablet ? 'center' as const : undefined,
          width: isTablet ? '100%' : undefined,
        }]}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <View>
            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressTitle}>Daily Progress</Text>
                <TouchableOpacity onPress={resetAll} style={styles.resetBtn}>
                  <RotateCcw color={Colors.text.tertiary} size={14} />
                  <Text style={styles.resetText}>Reset</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.bigProgressTrack}>
                <View style={[styles.bigProgressFill, { width: `${progressPct}%` }]} />
              </View>
              <Text style={styles.bigProgressPct}>{progressPct}%</Text>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <View style={[styles.statDot, { backgroundColor: Colors.text.tertiary }]} />
                  <Text style={styles.statText}>Planned: {totalShots - shotCount - readyCount}</Text>
                </View>
                <View style={styles.statItem}>
                  <View style={[styles.statDot, { backgroundColor: '#60A5FA' }]} />
                  <Text style={styles.statText}>Ready: {readyCount}</Text>
                </View>
                <View style={styles.statItem}>
                  <View style={[styles.statDot, { backgroundColor: '#FBBF24' }]} />
                  <Text style={styles.statText}>Shot: {shotCount - approvedCount}</Text>
                </View>
                <View style={styles.statItem}>
                  <View style={[styles.statDot, { backgroundColor: '#4ADE80' }]} />
                  <Text style={styles.statText}>Approved: {approvedCount}</Text>
                </View>
              </View>
            </View>
            <Text style={styles.instruction}>Tap a shot to cycle: Planned → Ready → Shot → Approved</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Camera color={Colors.text.tertiary} size={48} />
            <Text style={styles.emptyTitle}>No shots yet</Text>
            <Text style={styles.emptySubtitle}>Tap + to add your first shot</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/new-shot' as never)}
        activeOpacity={0.8}
      >
        <Plus color={Colors.text.inverse} size={24} />
      </TouchableOpacity>
    </View>
  </PermissionGate>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  list: { padding: 16, paddingBottom: 100 },
  progressCard: { backgroundColor: Colors.bg.card, borderRadius: 14, padding: 18, marginBottom: 16, borderWidth: 0.5, borderColor: Colors.border.subtle },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  progressTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.text.primary },
  resetBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: Colors.bg.tertiary },
  resetText: { fontSize: 11, color: Colors.text.tertiary, fontWeight: '600' as const },
  bigProgressTrack: { height: 10, backgroundColor: Colors.bg.tertiary, borderRadius: 5, overflow: 'hidden', marginBottom: 6 },
  bigProgressFill: { height: '100%', backgroundColor: Colors.accent.gold, borderRadius: 5 },
  bigProgressPct: { fontSize: 28, fontWeight: '800' as const, color: Colors.accent.gold, textAlign: 'center', marginBottom: 12 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statDot: { width: 8, height: 8, borderRadius: 4 },
  statText: { fontSize: 11, color: Colors.text.secondary, fontWeight: '500' as const },
  instruction: { fontSize: 11, color: Colors.text.tertiary, textAlign: 'center', marginBottom: 16, fontStyle: 'italic' as const },
  sceneHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.bg.secondary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginTop: 12, marginBottom: 6, borderWidth: 0.5, borderColor: Colors.border.subtle },
  sceneHeaderDone: { borderColor: '#4ADE8033' },
  sceneHeaderLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  sceneTitle: { fontSize: 14, fontWeight: '700' as const, color: Colors.text.primary },
  sceneTitleDone: { color: '#4ADE80' },
  sceneProgress: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  sceneProgressTrack: { flex: 1, height: 4, backgroundColor: Colors.bg.tertiary, borderRadius: 2, overflow: 'hidden', maxWidth: 120 },
  sceneProgressFill: { height: '100%', backgroundColor: Colors.accent.gold, borderRadius: 2 },
  sceneProgressText: { fontSize: 11, color: Colors.text.tertiary, fontWeight: '600' as const, minWidth: 30 },
  shotRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg.card, borderRadius: 10, padding: 12, marginBottom: 6, borderWidth: 0.5, borderColor: Colors.border.subtle, gap: 10 },
  shotRowDone: { opacity: 0.7 },
  statusCircle: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  shotInfo: { flex: 1 },
  shotTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  shotNumber: { fontSize: 14, fontWeight: '700' as const, color: Colors.text.primary },
  shotNumberDone: { textDecorationLine: 'line-through', color: Colors.text.tertiary },
  shotType: { fontSize: 11, fontWeight: '600' as const, textTransform: 'uppercase' as const },
  shotLens: { fontSize: 11, color: Colors.text.tertiary },
  shotDesc: { fontSize: 12, color: Colors.text.secondary, lineHeight: 17 },
  shotDescDone: { color: Colors.text.tertiary },
  shotMovement: { fontSize: 10, color: Colors.accent.goldDim, fontWeight: '500' as const, marginTop: 2, textTransform: 'uppercase' as const },
  statusTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 0.5 },
  statusTagText: { fontSize: 9, fontWeight: '700' as const, letterSpacing: 0.5 },
  emptyContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600' as const, color: Colors.text.primary, marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: Colors.text.secondary, marginTop: 4 },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.accent.gold, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.accent.gold, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
});
