import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, SectionList, TouchableOpacity, Linking, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus, Phone, Mail, Users } from 'lucide-react-native';
import { useProjects } from '@/contexts/ProjectContext';
import Colors from '@/constants/colors';
import { CrewMember, Department } from '@/types';

const DEPT_LABELS: Record<Department, string> = {
  direction: 'Direction',
  camera: 'Camera',
  sound: 'Sound',
  art: 'Art',
  lighting: 'Lighting',
  production: 'Production',
  talent: 'Talent',
  postProduction: 'Post-Production',
};

function CrewCard({ member }: { member: CrewMember }) {
  const deptColor = Colors.department[member.department];
  const initials = member.name.split(' ').map(n => n[0]).join('').slice(0, 2);

  const handleCall = useCallback(() => {
    if (Platform.OS === 'web') return;
    Linking.openURL(`tel:${member.phone}`);
  }, [member.phone]);

  const handleEmail = useCallback(() => {
    Linking.openURL(`mailto:${member.email}`);
  }, [member.email]);

  return (
    <View style={styles.crewCard} testID={`crew-card-${member.id}`}>
      <View style={[styles.avatar, { backgroundColor: deptColor + '22', borderColor: deptColor + '44' }]}>
        <Text style={[styles.avatarText, { color: deptColor }]}>{initials}</Text>
      </View>
      <View style={styles.crewInfo}>
        <Text style={styles.crewName}>{member.name}</Text>
        <Text style={styles.crewRole}>{member.role}</Text>
      </View>
      <View style={styles.crewActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleCall} activeOpacity={0.7}>
          <Phone color={Colors.text.tertiary} size={16} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={handleEmail} activeOpacity={0.7}>
          <Mail color={Colors.text.tertiary} size={16} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function CrewScreen() {
  const { crew } = useProjects();
  const router = useRouter();

  const sections = useMemo(() => {
    const grouped: Record<string, CrewMember[]> = {};
    crew.forEach(member => {
      const dept = member.department;
      if (!grouped[dept]) grouped[dept] = [];
      grouped[dept].push(member);
    });
    return Object.entries(grouped).map(([dept, data]) => ({
      title: DEPT_LABELS[dept as Department] ?? dept,
      department: dept as Department,
      data,
    }));
  }, [crew]);

  return (
    <View style={styles.container}>
      <View style={styles.statsBar}>
        <Users color={Colors.accent.gold} size={16} />
        <Text style={styles.statsText}>{crew.length} crew member{crew.length !== 1 ? 's' : ''}</Text>
        <Text style={styles.statsDetail}>{sections.length} department{sections.length !== 1 ? 's' : ''}</Text>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        renderItem={({ item }) => <CrewCard member={item} />}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionDot, { backgroundColor: Colors.department[section.department] }]} />
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionCount}>{section.data.length}</Text>
          </View>
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Users color={Colors.text.tertiary} size={48} />
            <Text style={styles.emptyTitle}>No crew members</Text>
            <Text style={styles.emptySubtitle}>Add your cast and crew</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/new-crew' as never)}
        activeOpacity={0.8}
        testID="add-crew-button"
      >
        <Plus color={Colors.text.inverse} size={24} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
  },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: Colors.bg.secondary,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border.subtle,
    gap: 8,
  },
  statsText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text.primary,
  },
  statsDetail: {
    fontSize: 12,
    color: Colors.text.tertiary,
  },
  list: {
    padding: 20,
    paddingBottom: 100,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
    gap: 8,
  },
  sectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text.primary,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  sectionCount: {
    fontSize: 12,
    color: Colors.text.tertiary,
    fontWeight: '600' as const,
  },
  crewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 0.5,
    borderColor: Colors.border.subtle,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    marginRight: 12,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '700' as const,
  },
  crewInfo: {
    flex: 1,
  },
  crewName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text.primary,
  },
  crewRole: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  crewActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.bg.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text.primary,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 4,
  },
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
