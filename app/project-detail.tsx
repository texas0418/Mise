import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Image } from 'expo-image';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import {
  Film, Camera, CalendarDays, Users, MapPin, DollarSign,
  Clapperboard, ChevronRight, Trash2, Edit3, Clock, Check, Eye
} from 'lucide-react-native';
import { useProjects, useProjectShots, useProjectSchedule } from '@/contexts/ProjectContext';
import { useLayout } from '@/utils/useLayout';
import Colors from '@/constants/colors';
import { ProjectStatus, ShotStatus } from '@/types';

const STATUS_LABELS: Record<ProjectStatus, string> = {
  'development': 'Development',
  'pre-production': 'Pre-Production',
  'production': 'Production',
  'post-production': 'Post-Production',
  'completed': 'Completed',
};

const STATUS_COLORS: Record<ProjectStatus, string> = {
  'development': Colors.status.info,
  'pre-production': Colors.status.warning,
  'production': Colors.status.active,
  'post-production': Colors.accent.gold,
  'completed': Colors.text.tertiary,
};

const SHOT_STATUS_COLORS: Record<ShotStatus, string> = {
  planned: Colors.text.tertiary,
  ready: Colors.status.info,
  shot: Colors.status.warning,
  approved: Colors.status.active,
};

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { projects, deleteProject, selectProject } = useProjects();
  const router = useRouter();
  const { isTablet, contentPadding } = useLayout();

  const project = projects.find(p => p.id === id) ?? null;
  const shots = useProjectShots(id ?? null);
  const schedule = useProjectSchedule(id ?? null);

  const shotStats = useMemo(() => {
    const total = shots.length;
    const approved = shots.filter(s => s.status === 'approved').length;
    const shot = shots.filter(s => s.status === 'shot').length;
    const ready = shots.filter(s => s.status === 'ready').length;
    const planned = shots.filter(s => s.status === 'planned').length;
    return { total, approved, shot, ready, planned };
  }, [shots]);

  const handleDelete = () => {
    if (!project) return;
    Alert.alert(
      'Delete Project',
      `Are you sure you want to delete "${project.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteProject(project.id);
            router.back();
          },
        },
      ]
    );
  };

  if (!project) {
    return (
      <View style={styles.emptyContainer}>
        <Stack.Screen options={{ title: 'Project' }} />
        <Film color={Colors.text.tertiary} size={48} />
        <Text style={styles.emptyTitle}>Project not found</Text>
      </View>
    );
  }

  const statusColor = STATUS_COLORS[project.status];

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: project.title }} />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingHorizontal: contentPadding,
            maxWidth: isTablet ? 800 : undefined,
            alignSelf: isTablet ? 'center' as const : undefined,
            width: isTablet ? '100%' : undefined,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Image */}
        {project.imageUrl ? (
          <Image source={{ uri: project.imageUrl }} style={styles.heroImage} contentFit="cover" />
        ) : (
          <View style={[styles.heroImage, styles.heroPlaceholder]}>
            <Film color={Colors.text.tertiary} size={48} />
          </View>
        )}

        {/* Project Info */}
        <View style={styles.infoSection}>
          <View style={styles.titleRow}>
            <Text style={styles.projectTitle}>{project.title}</Text>
            <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn} activeOpacity={0.7}>
              <Trash2 color={Colors.status.error} size={18} />
            </TouchableOpacity>
          </View>

          <View style={styles.badgeRow}>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '22', borderColor: statusColor + '44' }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>{STATUS_LABELS[project.status]}</Text>
            </View>
            <Text style={styles.formatBadge}>{project.format}</Text>
            <Text style={styles.genreBadge}>{project.genre}</Text>
          </View>

          <Text style={styles.logline}>{project.logline}</Text>

          {(project.director || project.producer) && (
            <View style={styles.creditsRow}>
              {project.director ? (
                <View style={styles.creditItem}>
                  <Text style={styles.creditLabel}>Director</Text>
                  <Text style={styles.creditValue}>{project.director}</Text>
                </View>
              ) : null}
              {project.producer ? (
                <View style={styles.creditItem}>
                  <Text style={styles.creditLabel}>Producer</Text>
                  <Text style={styles.creditValue}>{project.producer}</Text>
                </View>
              ) : null}
            </View>
          )}
        </View>

        {/* Stats Cards */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Camera color={Colors.accent.gold} size={18} />
            <Text style={styles.statNumber}>{shotStats.total}</Text>
            <Text style={styles.statLabel}>Shots</Text>
          </View>
          <View style={styles.statCard}>
            <Check color={Colors.status.active} size={18} />
            <Text style={[styles.statNumber, { color: Colors.status.active }]}>{shotStats.approved}</Text>
            <Text style={styles.statLabel}>Approved</Text>
          </View>
          <View style={styles.statCard}>
            <CalendarDays color={Colors.status.info} size={18} />
            <Text style={[styles.statNumber, { color: Colors.status.info }]}>{schedule.length}</Text>
            <Text style={styles.statLabel}>Shoot Days</Text>
          </View>
        </View>

        {/* Shot Progress */}
        {shotStats.total > 0 && (
          <View style={styles.progressSection}>
            <Text style={styles.sectionTitle}>Shot Progress</Text>
            <View style={styles.progressBar}>
              {shotStats.approved > 0 && (
                <View style={[styles.progressSegment, { flex: shotStats.approved, backgroundColor: SHOT_STATUS_COLORS.approved }]} />
              )}
              {shotStats.shot > 0 && (
                <View style={[styles.progressSegment, { flex: shotStats.shot, backgroundColor: SHOT_STATUS_COLORS.shot }]} />
              )}
              {shotStats.ready > 0 && (
                <View style={[styles.progressSegment, { flex: shotStats.ready, backgroundColor: SHOT_STATUS_COLORS.ready }]} />
              )}
              {shotStats.planned > 0 && (
                <View style={[styles.progressSegment, { flex: shotStats.planned, backgroundColor: SHOT_STATUS_COLORS.planned }]} />
              )}
            </View>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: SHOT_STATUS_COLORS.approved }]} />
                <Text style={styles.legendText}>Approved ({shotStats.approved})</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: SHOT_STATUS_COLORS.shot }]} />
                <Text style={styles.legendText}>Shot ({shotStats.shot})</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: SHOT_STATUS_COLORS.ready }]} />
                <Text style={styles.legendText}>Ready ({shotStats.ready})</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: SHOT_STATUS_COLORS.planned }]} />
                <Text style={styles.legendText}>Planned ({shotStats.planned})</Text>
              </View>
            </View>
          </View>
        )}

        {/* Upcoming Schedule */}
        {schedule.length > 0 && (
          <View style={styles.scheduleSection}>
            <Text style={styles.sectionTitle}>Schedule</Text>
            {schedule.slice(0, 3).map(day => (
              <View key={day.id} style={styles.scheduleMiniCard}>
                <View style={styles.scheduleDayBadge}>
                  <Text style={styles.scheduleDayNum}>{day.dayNumber}</Text>
                </View>
                <View style={styles.scheduleMiniInfo}>
                  <Text style={styles.scheduleMiniDate}>{day.date}</Text>
                  <Text style={styles.scheduleMiniScenes}>{day.scenes}</Text>
                </View>
                <View style={styles.scheduleMiniRight}>
                  <MapPin color={Colors.text.tertiary} size={12} />
                  <Text style={styles.scheduleMiniLocation} numberOfLines={1}>{day.location}</Text>
                </View>
              </View>
            ))}
            {schedule.length > 3 && (
              <Text style={styles.moreText}>+{schedule.length - 3} more day{schedule.length - 3 !== 1 ? 's' : ''}</Text>
            )}
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => router.push('/shot-checklist' as never)}
            activeOpacity={0.7}
          >
            <Clapperboard color={Colors.accent.gold} size={18} />
            <Text style={styles.actionText}>Shot Checklist</Text>
            <ChevronRight color={Colors.text.tertiary} size={16} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => router.push('/script-sides' as never)}
            activeOpacity={0.7}
          >
            <Film color={Colors.accent.gold} size={18} />
            <Text style={styles.actionText}>Script Sides</Text>
            <ChevronRight color={Colors.text.tertiary} size={16} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => router.push('/cast-manager' as never)}
            activeOpacity={0.7}
          >
            <Users color={Colors.accent.gold} size={18} />
            <Text style={styles.actionText}>Cast</Text>
            <ChevronRight color={Colors.text.tertiary} size={16} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => router.push('/budget' as never)}
            activeOpacity={0.7}
          >
            <DollarSign color={Colors.accent.gold} size={18} />
            <Text style={styles.actionText}>Budget</Text>
            <ChevronRight color={Colors.text.tertiary} size={16} />
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
  },
  scrollContent: {
    paddingBottom: 40,
  },
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

  // Hero
  heroImage: {
    width: '100%',
    height: 220,
    borderRadius: 16,
    marginTop: 16,
    overflow: 'hidden',
  },
  heroPlaceholder: {
    backgroundColor: Colors.bg.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Info
  infoSection: {
    marginTop: 20,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  projectTitle: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: Colors.text.primary,
    flex: 1,
    letterSpacing: -0.5,
  },
  deleteBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.status.error + '18',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 10,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
  },
  formatBadge: {
    fontSize: 11,
    color: Colors.text.tertiary,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    backgroundColor: Colors.bg.elevated,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  genreBadge: {
    fontSize: 11,
    color: Colors.accent.goldLight,
    fontWeight: '600' as const,
    backgroundColor: Colors.accent.goldBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  logline: {
    fontSize: 15,
    color: Colors.text.secondary,
    lineHeight: 22,
    marginTop: 16,
  },
  creditsRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 24,
  },
  creditItem: {},
  creditLabel: {
    fontSize: 10,
    color: Colors.text.tertiary,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  creditValue: {
    fontSize: 14,
    color: Colors.text.primary,
    fontWeight: '600' as const,
    marginTop: 2,
  },

  // Stats
  statsGrid: {
    flexDirection: 'row',
    marginTop: 24,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.bg.card,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: Colors.border.subtle,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '800' as const,
    color: Colors.accent.gold,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 10,
    color: Colors.text.tertiary,
    fontWeight: '600' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginTop: 2,
  },

  // Progress
  progressSection: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text.primary,
    marginBottom: 12,
  },
  progressBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: Colors.bg.elevated,
  },
  progressSegment: {
    height: '100%',
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    gap: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: Colors.text.secondary,
  },

  // Schedule mini
  scheduleSection: {
    marginTop: 24,
  },
  scheduleMiniCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    borderWidth: 0.5,
    borderColor: Colors.border.subtle,
  },
  scheduleDayBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.accent.goldBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  scheduleDayNum: {
    fontSize: 14,
    fontWeight: '800' as const,
    color: Colors.accent.gold,
  },
  scheduleMiniInfo: {
    flex: 1,
  },
  scheduleMiniDate: {
    fontSize: 12,
    color: Colors.text.primary,
    fontWeight: '600' as const,
  },
  scheduleMiniScenes: {
    fontSize: 11,
    color: Colors.text.tertiary,
    marginTop: 1,
  },
  scheduleMiniRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 120,
  },
  scheduleMiniLocation: {
    fontSize: 11,
    color: Colors.text.tertiary,
  },
  moreText: {
    fontSize: 12,
    color: Colors.accent.goldDim,
    textAlign: 'center',
    marginTop: 4,
  },

  // Actions
  actionsSection: {
    marginTop: 24,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 6,
    borderWidth: 0.5,
    borderColor: Colors.border.subtle,
    gap: 12,
  },
  actionText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text.primary,
  },
});
