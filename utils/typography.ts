/**
 * utils/typography.ts
 *
 * Type sizes that respond to the system text-size setting.
 *
 * Every font size in this app was a hardcoded number in a StyleSheet, and 270
 * of them sat below 12px — tool card subtitles at 10, stat labels at 9, call
 * sheet column headers at 9. None of it moved when the reader turned their
 * text size up. On a phone clipped to a rig in the dark, that is not a
 * preference setting.
 *
 * Two rules, and they interact:
 *
 * 1. **A floor.** Nothing renders below `MIN_SIZE`, and nothing on a surface
 *    read at arm's length below `MIN_ONSET_SIZE`. The floor applies *before*
 *    scaling, so a 9px label becomes 12px at the default setting rather than
 *    staying 9px until the reader goes looking for the accessibility menu.
 *
 * 2. **A ceiling on the multiplier, not on the result.** iOS accessibility
 *    sizes reach roughly 3.1x, which turns a table into a column of single
 *    words. `MAX_SCALE` bounds how far layout is allowed to be stretched
 *    while still honouring most of the reader's choice. Text that is not in a
 *    constrained layout should pass `maxScale: Infinity` and simply grow.
 *
 * Kept dependency-free: no react-native import, so node can run the suite.
 * The hook that reads the live system scale is utils/useTypography.ts.
 */

/** Nothing smaller than this, anywhere. */
export const MIN_SIZE = 12;

/**
 * Surfaces read at arm's length, in the dark, on a rig — the Today view, the
 * shot checklist, the take log. 12px is legible on a desk and not on set.
 */
export const MIN_ONSET_SIZE = 14;

/**
 * How far a constrained layout will stretch. Above roughly 2x, dense rows stop
 * being rows. Unconstrained text should opt out with `Infinity` rather than
 * inherit this.
 */
export const MAX_SCALE = 2;

/**
 * The reader is allowed to make text smaller, but not below the floor — which
 * is what the floor is for.
 */
export const MIN_SCALE = 0.85;

export interface ScaleOptions {
  /** Smallest permitted result. Defaults to MIN_SIZE. */
  floor?: number;
  /** Largest permitted multiplier. Defaults to MAX_SCALE; pass Infinity to opt out. */
  maxScale?: number;
}

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

/**
 * A font size for the reader's current text-size setting.
 *
 * `fontScale` is the system multiplier — 1 at the default, up to about 3.1 at
 * the largest accessibility size on iOS. Non-finite or absent values fall back
 * to 1 rather than collapsing the type.
 */
export function scaleFont(base: number, fontScale: number, options: ScaleOptions = {}): number {
  const floor = options.floor ?? MIN_SIZE;
  const maxScale = options.maxScale ?? MAX_SCALE;

  const size = Number.isFinite(base) ? Math.max(base, floor) : floor;
  const scale = Number.isFinite(fontScale) ? clamp(fontScale, MIN_SCALE, maxScale) : 1;

  return Math.max(floor, Math.round(size * scale));
}

/** The on-set floor, for anything read at arm's length. */
export const scaleOnSetFont = (base: number, fontScale: number, options: ScaleOptions = {}): number =>
  scaleFont(base, fontScale, { floor: MIN_ONSET_SIZE, ...options });

/**
 * A line height for a scaled size.
 *
 * Line height has to scale with the text or large type clips against its own
 * next line — the failure looks like a rendering bug rather than a setting, so
 * it rarely gets reported as one.
 */
export function lineHeightFor(size: number, ratio = 1.35): number {
  return Math.round(size * ratio);
}

/**
 * The named steps. Screens should reach for these rather than inventing a
 * number, so that "the small label size" means one thing across the app.
 *
 * Values are the pre-scale bases; every one is at or above MIN_SIZE.
 */
export const TYPE = {
  /** Column headers, timestamps, unit labels. */
  caption: 12,
  /** Secondary rows, metadata, subtitles. */
  small: 13,
  /** Default reading size. */
  body: 15,
  /** Emphasised rows, card titles. */
  title: 17,
  /** Screen headings. */
  heading: 20,
  /** The number on a stat tile, a day number, a call time. */
  display: 28,
} as const;

export type TypeStep = keyof typeof TYPE;
