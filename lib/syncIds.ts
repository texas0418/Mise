// ---------------------------------------------------------------------------
// lib/syncIds.ts: the one mapping from a local id to a server uuid
//
// Records were keyed by Date.now().toString() until 1.3.3. The server keys them
// by uuid, so a numeric id has always been rewritten with deterministicUUID()
// on push. The local id migration (lib/idMigration.ts) applies the same mapping
// to what is already on the phone, which is why it lives here, in one place,
// with no React Native imports: the migration, the push path, the tests and
// public.mise_project_uuid() on the server must all agree byte for byte.
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(str: string): boolean {
  return UUID_RE.test(str);
}

/**
 * Map any legacy id string to a uuid. Numeric ids keep their value (the hex of
 * the number, zero padded); anything else is hashed. Do not change this: the
 * server already holds every synced row under the uuid this returns.
 */
export function deterministicUUID(input: string): string {
  let hex: string;
  try {
    hex = BigInt(input).toString(16).padStart(32, '0').slice(0, 32);
  } catch {
    let h1 = 0x811c9dc5;
    for (let i = 0; i < input.length; i++) {
      h1 ^= input.charCodeAt(i);
      h1 = Math.imul(h1, 0x01000193);
    }
    let h2 = 0x1234abcd;
    for (let i = 0; i < input.length; i++) {
      h2 ^= input.charCodeAt(i);
      h2 = Math.imul(h2, 0x5bd1e995);
    }
    hex = ((Math.abs(h1) >>> 0).toString(16).padStart(8, '0') +
      (Math.abs(h2) >>> 0).toString(16).padStart(8, '0')).padEnd(32, '0');
  }
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/**
 * The server form of an id. A uuid passes through; a legacy id is mapped; an
 * empty string or a missing value becomes null, because Postgres rejects ""
 * for a uuid column (time_entries with no crew member failed on every push).
 */
export function ensureUUID(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value);
  if (str === '') return null;
  if (isValidUUID(str)) return str;
  return deterministicUUID(str);
}

/** Field names that hold one id: `id`, `projectId`, `project_id` and so on. */
export function isIdField(key: string): boolean {
  return key === 'id' || key.endsWith('_id') || /[a-z0-9]Id$/.test(key);
}

/** Field names that hold a list of ids: `castIds`, `cast_ids`. */
export function isIdArrayField(key: string): boolean {
  return key.endsWith('_ids') || /[a-z0-9]Ids$/.test(key);
}

function mapIdArray(value: unknown[]): unknown[] {
  return value.map((v) => (typeof v === 'string' || typeof v === 'number' ? ensureUUID(v) ?? v : v));
}

/**
 * Return a copy of `record` with every id field and id list in server form.
 * Works on camelCase records and snake_case rows alike. Only top-level fields
 * are touched: nested objects such as lighting diagram elements carry their
 * own ids that never reach a uuid column.
 */
export function mapRecordIds<T extends Record<string, any>>(record: T): T {
  const out: Record<string, any> = { ...record };
  for (const key of Object.keys(out)) {
    const value = out[key];
    if (isIdField(key)) {
      if (typeof value === 'string' || typeof value === 'number') out[key] = ensureUUID(value);
    } else if (isIdArrayField(key) && Array.isArray(value)) {
      out[key] = mapIdArray(value);
    }
  }
  return out as T;
}
