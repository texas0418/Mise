/**
 * utils/aiImport.ts
 * 
 * AI Prompt Builder for Mise App
 * Phase 3, Item 9
 * 
 * Takes an entity's field schema from the import registry and builds a
 * structured prompt. The user describes their data in natural language
 * and the utility constructs a prompt that returns structured JSON
 * matching the entity type.
 */

import { EntityConfig } from './importRegistry';
import { FieldDefinition } from './fieldMapper';

// ─── Types ─────────────────────────────────────────────────────────

export interface AIImportRequest {
  /** The entity config for the target type */
  entityConfig: EntityConfig;
  /** Free-form text describing the data to import */
  userText: string;
  /** Optional: base64 image of a handwritten sheet / document */
  imageBase64?: string;
  /** Optional: MIME type of the image */
  imageMimeType?: string;
}

export interface AIImportPrompt {
  /** System message setting up the AI's role */
  system: string;
  /** User message with the data to parse */
  userMessage: string | Array<{ type: string; [key: string]: unknown }>;
}

// ─── Prompt Building ───────────────────────────────────────────────

/**
 * Build the JSON schema description for an entity type.
 * This tells Claude exactly what fields to output and their constraints.
 */
function buildFieldSchema(fields: FieldDefinition[]): string {
  const lines = fields.map(f => {
    let desc = `  "${f.key}": ${f.type}`;
    if (f.required) desc += ' (REQUIRED)';
    else desc += ' (optional)';
    if (f.enumValues && f.enumValues.length > 0) {
      desc += ` — must be one of: ${f.enumValues.map(v => `"${v}"`).join(', ')}`;
    }
    if (f.defaultValue !== undefined) {
      desc += ` — default: "${f.defaultValue}"`;
    }
    desc += ` — ${f.label}`;
    return desc;
  });
  return lines.join('\n');
}

/**
 * Build the example JSON for an entity based on its exampleRow.
 */
function buildExampleJSON(config: EntityConfig): string {
  const example: Record<string, unknown> = {};
  for (const field of config.fields) {
    const val = config.exampleRow[field.key];
    if (val !== undefined) {
      // Coerce to the right type for the example
      if (field.type === 'number') {
        example[field.key] = parseFloat(val) || 0;
      } else if (field.type === 'boolean') {
        example[field.key] = val === 'yes' || val === 'true';
      } else if (field.type === 'string[]') {
        example[field.key] = val.split(',').map((s: string) => s.trim());
      } else if (field.type === 'number[]') {
        example[field.key] = val.split(',').map((s: string) => parseInt(s.trim()));
      } else {
        example[field.key] = val;
      }
    }
  }
  return JSON.stringify([example], null, 2);
}

/**
 * Build a structured prompt for the AI to parse free-form text into entity data.
 */
export function buildAIPrompt(request: AIImportRequest): AIImportPrompt {
  const { entityConfig, userText, imageBase64, imageMimeType } = request;

  const system = `You are a data extraction assistant for a film production app called Mise. Your job is to parse user-provided information about ${entityConfig.label.toLowerCase()} and return a JSON array of objects matching an exact schema.

RULES:
1. Return ONLY a valid JSON array — no markdown, no backticks, no explanation.
2. Each object in the array must follow this schema:

${buildFieldSchema(entityConfig.fields)}

3. For enum fields, match the user's description to the closest valid enum value.
4. For fields the user doesn't mention, use the default value or omit the field.
5. For number fields, extract numeric values (strip $, commas, etc.).
6. For date fields, output ISO format (YYYY-MM-DD).
7. For array fields (string[] or number[]), return actual JSON arrays.
8. Infer as much as you can from context. For example, if someone says "my DP" you know that's the Camera department.
9. If the input is an image of a document (call sheet, budget sheet, crew list), extract all readable data from it.
10. Always return at least one item if the user provides any data. If you genuinely cannot extract anything, return an empty array [].

EXAMPLE OUTPUT for ${entityConfig.label}:
${buildExampleJSON(entityConfig)}`;

  // Build the user message
  let userMessage: string | Array<{ type: string; [key: string]: unknown }>;

  if (imageBase64 && imageMimeType) {
    // Multi-modal: text + image
    userMessage = [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: imageMimeType,
          data: imageBase64,
        },
      },
      {
        type: 'text',
        text: userText
          ? `Extract ${entityConfig.label.toLowerCase()} data from this image and the following additional notes:\n\n${userText}`
          : `Extract all ${entityConfig.label.toLowerCase()} data from this image.`,
      },
    ];
  } else {
    userMessage = `Parse the following into ${entityConfig.label.toLowerCase()} data:\n\n${userText}`;
  }

  return { system, userMessage };
}

/**
 * Parse the AI's response into typed entity objects.
 * Handles common AI response quirks (markdown wrapping, extra text, etc.)
 */
export function parseAIResponse(rawResponse: string): Record<string, unknown>[] {
  let cleaned = rawResponse.trim();

  // Strip markdown code fences if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  // Try to find JSON array in the response
  const arrayStart = cleaned.indexOf('[');
  const arrayEnd = cleaned.lastIndexOf(']');

  if (arrayStart === -1 || arrayEnd === -1 || arrayEnd <= arrayStart) {
    // Try parsing as a single object wrapped in array
    const objStart = cleaned.indexOf('{');
    const objEnd = cleaned.lastIndexOf('}');
    if (objStart !== -1 && objEnd !== -1 && objEnd > objStart) {
      try {
        const obj = JSON.parse(cleaned.slice(objStart, objEnd + 1));
        return [obj];
      } catch {
        throw new Error('Could not parse AI response as JSON. The AI may not have returned valid data.');
      }
    }
    throw new Error('No JSON array found in AI response.');
  }

  try {
    const parsed = JSON.parse(cleaned.slice(arrayStart, arrayEnd + 1));
    if (!Array.isArray(parsed)) {
      throw new Error('AI response is not an array.');
    }
    return parsed;
  } catch (e) {
    throw new Error(`Failed to parse AI response: ${e instanceof Error ? e.message : 'Unknown error'}`);
  }
}
