/**
 * utils/fieldMapper.ts
 * 
 * Column-to-Field Mapping Engine for Mise App
 * Phase 1, Item 3
 * 
 * Takes parsed column headers from a spreadsheet and a target entity's field
 * definitions, then auto-matches columns to fields using fuzzy matching.
 * Returns a mapping config the user can review and adjust in the UI.
 */

// ─── Types ─────────────────────────────────────────────────────────

export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'enum' | 'string[]' | 'number[]';

export interface FieldDefinition {
  /** The actual TypeScript field name (e.g. 'actorName') */
  key: string;
  /** Human-readable label (e.g. 'Actor Name') */
  label: string;
  /** Data type for validation and coercion */
  type: FieldType;
  /** Whether this field must be mapped for a valid import */
  required: boolean;
  /** Valid values if type is 'enum' */
  enumValues?: string[];
  /** Default value if the column is unmapped or cell is empty */
  defaultValue?: string | number | boolean;
  /** Common alternate names users might use in spreadsheets */
  aliases?: string[];
}

export interface ColumnMapping {
  /** Index of the column in the source spreadsheet (0-based) */
  columnIndex: number;
  /** The original header text from the spreadsheet */
  columnHeader: string;
  /** The matched field key, or null if unmapped */
  mappedField: string | null;
  /** Confidence score of the auto-match (0-1). 0 = no match found */
  confidence: number;
}

export interface MappingResult {
  /** The column-to-field mappings */
  mappings: ColumnMapping[];
  /** Fields that were not matched to any column */
  unmappedFields: FieldDefinition[];
  /** Required fields that are missing a mapping */
  missingRequired: FieldDefinition[];
  /** Whether all required fields are mapped */
  isValid: boolean;
}

// ─── Normalization Helpers ─────────────────────────────────────────

/**
 * Normalize a string for fuzzy comparison:
 * - lowercase
 * - remove special characters (underscores, hyphens, dots, hash, slashes)
 * - collapse whitespace
 * - trim
 */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .replace(/[_\-\.#\/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Convert camelCase or PascalCase to space-separated words.
 * e.g. 'actorName' → 'actor name', 'vfxShotStatus' → 'vfx shot status'
 */
function camelToWords(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase();
}

/**
 * Generate all comparison variants for a field definition.
 * This creates multiple normalized strings we can match against.
 */
function getFieldVariants(field: FieldDefinition): string[] {
  const variants = new Set<string>();

  // From the key: 'actorName' → 'actor name'
  variants.add(normalize(camelToWords(field.key)));
  // Raw key normalized: 'actorName' → 'actorname'
  variants.add(normalize(field.key));
  // From the label: 'Actor Name' → 'actor name'
  variants.add(normalize(field.label));
  // From aliases
  if (field.aliases) {
    for (const alias of field.aliases) {
      variants.add(normalize(alias));
    }
  }

  return [...variants].filter(v => v.length > 0);
}

// ─── Matching Logic ────────────────────────────────────────────────

/**
 * Calculate similarity between two normalized strings.
 * Uses a combination of exact match, starts-with, contains, and word overlap.
 * Returns a score from 0 to 1.
 */
function calculateSimilarity(columnNorm: string, fieldVariant: string): number {
  // Exact match
  if (columnNorm === fieldVariant) return 1.0;

  // One contains the other entirely
  if (columnNorm.includes(fieldVariant) || fieldVariant.includes(columnNorm)) {
    const longer = Math.max(columnNorm.length, fieldVariant.length);
    const shorter = Math.min(columnNorm.length, fieldVariant.length);
    return 0.7 + (0.2 * (shorter / longer));
  }

  // Word-level overlap (good for reordered words like "Name, Actor" vs "Actor Name")
  const colWords = columnNorm.split(' ').filter(w => w.length > 0);
  const fieldWords = fieldVariant.split(' ').filter(w => w.length > 0);

  if (colWords.length === 0 || fieldWords.length === 0) return 0;

  let matchedWords = 0;
  for (const cw of colWords) {
    for (const fw of fieldWords) {
      if (cw === fw) {
        matchedWords++;
        break;
      }
      // Partial word match (e.g. 'desc' matches 'description')
      if (fw.startsWith(cw) || cw.startsWith(fw)) {
        matchedWords += 0.7;
        break;
      }
    }
  }

  const totalWords = Math.max(colWords.length, fieldWords.length);
  const wordScore = matchedWords / totalWords;

  // Only return a meaningful score if we matched at least half the words
  return wordScore >= 0.5 ? wordScore * 0.8 : 0;
}

/**
 * Find the best matching field for a given column header.
 */
function findBestMatch(
  columnHeader: string,
  fields: FieldDefinition[],
  alreadyMapped: Set<string>
): { fieldKey: string | null; confidence: number } {
  const columnNorm = normalize(columnHeader);

  if (columnNorm.length === 0) {
    return { fieldKey: null, confidence: 0 };
  }

  let bestField: string | null = null;
  let bestScore = 0;

  for (const field of fields) {
    // Skip fields already mapped to another column
    if (alreadyMapped.has(field.key)) continue;

    const variants = getFieldVariants(field);

    for (const variant of variants) {
      const score = calculateSimilarity(columnNorm, variant);
      if (score > bestScore) {
        bestScore = score;
        bestField = field.key;
      }
    }
  }

  // Only auto-map if confidence is above threshold
  const CONFIDENCE_THRESHOLD = 0.5;
  if (bestScore < CONFIDENCE_THRESHOLD) {
    return { fieldKey: null, confidence: 0 };
  }

  return { fieldKey: bestField, confidence: bestScore };
}

// ─── Main Entry Point ──────────────────────────────────────────────

/**
 * Auto-map spreadsheet column headers to entity field definitions.
 * 
 * @param columnHeaders - Array of column header strings from the spreadsheet
 * @param fieldDefinitions - Array of field definitions for the target entity type
 * @returns MappingResult with proposed mappings and validation info
 * 
 * @example
 * ```ts
 * const result = autoMapColumns(
 *   ['Actor Name', 'Character', 'Email', 'Phone #'],
 *   CAST_MEMBER_FIELDS // from importRegistry
 * );
 * // result.mappings[0] = { columnIndex: 0, columnHeader: 'Actor Name', mappedField: 'actorName', confidence: 1.0 }
 * ```
 */
export function autoMapColumns(
  columnHeaders: string[],
  fieldDefinitions: FieldDefinition[]
): MappingResult {
  const alreadyMapped = new Set<string>();
  const mappings: ColumnMapping[] = [];

  // First pass: find high-confidence matches (>= 0.8)
  const firstPassResults: Array<{ index: number; header: string; fieldKey: string | null; confidence: number }> = [];

  for (let i = 0; i < columnHeaders.length; i++) {
    const header = columnHeaders[i];
    const match = findBestMatch(header, fieldDefinitions, alreadyMapped);
    firstPassResults.push({ index: i, header, ...match });

    if (match.fieldKey && match.confidence >= 0.8) {
      alreadyMapped.add(match.fieldKey);
    }
  }

  // Second pass: accept lower-confidence matches for remaining columns
  for (const result of firstPassResults) {
    if (result.fieldKey && result.confidence >= 0.8) {
      // Already accepted in first pass
      mappings.push({
        columnIndex: result.index,
        columnHeader: result.header,
        mappedField: result.fieldKey,
        confidence: result.confidence,
      });
    } else {
      // Re-try matching with updated alreadyMapped set
      const match = findBestMatch(result.header, fieldDefinitions, alreadyMapped);
      if (match.fieldKey) {
        alreadyMapped.add(match.fieldKey);
      }
      mappings.push({
        columnIndex: result.index,
        columnHeader: result.header,
        mappedField: match.fieldKey,
        confidence: match.confidence,
      });
    }
  }

  // Determine unmapped and missing required fields
  const mappedFieldKeys = new Set(
    mappings.filter(m => m.mappedField !== null).map(m => m.mappedField!)
  );

  const unmappedFields = fieldDefinitions.filter(f => !mappedFieldKeys.has(f.key));
  const missingRequired = unmappedFields.filter(f => f.required);

  return {
    mappings,
    unmappedFields,
    missingRequired,
    isValid: missingRequired.length === 0,
  };
}

// ─── User Mapping Adjustments ──────────────────────────────────────

/**
 * Update a single column's mapping (user manually reassigns a column to a different field).
 * Returns a new MappingResult with updated validation.
 */
export function updateMapping(
  currentResult: MappingResult,
  columnIndex: number,
  newFieldKey: string | null,
  fieldDefinitions: FieldDefinition[]
): MappingResult {
  const mappings = currentResult.mappings.map(m => {
    if (m.columnIndex === columnIndex) {
      return { ...m, mappedField: newFieldKey, confidence: newFieldKey ? 1.0 : 0 };
    }
    // If another column was already mapped to this field, unmap it
    if (newFieldKey && m.mappedField === newFieldKey && m.columnIndex !== columnIndex) {
      return { ...m, mappedField: null, confidence: 0 };
    }
    return m;
  });

  const mappedFieldKeys = new Set(
    mappings.filter(m => m.mappedField !== null).map(m => m.mappedField!)
  );

  const unmappedFields = fieldDefinitions.filter(f => !mappedFieldKeys.has(f.key));
  const missingRequired = unmappedFields.filter(f => f.required);

  return {
    mappings,
    unmappedFields,
    missingRequired,
    isValid: missingRequired.length === 0,
  };
}

// ─── Data Conversion ───────────────────────────────────────────────

/**
 * Convert raw spreadsheet rows into typed entity objects using the confirmed mapping.
 * Handles type coercion, enum validation, array splitting, and default values.
 * 
 * @param rows - Raw string[][] data rows from ParsedSpreadsheet
 * @param mappings - Confirmed column mappings
 * @param fieldDefinitions - Field definitions for type coercion and defaults
 * @returns Array of partial entity objects (caller adds id, projectId, timestamps)
 */
export function convertRows(
  rows: string[][],
  mappings: ColumnMapping[],
  fieldDefinitions: FieldDefinition[]
): Record<string, unknown>[] {
  // Build a lookup: fieldKey → { columnIndex, fieldDef }
  const fieldLookup = new Map<string, { columnIndex: number; fieldDef: FieldDefinition }>();

  for (const mapping of mappings) {
    if (mapping.mappedField) {
      const fieldDef = fieldDefinitions.find(f => f.key === mapping.mappedField);
      if (fieldDef) {
        fieldLookup.set(mapping.mappedField, {
          columnIndex: mapping.columnIndex,
          fieldDef,
        });
      }
    }
  }

  return rows.map(row => {
    const entity: Record<string, unknown> = {};

    for (const fieldDef of fieldDefinitions) {
      const lookup = fieldLookup.get(fieldDef.key);

      if (!lookup) {
        // Field not mapped — use default if available
        if (fieldDef.defaultValue !== undefined) {
          entity[fieldDef.key] = fieldDef.defaultValue;
        }
        continue;
      }

      const rawValue = row[lookup.columnIndex] ?? '';
      const trimmed = rawValue.trim();

      // Empty cell — use default
      if (trimmed.length === 0) {
        if (fieldDef.defaultValue !== undefined) {
          entity[fieldDef.key] = fieldDef.defaultValue;
        } else {
          entity[fieldDef.key] = getTypeDefault(fieldDef.type);
        }
        continue;
      }

      // Coerce to the target type
      entity[fieldDef.key] = coerceValue(trimmed, fieldDef);
    }

    return entity;
  });
}

/**
 * Get the default zero/empty value for a type
 */
function getTypeDefault(type: FieldType): unknown {
  switch (type) {
    case 'string': return '';
    case 'number': return 0;
    case 'boolean': return false;
    case 'date': return '';
    case 'enum': return '';
    case 'string[]': return [];
    case 'number[]': return [];
  }
}

/**
 * Coerce a raw string value to the target field type
 */
function coerceValue(raw: string, fieldDef: FieldDefinition): unknown {
  switch (fieldDef.type) {
    case 'string':
      return raw;

    case 'number': {
      // Strip currency symbols, commas, whitespace
      const cleaned = raw.replace(/[$€£¥,\s]/g, '');
      const num = parseFloat(cleaned);
      return isNaN(num) ? (fieldDef.defaultValue ?? 0) : num;
    }

    case 'boolean': {
      const lower = raw.toLowerCase();
      return ['true', 'yes', '1', 'y', 'x', '✓', '✔'].includes(lower);
    }

    case 'date':
      // Keep as string — the entity types use ISO date strings
      return raw;

    case 'enum': {
      if (!fieldDef.enumValues) return raw;
      // Try exact match first (case-insensitive)
      const lower = raw.toLowerCase();
      const match = fieldDef.enumValues.find(v => v.toLowerCase() === lower);
      if (match) return match;
      // Try partial/fuzzy match
      const partial = fieldDef.enumValues.find(v =>
        v.toLowerCase().includes(lower) || lower.includes(v.toLowerCase())
      );
      if (partial) return partial;
      // Fall back to default or first enum value
      return fieldDef.defaultValue ?? fieldDef.enumValues[0] ?? raw;
    }

    case 'string[]':
      // Split on commas or semicolons
      return raw.split(/[,;]/).map(s => s.trim()).filter(s => s.length > 0);

    case 'number[]':
      return raw.split(/[,;]/).map(s => parseFloat(s.trim())).filter(n => !isNaN(n));

    default:
      return raw;
  }
}
