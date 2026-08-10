/**
 * utils/typography.ts
 *
 * Type sizes, and the floor beneath them.
 *
 * ## Read this before multiplying anything by fontScale
 *
 * React Native's `<Text>` has `allowFontScaling` defaulting to **true** (see
 * Libraries/Text/TextProps.js in RN 0.81). Every `fontSize` in a StyleSheet is
 * already multiplied by the reader's Dynamic Type setting before it reaches the
 * screen. #47 says the app has "no Dynamic Type"; what it actually has is text
 * that scales from bases too small to be worth scaling.
 *
 * So `fontSize` must **not** be multiplied by `fontScale` in application code.
 * Doing that scales twice — 16px at the largest accessibility setting would
 * render near 150px rather than 50. An earlier version of this module exported
 * exactly that trap; it had no call sites, and it is gone.
 *
 * What genuinely needs manual scaling is everything that is *not* text and
 * therefore does not scale on its own: icon glyph sizes, hit targets, and the
 * gaps around text that has grown. Those are `scaleNonText` and the hook in
 * utils/useTypography.ts.
 *
 * ## What this module is for
 *
 * 1. **The floor.** 270 font sizes in this app sat below 12px — subtitles at
 *    10, stat labels at 9, call sheet headers at 9. Scaling does not fix a base
 *    that small; at the default setting they render exactly as written.
 *    `floorFont` raises a base before it is ever scaled.
 *
 * 2. **A ceiling on the multiplier**, for dense layouts that stop being rows at
 *    3x. That is applied through React Native's own `maxFontSizeMultiplier`
 *    prop rather than by arithmetic here — see MAX_TEXT_SCALE.
 *
 * Kept dependency-free so node can run the suite.
 */

/** Nothing smaller than this, anywhere, before scaling. */
export const MIN_SIZE = 12;

/**
 * Surfaces read at arm's length, in the dark, on a rig — the Today view, the
 * slate, the take log and the take form. 12px is legible on a desk and not on
 * set.
 */
export const MIN_ONSET_SIZE = 14;

/**
 * The cap handed to `<Text maxFontSizeMultiplier>` on dense surfaces. Above
 * roughly 2x a table stops being a table. Text that is not in a constrained
 * layout should be left uncapped so it simply grows.
 */
export const MAX_TEXT_SCALE = 2;

/**
 * Raise a base font size to the floor. **Not** a scaling function — the
 * platform does the scaling.
 */
export function floorFont(base: number, onSet = false): number {
  const floor = onSet ? MIN_ONSET_SIZE : MIN_SIZE;
  return Number.isFinite(base) ? Math.max(base, floor) : floor;
}

/** How far a non-text dimension is allowed to be stretched. */
export const MAX_NON_TEXT_SCALE = 1.6;
/** A reader who prefers smaller text still gets usable hit targets. */
export const MIN_NON_TEXT_SCALE = 1;

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

/**
 * Scale something that does *not* scale itself — an icon's glyph size, a hit
 * target, the gap under a label that has grown.
 *
 * Clamped harder than text: an icon at 3x is not more legible, it is just in
 * the way, and hit targets past a point start pushing content off screen.
 */
export function scaleNonText(base: number, fontScale: number): number {
  const scale = Number.isFinite(fontScale)
    ? clamp(fontScale, MIN_NON_TEXT_SCALE, MAX_NON_TEXT_SCALE)
    : 1;
  return Math.round((Number.isFinite(base) ? base : 0) * scale);
}

/**
 * A line height for a font size.
 *
 * Line height set as a raw number does **not** scale with Dynamic Type the way
 * fontSize does, so a fixed `lineHeight` clips scaled text against its own next
 * line — which reads as a rendering bug rather than a setting, and so rarely
 * gets reported as an accessibility one. Prefer omitting lineHeight entirely on
 * scalable text; use this only where a specific rhythm is needed.
 */
export function lineHeightFor(size: number, ratio = 1.35): number {
  return Math.round(size * ratio);
}

/** Past this, dense rows need to wrap or stack rather than shrink. */
export const LARGE_TEXT_THRESHOLD = 1.3;

/**
 * The named steps. Screens should reach for these rather than inventing a
 * number, so "the small label size" means one thing across the app.
 *
 * These are pre-scale bases, and every one is at or above MIN_SIZE.
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
