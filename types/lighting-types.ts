// ---------------------------------------------------------------------------
// Lighting Diagrams
// ---------------------------------------------------------------------------

/** The kind of object placed on the lighting diagram canvas */
export type LightingElementType =
  | 'key-light'
  | 'fill-light'
  | 'back-light'
  | 'hair-light'
  | 'kicker'
  | 'practical'
  | 'bounce'
  | 'reflector'
  | 'flag'
  | 'diffusion'
  | 'gel'
  | 'camera'
  | 'actor'
  | 'prop'
  | 'wall'
  | 'window'
  | 'custom';

/** Intensity / power level for lights */
export type LightIntensity = 'low' | 'medium' | 'high' | 'max';

/** A single element placed on the diagram canvas */
export interface LightingElement {
  id: string;
  type: LightingElementType;
  label: string;
  /** Position on canvas (0–1 normalized, relative to canvas size) */
  x: number;
  y: number;
  /** Rotation in degrees (0–360) — direction the light/camera is pointing */
  rotation: number;
  /** Scale multiplier (default 1) */
  scale: number;
  /** Color of the light beam / gel color (hex) */
  color?: string;
  /** Intensity for light elements */
  intensity?: LightIntensity;
  /** Optional notes (e.g. "1/2 CTO", "250W Fresnel") */
  notes?: string;
}

/** Named template for common lighting setups */
export type LightingTemplateName =
  | 'blank'
  | 'three-point'
  | 'rembrandt'
  | 'butterfly'
  | 'split'
  | 'loop'
  | 'broad'
  | 'short-side'
  | 'backlight-only'
  | 'natural-window';

/** The full lighting diagram record */
export interface LightingDiagram {
  id: string;
  projectId: string;
  /** Optional link to a scene */
  sceneNumber?: number;
  /** Optional link to a specific shot */
  shotNumber?: string;
  title: string;
  description: string;
  /** Which template was used as the starting point */
  templateName: LightingTemplateName;
  /** All elements placed on the canvas */
  elements: LightingElement[];
  /** Canvas background style */
  bgStyle: 'dark' | 'light' | 'grid';
  notes: string;
  createdAt: string;
  updatedAt: string;
}
