/**
 * utils/csv.ts
 *
 * CSV for the people downstream of a shoot — an editor taking a selects list,
 * an accountant taking a budget. Dependency-free so it can be tested without
 * a native runtime.
 *
 * Escaping matters more than it looks: scene descriptions and notes routinely
 * contain commas, quotes and newlines, and an unescaped one silently shifts
 * every following column.
 */

/** Quote a single field per RFC 4180. */
export function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** Build a CSV document from headers and rows. */
export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvCell).join(',')];
  for (const row of rows) lines.push(row.map(csvCell).join(','));
  // CRLF per RFC 4180 — Excel is happier and everything else tolerates it.
  return lines.join('\r\n');
}
