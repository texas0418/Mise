import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Plus, StickyNote, AlertCircle, Pin, ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react-native';
import { useProjects, useProjectNotes } from '@/contexts/ProjectContext';
import { useLayout } from '@/utils/useLayout';
import Colors from '@/constants/colors';
import { ProductionNote, NoteCategory } from '@/types';
import PermissionGate from '@/contexts/PermissionGate';

const CAT_COLORS: Record<NoteCategory, string> = {
  'general': Colors.text.secondary,
  'creative': '#E879F9',
  'technical': '#60A5FA',
  'logistics': '#4ADE80',
  'feedback': '#FB923C',
  'revision': '#F87171',
};

const CAT_LABELS: { label: string; value: NoteCategory }[] = [
  { label: 'All', value: 'general' },
  { label: 'Creative', value: 'creative' },
  { label: 'Technical', value: 'technical' },
  { label: 'Logistics', value: 'logistics' },
  { label: 'Feedback', value: 'feedback' },
  { label: 'Revision', value: 'revision' },
];

function NoteCard({ item, isExpanded, onPress, onEdit, onDelete }: {
  item: ProductionNote;
  isExpanded: boolean;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const catColor = CAT_COLORS[item.category] ?? Colors.text.tertiary;
  const date = new Date(item.updatedAt);
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const handleDelete = () => {
    Alert.alert('Delete Note', `Remove "${item.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);
  };

  return (
    <TouchableOpacity
      style={[styles.card, item.pinned && styles.cardPinned, isExpanded && styles.cardExpanded]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Header — always visible */}
      <View style={styles.cardHeader}>
        <View style={[styles.catDot, { backgroundColor: catColor }]} />
        <Text style={styles.noteTitle} numberOfLines={isExpanded ? undefined : 1}>{item.title}</Text>
        {item.pinned && <Pin color={Colors.accent.gold} size={12} fill={Colors.accent.gold} />}
        <Text style={styles.dateText}>{dateStr}</Text>
        {isExpanded ? <ChevronUp color={Colors.text.tertiary} size={14} /> : <ChevronDown color={Colors.text.tertiary} size={14} />}
      </View>

      {/* Collapsed preview */}
      {!isExpanded && item.content && (
        <Text style={styles.notePreview} numberOfLines={2}>{item.content}</Text>
      )}

      {/* Expanded body */}
      {isExpanded && (
        <View style={styles.expandedBody}>
          {item.content ? (
            <Text style={styles.noteContent}>{item.content}</Text>
          ) : (
            <Text style={styles.noContent}>No content</Text>
          )}

          <View style={styles.metaRow}>
            <View style={[styles.catBadge, { backgroundColor: catColor + '18', borderColor: catColor + '44' }]}>
              <View style={[styles.catDotSmall, { backgroundColor: catColor }]} />
              <Text style={[styles.catText, { color: catColor }]}>{item.category}</Text>
            </View>
            {item.pinned && (
              <View style={styles.pinnedBadge}>
                <Pin color={Colors.accent.gold} size={10} fill={Colors.accent.gold} />
                <Text style={styles.pinnedText}>Pinned</Text>
              </View>
            )}
          </View>

          {/* Actions */}
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

export default function ProductionNotesScreen() {
  const { activeProject, activeProjectId, deleteNote } = useProjects();
  const notes = useProjectNotes(activeProjectId);
  const router = useRouter();
  const { isTablet, contentPadding } = useLayout();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState<NoteCategory | null>(null);

  const sorted = useMemo(() => {
    let filtered = filterCat ? notes.filter(n => n.category === filterCat) : notes;
    return [...filtered].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [notes, filterCat]);

  // Category counts
  const catCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    notes.forEach(n => { counts[n.category] = (counts[n.category] || 0) + 1; });
    return counts;
  }, [notes]);

  const pinnedCount = notes.filter(n => n.pinned).length;

  if (!activeProject) {
    return (
      <View style={styles.emptyContainer}>
        <Stack.Screen options={{ title: 'Notes' }} />
        <AlertCircle color={Colors.text.tertiary} size={48} />
        <Text style={styles.emptyTitle}>No project selected</Text>
      </View>
    );
  }

  return (
    <PermissionGate resource="notes">
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Production Notes' }} />

      <View style={styles.statsBar}>
        <StickyNote color={Colors.accent.gold} size={16} />
        <Text style={styles.statsText}>{notes.length} note{notes.length !== 1 ? 's' : ''}</Text>
        {pinnedCount > 0 && (
          <>
            <Pin color={Colors.accent.gold} size={12} fill={Colors.accent.gold} />
            <Text style={styles.statsDetail}>{pinnedCount} pinned</Text>
          </>
        )}
      </View>

      {/* Category filter chips */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterChip, !filterCat && styles.filterChipActive]}
          onPress={() => setFilterCat(null)}
        >
          <Text style={[styles.filterChipText, !filterCat && styles.filterChipTextActive]}>All</Text>
        </TouchableOpacity>
        {CAT_LABELS.filter(c => c.value !== 'general' || catCounts['general']).map(c => {
          const count = catCounts[c.value] || 0;
          if (count === 0 && c.value !== 'general') return null;
          const isActive = filterCat === c.value;
          const color = CAT_COLORS[c.value];
          return (
            <TouchableOpacity
              key={c.value}
              style={[styles.filterChip, isActive && { backgroundColor: color + '18', borderColor: color + '44' }]}
              onPress={() => setFilterCat(isActive ? null : c.value)}
            >
              <View style={[styles.catDotSmall, { backgroundColor: color }]} />
              <Text style={[styles.filterChipText, isActive && { color }]}>{c.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={sorted}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <NoteCard
            item={item}
            isExpanded={expandedId === item.id}
            onPress={() => setExpandedId(expandedId === item.id ? null : item.id)}
            onEdit={() => router.push(`/new-note?id=${item.id}` as never)}
            onDelete={() => { deleteNote(item.id); setExpandedId(null); }}
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
            <StickyNote color={Colors.text.tertiary} size={48} />
            <Text style={styles.emptyTitle}>No notes yet</Text>
            <Text style={styles.emptySubtitle}>Capture ideas, feedback, and memos</Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/new-note' as never)} activeOpacity={0.8}>
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
  // Filter
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: Colors.border.subtle },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: Colors.bg.elevated, borderWidth: 0.5, borderColor: Colors.border.subtle },
  filterChipActive: { backgroundColor: Colors.accent.goldBg, borderColor: Colors.accent.gold + '44' },
  filterChipText: { fontSize: 11, fontWeight: '600' as const, color: Colors.text.tertiary },
  filterChipTextActive: { color: Colors.accent.gold },
  catDotSmall: { width: 6, height: 6, borderRadius: 3 },
  list: { padding: 16, paddingBottom: 100 },
  // Card
  card: { backgroundColor: Colors.bg.card, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 0.5, borderColor: Colors.border.subtle },
  cardPinned: { borderColor: Colors.accent.gold + '33', backgroundColor: Colors.accent.goldBg },
  cardExpanded: { borderColor: Colors.accent.gold + '44', borderWidth: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  catDot: { width: 6, height: 6, borderRadius: 3 },
  noteTitle: { flex: 1, fontSize: 15, fontWeight: '600' as const, color: Colors.text.primary },
  dateText: { fontSize: 11, color: Colors.text.tertiary },
  notePreview: { fontSize: 13, color: Colors.text.secondary, lineHeight: 19, marginTop: 6 },
  // Expanded
  expandedBody: { marginTop: 12, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: Colors.border.subtle },
  noteContent: { fontSize: 14, color: Colors.text.secondary, lineHeight: 21, marginBottom: 12 },
  noContent: { fontSize: 13, color: Colors.text.tertiary, fontStyle: 'italic' as const, marginBottom: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  catBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 0.5 },
  catText: { fontSize: 10, fontWeight: '600' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  pinnedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pinnedText: { fontSize: 10, fontWeight: '600' as const, color: Colors.accent.gold },
  // Actions
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 10, marginTop: 4, borderTopWidth: 0.5, borderTopColor: Colors.border.subtle },
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
