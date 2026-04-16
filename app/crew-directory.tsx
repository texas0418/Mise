import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Linking, Platform, Alert, TextInput } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Phone, Mail, Users, Plus, ChevronDown, ChevronUp, Pencil, Trash2, Search, ArrowUpDown } from 'lucide-react-native';
import { useProjects } from '@/contexts/ProjectContext';
import { useLayout } from '@/utils/useLayout';
import Colors from '@/constants/colors';
import ImportButton from '@/components/ImportButton';
import AIImportButton from '@/components/AIImportButton';
import { CrewMember, Department } from '@/types';
import PermissionGate from '@/contexts/PermissionGate';

const DEPT_LABELS: Record<Department, string> = {
  direction: 'Direction', camera: 'Camera', sound: 'Sound', art: 'Art',
  lighting: 'Lighting', production: 'Production', talent: 'Talent', postProduction: 'Post-Production',
};

type SortMode = 'name-asc' | 'name-desc' | 'department' | 'role';

const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: 'name-asc', label: 'Name A→Z' },
  { key: 'name-desc', label: 'Name Z→A' },
  { key: 'department', label: 'Department' },
  { key: 'role', label: 'Role' },
];

function CrewCard({ member, isExpanded, onPress, onEdit, onDelete }: {
  member: CrewMember;
  isExpanded: boolean;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const deptColor = Colors.department[member.department];
  const initials = member.name.split(' ').map(n => n[0]).join('').slice(0, 2);

  const handleDelete = () => {
    Alert.alert('Remove Crew Member', `Delete "${member.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);
  };

  return (
    <TouchableOpacity
      style={[styles.crewCard, isExpanded && styles.crewCardExpanded]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.cardRow}>
        <View style={[styles.avatar, { backgroundColor: deptColor + '22', borderColor: deptColor + '44' }]}>
          <Text style={[styles.avatarText, { color: deptColor }]}>{initials}</Text>
        </View>
        <View style={styles.crewInfo}>
          <Text style={styles.crewName}>{member.name}</Text>
          <Text style={styles.crewRole}>{member.role}</Text>
        </View>
        {!isExpanded && (
          <View style={styles.crewActions}>
            <TouchableOpacity style={styles.actionBtn} onPress={() => {
              if (Platform.OS !== 'web') Linking.openURL(`tel:${member.phone}`);
            }} activeOpacity={0.7}>
              <Phone color={Colors.text.tertiary} size={16} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => Linking.openURL(`mailto:${member.email}`)} activeOpacity={0.7}>
              <Mail color={Colors.text.tertiary} size={16} />
            </TouchableOpacity>
          </View>
        )}
        {isExpanded ? <ChevronUp color={Colors.text.tertiary} size={16} /> : <ChevronDown color={Colors.text.tertiary} size={16} />}
      </View>

      {isExpanded && (
        <View style={styles.expandedBody}>
          <View style={styles.detailGrid}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>DEPARTMENT</Text>
              <View style={styles.deptBadge}>
                <View style={[styles.deptDot, { backgroundColor: deptColor }]} />
                <Text style={[styles.deptText, { color: deptColor }]}>{DEPT_LABELS[member.department]}</Text>
              </View>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>ROLE</Text>
              <Text style={styles.detailValue}>{member.role}</Text>
            </View>
          </View>

          {member.phone ? (
            <TouchableOpacity
              style={styles.contactRow}
              onPress={() => { if (Platform.OS !== 'web') Linking.openURL(`tel:${member.phone}`); }}
              activeOpacity={0.7}
            >
              <Phone color={Colors.accent.gold} size={14} />
              <Text style={styles.contactText}>{member.phone}</Text>
            </TouchableOpacity>
          ) : null}

          {member.email ? (
            <TouchableOpacity
              style={styles.contactRow}
              onPress={() => Linking.openURL(`mailto:${member.email}`)}
              activeOpacity={0.7}
            >
              <Mail color={Colors.accent.gold} size={14} />
              <Text style={styles.contactText}>{member.email}</Text>
            </TouchableOpacity>
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

export default function CrewDirectoryScreen() {
  const { crew, deleteCrewMember } = useProjects();
  const router = useRouter();
  const { isTablet, contentPadding } = useLayout();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('department');
  const [showSortOptions, setShowSortOptions] = useState(false);
  const [deptFilter, setDeptFilter] = useState<Department | 'all'>('all');

  // Get unique departments
  const activeDepts = useMemo(() => {
    const depts = [...new Set(crew.map(c => c.department))];
    return depts.sort();
  }, [crew]);

  const filteredAndSorted = useMemo(() => {
    let items = [...crew];

    // Department filter
    if (deptFilter !== 'all') {
      items = items.filter(c => c.department === deptFilter);
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.role.toLowerCase().includes(q) ||
        DEPT_LABELS[c.department].toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.includes(q)
      );
    }

    // Sort
    switch (sortMode) {
      case 'name-asc':
        items.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name-desc':
        items.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'department':
        items.sort((a, b) => a.department.localeCompare(b.department) || a.name.localeCompare(b.name));
        break;
      case 'role':
        items.sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name));
        break;
    }

    return items;
  }, [crew, searchQuery, sortMode, deptFilter]);

  // Group by department for display when sorted by department
  const deptCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    crew.forEach(c => { counts[c.department] = (counts[c.department] || 0) + 1; });
    return counts;
  }, [crew]);

  return (
    <PermissionGate resource="crew">
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Crew Directory' }} />

      <View style={styles.statsBar}>
        <Users color={Colors.accent.gold} size={16} />
        <Text style={styles.statsText}>{crew.length} member{crew.length !== 1 ? 's' : ''}</Text>
        <Text style={styles.statsDetail}>{Object.keys(deptCounts).length} dept{Object.keys(deptCounts).length !== 1 ? 's' : ''}</Text>
        <ImportButton entityKey="crew" variant="compact" />
        <AIImportButton entityKey="crew" variant="compact" />
      </View>

      <FlatList
        data={filteredAndSorted}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <CrewCard
            member={item}
            isExpanded={expandedId === item.id}
            onPress={() => setExpandedId(expandedId === item.id ? null : item.id)}
            onEdit={() => router.push(`/new-crew?id=${item.id}` as never)}
            onDelete={() => { deleteCrewMember(item.id); setExpandedId(null); }}
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
          <View>
            {/* Search bar */}
            <View style={styles.searchRow}>
              <View style={styles.searchBar}>
                <Search color={Colors.text.tertiary} size={16} />
                <TextInput
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search crew..."
                  placeholderTextColor={Colors.text.tertiary}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Text style={styles.clearSearch}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                style={[styles.sortBtn, showSortOptions && styles.sortBtnActive]}
                onPress={() => setShowSortOptions(!showSortOptions)}
              >
                <ArrowUpDown color={showSortOptions ? Colors.accent.gold : Colors.text.tertiary} size={16} />
              </TouchableOpacity>
            </View>

            {/* Sort options */}
            {showSortOptions && (
              <View style={styles.sortRow}>
                {SORT_OPTIONS.map(opt => (
                  <TouchableOpacity key={opt.key}
                    style={[styles.sortChip, sortMode === opt.key && styles.sortChipActive]}
                    onPress={() => { setSortMode(opt.key); setShowSortOptions(false); }}>
                    <Text style={[styles.sortChipText, sortMode === opt.key && styles.sortChipTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Department filter */}
            <View style={styles.filterRow}>
              <TouchableOpacity
                style={[styles.filterChip, deptFilter === 'all' && styles.filterChipActive]}
                onPress={() => setDeptFilter('all')}>
                <Text style={[styles.filterChipText, deptFilter === 'all' && styles.filterChipTextActive]}>All</Text>
              </TouchableOpacity>
              {activeDepts.map(dept => (
                <TouchableOpacity key={dept}
                  style={[styles.filterChip, deptFilter === dept && styles.filterChipActive]}
                  onPress={() => setDeptFilter(deptFilter === dept ? 'all' : dept)}>
                  <View style={[styles.filterDot, { backgroundColor: Colors.department[dept] }]} />
                  <Text style={[styles.filterChipText, deptFilter === dept && styles.filterChipTextActive]}>
                    {DEPT_LABELS[dept]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {searchQuery.trim() && (
              <Text style={styles.resultCount}>{filteredAndSorted.length} result{filteredAndSorted.length !== 1 ? 's' : ''}</Text>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Users color={Colors.text.tertiary} size={48} />
            <Text style={styles.emptyTitle}>{searchQuery ? 'No matching crew' : 'No crew members'}</Text>
            <Text style={styles.emptySubtitle}>{searchQuery ? 'Try a different search' : 'Add your crew to get started'}</Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/new-crew' as never)} activeOpacity={0.8} testID="add-crew-button">
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
  // Search
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.bg.card, borderRadius: 10, paddingHorizontal: 12, gap: 8, borderWidth: 0.5, borderColor: Colors.border.subtle },
  searchInput: { flex: 1, fontSize: 14, color: Colors.text.primary, paddingVertical: 10 },
  clearSearch: { fontSize: 14, color: Colors.text.tertiary, padding: 4 },
  sortBtn: { width: 42, height: 42, borderRadius: 10, backgroundColor: Colors.bg.card, justifyContent: 'center', alignItems: 'center', borderWidth: 0.5, borderColor: Colors.border.subtle },
  sortBtnActive: { borderColor: Colors.accent.gold + '44', backgroundColor: Colors.accent.goldBg },
  sortRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 10 },
  sortChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: Colors.bg.card, borderWidth: 0.5, borderColor: Colors.border.subtle },
  sortChipActive: { backgroundColor: Colors.accent.goldBg, borderColor: Colors.accent.gold + '44' },
  sortChipText: { fontSize: 11, color: Colors.text.secondary, fontWeight: '500' as const },
  sortChipTextActive: { color: Colors.accent.gold, fontWeight: '600' as const },
  // Filter
  filterRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginBottom: 12 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: Colors.bg.card, borderWidth: 0.5, borderColor: Colors.border.subtle },
  filterChipActive: { backgroundColor: Colors.accent.goldBg, borderColor: Colors.accent.gold + '44' },
  filterDot: { width: 7, height: 7, borderRadius: 3.5 },
  filterChipText: { fontSize: 11, color: Colors.text.secondary, fontWeight: '500' as const },
  filterChipTextActive: { color: Colors.accent.gold, fontWeight: '600' as const },
  resultCount: { fontSize: 11, color: Colors.text.tertiary, marginBottom: 8 },
  // Card
  crewCard: { backgroundColor: Colors.bg.card, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 0.5, borderColor: Colors.border.subtle },
  crewCardExpanded: { borderColor: Colors.accent.gold + '44', borderWidth: 1 },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, marginRight: 12 },
  avatarText: { fontSize: 15, fontWeight: '700' as const },
  crewInfo: { flex: 1 },
  crewName: { fontSize: 15, fontWeight: '600' as const, color: Colors.text.primary },
  crewRole: { fontSize: 12, color: Colors.text.secondary, marginTop: 2 },
  crewActions: { flexDirection: 'row', gap: 8, marginRight: 8 },
  actionBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.bg.elevated, justifyContent: 'center', alignItems: 'center' },
  // Expanded
  expandedBody: { marginTop: 12, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: Colors.border.subtle },
  detailGrid: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  detailItem: { flex: 1 },
  detailLabel: { fontSize: 9, fontWeight: '700' as const, color: Colors.text.tertiary, letterSpacing: 0.8, marginBottom: 4 },
  detailValue: { fontSize: 13, color: Colors.text.secondary },
  deptBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  deptDot: { width: 8, height: 8, borderRadius: 4 },
  deptText: { fontSize: 13, fontWeight: '600' as const },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 4, backgroundColor: Colors.bg.tertiary, borderRadius: 8, marginBottom: 6 },
  contactText: { fontSize: 14, color: Colors.accent.gold, fontWeight: '500' as const },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 10, marginTop: 4, borderTopWidth: 0.5, borderTopColor: Colors.border.subtle },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.accent.goldBg, borderWidth: 0.5, borderColor: Colors.accent.gold + '44' },
  editBtnText: { fontSize: 12, fontWeight: '600' as const, color: Colors.accent.gold },
  deleteBtnAction: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.status.error + '12', borderWidth: 0.5, borderColor: Colors.status.error + '44' },
  deleteBtnText: { fontSize: 12, fontWeight: '600' as const, color: Colors.status.error },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.accent.gold, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.accent.gold, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  emptyContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600' as const, color: Colors.text.primary, marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: Colors.text.secondary, marginTop: 4, textAlign: 'center' },
});
