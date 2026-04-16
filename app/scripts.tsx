import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import {
  Plus, FileText, AlertCircle, ChevronDown, ChevronUp,
  Eye, Trash2, Upload,
} from 'lucide-react-native';
import { useProjects, useProjectScriptPDFs } from '@/contexts/ProjectContext';
import { useLayout } from '@/utils/useLayout';
import Colors from '@/constants/colors';
import { ScriptPDF, ScriptRevisionColor } from '@/types';
import PermissionGate from '@/contexts/PermissionGate';

// ---------------------------------------------------------------------------
// Revision color display config (industry standard)
// ---------------------------------------------------------------------------
const REVISION_COLORS: Record<ScriptRevisionColor, { bg: string; text: string; label: string }> = {
  white:     { bg: '#FFFFFF',  text: '#000000', label: 'White' },
  blue:      { bg: '#A8C8E8',  text: '#1A3A5C', label: 'Blue' },
  pink:      { bg: '#F4B8C8',  text: '#6B1E34', label: 'Pink' },
  yellow:    { bg: '#FDE68A',  text: '#713F12', label: 'Yellow' },
  green:     { bg: '#A7F3D0',  text: '#064E3B', label: 'Green' },
  goldenrod: { bg: '#DAA520',  text: '#3B2A04', label: 'Goldenrod' },
  buff:      { bg: '#F5DEB3',  text: '#5C4A1E', label: 'Buff' },
  salmon:    { bg: '#FA8072',  text: '#5C1A12', label: 'Salmon' },
  cherry:    { bg: '#DE3163',  text: '#FFFFFF', label: 'Cherry' },
};

// ---------------------------------------------------------------------------
// Script Card
// ---------------------------------------------------------------------------
function ScriptCard({
  item,
  isExpanded,
  onPress,
  onView,
  onDelete,
}: {
  item: ScriptPDF;
  isExpanded: boolean;
  onPress: () => void;
  onView: () => void;
  onDelete: () => void;
}) {
  const revColor = item.colorCode ? REVISION_COLORS[item.colorCode] : null;
  const fileSizeMB = item.fileSize ? (item.fileSize / 1024 / 1024).toFixed(1) : null;
  const uploadDate = item.uploadedAt
    ? new Date(item.uploadedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  const handleDelete = () => {
    Alert.alert('Delete Script', `Remove "${item.title}"? This will also delete all annotations.`, [
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
      {/* Card header */}
      <View style={styles.cardHeader}>
        {/* Revision color dot */}
        <View
          style={[
            styles.colorDot,
            { backgroundColor: revColor?.bg ?? Colors.text.tertiary },
            !revColor && styles.colorDotDefault,
          ]}
        />

        <View style={styles.cardHeaderText}>
          <Text style={styles.cardTitle} numberOfLines={isExpanded ? undefined : 1}>
            {item.title}
          </Text>
          <View style={styles.cardMeta}>
            {item.version ? (
              <Text style={styles.cardVersion}>{item.version}</Text>
            ) : null}
            {revColor ? (
              <View style={[styles.revBadge, { backgroundColor: revColor.bg }]}>
                <Text style={[styles.revBadgeText, { color: revColor.text }]}>
                  {revColor.label}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {isExpanded ? (
          <ChevronUp color={Colors.text.tertiary} size={16} />
        ) : (
          <ChevronDown color={Colors.text.tertiary} size={16} />
        )}
      </View>

      {/* Collapsed: summary row */}
      {!isExpanded && (
        <View style={styles.cardBody}>
          <View style={styles.statRow}>
            {item.pageCount ? (
              <Text style={styles.statText}>{item.pageCount} pages</Text>
            ) : null}
            {fileSizeMB ? (
              <Text style={styles.statText}>{fileSizeMB} MB</Text>
            ) : null}
            <Text style={styles.statText}>{uploadDate}</Text>
          </View>
        </View>
      )}

      {/* Expanded: full details + actions */}
      {isExpanded && (
        <View style={styles.expandedBody}>
          {item.pageCount ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>PAGES</Text>
              <Text style={styles.detailValue}>{item.pageCount}</Text>
            </View>
          ) : null}

          {fileSizeMB ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>FILE SIZE</Text>
              <Text style={styles.detailValue}>{fileSizeMB} MB</Text>
            </View>
          ) : null}

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>UPLOADED</Text>
            <Text style={styles.detailValue}>{uploadDate}</Text>
          </View>

          <View style={styles.cardActions}>
            <TouchableOpacity onPress={onView} style={styles.viewBtn}>
              <Eye color={Colors.accent.gold} size={15} />
              <Text style={styles.viewBtnText}>Open</Text>
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

// ---------------------------------------------------------------------------
// Scripts List Screen
// ---------------------------------------------------------------------------
export default function ScriptsScreen() {
  const { activeProject, activeProjectId, deleteScriptPDF } = useProjects();
  const scripts = useProjectScriptPDFs(activeProjectId);
  const router = useRouter();
  const { isTablet, contentPadding } = useLayout();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!activeProject) {
    return (
      <View style={styles.empty}>
        <Stack.Screen options={{ title: 'Scripts' }} />
        <AlertCircle color={Colors.text.tertiary} size={48} />
        <Text style={styles.emptyTitle}>No project selected</Text>
      </View>
    );
  }

  return (
    <PermissionGate resource="scripts">
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Scripts' }} />

        <FlatList
          data={scripts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ScriptCard
              item={item}
              isExpanded={expandedId === item.id}
              onPress={() =>
                setExpandedId(expandedId === item.id ? null : item.id)
              }
              onView={() =>
                router.push(`/script-viewer?id=${item.id}` as never)
              }
              onDelete={() => {
                deleteScriptPDF(item.id);
                setExpandedId(null);
              }}
            />
          )}
          contentContainerStyle={[
            styles.list,
            {
              paddingHorizontal: contentPadding,
              maxWidth: isTablet ? 800 : undefined,
              alignSelf: isTablet ? ('center' as const) : undefined,
              width: isTablet ? '100%' : undefined,
            },
          ]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.header}>
              <Text style={styles.headerTitle}>
                {scripts.length} Script{scripts.length !== 1 ? 's' : ''}
              </Text>
              <Text style={styles.headerSub}>
                Scripts for {activeProject.title}
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyInner}>
              <FileText color={Colors.text.tertiary} size={48} />
              <Text style={styles.emptyTitle}>No scripts yet</Text>
              <Text style={styles.emptySub}>
                Upload a PDF script to view, annotate, and mark up
              </Text>
              <TouchableOpacity
                style={styles.emptyUploadBtn}
                onPress={() => router.push('/new-script' as never)}
                activeOpacity={0.8}
              >
                <Upload color={Colors.accent.gold} size={16} />
                <Text style={styles.emptyUploadText}>Upload Script</Text>
              </TouchableOpacity>
            </View>
          }
        />

        <TouchableOpacity
          style={styles.fab}
          onPress={() => router.push('/new-script' as never)}
          activeOpacity={0.8}
        >
          <Plus color={Colors.text.inverse} size={24} />
        </TouchableOpacity>
      </View>
    </PermissionGate>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  list: { padding: 16, paddingBottom: 100 },
  header: { marginBottom: 12 },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text.primary,
  },
  headerSub: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 2,
  },

  // Card
  card: {
    backgroundColor: Colors.bg.card,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: Colors.border.subtle,
  },
  cardExpanded: {
    borderColor: Colors.accent.gold + '44',
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  colorDotDefault: {
    borderColor: Colors.border.medium,
  },
  cardHeaderText: { flex: 1 },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text.primary,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  cardVersion: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  revBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  revBadgeText: {
    fontSize: 9,
    fontWeight: '700' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },

  // Collapsed body
  cardBody: { paddingHorizontal: 14, paddingBottom: 12 },
  statRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statText: {
    fontSize: 12,
    color: Colors.text.tertiary,
  },

  // Expanded body
  expandedBody: { padding: 14, paddingTop: 0 },
  detailRow: { marginBottom: 10 },
  detailLabel: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: Colors.text.tertiary,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 13,
    color: Colors.text.secondary,
  },

  // Actions
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingTop: 12,
    marginTop: 4,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border.subtle,
  },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.accent.goldBg,
    borderWidth: 0.5,
    borderColor: Colors.accent.gold + '44',
  },
  viewBtnText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.accent.gold,
  },
  deleteBtnAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.status.error + '12',
    borderWidth: 0.5,
    borderColor: Colors.status.error + '44',
  },
  deleteBtnText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.status.error,
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

  // Empty states
  empty: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyInner: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text.primary,
    marginTop: 16,
  },
  emptySub: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 4,
    textAlign: 'center',
  },
  emptyUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.accent.goldBg,
    borderWidth: 0.5,
    borderColor: Colors.accent.gold + '44',
  },
  emptyUploadText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.accent.gold,
  },
});
