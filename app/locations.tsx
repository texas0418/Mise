import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { Plus, MapPin, Star, Zap, Phone, AlertCircle, Shield, ChevronDown, ChevronUp, Pencil, Trash2, Car, ImageIcon } from 'lucide-react-native';
import { useProjects, useProjectLocations } from '@/contexts/ProjectContext';
import { useLayout } from '@/utils/useLayout';
import Colors from '@/constants/colors';
import ImportButton from '@/components/ImportButton';
import AIImportButton from '@/components/AIImportButton';
import { LocationScout } from '@/types';
import PermissionGate from '@/contexts/PermissionGate';

function LocationCard({ item, isExpanded, onPress, onEdit, onDelete }: {
  item: LocationScout;
  isExpanded: boolean;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const stars = Array.from({ length: 5 }, (_, i) => i < item.rating);

  const handleDelete = () => {
    Alert.alert('Delete Location', `Remove "${item.name}"?`, [
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
        <View style={styles.iconWrap}>
          <MapPin color={Colors.status.active} size={20} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.locationName}>{item.name}</Text>
          <Text style={styles.address} numberOfLines={1}>{item.address}</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.starsRow}>
            {stars.map((filled, i) => (
              <Star key={i} color={filled ? '#FBBF24' : Colors.text.tertiary} size={12} fill={filled ? '#FBBF24' : 'transparent'} />
            ))}
          </View>
          {isExpanded ? (
            <ChevronUp color={Colors.text.tertiary} size={16} />
          ) : (
            <ChevronDown color={Colors.text.tertiary} size={16} />
          )}
        </View>
      </View>

      {/* Badges — always visible */}
      <View style={styles.badgeRow}>
        {item.permitRequired && (
          <View style={[styles.badge, { backgroundColor: item.permitStatus === 'Approved' ? Colors.status.active + '15' : Colors.status.warning + '15' }]}>
            <Shield color={item.permitStatus === 'Approved' ? Colors.status.active : Colors.status.warning} size={10} />
            <Text style={[styles.badgeText, { color: item.permitStatus === 'Approved' ? Colors.status.active : Colors.status.warning }]}>
              Permit: {item.permitStatus}
            </Text>
          </View>
        )}
        {item.powerAvailable && (
          <View style={[styles.badge, { backgroundColor: Colors.status.info + '15' }]}>
            <Zap color={Colors.status.info} size={10} />
            <Text style={[styles.badgeText, { color: Colors.status.info }]}>Power</Text>
          </View>
        )}
        {item.scenes.length > 0 && !isExpanded && (
          <View style={[styles.badge, { backgroundColor: Colors.accent.goldBg }]}>
            <Text style={[styles.badgeText, { color: Colors.accent.gold }]}>{item.scenes.length} scene{item.scenes.length !== 1 ? 's' : ''}</Text>
          </View>
        )}
      </View>

      {/* Expanded content */}
      {isExpanded && (
        <View style={styles.expandedBody}>
          {item.scenes.length > 0 && (
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>SCENES</Text>
              <View style={styles.sceneChips}>
                {item.scenes.map(sc => (
                  <View key={sc} style={styles.sceneChip}>
                    <Text style={styles.sceneChipText}>Sc. {sc}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {item.contactName ? (
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>CONTACT</Text>
              <View style={styles.contactRow}>
                <Phone color={Colors.text.tertiary} size={11} />
                <Text style={styles.detailText}>{item.contactName}{item.contactPhone ? ` — ${item.contactPhone}` : ''}</Text>
              </View>
            </View>
          ) : null}

          {item.parkingNotes ? (
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>PARKING</Text>
              <Text style={styles.detailText}>{item.parkingNotes}</Text>
            </View>
          ) : null}

          {item.photoUrls && item.photoUrls.length > 0 && (
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>PHOTOS</Text>
              <View style={styles.photoRow}>
                {item.photoUrls.slice(0, 4).map((uri, i) => (
                  <Image key={i} source={{ uri }} style={styles.photoThumb} contentFit="cover" />
                ))}
                {item.photoUrls.length > 4 && (
                  <View style={styles.morePhotos}>
                    <ImageIcon color={Colors.text.tertiary} size={14} />
                    <Text style={styles.morePhotosText}>+{item.photoUrls.length - 4}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {item.notes ? (
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>NOTES</Text>
              <Text style={styles.notesText}>{item.notes}</Text>
            </View>
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

export default function LocationsScreen() {
  const { activeProject, activeProjectId, deleteLocation } = useProjects();
  const locations = useProjectLocations(activeProjectId);
  const router = useRouter();
  const { isTablet, contentPadding } = useLayout();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!activeProject) {
    return (
      <View style={styles.emptyContainer}>
        <Stack.Screen options={{ title: 'Locations' }} />
        <AlertCircle color={Colors.text.tertiary} size={48} />
        <Text style={styles.emptyTitle}>No project selected</Text>
      </View>
    );
  }

  return (
    <PermissionGate resource="locations">
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Locations' }} />

      <View style={{ position: 'absolute', top: 10, right: 16, zIndex: 10 }}><ImportButton entityKey="locations" variant="compact" />
        <AIImportButton entityKey="locations" variant="compact" /></View>
      <View style={styles.statsBar}>
        <MapPin color={Colors.accent.gold} size={16} />
        <Text style={styles.statsText}>{locations.length} location{locations.length !== 1 ? 's' : ''}</Text>
      </View>

      <FlatList
        data={locations}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <LocationCard
            item={item}
            isExpanded={expandedId === item.id}
            onPress={() => setExpandedId(expandedId === item.id ? null : item.id)}
            onEdit={() => router.push(`/new-location?id=${item.id}` as never)}
            onDelete={() => deleteLocation(item.id)}
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
            <MapPin color={Colors.text.tertiary} size={48} />
            <Text style={styles.emptyTitle}>No locations scouted</Text>
            <Text style={styles.emptySubtitle}>Add filming locations</Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/new-location' as never)} activeOpacity={0.8}>
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
  card: { backgroundColor: Colors.bg.card, borderRadius: 14, marginBottom: 12, borderWidth: 0.5, borderColor: Colors.border.subtle, overflow: 'hidden', padding: 14 },
  cardExpanded: { borderColor: Colors.accent.gold + '44', borderWidth: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  iconWrap: { width: 40, height: 40, borderRadius: 10, backgroundColor: Colors.status.active + '15', justifyContent: 'center', alignItems: 'center' },
  headerText: { flex: 1 },
  locationName: { fontSize: 15, fontWeight: '600' as const, color: Colors.text.primary },
  address: { fontSize: 12, color: Colors.text.secondary, marginTop: 2 },
  headerRight: { alignItems: 'center', gap: 6 },
  starsRow: { flexDirection: 'row', gap: 2 },
  badgeRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 4 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, gap: 4 },
  badgeText: { fontSize: 10, fontWeight: '600' as const },
  expandedBody: { marginTop: 8, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: Colors.border.subtle },
  detailBlock: { marginBottom: 12 },
  detailLabel: { fontSize: 9, fontWeight: '700' as const, color: Colors.text.tertiary, letterSpacing: 0.8, marginBottom: 4 },
  detailText: { fontSize: 12, color: Colors.text.secondary, lineHeight: 18 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sceneChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sceneChip: { backgroundColor: Colors.accent.goldBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 0.5, borderColor: Colors.accent.gold + '33' },
  sceneChipText: { fontSize: 11, fontWeight: '600' as const, color: Colors.accent.gold },
  photoRow: { flexDirection: 'row', gap: 8 },
  photoThumb: { width: 60, height: 60, borderRadius: 8 },
  morePhotos: { width: 60, height: 60, borderRadius: 8, backgroundColor: Colors.bg.tertiary, justifyContent: 'center', alignItems: 'center' },
  morePhotosText: { fontSize: 10, color: Colors.text.tertiary, marginTop: 2 },
  notesText: { fontSize: 12, color: Colors.text.tertiary, fontStyle: 'italic', lineHeight: 18 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: Colors.border.subtle },
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
