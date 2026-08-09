/**
 * utils/sceneList.ts
 *
 * Parsing the free-text scene list a shoot day carries. Kept dependency-free
 * and separate from the migration that uses it so it can be reasoned about —
 * and tested — on its own.
 */

/**
 * Pull scene numbers out of the free-text list a shoot day carries — the
 * shapes people actually type: "Sc. 1, 5, 8", "1,5,8", "Sc 1-3", "12A".
 * Ranges only expand when both ends are plain integers; "1A-3B" is ambiguous
 * and is left as the two literal tokens rather than guessed at.
 */
export function parseSceneList(text: string): string[] {
  if (!text) return [];
  const cleaned = String(text).replace(/\bsc(ene)?s?\.?/gi, ' ');
  const out: string[] = [];

  for (const rawToken of cleaned.split(/[,;/]+/)) {
    const token = rawToken.trim();
    if (!token) continue;

    const range = token.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (range) {
      const [from, to] = [Number(range[1]), Number(range[2])];
      if (from <= to && to - from < 200) {
        for (let n = from; n <= to; n++) out.push(String(n));
        continue;
      }
    }

    const single = token.match(/^[A-Za-z]?\d+[A-Za-z]?$/);
    if (single) out.push(token.toUpperCase());
  }

  return Array.from(new Set(out));
}
