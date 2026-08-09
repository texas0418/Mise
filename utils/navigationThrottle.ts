/**
 * utils/navigationThrottle.ts
 *
 * The rule behind useGuardedRouter: which repeated navigations to swallow.
 *
 * Dependency-free — no expo-router import, no React — so
 * `node --experimental-strip-types` can exercise it. The interesting decision
 * is not "debounce navigation", it is *what counts as the same navigation*,
 * and that is worth being able to test without a renderer.
 */

/** Long enough to swallow a double tap, short enough not to block a real second trip. */
export const REPEAT_WINDOW_MS = 600;

/**
 * A stable key for one navigation intent.
 *
 * The destination is part of the key on purpose. A single timer would have
 * been wrong: app/paywall.tsx closes itself and then pushes the sign-up screen
 * in one handler, and a shared timer swallows the push.
 *
 *     router.back();
 *     router.push('/auth/sign-up');
 *
 * The bug is one action firing twice, not two different navigations in a row.
 */
export function navigationKey(method: string, href?: unknown): string {
  if (href === undefined) return method;
  if (typeof href === 'string') return `${method}:${href}`;
  try {
    return `${method}:${JSON.stringify(href)}`;
  } catch {
    return `${method}:${String(href)}`;
  }
}

/**
 * A throttle that answers "should this navigation run?".
 *
 * The timestamp is recorded before the caller navigates, so two calls in the
 * same tick see each other — the same reason the entity store reads its base
 * state inside the write step rather than from a render snapshot.
 */
export function createNavigationThrottle(windowMs: number = REPEAT_WINDOW_MS) {
  const lastAt = new Map<string, number>();

  return function allow(key: string, now: number): boolean {
    const previous = lastAt.get(key);
    if (previous !== undefined && now - previous < windowMs) return false;
    lastAt.set(key, now);
    return true;
  };
}
