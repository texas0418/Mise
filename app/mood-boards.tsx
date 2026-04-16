import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Plus, Palette, AlertCircle, Pencil, Trash2 } from 'lucide-react-native';
import { Image } from 'expo-image';
import { useProjects, useProjectMoodBoard } from '@/contexts/ProjectContext';
import { useLayout } from '@/utils/useLayout';
import Colors from '@/constants/colors';
import { MoodBoardItem } from '@/types';
import PermissionGate from '@/contexts/PermissionGate';

function MoodBoardCard({ item, isSelected, onPress, onEdit, onDelete }: {
  item: MoodBoardItem;
  isSelected: boolean;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const handleDelete = () => {
    Alert.alert('Delete Item', `Remove "${item.label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);
  };

  const selectedBorder = isSelected ? { borderColor: Colors.accent.gold, borderWidth: 1.5 } : {};

  if (item.type === 'color') {
    return (
      <TouchableOpacity style={[styles.colorCard, selectedBorder]} onPress={onPress} activeOpacity={0.7}>
        <View style={[styles.colorSwatch, { backgroundColor: item.color ?? '#333' }]} />
        <Text style={styles.colorLabel}>{item.label}</Text>
        <Text style={styles.colorHex}>{item.color}</Text>
        {isSelected && (
          <View style={styles.cardActions}>
            <TouchableOpacity onPress={onEdit} style={styles.actionBtnSmall}>
              <Pencil color={Colors.accent.gold} size={13} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDelete} style={styles.actionBtnSmallDanger}>
              <Trash2 color={Colors.status.error} size={13} />
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  if (item.type === 'reference' && item.imageUrl) {
    return (
      <TouchableOpacity style={[styles.refCard, selectedBorder]} onPress={onPress} activeOpacity={0.7}>
        <Image source={{ uri: item.imageUrl }} style={styles.refImage} contentFit="cover" />
        <View style={styles.refOverlay}>
          <Text style={styles.refLabel}>{item.label}</Text>
        </View>
        {isSelected && (
          <View style={styles.refActions}>
            <TouchableOpacity onPress={onEdit} style={styles.actionBtnOverlay}>
              <Pencil color="#fff" size={14} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDelete} style={styles.actionBtnOverlay}>
              <Trash2 color="#FF6B6B" size={14} />
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  // Note type
  return (
    <TouchableOpacity style={[styles.noteCard, selectedBorder]} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.noteHeader}>
        <Text style={styles.noteLabel}>{item.label}</Text>
      </View>
      <Text style={styles.noteText}>{item.note}</Text>
      {isSelected && (
        <View style={styles.cardActionsRow}>
          <TouchableOpacity onPress={onEdit} style={styles.editBtn}>
            <Pencil color={Colors.accent.gold} size={13} />
            <Text style={styles.editBtnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} style={styles.deleteBtnAction}>
            <Trash2 color={Colors.status.error} size={13} />
            <Text style={styles.deleteBtnText}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function MoodBoardsScreen() {
  const { activeProject, activeProjectId, deleteMoodBoardItem } = useProjects();
  const items = useProjectMoodBoard(activeProjectId);
  const router = useRouter();
  const { isTablet, contentPadding } = useLayout();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const boards = useMemo(() => {
    const grouped: Record<string, MoodBoardItem[]> = {};
    items.forEach(item => {
      if (!grouped[item.boardName]) grouped[item.boardName] = [];
      grouped[item.boardName].push(item);
    });
    return Object.entries(grouped).map(([name, boardItems]) => ({ name, items: boardItems }));
  }, [items]);

  if (!activeProject) {
    return (
      <View style={styles.emptyContainer}>
        <Stack.Screen options={{ title: 'Mood Boards' }} />
        <AlertCircle color={Colors.text.tertiary} size={48} />
        <Text style={styles.emptyTitle}>No project selected</Text>
      </View>
    );
  }

  return (
    <PermissionGate resource="mood_board">
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Mood Boards' }} />

      <View style={styles.statsBar}>
        <Palette color={Colors.accent.gold} size={16} />
        <Text style={styles.statsText}>{items.length} item{items.length !== 1 ? 's' : ''}</Text>
        <Text style={styles.statsDetail}>{boards.length} board{boards.length !== 1 ? 's' : ''}</Text>
      </View>

      <FlatList
        data={boards}
        keyExtractor={item => item.name}
        renderItem={({ item: board }) => (
          <View style={styles.boardSection}>
            <Text style={styles.boardTitle}>{board.name}</Text>
            <View style={styles.boardGrid}>
              {board.items.map(item => (
                <MoodBoardCard
                  key={item.id}
                  item={item}
                  isSelected={selectedId === item.id}
                  onPress={() => setSelectedId(selectedId === item.id ? null : item.id)}
                  onEdit={() => router.push(`/new-mood-item?id=${item.id}` as never)}
                  onDelete={() => { deleteMoodBoardItem(item.id); setSelectedId(null); }}
                />
              ))}
            </View>
          </View>
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
            <Palette color={Colors.text.tertiary} size={48} />
            <Text style={styles.emptyTitle}>No mood boards</Text>
            <Text style={styles.emptySubtitle}>Build visual reference boards for your film</Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/new-mood-item' as never)} activeOpacity={0.8}>
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
  boardSection: { marginBottom: 24 },
  boardTitle: { fontSize: 16, fontWeight: '700' as const, color: Colors.text.primary, marginBottom: 12, letterSpacing: -0.3 },
  boardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  // Color card
  colorCard: { width: '30%' as unknown as number, flexGrow: 0, flexShrink: 0, flexBasis: '30%', backgroundColor: Colors.bg.card, borderRadius: 12, overflow: 'hidden', borderWidth: 0.5, borderColor: Colors.border.subtle },
  colorSwatch: { height: 60, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  colorLabel: { fontSize: 11, fontWeight: '600' as const, color: Colors.text.primary, paddingHorizontal: 8, paddingTop: 6 },
  colorHex: { fontSize: 9, color: Colors.text.tertiary, paddingHorizontal: 8, paddingBottom: 8, fontVariant: ['tabular-nums'] },
  // Reference card
  refCard: { width: '47%' as unknown as number, flexGrow: 0, flexShrink: 0, flexBasis: '47%', height: 140, borderRadius: 12, overflow: 'hidden', borderWidth: 0.5, borderColor: Colors.border.subtle },
  refImage: { width: '100%', height: '100%' },
  refOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 8, backgroundColor: 'rgba(0,0,0,0.6)' },
  refLabel: { fontSize: 11, fontWeight: '600' as const, color: '#fff' },
  refActions: { position: 'absolute', top: 8, right: 8, flexDirection: 'row', gap: 6 },
  // Note card
  noteCard: { width: '100%' as unknown as number, backgroundColor: Colors.bg.card, borderRadius: 12, padding: 14, borderWidth: 0.5, borderColor: Colors.border.subtle, borderLeftWidth: 3, borderLeftColor: Colors.accent.gold },
  noteHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  noteLabel: { fontSize: 13, fontWeight: '600' as const, color: Colors.text.primary },
  noteText: { fontSize: 12, color: Colors.text.secondary, lineHeight: 18 },
  // Actions
  cardActions: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 6, borderTopWidth: 0.5, borderTopColor: Colors.border.subtle },
  actionBtnSmall: { width: 30, height: 30, borderRadius: 8, backgroundColor: Colors.accent.goldBg, justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: Colors.accent.gold + '44' },
  actionBtnSmallDanger: { width: 30, height: 30, borderRadius: 8, backgroundColor: Colors.status.error + '12', justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: Colors.status.error + '44' },
  actionBtnOverlay: { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  cardActionsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: Colors.border.subtle },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: Colors.accent.goldBg, borderWidth: 0.5, borderColor: Colors.accent.gold + '44' },
  editBtnText: { fontSize: 11, fontWeight: '600' as const, color: Colors.accent.gold },
  deleteBtnAction: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: Colors.status.error + '12', borderWidth: 0.5, borderColor: Colors.status.error + '44' },
  deleteBtnText: { fontSize: 11, fontWeight: '600' as const, color: Colors.status.error },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.accent.gold, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.accent.gold, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  emptyContainer: { flex: 1, backgroundColor: Colors.bg.primary, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyInner: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600' as const, color: Colors.text.primary, marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: Colors.text.secondary, marginTop: 4, textAlign: 'center' },
});
