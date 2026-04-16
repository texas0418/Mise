import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Image } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Plus, BookOpen, AlertCircle, ChevronDown, ChevronUp, Pencil, Trash2, Camera } from 'lucide-react-native';
import { useProjects, useProjectContinuity } from '@/contexts/ProjectContext';
import { useLayout } from '@/utils/useLayout';
import Colors from '@/constants/colors';
import ImportButton from '@/components/ImportButton';
import AIImportButton from '@/components/AIImportButton';
import { ContinuityNote } from '@/types';
import PermissionGate from '@/contexts/PermissionGate';

function ContinuityCard({ item, isExpanded, onPress, onEdit, onDelete }: {
  item: ContinuityNote;
  isExpanded: boolean;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const time = new Date(item.timestamp);
  const timeStr = time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const photoUrl = (item as any).photoUrl;

  const handleDelete = () => {
    Alert.alert('Delete Note', `Remove continuity note for Sc.${item.sceneNumber}/${item.shotNumber}?`, [
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
        <View style={styles.headerLeft}>
          <View style={styles.sceneBadge}>
            <Text style={styles.sceneBadgeText}>Sc.{item.sceneNumber} / {item.shotNumber}</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.descText} numberOfLines={isExpanded ? undefined : 1}>{item.description}</Text>
            <Text style={styles.timeText}>{timeStr}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          {!isExpanded && photoUrl && (
            <View style={styles.photoThumb}>
              <Image source={{ uri: photoUrl }} style={styles.photoThumbImg} />
            </View>
          )}
          {isExpanded ? <ChevronUp color={Colors.text.tertiary} size={14} /> : <ChevronDown color={Colors.text.tertiary} size={14} />}
        </View>
      </View>

      {/* Expanded body */}
      {isExpanded && (
        <View style={styles.expandedBody}>
          {/* Photo */}
          {photoUrl && (
            <Image source={{ uri: photoUrl }} style={styles.photoFull} resizeMode="cover" />
          )}

          {/* Details */}
          {item.details ? (
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>DETAILS</Text>
              <Text style={styles.detailsText}>{item.details}</Text>
            </View>
          ) : null}

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

export default function ContinuityScreen() {
  const { activeProject, activeProjectId, deleteContinuityNote } = useProjects();
  const notes = useProjectContinuity(activeProjectId);
  const router = useRouter();
  const { isTablet, contentPadding } = useLayout();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    return [...notes].sort((a, b) => a.sceneNumber - b.sceneNumber || a.shotNumber.localeCompare(b.shotNumber));
  }, [notes]);

  // Count notes with photos
  const photoCount = notes.filter((n: any) => n.photoUrl).length;

  if (!activeProject) {
    return (
      <View style={styles.emptyContainer}>
        <Stack.Screen options={{ title: 'Continuity' }} />
        <AlertCircle color={Colors.text.tertiary} size={48} />
        <Text style={styles.emptyTitle}>No project selected</Text>
      </View>
    );
  }

  return (
    <PermissionGate resource="continuity">
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Continuity Notes' }} />

      <View style={{ position: 'absolute', top: 10, right: 16, zIndex: 10 }}><ImportButton entityKey="continuity" variant="compact" />
        <AIImportButton entityKey="continuity" variant="compact" /></View>
      <View style={styles.statsBar}>
        <BookOpen color={Colors.accent.gold} size={16} />
        <Text style={styles.statsText}>{notes.length} note{notes.length !== 1 ? 's' : ''}</Text>
        {photoCount > 0 && (
          <>
            <Camera color={Colors.text.tertiary} size={14} />
            <Text style={styles.statsDetail}>{photoCount} photo{photoCount !== 1 ? 's' : ''}</Text>
          </>
        )}
        <Text style={styles.statsDetail}>{activeProject.title}</Text>
      </View>

      <FlatList
        data={sorted}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <ContinuityCard
            item={item}
            isExpanded={expandedId === item.id}
            onPress={() => setExpandedId(expandedId === item.id ? null : item.id)}
            onEdit={() => router.push(`/new-continuity?id=${item.id}` as never)}
            onDelete={() => { deleteContinuityNote(item.id); setExpandedId(null); }}
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
            <BookOpen color={Colors.text.tertiary} size={48} />
            <Text style={styles.emptyTitle}>No continuity notes</Text>
            <Text style={styles.emptySubtitle}>Track wardrobe, props, and details between takes</Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/new-continuity' as never)} activeOpacity={0.8}>
        <Plus color={Colors.text.inverse} size={24} />
      </TouchableOpacity>
    </View>
  </PermissionGate>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  statsBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: Colors.bg.secondary, borderBottomWidth: 0.5, borderBottomColor: Colors.border.subtle, gap: 8 },
  statsText: { fontSize: 14, fontWeight: '600' as const, color: Colors.text.primary },
  statsDetail: { fontSize: 12, color: Colors.text.tertiary },
  list: { padding: 16, paddingBottom: 100 },
  // Card
  card: { backgroundColor: Colors.bg.card, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 0.5, borderColor: Colors.border.subtle },
  cardExpanded: { borderColor: Colors.accent.gold + '44', borderWidth: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, marginRight: 8 },
  sceneBadge: { backgroundColor: Colors.accent.goldBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  sceneBadgeText: { fontSize: 12, fontWeight: '700' as const, color: Colors.accent.gold, fontVariant: ['tabular-nums'] },
  headerInfo: { flex: 1 },
  descText: { fontSize: 14, fontWeight: '600' as const, color: Colors.text.primary },
  timeText: { fontSize: 11, color: Colors.text.tertiary, fontVariant: ['tabular-nums'], marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  photoThumb: { width: 32, height: 32, borderRadius: 6, overflow: 'hidden', borderWidth: 0.5, borderColor: Colors.border.subtle },
  photoThumbImg: { width: '100%', height: '100%' },
  // Expanded
  expandedBody: { marginTop: 12, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: Colors.border.subtle },
  photoFull: { width: '100%', height: 200, borderRadius: 10, marginBottom: 12, backgroundColor: Colors.bg.elevated },
  detailBlock: { marginBottom: 10 },
  detailLabel: { fontSize: 9, fontWeight: '700' as const, color: Colors.text.tertiary, letterSpacing: 0.8, marginBottom: 3 },
  detailsText: { fontSize: 13, color: Colors.text.secondary, lineHeight: 19 },
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
