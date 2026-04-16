// ---------------------------------------------------------------------------
// app/script-viewer.tsx — PDF Script Viewer with Annotation Layer
//
// Phase 1: PDF rendering + page navigation
// Phase 2: Annotation tools (highlight, draw, notes) — coming next
// ---------------------------------------------------------------------------

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Alert, Dimensions, SafeAreaView, StatusBar,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft, ChevronLeft, ChevronRight,
  Hand, Pen, Highlighter, MessageSquare,
} from 'lucide-react-native';
import Pdf from 'react-native-pdf';
import { useProjects, useScriptAnnotations } from '@/contexts/ProjectContext';
import { getSignedScriptURL } from '@/utils/scriptPicker';
import Colors from '@/constants/colors';
import { ScriptRevisionColor } from '@/types';

// ---------------------------------------------------------------------------
// Revision color config (matches scripts.tsx)
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
// Annotation tool modes
// ---------------------------------------------------------------------------
type ToolMode = 'pan' | 'draw' | 'highlight' | 'note';

const TOOL_BUTTONS: { mode: ToolMode; icon: React.ElementType; label: string }[] = [
  { mode: 'pan',       icon: Hand,          label: 'Pan' },
  { mode: 'draw',      icon: Pen,           label: 'Draw' },
  { mode: 'highlight', icon: Highlighter,   label: 'Highlight' },
  { mode: 'note',      icon: MessageSquare, label: 'Note' },
];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function ScriptViewerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const scriptId = params.id;

  const { scriptPDFs, updateScriptPDF } = useProjects();
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
  const [activeMode, setActiveMode] = useState<ToolMode>('pan');

  // Revision color for header tint
  const revColor = script?.colorCode ? REVISION_COLORS[script.colorCode] : null;

  // ---------------------------------------------------------------------------
  // Load signed URL on mount
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
  // Error / loading states
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

        {revColor && (
          <View style={[styles.revDot, { backgroundColor: revColor.bg }]} />
        )}
      </View>

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

              // Update page count in the record if it was 0
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
      </View>

      {/* ── Bottom Toolbar ── */}
      <View style={styles.bottomBar}>
        {/* Tool mode buttons */}
        <View style={styles.toolButtons}>
          {TOOL_BUTTONS.map(({ mode, icon: Icon, label }) => {
            const isActive = activeMode === mode;
            return (
              <TouchableOpacity
                key={mode}
                style={[styles.toolBtn, isActive && styles.toolBtnActive]}
                onPress={() => setActiveMode(mode)}
                activeOpacity={0.7}
              >
                <Icon
                  color={isActive ? Colors.accent.gold : Colors.text.tertiary}
                  size={18}
                />
                {isActive && (
                  <Text style={styles.toolBtnLabel}>{label}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Page navigation */}
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
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  // Error state
  errorContainer: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 16,
    color: Colors.status.error,
    textAlign: 'center',
    marginBottom: 16,
  },
  backBtnError: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: Colors.bg.elevated,
  },
  backBtnErrorText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.bg.primary,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border.subtle,
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.bg.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  versionText: {
    fontSize: 11,
    color: Colors.text.secondary,
    marginTop: 1,
  },
  revDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },

  // PDF container
  pdfContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  pdf: {
    flex: 1,
    width: SCREEN_WIDTH,
    backgroundColor: '#1a1a1a',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    zIndex: 10,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 12,
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: Colors.accent.goldBg,
    borderWidth: 0.5,
    borderColor: Colors.accent.gold + '44',
  },
  retryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.accent.gold,
  },

  // Bottom bar
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.bg.primary,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border.subtle,
  },
  toolButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  toolBtnActive: {
    backgroundColor: Colors.accent.goldBg,
  },
  toolBtnLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.accent.gold,
  },

  // Page navigation
  pageNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pageBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.bg.elevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.secondary,
    minWidth: 50,
    textAlign: 'center',
  },
});
