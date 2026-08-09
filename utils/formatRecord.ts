/**
 * utils/formatRecord.ts
 *
 * Formatting values that came out of a record, rather than out of a literal.
 *
 * The distinction matters because a record's fields are not as certain as their
 * types claim. `BudgetItem.estimated` is typed `number`, and a row that reaches
 * the screen without one takes `formatCurrency(undefined)` — and with it the
 * whole Budget screen — down to a redbox (#90). The type says it cannot happen;
 * the running app disagreed.
 *
 * Three places already hold records shaped like that, left by a delete that
 * predates the cascade, and **no sync round trip has ever run** — a partially
 * pulled row is exactly this shape, so the population of them is going to grow
 * rather than shrink.
 *
 * So: every formatter here takes `unknown`, and every one has a fallback. A
 * missing value renders as an em dash, which reads as "not recorded" rather
 * than as a crash or as the word "Invalid".
 *
 * Kept dependency-free so node can run the suite.
 */

/** What a value renders as when there is nothing to render. */
export const MISSING = '—';

const isPresent = (value: unknown): boolean =>
  value !== null && value !== undefined && String(value).trim().length > 0;

/**
 * A number from a record, or null when it is not one.
 *
 * Numeric strings are accepted: CSV import and the spreadsheet editor both
 * produce them, and a budget typed in as "1200" should not read as missing.
 */
export function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value.replace(/[$,\s]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * "$1,234", "-$2,100", or "—".
 *
 * The sign goes outside the symbol: "$-2,100" is not how money is written
 * anywhere, and it reads as a typo on a document that goes to a financier.
 */
export function money(value: unknown): string {
  const amount = toNumber(value);
  if (amount === null) return MISSING;
  const magnitude = Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return `${amount < 0 ? '-' : ''}$${magnitude}`;
}

/** A plain count, or "—". Zero is a count, not an absence. */
export function count(value: unknown): string {
  const n = toNumber(value);
  return n === null ? MISSING : n.toLocaleString('en-US');
}

/**
 * A Date from a record, or null when it cannot be read.
 *
 * A bare `YYYY-MM-DD` is anchored at midday rather than midnight. Parsed as
 * UTC midnight it lands on the previous day for anyone west of Greenwich, which
 * is the same class of bug as `toISOString().slice(0,10)` — see utils/today.ts.
 */
export function toDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== 'string' || value.trim().length === 0) return null;

  const text = value.trim();
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(text);
  const parsed = new Date(dateOnly ? `${text}T12:00:00` : text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Any date format, guarded.
 *
 * The named helpers below cover the common shapes; this exists for the call
 * sites with their own option sets, so they can be given a fallback without
 * their output changing by so much as a comma when the value is readable.
 */
export function dateWith(value: unknown, options: Intl.DateTimeFormatOptions): string {
  const date = toDate(value);
  return date === null ? MISSING : date.toLocaleDateString('en-US', options);
}

const formatted = dateWith;

/** "Aug 9" */
export const shortDate = (value: unknown): string =>
  formatted(value, { month: 'short', day: 'numeric' });

/** "Sat, Aug 9" */
export const weekdayDate = (value: unknown): string =>
  formatted(value, { weekday: 'short', month: 'short', day: 'numeric' });

/** "August 9, 2026" */
export const longDate = (value: unknown): string =>
  formatted(value, { month: 'long', day: 'numeric', year: 'numeric' });

/** "Aug 9, 2026" */
export const mediumDate = (value: unknown): string =>
  formatted(value, { month: 'short', day: 'numeric', year: 'numeric' });

/** "9", for a date shown as a calendar tile. "—" when unreadable. */
export function dayOfMonth(value: unknown): string {
  const date = toDate(value);
  return date === null ? MISSING : String(date.getDate());
}

/**
 * Any time format, guarded.
 *
 * Worth stating because it is not obvious: an invalid Date does **not** throw
 * from `toLocaleTimeString`, it returns the string "Invalid Date". A try/catch
 * around one is dead code that reads like a guard.
 */
export function timeWith(value: unknown, options: Intl.DateTimeFormatOptions): string {
  const date = toDate(value);
  return date === null ? MISSING : date.toLocaleTimeString('en-US', options);
}

/** "09:48 AM" */
export const clockTime = (value: unknown): string =>
  timeWith(value, { hour: '2-digit', minute: '2-digit' });

/** Any string field, or "—" when it is blank. */
export const text = (value: unknown): string =>
  isPresent(value) ? String(value).trim() : MISSING;
