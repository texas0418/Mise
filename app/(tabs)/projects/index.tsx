import React, { useCallback, useRef, useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Animated, ActivityIndicator, Alert } from 'react-native';
import { Image } from 'expo-image';
import { Plus, Film, ChevronRight, Trash2, Check, Archive, ArchiveRestore } from 'lucide-react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useProjects } from '@/contexts/ProjectContext';
import { maybeAskForReview } from '@/utils/reviewPrompt';
import { useLayout } from '@/utils/useLayout';
import Colors from '@/constants/colors';
import { Project, ProjectStatus } from '@/types';
import { useGuardedRouter } from '@/utils/useGuardedRouter';


const STATUS_LABELS: Record<ProjectStatus, string> = {
  'development': 'DEV',
  'pre-production': 'PRE',
  'production': 'PROD',
  'post-production': 'POST',
  'completed': 'DONE',
};

const STATUS_COLORS: Record<ProjectStatus, string> = {
  'development': Colors.status.info,
  'pre-production': Colors.status.warning,
  'production': Colors.status.active,
  'post-production': Colors.accent.gold,
  'completed': Colors.text.tertiary,
};

function ProjectCard({ project, index, isActive, onPress, onDelete, onArchive, onRestore }: {
  project: Project;
  index: number;
  isActive: boolean;
  onPress: () => void;
  onDelete: () => void;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const isArchived = Boolean(project.archivedAt);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const swipeableRef = useRef<Swipeable>(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay: index * 100,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        delay: index * 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const statusColor = STATUS_COLORS[project.status];

  // Archive sits before Delete on purpose: putting a finished film away is the
  // common intention, and destroying every record of it is not (#46).
  const renderRightActions = () => (
    <View style={styles.swipeActions}>
      <TouchableOpacity
        style={styles.archiveAction}
        onPress={() => {
          swipeableRef.current?.close();
          if (isArchived) onRestore(); else onArchive();
        }}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={isArchived ? `Restore ${project.title}` : `Archive ${project.title}`}
        testID={`project-${isArchived ? 'restore' : 'archive'}-${project.id}`}
      >
        {isArchived
          ? <ArchiveRestore color={Colors.text.inverse} size={20} />
          : <Archive color={Colors.text.inverse} size={20} />}
        <Text style={styles.archiveActionText}>{isArchived ? 'Restore' : 'Archive'}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => {
          swipeableRef.current?.close();
          onDelete();
        }}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={`Delete ${project.title} and all of its data`}
        testID={`project-delete-${project.id}`}
      >
        <Trash2 color="#fff" size={20} />
        <Text style={styles.deleteActionText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <Swipeable ref={swipeableRef} renderRightActions={renderRightActions} overshootRight={false}>
        <TouchableOpacity
          style={[styles.projectCard, isActive && styles.projectCardActive]}
          onPress={onPress}
          activeOpacity={0.7}
          testID={`project-card-${project.id}`}
        >
          {project.imageUrl ? (
            <Image
              source={{ uri: project.imageUrl }}
              style={styles.projectImage}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.projectImage, styles.projectImagePlaceholder]}>
              <Film color={Colors.text.tertiary} size={32} />
            </View>
          )}
          <View style={styles.projectImageOverlay} />
          <View style={styles.projectContent}>
            <View style={styles.projectHeader}>
              <View style={[styles.statusBadge, { backgroundColor: statusColor + '22', borderColor: statusColor + '44' }]}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.statusText, { color: statusColor }]}>{STATUS_LABELS[project.status]}</Text>
              </View>
              {isActive && (
                <View style={styles.activePill}>
                  <Check color={Colors.text.inverse} size={11} />
                  <Text style={styles.activePillText}>ACTIVE</Text>
                </View>
              )}
              <Text style={styles.projectFormat}>{project.format}</Text>
            </View>
            <Text style={styles.projectTitle}>{project.title}</Text>
            <Text style={styles.projectLogline} numberOfLines={2}>{project.logline}</Text>
            <View style={styles.projectFooter}>
              <Text style={styles.projectGenre}>{project.genre}</Text>
              <ChevronRight color={Colors.text.tertiary} size={16} />
            </View>
          </View>
        </TouchableOpacity>
      </Swipeable>
    </Animated.View>
  );
}

export default function ProjectsScreen() {
  const {
    projects, activeProjectId, selectProject, deleteProject,
    archiveProject, restoreProject, isLoading, takes, wrapReports,
  } = useProjects();
  const [showArchived, setShowArchived] = useState(false);
  const router = useGuardedRouter();
  const { isTablet, gridColumns, contentPadding } = useLayout();
  const columns = isTablet ? Math.min(gridColumns, 2) : 1;

  // Asked here rather than on set: this screen is where someone lands between
  // shoots, not mid-take. Silent unless the use has earned the ask.
  useEffect(() => {
    if (isLoading) return;
    maybeAskForReview({
      wrapReports: wrapReports.length,
      takes: takes.length,
      projects: projects.length,
    });
  }, [isLoading, wrapReports.length, takes.length, projects.length]);

  const handleProjectPress = useCallback((project: Project) => {
    selectProject(project.id);
    router.push({ pathname: '/project-detail', params: { id: project.id } } as never);
  }, [selectProject, router]);

  // The old wording said "this cannot be undone" while in fact leaving every
  // shot, day and take behind. Now the delete really does take them, so the
  // warning names what goes and offers archiving as the way out (#46).
  const handleDeleteProject = useCallback((project: Project) => {
    Alert.alert(
      `Delete "${project.title}"?`,
      'This deletes the film and everything in it — shots, shoot days, takes, '
      + 'scenes, cast, budget, notes and documents. It cannot be undone.\n\n'
      + 'To keep the film without it cluttering the list, archive it instead.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Archive', onPress: () => archiveProject(project.id) },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: () => deleteProject(project.id),
        },
      ]
    );
  }, [deleteProject, archiveProject]);

  const active = useMemo(() => projects.filter(p => !p.archivedAt), [projects]);
  const archived = useMemo(() => projects.filter(p => p.archivedAt), [projects]);
  // Archived films sit below the live ones, behind a tap, rather than in a
  // separate screen — they are looked at rarely but not never.
  const listed = useMemo(
    () => (showArchived ? [...active, ...archived] : active),
    [active, archived, showArchived],
  );

  const renderProject = useCallback(({ item, index }: { item: Project; index: number }) => (
    <View style={isTablet ? { flex: 1 / columns, padding: 8 } : {}}>
      <ProjectCard
        project={item}
        index={index}
        isActive={item.id === activeProjectId}
        onPress={() => handleProjectPress(item)}
        onDelete={() => handleDeleteProject(item)}
        onArchive={() => archiveProject(item.id)}
        onRestore={() => restoreProject(item.id)}
      />
    </View>
  ), [handleProjectPress, handleDeleteProject, archiveProject, restoreProject, isTablet, columns, activeProjectId]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.accent.gold} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {activeProjectId && (
        <View style={styles.activeProjectBanner}>
          <View style={styles.activeDot} />
          <Text style={styles.activeText}>
            Active: {projects.find(p => p.id === activeProjectId)?.title ?? 'None'}
          </Text>
        </View>
      )}

      <FlatList
        data={listed}
        keyExtractor={item => item.id}
        renderItem={renderProject}
        numColumns={columns}
        key={`projects-${columns}`}
        contentContainerStyle={[styles.list, { paddingHorizontal: contentPadding }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Your Films</Text>
            <Text style={styles.headerSubtitle}>
              {active.length} project{active.length !== 1 ? 's' : ''}
              {archived.length > 0 ? ` · ${archived.length} archived` : ''}
            </Text>
          </View>
        }
        ListFooterComponent={
          archived.length > 0 ? (
            <TouchableOpacity
              style={styles.archivedHeader}
              onPress={() => setShowArchived(v => !v)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={showArchived ? 'Hide archived films' : 'Show archived films'}
              testID="toggle-archived"
            >
              <Archive color={Colors.text.tertiary} size={14} />
              <Text style={styles.archivedHeaderText}>
                {showArchived ? 'HIDE ARCHIVED' : `ARCHIVED (${archived.length})`}
              </Text>
            </TouchableOpacity>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Film color={Colors.text.tertiary} size={48} />
            <Text style={styles.emptyTitle}>No projects yet</Text>
            <Text style={styles.emptySubtitle}>
              Every tool in Mise works on a project. Start with the title and
              you can fill in the rest later.
            </Text>
            <TouchableOpacity
              style={styles.emptyCta}
              onPress={() => router.push('/new-project' as never)}
              activeOpacity={0.8}
              testID="empty-create-project-button"
            >
              <Plus color={Colors.text.inverse} size={18} />
              <Text style={styles.emptyCtaText}>Create Your First Project</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/new-project' as never)}
        activeOpacity={0.8}
        testID="add-project-button"
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
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeProjectBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: Colors.accent.goldBg,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.accent.goldDim + '33',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent.gold,
    marginRight: 8,
  },
  activeText: {
    color: Colors.accent.gold,
    fontSize: 12,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
  },
  header: {
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: Colors.text.primary,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  list: {
    padding: 20,
    paddingBottom: 100,
  },
  projectCard: {
    backgroundColor: Colors.bg.card,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 0.5,
    borderColor: Colors.border.subtle,
  },
  projectCardActive: {
    borderColor: Colors.accent.gold,
    borderWidth: 1.5,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.accent.gold,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    marginLeft: 8,
  },
  activePillText: {
    fontSize: 9,
    fontWeight: '800' as const,
    color: Colors.text.inverse,
    letterSpacing: 0.8,
  },
  projectImage: {
    width: '100%',
    height: 160,
  },
  projectImagePlaceholder: {
    backgroundColor: Colors.bg.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  projectImageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 160,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  projectContent: {
    padding: 16,
  },
  projectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
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
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 1,
  },
  projectFormat: {
    fontSize: 11,
    color: Colors.text.tertiary,
    fontWeight: '500' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
  },
  projectTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text.primary,
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  projectLogline: {
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 19,
    marginBottom: 12,
  },
  projectFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  projectGenre: {
    fontSize: 12,
    color: Colors.accent.goldLight,
    fontWeight: '600' as const,
  },
  swipeActions: {
    flexDirection: 'row',
  },
  archiveAction: {
    backgroundColor: Colors.accent.goldDim,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 16,
    marginBottom: 16,
    marginLeft: 8,
  },
  archiveActionText: {
    color: Colors.text.inverse,
    fontSize: 11,
    fontWeight: '600' as const,
    marginTop: 4,
  },
  archivedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 4,
    paddingTop: 18,
    paddingBottom: 10,
  },
  archivedHeaderText: {
    fontSize: 11,
    fontWeight: '800' as const,
    color: Colors.text.tertiary,
    letterSpacing: 1,
  },
  deleteAction: {
    backgroundColor: Colors.status.error,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 16,
    marginBottom: 16,
    marginLeft: 8,
  },
  deleteActionText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600' as const,
    marginTop: 4,
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
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 24,
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 12,
    backgroundColor: Colors.accent.gold,
  },
  emptyCtaText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text.inverse,
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
