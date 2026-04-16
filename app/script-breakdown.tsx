import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Plus, FileText, MapPin, Clock, Users, Package, AlertCircle, ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react-native';
import { useProjects, useProjectBreakdowns } from '@/contexts/ProjectContext';
import { useLayout } from '@/utils/useLayout';
import Colors from '@/constants/colors';
import ImportButton from '@/components/ImportButton';
import AIImportButton from '@/components/AIImportButton';
import { SceneBreakdown } from '@/types';
import PermissionGate from '@/contexts/PermissionGate';

const TIME_COLORS: Record<string, string> = {
  'day': '#FBBF24',
  'night': '#60A5FA',
  'dawn': '#FB923C',
  'dusk': '#E879F9',
  'magic-hour': '#F472B6',
};

function BreakdownCard({ item, isExpanded, onPress, onEdit, onDelete }: {
  item: SceneBreakdown;
  isExpanded: boolean;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const timeColor = TIME_COLORS[item.timeOfDay] ?? Colors.text.tertiary;

  const handleDelete = () => {
    Alert.alert('Delete Breakdown', `Remove Sc. ${item.sceneNumber} breakdown?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);
  };

  return (
    <TouchableOpacity
      style={[styles.card, isExpanded && styles.cardExpanded]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.cardHeader}>
        <View style={styles.sceneNum}>
          <Text style={styles.sceneNumText}>{item.sceneNumber}</Text>
        </View>
        <View style={styles.cardHeaderText}>
          <Text style={styles.sceneName}>{item.sceneName}</Text>
          <View style={styles.tagRow}>
            <View style={[styles.tag, { backgroundColor: timeColor + '18' }]}>
              <Text style={[styles.tagText, { color: timeColor }]}>{item.intExt}</Text>
            </View>
            <View style={[styles.tag, { backgroundColor: timeColor + '18' }]}>
              <Text style={[styles.tagText, { color: timeColor }]}>{item.timeOfDay.toUpperCase()}</Text>
            </View>
            <View style={styles.tag}>
              <Text style={styles.tagText}>{item.pageCount} pg</Text>
            </View>
          </View>
        </View>
        {isExpanded ? (
          <ChevronUp color={Colors.text.tertiary} size={18} />
        ) : (
          <ChevronDown color={Colors.text.tertiary} size={18} />
        )}
      </View>

      {/* Collapsed summary */}
      {!isExpanded && (
        <View style={styles.collapsedSummary}>
          {item.location ? (
            <View style={styles.detailRow}>
              <MapPin color={Colors.text.tertiary} size={11} />
              <Text style={styles.detailTextSmall} numberOfLines={1}>{item.location}</Text>
            </View>
          ) : null}
          {item.cast.length > 0 && (
            <View style={styles.detailRow}>
              <Users color={Colors.text.tertiary} size={11} />
              <Text style={styles.detailTextSmall} numberOfLines={1}>{item.cast.join(', ')}</Text>
            </View>
          )}
        </View>
      )}

      {/* Expanded content */}
      {isExpanded && (
        <View style={styles.cardBody}>
          {item.location ? (
            <View style={styles.detailRow}>
              <MapPin color={Colors.text.tertiary} size={12} />
              <Text style={styles.detailText}>{item.location}</Text>
            </View>
          ) : null}

          {item.cast.length > 0 && (
            <View style={styles.detailRow}>
              <Users color={Colors.text.tertiary} size={12} />
              <Text style={styles.detailText}>{item.cast.join(', ')}</Text>
            </View>
          )}

          {item.extras ? (
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>EXTRAS</Text>
              <Text style={styles.detailText}>{item.extras}</Text>
            </View>
          ) : null}

          {item.props.length > 0 && (
            <View style={styles.detailRow}>
              <Package color={Colors.text.tertiary} size={12} />
              <Text style={styles.detailText}>{item.props.join(', ')}</Text>
            </View>
          )}

          {item.wardrobe.length > 0 && (
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>WARDROBE</Text>
              <Text style={styles.detailText}>{item.wardrobe.join(', ')}</Text>
            </View>
          )}

          {item.specialEquipment.length > 0 && (
            <View style={styles.equipRow}>
              {item.specialEquipment.map((eq, i) => (
                <View key={i} style={styles.equipBadge}>
                  <Text style={styles.equipText}>{eq}</Text>
                </View>
              ))}
            </View>
          )}

          {item.notes ? (
            <Text style={styles.notes}>{item.notes}</Text>
          ) : null}

          {/* Action buttons */}
          <View style={styles.cardActions}>
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
  );
}

export default function ScriptBreakdownScreen() {
  const { activeProject, activeProjectId, deleteBreakdown } = useProjects();
  const breakdowns = useProjectBreakdowns(activeProjectId);
  const router = useRouter();
  const { isTablet, contentPadding } = useLayout();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const totalPages = breakdowns.reduce((sum, b) => {
      const parts = b.pageCount.split(' ');
      const whole = parseInt(parts[0]) || 0;
      return sum + whole;
    }, 0);
    return { scenes: breakdowns.length, pages: totalPages };
  }, [breakdowns]);

  if (!activeProject) {
    return (
      <View style={styles.emptyContainer}>
        <Stack.Screen options={{ title: 'Script Breakdown' }} />
        <AlertCircle color={Colors.text.tertiary} size={48} />
        <Text style={styles.emptyTitle}>No project selected</Text>
      </View>
    );
  }

  return (
    <PermissionGate resource="script_breakdown">
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Script Breakdown' }} />

      <View style={{ position: 'absolute', top: 10, right: 16, zIndex: 10 }}><ImportButton entityKey="sceneBreakdowns" variant="compact" />
        <AIImportButton entityKey="sceneBreakdowns" variant="compact" /></View>
      <View style={styles.statsBar}>
        <FileText color={Colors.accent.gold} size={16} />
        <Text style={styles.statsText}>{stats.scenes} scenes</Text>
        <Text style={styles.statsDetail}>~{stats.pages} pages</Text>
      </View>

      <FlatList
        data={breakdowns}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <BreakdownCard
            item={item}
            isExpanded={expandedId === item.id}
            onPress={() => setExpandedId(expandedId === item.id ? null : item.id)}
            onEdit={() => router.push(`/new-breakdown?id=${item.id}` as never)}
            onDelete={() => deleteBreakdown(item.id)}
          />
        )}
        contentContainerStyle={[styles.list, {
          paddingHorizontal: contentPadding,
          maxWidth: isTablet ? 800 : undefined,
          alignSelf: isTablet ? 'center' as const : undefined,
          width: isTablet ? '100%' : undefined,
        }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyInner}>
            <FileText color={Colors.text.tertiary} size={48} />
            <Text style={styles.emptyTitle}>No scenes broken down</Text>
            <Text style={styles.emptySubtitle}>Break down your script scene by scene</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/new-breakdown' as never)}
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
  statsBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: Colors.bg.secondary, borderBottomWidth: 0.5, borderBottomColor: Colors.border.subtle, gap: 8 },
  statsText: { flex: 1, fontSize: 14, fontWeight: '600' as const, color: Colors.text.primary },
  statsDetail: { fontSize: 12, color: Colors.text.tertiary },
  list: { padding: 16, paddingBottom: 100 },
  card: { backgroundColor: Colors.bg.card, borderRadius: 14, marginBottom: 12, borderWidth: 0.5, borderColor: Colors.border.subtle, overflow: 'hidden' },
  cardExpanded: { borderColor: Colors.accent.gold + '44', borderWidth: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  sceneNum: { width: 44, height: 44, borderRadius: 10, backgroundColor: Colors.bg.elevated, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border.medium },
  sceneNumText: { fontSize: 18, fontWeight: '800' as const, color: Colors.accent.gold },
  cardHeaderText: { flex: 1 },
  sceneName: { fontSize: 15, fontWeight: '600' as const, color: Colors.text.primary, marginBottom: 4 },
  tagRow: { flexDirection: 'row', gap: 6 },
  tag: { backgroundColor: Colors.bg.elevated, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  tagText: { fontSize: 9, fontWeight: '700' as const, color: Colors.text.secondary, letterSpacing: 0.5 },
  collapsedSummary: { paddingHorizontal: 14, paddingBottom: 12, gap: 4 },
  cardBody: { paddingHorizontal: 14, paddingBottom: 14, gap: 6 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { fontSize: 12, color: Colors.text.secondary, flex: 1 },
  detailTextSmall: { fontSize: 11, color: Colors.text.tertiary, flex: 1 },
  detailBlock: { marginTop: 4 },
  detailLabel: { fontSize: 9, fontWeight: '700' as const, color: Colors.text.tertiary, letterSpacing: 0.8, marginBottom: 2 },
  equipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  equipBadge: { backgroundColor: Colors.status.warning + '15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, borderWidth: 0.5, borderColor: Colors.status.warning + '33' },
  equipText: { fontSize: 10, fontWeight: '600' as const, color: Colors.status.warning },
  notes: { fontSize: 11, color: Colors.text.tertiary, fontStyle: 'italic' as const, marginTop: 4 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 10, marginTop: 6, borderTopWidth: 0.5, borderTopColor: Colors.border.subtle },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.accent.goldBg, borderWidth: 0.5, borderColor: Colors.accent.gold + '44' },
  editBtnText: { fontSize: 12, fontWeight: '600' as const, color: Colors.accent.gold },
  deleteBtnAction: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.status.error + '12', borderWidth: 0.5, borderColor: Colors.status.error + '44' },
  deleteBtnText: { fontSize: 12, fontWeight: '600' as const, color: Colors.status.error },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.accent.gold, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.accent.gold, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  emptyContainer: { flex: 1, backgroundColor: Colors.bg.primary, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyInner: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600' as const, color: Colors.text.primary, marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: Colors.text.secondary, marginTop: 4, textAlign: 'center' },
});
