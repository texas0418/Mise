// ---------------------------------------------------------------------------
// app/script-viewer.tsx — PDF Script Viewer with Highlight & Note Annotations
//
// UX:
//   No tool active → PDF handles all gestures (zoom, swipe, scroll)
//   Tap Highlight  → enters highlight mode, PDF locked, drag to highlight
//   Tap Note       → enters note mode, PDF locked, tap to place note
//   Tap active tool again → deactivates, PDF navigation resumes
// ---------------------------------------------------------------------------

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Alert, Dimensions, SafeAreaView, StatusBar, Modal, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft, ChevronLeft, ChevronRight,
  Highlighter, MessageSquare, Undo2, X, Check,
  MessageCircle, Lock,
} from 'lucide-react-native';
import Pdf from 'react-native-pdf';
import { useProjects, useScriptAnnotations } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import { getSignedScriptURL } from '@/utils/scriptPicker';
import Colors from '@/constants/colors';
import { ScriptRevisionColor, ScriptAnnotation } from '@/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const { width: SCREEN_WIDTH } = Dimensions.get('window');

const HIGHLIGHT_COLORS = [
  { label: 'Yellow', hex: '#FBBF24', alpha: '44' },
  { label: 'Green',  hex: '#4ADE80', alpha: '44' },
  { label: 'Blue',   hex: '#60A5FA', alpha: '44' },
  { label: 'Pink',   hex: '#F472B6', alpha: '44' },
  { label: 'Orange', hex: '#FB923C', alpha: '44' },
];

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
// Types
// ---------------------------------------------------------------------------
type ToolMode = 'none' | 'highlight' | 'note';

interface DragState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function ScriptViewerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const scriptId = params.id;

  const {
    scriptPDFs, updateScriptPDF,
    addScriptAnnotation, updateScriptAnnotation, deleteScriptAnnotation,
  } = useProjects();
  const { user } = useAuth();
  const annotations = useScriptAnnotations(scriptId ?? null);

  const script = scriptPDFs.find(s => s.id === scriptId) ?? null;

  // PDF state
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const pdfRef = useRef<any>(null);

  // Tool state
  const [activeMode, setActiveMode] = useState<ToolMode>('none');
  const [highlightColor, setHighlightColor] = useState(HIGHLIGHT_COLORS[0]);
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Highlight drag state
  const [drag, setDrag] = useState<DragState | null>(null);

  // Note modal state
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [notePosition, setNotePosition] = useState<{ x: number; y: number } | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  // Overlay dimensions
  const [overlaySize, setOverlaySize] = useState({ width: 0, height: 0 });

  // Revision color
  const revColor = script?.colorCode ? REVISION_COLORS[script.colorCode] : null;

  // Filter annotations for current page
  const pageHighlights = useMemo(() => {
    return annotations.filter(a => a.pageNumber === currentPage && a.type === 'highlight');
  }, [annotations, currentPage]);

  const pageNotes = useMemo(() => {
    return annotations.filter(a => a.pageNumber === currentPage && a.type === 'note');
  }, [annotations, currentPage]);

  // ---------------------------------------------------------------------------
  // Load signed URL
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!script) {
      setError('Script not found');
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadPDF() {
      try {
        const url = await getSignedScriptURL(script!.filePath);
        if (cancelled) return;
        if (!url) {
          setError('Could not load PDF. Try again.');
          setLoading(false);
          return;
        }
        setPdfUrl(url);
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message || 'Failed to load PDF');
          setLoading(false);
        }
      }
    }

    loadPDF();
    return () => { cancelled = true; };
  }, [script?.filePath]);

  // ---------------------------------------------------------------------------
  // Page navigation
  // ---------------------------------------------------------------------------
  const goToPage = useCallback((page: number) => {
    if (page < 1 || page > totalPages) return;
    pdfRef.current?.setPage(page);
    setCurrentPage(page);
  }, [totalPages]);

  const prevPage = useCallback(() => goToPage(currentPage - 1), [currentPage, goToPage]);
  const nextPage = useCallback(() => goToPage(currentPage + 1), [currentPage, goToPage]);

  // ---------------------------------------------------------------------------
  // Overlay layout
  // ---------------------------------------------------------------------------
  const handleOverlayLayout = useCallback((e: any) => {
    const { width, height } = e.nativeEvent.layout;
    setOverlaySize({ width, height });
  }, []);

  // ---------------------------------------------------------------------------
  // Highlight touch handlers
  // ---------------------------------------------------------------------------
  const handleHighlightStart = useCallback((e: any) => {
    const { locationX, locationY } = e.nativeEvent;
    setDrag({ startX: locationX, startY: locationY, currentX: locationX, currentY: locationY });
  }, []);

  const handleHighlightMove = useCallback((e: any) => {
    if (!drag) return;
    const { locationX, locationY } = e.nativeEvent;
    setDrag(prev => prev ? { ...prev, currentX: locationX, currentY: locationY } : null);
  }, [drag]);

  const handleHighlightEnd = useCallback(() => {
    if (!drag || overlaySize.width === 0 || overlaySize.height === 0) {
      setDrag(null);
      return;
    }

    const x = Math.min(drag.startX, drag.currentX) / overlaySize.width;
    const y = Math.min(drag.startY, drag.currentY) / overlaySize.height;
    const width = Math.abs(drag.currentX - drag.startX) / overlaySize.width;
    const height = Math.abs(drag.currentY - drag.startY) / overlaySize.height;

    // Ignore tiny drags
    if (width < 0.02 && height < 0.01) {
      setDrag(null);
      return;
    }

    if (scriptId && script?.projectId) {
      const now = new Date().toISOString();
      addScriptAnnotation({
        id: `hl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        scriptPdfId: scriptId,
        projectId: script.projectId,
        userId: user?.id || '',
        pageNumber: currentPage,
        type: 'highlight',
        color: highlightColor.hex,
        x, y, width, height,
        createdAt: now,
        updatedAt: now,
      });
    }

    setDrag(null);
  }, [drag, overlaySize, scriptId, script?.projectId, user?.id, currentPage, highlightColor, addScriptAnnotation]);

  // ---------------------------------------------------------------------------
  // Note touch handler
  // ---------------------------------------------------------------------------
  const handleNoteTap = useCallback((e: any) => {
    const { locationX, locationY } = e.nativeEvent;
    if (overlaySize.width === 0 || overlaySize.height === 0) return;
    const x = locationX / overlaySize.width;
    const y = locationY / overlaySize.height;
    setNotePosition({ x, y });
    setNoteText('');
    setEditingNoteId(null);
    setNoteModalVisible(true);
  }, [overlaySize]);

  // ---------------------------------------------------------------------------
  // Note pin handlers
  // ---------------------------------------------------------------------------
  const handleNotePin = useCallback((annotation: ScriptAnnotation) => {
    setNoteText(annotation.textContent || '');
    setNotePosition({ x: annotation.x || 0, y: annotation.y || 0 });
    setEditingNoteId(annotation.id);
    setNoteModalVisible(true);
  }, []);

  const handleNoteSave = useCallback(() => {
    if (!noteText.trim() || !notePosition) {
      setNoteModalVisible(false);
      return;
    }

    if (editingNoteId) {
      const existing = annotations.find(a => a.id === editingNoteId);
      if (existing) {
        updateScriptAnnotation({
          ...existing,
          textContent: noteText.trim(),
          updatedAt: new Date().toISOString(),
        });
      }
    } else {
      if (scriptId && script?.projectId) {
        const now = new Date().toISOString();
        addScriptAnnotation({
          id: `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          scriptPdfId: scriptId,
          projectId: script.projectId,
          userId: user?.id || '',
          pageNumber: currentPage,
          type: 'note',
          color: Colors.accent.gold,
          x: notePosition.x,
          y: notePosition.y,
          textContent: noteText.trim(),
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    setNoteModalVisible(false);
    setNoteText('');
    setNotePosition(null);
    setEditingNoteId(null);
  }, [noteText, notePosition, editingNoteId, scriptId, script?.projectId, user?.id, currentPage, annotations, addScriptAnnotation, updateScriptAnnotation]);

  const handleNoteDelete = useCallback(() => {
    if (editingNoteId) {
      Alert.alert('Delete Note', 'Remove this note?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteScriptAnnotation(editingNoteId);
            setNoteModalVisible(false);
            setEditingNoteId(null);
            setNoteText('');
            setNotePosition(null);
          },
        },
      ]);
    }
  }, [editingNoteId, deleteScriptAnnotation]);

  // Undo last annotation on this page
  const handleUndo = useCallback(() => {
    const pageAnns = annotations
      .filter(a => a.pageNumber === currentPage)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (pageAnns.length > 0) {
      deleteScriptAnnotation(pageAnns[0].id);
    }
  }, [annotations, currentPage, deleteScriptAnnotation]);

  // Toggle tool
  const toggleTool = useCallback((mode: ToolMode) => {
    setActiveMode(prev => prev === mode ? 'none' : mode);
    setShowColorPicker(false);
    setDrag(null);
  }, []);

  // ---------------------------------------------------------------------------
  // Drag preview rect
  // ---------------------------------------------------------------------------
  const dragRect = useMemo(() => {
    if (!drag) return null;
    return {
      left: Math.min(drag.startX, drag.currentX),
      top: Math.min(drag.startY, drag.currentY),
      width: Math.abs(drag.currentX - drag.startX),
      height: Math.abs(drag.currentY - drag.startY),
    };
  }, [drag]);

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------
  if (!script) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <StatusBar barStyle="light-content" />
        <Text style={styles.errorText}>Script not found</Text>
        <TouchableOpacity style={styles.backBtnError} onPress={() => router.back()}>
          <Text style={styles.backBtnErrorText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const isAnnotating = activeMode !== 'none';
  const hasAnnotations = pageHighlights.length > 0 || pageNotes.length > 0;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* ── Top Bar ── */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ArrowLeft color={Colors.text.primary} size={22} />
        </TouchableOpacity>

        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {script.title}
          </Text>
          {script.version && (
            <Text style={styles.versionText}>{script.version}</Text>
          )}
        </View>

        {isAnnotating && hasAnnotations && (
          <TouchableOpacity
            style={styles.undoBtn}
            onPress={handleUndo}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Undo2 color={Colors.text.primary} size={18} />
          </TouchableOpacity>
        )}

        {revColor && (
          <View style={[styles.revDot, { backgroundColor: revColor.bg }]} />
        )}
      </View>

      {/* ── Locked banner ── */}
      {isAnnotating && (
        <View style={styles.lockedBanner}>
          <Lock color={Colors.accent.gold} size={12} />
          <Text style={styles.lockedBannerText}>
            {activeMode === 'highlight'
              ? 'Highlight mode · Drag to mark up · Tap tool to exit'
              : 'Note mode · Tap to place · Tap tool to exit'}
          </Text>
        </View>
      )}

      {/* ── PDF View ── */}
      <View style={styles.pdfContainer}>
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color={Colors.accent.gold} size="large" />
            <Text style={styles.loadingText}>Loading script...</Text>
          </View>
        )}

        {error && (
          <View style={styles.loadingOverlay}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => {
                setError(null);
                setLoading(true);
                getSignedScriptURL(script.filePath).then(url => {
                  if (url) setPdfUrl(url);
                  else setError('Could not load PDF');
                  setLoading(false);
                });
              }}
            >
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {pdfUrl && (
          <Pdf
            ref={pdfRef}
            source={{ uri: pdfUrl, cache: true }}
            style={styles.pdf}
            enablePaging={true}
            horizontal={false}
            enableAntialiasing={true}
            enableAnnotationRendering={false}
            fitPolicy={0}
            spacing={0}
            onLoadComplete={(numberOfPages) => {
              setTotalPages(numberOfPages);
              setLoading(false);
              if (script.pageCount === 0 || script.pageCount !== numberOfPages) {
                updateScriptPDF({
                  ...script,
                  pageCount: numberOfPages,
                  updatedAt: new Date().toISOString(),
                });
              }
            }}
            onPageChanged={(page) => {
              setCurrentPage(page);
            }}
            onError={(err) => {
              console.log('PDF error:', err);
              setError('Could not display PDF');
              setLoading(false);
            }}
          />
        )}

        {/* ── Annotation Overlay ── */}
        {/*
          When no tool is active: pointerEvents='box-none' so note pins
          are tappable but everything else passes through to PDF.
          
          When highlight is active: pointerEvents='auto' captures all
          touches for dragging. PDF navigation is intentionally locked.
          
          When note is active: pointerEvents='auto' captures taps for
          placing notes. PDF navigation is intentionally locked.
        */}
        <View
          style={styles.annotationOverlay}
          pointerEvents={isAnnotating ? 'auto' : 'box-none'}
          onLayout={handleOverlayLayout}
          onTouchStart={
            activeMode === 'highlight' ? handleHighlightStart
            : activeMode === 'note' ? handleNoteTap
            : undefined
          }
          onTouchMove={activeMode === 'highlight' ? handleHighlightMove : undefined}
          onTouchEnd={activeMode === 'highlight' ? handleHighlightEnd : undefined}
        >
          {/* Persisted highlights */}
          {pageHighlights.map(h => (
            <View
              key={h.id}
              pointerEvents="none"
              style={[
                styles.highlightRect,
                {
                  left: `${(h.x || 0) * 100}%` as any,
                  top: `${(h.y || 0) * 100}%` as any,
                  width: `${(h.width || 0) * 100}%` as any,
                  height: `${(h.height || 0) * 100}%` as any,
                  backgroundColor: (h.color || HIGHLIGHT_COLORS[0].hex) + '44',
                  borderColor: (h.color || HIGHLIGHT_COLORS[0].hex) + '88',
                },
              ]}
            />
          ))}

          {/* Drag preview */}
          {dragRect && (
            <View
              pointerEvents="none"
              style={[
                styles.highlightRect,
                styles.highlightPreview,
                {
                  left: dragRect.left,
                  top: dragRect.top,
                  width: dragRect.width,
                  height: dragRect.height,
                  backgroundColor: highlightColor.hex + highlightColor.alpha,
                  borderColor: highlightColor.hex + '88',
                },
              ]}
            />
          )}

          {/* Note pins */}
          {pageNotes.map(n => (
            <TouchableOpacity
              key={n.id}
              style={[
                styles.notePin,
                {
                  left: `${(n.x || 0) * 100}%` as any,
                  top: `${(n.y || 0) * 100}%` as any,
                },
              ]}
              onPress={() => handleNotePin(n)}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MessageCircle color="#fff" size={12} fill={Colors.accent.gold} />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Color Picker ── */}
      {activeMode === 'highlight' && showColorPicker && (
        <View style={styles.colorPickerBar}>
          {HIGHLIGHT_COLORS.map(c => (
            <TouchableOpacity
              key={c.hex}
              style={[
                styles.colorSwatch,
                { backgroundColor: c.hex },
                highlightColor.hex === c.hex && styles.colorSwatchActive,
              ]}
              onPress={() => {
                setHighlightColor(c);
                setShowColorPicker(false);
              }}
            />
          ))}
        </View>
      )}

      {/* ── Bottom Toolbar ── */}
      <View style={styles.bottomBar}>
        <View style={styles.toolButtons}>
          <TouchableOpacity
            style={[styles.toolBtn, activeMode === 'highlight' && styles.toolBtnActive]}
            onPress={() => toggleTool('highlight')}
            activeOpacity={0.7}
          >
            <Highlighter
              color={activeMode === 'highlight' ? Colors.accent.gold : Colors.text.tertiary}
              size={18}
            />
            {activeMode === 'highlight' && (
              <Text style={styles.toolBtnLabel}>Highlight</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toolBtn, activeMode === 'note' && styles.toolBtnActive]}
            onPress={() => toggleTool('note')}
            activeOpacity={0.7}
          >
            <MessageSquare
              color={activeMode === 'note' ? Colors.accent.gold : Colors.text.tertiary}
              size={18}
            />
            {activeMode === 'note' && (
              <Text style={styles.toolBtnLabel}>Note</Text>
            )}
          </TouchableOpacity>

          {activeMode === 'highlight' && (
            <TouchableOpacity
              style={[styles.toolBtn, styles.colorToggleBtn]}
              onPress={() => setShowColorPicker(!showColorPicker)}
              activeOpacity={0.7}
            >
              <View style={[styles.colorIndicator, { backgroundColor: highlightColor.hex }]} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.pageNav}>
          <TouchableOpacity
            onPress={prevPage}
            disabled={currentPage <= 1}
            style={[styles.pageBtn, currentPage <= 1 && styles.pageBtnDisabled]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ChevronLeft
              color={currentPage <= 1 ? Colors.text.tertiary : Colors.text.primary}
              size={18}
            />
          </TouchableOpacity>

          <Text style={styles.pageText}>
            {currentPage} / {totalPages || '—'}
          </Text>

          <TouchableOpacity
            onPress={nextPage}
            disabled={currentPage >= totalPages}
            style={[styles.pageBtn, currentPage >= totalPages && styles.pageBtnDisabled]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ChevronRight
              color={currentPage >= totalPages ? Colors.text.tertiary : Colors.text.primary}
              size={18}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Note Modal ── */}
      <Modal
        visible={noteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNoteModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalBackdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingNoteId ? 'Edit Note' : 'New Note'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setNoteModalVisible(false);
                  setEditingNoteId(null);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X color={Colors.text.tertiary} size={20} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.noteInput}
              value={noteText}
              onChangeText={setNoteText}
              placeholder="Type your note..."
              placeholderTextColor={Colors.text.tertiary}
              multiline
              autoFocus
              textAlignVertical="top"
            />

            <View style={styles.modalActions}>
              {editingNoteId && (
                <TouchableOpacity style={styles.deleteNoteBtn} onPress={handleNoteDelete}>
                  <Text style={styles.deleteNoteBtnText}>Delete</Text>
                </TouchableOpacity>
              )}
              <View style={{ flex: 1 }} />
              <TouchableOpacity
                style={[styles.saveNoteBtn, !noteText.trim() && styles.saveNoteBtnDisabled]}
                onPress={handleNoteSave}
                disabled={!noteText.trim()}
              >
                <Check color={Colors.text.inverse} size={16} />
                <Text style={styles.saveNoteBtnText}>
                  {editingNoteId ? 'Update' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  errorContainer: { flex: 1, backgroundColor: Colors.bg.primary, justifyContent: 'center', alignItems: 'center', padding: 40 },
  errorText: { fontSize: 16, color: Colors.status.error, textAlign: 'center', marginBottom: 16 },
  backBtnError: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: Colors.bg.elevated },
  backBtnErrorText: { fontSize: 14, fontWeight: '600', color: Colors.text.primary },

  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: Colors.bg.primary, borderBottomWidth: 0.5, borderBottomColor: Colors.border.subtle, gap: 10 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.bg.elevated, justifyContent: 'center', alignItems: 'center' },
  titleWrap: { flex: 1 },
  title: { fontSize: 15, fontWeight: '700', color: Colors.text.primary },
  versionText: { fontSize: 11, color: Colors.text.secondary, marginTop: 1 },
  undoBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.bg.elevated, justifyContent: 'center', alignItems: 'center' },
  revDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },

  lockedBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: Colors.accent.goldBg, paddingVertical: 6 },
  lockedBannerText: { fontSize: 12, fontWeight: '600', color: Colors.accent.gold },

  pdfContainer: { flex: 1, backgroundColor: '#1a1a1a' },
  pdf: { flex: 1, width: SCREEN_WIDTH, backgroundColor: '#1a1a1a' },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a1a', zIndex: 10 },
  loadingText: { fontSize: 14, color: Colors.text.secondary, marginTop: 12 },
  retryBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: Colors.accent.goldBg, borderWidth: 0.5, borderColor: Colors.accent.gold + '44' },
  retryBtnText: { fontSize: 14, fontWeight: '600', color: Colors.accent.gold },

  annotationOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 20 },
  highlightRect: { position: 'absolute', borderWidth: 1, borderRadius: 2 },
  highlightPreview: { borderStyle: 'dashed', borderWidth: 1.5 },
  notePin: { position: 'absolute', width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.accent.gold, justifyContent: 'center', alignItems: 'center', marginLeft: -14, marginTop: -14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },

  colorPickerBar: { flexDirection: 'row', justifyContent: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: Colors.bg.elevated, borderTopWidth: 0.5, borderTopColor: Colors.border.subtle },
  colorSwatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: 'transparent' },
  colorSwatchActive: { borderColor: Colors.accent.gold, shadowColor: Colors.accent.gold, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 4 },

  bottomBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: Colors.bg.primary, borderTopWidth: 0.5, borderTopColor: Colors.border.subtle },
  toolButtons: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  toolBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8 },
  toolBtnActive: { backgroundColor: Colors.accent.goldBg },
  toolBtnLabel: { fontSize: 11, fontWeight: '600', color: Colors.accent.gold },
  colorToggleBtn: { marginLeft: 4 },
  colorIndicator: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)' },

  pageNav: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pageBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: Colors.bg.elevated, justifyContent: 'center', alignItems: 'center' },
  pageBtnDisabled: { opacity: 0.4 },
  pageText: { fontSize: 13, fontWeight: '600', color: Colors.text.secondary, minWidth: 50, textAlign: 'center' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard: { width: '100%', maxWidth: 420, backgroundColor: Colors.bg.elevated, borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16, elevation: 8 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: Colors.text.primary },
  noteInput: { backgroundColor: Colors.bg.input, borderRadius: 10, padding: 14, fontSize: 15, color: Colors.text.primary, minHeight: 100, borderWidth: 0.5, borderColor: Colors.border.subtle },
  modalActions: { flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 12 },
  deleteNoteBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.status.error + '18', borderWidth: 0.5, borderColor: Colors.status.error + '44' },
  deleteNoteBtnText: { fontSize: 13, fontWeight: '600', color: Colors.status.error },
  saveNoteBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: Colors.accent.gold },
  saveNoteBtnDisabled: { opacity: 0.4 },
  saveNoteBtnText: { fontSize: 13, fontWeight: '600', color: Colors.text.inverse },
});
