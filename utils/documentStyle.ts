/**
 * utils/documentStyle.ts
 *
 * The house style for anything Mise produces as a document.
 *
 * Deliberately nothing like the app's dark theme: these get printed, emailed
 * and pinned to a wall. A production document is black on white, dense, and
 * legible photocopied — an on-set app's palette would be unreadable and waste
 * a cartridge.
 *
 * Kept dependency-free so the markup can be built and inspected without a
 * native runtime.
 */

export interface DocumentMeta {
  /** Film title, printed largest. */
  projectTitle: string;
  /** What this document is: "SHOT LIST", "CALL SHEET — DAY 3". */
  documentTitle: string;
  /** Optional line under the title: a date, a location. */
  subtitle?: string;
  /** ISO date used for the generated-on stamp. */
  generatedAt: string;
}

/** Escape values that came from user input before they land in markup. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const CSS = `
  /* A document is black on white, always. Without this the renderer applies
     the device's dark colour scheme and the PDF comes out dark-on-dark —
     caught by rendering one and looking at it, not by any type or lint check. */
  :root { color-scheme: only light; }
  html, body { background: #ffffff; }

  @page { margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif;
    color: #111; font-size: 11pt; line-height: 1.4; margin: 0;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .titleblock { border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 14px; }
  .project { font-size: 19pt; font-weight: 800; letter-spacing: -0.3px; margin: 0; }
  .doctitle { font-size: 11pt; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; margin: 4px 0 0; }
  .subtitle { font-size: 10pt; color: #444; margin: 3px 0 0; }
  .stamp { font-size: 8pt; color: #777; margin-top: 6px; }

  h2 { font-size: 10pt; font-weight: 700; letter-spacing: 1.4px; text-transform: uppercase;
       color: #111; margin: 16px 0 6px; padding-bottom: 3px; border-bottom: 1px solid #bbb; }

  table { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
  th { font-size: 8pt; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;
       color: #444; text-align: left; border-bottom: 1px solid #999; padding: 4px 6px 3px; }
  td { font-size: 10pt; padding: 5px 6px; border-bottom: 1px solid #e3e3e3; vertical-align: top; }
  /* Rows should not be split across a page break — a half-row reads as an error. */
  tr { page-break-inside: avoid; }
  /* Label / value blocks: safety, logistics, weather, the advance. A fixed
     label column stops "Nearest hospital" wrapping onto two lines while the
     value beside it runs the width of the page. */
  .defs td:first-child { width: 22%; color: #444; }
  .num { font-variant-numeric: tabular-nums; white-space: nowrap; }
  /* Money columns align right, headers included, so the figures form a column
     that can be read down. This lives on the table because text-align on the
     inline span inside a cell does nothing — which is why the budget printed
     with its totals row right-aligned and every row above it left-aligned. */
  .money th:not(:first-child), .money td:not(:first-child) { text-align: right; }
  .muted { color: #666; }
  .total td { font-weight: 700; border-top: 1.5px solid #111; border-bottom: none; }
  .note { font-size: 9.5pt; color: #444; font-style: italic; }
  .empty { font-size: 10pt; color: #777; font-style: italic; padding: 10px 0; }
`;

/** Wrap document body markup in the shared shell. */
export function renderDocument(meta: DocumentMeta, bodyHtml: string): string {
  const stamp = new Date(meta.generatedAt).toLocaleString('en-US', {
    dateStyle: 'medium', timeStyle: 'short',
  });
  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>${CSS}</style></head><body>
<div class="titleblock">
  <p class="project">${escapeHtml(meta.projectTitle)}</p>
  <p class="doctitle">${escapeHtml(meta.documentTitle)}</p>
  ${meta.subtitle ? `<p class="subtitle">${escapeHtml(meta.subtitle)}</p>` : ''}
  <p class="stamp">Generated ${escapeHtml(stamp)} · Mise</p>
</div>
${bodyHtml}
</body></html>`;
}

/** A table, or an honest note when there is nothing to put in one. */
export function renderTable(
  headers: string[],
  rows: string[][],
  emptyMessage = 'Nothing recorded.',
  className = '',
  /**
   * A totals row, rendered inside this table rather than beside it. A separate
   * <table> sizes its own columns, so a totals row built that way lands at
   * different x positions from the figures it is totalling.
   */
  totalRow?: string[],
): string {
  if (rows.length === 0) return `<p class="empty">${escapeHtml(emptyMessage)}</p>`;
  const tr = (cells: string[], cls = '') =>
    `<tr${cls ? ` class="${cls}"` : ''}>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`;
  const body = rows.map(cells => tr(cells)).join('')
    + (totalRow ? tr(totalRow, 'total') : '');
  // Label/value blocks pass all-blank headers. Printing them anyway leaves an
  // empty header band — a stray rule and a finger of dead space under the
  // section title, which reads as a heading with its table missing. Found by
  // printing a call sheet and looking at it; the markup assertions cannot see
  // whitespace.
  const labelled = headers.some(h => h.trim().length > 0);
  const head = labelled
    ? `<thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>`
    : '';
  const attr = className ? ` class="${className}"` : '';
  return `<table${attr}>${head}<tbody>${body}</tbody></table>`;
}
