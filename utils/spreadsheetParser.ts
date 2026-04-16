/**
 * utils/spreadsheetParser.ts
 * 
 * Universal Spreadsheet Parser for Mise App
 * Phase 1, Item 2
 * 
 * Handles picking a file from the device, detecting its format (CSV/TSV/XLSX/XLS),
 * parsing it into raw row arrays, and returning column headers + data rows.
 * This is the single parsing layer that everything else builds on.
 */

import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

// ─── Types ─────────────────────────────────────────────────────────

export type SupportedFormat = 'csv' | 'tsv' | 'xlsx' | 'xls';

export interface ParsedSpreadsheet {
  /** Original filename */
  fileName: string;
  /** Detected file format */
  format: SupportedFormat;
  /** Column header names from the first row */
  headers: string[];
  /** Data rows (excluding the header row). Each row is a string array matching headers order */
  rows: string[][];
  /** Total number of data rows (excluding header) */
  rowCount: number;
  /** Total number of columns */
  columnCount: number;
}

export interface SpreadsheetPickerOptions {
  /** If true, show a sheet selector for multi-sheet XLSX files. Default: false (uses first sheet) */
  allowSheetSelection?: boolean;
}

export interface ParseError {
  type: 'pick_cancelled' | 'read_error' | 'parse_error' | 'unsupported_format' | 'empty_file';
  message: string;
}

export type ParseResult =
  | { success: true; data: ParsedSpreadsheet }
  | { success: false; error: ParseError };

// ─── MIME types for the document picker ────────────────────────────

const SPREADSHEET_MIME_TYPES = [
  'text/csv',
  'text/tab-separated-values',
  'text/plain',                                                    // some devices classify CSV as plain text
  'application/vnd.ms-excel',                                      // .xls
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
];

// ─── Format Detection ──────────────────────────────────────────────

/**
 * Detect spreadsheet format from filename extension
 */
function detectFormat(fileName: string): SupportedFormat | null {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'csv': return 'csv';
    case 'tsv': return 'tsv';
    case 'txt': return 'csv'; // treat .txt as CSV (PapaParse will auto-detect delimiter)
    case 'xlsx': return 'xlsx';
    case 'xls': return 'xls';
    default: return null;
  }
}

// ─── File Reading ──────────────────────────────────────────────────

/**
 * Read file contents as a UTF-8 string (for CSV/TSV)
 */
async function readAsString(uri: string): Promise<string> {
  const file = new File(uri);
  const content = await file.text();
  return content;
}

/**
 * Read file contents as base64 (for XLSX/XLS binary formats)
 */
async function readAsBase64(uri: string): Promise<string> {
  const file = new File(uri);
  const content = await file.base64();
  return content;
}

// ─── CSV/TSV Parsing ───────────────────────────────────────────────

/**
 * Parse CSV or TSV content using PapaParse
 * PapaParse auto-detects the delimiter, so this handles both CSV and TSV
 */
function parseCSV(content: string): { headers: string[]; rows: string[][] } {
  const result = Papa.parse(content, {
    header: false,        // We'll handle headers ourselves for more control
    skipEmptyLines: true, // Ignore blank rows
    dynamicTyping: false, // Keep everything as strings for consistency
  });

  const rawRows = result.data as string[][];

  if (rawRows.length === 0) {
    return { headers: [], rows: [] };
  }

  // First row is headers
  const headers = rawRows[0].map(h => (h ?? '').toString().trim());
  // Remaining rows are data
  const rows = rawRows.slice(1).map(row =>
    row.map(cell => (cell ?? '').toString().trim())
  );

  return { headers, rows };
}

// ─── XLSX/XLS Parsing ──────────────────────────────────────────────

/**
 * Parse XLSX or XLS content using SheetJS
 */
function parseXLSX(base64Content: string, sheetIndex: number = 0): { headers: string[]; rows: string[][]; sheetNames: string[] } {
  const workbook = XLSX.read(base64Content, { type: 'base64' });
  const sheetNames = workbook.SheetNames;

  if (sheetNames.length === 0) {
    return { headers: [], rows: [], sheetNames: [] };
  }

  // Use specified sheet or default to first
  const sheetName = sheetNames[Math.min(sheetIndex, sheetNames.length - 1)];
  const worksheet = workbook.Sheets[sheetName];

  // Convert to array of arrays (all cells as strings)
  const rawData: string[][] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,      // Return array of arrays (not objects)
    defval: '',     // Default empty cells to empty string
    raw: false,     // Convert everything to strings
  });

  if (rawData.length === 0) {
    return { headers: [], rows: [], sheetNames };
  }

  // First row is headers
  const headers = rawData[0].map(h => (h ?? '').toString().trim());
  // Remaining rows are data, padded to match header count
  const rows = rawData.slice(1).map(row => {
    const paddedRow = [...row];
    while (paddedRow.length < headers.length) {
      paddedRow.push('');
    }
    return paddedRow.map(cell => (cell ?? '').toString().trim());
  });

  return { headers, rows, sheetNames };
}

// ─── Get Sheet Names (for multi-sheet XLSX) ────────────────────────

/**
 * Read just the sheet names from an XLSX file without full parsing.
 * Useful for showing a sheet selector UI.
 */
export async function getSheetNames(uri: string): Promise<string[]> {
  try {
    const base64 = await readAsBase64(uri);
    const workbook = XLSX.read(base64, { type: 'base64', bookSheets: true });
    return workbook.SheetNames;
  } catch {
    return [];
  }
}

// ─── Main Entry Points ─────────────────────────────────────────────

/**
 * Open the device file picker and parse the selected spreadsheet.
 * This is the main entry point for the import flow.
 */
export async function pickAndParseSpreadsheet(
  options?: SpreadsheetPickerOptions
): Promise<ParseResult> {
  try {
    // Step 1: Pick file
    const result = await DocumentPicker.getDocumentAsync({
      type: SPREADSHEET_MIME_TYPES,
      copyToCacheDirectory: true, // Required for expo-file-system to read it
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return {
        success: false,
        error: { type: 'pick_cancelled', message: 'File selection was cancelled' },
      };
    }

    const asset = result.assets[0];
    const fileName = asset.name ?? 'unknown';
    const uri = asset.uri;

    // Step 2: Detect format
    const format = detectFormat(fileName);
    if (!format) {
      return {
        success: false,
        error: {
          type: 'unsupported_format',
          message: `Unsupported file type: "${fileName}". Please use CSV, TSV, XLSX, or XLS files.`,
        },
      };
    }

    // Step 3: Parse based on format
    return await parseFile(uri, fileName, format);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error occurred';
    return {
      success: false,
      error: { type: 'read_error', message: `Failed to pick file: ${message}` },
    };
  }
}

/**
 * Parse a file that's already been picked (given its URI and known format).
 * Useful if you've already called the document picker separately.
 */
export async function parseFile(
  uri: string,
  fileName: string,
  format: SupportedFormat,
  sheetIndex: number = 0
): Promise<ParseResult> {
  try {
    let headers: string[];
    let rows: string[][];

    if (format === 'csv' || format === 'tsv') {
      // Read as text and parse with PapaParse
      const content = await readAsString(uri);
      if (!content || content.trim().length === 0) {
        return {
          success: false,
          error: { type: 'empty_file', message: 'The selected file is empty.' },
        };
      }
      const parsed = parseCSV(content);
      headers = parsed.headers;
      rows = parsed.rows;
    } else {
      // Read as base64 and parse with SheetJS
      const base64 = await readAsBase64(uri);
      if (!base64 || base64.length === 0) {
        return {
          success: false,
          error: { type: 'empty_file', message: 'The selected file is empty.' },
        };
      }
      const parsed = parseXLSX(base64, sheetIndex);
      headers = parsed.headers;
      rows = parsed.rows;
    }

    // Validate we got something useful
    if (headers.length === 0) {
      return {
        success: false,
        error: { type: 'empty_file', message: 'No headers found in the file. The first row should contain column names.' },
      };
    }

    if (rows.length === 0) {
      return {
        success: false,
        error: { type: 'empty_file', message: 'The file contains headers but no data rows.' },
      };
    }

    // Filter out rows that are completely empty
    const nonEmptyRows = rows.filter(row => row.some(cell => cell.length > 0));

    return {
      success: true,
      data: {
        fileName,
        format,
        headers,
        rows: nonEmptyRows,
        rowCount: nonEmptyRows.length,
        columnCount: headers.length,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error occurred';
    return {
      success: false,
      error: { type: 'parse_error', message: `Failed to parse "${fileName}": ${message}` },
    };
  }
}
