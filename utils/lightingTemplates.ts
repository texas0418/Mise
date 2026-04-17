/**
 * utils/lightingTemplates.ts
 *
 * Preset lighting setups and element catalog for the lighting diagram editor.
 * All positions are normalized 0–1 (center of canvas = 0.5, 0.5).
 */

import { LightingElement, LightingElementType, LightingTemplateName } from '@/types';

// ─── Element Catalog (toolbar items) ─────────────────────────────────────────

export interface ElementCatalogItem {
  type: LightingElementType;
  label: string;
  /** Category for grouping in the toolbar */
  category: 'lights' | 'modifiers' | 'set' | 'people';
  /** Default color for the element */
  defaultColor: string;
  /** Icon name (maps to lucide icons or custom SVG shapes) */
  iconKey: string;
}

export const ELEMENT_CATALOG: ElementCatalogItem[] = [
  // Lights
  { type: 'key-light',   label: 'Key Light',    category: 'lights',    defaultColor: '#FBBF24', iconKey: 'sun' },
  { type: 'fill-light',  label: 'Fill Light',   category: 'lights',    defaultColor: '#60A5FA', iconKey: 'sun-dim' },
  { type: 'back-light',  label: 'Back Light',   category: 'lights',    defaultColor: '#F97316', iconKey: 'sunrise' },
  { type: 'hair-light',  label: 'Hair Light',   category: 'lights',    defaultColor: '#E879F9', iconKey: 'sparkles' },
  { type: 'kicker',      label: 'Kicker',       category: 'lights',    defaultColor: '#FB923C', iconKey: 'zap' },
  { type: 'practical',   label: 'Practical',    category: 'lights',    defaultColor: '#FCD34D', iconKey: 'lamp' },

  // Modifiers
  { type: 'bounce',      label: 'Bounce Board', category: 'modifiers', defaultColor: '#F5F5F5', iconKey: 'square' },
  { type: 'reflector',   label: 'Reflector',    category: 'modifiers', defaultColor: '#D4D4D8', iconKey: 'circle' },
  { type: 'flag',        label: 'Flag / Neg',   category: 'modifiers', defaultColor: '#1C1C1E', iconKey: 'minus-square' },
  { type: 'diffusion',   label: 'Diffusion',    category: 'modifiers', defaultColor: '#E5E5E5', iconKey: 'cloud' },
  { type: 'gel',         label: 'Gel Frame',    category: 'modifiers', defaultColor: '#3B82F6', iconKey: 'palette' },

  // Set pieces
  { type: 'wall',        label: 'Wall',         category: 'set',       defaultColor: '#6B7280', iconKey: 'minus' },
  { type: 'window',      label: 'Window',       category: 'set',       defaultColor: '#93C5FD', iconKey: 'app-window' },
  { type: 'prop',        label: 'Prop / Table', category: 'set',       defaultColor: '#A78BFA', iconKey: 'box' },

  // People
  { type: 'camera',      label: 'Camera',       category: 'people',    defaultColor: '#F87171', iconKey: 'camera' },
  { type: 'actor',       label: 'Actor',        category: 'people',    defaultColor: '#4ADE80', iconKey: 'user' },
  { type: 'custom',      label: 'Custom Label', category: 'people',    defaultColor: '#94A3B8', iconKey: 'tag' },
];

export function getElementDefaults(type: LightingElementType): Partial<LightingElement> {
  const catalog = ELEMENT_CATALOG.find(e => e.type === type);
  return {
    type,
    label: catalog?.label ?? 'Element',
    color: catalog?.defaultColor ?? '#FFFFFF',
    rotation: 0,
    scale: 1,
    intensity: type.includes('light') || type === 'kicker' || type === 'practical' ? 'medium' : undefined,
  };
}

// ─── Template Definitions ────────────────────────────────────────────────────

export interface LightingTemplate {
  name: LightingTemplateName;
  label: string;
  description: string;
  /** Pre-placed elements */
  elements: Omit<LightingElement, 'id'>[];
}

function el(
  type: LightingElementType,
  label: string,
  x: number,
  y: number,
  rotation: number,
  color?: string,
  intensity?: LightingElement['intensity'],
  notes?: string,
): Omit<LightingElement, 'id'> {
  return { type, label, x, y, rotation, scale: 1, color, intensity, notes };
}

export const LIGHTING_TEMPLATES: LightingTemplate[] = [
  {
    name: 'blank',
    label: 'Blank Canvas',
    description: 'Start from scratch',
    elements: [
      el('actor', 'Subject', 0.5, 0.5, 0, '#4ADE80'),
      el('camera', 'Camera', 0.5, 0.85, 0, '#F87171'),
    ],
  },
  {
    name: 'three-point',
    label: 'Three-Point',
    description: 'Key, fill, and back light — the classic setup',
    elements: [
      el('actor',      'Subject',    0.5,  0.5,  0,    '#4ADE80'),
      el('camera',     'Camera',     0.5,  0.85, 0,    '#F87171'),
      el('key-light',  'Key',        0.25, 0.3,  135,  '#FBBF24', 'high', '45° from camera, slightly above'),
      el('fill-light', 'Fill',       0.75, 0.35, 225,  '#60A5FA', 'low',  'Opposite side, softer'),
      el('back-light', 'Back / Rim', 0.5,  0.15, 180,  '#F97316', 'medium', 'Behind subject, separates from bg'),
    ],
  },
  {
    name: 'rembrandt',
    label: 'Rembrandt',
    description: 'Key at 45° creates triangle shadow under eye',
    elements: [
      el('actor',      'Subject',  0.5,  0.5,  0,    '#4ADE80'),
      el('camera',     'Camera',   0.5,  0.85, 0,    '#F87171'),
      el('key-light',  'Key',      0.2,  0.25, 135,  '#FBBF24', 'high', '45° angle, above eye line'),
      el('reflector',  'Bounce',   0.78, 0.45, 225,  '#D4D4D8', undefined, 'Subtle fill on shadow side'),
    ],
  },
  {
    name: 'butterfly',
    label: 'Butterfly / Paramount',
    description: 'Key directly in front, above — beauty lighting',
    elements: [
      el('actor',      'Subject',  0.5,  0.5,  0,    '#4ADE80'),
      el('camera',     'Camera',   0.5,  0.85, 0,    '#F87171'),
      el('key-light',  'Key',      0.5,  0.2,  180,  '#FBBF24', 'high', 'Centered, above subject'),
      el('reflector',  'Bounce',   0.5,  0.7,  0,    '#D4D4D8', undefined, 'Below chin, fills shadows'),
    ],
  },
  {
    name: 'split',
    label: 'Split Lighting',
    description: 'Light falls on exactly one half of the face',
    elements: [
      el('actor',      'Subject',  0.5,  0.5,  0,    '#4ADE80'),
      el('camera',     'Camera',   0.5,  0.85, 0,    '#F87171'),
      el('key-light',  'Key',      0.12, 0.5,  90,   '#FBBF24', 'high', '90° to subject — hard side light'),
      el('flag',       'Neg Fill', 0.85, 0.5,  270,  '#1C1C1E', undefined, 'Negative fill on shadow side'),
    ],
  },
  {
    name: 'loop',
    label: 'Loop Lighting',
    description: 'Key at 30°–40° — small nose shadow loops down',
    elements: [
      el('actor',      'Subject',  0.5,  0.5,  0,    '#4ADE80'),
      el('camera',     'Camera',   0.5,  0.85, 0,    '#F87171'),
      el('key-light',  'Key',      0.28, 0.3,  130,  '#FBBF24', 'high', '30-40° from camera, above'),
      el('fill-light', 'Fill',     0.72, 0.4,  230,  '#60A5FA', 'low',  'Gentle fill'),
    ],
  },
  {
    name: 'broad',
    label: 'Broad Lighting',
    description: 'Key on the side of the face nearest to camera',
    elements: [
      el('actor',      'Subject',  0.5,  0.5,  330,  '#4ADE80'),
      el('camera',     'Camera',   0.5,  0.85, 0,    '#F87171'),
      el('key-light',  'Key',      0.25, 0.35, 135,  '#FBBF24', 'high', 'Broad side — facing camera'),
      el('fill-light', 'Fill',     0.75, 0.4,  225,  '#60A5FA', 'low'),
    ],
  },
  {
    name: 'short-side',
    label: 'Short-Side Lighting',
    description: 'Key on the side away from camera — more dramatic',
    elements: [
      el('actor',      'Subject',  0.5,  0.5,  30,   '#4ADE80'),
      el('camera',     'Camera',   0.5,  0.85, 0,    '#F87171'),
      el('key-light',  'Key',      0.75, 0.3,  225,  '#FBBF24', 'high', 'Short side — away from camera'),
      el('flag',       'Neg Fill', 0.2,  0.5,  90,   '#1C1C1E', undefined, 'Deepen shadows on broad side'),
    ],
  },
  {
    name: 'backlight-only',
    label: 'Silhouette / Backlight',
    description: 'Strong backlight only — creates silhouette',
    elements: [
      el('actor',      'Subject',     0.5,  0.5,  0,    '#4ADE80'),
      el('camera',     'Camera',      0.5,  0.85, 0,    '#F87171'),
      el('back-light', 'Back Light',  0.5,  0.1,  180,  '#F97316', 'max', 'Strong backlight for silhouette'),
    ],
  },
  {
    name: 'natural-window',
    label: 'Natural Window Light',
    description: 'Window as key source with bounce fill',
    elements: [
      el('actor',     'Subject',   0.5,  0.5,  0,    '#4ADE80'),
      el('camera',    'Camera',    0.5,  0.85, 0,    '#F87171'),
      el('window',    'Window',    0.05, 0.4,  90,   '#93C5FD'),
      el('diffusion', 'Diffusion', 0.15, 0.4,  90,   '#E5E5E5', undefined, 'Soften window light'),
      el('bounce',    'Bounce',    0.82, 0.45, 270,  '#F5F5F5', undefined, 'Fill shadow side'),
      el('wall',      'Back Wall', 0.5,  0.05, 0,    '#6B7280'),
    ],
  },
];

export function getTemplate(name: LightingTemplateName): LightingTemplate {
  return LIGHTING_TEMPLATES.find(t => t.name === name) ?? LIGHTING_TEMPLATES[0];
}

/** How many templates are available */
export const TEMPLATE_COUNT = LIGHTING_TEMPLATES.length;
