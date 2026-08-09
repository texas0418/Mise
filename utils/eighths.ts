/**
 * utils/eighths.ts
 *
 * Script pages are measured in eighths. A scene is "2 4/8 pages", never "2.5",
 * and a day's work is the sum of its scenes' eighths. Storing eighths as an
 * integer keeps that arithmetic exact — 1/8 + 1/8 + 1/8 is 3/8, not 0.375.
 */

const EIGHTHS_PER_PAGE = 8;

/**
 * Parse the way page counts are actually written on a breakdown sheet:
 * "2 4/8", "2 1/2", "4/8", "7/8", "3", "1.5". Returns eighths, or 0 when the
 * input is empty or unparseable — a missing page count reads as zero work,
 * which is the same thing the old free-text field meant.
 */
export function parseEighths(input: string | number | null | undefined): number {
  if (typeof input === 'number') return Math.max(0, Math.round(input * EIGHTHS_PER_PAGE));
  if (!input) return 0;

  const text = String(input).trim();
  if (!text) return 0;

  // "2 4/8" — whole pages plus a fraction
  const mixed = text.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) {
    const [, whole, num, den] = mixed;
    const denom = Number(den) || EIGHTHS_PER_PAGE;
    return Number(whole) * EIGHTHS_PER_PAGE + Math.round((Number(num) / denom) * EIGHTHS_PER_PAGE);
  }

  // "4/8", "1/2"
  const fraction = text.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fraction) {
    const [, num, den] = fraction;
    const denom = Number(den) || EIGHTHS_PER_PAGE;
    return Math.round((Number(num) / denom) * EIGHTHS_PER_PAGE);
  }

  // "3" or "1.5"
  const decimal = Number(text);
  if (Number.isFinite(decimal)) return Math.max(0, Math.round(decimal * EIGHTHS_PER_PAGE));

  return 0;
}

/** Render eighths the way a call sheet or one-liner does: "2 4/8", "7/8", "3". */
export function formatEighths(eighths: number): string {
  const total = Math.max(0, Math.round(eighths || 0));
  if (total === 0) return '0';

  const pages = Math.floor(total / EIGHTHS_PER_PAGE);
  const remainder = total % EIGHTHS_PER_PAGE;

  if (remainder === 0) return String(pages);
  if (pages === 0) return `${remainder}/8`;
  return `${pages} ${remainder}/8`;
}

/** Sum a set of scene lengths. */
export function totalEighths(values: number[]): number {
  return values.reduce((sum, v) => sum + (v || 0), 0);
}

/**
 * Order scene numbers the way a script does: 14 before 14A before 15, and
 * A14 before 14. Plain numeric sorting puts "14A" nowhere sensible and string
 * sorting puts "10" before "9".
 */
export function compareSceneNumbers(a: string, b: string): number {
  const parse = (value: string) => {
    const m = String(value ?? '').trim().match(/^([A-Za-z]*)\s*(\d+)\s*([A-Za-z]*)$/);
    if (!m) return { prefix: '', digits: Number.MAX_SAFE_INTEGER, suffix: String(value ?? '') };
    return { prefix: m[1].toUpperCase(), digits: Number(m[2]), suffix: m[3].toUpperCase() };
  };

  const left = parse(a);
  const right = parse(b);

  if (left.digits !== right.digits) return left.digits - right.digits;
  // "A14" sorts before "14": a lettered prefix means inserted ahead of it.
  if (left.prefix !== right.prefix) return right.prefix.localeCompare(left.prefix);
  return left.suffix.localeCompare(right.suffix);
}
