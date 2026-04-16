/**
 * utils/anthropicClient.ts
 * 
 * Anthropic API Client for Mise App
 * Phase 3, Item 11
 * 
 * Lightweight client that sends prompts to Claude API and returns parsed
 * entity arrays. Includes error handling, retry logic, and timeout.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ─────────────────────────────────────────────────────────

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | Array<{ type: string; [key: string]: unknown }>;
}

export interface AnthropicRequest {
  system: string;
  messages: AnthropicMessage[];
  maxTokens?: number;
}

export interface AnthropicResponse {
  content: Array<{ type: string; text?: string }>;
  usage?: { input_tokens: number; output_tokens: number };
}

export interface ClientConfig {
  apiKey: string;
  model?: string;
  maxRetries?: number;
  timeoutMs?: number;
}

// ─── Storage Keys ──────────────────────────────────────────────────

const API_KEY_STORAGE = 'mise_anthropic_api_key';

// ─── API Key Management ────────────────────────────────────────────

/**
 * Save the API key to local storage.
 */
export async function saveApiKey(key: string): Promise<void> {
  await AsyncStorage.setItem(API_KEY_STORAGE, key);
}

/**
 * Retrieve the saved API key.
 */
export async function getApiKey(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(API_KEY_STORAGE);
  } catch {
    return null;
  }
}

/**
 * Remove the saved API key.
 */
export async function clearApiKey(): Promise<void> {
  await AsyncStorage.removeItem(API_KEY_STORAGE);
}

/**
 * Check if an API key is saved.
 */
export async function hasApiKey(): Promise<boolean> {
  const key = await getApiKey();
  return key !== null && key.length > 0;
}

// ─── API Client ────────────────────────────────────────────────────

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_TIMEOUT_MS = 60000; // 60 seconds

/**
 * Send a completion request to the Anthropic API.
 */
export async function sendCompletion(
  request: AnthropicRequest,
  config?: Partial<ClientConfig>
): Promise<string> {
  const apiKey = config?.apiKey ?? await getApiKey();

  if (!apiKey) {
    throw new AnthropicError(
      'No API key configured. Please add your Anthropic API key in settings.',
      'auth_error'
    );
  }

  const model = config?.model ?? DEFAULT_MODEL;
  const maxRetries = config?.maxRetries ?? DEFAULT_MAX_RETRIES;
  const timeoutMs = config?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
          system: request.system,
          messages: request.messages,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        let errorMessage = `API error (${response.status})`;

        if (response.status === 401) {
          throw new AnthropicError(
            'Invalid API key. Please check your Anthropic API key.',
            'auth_error'
          );
        }
        if (response.status === 429) {
          // Rate limited — wait and retry
          if (attempt < maxRetries) {
            const waitMs = Math.min(1000 * Math.pow(2, attempt), 10000);
            await new Promise(r => setTimeout(r, waitMs));
            continue;
          }
          throw new AnthropicError(
            'Rate limited. Please wait a moment and try again.',
            'rate_limit'
          );
        }
        if (response.status === 400) {
          try {
            const parsed = JSON.parse(errorBody);
            errorMessage = parsed.error?.message ?? errorMessage;
          } catch {}
          throw new AnthropicError(errorMessage, 'bad_request');
        }
        if (response.status >= 500) {
          // Server error — retry
          if (attempt < maxRetries) {
            const waitMs = Math.min(1000 * Math.pow(2, attempt), 10000);
            await new Promise(r => setTimeout(r, waitMs));
            continue;
          }
          throw new AnthropicError(
            'Anthropic API is experiencing issues. Please try again later.',
            'server_error'
          );
        }

        throw new AnthropicError(errorMessage, 'unknown');
      }

      const data: AnthropicResponse = await response.json();

      // Extract text from response
      const textContent = data.content
        .filter(block => block.type === 'text' && block.text)
        .map(block => block.text!)
        .join('\n');

      if (!textContent) {
        throw new AnthropicError('Empty response from AI.', 'empty_response');
      }

      return textContent;

    } catch (err) {
      if (err instanceof AnthropicError) throw err;

      if (err instanceof Error && err.name === 'AbortError') {
        lastError = new AnthropicError(
          'Request timed out. Try with less data or a simpler description.',
          'timeout'
        );
      } else {
        lastError = err instanceof Error ? err : new Error(String(err));
      }

      // Retry on network errors
      if (attempt < maxRetries) {
        const waitMs = Math.min(1000 * Math.pow(2, attempt), 10000);
        await new Promise(r => setTimeout(r, waitMs));
        continue;
      }
    }
  }

  throw lastError ?? new AnthropicError('Failed after all retries.', 'unknown');
}

// ─── Error Type ────────────────────────────────────────────────────

export type AnthropicErrorType =
  | 'auth_error'
  | 'rate_limit'
  | 'bad_request'
  | 'server_error'
  | 'timeout'
  | 'empty_response'
  | 'parse_error'
  | 'unknown';

export class AnthropicError extends Error {
  type: AnthropicErrorType;

  constructor(message: string, type: AnthropicErrorType) {
    super(message);
    this.name = 'AnthropicError';
    this.type = type;
  }
}
