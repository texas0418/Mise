import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Plus, Move, AlertCircle, Camera, Users, ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react-native';
import { useProjects, useProjectBlockingNotes } from '@/contexts/ProjectContext';
import { useLayout } from '@/utils/useLayout';
import Colors from '@/constants/colors';
import { BlockingNote } from '@/types';
import PermissionGate from '@/contexts/PermissionGate';

function BlockingCard({ item, isExpanded, onPress, onEdit, onDelete }: {
  item: BlockingNote;
  isExpanded: boolean;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const handleDelete = () => {
    Alert.alert('Delete Blocking Note', `Remove "${item.title}"?`, [
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
      {/* Header — always visible */}
      <View style={styles.cardHeader}>
        <View style={styles.sceneBadge}>
          <Text style={styles.sceneBadgeText}>Sc. {item.sceneNumber}</Text>
        </View>
        <View style={styles.headerCenter}>
          <Text style={styles.title} numberOfLines={isExpanded ? undefined : 1}>{item.title}</Text>
          <Text style={styles.dateText}>
            {new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </Text>
        </View>
        {isExpanded ? <ChevronUp color={Colors.text.tertiary} size={16} /> : <ChevronDown color={Colors.text.tertiary} size={16} />}
      </View>

      {/* Expanded body */}
      {isExpanded && (
        <View style={styles.expandedBody}>
          {item.description ? (
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>DESCRIPTION</Text>
              <Text style={styles.description}>{item.description}</Text>
            </View>
          ) : null}

          <View style={styles.detailSection}>
            <View style={styles.detailRow}>
              <Users color={Colors.status.info} size={14} />
              <Text style={styles.detailRowLabel}>Actors:</Text>
              <Text style={styles.detailRowText}>{item.actorPositions || '—'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Camera color={Colors.accent.gold} size={14} />
              <Text style={styles.detailRowLabel}>Camera:</Text>
              <Text style={styles.detailRowText}>{item.cameraPosition || '—'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Move color={Colors.status.active} size={14} />
              <Text style={styles.detailRowLabel}>Movement:</Text>
              <Text style={styles.detailRowText}>{item.movementNotes || '—'}</Text>
            </View>
          </View>

          {item.notes ? (
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>NOTES</Text>
              <Text style={styles.notesText}>{item.notes}</Text>
            </View>
          ) : null}

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

export default function BlockingNotesScreen() {
  const { activeProject, activeProjectId, deleteBlockingNote } = useProjects();
  const notes = useProjectBlockingNotes(activeProjectId);
  const router = useRouter();
  const { isTablet, contentPadding } = useLayout();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!activeProject) {
    return (
      <View style={styles.empty}>
        <Stack.Screen options={{ title: 'Blocking & Rehearsal' }} />
        <AlertCircle color={Colors.text.tertiary} size={48} />
        <Text style={styles.emptyTitle}>No project selected</Text>
      </View>
    );
  }

  return (
    <PermissionGate resource="blocking">
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Blocking & Rehearsal' }} />

      <View style={styles.statsBar}>
        <Move color={Colors.accent.gold} size={16} />
        <Text style={styles.statsText}>{notes.length} note{notes.length !== 1 ? 's' : ''}</Text>
      </View>

      <FlatList
        data={notes}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <BlockingCard
            item={item}
            isExpanded={expandedId === item.id}
            onPress={() => setExpandedId(expandedId === item.id ? null : item.id)}
            onEdit={() => router.push(`/new-blocking-note?id=${item.id}` as never)}
            onDelete={() => { deleteBlockingNote(item.id); setExpandedId(null); }}
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
            <Move color={Colors.text.tertiary} size={48} />
            <Text style={styles.emptyTitle}>No blocking notes</Text>
            <Text style={styles.emptySub}>Plan actor positions and camera staging</Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/new-blocking-note' as never)} activeOpacity={0.8}>
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
  sceneBadge: { backgroundColor: Colors.status.info + '18', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  sceneBadgeText: { fontSize: 12, fontWeight: '700' as const, color: Colors.status.info },
  headerCenter: { flex: 1 },
  title: { fontSize: 15, fontWeight: '700' as const, color: Colors.text.primary },
  dateText: { fontSize: 11, color: Colors.text.tertiary, marginTop: 2 },
  // Expanded
  expandedBody: { marginTop: 12, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: Colors.border.subtle },
  detailBlock: { marginBottom: 10 },
  detailLabel: { fontSize: 9, fontWeight: '700' as const, color: Colors.text.tertiary, letterSpacing: 0.8, marginBottom: 4 },
  description: { fontSize: 13, color: Colors.text.secondary, lineHeight: 20 },
  detailSection: { gap: 8, marginBottom: 10 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  detailRowLabel: { fontSize: 11, fontWeight: '700' as const, color: Colors.text.tertiary, width: 70 },
  detailRowText: { fontSize: 12, color: Colors.text.primary, flex: 1, lineHeight: 18 },
  notesText: { fontSize: 12, color: Colors.accent.goldLight, fontStyle: 'italic' as const, lineHeight: 18 },
  // Actions
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 10, marginTop: 4, borderTopWidth: 0.5, borderTopColor: Colors.border.subtle },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.accent.goldBg, borderWidth: 0.5, borderColor: Colors.accent.gold + '44' },
  editBtnText: { fontSize: 12, fontWeight: '600' as const, color: Colors.accent.gold },
  deleteBtnAction: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.status.error + '12', borderWidth: 0.5, borderColor: Colors.status.error + '44' },
  deleteBtnText: { fontSize: 12, fontWeight: '600' as const, color: Colors.status.error },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.accent.gold, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.accent.gold, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  empty: { flex: 1, backgroundColor: Colors.bg.primary, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyInner: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600' as const, color: Colors.text.primary, marginTop: 16 },
  emptySub: { fontSize: 14, color: Colors.text.secondary, marginTop: 4, textAlign: 'center' },
});
