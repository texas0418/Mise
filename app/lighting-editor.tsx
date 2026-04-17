import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions, Alert,
  PanResponder, GestureResponderEvent, PanResponderGestureState,
  ScrollView, TextInput, Modal, SafeAreaView, StatusBar,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft, Plus, RotateCw, Trash2, Save, Lightbulb, Camera, User,
  Sun, Zap, Square, Circle, Minus, Cloud, Palette, Box, Tag,
  ChevronDown, ChevronUp, Info, X, Sunrise, Sparkles,
} from 'lucide-react-native';
import Svg, { Path, Defs, RadialGradient, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { useProjects, useProjectLightingDiagrams } from '@/contexts/ProjectContext';
import Colors from '@/constants/colors';
import { LightingDiagram, LightingElement, LightingElementType, LightIntensity } from '@/types';
import { ELEMENT_CATALOG, ElementCatalogItem, getElementDefaults } from '@/utils/lightingTemplates';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const CANVAS_SIZE = Math.min(SCREEN_W, SCREEN_H - 160);
const ELEMENT_SIZE = 44;
const ELEMENT_HIT = 54; // larger hit area

// ─── Icon mapping ────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ElementType> = {
  'sun': Sun, 'sun-dim': Sun, 'sunrise': Sunrise, 'sparkles': Sparkles,
  'zap': Zap, 'lamp': Lightbulb, 'square': Square, 'circle': Circle,
  'minus-square': Square, 'cloud': Cloud, 'palette': Palette,
  'minus': Minus, 'app-window': Square, 'box': Box,
  'camera': Camera, 'user': User, 'tag': Tag,
};

function getIconForType(type: LightingElementType): React.ElementType {
  const catalog = ELEMENT_CATALOG.find(e => e.type === type);
  return ICON_MAP[catalog?.iconKey ?? 'tag'] ?? Tag;
}

// ─── Light Beam Cone ─────────────────────────────────────────────────────────

/** Beam reach in pixels, tied to intensity */
const BEAM_LENGTH: Record<LightIntensity, number> = {
  low: 45,
  medium: 75,
  high: 110,
  max: 150,
};

/** Beam spread angle in degrees (half-angle from center) */
const BEAM_SPREAD = 28;

function LightBeamCone({
  rotation,
  intensity,
  color,
}: {
  rotation: number;
  intensity: LightIntensity;
  color: string;
}) {
  const length = BEAM_LENGTH[intensity];
  const spreadRad = (BEAM_SPREAD * Math.PI) / 180;

  // SVG viewBox is centered on the light icon position
  // The cone extends outward in the rotation direction
  const svgSize = length * 2 + 40;
  const cx = svgSize / 2;
  const cy = svgSize / 2;

  // Convert rotation to radians (0° = up, clockwise)
  const rotRad = ((rotation - 90) * Math.PI) / 180;

  // Cone tip is at center, two edges fan out
  const leftAngle = rotRad - spreadRad;
  const rightAngle = rotRad + spreadRad;

  const x1 = cx + Math.cos(leftAngle) * length;
  const y1 = cy + Math.sin(leftAngle) * length;
  const x2 = cx + Math.cos(rightAngle) * length;
  const y2 = cy + Math.sin(rightAngle) * length;

  // Arc endpoint for the rounded cone tip
  const midX = cx + Math.cos(rotRad) * length;
  const midY = cy + Math.sin(rotRad) * length;

  const pathData = [
    `M ${cx} ${cy}`,           // start at center (light position)
    `L ${x1} ${y1}`,           // left edge of cone
    `A ${length} ${length} 0 0 1 ${x2} ${y2}`, // arc across the front
    `Z`,                       // close back to center
  ].join(' ');

  const gradientId = `beam-${rotation}-${intensity}`;

  return (
    <View
      style={{
        position: 'absolute',
        width: svgSize,
        height: svgSize,
        left: -(svgSize / 2) + ELEMENT_SIZE / 2,
        top: -(svgSize / 2) + ELEMENT_SIZE / 2 + 2,
        zIndex: -1,
      }}
      pointerEvents="none"
    >
      <Svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <Stop offset="60%" stopColor={color} stopOpacity="0.12" />
            <Stop offset="100%" stopColor={color} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Path
          d={pathData}
          fill={`url(#${gradientId})`}
          stroke={color}
          strokeWidth={0.8}
          strokeOpacity={0.3}
        />
      </Svg>
    </View>
  );
}

// ─── Draggable Element ───────────────────────────────────────────────────────

function CanvasElement({
  element,
  isSelected,
  canvasSize,
  onSelect,
  onDragEnd,
}: {
  element: LightingElement;
  isSelected: boolean;
  canvasSize: number;
  onSelect: () => void;
  onDragEnd: (x: number, y: number) => void;
}) {
  const posRef = useRef({ x: element.x * canvasSize, y: element.y * canvasSize });
  const [pos, setPos] = useState({ x: element.x * canvasSize, y: element.y * canvasSize });

  // Update when element changes externally
  React.useEffect(() => {
    const newPos = { x: element.x * canvasSize, y: element.y * canvasSize };
    posRef.current = newPos;
    setPos(newPos);
  }, [element.x, element.y, canvasSize]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 3 || Math.abs(gs.dy) > 3,
      onPanResponderGrant: () => {
        onSelect();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
      onPanResponderMove: (_, gs) => {
        const newX = Math.max(0, Math.min(canvasSize, posRef.current.x + gs.dx));
        const newY = Math.max(0, Math.min(canvasSize, posRef.current.y + gs.dy));
        setPos({ x: newX, y: newY });
      },
      onPanResponderRelease: (_, gs) => {
        const newX = Math.max(0, Math.min(canvasSize, posRef.current.x + gs.dx));
        const newY = Math.max(0, Math.min(canvasSize, posRef.current.y + gs.dy));
        posRef.current = { x: newX, y: newY };
        setPos({ x: newX, y: newY });
        onDragEnd(newX / canvasSize, newY / canvasSize);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
    })
  ).current;

  const Icon = getIconForType(element.type);
  const color = element.color ?? '#FFFFFF';
  const isLight = element.type.includes('light') || element.type === 'kicker' || element.type === 'practical';

  return (
    <View
      {...panResponder.panHandlers}
      style={[
        styles.canvasElement,
        {
          left: pos.x - ELEMENT_SIZE / 2,
          top: pos.y - ELEMENT_SIZE / 2,
          borderColor: isSelected ? Colors.accent.gold : 'transparent',
          borderWidth: isSelected ? 2 : 0,
          overflow: 'visible',
        },
      ]}
    >
      {/* Light beam cone */}
      {isLight && element.intensity && (
        <LightBeamCone
          rotation={element.rotation}
          intensity={element.intensity}
          color={color}
        />
      )}
      {/* Icon */}
      <View style={[styles.elementIconWrap, { backgroundColor: color + '25' }]}>
        <Icon color={color} size={18} />
      </View>
      {/* Label */}
      <Text style={styles.elementLabel} numberOfLines={1}>{element.label}</Text>
    </View>
  );
}

// ─── Toolbar Category ────────────────────────────────────────────────────────

function ToolbarSection({
  title,
  items,
  onAdd,
}: {
  title: string;
  items: ElementCatalogItem[];
  onAdd: (type: LightingElementType) => void;
}) {
  return (
    <View style={styles.toolbarSection}>
      <Text style={styles.toolbarSectionTitle}>{title}</Text>
      <View style={styles.toolbarRow}>
        {items.map(item => {
          const Icon = ICON_MAP[item.iconKey] ?? Tag;
          return (
            <TouchableOpacity
              key={item.type}
              style={styles.toolbarItem}
              onPress={() => onAdd(item.type)}
              activeOpacity={0.6}
            >
              <View style={[styles.toolbarIconWrap, { backgroundColor: item.defaultColor + '20' }]}>
                <Icon color={item.defaultColor} size={16} />
              </View>
              <Text style={styles.toolbarItemLabel} numberOfLines={1}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Main Editor ─────────────────────────────────────────────────────────────

export default function LightingEditorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const { updateLightingDiagram } = useProjects();
  const diagrams = useProjectLightingDiagrams(null); // get all, we filter by id
  const allDiagrams = useProjects().lightingDiagrams;
  const diagram = allDiagrams.find(d => d.id === params.id) ?? null;

  const [elements, setElements] = useState<LightingElement[]>(diagram?.elements ?? []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showToolbar, setShowToolbar] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editLabel, setEditLabel] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  const selectedElement = useMemo(
    () => elements.find(e => e.id === selectedId) ?? null,
    [elements, selectedId]
  );

  const canvasSize = useMemo(() => {
    return Math.min(SCREEN_W - 16, SCREEN_H - 220);
  }, []);

  // ── Element operations ──

  const updateElement = useCallback((id: string, updates: Partial<LightingElement>) => {
    setElements(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    setHasChanges(true);
  }, []);

  const addElement = useCallback((type: LightingElementType) => {
    const defaults = getElementDefaults(type);
    const newEl: LightingElement = {
      ...defaults,
      id: `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      label: defaults.label ?? 'Element',
      x: 0.5 + (Math.random() - 0.5) * 0.2,
      y: 0.5 + (Math.random() - 0.5) * 0.2,
      rotation: defaults.rotation ?? 0,
      scale: 1,
    };
    setElements(prev => [...prev, newEl]);
    setSelectedId(newEl.id);
    setShowToolbar(false);
    setHasChanges(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    Alert.alert('Remove Element', `Delete "${selectedElement?.label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: () => {
          setElements(prev => prev.filter(e => e.id !== selectedId));
          setSelectedId(null);
          setHasChanges(true);
        }
      },
    ]);
  }, [selectedId, selectedElement]);

  const rotateSelected = useCallback((delta: number) => {
    if (!selectedId) return;
    updateElement(selectedId, {
      rotation: ((selectedElement?.rotation ?? 0) + delta) % 360,
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [selectedId, selectedElement, updateElement]);

  const openEditModal = useCallback(() => {
    if (!selectedElement) return;
    setEditLabel(selectedElement.label);
    setEditNotes(selectedElement.notes ?? '');
    setShowEditModal(true);
  }, [selectedElement]);

  const cycleIntensity = useCallback(() => {
    if (!selectedId || !selectedElement?.intensity) return;
    const levels: LightIntensity[] = ['low', 'medium', 'high', 'max'];
    const idx = levels.indexOf(selectedElement.intensity);
    const next = levels[(idx + 1) % levels.length];
    updateElement(selectedId, { intensity: next });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [selectedId, selectedElement, updateElement]);

  const saveEditModal = useCallback(() => {
    if (!selectedId) return;
    updateElement(selectedId, {
      label: editLabel.trim() || 'Element',
      notes: editNotes.trim(),
    });
    setShowEditModal(false);
  }, [selectedId, editLabel, editNotes, updateElement]);

  // ── Save diagram ──

  const handleSave = useCallback(() => {
    if (!diagram) return;
    updateLightingDiagram({
      ...diagram,
      elements,
      updatedAt: new Date().toISOString(),
    });
    setHasChanges(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [diagram, elements, updateLightingDiagram]);

  const handleBack = useCallback(() => {
    if (hasChanges) {
      Alert.alert('Unsaved Changes', 'Save before leaving?', [
        { text: 'Discard', style: 'destructive', onPress: () => router.back() },
        { text: 'Save & Exit', onPress: () => { handleSave(); router.back(); } },
        { text: 'Cancel', style: 'cancel' },
      ]);
    } else {
      router.back();
    }
  }, [hasChanges, handleSave, router]);

  // ── No diagram ──

  if (!diagram) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Diagram not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.errorBtn}>
            <Text style={styles.errorBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Grouped catalog items ──
  const lights = ELEMENT_CATALOG.filter(e => e.category === 'lights');
  const modifiers = ELEMENT_CATALOG.filter(e => e.category === 'modifiers');
  const setPieces = ELEMENT_CATALOG.filter(e => e.category === 'set');
  const people = ELEMENT_CATALOG.filter(e => e.category === 'people');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header bar */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.headerBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ArrowLeft color={Colors.text.primary} size={22} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{diagram.title}</Text>
          {hasChanges && <View style={styles.unsavedDot} />}
        </View>
        <TouchableOpacity
          onPress={handleSave}
          style={[styles.saveBtn, !hasChanges && styles.saveBtnDisabled]}
          disabled={!hasChanges}
        >
          <Save color={hasChanges ? Colors.accent.gold : Colors.text.tertiary} size={18} />
          <Text style={[styles.saveBtnText, !hasChanges && { color: Colors.text.tertiary }]}>Save</Text>
        </TouchableOpacity>
      </View>

      {/* Canvas */}
      <View style={styles.canvasContainer}>
        <View
          style={[
            styles.canvas,
            { width: canvasSize, height: canvasSize },
          ]}
          onStartShouldSetResponder={() => true}
          onResponderRelease={() => setSelectedId(null)}
        >
          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map(pct => (
            <React.Fragment key={pct}>
              <View style={[styles.gridLineH, { top: pct * canvasSize }]} />
              <View style={[styles.gridLineV, { left: pct * canvasSize }]} />
            </React.Fragment>
          ))}

          {/* Center crosshair */}
          <View style={[styles.centerDot, { left: canvasSize / 2 - 3, top: canvasSize / 2 - 3 }]} />

          {/* Elements */}
          {elements.map(el => (
            <CanvasElement
              key={el.id}
              element={el}
              isSelected={selectedId === el.id}
              canvasSize={canvasSize}
              onSelect={() => setSelectedId(el.id)}
              onDragEnd={(x, y) => updateElement(el.id, { x, y })}
            />
          ))}
        </View>
      </View>

      {/* Bottom controls */}
      <View style={styles.controls}>
        {/* Selected element actions */}
        {selectedElement ? (
          <View style={styles.selectedControls}>
            <View style={styles.selectedInfo}>
              <Text style={styles.selectedLabel}>{selectedElement.label}</Text>
              <Text style={styles.selectedType}>
                {selectedElement.type.replace(/-/g, ' ')}
                {selectedElement.intensity ? ` · ${selectedElement.intensity}` : ''}
              </Text>
            </View>
            {selectedElement.intensity && (
              <TouchableOpacity onPress={cycleIntensity} style={[styles.controlBtn, styles.intensityBtn]}>
                <Zap color="#FBBF24" size={16} />
                <Text style={styles.intensityLabel}>{selectedElement.intensity[0].toUpperCase()}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => rotateSelected(-45)} style={styles.controlBtn}>
              <RotateCw color={Colors.text.secondary} size={18} style={{ transform: [{ scaleX: -1 }] }} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => rotateSelected(45)} style={styles.controlBtn}>
              <RotateCw color={Colors.text.secondary} size={18} />
            </TouchableOpacity>
            <TouchableOpacity onPress={openEditModal} style={styles.controlBtn}>
              <Info color={Colors.status.info} size={18} />
            </TouchableOpacity>
            <TouchableOpacity onPress={deleteSelected} style={styles.controlBtn}>
              <Trash2 color={Colors.status.error} size={18} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.hintRow}>
            <Text style={styles.hintText}>Tap an element to select, drag to move</Text>
          </View>
        )}

        {/* Add element toggle */}
        <TouchableOpacity
          style={[styles.addBtn, showToolbar && styles.addBtnActive]}
          onPress={() => setShowToolbar(!showToolbar)}
          activeOpacity={0.7}
        >
          {showToolbar ? <X color={Colors.text.inverse} size={20} /> : <Plus color={Colors.text.inverse} size={20} />}
          <Text style={styles.addBtnText}>{showToolbar ? 'Close' : 'Add Element'}</Text>
        </TouchableOpacity>
      </View>

      {/* Toolbar drawer */}
      {showToolbar && (
        <View style={styles.toolbarDrawer}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
            <ToolbarSection title="Lights" items={lights} onAdd={addElement} />
            <ToolbarSection title="Modifiers" items={modifiers} onAdd={addElement} />
            <ToolbarSection title="Set Pieces" items={setPieces} onAdd={addElement} />
            <ToolbarSection title="People & Other" items={people} onAdd={addElement} />
          </ScrollView>
        </View>
      )}

      {/* Edit element modal */}
      <Modal visible={showEditModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Element</Text>

            <Text style={styles.modalLabel}>Label</Text>
            <TextInput
              style={styles.modalInput}
              value={editLabel}
              onChangeText={setEditLabel}
              placeholder="Element name"
              placeholderTextColor={Colors.text.tertiary}
              autoFocus
            />

            <Text style={styles.modalLabel}>Notes</Text>
            <TextInput
              style={[styles.modalInput, { minHeight: 60 }]}
              value={editNotes}
              onChangeText={setEditNotes}
              placeholder="Fixture, gel, power..."
              placeholderTextColor={Colors.text.tertiary}
              multiline
              textAlignVertical="top"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setShowEditModal(false)} style={styles.modalCancelBtn}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveEditModal} style={styles.modalSaveBtn}>
                <Text style={styles.modalSaveText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050505' },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingVertical: 10, gap: 12,
    borderBottomWidth: 0.5, borderBottomColor: Colors.border.subtle,
  },
  headerBtn: { padding: 4 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerTitle: { fontSize: 16, fontWeight: '700' as const, color: Colors.text.primary },
  unsavedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.status.warning },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    backgroundColor: Colors.accent.goldBg, borderWidth: 0.5, borderColor: Colors.accent.gold + '44',
  },
  saveBtnDisabled: { backgroundColor: Colors.bg.tertiary, borderColor: Colors.border.subtle },
  saveBtnText: { fontSize: 13, fontWeight: '600' as const, color: Colors.accent.gold },

  // Canvas
  canvasContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
  },
  canvas: {
    backgroundColor: '#0D0D0D',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border.subtle,
    position: 'relative',
    overflow: 'hidden',
  },
  gridLineH: {
    position: 'absolute', left: 0, right: 0, height: 0.5,
    backgroundColor: Colors.border.subtle + '40',
  },
  gridLineV: {
    position: 'absolute', top: 0, bottom: 0, width: 0.5,
    backgroundColor: Colors.border.subtle + '40',
  },
  centerDot: {
    position: 'absolute', width: 6, height: 6, borderRadius: 3,
    backgroundColor: Colors.text.tertiary + '40',
  },

  // Canvas element
  canvasElement: {
    position: 'absolute',
    width: ELEMENT_SIZE,
    height: ELEMENT_SIZE + 14,
    alignItems: 'center',
    zIndex: 10,
    borderRadius: 8,
    padding: 2,
  },
  elementIconWrap: {
    width: 32, height: 32, borderRadius: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  elementLabel: {
    fontSize: 8, color: Colors.text.secondary, fontWeight: '600' as const,
    textAlign: 'center', marginTop: 1, maxWidth: ELEMENT_SIZE,
  },

  // Controls
  controls: {
    paddingHorizontal: 16, paddingVertical: 10, gap: 10,
    borderTopWidth: 0.5, borderTopColor: Colors.border.subtle,
    backgroundColor: Colors.bg.secondary,
  },
  selectedControls: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  selectedInfo: { flex: 1, minWidth: 0 },
  selectedLabel: { fontSize: 13, fontWeight: '700' as const, color: Colors.text.primary },
  selectedType: { fontSize: 10, color: Colors.text.tertiary, textTransform: 'capitalize' as const },
  controlBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.bg.elevated, justifyContent: 'center', alignItems: 'center',
    borderWidth: 0.5, borderColor: Colors.border.subtle,
  },
  intensityBtn: {
    flexDirection: 'column', gap: 0,
    backgroundColor: '#FBBF2412', borderColor: '#FBBF2444',
  },
  intensityLabel: {
    fontSize: 8, fontWeight: '800' as const, color: '#FBBF24', marginTop: -2,
  },
  hintRow: { alignItems: 'center', paddingVertical: 4 },
  hintText: { fontSize: 12, color: Colors.text.tertiary },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.accent.gold, borderRadius: 10, paddingVertical: 12,
  },
  addBtnActive: { backgroundColor: Colors.text.tertiary },
  addBtnText: { fontSize: 14, fontWeight: '700' as const, color: Colors.text.inverse },

  // Toolbar drawer
  toolbarDrawer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    maxHeight: SCREEN_H * 0.45,
    backgroundColor: Colors.bg.primary,
    borderTopWidth: 1, borderTopColor: Colors.border.medium,
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    paddingHorizontal: 16, paddingTop: 16,
  },
  toolbarSection: { marginBottom: 16 },
  toolbarSectionTitle: {
    fontSize: 10, fontWeight: '700' as const, color: Colors.text.tertiary,
    textTransform: 'uppercase' as const, letterSpacing: 0.8, marginBottom: 8,
  },
  toolbarRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  toolbarItem: {
    alignItems: 'center', width: 64, gap: 4,
  },
  toolbarIconWrap: {
    width: 40, height: 40, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 0.5, borderColor: Colors.border.subtle,
  },
  toolbarItemLabel: { fontSize: 9, color: Colors.text.secondary, textAlign: 'center', fontWeight: '500' as const },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalContent: {
    width: '100%', maxWidth: 360, backgroundColor: Colors.bg.card,
    borderRadius: 16, padding: 20, borderWidth: 0.5, borderColor: Colors.border.subtle,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.text.primary, marginBottom: 16 },
  modalLabel: {
    fontSize: 11, fontWeight: '700' as const, color: Colors.text.tertiary,
    textTransform: 'uppercase' as const, letterSpacing: 0.5, marginBottom: 6, marginTop: 10,
  },
  modalInput: {
    backgroundColor: Colors.bg.input, borderRadius: 8, padding: 12,
    fontSize: 15, color: Colors.text.primary,
    borderWidth: 0.5, borderColor: Colors.border.subtle,
  },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 },
  modalCancelBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  modalCancelText: { fontSize: 14, color: Colors.text.secondary, fontWeight: '500' as const },
  modalSaveBtn: {
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8,
    backgroundColor: Colors.accent.gold,
  },
  modalSaveText: { fontSize: 14, fontWeight: '700' as const, color: Colors.text.inverse },

  // Error
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  errorText: { fontSize: 16, color: Colors.text.secondary },
  errorBtn: {
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8,
    backgroundColor: Colors.accent.gold,
  },
  errorBtnText: { fontSize: 14, fontWeight: '700' as const, color: Colors.text.inverse },
});
