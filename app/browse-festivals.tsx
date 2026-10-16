/**
 * app/browse-festivals.tsx
 *
 * The whole festival calendar, inside Mise. Free for everyone to browse.
 *
 * The listing rows are deliberately plain about what they do not know.
 * 1,408 of the 2,662 entries publish their deadlines on a submission platform
 * rather than their own site, and another 456 are showing last season's
 * dates. Both say so on the row. A director who misses a real deadline
 * because this screen implied a date it did not have would be right never to
 * open it again, so describeDates() in the policy module is the only thing
 * allowed to turn a listing into a date, and it refuses in both cases.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, Linking, ScrollView,
} from 'react-native';
import { Search, Plus, Check, ExternalLink, Award, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { appAlert } from '@/lib/appAlert';
import { useProjects, useProjectFestivals } from '@/contexts/ProjectContext';
import { useLayout } from '@/utils/useLayout';
import Colors from '@/constants/colors';
import { count } from '@/utils/formatRecord';
import {
  loadCatalog, refreshCatalog, CALENDAR_SITE,
  type Catalog, type CatalogEntry, type FestivalKind,
} from '@/utils/festivalCatalog';
import {
  describeDates, lowestFee, placeOf, matches, categoriesOf, regionsOf,
  EMPTY_FILTERS, type CatalogFilters,
} from '@/utils/festivalCatalogPolicy';

const TYPE_LABEL: Record<FestivalKind, string> = {
  festival: 'Festival', contest: 'Contest', fund: 'Fund or lab',
};

function feeLabel(f: CatalogEntry): string {
  const fee = lowestFee(f);
  if (fee === null) return 'Fee not listed';
  return fee === 0 ? 'Free to enter' : `From $${fee}`;
}

function Chip({ label, active, onPress, a11y }: {
  label: string; active: boolean; onPress: () => void; a11y?: string;
}) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      accessibilityState={{ selected: active }}
      style={[styles.chip, active && styles.chipOn]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.chipText, active && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Row({ item, tracked, onAdd }: {
  item: CatalogEntry; tracked: boolean; onAdd: (f: CatalogEntry) => void;
}) {
  const dates = describeDates(item);
  const place = placeOf(item);
  return (
    <View style={styles.row}>
      <View style={styles.rowMain}>
        <Text style={styles.rowName} numberOfLines={2}>{item.name}</Text>
        {place ? <Text style={styles.rowPlace}>{place}</Text> : null}

        <View style={styles.badges}>
          <Text style={styles.badge}>{TYPE_LABEL[item.type] ?? item.type}</Text>
          {item.oscar ? (
            <View style={styles.qualBadge}>
              <Award color={Colors.accent.gold} size={11} />
              <Text style={styles.qualText}>Oscar qualifying</Text>
            </View>
          ) : null}
          {item.bafta ? (
            <View style={styles.qualBadge}>
              <Award color={Colors.status.info} size={11} />
              <Text style={[styles.qualText, { color: Colors.status.info }]}>BAFTA qualifying</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.rowDate}>{dates.short}</Text>
        {dates.caveat ? <Text style={styles.rowCaveat}>{dates.caveat}</Text> : null}
        <Text style={styles.rowFee}>{feeLabel(item)}</Text>
      </View>

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={tracked ? `${item.name} is already tracked` : `Track ${item.name}`}
        accessibilityState={{ disabled: tracked }}
        style={[styles.addBtn, tracked && styles.addBtnDone]}
        onPress={() => onAdd(item)}
        disabled={tracked}
        activeOpacity={0.8}
      >
        {tracked
          ? <Check color={Colors.status.success} size={18} />
          : <Plus color={Colors.text.inverse} size={18} />}
      </TouchableOpacity>
    </View>
  );
}

export default function BrowseFestivalsScreen() {
  const { activeProject, activeProjectId, addFestival } = useProjects();
  const tracked = useProjectFestivals(activeProjectId);
  const { contentPadding } = useLayout();

  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [filters, setFilters] = useState<CatalogFilters>(EMPTY_FILTERS);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const local = await loadCatalog();
      if (alive) setCatalog(local);
      /* Quiet on purpose: browsing must work on a scout with no bars, so a
       * failed refresh is not something the user needs told about. */
      const fresh = await refreshCatalog();
      if (alive && fresh) setCatalog(fresh);
    })();
    return () => { alive = false; };
  }, []);

  const all = catalog?.festivals ?? [];
  const results = useMemo(() => all.filter(f => matches(f, filters)), [all, filters]);
  const categories = useMemo(() => categoriesOf(all).slice(0, 24), [all]);
  const regions = useMemo(() => regionsOf(all), [all]);

  /* Matching on name is deliberate. The tracker stores a typed name, not a
   * catalog id, so this is the only link back — and it means a festival the
   * director added by hand is recognised too. */
  const trackedNames = useMemo(
    () => new Set(tracked.map(t => t.festivalName.trim().toLowerCase())),
    [tracked],
  );

  const handleAdd = useCallback((f: CatalogEntry) => {
    if (!activeProjectId) {
      appAlert('No project', 'Choose a project before tracking a festival.');
      return;
    }
    const dates = describeDates(f);
    const fee = lowestFee(f);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addFestival({
      id: Date.now().toString(),
      projectId: activeProjectId,
      festivalName: f.name,
      location: placeOf(f),
      /* Empty for estimated and dates-elsewhere listings. The policy module
       * refuses to hand over a date it cannot stand behind, and this is the
       * call site that would otherwise launder one into a deadline field. */
      deadline: dates.deadline,
      submissionDate: '',
      fee: fee ?? 0,
      status: 'researching',
      category: (f.categories ?? [])[0] ?? '',
      platformUrl: f.website ?? '',
      notes: dates.caveat ?? '',
      notificationDate: '',
    });
    appAlert(
      'Added to your tracker',
      dates.deadline
        ? `${f.name} closes ${dates.deadline}.`
        : `${f.name} was added. ${dates.caveat ?? 'Check the festival site for dates.'}`,
    );
  }, [activeProjectId, addFestival]);

  if (!catalog) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={Colors.accent.gold} />
        <Text style={styles.loadingText}>Opening the calendar</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingHorizontal: contentPadding }]}>
      <View style={styles.searchWrap}>
        <Search color={Colors.text.tertiary} size={18} />
        <TextInput
          accessibilityLabel="Search festivals by name or place"
          style={styles.search}
          placeholder="Search festivals, cities, countries"
          placeholderTextColor={Colors.text.tertiary}
          value={filters.query}
          onChangeText={q => setFilters(s => ({ ...s, query: q }))}
          autoCorrect={false}
          returnKeyType="search"
        />
        {filters.query ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Clear the search"
            onPress={() => setFilters(s => ({ ...s, query: '' }))}
          >
            <X color={Colors.text.tertiary} size={16} />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
        <Chip label="All" active={filters.type === null && filters.qualifying === null}
          onPress={() => setFilters(s => ({ ...s, type: null, qualifying: null }))}
          a11y="Show everything" />
        {(['festival', 'contest', 'fund'] as FestivalKind[]).map(t => (
          <Chip key={t} label={TYPE_LABEL[t]} active={filters.type === t}
            onPress={() => setFilters(s => ({ ...s, type: s.type === t ? null : t }))} />
        ))}
        <Chip label="Oscar" active={filters.qualifying === 'oscar'}
          a11y="Only Oscar qualifying festivals"
          onPress={() => setFilters(s => ({ ...s, qualifying: s.qualifying === 'oscar' ? null : 'oscar' }))} />
        <Chip label="BAFTA" active={filters.qualifying === 'bafta'}
          a11y="Only BAFTA qualifying festivals"
          onPress={() => setFilters(s => ({ ...s, qualifying: s.qualifying === 'bafta' ? null : 'bafta' }))} />
        <Chip label="Free" active={filters.maxFee === 'free'}
          a11y="Only festivals with no entry fee"
          onPress={() => setFilters(s => ({ ...s, maxFee: s.maxFee === 'free' ? null : 'free' }))} />
        <Chip label="Under $50" active={filters.maxFee === 50}
          a11y="Only festivals with an entry fee under fifty dollars"
          onPress={() => setFilters(s => ({ ...s, maxFee: s.maxFee === 50 ? null : 50 }))} />
        <Chip label={showMore ? 'Fewer filters' : 'More filters'} active={showMore}
          onPress={() => setShowMore(v => !v)} />
      </ScrollView>

      {showMore ? (
        <View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {regions.map(r => (
              <Chip key={r} label={r} active={filters.region === r}
                onPress={() => setFilters(s => ({ ...s, region: s.region === r ? null : r }))} />
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {categories.map(c => (
              <Chip key={c} label={c} active={filters.category === c}
                onPress={() => setFilters(s => ({ ...s, category: s.category === c ? null : c }))} />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <Text style={styles.count}>
        {count(results.length)} of {count(all.length)}
        {activeProject ? ` · tracking for ${activeProject.title}` : ''}
      </Text>

      <FlatList
        data={results}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <Row item={item} tracked={trackedNames.has(item.name.trim().toLowerCase())} onAdd={handleAdd} />
        )}
        initialNumToRender={12}
        windowSize={7}
        removeClippedSubviews
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Nothing matches</Text>
            <Text style={styles.emptyText}>Try a shorter search or clear a filter.</Text>
          </View>
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <Text style={styles.footerBuilt}>Calendar updated {catalog.built}</Text>
            <TouchableOpacity
              accessibilityRole="link"
              accessibilityLabel="Open the festival calendar website"
              style={styles.footerLink}
              onPress={() => { void Linking.openURL(CALENDAR_SITE); }}
              activeOpacity={0.7}
            >
              <ExternalLink color={Colors.accent.gold} size={14} />
              <Text style={styles.footerLinkText}>
                Full calendar and weekly email at festivals.page4films.com
              </Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.bg.primary, gap: 12 },
  loadingText: { color: Colors.text.tertiary, fontSize: 14 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12,
    backgroundColor: Colors.bg.input, borderRadius: 10, paddingHorizontal: 12, height: 44,
  },
  search: { flex: 1, color: Colors.text.primary, fontSize: 15 },
  chipRow: { marginTop: 10, flexGrow: 0 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, marginRight: 8,
    borderWidth: 1, borderColor: Colors.border.subtle, backgroundColor: Colors.bg.card,
  },
  chipOn: { backgroundColor: Colors.accent.goldBg, borderColor: Colors.accent.gold },
  chipText: { color: Colors.text.secondary, fontSize: 13 },
  chipTextOn: { color: Colors.accent.gold, fontWeight: '600' },
  count: { color: Colors.text.tertiary, fontSize: 12, marginTop: 12, marginBottom: 6 },
  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border.subtle,
  },
  rowMain: { flex: 1 },
  rowName: { color: Colors.text.primary, fontSize: 16, fontWeight: '600' },
  rowPlace: { color: Colors.text.secondary, fontSize: 13, marginTop: 2 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 6 },
  badge: { color: Colors.text.tertiary, fontSize: 12 },
  qualBadge: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  qualText: { color: Colors.accent.gold, fontSize: 12 },
  rowDate: { color: Colors.text.primary, fontSize: 13, marginTop: 6 },
  rowCaveat: { color: Colors.status.warning, fontSize: 12, marginTop: 2, lineHeight: 17 },
  rowFee: { color: Colors.text.tertiary, fontSize: 12, marginTop: 4 },
  addBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.accent.gold,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  addBtnDone: { backgroundColor: Colors.bg.card, borderWidth: 1, borderColor: Colors.status.success },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 6 },
  emptyTitle: { color: Colors.text.primary, fontSize: 16, fontWeight: '600' },
  emptyText: { color: Colors.text.tertiary, fontSize: 13 },
  footer: { paddingVertical: 28, gap: 10, alignItems: 'center' },
  footerBuilt: { color: Colors.text.tertiary, fontSize: 12 },
  footerLink: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16 },
  footerLinkText: { color: Colors.accent.gold, fontSize: 13, textAlign: 'center' },
});
