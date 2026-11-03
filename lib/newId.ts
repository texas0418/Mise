/**
 * lib/newId.ts
 *
 * The id every new local record gets.
 *
 * Records used to be keyed by `Date.now().toString()`. The server keys them by
 * uuid, so the sync engine rewrote each numeric id on the way up and nothing
 * rewrote it on the way down: a pulled row never matched its local original,
 * and every synced record turned into two. A uuid from the start means the id
 * a phone makes is the id the server stores, byte for byte.
 *
 * Neither expo-crypto nor react-native-get-random-values is a dependency, so
 * this uses `crypto.getRandomValues` where the runtime has it (web, and
 * Hermes builds that expose it) and Math.random otherwise. An id only has to
 * be unique, not secret, and 122 random bits from either source is plenty.
 */

function randomBytes(): Uint8Array {
  const bytes = new Uint8Array(16);
  const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
  if (c && typeof c.getRandomValues === 'function') {
    c.getRandomValues(bytes);
    return bytes;
  }
  for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  return bytes;
}

/** A random RFC 4122 version 4 uuid, lowercase. */
export function newId(): string {
  const b = randomBytes();
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
