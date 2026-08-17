import React, { useState, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { appAlert } from '@/lib/appAlert';
import { KEYBOARD_BEHAVIOR } from '@/utils/keyboardAvoiding';
import { Stack } from 'expo-router';
import {
  Plus,
  LayoutGrid,
  LayoutList,
  Check,
  X,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  DollarSign,
  AlertCircle,
  Download,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useProjects, useProjectBudget } from '@/contexts/ProjectContext';
import { useLayout } from '@/utils/useLayout';
import Colors from '@/constants/colors';
import { money } from '@/utils/formatRecord';
import { BudgetItem, BudgetCategory } from '@/types';
import ImportButton from '@/components/ImportButton';
import PermissionGate from '@/contexts/PermissionGate';
import { exportBudgetToXlsx } from '@/utils/budgetExport';
import { useGuardedRouter } from '@/utils/useGuardedRouter';

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<BudgetCategory, string> = {
  'talent': '#FB923C', 'crew': '#60A5FA', 'equipment': '#A78BFA', 'locations': '#4ADE80',
  'production-design': '#F472B6', 'post-production': '#34D399', 'music': '#E879F9', 'marketing': '#FBBF24',
  'legal': '#94A3B8', 'insurance': '#64748B', 'catering': '#FB7185', 'transport': '#38BDF8',
  'contingency': '#CBD5E1', 'other': '#6B7280',
};

const CATEGORY_LABELS: Record<BudgetCategory, string> = {
  'talent': 'Talent', 'crew': 'Crew', 'equipment': 'Equipment', 'locations': 'Locations',
  'production-design': 'Production Design', 'post-production': 'Post-Production', 'music': 'Music', 'marketing': 'Marketing',
  'legal': 'Legal', 'insurance': 'Insurance', 'catering': 'Catering', 'transport': 'Transport',
  'contingency': 'Contingency', 'other': 'Other',
};

/** Film-industry standard category ordering (Above the Line → Below → Post → Other) */
const CATEGORY_ORDER: BudgetCategory[] = [
  'talent', 'crew', 'equipment', 'locations', 'production-design',
  'catering', 'transport', 'music', 'post-production',
  'marketing', 'legal', 'insurance', 'contingency', 'other',
];

/*
 * Column widths.
 *
 * These are the phone widths: narrower than any phone, so the grid scrolls
 * sideways inside a horizontal ScrollView. That is right on a phone and was
 * wrong everywhere else — on a 1440px browser the table stopped dead at 796px
 * and left the rest of the window empty, which is the opposite of the reason
 * to open a budget on a laptop at all (#120).
 *
 * So they are a floor rather than a fixed size. Surplus width goes to the two
 * columns that actually run out of room — a line item called "2nd AC / Clapper
 * Loader" and a vendor name — while the numeric columns keep the width a
 * currency figure needs and no more.
 */
const BASE_COL = {
  rowNum: 36,
  description: 180,
  vendor: 120,
  estimated: 110,
  actual: 110,
  variance: 110,
  paid: 60,
  actions: 70,
};

export type Cols = typeof BASE_COL;

const BASE_TOTAL = Object.values(BASE_COL).reduce((s, v) => s + v, 0);

/*
 * Past this the table stops growing. A maximised window on a large display
 * would otherwise produce a description column half a metre wide, which is
 * harder to read across than the cramped one it replaced.
 */
const MAX_GRID_WIDTH = 1500;

/** Share of the surplus given to the description column; the rest goes to vendor. */
const DESCRIPTION_SHARE = 0.65;

export function columnsFor(available: number): Cols {
  const usable = Math.min(available, MAX_GRID_WIDTH);
  const surplus = usable - BASE_TOTAL;
  if (surplus <= 0) return BASE_COL;

  const toDescription = Math.round(surplus * DESCRIPTION_SHARE);
  return {
    ...BASE_COL,
    description: BASE_COL.description + toDescription,
    vendor: BASE_COL.vendor + (surplus - toDescription),
  };
}

export function totalWidth(cols: Cols): number {
  return Object.values(cols).reduce((s, v) => s + v, 0);
}
const ROW_HEIGHT = 44;
const HEADER_HEIGHT = 38;
const GROUP_HEADER_HEIGHT = 36;

// Delegates to utils/formatRecord.ts: these values come out of records, and a
// record missing its numbers used to take the whole screen down (#90).
const formatCurrency = (n: unknown) => money(n);

// ─── Types ───────────────────────────────────────────────────────────────────

type EditingCell = {
  itemId: string;
  field: 'description' | 'vendor' | 'estimated' | 'actual';
};

type GroupedCategory = {
  category: BudgetCategory;
  items: BudgetItem[];
  subtotalEstimated: number;
  subtotalActual: number;
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function ColumnHeader({ label, width, align }: { label: string; width: number; align?: 'right' | 'center' }) {
  return (
    <View style={[styles.headerCell, { width }, align === 'right' && { alignItems: 'flex-end' }, align === 'center' && { alignItems: 'center' }]}>
      <Text style={styles.headerText}>{label}</Text>
    </View>
  );
}

function SpreadsheetRow({
  item,
  rowIndex,
  editingCell,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  editValue,
  onEditValueChange,
  onTogglePaid,
  onDelete,
  cols,
}: {
  item: BudgetItem;
  rowIndex: number;
  editingCell: EditingCell | null;
  onStartEdit: (cell: EditingCell) => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  editValue: string;
  onEditValueChange: (v: string) => void;
  onTogglePaid: (item: BudgetItem) => void;
  onDelete: (item: BudgetItem) => void;
  cols: Cols;
}) {
  const variance = item.estimated - item.actual;
  const isEditing = (field: EditingCell['field']) =>
    editingCell?.itemId === item.id && editingCell?.field === field;

  const renderEditableText = (field: EditingCell['field'], value: string, width: number, align?: 'right', keyboardType?: 'decimal-pad') => {
    if (isEditing(field)) {
      return (
        <View style={[styles.cell, { width }]}>
          <TextInput
            style={[styles.cellInput, align === 'right' && { textAlign: 'right' }]}
            value={editValue}
            onChangeText={onEditValueChange}
            onBlur={onCommitEdit}
            onSubmitEditing={onCommitEdit}
            autoFocus
            selectTextOnFocus
            keyboardType={keyboardType}
            returnKeyType="done"
          />
        </View>
      );
    }
    return (
      <TouchableOpacity accessibilityRole="button"
        style={[styles.cell, { width }]}
        onPress={() => onStartEdit({ itemId: item.id, field })}
        activeOpacity={0.6}
      >
        <Text
          style={[
            styles.cellText,
            align === 'right' && { textAlign: 'right' },
            field === 'description' && { fontWeight: '500' as const },
          ]}
          numberOfLines={1}
        >
          {value}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.row, rowIndex % 2 === 0 && styles.rowAlt]}>
      {/* Row number */}
      <View style={[styles.cell, styles.rowNumCell, { width: cols.rowNum }]}>
        <Text style={styles.rowNumText}>{rowIndex + 1}</Text>
      </View>

      {/* Description */}
      {renderEditableText('description', item.description, cols.description)}

      {/* Vendor */}
      {renderEditableText('vendor', item.vendor || '—', cols.vendor)}

      {/* Estimated */}
      {renderEditableText('estimated', formatCurrency(item.estimated), cols.estimated, 'right', 'decimal-pad')}

      {/* Actual */}
      {renderEditableText('actual', formatCurrency(item.actual), cols.actual, 'right', 'decimal-pad')}

      {/* Variance */}
      <View style={[styles.cell, { width: cols.variance }]}>
        <Text
          style={[
            styles.cellText,
            { textAlign: 'right', fontWeight: '600' as const },
            { color: variance >= 0 ? Colors.status.active : Colors.status.error },
          ]}
        >
          {variance >= 0 ? '+' : ''}{formatCurrency(variance)}
        </Text>
      </View>

      {/* Paid toggle */}
      <TouchableOpacity
        style={[styles.cell, { width: cols.paid, alignItems: 'center' }]}
        onPress={() => onTogglePaid(item)}
        activeOpacity={0.6}
        accessibilityRole="button"
        accessibilityLabel={item.paid ? `${item.description}: paid` : `${item.description}: not paid`}
        accessibilityState={{ selected: !!item.paid }}
        accessibilityHint="Marks this item paid or unpaid"
      >
        <View style={[styles.paidCheckbox, item.paid && styles.paidCheckboxChecked]}>
          {item.paid && <Check color={Colors.text.inverse} size={12} />}
        </View>
      </TouchableOpacity>

      {/* Actions */}
      <View style={[styles.cell, { width: cols.actions, flexDirection: 'row', gap: 8, justifyContent: 'center' }]}>
        <TouchableOpacity onPress={() => onDelete(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button" accessibilityLabel={`Delete ${item.description}`}>
          <Trash2 color={Colors.status.error + '88'} size={14} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function CategoryGroupHeader({
  group,
  collapsed,
  onToggle,
}: {
  group: GroupedCategory;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const catColor = CATEGORY_COLORS[group.category];
  const variance = group.subtotalEstimated - group.subtotalActual;

  return (
    <TouchableOpacity accessibilityRole="button" style={styles.groupHeader} onPress={onToggle} activeOpacity={0.7}>
      <View style={styles.groupHeaderLeft}>
        {collapsed
          ? <ChevronRight color={catColor} size={14} />
          : <ChevronDown color={catColor} size={14} />
        }
        <View style={[styles.groupDot, { backgroundColor: catColor }]} />
        <Text style={[styles.groupLabel, { color: catColor }]}>
          {CATEGORY_LABELS[group.category]}
        </Text>
        <Text style={styles.groupCount}>{group.items.length}</Text>
      </View>
      <View style={styles.groupHeaderRight}>
        <Text style={styles.groupSubtotal}>{formatCurrency(group.subtotalEstimated)}</Text>
        <Text style={[styles.groupVariance, { color: variance >= 0 ? Colors.status.active : Colors.status.error }]}>
          {variance >= 0 ? '+' : ''}{formatCurrency(variance)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function SubtotalRow({ label, estimated, actual, cols }: { label: string; estimated: number; actual: number; cols: Cols }) {
  const variance = estimated - actual;
  return (
    <View style={styles.subtotalRow}>
      <View style={{ width: cols.rowNum + cols.description + cols.vendor }}>
        <Text style={styles.subtotalLabel}>{label}</Text>
      </View>
      <View style={{ width: cols.estimated, alignItems: 'flex-end', paddingRight: 12 }}>
        <Text style={styles.subtotalValue}>{formatCurrency(estimated)}</Text>
      </View>
      <View style={{ width: cols.actual, alignItems: 'flex-end', paddingRight: 12 }}>
        <Text style={styles.subtotalValue}>{formatCurrency(actual)}</Text>
      </View>
      <View style={{ width: cols.variance, alignItems: 'flex-end', paddingRight: 12 }}>
        <Text style={[styles.subtotalValue, { color: variance >= 0 ? Colors.status.active : Colors.status.error }]}>
          {variance >= 0 ? '+' : ''}{formatCurrency(variance)}
        </Text>
      </View>
      <View style={{ width: cols.paid + cols.actions }} />
    </View>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function BudgetSpreadsheetScreen() {
  const { activeProject, activeProjectId, updateBudgetItem, deleteBudgetItem } = useProjects();
  const budget = useProjectBudget(activeProjectId);
  const router = useGuardedRouter();
  const { contentPadding, contentWidth } = useLayout();

  /*
   * Width comes from useLayout, the same source the other 28 screens use.
   *
   * An onLayout measurement was tried first and does not work here: RNW never
   * fired it on the wrapper, and putting it on the horizontal ScrollView is
   * worse than useless, because that reports its *content* width — which is
   * set by the column widths, which would then be derived from it. The loop
   * settles at the base width and the table silently never grows.
   *
   * contentWidth already accounts for the tablet sidebar and page padding and
   * is capped at DESKTOP_CONTENT_MAX, so the table lines up with every other
   * screen instead of inventing its own margins.
   */
  const cols = useMemo(() => columnsFor(contentWidth), [contentWidth]);
  const gridTotal = useMemo(() => totalWidth(cols), [cols]);

  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<BudgetCategory>>(new Set());

  // ── Group items by category ──
  const grouped = useMemo<GroupedCategory[]>(() => {
    const map = new Map<BudgetCategory, BudgetItem[]>();
    budget.forEach(item => {
      const arr = map.get(item.category) || [];
      arr.push(item);
      map.set(item.category, arr);
    });

    return CATEGORY_ORDER
      .filter(cat => map.has(cat))
      .map(cat => {
        const items = map.get(cat)!;
        return {
          category: cat,
          items,
          subtotalEstimated: items.reduce((s, i) => s + i.estimated, 0),
          subtotalActual: items.reduce((s, i) => s + i.actual, 0),
        };
      });
  }, [budget]);

  // ── Totals ──
  const totals = useMemo(() => {
    const est = budget.reduce((s, b) => s + b.estimated, 0);
    const act = budget.reduce((s, b) => s + b.actual, 0);
    return { estimated: est, actual: act };
  }, [budget]);

  // ── Editing ──
  const handleStartEdit = useCallback((cell: EditingCell) => {
    const item = budget.find(b => b.id === cell.itemId);
    if (!item) return;
    let value = '';
    switch (cell.field) {
      case 'description': value = item.description; break;
      case 'vendor': value = item.vendor || ''; break;
      case 'estimated': value = item.estimated.toString(); break;
      case 'actual': value = item.actual.toString(); break;
    }
    setEditValue(value);
    setEditingCell(cell);
  }, [budget]);

  const handleCommitEdit = useCallback(() => {
    if (!editingCell) return;
    const item = budget.find(b => b.id === editingCell.itemId);
    if (!item) { setEditingCell(null); return; }

    const updated = { ...item };
    switch (editingCell.field) {
      case 'description':
        if (!editValue.trim()) { setEditingCell(null); return; }
        updated.description = editValue.trim();
        break;
      case 'vendor':
        updated.vendor = editValue.trim() || undefined;
        break;
      case 'estimated':
        updated.estimated = parseFloat(editValue) || 0;
        break;
      case 'actual':
        updated.actual = parseFloat(editValue) || 0;
        break;
    }

    updateBudgetItem(updated);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingCell(null);
  }, [editingCell, editValue, budget, updateBudgetItem]);

  const handleCancelEdit = useCallback(() => {
    setEditingCell(null);
  }, []);

  const handleTogglePaid = useCallback((item: BudgetItem) => {
    updateBudgetItem({ ...item, paid: !item.paid });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [updateBudgetItem]);

  const handleDelete = useCallback((item: BudgetItem) => {
    appAlert('Delete Item', `Remove "${item.description}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteBudgetItem(item.id) },
    ]);
  }, [deleteBudgetItem]);

  const toggleCategory = useCallback((cat: BudgetCategory) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  // ── No project ──
  if (!activeProject) {
    return (
      <View style={styles.emptyContainer}>
        <Stack.Screen options={{ title: 'Budget' }} />
        <AlertCircle color={Colors.text.tertiary} size={48} />
        <Text style={styles.emptyTitle}>No project selected</Text>
      </View>
    );
  }

  // ── Build flat row list ──
  let globalRowIndex = 0;

  return (
    <PermissionGate resource="budget">
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: 'Budget — Spreadsheet',
            headerRight: () => (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <TouchableOpacity
                  style={styles.viewToggle}
                  onPress={() => {
                    if (budget.length === 0) {
                      appAlert('No Data', 'Add budget items before exporting.');
                      return;
                    }
                    exportBudgetToXlsx(budget, activeProject!.title);
                  }}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityRole="button"
                  accessibilityLabel="Export the budget"
                  accessibilityHint="Saves the budget as a spreadsheet"
                >
                  <Download color={Colors.text.secondary} size={20} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.viewToggle}
                  onPress={() => router.replace('/budget' as never)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityRole="button"
                  accessibilityLabel="Switch to list view"
                >
                  <LayoutList color={Colors.text.secondary} size={20} />
                </TouchableOpacity>
              </View>
            ),
          }}
        />

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={KEYBOARD_BEHAVIOR}
          keyboardVerticalOffset={100}
        >
          {/* Summary strip */}
          <View style={styles.summaryStrip}>
            <View style={styles.summaryChip}>
              <Text style={styles.summaryChipLabel}>Budget</Text>
              <Text style={styles.summaryChipValue}>{formatCurrency(totals.estimated)}</Text>
            </View>
            <View style={styles.summaryChip}>
              <Text style={styles.summaryChipLabel}>Spent</Text>
              <Text style={[styles.summaryChipValue, { color: Colors.status.warning }]}>{formatCurrency(totals.actual)}</Text>
            </View>
            <View style={styles.summaryChip}>
              <Text style={styles.summaryChipLabel}>Remaining</Text>
              <Text style={[styles.summaryChipValue, {
                color: totals.estimated - totals.actual >= 0 ? Colors.status.active : Colors.status.error
              }]}>
                {formatCurrency(totals.estimated - totals.actual)}
              </Text>
            </View>
            <View style={{ flex: 1 }} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <ImportButton entityKey="budget" />
            </View>
          </View>

          {/* Scrollable grid */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={true}
            bounces={false}
          >
            <View style={{ minWidth: gridTotal }}>
              {/* Column headers */}
              <View style={styles.headerRow}>
                <ColumnHeader label="#" width={cols.rowNum} align="center" />
                <ColumnHeader label="Description" width={cols.description} />
                <ColumnHeader label="Vendor" width={cols.vendor} />
                <ColumnHeader label="Estimated" width={cols.estimated} align="right" />
                <ColumnHeader label="Actual" width={cols.actual} align="right" />
                <ColumnHeader label="Variance" width={cols.variance} align="right" />
                <ColumnHeader label="Paid" width={cols.paid} align="center" />
                <ColumnHeader label="" width={cols.actions} />
              </View>

              {/* Body */}
              <ScrollView
                showsVerticalScrollIndicator={true}
                contentContainerStyle={{ paddingBottom: 100 }}
                keyboardShouldPersistTaps="handled"
              >
                {budget.length === 0 ? (
                  <View style={styles.emptyGrid}>
                    <DollarSign color={Colors.text.tertiary} size={32} />
                    <Text style={styles.emptyGridTitle}>No budget items yet</Text>
                    <Text style={styles.emptyGridSub}>Tap + to add your first line item</Text>
                  </View>
                ) : (
                  <>
                    {grouped.map(group => {
                      const isCollapsed = collapsedCategories.has(group.category);
                      return (
                        <View key={group.category}>
                          <CategoryGroupHeader
                            group={group}
                            collapsed={isCollapsed}
                            onToggle={() => toggleCategory(group.category)}
                          />
                          {!isCollapsed && (
                            <>
                              {group.items.map(item => {
                                const idx = globalRowIndex++;
                                return (
                                  <SpreadsheetRow
                                    key={item.id}
                                    cols={cols}
                                    item={item}
                                    rowIndex={idx}
                                    editingCell={editingCell}
                                    onStartEdit={handleStartEdit}
                                    onCommitEdit={handleCommitEdit}
                                    onCancelEdit={handleCancelEdit}
                                    editValue={editValue}
                                    onEditValueChange={setEditValue}
                                    onTogglePaid={handleTogglePaid}
                                    onDelete={handleDelete}
                                  />
                                );
                              })}
                              <SubtotalRow
                                cols={cols}
                                label={`${CATEGORY_LABELS[group.category]} Subtotal`}
                                estimated={group.subtotalEstimated}
                                actual={group.subtotalActual}
                              />
                            </>
                          )}
                        </View>
                      );
                    })}

                    {/* Grand total */}
                    <SubtotalRow
                      cols={cols}
                      label="GRAND TOTAL"
                      estimated={totals.estimated}
                      actual={totals.actual}
                    />
                  </>
                )}
              </ScrollView>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* FAB */}
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Add a budget item"
          style={styles.fab}
          onPress={() => router.push('/new-budget-item' as never)}
          activeOpacity={0.8}
        >
          <Plus color={Colors.text.inverse} size={24} />
        </TouchableOpacity>
      </View>
    </PermissionGate>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },

  // View toggle in header
  viewToggle: {
    padding: 6,
    marginRight: 4,
  },

  // Summary strip
  summaryStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border.subtle,
    backgroundColor: Colors.bg.secondary,
  },
  summaryChip: { alignItems: 'center' },
  summaryChipLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.text.tertiary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  summaryChipValue: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text.primary,
    marginTop: 2,
  },

  // Column header
  headerRow: {
    flexDirection: 'row',
    height: HEADER_HEIGHT,
    alignItems: 'center',
    backgroundColor: Colors.bg.tertiary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.medium,
  },
  headerCell: {
    height: HEADER_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  headerText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.text.tertiary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
  },

  // Data rows
  row: {
    flexDirection: 'row',
    height: ROW_HEIGHT,
    alignItems: 'center',
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border.subtle,
  },
  rowAlt: {
    backgroundColor: Colors.bg.secondary + '66',
  },
  cell: {
    height: ROW_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  cellText: {
    fontSize: 13,
    color: Colors.text.primary,
  },
  cellInput: {
    fontSize: 13,
    color: Colors.accent.gold,
    backgroundColor: Colors.accent.goldBg,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.accent.gold + '55',
  },
  rowNumCell: {
    alignItems: 'center',
    borderRightWidth: 0.5,
    borderRightColor: Colors.border.subtle,
  },
  rowNumText: {
    fontSize: 12,
    color: Colors.text.tertiary,
    fontWeight: '600' as const,
  },

  // Paid checkbox
  paidCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.border.medium,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paidCheckboxChecked: {
    backgroundColor: Colors.status.active,
    borderColor: Colors.status.active,
  },

  // Category group header
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: GROUP_HEADER_HEIGHT,
    paddingHorizontal: 10,
    backgroundColor: Colors.bg.elevated,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border.subtle,
  },
  groupHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  groupDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
  },
  groupCount: {
    fontSize: 12,
    color: Colors.text.tertiary,
    fontWeight: '600' as const,
    backgroundColor: Colors.bg.tertiary,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  groupHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  groupSubtotal: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.text.primary,
  },
  groupVariance: {
    fontSize: 12,
    fontWeight: '600' as const,
  },

  // Subtotal row
  subtotalRow: {
    flexDirection: 'row',
    height: ROW_HEIGHT,
    alignItems: 'center',
    backgroundColor: Colors.bg.elevated,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.medium,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border.subtle,
  },
  subtotalLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.accent.gold,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    paddingLeft: 12,
  },
  subtotalValue: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.text.primary,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text.primary,
    marginTop: 16,
  },
  emptyGrid: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyGridTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text.primary,
    marginTop: 12,
  },
  emptyGridSub: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 4,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent.gold,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.accent.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
