import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { User, Film, Trophy, Plus } from 'lucide-react-native';
import { useProjects } from '@/contexts/ProjectContext';
import Colors from '@/constants/colors';
import { DirectorCredit } from '@/types';
import PermissionGate from '@/contexts/PermissionGate';

function CreditCard({ credit }: { credit: DirectorCredit }) {
  return (
    <View style={styles.creditCard}>
      <View style={styles.creditLeft}>
        <Text style={styles.creditYear}>{credit.year}</Text>
      </View>
      <View style={styles.creditCenter}>
        <Text style={styles.creditTitle}>{credit.title}</Text>
        <Text style={styles.creditRole}>{credit.role}</Text>
        <View style={styles.creditMeta}>
          <View style={styles.formatBadge}>
            <Text style={styles.formatText}>{credit.format}</Text>
          </View>
          {credit.festival ? (
            <View style={styles.festivalBadge}>
              <Trophy color={Colors.accent.gold} size={10} />
              <Text style={styles.festivalText}>{credit.festival}</Text>
            </View>
          ) : null}
        </View>
        {credit.award ? (
          <View style={styles.awardRow}>
            <Text style={styles.awardText}>{credit.award}</Text>
          </View>
        ) : null}
        {credit.notes ? <Text style={styles.creditNotes}>{credit.notes}</Text> : null}
      </View>
    </View>
  );
}

export default function PortfolioScreen() {
  const { directorCredits, projects } = useProjects();

  const stats = {
    totalProjects: projects.length,
    credits: directorCredits.length,
    awards: directorCredits.filter(c => c.award).length,
  };

  const sorted = [...directorCredits].sort((a, b) => parseInt(b.year) - parseInt(a.year));

  return (
    <PermissionGate resource="portfolio">
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Stack.Screen options={{ title: 'Director Portfolio' }} />

      <View style={styles.profileCard}>
        <View style={styles.avatarLarge}>
          <User color={Colors.accent.gold} size={36} />
        </View>
        <Text style={styles.directorName}>Director</Text>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.totalProjects}</Text>
            <Text style={styles.statLabel}>Projects</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.credits}</Text>
            <Text style={styles.statLabel}>Credits</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: Colors.accent.gold }]}>{stats.awards}</Text>
            <Text style={styles.statLabel}>Awards</Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Filmography</Text>

      {sorted.length === 0 ? (
        <View style={styles.emptyInner}>
          <Film color={Colors.text.tertiary} size={40} />
          <Text style={styles.emptyTitle}>No credits yet</Text>
          <Text style={styles.emptySubtitle}>Your filmography will appear here</Text>
        </View>
      ) : (
        sorted.map(credit => <CreditCard key={credit.id} credit={credit} />)
      )}
    </ScrollView>
  </PermissionGate>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  content: { padding: 16, paddingBottom: 40 },
  profileCard: { backgroundColor: Colors.bg.card, borderRadius: 16, padding: 24, alignItems: 'center', marginBottom: 24, borderWidth: 0.5, borderColor: Colors.border.subtle },
  avatarLarge: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.accent.goldBg, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.accent.gold + '44', marginBottom: 12 },
  directorName: { fontSize: 22, fontWeight: '800' as const, color: Colors.text.primary, marginBottom: 16 },
  statsRow: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '700' as const, color: Colors.text.primary },
  statLabel: { fontSize: 10, color: Colors.text.tertiary, marginTop: 2, fontWeight: '600' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  statDivider: { width: 1, height: 30, backgroundColor: Colors.border.subtle },
  sectionTitle: { fontSize: 11, fontWeight: '700' as const, color: Colors.text.tertiary, textTransform: 'uppercase' as const, letterSpacing: 1.2, marginBottom: 12 },
  creditCard: { flexDirection: 'row', backgroundColor: Colors.bg.card, borderRadius: 12, marginBottom: 10, borderWidth: 0.5, borderColor: Colors.border.subtle, overflow: 'hidden' },
  creditLeft: { width: 56, backgroundColor: Colors.bg.elevated, justifyContent: 'center', alignItems: 'center', padding: 10 },
  creditYear: { fontSize: 14, fontWeight: '800' as const, color: Colors.accent.gold },
  creditCenter: { flex: 1, padding: 14 },
  creditTitle: { fontSize: 16, fontWeight: '700' as const, color: Colors.text.primary },
  creditRole: { fontSize: 12, color: Colors.text.secondary, marginTop: 2 },
  creditMeta: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  formatBadge: { backgroundColor: Colors.bg.elevated, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  formatText: { fontSize: 10, fontWeight: '600' as const, color: Colors.text.secondary, textTransform: 'uppercase' as const },
  festivalBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.accent.goldBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  festivalText: { fontSize: 10, fontWeight: '600' as const, color: Colors.accent.gold },
  awardRow: { marginTop: 6 },
  awardText: { fontSize: 12, fontWeight: '600' as const, color: '#F59E0B' },
  creditNotes: { fontSize: 11, color: Colors.text.tertiary, marginTop: 4, fontStyle: 'italic' as const },
  emptyInner: { alignItems: 'center', paddingVertical: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '600' as const, color: Colors.text.primary, marginTop: 12 },
  emptySubtitle: { fontSize: 13, color: Colors.text.secondary, marginTop: 4 },
});
