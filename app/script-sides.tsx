import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Animated, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, FileText, Clock, MessageSquare, Camera, Users, ChevronDown, ChevronUp, Tag, Trash2, Eye, Pencil } from 'lucide-react-native';
import { useProjects, useProjectScriptSides, useProjectShots } from '@/contexts/ProjectContext';
import { useLayout } from '@/utils/useLayout';
import Colors from '@/constants/colors';
import ImportButton from '@/components/ImportButton';
import AIImportButton from '@/components/AIImportButton';
import { ScriptSide, SidesStatus, SideAnnotation } from '@/types';
import PermissionGate from '@/contexts/PermissionGate';

const STATUS_CONFIG: Record<SidesStatus, { label: string; color: string; bg: string }> = {
  'upcoming': { label: 'UPCOMING', color: '#60A5FA', bg: '#60A5FA18' },
  'shooting-today': { label: 'TODAY', color: '#4ADE80', bg: '#4ADE8018' },
  'completed': { label: 'DONE', color: Colors.text.tertiary, bg: Colors.bg.tertiary },
  'revised': { label: 'REVISED', color: '#FBBF24', bg: '#FBBF2418' },
};

const REVISION_COLORS: Record<string, string> = {
  'white': '#FFFFFF', 'blue': '#60A5FA', 'pink': '#F472B6', 'yellow': '#FBBF24',
  'green': '#4ADE80', 'goldenrod': '#DAA520', 'buff': '#F0DC82', 'salmon': '#FA8072', 'cherry': '#DE3163',
};

const ANNOTATION_ICONS: Record<string, React.ElementType> = {
  'blocking': Users, 'performance': Eye, 'camera': Camera, 'general': MessageSquare,
};

function AnnotationChip({ annotation }: { annotation: SideAnnotation }) {
  const Icon = ANNOTATION_ICONS[annotation.type] || MessageSquare;
  const colors: Record<string, string> = {
    'blocking': '#34D399', 'performance': '#F472B6', 'camera': '#60A5FA', 'general': '#94A3B8',
  };
  const color = colors[annotation.type] || '#94A3B8';

  return (
    <View style={[styles.annotationChip, { borderColor: color + '44' }]}>
      <Icon color={color} size={12} />
      <Text style={[styles.annotationText, { color: Colors.text.secondary }]} numberOfLines={2}>
        {annotation.text}
      </Text>
    </View>
  );
}

function SideCard({ side, index, isExpanded, onPress, onEdit, onDelete, linkedShotCount }: {
  side: ScriptSide;
  index: number;
  isExpanded: boolean;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
  linkedShotCount: number;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, delay: index * 60, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 350, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, []);

  const status = STATUS_CONFIG[side.status];
  const revisionColor = side.revisionColor ? REVISION_COLORS[side.revisionColor] || '#FFFFFF' : null;
  const shootDate = new Date(side.shootDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const handleDelete = () => {
    Alert.alert('Delete Scene', `Remove Sc. ${side.sceneNumber} from sides?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);
  };

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <TouchableOpacity
        style={[
          styles.sideCard,
          side.status === 'shooting-today' && styles.todayCard,
          isExpanded && styles.expandedCard,
        ]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={styles.sceneNumberBadge}>
            <Text style={styles.sceneNumberText}>Sc. {side.sceneNumber}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.bg, borderColor: status.color + '44' }]}>
            <View style={[styles.statusDot, { backgroundColor: status.color }]} />
            <Text style={[styles.statusLabel, { color: status.color }]}>{status.label}</Text>
          </View>
          {revisionColor && (
            <View style={[styles.revisionBadge, { backgroundColor: revisionColor + '22', borderColor: revisionColor + '66' }]}>
              <View style={[styles.revisionDot, { backgroundColor: revisionColor }]} />
              <Text style={[styles.revisionLabel, { color: revisionColor }]}>{side.revisionColor?.toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.headerRight}>
            {isExpanded ? (
              <ChevronUp color={Colors.text.tertiary} size={18} />
            ) : (
              <ChevronDown color={Colors.text.tertiary} size={18} />
            )}
          </View>
        </View>

        {/* Scene Header */}
        <Text style={styles.sceneHeader}>{side.sceneHeader}</Text>

        {/* Meta row — always visible */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <FileText color={Colors.text.tertiary} size={12} />
            <Text style={styles.metaText}>pp. {side.pageStart}–{side.pageEnd} ({side.pageCount} pg)</Text>
          </View>
          <View style={styles.metaItem}>
            <Clock color={Colors.text.tertiary} size={12} />
            <Text style={styles.metaText}>{shootDate}</Text>
          </View>
          {!isExpanded && linkedShotCount > 0 && (
            <View style={styles.metaItem}>
              <Camera color={Colors.text.tertiary} size={12} />
              <Text style={styles.metaText}>{linkedShotCount} shot{linkedShotCount !== 1 ? 's' : ''}</Text>
            </View>
          )}
        </View>

        {/* === EXPANDED CONTENT === */}
        {isExpanded && (
          <>
            {/* Synopsis */}
            <Text style={styles.synopsis}>{side.synopsis}</Text>

            {/* Cast */}
            {side.castIds.length > 0 && (
              <View style={styles.castRow}>
                <Users color={Colors.accent.goldDim} size={13} />
                <Text style={styles.castText}>{side.castIds.join(', ')}</Text>
              </View>
            )}

            {/* Annotations */}
            {side.annotations.length > 0 && (
              <View style={styles.annotationsSection}>
                <Text style={styles.annotationsLabel}>{side.annotations.length} note{side.annotations.length !== 1 ? 's' : ''}</Text>
                <View style={styles.annotationsList}>
                  {side.annotations.slice(0, 3).map((ann) => (
                    <AnnotationChip key={ann.id} annotation={ann} />
                  ))}
                  {side.annotations.length > 3 && (
                    <Text style={styles.moreAnnotations}>+{side.annotations.length - 3} more</Text>
                  )}
                </View>
              </View>
            )}

            {/* Notes */}
            {side.notes ? (
              <View style={styles.notesSection}>
                <Tag color={Colors.accent.goldDim} size={12} />
                <Text style={styles.notesText}>{side.notes}</Text>
              </View>
            ) : null}

            {/* Footer with linked shots + action buttons */}
            <View style={styles.cardFooter}>
              <View style={styles.linkedShots}>
                <Camera color={Colors.text.tertiary} size={12} />
                <Text style={styles.linkedShotsText}>
                  {linkedShotCount > 0 ? `${linkedShotCount} linked shot${linkedShotCount !== 1 ? 's' : ''}` : 'No linked shots'}
                </Text>
              </View>
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  onPress={onEdit}
                  style={styles.editBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Pencil color={Colors.accent.gold} size={15} />
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleDelete}
                  style={styles.deleteBtnAction}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Trash2 color={Colors.status.error} size={15} />
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function ScriptSidesScreen() {
  const { activeProjectId, deleteScriptSide } = useProjects();
  const sides = useProjectScriptSides(activeProjectId);
  const shots = useProjectShots(activeProjectId);
  const router = useRouter();
  const { isTablet, contentPadding } = useLayout();
  const [filter, setFilter] = useState<SidesStatus | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredSides = filter === 'all'
    ? sides
    : sides.filter(s => s.status === filter);

  const todayCount = sides.filter(s => s.status === 'shooting-today').length;
  const totalPages = sides.reduce((sum, s) => sum + s.pageCount, 0);
  const completedPages = sides.filter(s => s.status === 'completed').reduce((sum, s) => sum + s.pageCount, 0);

  const getLinkedShotCount = useCallback((side: ScriptSide) => {
    return shots.filter(s => side.linkedShotIds.includes(s.id)).length;
  }, [shots]);

  const renderSide = useCallback(({ item, index }: { item: ScriptSide; index: number }) => (
    <SideCard
      side={item}
      index={index}
      isExpanded={expandedId === item.id}
      onPress={() => setExpandedId(expandedId === item.id ? null : item.id)}
      onEdit={() => router.push(`/new-script-side?id=${item.id}` as never)}
      onDelete={() => deleteScriptSide(item.id)}
      linkedShotCount={getLinkedShotCount(item)}
    />
  ), [expandedId, deleteScriptSide, getLinkedShotCount]);

  const filters: { key: SidesStatus | 'all'; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'shooting-today', label: 'Today' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'revised', label: 'Revised' },
    { key: 'completed', label: 'Done' },
  ];

  return (
    <PermissionGate resource="script_sides">
    <View style={styles.container}>
      <FlatList
        data={filteredSides}
        keyExtractor={item => item.id}
        renderItem={renderSide}
        contentContainerStyle={[styles.list, {
          paddingHorizontal: contentPadding,
          maxWidth: isTablet ? 800 : undefined,
          alignSelf: isTablet ? 'center' as const : undefined,
          width: isTablet ? '100%' : undefined,
        }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
      <View style={{ position: 'absolute', top: 10, right: 16, zIndex: 10 }}><ImportButton entityKey="scriptSides" variant="compact" />
        <AIImportButton entityKey="scriptSides" variant="compact" /></View>
            <View style={styles.statsBar}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{sides.length}</Text>
                <Text style={styles.statLabel}>Scenes</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{totalPages.toFixed(1)}</Text>
                <Text style={styles.statLabel}>Pages</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, todayCount > 0 && { color: '#4ADE80' }]}>{todayCount}</Text>
                <Text style={styles.statLabel}>Today</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{completedPages.toFixed(1)}</Text>
                <Text style={styles.statLabel}>Done</Text>
              </View>
            </View>

            <View style={styles.filterRow}>
              {filters.map(f => (
                <TouchableOpacity key={f.key}
                  style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
                  onPress={() => setFilter(f.key)}>
                  <Text style={[styles.filterChipText, filter === f.key && styles.filterChipTextActive]}>{f.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <FileText color={Colors.text.tertiary} size={48} />
            <Text style={styles.emptyTitle}>No sides yet</Text>
            <Text style={styles.emptySubtitle}>Add your daily shooting scenes</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/new-script-side' as never)}
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
  statsBar: {
    flexDirection: 'row', backgroundColor: Colors.bg.card, borderRadius: 12, padding: 16,
    marginBottom: 16, borderWidth: 0.5, borderColor: Colors.border.subtle, justifyContent: 'space-around',
  },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '700' as const, color: Colors.text.primary },
  statLabel: { fontSize: 11, color: Colors.text.tertiary, marginTop: 2, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  statDivider: { width: 1, backgroundColor: Colors.border.subtle },
  filterRow: { flexDirection: 'row', marginBottom: 16, gap: 8, flexWrap: 'wrap' },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.bg.card, borderWidth: 0.5, borderColor: Colors.border.subtle },
  filterChipActive: { backgroundColor: Colors.accent.goldBg, borderColor: Colors.accent.gold + '44' },
  filterChipText: { fontSize: 12, fontWeight: '600' as const, color: Colors.text.secondary },
  filterChipTextActive: { color: Colors.accent.gold },
  sideCard: { backgroundColor: Colors.bg.card, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 0.5, borderColor: Colors.border.subtle },
  todayCard: { borderColor: '#4ADE8044', borderWidth: 1 },
  expandedCard: { borderColor: Colors.accent.gold + '44', borderWidth: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  sceneNumberBadge: { backgroundColor: Colors.accent.goldBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 0.5, borderColor: Colors.accent.gold + '33' },
  sceneNumberText: { fontSize: 13, fontWeight: '700' as const, color: Colors.accent.gold, letterSpacing: 0.3 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, borderWidth: 0.5 },
  statusDot: { width: 5, height: 5, borderRadius: 2.5, marginRight: 5 },
  statusLabel: { fontSize: 9, fontWeight: '700' as const, letterSpacing: 0.8 },
  revisionBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, borderWidth: 0.5 },
  revisionDot: { width: 5, height: 5, borderRadius: 2.5, marginRight: 5 },
  revisionLabel: { fontSize: 9, fontWeight: '700' as const, letterSpacing: 0.5 },
  headerRight: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 12 },
  sceneHeader: { fontSize: 17, fontWeight: '700' as const, color: Colors.text.primary, letterSpacing: 0.2, marginBottom: 8 },
  metaRow: { flexDirection: 'row', gap: 16, marginBottom: 10, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: Colors.text.tertiary },
  synopsis: { fontSize: 13, color: Colors.text.secondary, lineHeight: 19, marginBottom: 10 },
  castRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  castText: { fontSize: 12, color: Colors.accent.goldLight, fontWeight: '500' as const },
  annotationsSection: { marginBottom: 10 },
  annotationsLabel: { fontSize: 11, color: Colors.text.tertiary, fontWeight: '600' as const, marginBottom: 6, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  annotationsList: { gap: 6 },
  annotationChip: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 0.5, backgroundColor: Colors.bg.tertiary },
  annotationText: { fontSize: 12, flex: 1, lineHeight: 17 },
  moreAnnotations: { fontSize: 11, color: Colors.text.tertiary, fontStyle: 'italic', marginTop: 2 },
  notesSection: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 10, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.accent.goldBg },
  notesText: { fontSize: 12, color: Colors.accent.goldLight, flex: 1, lineHeight: 17 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 0.5, borderTopColor: Colors.border.subtle },
  linkedShots: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  linkedShotsText: { fontSize: 11, color: Colors.text.tertiary },
  actionButtons: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.accent.goldBg, borderWidth: 0.5, borderColor: Colors.accent.gold + '44' },
  editBtnText: { fontSize: 12, fontWeight: '600' as const, color: Colors.accent.gold },
  deleteBtnAction: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.status.error + '12', borderWidth: 0.5, borderColor: Colors.status.error + '44' },
  deleteBtnText: { fontSize: 12, fontWeight: '600' as const, color: Colors.status.error },
  emptyContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600' as const, color: Colors.text.primary, marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: Colors.text.secondary, marginTop: 4 },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.accent.gold, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.accent.gold, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
});
