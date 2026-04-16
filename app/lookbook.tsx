import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, SectionList, TouchableOpacity, Animated, Alert, TextInput, Platform } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Plus, Trash2, Film, Palette, Eye, Camera, Music, Shirt, Globe, Sparkles, PenLine, ChevronDown, ChevronUp, Pencil } from 'lucide-react-native';
import { useProjects, useProjectLookbook, useProjectDirectorStatement } from '@/contexts/ProjectContext';
import { useLayout } from '@/utils/useLayout';
import Colors from '@/constants/colors';
import { LookbookItem, LookbookSectionType, DirectorStatement } from '@/types';
import PermissionGate from '@/contexts/PermissionGate';

const SECTION_CONFIG: Record<LookbookSectionType, { label: string; icon: React.ElementType; color: string }> = {
  'tone': { label: 'Tone & Mood', icon: Sparkles, color: '#FBBF24' },
  'visual-style': { label: 'Visual Style', icon: Eye, color: '#60A5FA' },
  'color-palette': { label: 'Color Palette', icon: Palette, color: '#F472B6' },
  'shot-style': { label: 'Shot Style', icon: Camera, color: '#4ADE80' },
  'reference-film': { label: 'Reference Films', icon: Film, color: '#A78BFA' },
  'character-look': { label: 'Character Looks', icon: Shirt, color: '#FB923C' },
  'world-building': { label: 'World Building', icon: Globe, color: '#06B6D4' },
  'sound-music': { label: 'Sound & Music', icon: Music, color: '#E879F9' },
  'custom': { label: 'Custom', icon: PenLine, color: Colors.text.tertiary },
};

function LookbookCard({ item, isExpanded, onPress, onEdit, onDelete }: {
  item: LookbookItem; isExpanded: boolean; onPress: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const handleDelete = () => {
    Alert.alert('Remove', `Delete "${item.title}"?`, [
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
      {item.imageUrl && (
        <Image source={{ uri: item.imageUrl }} style={styles.cardImage} contentFit="cover" />
      )}
      {item.colorHex && (
        <View style={[styles.colorSwatch, { backgroundColor: item.colorHex }]} />
      )}
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          {isExpanded ? (
            <ChevronUp color={Colors.text.tertiary} size={16} />
          ) : (
            <ChevronDown color={Colors.text.tertiary} size={16} />
          )}
        </View>

        {/* Always show reference film badge if present */}
        {item.referenceFilm && (
          <View style={styles.refFilmBadge}>
            <Film color={Colors.accent.goldDim} size={11} />
            <Text style={styles.refFilmText}>{item.referenceFilm}</Text>
          </View>
        )}

        {/* Collapsed: truncated description */}
        {!isExpanded && (
          <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
        )}

        {/* Expanded: full content + actions */}
        {isExpanded && (
          <>
            <Text style={styles.cardDescFull}>{item.description}</Text>
            {item.colorHex && (
              <View style={styles.colorInfo}>
                <View style={[styles.colorDot, { backgroundColor: item.colorHex }]} />
                <Text style={styles.colorHexText}>{item.colorHex}</Text>
              </View>
            )}
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
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

function DirectorStatementSection({ statement, onSave }: {
  statement: DirectorStatement | null; onSave: (text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(statement?.text || '');
  const [expanded, setExpanded] = useState(true);

  const handleSave = () => {
    onSave(text);
    setEditing(false);
  };

  return (
    <View style={styles.statementSection}>
      <TouchableOpacity style={styles.statementHeader} onPress={() => setExpanded(!expanded)}>
        <View style={styles.statementHeaderLeft}>
          <PenLine color={Colors.accent.gold} size={16} />
          <Text style={styles.statementTitle}>Director's Statement</Text>
        </View>
        {expanded ? <ChevronUp color={Colors.text.tertiary} size={16} /> : <ChevronDown color={Colors.text.tertiary} size={16} />}
      </TouchableOpacity>

      {expanded && (
        <View style={styles.statementBody}>
          {editing ? (
            <View>
              <TextInput
                style={styles.statementInput}
                value={text}
                onChangeText={setText}
                multiline
                placeholder="Write your director's statement — your vision, your why, your approach..."
                placeholderTextColor={Colors.text.tertiary}
              />
              <View style={styles.statementActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => { setEditing(false); setText(statement?.text || ''); }}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveSmallBtn} onPress={handleSave}>
                  <Text style={styles.saveSmallBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setEditing(true)} activeOpacity={0.7}>
              {statement?.text ? (
                <Text style={styles.statementText}>{statement.text}</Text>
              ) : (
                <Text style={styles.statementPlaceholder}>Tap to write your director's statement...</Text>
              )}
              <Text style={styles.tapToEdit}>Tap to edit</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

export default function LookbookScreen() {
  const { activeProjectId, activeProject, deleteLookbookItem, addDirectorStatement, updateDirectorStatement } = useProjects();
  const lookbook = useProjectLookbook(activeProjectId);
  const statement = useProjectDirectorStatement(activeProjectId);
  const router = useRouter();
  const { isTablet, contentPadding } = useLayout();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleSaveStatement = useCallback((text: string) => {
    if (statement) {
      updateDirectorStatement({ ...statement, text, updatedAt: new Date().toISOString() });
    } else {
      addDirectorStatement({
        id: Date.now().toString(),
        projectId: activeProjectId || '1',
        text,
        updatedAt: new Date().toISOString(),
      });
    }
  }, [statement, activeProjectId, addDirectorStatement, updateDirectorStatement]);

  const sectionOrder: LookbookSectionType[] = [
    'tone', 'visual-style', 'color-palette', 'shot-style', 'reference-film',
    'character-look', 'world-building', 'sound-music', 'custom',
  ];

  const sections = sectionOrder
    .map(sType => ({
      sectionType: sType,
      title: SECTION_CONFIG[sType].label,
      data: lookbook.filter(l => l.section === sType),
    }))
    .filter(s => s.data.length > 0);

  return (
    <PermissionGate resource="lookbook">
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <LookbookCard
            item={item}
            isExpanded={expandedId === item.id}
            onPress={() => setExpandedId(expandedId === item.id ? null : item.id)}
            onEdit={() => router.push(`/new-lookbook-item?id=${item.id}` as never)}
            onDelete={() => deleteLookbookItem(item.id)}
          />
        )}
        renderSectionHeader={({ section }) => {
          const config = SECTION_CONFIG[(section as typeof sections[0]).sectionType];
          const Icon = config.icon;
          return (
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconWrap, { backgroundColor: config.color + '18' }]}>
                <Icon color={config.color} size={14} />
              </View>
              <Text style={[styles.sectionTitle, { color: config.color }]}>{config.label}</Text>
              <View style={styles.sectionLine} />
            </View>
          );
        }}
        contentContainerStyle={[styles.list, {
          paddingHorizontal: contentPadding,
          maxWidth: isTablet ? 800 : undefined,
          alignSelf: isTablet ? 'center' as const : undefined,
          width: isTablet ? '100%' : undefined,
        }]}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <View>
            <View style={styles.lookbookHeader}>
              <Text style={styles.lookbookTitle}>{activeProject?.title || 'Untitled'}</Text>
              <Text style={styles.lookbookSubtitle}>Director's Lookbook</Text>
            </View>
            <DirectorStatementSection statement={statement} onSave={handleSaveStatement} />
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Eye color={Colors.text.tertiary} size={48} />
            <Text style={styles.emptyTitle}>Empty lookbook</Text>
            <Text style={styles.emptySubtitle}>Add visual references to define your film's world</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/new-lookbook-item' as never)}
        activeOpacity={0.8}
      >
        <Plus color={Colors.text.inverse} size={24} />
      </TouchableOpacity>
    </View>
  </PermissionGate>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  list: { padding: 16, paddingBottom: 100 },
  lookbookHeader: { alignItems: 'center', paddingVertical: 20 },
  lookbookTitle: { fontSize: 28, fontWeight: '800' as const, color: Colors.text.primary, letterSpacing: -0.5 },
  lookbookSubtitle: { fontSize: 13, color: Colors.accent.goldLight, fontWeight: '600' as const, marginTop: 4, textTransform: 'uppercase' as const, letterSpacing: 1.5 },
  statementSection: { backgroundColor: Colors.bg.card, borderRadius: 14, marginBottom: 20, borderWidth: 0.5, borderColor: Colors.border.subtle, overflow: 'hidden' },
  statementHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: 0.5, borderBottomColor: Colors.border.subtle },
  statementHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statementTitle: { fontSize: 14, fontWeight: '700' as const, color: Colors.accent.gold },
  statementBody: { padding: 16 },
  statementText: { fontSize: 14, color: Colors.text.secondary, lineHeight: 22 },
  statementPlaceholder: { fontSize: 14, color: Colors.text.tertiary, fontStyle: 'italic' as const, lineHeight: 22 },
  tapToEdit: { fontSize: 10, color: Colors.text.tertiary, marginTop: 8, textAlign: 'right' },
  statementInput: { backgroundColor: Colors.bg.tertiary, borderRadius: 10, padding: 14, fontSize: 14, color: Colors.text.primary, lineHeight: 22, minHeight: 160, textAlignVertical: 'top' as const, borderWidth: 0.5, borderColor: Colors.accent.gold + '33' },
  statementActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.bg.tertiary },
  cancelBtnText: { fontSize: 13, color: Colors.text.secondary, fontWeight: '600' as const },
  saveSmallBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.accent.gold },
  saveSmallBtnText: { fontSize: 13, color: Colors.text.inverse, fontWeight: '600' as const },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 10 },
  sectionIconWrap: { width: 28, height: 28, borderRadius: 7, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { fontSize: 12, fontWeight: '700' as const, letterSpacing: 0.8, textTransform: 'uppercase' as const },
  sectionLine: { flex: 1, height: 0.5, backgroundColor: Colors.border.subtle },
  card: { backgroundColor: Colors.bg.card, borderRadius: 14, overflow: 'hidden', marginBottom: 12, borderWidth: 0.5, borderColor: Colors.border.subtle },
  cardExpanded: { borderColor: Colors.accent.gold + '44', borderWidth: 1 },
  cardImage: { width: '100%', height: 180 },
  colorSwatch: { width: '100%', height: 48, borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  cardContent: { padding: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  cardTitle: { fontSize: 16, fontWeight: '700' as const, color: Colors.text.primary, flex: 1, marginRight: 8 },
  refFilmBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  refFilmText: { fontSize: 12, color: Colors.accent.goldDim, fontWeight: '500' as const, fontStyle: 'italic' as const },
  cardDesc: { fontSize: 13, color: Colors.text.secondary, lineHeight: 20 },
  cardDescFull: { fontSize: 13, color: Colors.text.secondary, lineHeight: 20, marginBottom: 10 },
  colorInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  colorDot: { width: 16, height: 16, borderRadius: 8, borderWidth: 0.5, borderColor: Colors.border.subtle },
  colorHexText: { fontSize: 12, color: Colors.text.tertiary, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 10, borderTopWidth: 0.5, borderTopColor: Colors.border.subtle },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.accent.goldBg, borderWidth: 0.5, borderColor: Colors.accent.gold + '44' },
  editBtnText: { fontSize: 12, fontWeight: '600' as const, color: Colors.accent.gold },
  deleteBtnAction: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.status.error + '12', borderWidth: 0.5, borderColor: Colors.status.error + '44' },
  deleteBtnText: { fontSize: 12, fontWeight: '600' as const, color: Colors.status.error },
  emptyContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '600' as const, color: Colors.text.primary, marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: Colors.text.secondary, marginTop: 4 },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.accent.gold, justifyContent: 'center', alignItems: 'center', shadowColor: Colors.accent.gold, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
});
