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

/**
 * The page margins, in millimetres.
 *
 * ## Why this is not just the `@page` rule below
 *
 * `@page { margin: … }` does nothing to a PDF produced by `printToFileAsync` on
 * iOS, and the exported call sheet came off an iPad printed edge to edge —
 * close enough to the paper's edge that a printer's own unprintable border
 * would have clipped the outer text.
 *
 * expo-print never reads the CSS. It drives `UIPrintPageRenderer` with an
 * explicit printable rect, and builds that rect from its own `margins` option
 * (expo-print 15's `PrintOptions.swift`):
 *
 *     if let margins = self.margins { … }        // absent → 0 on every side
 *     CGRect(x: left, y: top,
 *            width:  pageSize.width  - right - left,
 *            height: pageSize.height - top   - bottom)
 *
 * With no `margins` the printable rect is the whole 612×792 page, so the
 * markup is laid out corner to corner whatever the stylesheet asks for. This is
 * the same shape of bug as the `<thead>` repeat in #96: correct in Chrome,
 * ignored by the renderer that actually makes the file.
 *
 * So the numbers live here once, and go out through two routes:
 *
 * - **iOS** takes them as `margins` on `printToFileAsync` — see
 *   `utils/shareDocument.ts`. The `@page` rule is inert on that path.
 * - **Android and web** honour the `@page` rule; expo-print's `margins` option
 *   is documented `@platform ios` and is ignored there.
 *
 * Exactly one of the two applies per platform, so they do not compound. Change
 * these and the `@page` rule follows automatically — `scripts/test-calldoc.ts`
 * fails if the two ever disagree.
 */
export const PAGE_MARGIN_MM = { top: 14, right: 12, bottom: 14, left: 12 } as const;

/** 72 points to the inch, 25.4 millimetres to the inch. */
const PT_PER_MM = 72 / 25.4;

/**
 * The same margins in PDF points, which is what expo-print's option wants.
 *
 * Rounded to whole points: a PDF point is already finer than any printer
 * resolves a margin to, and a whole number is far easier to check against a
 * rendered file.
 */
export const PAGE_MARGIN_PT = {
  top: Math.round(PAGE_MARGIN_MM.top * PT_PER_MM),
  right: Math.round(PAGE_MARGIN_MM.right * PT_PER_MM),
  bottom: Math.round(PAGE_MARGIN_MM.bottom * PT_PER_MM),
  left: Math.round(PAGE_MARGIN_MM.left * PT_PER_MM),
} as const;

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

  /* Honoured on Android and web. Inert on iOS — see PAGE_MARGIN_MM above. */
  @page { margin: ${PAGE_MARGIN_MM.top}mm ${PAGE_MARGIN_MM.right}mm ${PAGE_MARGIN_MM.bottom}mm ${PAGE_MARGIN_MM.left}mm; }
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

  /* Repeat column headers on every page a table continues onto.
     Chrome does this by default, WKWebView does not — page 2 of a real call
     sheet arrived with the crew table headless: four unlabelled columns of
     names, roles, departments and times. Caught by printing one on an iPad,
     which is exactly the class of difference a headless-Chrome proof cannot
     see.

     THIS DOES NOT WORK ON iOS, and #96 was wrong to record finding 18 as
     fixed. A 44-crew call sheet exported from the app puts the header on page
     1 only; pages 2 and 3 open straight onto unlabelled rows. Measured out of
     the PDF with pdftotext, not eyeballed — see #103.

     It is correct CSS and it is honoured on Android and web, so it stays. What
     it cannot do is survive expo-print's iOS path, which paginates a
     UIViewPrintFormatter rather than using the CSS paged-media model.

     Already tried and ruled out, so nobody repeats it: setting the table to
     border-collapse: separate with border-spacing: 0, on the theory that
     WebKit suppresses repeating header groups while borders collapse. It made
     no difference — same one header, same pages. Reverted rather than left in
     as a change that bought nothing.

     Note for anyone editing these comments: this stylesheet is a template
     literal, so a backtick here ends the string and the build fails in Metro
     rather than in tsc. */
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }

  /* Keep a section heading with the table it introduces. An <h2> alone at the
     foot of a page, with its rows overleaf, reads as a heading whose content
     failed to print. */
  h2 { page-break-after: avoid; break-after: avoid; }
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
