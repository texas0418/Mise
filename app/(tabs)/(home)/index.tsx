import React, { useCallback, useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Animated, ActivityIndicator, Alert } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Plus, Film, ChevronRight, Trash2 } from 'lucide-react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useProjects } from '@/contexts/ProjectContext';
import { useLayout } from '@/utils/useLayout';
import Colors from '@/constants/colors';
import { Project, ProjectStatus } from '@/types';


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

function ProjectCard({ project, index, onPress, onDelete }: { project: Project; index: number; onPress: () => void; onDelete: () => void }) {
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

  const renderRightActions = () => (
    <TouchableOpacity
      style={styles.deleteAction}
      onPress={() => {
        swipeableRef.current?.close();
        onDelete();
      }}
      activeOpacity={0.7}
    >
      <Trash2 color="#fff" size={20} />
      <Text style={styles.deleteActionText}>Delete</Text>
    </TouchableOpacity>
  );

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
      <Swipeable ref={swipeableRef} renderRightActions={renderRightActions} overshootRight={false}>
        <TouchableOpacity
          style={styles.projectCard}
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
  const { projects, activeProjectId, selectProject, deleteProject, isLoading } = useProjects();
  const router = useRouter();
  const { isTablet, gridColumns, contentPadding } = useLayout();
  const columns = isTablet ? Math.min(gridColumns, 2) : 1;

  const handleProjectPress = useCallback((project: Project) => {
    selectProject(project.id);
    router.push({ pathname: '/project-detail', params: { id: project.id } } as never);
  }, [selectProject, router]);

  const handleDeleteProject = useCallback((project: Project) => {
    Alert.alert(
      'Delete Project',
      `Are you sure you want to delete "${project.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteProject(project.id),
        },
      ]
    );
  }, [deleteProject]);

  const renderProject = useCallback(({ item, index }: { item: Project; index: number }) => (
    <View style={isTablet ? { flex: 1 / columns, padding: 8 } : {}}>
      <ProjectCard
        project={item}
        index={index}
        onPress={() => handleProjectPress(item)}
        onDelete={() => handleDeleteProject(item)}
      />
    </View>
  ), [handleProjectPress, handleDeleteProject, isTablet, columns]);

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
        data={projects}
        keyExtractor={item => item.id}
        renderItem={renderProject}
        numColumns={columns}
        key={`projects-${columns}`}
        contentContainerStyle={[styles.list, { paddingHorizontal: contentPadding }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Your Films</Text>
            <Text style={styles.headerSubtitle}>{projects.length} project{projects.length !== 1 ? 's' : ''}</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Film color={Colors.text.tertiary} size={48} />
            <Text style={styles.emptyTitle}>No projects yet</Text>
            <Text style={styles.emptySubtitle}>Start your first film project</Text>
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
