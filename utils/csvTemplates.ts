/**
 * utils/csvTemplates.ts
 * 
 * CSV Template Generator for Mise App
 * Phase 4, Item 14
 * 
 * Auto-generates template CSV strings from the import registry with
 * correct headers and one example row. Users can download these from
 * the import screen to know the expected format.
 */

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { EntityConfig, IMPORT_REGISTRY } from './importRegistry';

// ─── Types ─────────────────────────────────────────────────────────

export interface CSVTemplate {
  entityKey: string;
  entityLabel: string;
  fileName: string;
  csvContent: string;
  headers: string[];
}

// ─── CSV Generation ────────────────────────────────────────────────

/**
 * Escape a value for CSV (handle commas, quotes, newlines).
 */
function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Generate a CSV template string for a given entity config.
 * Includes headers (using human-readable labels) and one example row.
 */
export function generateCSVTemplate(config: EntityConfig): CSVTemplate {
  const headers = config.fields.map(f => f.label);
  const headerRow = headers.map(escapeCSV).join(',');

  // Build example row from the config's exampleRow
  const exampleValues = config.fields.map(f => {
    const val = config.exampleRow[f.key];
    return val !== undefined ? escapeCSV(String(val)) : '';
  });
  const exampleRow = exampleValues.join(',');

  const csvContent = `${headerRow}\n${exampleRow}\n`;
  const fileName = `mise_${config.key}_template.csv`;

  return {
    entityKey: config.key,
    entityLabel: config.label,
    fileName,
    csvContent,
    headers,
  };
}

/**
 * Generate CSV templates for all importable entity types.
 */
export function generateAllTemplates(): CSVTemplate[] {
  return Object.values(IMPORT_REGISTRY).map(generateCSVTemplate);
}

/**
 * Get a single template by entity key.
 */
export function getTemplate(entityKey: string): CSVTemplate | null {
  const config = IMPORT_REGISTRY[entityKey];
  if (!config) return null;
  return generateCSVTemplate(config);
}

// ─── File Export ────────────────────────────────────────────────────

/**
 * Save a CSV template to a temp file and share it via the native share sheet.
 * This lets users save to Files, AirDrop, email, etc.
 */
export async function shareCSVTemplate(entityKey: string): Promise<void> {
  const template = getTemplate(entityKey);
  if (!template) {
    throw new Error(`No template found for entity: ${entityKey}`);
  }

  // Write to temp file
  const fileUri = `${FileSystem.cacheDirectory}${template.fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, template.csvContent, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  // Check if sharing is available
  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('Sharing is not available on this device.');
  }

  // Open share sheet
  await Sharing.shareAsync(fileUri, {
    mimeType: 'text/csv',
    dialogTitle: `${template.entityLabel} Template`,
    UTI: 'public.comma-separated-values-text',
  });
}

/**
 * Save a CSV template to the device's document directory.
 * Returns the file URI for display.
 */
export async function saveCSVTemplate(entityKey: string): Promise<string> {
  const template = getTemplate(entityKey);
  if (!template) {
    throw new Error(`No template found for entity: ${entityKey}`);
  }

  const fileUri = `${FileSystem.documentDirectory}${template.fileName}`;
  await FileSystem.writeAsStringAsync(fileUri, template.csvContent, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  return fileUri;
}
