import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Animated, Alert } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Plus, User, Phone, Mail, Film, Calendar, Star, Trash2, ChevronDown, ChevronUp, Pencil } from 'lucide-react-native';
import { useProjects, useProjectCast } from '@/contexts/ProjectContext';
import { useLayout } from '@/utils/useLayout';
import Colors from '@/constants/colors';
import ImportButton from '@/components/ImportButton';
import AIImportButton from '@/components/AIImportButton';
import { CastMember, CastStatus } from '@/types';
import PermissionGate from '@/contexts/PermissionGate';

const STATUS_CONFIG: Record<CastStatus, { label: string; color: string }> = {
  'confirmed': { label: 'CONFIRMED', color: '#4ADE80' },
  'in-talks': { label: 'IN TALKS', color: '#FBBF24' },
  'auditioned': { label: 'AUDITIONED', color: '#60A5FA' },
  'wishlist': { label: 'WISHLIST', color: '#E879F9' },
  'wrapped': { label: 'WRAPPED', color: Colors.text.tertiary },
};

const STATUS_ORDER: CastStatus[] = ['wishlist', 'auditioned', 'in-talks', 'confirmed', 'wrapped'];

function CastCard({ member, index, onEdit, onDelete, onStatusChange }: {
  member: CastMember;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (newStatus: CastStatus) => void;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, delay: index * 60, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 350, delay: index * 60, useNativeDriver: true }),
    ]).start();
  }, []);

  const status = STATUS_CONFIG[member.status];

  const handleDelete = () => {
    Alert.alert('Remove Cast', `Remove ${member.actorName || member.characterName}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: onDelete },
    ]);
  };

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <TouchableOpacity
        style={[styles.castCard, expanded && styles.expandedCard]}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        {/* Top row: headshot + basic info */}
        <View style={styles.cardTop}>
          {member.headshot ? (
            <Image source={{ uri: member.headshot }} style={styles.headshot} contentFit="cover" />
          ) : (
            <View style={[styles.headshot, styles.headshotPlaceholder]}>
              <User color={Colors.text.tertiary} size={24} />
            </View>
          )}
          <View style={styles.cardInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.characterName}>{member.characterName}</Text>
              <View style={[styles.statusBadge, { backgroundColor: status.color + '18', borderColor: status.color + '44' }]}>
                <View style={[styles.statusDot, { backgroundColor: status.color }]} />
                <Text style={[styles.statusLabel, { color: status.color }]}>{status.label}</Text>
              </View>
            </View>
            <Text style={styles.actorName}>{member.actorName || 'TBD — Uncast'}</Text>
            <Text style={styles.characterDesc} numberOfLines={2}>{member.characterDescription}</Text>
            <View style={styles.quickStats}>
              <View style={styles.quickStat}>
                <Film color={Colors.text.tertiary} size={11} />
                <Text style={styles.quickStatText}>{member.scenes.length} scene{member.scenes.length !== 1 ? 's' : ''}</Text>
              </View>
              <View style={styles.quickStat}>
                <Calendar color={Colors.text.tertiary} size={11} />
                <Text style={styles.quickStatText}>{member.shootDays.length} day{member.shootDays.length !== 1 ? 's' : ''}</Text>
              </View>
            </View>
          </View>
          <View style={styles.cardActions}>
            {expanded ? <ChevronUp color={Colors.text.tertiary} size={16} /> : <ChevronDown color={Colors.text.tertiary} size={16} />}
          </View>
        </View>

        {/* Expanded detail */}
        {expanded && (
          <View style={styles.expandedSection}>
            {/* Quick Status Toggle */}
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>STATUS</Text>
              <View style={styles.statusToggleRow}>
                {STATUS_ORDER.map(s => {
                  const cfg = STATUS_CONFIG[s];
                  const isActive = member.status === s;
                  return (
                    <TouchableOpacity
                      key={s}
                      style={[
                        styles.statusToggleChip,
                        isActive && { backgroundColor: cfg.color + '22', borderColor: cfg.color + '66' },
                      ]}
                      onPress={() => onStatusChange(s)}
                    >
                      <View style={[styles.statusToggleDot, { backgroundColor: isActive ? cfg.color : Colors.text.tertiary + '44' }]} />
                      <Text style={[styles.statusToggleText, isActive && { color: cfg.color, fontWeight: '700' }]}>{cfg.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Contact */}
            {(member.email || member.phone) && (
              <View style={styles.detailBlock}>
                <Text style={styles.detailLabel}>CONTACT</Text>
                {member.email && (
                  <View style={styles.detailRow}>
                    <Mail color={Colors.text.tertiary} size={12} />
                    <Text style={styles.detailText}>{member.email}</Text>
                  </View>
                )}
                {member.phone && (
                  <View style={styles.detailRow}>
                    <Phone color={Colors.text.tertiary} size={12} />
                    <Text style={styles.detailText}>{member.phone}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Agent */}
            {member.agentName && (
              <View style={styles.detailBlock}>
                <Text style={styles.detailLabel}>REPRESENTATION</Text>
                <Text style={styles.detailText}>{member.agentName}</Text>
                {member.agentContact && <Text style={styles.detailTextDim}>{member.agentContact}</Text>}
              </View>
            )}

            {/* Scenes */}
            {member.scenes.length > 0 && (
              <View style={styles.detailBlock}>
                <Text style={styles.detailLabel}>SCENES</Text>
                <View style={styles.sceneChips}>
                  {member.scenes.map(sc => (
                    <View key={sc} style={styles.sceneChip}>
                      <Text style={styles.sceneChipText}>Sc. {sc}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Availability */}
            {member.availability ? (
              <View style={styles.detailBlock}>
                <Text style={styles.detailLabel}>AVAILABILITY</Text>
                <Text style={styles.detailText}>{member.availability}</Text>
              </View>
            ) : null}

            {/* Performance Notes */}
            {member.performanceNotes ? (
              <View style={styles.detailBlock}>
                <Text style={styles.detailLabel}>DIRECTOR'S PERFORMANCE NOTES</Text>
                <Text style={styles.detailText}>{member.performanceNotes}</Text>
              </View>
            ) : null}

            {/* Preferred Takes */}
            {member.preferredTakes ? (
              <View style={styles.detailBlock}>
                <Text style={[styles.detailLabel, { color: Colors.accent.gold }]}>
                  <Star color={Colors.accent.gold} size={10} /> CIRCLE SELECTS
                </Text>
                <Text style={styles.detailText}>{member.preferredTakes}</Text>
              </View>
            ) : null}

            {/* Costume */}
            {member.costumeNotes ? (
              <View style={styles.detailBlock}>
                <Text style={styles.detailLabel}>WARDROBE / COSTUME</Text>
                <Text style={styles.detailText}>{member.costumeNotes}</Text>
              </View>
            ) : null}

            {/* Action buttons */}
            <View style={styles.footerActions}>
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
    </Animated.View>
  );
}

export default function CastManagerScreen() {
  const { activeProjectId, deleteCastMember, updateCastMember } = useProjects();
  const cast = useProjectCast(activeProjectId);
  const router = useRouter();
  const { isTablet, contentPadding } = useLayout();
  const [filter, setFilter] = useState<CastStatus | 'all'>('all');

  const filteredCast = filter === 'all' ? cast : cast.filter(c => c.status === filter);
  const confirmed = cast.filter(c => c.status === 'confirmed').length;
  const totalScenes = [...new Set(cast.flatMap(c => c.scenes))].length;
  const totalDays = [...new Set(cast.flatMap(c => c.shootDays))].length;

  const filters: { key: CastStatus | 'all'; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'confirmed', label: 'Confirmed' },
    { key: 'in-talks', label: 'In Talks' },
    { key: 'auditioned', label: 'Auditioned' },
    { key: 'wishlist', label: 'Wishlist' },
    { key: 'wrapped', label: 'Wrapped' },
  ];

  const handleStatusChange = useCallback((member: CastMember, newStatus: CastStatus) => {
    updateCastMember({ ...member, status: newStatus });
  }, [updateCastMember]);

  const renderCast = useCallback(({ item, index }: { item: CastMember; index: number }) => (
    <CastCard
      member={item}
      index={index}
      onEdit={() => router.push(`/new-cast-member?id=${item.id}` as never)}
      onDelete={() => deleteCastMember(item.id)}
      onStatusChange={(newStatus) => handleStatusChange(item, newStatus)}
    />
  ), [deleteCastMember, handleStatusChange]);

  return (
    <PermissionGate resource="cast">
    <View style={styles.container}>
      <FlatList
        data={filteredCast}
        keyExtractor={item => item.id}
        renderItem={renderCast}
        contentContainerStyle={[styles.list, {
          paddingHorizontal: contentPadding,
          maxWidth: isTablet ? 800 : undefined,
          alignSelf: isTablet ? 'center' as const : undefined,
          width: isTablet ? '100%' : undefined,
        }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
      <View style={{ position: 'absolute', top: 10, right: 16, zIndex: 10 }}><ImportButton entityKey="cast" variant="compact" />
        <AIImportButton entityKey="cast" variant="compact" /></View>
            <View style={styles.statsBar}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{cast.length}</Text>
                <Text style={styles.statLabel}>Cast</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#4ADE80' }]}>{confirmed}</Text>
                <Text style={styles.statLabel}>Confirmed</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{totalScenes}</Text>
                <Text style={styles.statLabel}>Scenes</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{totalDays}</Text>
                <Text style={styles.statLabel}>Shoot Days</Text>
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
            <User color={Colors.text.tertiary} size={48} />
            <Text style={styles.emptyTitle}>No cast yet</Text>
            <Text style={styles.emptySubtitle}>Add actors and characters</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/new-cast-member' as never)}
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
  statsBar: { flexDirection: 'row', backgroundColor: Colors.bg.card, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 0.5, borderColor: Colors.border.subtle, justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '700' as const, color: Colors.text.primary },
  statLabel: { fontSize: 11, color: Colors.text.tertiary, marginTop: 2, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  statDivider: { width: 1, backgroundColor: Colors.border.subtle },
  filterRow: { flexDirection: 'row', marginBottom: 16, gap: 8, flexWrap: 'wrap' },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: Colors.bg.card, borderWidth: 0.5, borderColor: Colors.border.subtle },
  filterChipActive: { backgroundColor: Colors.accent.goldBg, borderColor: Colors.accent.gold + '44' },
  filterChipText: { fontSize: 12, fontWeight: '600' as const, color: Colors.text.secondary },
  filterChipTextActive: { color: Colors.accent.gold },
  castCard: { backgroundColor: Colors.bg.card, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 0.5, borderColor: Colors.border.subtle },
  expandedCard: { borderColor: Colors.accent.gold + '44', borderWidth: 1 },
  cardTop: { flexDirection: 'row', gap: 12 },
  headshot: { width: 64, height: 80, borderRadius: 10 },
  headshotPlaceholder: { backgroundColor: Colors.bg.tertiary, justifyContent: 'center', alignItems: 'center' },
  cardInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' },
  characterName: { fontSize: 17, fontWeight: '700' as const, color: Colors.text.primary },
  statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, borderWidth: 0.5 },
  statusDot: { width: 5, height: 5, borderRadius: 2.5, marginRight: 5 },
  statusLabel: { fontSize: 9, fontWeight: '700' as const, letterSpacing: 0.8 },
  actorName: { fontSize: 14, color: Colors.accent.goldLight, fontWeight: '600' as const, marginBottom: 4 },
  characterDesc: { fontSize: 12, color: Colors.text.secondary, lineHeight: 17, marginBottom: 8 },
  quickStats: { flexDirection: 'row', gap: 12 },
  quickStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  quickStatText: { fontSize: 11, color: Colors.text.tertiary },
  cardActions: { alignItems: 'center', gap: 12 },
  expandedSection: { marginTop: 14, paddingTop: 14, borderTopWidth: 0.5, borderTopColor: Colors.border.subtle },
  detailBlock: { marginBottom: 14 },
  detailLabel: { fontSize: 10, fontWeight: '700' as const, color: Colors.text.tertiary, letterSpacing: 0.8, marginBottom: 5 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  detailText: { fontSize: 13, color: Colors.text.secondary, lineHeight: 19 },
  detailTextDim: { fontSize: 12, color: Colors.text.tertiary, marginTop: 2 },
  sceneChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sceneChip: { backgroundColor: Colors.accent.goldBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 0.5, borderColor: Colors.accent.gold + '33' },
  sceneChipText: { fontSize: 11, fontWeight: '600' as const, color: Colors.accent.gold },
  // Quick status toggle
  statusToggleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusToggleChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, backgroundColor: Colors.bg.tertiary, borderWidth: 0.5, borderColor: Colors.border.subtle },
  statusToggleDot: { width: 7, height: 7, borderRadius: 3.5 },
  statusToggleText: { fontSize: 11, color: Colors.text.secondary, fontWeight: '500' as const },
  // Action buttons
  footerActions: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: Colors.border.subtle },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.accent.goldBg, borderWidth: 0.5, borderColor: Colors.accent.gold + '44' },
  editBtnText: { fontSize: 12, fontWeight: '600' as const, color: Colors.accent.gold },
  deleteBtnAction: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.status.error + '12', borderWidth: 0.5, borderColor: Colors.status.error + '44' },
  deleteBtnText: { fontSize: 12, fontWeight: '600' as const, color: Colors.status.error },
  emptyContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600' as const, color: Colors.text.primary, marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: Colors.text.secondary, marginTop: 4 },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.accent.gold, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.accent.gold, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
});
