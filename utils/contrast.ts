/**
 * utils/contrast.ts
 *
 * WCAG 2.1 contrast arithmetic.
 *
 * Contrast is the one accessibility property that is not a matter of judgement:
 * a ratio either clears the threshold or it does not, and it can be computed
 * from the palette without a device, a screenshot, or an opinion. That is why
 * this exists as arithmetic rather than as a review note — scripts/test-contrast.ts
 * fails the build when a colour drops below AA, which is the only way a palette
 * stays accessible after the session that made it so.
 *
 * Kept dependency-free so node can run the suite directly.
 */

/** Straight sRGB channels, 0-255, plus alpha 0-1. */
export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * Parse `#RGB`, `#RRGGBB`, `rgb(…)` and `rgba(…)`.
 *
 * Returns null rather than throwing: a palette can legitimately hold a value
 * this does not understand, and the caller decides whether that is a failure.
 */
export function parseColor(value: string): Rgba | null {
  const text = String(value ?? '').trim();

  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text);
  if (hex) {
    const digits = hex[1];
    const pairs = digits.length === 3
      ? [...digits].map(d => d + d)
      : [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 6)];
    const [r, g, b] = pairs.map(p => parseInt(p, 16));
    return { r, g, b, a: 1 };
  }

  const fn = /^rgba?\(([^)]+)\)$/i.exec(text);
  if (fn) {
    const parts = fn[1].split(',').map(p => Number(p.trim()));
    if (parts.length < 3 || parts.slice(0, 3).some(n => !Number.isFinite(n))) return null;
    const [r, g, b] = parts;
    const a = parts.length > 3 && Number.isFinite(parts[3]) ? parts[3] : 1;
    return { r, g, b, a };
  }

  return null;
}

/**
 * Composite a possibly-translucent colour over an opaque backdrop.
 *
 * A ratio computed against a translucent colour's own channels is a fiction —
 * what the eye sees is the blend. The palette's `accent.goldBg` is 12% gold,
 * and treating it as opaque gold would overstate its contrast eightfold.
 */
export function flatten(color: Rgba, backdrop: Rgba): Rgba {
  if (color.a >= 1) return { ...color, a: 1 };
  const mix = (fg: number, bg: number) => fg * color.a + bg * (1 - color.a);
  return {
    r: mix(color.r, backdrop.r),
    g: mix(color.g, backdrop.g),
    b: mix(color.b, backdrop.b),
    a: 1,
  };
}

/** WCAG relative luminance. */
export function relativeLuminance(color: Rgba): number {
  const channel = (value: number) => {
    const c = Math.min(255, Math.max(0, value)) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
}

/**
 * Contrast ratio between a foreground and an opaque background, 1 to 21.
 *
 * The foreground is composited over the background first, so a translucent
 * foreground reports what it actually looks like.
 */
export function contrastRatio(foreground: string, background: string): number | null {
  const fg = parseColor(foreground);
  const bg = parseColor(background);
  if (!fg || !bg) return null;

  const opaqueBg = flatten(bg, { r: 0, g: 0, b: 0, a: 1 });
  const composited = flatten(fg, opaqueBg);

  const l1 = relativeLuminance(composited);
  const l2 = relativeLuminance(opaqueBg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * WCAG 2.1 thresholds.
 *
 * "Large" is 18pt, or 14pt bold — roughly 24px and 18.66px at the default
 * scale. Most of this app's text is well under that, so AA_NORMAL is the
 * number that matters nearly everywhere.
 */
export const AA_NORMAL = 4.5;
export const AA_LARGE = 3;
/** Icons and control boundaries — WCAG 1.4.11 non-text contrast. */
export const AA_NON_TEXT = 3;

/** Rounded to two places, the way a report should read. */
export const ratio = (foreground: string, background: string): number =>
  Math.round((contrastRatio(foreground, background) ?? 0) * 100) / 100;
