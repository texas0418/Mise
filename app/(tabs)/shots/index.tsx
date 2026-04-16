import React, { useMemo, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SectionList, Alert, Animated as RNAnimated } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, Camera, Check, Clock, Eye, AlertCircle, Trash2, ChevronDown, ChevronUp, Pencil } from 'lucide-react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useProjects, useProjectShots } from '@/contexts/ProjectContext';
import { useLayout } from '@/utils/useLayout';
import Colors from '@/constants/colors';
import ImportButton from '@/components/ImportButton';
import AIImportButton from '@/components/AIImportButton';
import { Shot, ShotStatus } from '@/types';
import PermissionGate from '@/contexts/PermissionGate';

const STATUS_CONFIG: Record<ShotStatus, { icon: React.ElementType; color: string; label: string }> = {
  planned: { icon: Clock, color: Colors.text.tertiary, label: 'Planned' },
  ready: { icon: Eye, color: Colors.status.info, label: 'Ready' },
  shot: { icon: Camera, color: Colors.status.warning, label: 'Shot' },
  approved: { icon: Check, color: Colors.status.active, label: 'Approved' },
};

function ShotCard({ shot, onEdit, onDelete }: { shot: Shot; onEdit: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const swipeableRef = useRef<Swipeable>(null);
  const config = STATUS_CONFIG[shot.status];
  const StatusIcon = config.icon;

  const handleDelete = () => {
    Alert.alert(
      'Delete Shot',
      `Delete shot ${shot.shotNumber} from Scene ${shot.sceneNumber}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
      ]
    );
  };

  const renderRightActions = () => (
    <TouchableOpacity
      style={styles.deleteAction}
      onPress={() => {
        swipeableRef.current?.close();
        handleDelete();
      }}
      activeOpacity={0.7}
    >
      <Trash2 color="#fff" size={18} />
      <Text style={styles.deleteActionText}>Delete</Text>
    </TouchableOpacity>
  );

  return (
    <Swipeable ref={swipeableRef} renderRightActions={renderRightActions} overshootRight={false}>
      <TouchableOpacity
        style={[styles.shotCard, expanded && styles.shotCardExpanded]}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
        testID={`shot-card-${shot.id}`}
      >
        <View style={styles.shotMainRow}>
          <View style={styles.shotLeft}>
            <View style={[styles.shotNumberBadge, { borderColor: config.color + '55' }]}>
              <Text style={styles.shotNumber}>{shot.shotNumber}</Text>
            </View>
          </View>
          <View style={styles.shotCenter}>
            <Text style={styles.shotDescription} numberOfLines={expanded ? undefined : 2}>{shot.description}</Text>
            <View style={styles.shotMeta}>
              <View style={styles.shotTag}><Text style={styles.shotTagText}>{shot.type}</Text></View>
              <View style={styles.shotTag}><Text style={styles.shotTagText}>{shot.movement}</Text></View>
              <View style={styles.shotTag}><Text style={styles.shotTagText}>{shot.lens}</Text></View>
            </View>
          </View>
          <View style={styles.shotRight}>
            <View style={[styles.statusIcon, { backgroundColor: config.color + '18' }]}>
              <StatusIcon color={config.color} size={14} />
            </View>
            {expanded ? (
              <ChevronUp color={Colors.text.tertiary} size={14} style={{ marginTop: 6 }} />
            ) : (
              <ChevronDown color={Colors.text.tertiary} size={14} style={{ marginTop: 6 }} />
            )}
          </View>
        </View>

        {expanded && (
          <View style={styles.expandedContent}>
            <View style={styles.divider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Status</Text>
              <View style={[styles.statusPill, { backgroundColor: config.color + '22' }]}>
                <View style={[styles.statusDotSmall, { backgroundColor: config.color }]} />
                <Text style={[styles.statusPillText, { color: config.color }]}>{config.label}</Text>
              </View>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Scene</Text>
              <Text style={styles.detailValue}>Scene {shot.sceneNumber}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Type</Text>
              <Text style={styles.detailValue}>{shot.type}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Movement</Text>
              <Text style={styles.detailValue}>{shot.movement}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Lens</Text>
              <Text style={styles.detailValue}>{shot.lens}</Text>
            </View>
            {shot.notes ? (
              <View style={styles.notesSection}>
                <Text style={styles.detailLabel}>Notes</Text>
                <Text style={styles.notesText}>{shot.notes}</Text>
              </View>
            ) : null}

            {/* Edit / Delete actions */}
            <View style={styles.actionRow}>
              <TouchableOpacity onPress={onEdit} style={styles.editBtn}>
                <Pencil color={Colors.accent.gold} size={15} />
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleDelete} style={styles.deleteBtnAction}>
                <Trash2 color={Colors.status.error} size={15} />
                <Text style={styles.deleteBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </TouchableOpacity>
    </Swipeable>
  );
}

export default function ShotsScreen() {
  const { activeProject, activeProjectId, deleteShot } = useProjects();
  const shots = useProjectShots(activeProjectId);
  const router = useRouter();
  const { isTablet, contentPadding } = useLayout();

  const sections = useMemo(() => {
    const grouped: Record<number, Shot[]> = {};
    shots.forEach(shot => {
      if (!grouped[shot.sceneNumber]) grouped[shot.sceneNumber] = [];
      grouped[shot.sceneNumber].push(shot);
    });
    return Object.entries(grouped)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([scene, data]) => ({ title: `Scene ${scene}`, data }));
  }, [shots]);

  const stats = useMemo(() => ({
    total: shots.length,
    approved: shots.filter(s => s.status === 'approved').length,
    shot: shots.filter(s => s.status === 'shot').length,
    planned: shots.filter(s => s.status === 'planned' || s.status === 'ready').length,
  }), [shots]);

  if (!activeProject) {
    return (
      <View style={styles.emptyContainer}>
        <AlertCircle color={Colors.text.tertiary} size={48} />
        <Text style={styles.emptyTitle}>No project selected</Text>
        <Text style={styles.emptySubtitle}>Select a project from the Projects tab</Text>
      </View>
    );
  }

  return (
    <PermissionGate resource="shots">
    <View style={styles.container}>
      <View style={{ position: 'absolute', top: 14, right: 20, zIndex: 10 }}><ImportButton entityKey="shots" variant="compact" />
        <AIImportButton entityKey="shots" variant="compact" /></View>
      <View style={styles.statsRow}>
        <View style={styles.statItem}><Text style={styles.statValue}>{stats.total}</Text><Text style={styles.statLabel}>Total</Text></View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}><Text style={[styles.statValue, { color: Colors.status.active }]}>{stats.approved}</Text><Text style={styles.statLabel}>Approved</Text></View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}><Text style={[styles.statValue, { color: Colors.status.warning }]}>{stats.shot}</Text><Text style={styles.statLabel}>Shot</Text></View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}><Text style={[styles.statValue, { color: Colors.text.tertiary }]}>{stats.planned}</Text><Text style={styles.statLabel}>Remaining</Text></View>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <ShotCard
            shot={item}
            onEdit={() => router.push(`/new-shot?id=${item.id}` as never)}
            onDelete={() => deleteShot(item.id)}
          />
        )}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionCount}>{section.data.length} shot{section.data.length !== 1 ? 's' : ''}</Text>
          </View>
        )}
        contentContainerStyle={[styles.list, {
          paddingHorizontal: contentPadding,
          maxWidth: isTablet ? 800 : undefined,
          alignSelf: isTablet ? 'center' as const : undefined,
          width: isTablet ? '100%' : undefined,
        }]}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          <View style={styles.emptyInner}>
            <Camera color={Colors.text.tertiary} size={48} />
            <Text style={styles.emptyTitle}>No shots yet</Text>
            <Text style={styles.emptySubtitle}>Build your shot list for {activeProject.title}</Text>
          </View>
        }
      />
      <TouchableOpacity style={styles.fab} onPress={() => router.push('/new-shot' as never)} activeOpacity={0.8} testID="add-shot-button">
        <Plus color={Colors.text.inverse} size={24} />
      </TouchableOpacity>
    </View>
  </PermissionGate>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  statsRow: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 14, backgroundColor: Colors.bg.secondary, borderBottomWidth: 0.5, borderBottomColor: Colors.border.subtle, alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '700' as const, color: Colors.text.primary },
  statLabel: { fontSize: 10, color: Colors.text.tertiary, marginTop: 2, fontWeight: '500' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  statDivider: { width: 1, height: 28, backgroundColor: Colors.border.subtle },
  list: { padding: 20, paddingBottom: 100 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700' as const, color: Colors.accent.gold, letterSpacing: 0.3 },
  sectionCount: { fontSize: 12, color: Colors.text.tertiary },
  shotCard: { backgroundColor: Colors.bg.card, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 0.5, borderColor: Colors.border.subtle },
  shotCardExpanded: { borderColor: Colors.accent.gold + '44', borderWidth: 1 },
  shotMainRow: { flexDirection: 'row' },
  shotLeft: { marginRight: 12 },
  shotNumberBadge: { width: 40, height: 40, borderRadius: 8, backgroundColor: Colors.bg.elevated, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  shotNumber: { fontSize: 13, fontWeight: '700' as const, color: Colors.text.primary, fontVariant: ['tabular-nums'] },
  shotCenter: { flex: 1 },
  shotDescription: { fontSize: 14, color: Colors.text.primary, lineHeight: 20, marginBottom: 8 },
  shotMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  shotTag: { backgroundColor: Colors.bg.elevated, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  shotTagText: { fontSize: 10, color: Colors.text.secondary, fontWeight: '600' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  shotRight: { alignItems: 'center', marginLeft: 8 },
  statusIcon: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  expandedContent: { marginTop: 12 },
  divider: { height: 0.5, backgroundColor: Colors.border.subtle, marginBottom: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  detailLabel: { fontSize: 12, color: Colors.text.tertiary, fontWeight: '600' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  detailValue: { fontSize: 13, color: Colors.text.primary, fontWeight: '500' as const, textTransform: 'capitalize' as const },
  statusPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 5 },
  statusDotSmall: { width: 5, height: 5, borderRadius: 2.5 },
  statusPillText: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.3 },
  notesSection: { marginTop: 8, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: Colors.border.subtle },
  notesText: { fontSize: 13, color: Colors.text.secondary, lineHeight: 19, marginTop: 4, fontStyle: 'italic' as const },
  // Edit / Delete actions
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 12, marginTop: 8, borderTopWidth: 0.5, borderTopColor: Colors.border.subtle },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.accent.goldBg, borderWidth: 0.5, borderColor: Colors.accent.gold + '44' },
  editBtnText: { fontSize: 12, fontWeight: '600' as const, color: Colors.accent.gold },
  deleteBtnAction: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.status.error + '12', borderWidth: 0.5, borderColor: Colors.status.error + '44' },
  deleteBtnText: { fontSize: 12, fontWeight: '600' as const, color: Colors.status.error },
  // Swipe delete
  deleteAction: { backgroundColor: Colors.status.error, justifyContent: 'center', alignItems: 'center', width: 72, borderRadius: 12, marginBottom: 8, marginLeft: 8 },
  deleteActionText: { color: '#fff', fontSize: 10, fontWeight: '600' as const, marginTop: 3 },
  // Empty states
  emptyContainer: { flex: 1, backgroundColor: Colors.bg.primary, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyInner: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600' as const, color: Colors.text.primary, marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: Colors.text.secondary, marginTop: 4, textAlign: 'center' },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.accent.gold, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.accent.gold, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
});
