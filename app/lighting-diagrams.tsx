import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Plus, Lightbulb, AlertCircle, ChevronDown, ChevronUp, Pencil, Trash2, Camera, Users, Zap } from 'lucide-react-native';
import { useProjects, useProjectLightingDiagrams } from '@/contexts/ProjectContext';
import { useLayout } from '@/utils/useLayout';
import Colors from '@/constants/colors';
import { LightingDiagram } from '@/types';
import PermissionGate from '@/contexts/PermissionGate';

const TEMPLATE_LABELS: Record<string, string> = {
  'blank': 'Blank', 'three-point': '3-Point', 'rembrandt': 'Rembrandt',
  'butterfly': 'Butterfly', 'split': 'Split', 'loop': 'Loop',
  'broad': 'Broad', 'short-side': 'Short-Side', 'backlight-only': 'Silhouette',
  'natural-window': 'Window Light',
};

function DiagramCard({ item, isExpanded, onPress, onEdit, onOpen, onDelete }: {
  item: LightingDiagram;
  isExpanded: boolean;
  onPress: () => void;
  onEdit: () => void;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const lightCount = item.elements.filter(e => e.type.includes('light') || e.type === 'kicker' || e.type === 'practical').length;
  const actorCount = item.elements.filter(e => e.type === 'actor').length;
  const modifierCount = item.elements.filter(e => ['bounce', 'reflector', 'flag', 'diffusion', 'gel'].includes(e.type)).length;

  const handleDelete = () => {
    Alert.alert('Delete Diagram', `Remove "${item.title}"?`, [
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
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={styles.iconWrap}>
          <Lightbulb color={Colors.accent.gold} size={18} />
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.title} numberOfLines={isExpanded ? undefined : 1}>{item.title}</Text>
          <View style={styles.metaRow}>
            {item.sceneNumber != null && (
              <View style={styles.sceneBadge}>
                <Text style={styles.sceneBadgeText}>Sc. {item.sceneNumber}</Text>
              </View>
            )}
            {item.shotNumber && (
              <View style={styles.shotBadge}>
                <Text style={styles.shotBadgeText}>Shot {item.shotNumber}</Text>
              </View>
            )}
            <View style={styles.templateBadge}>
              <Text style={styles.templateBadgeText}>{TEMPLATE_LABELS[item.templateName] || item.templateName}</Text>
            </View>
          </View>
        </View>
        {isExpanded ? <ChevronUp color={Colors.text.tertiary} size={16} /> : <ChevronDown color={Colors.text.tertiary} size={16} />}
      </View>

      {/* Expanded */}
      {isExpanded && (
        <View style={styles.expandedBody}>
          {/* Element counts */}
          <View style={styles.countsRow}>
            <View style={styles.countChip}>
              <Zap color="#FBBF24" size={12} />
              <Text style={styles.countText}>{lightCount} light{lightCount !== 1 ? 's' : ''}</Text>
            </View>
            <View style={styles.countChip}>
              <Users color="#4ADE80" size={12} />
              <Text style={styles.countText}>{actorCount} actor{actorCount !== 1 ? 's' : ''}</Text>
            </View>
            {modifierCount > 0 && (
              <View style={styles.countChip}>
                <Camera color="#60A5FA" size={12} />
                <Text style={styles.countText}>{modifierCount} modifier{modifierCount !== 1 ? 's' : ''}</Text>
              </View>
            )}
          </View>

          {item.description ? (
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>DESCRIPTION</Text>
              <Text style={styles.descText}>{item.description}</Text>
            </View>
          ) : null}

          {item.notes ? (
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>NOTES</Text>
              <Text style={styles.notesText}>{item.notes}</Text>
            </View>
          ) : null}

          <Text style={styles.dateText}>
            Updated {new Date(item.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </Text>

          <View style={styles.cardActions}>
            <TouchableOpacity onPress={onOpen} style={styles.openBtn}>
              <Lightbulb color={Colors.accent.gold} size={15} />
              <Text style={styles.openBtnText}>Open Editor</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onEdit} style={styles.editBtn}>
              <Pencil color={Colors.text.secondary} size={15} />
              <Text style={styles.editBtnText}>Edit Info</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDelete} style={styles.deleteBtnAction}>
              <Trash2 color={Colors.status.error} size={15} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function LightingDiagramsScreen() {
  const { activeProject, activeProjectId, deleteLightingDiagram } = useProjects();
  const diagrams = useProjectLightingDiagrams(activeProjectId);
  const router = useRouter();
  const { isTablet, contentPadding } = useLayout();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!activeProject) {
    return (
      <View style={styles.empty}>
        <Stack.Screen options={{ title: 'Lighting Diagrams' }} />
        <AlertCircle color={Colors.text.tertiary} size={48} />
        <Text style={styles.emptyTitle}>No project selected</Text>
      </View>
    );
  }

  return (
    <PermissionGate resource="lighting">
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Lighting Diagrams' }} />

        <View style={styles.statsBar}>
          <Lightbulb color={Colors.accent.gold} size={16} />
          <Text style={styles.statsText}>{diagrams.length} diagram{diagrams.length !== 1 ? 's' : ''}</Text>
        </View>

        <FlatList
          data={diagrams}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <DiagramCard
              item={item}
              isExpanded={expandedId === item.id}
              onPress={() => setExpandedId(expandedId === item.id ? null : item.id)}
              onEdit={() => router.push(`/new-lighting-diagram?id=${item.id}` as never)}
              onOpen={() => router.push(`/lighting-editor?id=${item.id}` as never)}
              onDelete={() => { deleteLightingDiagram(item.id); setExpandedId(null); }}
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
              <Lightbulb color={Colors.text.tertiary} size={48} />
              <Text style={styles.emptyTitle}>No lighting diagrams</Text>
              <Text style={styles.emptySub}>Plan your lighting setups with drag-and-drop diagrams</Text>
            </View>
          }
        />

        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/new-lighting-diagram' as never)}
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
  list: { padding: 16, paddingBottom: 100 },

  // Card
  card: { backgroundColor: Colors.bg.card, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 0.5, borderColor: Colors.border.subtle },
  cardExpanded: { borderColor: Colors.accent.gold + '44', borderWidth: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: Colors.accent.goldBg, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1 },
  title: { fontSize: 15, fontWeight: '700' as const, color: Colors.text.primary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  sceneBadge: { backgroundColor: Colors.status.info + '18', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  sceneBadgeText: { fontSize: 10, fontWeight: '700' as const, color: Colors.status.info },
  shotBadge: { backgroundColor: Colors.accent.goldBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  shotBadgeText: { fontSize: 10, fontWeight: '700' as const, color: Colors.accent.gold },
  templateBadge: { backgroundColor: Colors.bg.elevated, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 0.5, borderColor: Colors.border.subtle },
  templateBadgeText: { fontSize: 10, fontWeight: '600' as const, color: Colors.text.tertiary },

  // Expanded
  expandedBody: { marginTop: 12, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: Colors.border.subtle },
  countsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  countChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.bg.elevated, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  countText: { fontSize: 11, color: Colors.text.secondary, fontWeight: '500' as const },
  detailBlock: { marginBottom: 10 },
  detailLabel: { fontSize: 9, fontWeight: '700' as const, color: Colors.text.tertiary, letterSpacing: 0.8, marginBottom: 4 },
  descText: { fontSize: 13, color: Colors.text.secondary, lineHeight: 20 },
  notesText: { fontSize: 12, color: Colors.accent.goldLight, fontStyle: 'italic' as const, lineHeight: 18 },
  dateText: { fontSize: 10, color: Colors.text.tertiary, marginBottom: 10 },

  // Actions
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: Colors.border.subtle },
  openBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.accent.goldBg, borderWidth: 0.5, borderColor: Colors.accent.gold + '44' },
  openBtnText: { fontSize: 12, fontWeight: '600' as const, color: Colors.accent.gold },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.bg.elevated, borderWidth: 0.5, borderColor: Colors.border.subtle },
  editBtnText: { fontSize: 12, fontWeight: '500' as const, color: Colors.text.secondary },
  deleteBtnAction: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.status.error + '12', borderWidth: 0.5, borderColor: Colors.status.error + '44' },

  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.accent.gold, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.accent.gold, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  empty: { flex: 1, backgroundColor: Colors.bg.primary, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyInner: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600' as const, color: Colors.text.primary, marginTop: 16 },
  emptySub: { fontSize: 14, color: Colors.text.secondary, marginTop: 4, textAlign: 'center' },
});
