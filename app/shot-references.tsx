import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Plus, Image as ImageIcon, AlertCircle, ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react-native';
import { Image } from 'expo-image';
import { useProjects, useProjectShotReferences } from '@/contexts/ProjectContext';
import { useLayout } from '@/utils/useLayout';
import Colors from '@/constants/colors';
import { ShotReference } from '@/types';
import PermissionGate from '@/contexts/PermissionGate';

function ReferenceCard({ item, isExpanded, onPress, onEdit, onDelete }: {
  item: ShotReference;
  isExpanded: boolean;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const handleDelete = () => {
    Alert.alert('Delete Reference', `Remove "${item.title}"?`, [
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
      {/* Image + overlay */}
      <View style={styles.imageWrap}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={[styles.refImage, isExpanded && styles.refImageExpanded]} contentFit="cover" />
        ) : (
          <View style={[styles.refImagePlaceholder, isExpanded && styles.refImageExpanded]}>
            <ImageIcon color={Colors.text.tertiary} size={32} />
          </View>
        )}
        <View style={styles.overlay}>
          <View style={styles.overlayContent}>
            <Text style={styles.refTitle} numberOfLines={isExpanded ? undefined : 1}>{item.title}</Text>
            {item.sceneNumber && <Text style={styles.refScene}>Sc. {item.sceneNumber}</Text>}
          </View>
          {isExpanded ? <ChevronUp color="#ccc" size={16} /> : <ChevronDown color="#ccc" size={16} />}
        </View>
      </View>

      {/* Collapsed: tags row */}
      {!isExpanded && (
        <View style={styles.cardBody}>
          <View style={styles.tagRow}>
            {item.tags.slice(0, 3).map(tag => (
              <View key={tag} style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View>
            ))}
            {item.tags.length > 3 && (
              <Text style={styles.tagMore}>+{item.tags.length - 3}</Text>
            )}
          </View>
        </View>
      )}

      {/* Expanded: full details */}
      {isExpanded && (
        <View style={styles.expandedBody}>
          {item.shotType && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>SHOT TYPE</Text>
              <Text style={styles.detailValue}>{item.shotType}</Text>
            </View>
          )}

          {item.lightingStyle ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>LIGHTING</Text>
              <Text style={styles.lightingText}>{item.lightingStyle}</Text>
            </View>
          ) : null}

          {item.tags.length > 0 && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>TAGS</Text>
              <View style={styles.tagRow}>
                {item.tags.map(tag => (
                  <View key={tag} style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View>
                ))}
              </View>
            </View>
          )}

          {item.notes ? (
            <View style={styles.detailRow}>
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

export default function ShotReferencesScreen() {
  const { activeProject, activeProjectId, deleteShotReference } = useProjects();
  const references = useProjectShotReferences(activeProjectId);
  const router = useRouter();
  const { isTablet, contentPadding } = useLayout();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!activeProject) {
    return (
      <View style={styles.empty}>
        <Stack.Screen options={{ title: 'Shot References' }} />
        <AlertCircle color={Colors.text.tertiary} size={48} />
        <Text style={styles.emptyTitle}>No project selected</Text>
      </View>
    );
  }

  return (
    <PermissionGate resource="shot_refs">
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Shot References' }} />

      <FlatList
        data={references}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <ReferenceCard
            item={item}
            isExpanded={expandedId === item.id}
            onPress={() => setExpandedId(expandedId === item.id ? null : item.id)}
            onEdit={() => router.push(`/new-shot-reference?id=${item.id}` as never)}
            onDelete={() => { deleteShotReference(item.id); setExpandedId(null); }}
          />
        )}
        contentContainerStyle={[styles.list, {
          paddingHorizontal: contentPadding,
          maxWidth: isTablet ? 800 : undefined,
          alignSelf: isTablet ? 'center' as const : undefined,
          width: isTablet ? '100%' : undefined,
        }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{references.length} Reference{references.length !== 1 ? 's' : ''}</Text>
            <Text style={styles.headerSub}>Visual references for {activeProject.title}</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyInner}>
            <ImageIcon color={Colors.text.tertiary} size={48} />
            <Text style={styles.emptyTitle}>No references yet</Text>
            <Text style={styles.emptySub}>Add stills and references for your shots</Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/new-shot-reference' as never)} activeOpacity={0.8}>
        <Plus color={Colors.text.inverse} size={24} />
      </TouchableOpacity>
    </View>
  </PermissionGate>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  list: { padding: 16, paddingBottom: 100 },
  header: { marginBottom: 12 },
  headerTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.text.primary },
  headerSub: { fontSize: 13, color: Colors.text.secondary, marginTop: 2 },
  // Card
  card: { backgroundColor: Colors.bg.card, borderRadius: 14, overflow: 'hidden', marginBottom: 12, borderWidth: 0.5, borderColor: Colors.border.subtle },
  cardExpanded: { borderColor: Colors.accent.gold + '44', borderWidth: 1 },
  imageWrap: { position: 'relative' },
  refImage: { width: '100%', height: 180 },
  refImageExpanded: { height: 240 },
  refImagePlaceholder: { width: '100%', height: 180, backgroundColor: Colors.bg.elevated, justifyContent: 'center', alignItems: 'center' },
  overlay: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'flex-end', padding: 12, backgroundColor: 'rgba(0,0,0,0.45)' },
  overlayContent: { flex: 1 },
  refTitle: { fontSize: 15, fontWeight: '700' as const, color: '#fff' },
  refScene: { fontSize: 11, color: '#ddd', marginTop: 2 },
  // Collapsed body
  cardBody: { padding: 10 },
  tagRow: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  tag: { backgroundColor: Colors.bg.elevated, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tagText: { fontSize: 10, color: Colors.text.secondary, fontWeight: '600' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  tagMore: { fontSize: 10, color: Colors.text.tertiary, alignSelf: 'center' },
  // Expanded body
  expandedBody: { padding: 14 },
  detailRow: { marginBottom: 10 },
  detailLabel: { fontSize: 9, fontWeight: '700' as const, color: Colors.text.tertiary, letterSpacing: 0.8, marginBottom: 4 },
  detailValue: { fontSize: 13, color: Colors.text.secondary, textTransform: 'capitalize' as const },
  lightingText: { fontSize: 13, color: Colors.accent.gold },
  notesText: { fontSize: 13, color: Colors.text.secondary, lineHeight: 19, fontStyle: 'italic' as const },
  // Actions
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 12, marginTop: 4, borderTopWidth: 0.5, borderTopColor: Colors.border.subtle },
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
