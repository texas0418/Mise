import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, TextInput } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Plus, DollarSign, AlertCircle, Check, Clock, ChevronDown, ChevronUp, Pencil, Trash2, Search, ArrowUpDown } from 'lucide-react-native';
import { useProjects, useProjectBudget } from '@/contexts/ProjectContext';
import { useLayout } from '@/utils/useLayout';
import Colors from '@/constants/colors';
import ImportButton from '@/components/ImportButton';
import AIImportButton from '@/components/AIImportButton';
import { BudgetItem, BudgetCategory } from '@/types';
import PermissionGate from '@/contexts/PermissionGate';

const CATEGORY_COLORS: Record<BudgetCategory, string> = {
  'talent': '#FB923C', 'crew': '#60A5FA', 'equipment': '#A78BFA', 'locations': '#4ADE80',
  'production-design': '#F472B6', 'post-production': '#34D399', 'music': '#E879F9', 'marketing': '#FBBF24',
  'legal': '#94A3B8', 'insurance': '#64748B', 'catering': '#FB7185', 'transport': '#38BDF8',
  'contingency': '#CBD5E1', 'other': '#6B7280',
};

const CATEGORY_LABELS: Record<BudgetCategory, string> = {
  'talent': 'Talent', 'crew': 'Crew', 'equipment': 'Equipment', 'locations': 'Locations',
  'production-design': 'Prod Design', 'post-production': 'Post', 'music': 'Music', 'marketing': 'Marketing',
  'legal': 'Legal', 'insurance': 'Insurance', 'catering': 'Catering', 'transport': 'Transport',
  'contingency': 'Contingency', 'other': 'Other',
};

type SortMode = 'category' | 'amount-desc' | 'amount-asc' | 'paid' | 'unpaid';

const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: 'category', label: 'Category' },
  { key: 'amount-desc', label: 'Amount ↓' },
  { key: 'amount-asc', label: 'Amount ↑' },
  { key: 'paid', label: 'Paid First' },
  { key: 'unpaid', label: 'Unpaid First' },
];

function formatCurrency(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function BudgetCard({ item, isExpanded, onPress, onEdit, onDelete }: {
  item: BudgetItem;
  isExpanded: boolean;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const catColor = CATEGORY_COLORS[item.category] ?? Colors.text.tertiary;
  const variance = item.estimated - item.actual;

  const handleDelete = () => {
    Alert.alert('Delete Budget Item', `Remove "${item.description}"?`, [
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
      <View style={styles.cardRow}>
        <View style={styles.cardLeft}>
          <View style={[styles.catDot, { backgroundColor: catColor }]} />
        </View>
        <View style={styles.cardCenter}>
          <Text style={styles.desc}>{item.description}</Text>
          <View style={styles.metaRow}>
            <Text style={[styles.catLabel, { color: catColor }]}>{CATEGORY_LABELS[item.category]}</Text>
            {item.paid && (
              <View style={styles.paidBadge}>
                <Check color={Colors.status.active} size={9} />
                <Text style={styles.paidText}>Paid</Text>
              </View>
            )}
            {!item.paid && item.actual === 0 && (
              <View style={styles.pendingBadge}>
                <Clock color={Colors.text.tertiary} size={9} />
                <Text style={styles.pendingText}>Pending</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.cardRight}>
          <Text style={styles.estimated}>{formatCurrency(item.estimated)}</Text>
          {item.actual > 0 && (
            <Text style={[styles.actual, { color: variance >= 0 ? Colors.status.active : Colors.status.error }]}>
              {formatCurrency(item.actual)}
            </Text>
          )}
          {isExpanded ? <ChevronUp color={Colors.text.tertiary} size={14} /> : <ChevronDown color={Colors.text.tertiary} size={14} />}
        </View>
      </View>

      {isExpanded && (
        <View style={styles.expandedBody}>
          <View style={styles.expandedRow}>
            <View style={styles.expandedCol}>
              <Text style={styles.detailLabel}>ESTIMATED</Text>
              <Text style={styles.detailValue}>{formatCurrency(item.estimated)}</Text>
            </View>
            <View style={styles.expandedCol}>
              <Text style={styles.detailLabel}>ACTUAL</Text>
              <Text style={[styles.detailValue, { color: variance >= 0 ? Colors.status.active : Colors.status.error }]}>{formatCurrency(item.actual)}</Text>
            </View>
            <View style={styles.expandedCol}>
              <Text style={styles.detailLabel}>VARIANCE</Text>
              <Text style={[styles.detailValue, { color: variance >= 0 ? Colors.status.active : Colors.status.error }]}>
                {variance >= 0 ? '+' : ''}{formatCurrency(variance)}
              </Text>
            </View>
          </View>

          {item.vendor && (
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>VENDOR</Text>
              <Text style={styles.detailText}>{item.vendor}</Text>
            </View>
          )}

          {item.notes ? (
            <View style={styles.detailBlock}>
              <Text style={styles.detailLabel}>NOTES</Text>
              <Text style={styles.detailText}>{item.notes}</Text>
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

export default function BudgetScreen() {
  const { activeProject, activeProjectId, deleteBudgetItem } = useProjects();
  const budget = useProjectBudget(activeProjectId);
  const router = useRouter();
  const { isTablet, contentPadding } = useLayout();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('category');
  const [showSortOptions, setShowSortOptions] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<BudgetCategory | 'all'>('all');

  const stats = useMemo(() => {
    const totalEstimated = budget.reduce((s, b) => s + b.estimated, 0);
    const totalActual = budget.reduce((s, b) => s + b.actual, 0);
    const totalPaid = budget.filter(b => b.paid).reduce((s, b) => s + b.actual, 0);
    return { totalEstimated, totalActual, totalPaid, remaining: totalEstimated - totalActual };
  }, [budget]);

  // Get unique categories in the data for filter chips
  const activeCategories = useMemo(() => {
    const cats = [...new Set(budget.map(b => b.category))];
    return cats.sort();
  }, [budget]);

  const filteredAndSorted = useMemo(() => {
    let items = [...budget];

    // Category filter
    if (categoryFilter !== 'all') {
      items = items.filter(b => b.category === categoryFilter);
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(b =>
        b.description.toLowerCase().includes(q) ||
        CATEGORY_LABELS[b.category].toLowerCase().includes(q) ||
        (b.vendor && b.vendor.toLowerCase().includes(q)) ||
        (b.notes && b.notes.toLowerCase().includes(q))
      );
    }

    // Sort
    switch (sortMode) {
      case 'category':
        items.sort((a, b) => a.category.localeCompare(b.category));
        break;
      case 'amount-desc':
        items.sort((a, b) => b.estimated - a.estimated);
        break;
      case 'amount-asc':
        items.sort((a, b) => a.estimated - b.estimated);
        break;
      case 'paid':
        items.sort((a, b) => (b.paid ? 1 : 0) - (a.paid ? 1 : 0));
        break;
      case 'unpaid':
        items.sort((a, b) => (a.paid ? 1 : 0) - (b.paid ? 1 : 0));
        break;
    }

    return items;
  }, [budget, searchQuery, sortMode, categoryFilter]);

  if (!activeProject) {
    return (
      <View style={styles.emptyContainer}>
        <Stack.Screen options={{ title: 'Budget' }} />
        <AlertCircle color={Colors.text.tertiary} size={48} />
        <Text style={styles.emptyTitle}>No project selected</Text>
      </View>
    );
  }

  const spentPercent = stats.totalEstimated > 0 ? Math.min(100, (stats.totalActual / stats.totalEstimated) * 100) : 0;

  return (
    <PermissionGate resource="budget">
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Budget' }} />

      <FlatList
        data={filteredAndSorted}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <BudgetCard
            item={item}
            isExpanded={expandedId === item.id}
            onPress={() => setExpandedId(expandedId === item.id ? null : item.id)}
            onEdit={() => router.push(`/new-budget-item?id=${item.id}` as never)}
            onDelete={() => deleteBudgetItem(item.id)}
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
            {/* Summary card */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Budget</Text>
                  <Text style={styles.summaryValue}>{formatCurrency(stats.totalEstimated)}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Spent</Text>
                  <Text style={[styles.summaryValue, { color: Colors.status.warning }]}>{formatCurrency(stats.totalActual)}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryLabel}>Remaining</Text>
                  <Text style={[styles.summaryValue, { color: stats.remaining >= 0 ? Colors.status.active : Colors.status.error }]}>{formatCurrency(stats.remaining)}</Text>
                </View>
              </View>
              <View style={styles.progressBg}>
                <View style={[styles.progressFill, { width: `${spentPercent}%` as unknown as number, backgroundColor: spentPercent > 90 ? Colors.status.error : spentPercent > 70 ? Colors.status.warning : Colors.accent.gold }]} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}><ImportButton entityKey="budget" />
        <AIImportButton entityKey="budget" variant="compact" /></View>
              <Text style={styles.progressText}>{spentPercent.toFixed(0)}% of budget used · {budget.length} items</Text>
            </View>

            {/* Search bar */}
            <View style={styles.searchRow}>
              <View style={styles.searchBar}>
                <Search color={Colors.text.tertiary} size={16} />
                <TextInput
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search budget items..."
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

            {/* Category filter chips */}
            <View style={styles.filterRow}>
              <TouchableOpacity
                style={[styles.filterChip, categoryFilter === 'all' && styles.filterChipActive]}
                onPress={() => setCategoryFilter('all')}>
                <Text style={[styles.filterChipText, categoryFilter === 'all' && styles.filterChipTextActive]}>All</Text>
              </TouchableOpacity>
              {activeCategories.map(cat => (
                <TouchableOpacity key={cat}
                  style={[styles.filterChip, categoryFilter === cat && styles.filterChipActive]}
                  onPress={() => setCategoryFilter(categoryFilter === cat ? 'all' : cat)}>
                  <View style={[styles.filterDot, { backgroundColor: CATEGORY_COLORS[cat] }]} />
                  <Text style={[styles.filterChipText, categoryFilter === cat && styles.filterChipTextActive]}>
                    {CATEGORY_LABELS[cat]}
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
          <View style={styles.emptyInner}>
            <DollarSign color={Colors.text.tertiary} size={48} />
            <Text style={styles.emptyTitle}>{searchQuery ? 'No matching items' : 'No budget items'}</Text>
            <Text style={styles.emptySubtitle}>{searchQuery ? 'Try a different search' : 'Track your production spending'}</Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={() => router.push('/new-budget-item' as never)} activeOpacity={0.8}>
        <Plus color={Colors.text.inverse} size={24} />
      </TouchableOpacity>
    </View>
  </PermissionGate>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  summaryCard: { backgroundColor: Colors.bg.card, borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 0.5, borderColor: Colors.border.subtle },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: { fontSize: 10, color: Colors.text.tertiary, fontWeight: '600' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  summaryValue: { fontSize: 18, fontWeight: '700' as const, color: Colors.text.primary, marginTop: 4 },
  summaryDivider: { width: 1, height: 32, backgroundColor: Colors.border.subtle },
  progressBg: { height: 4, backgroundColor: Colors.bg.elevated, borderRadius: 2, marginTop: 14, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2 },
  progressText: { fontSize: 11, color: Colors.text.tertiary, textAlign: 'center', marginTop: 6 },
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
  list: { padding: 16, paddingBottom: 100 },
  // Card
  card: { backgroundColor: Colors.bg.card, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 0.5, borderColor: Colors.border.subtle },
  cardExpanded: { borderColor: Colors.accent.gold + '44', borderWidth: 1 },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  cardLeft: { marginRight: 12 },
  catDot: { width: 8, height: 8, borderRadius: 4 },
  cardCenter: { flex: 1 },
  desc: { fontSize: 14, fontWeight: '500' as const, color: Colors.text.primary },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  catLabel: { fontSize: 11, fontWeight: '600' as const },
  paidBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  paidText: { fontSize: 10, color: Colors.status.active, fontWeight: '600' as const },
  pendingBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  pendingText: { fontSize: 10, color: Colors.text.tertiary, fontWeight: '500' as const },
  cardRight: { alignItems: 'flex-end', marginLeft: 8, gap: 2 },
  estimated: { fontSize: 14, fontWeight: '700' as const, color: Colors.text.primary },
  actual: { fontSize: 11, fontWeight: '600' as const },
  // Expanded
  expandedBody: { marginTop: 12, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: Colors.border.subtle },
  expandedRow: { flexDirection: 'row', marginBottom: 12 },
  expandedCol: { flex: 1, alignItems: 'center' },
  detailLabel: { fontSize: 9, fontWeight: '700' as const, color: Colors.text.tertiary, letterSpacing: 0.8, marginBottom: 3 },
  detailValue: { fontSize: 15, fontWeight: '700' as const, color: Colors.text.primary },
  detailBlock: { marginBottom: 10 },
  detailText: { fontSize: 12, color: Colors.text.secondary, lineHeight: 18 },
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
