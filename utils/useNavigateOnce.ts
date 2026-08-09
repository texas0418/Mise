/**
 * utils/useNavigateOnce.ts
 *
 * One navigation per tap.
 *
 * `router.push` is not idempotent, and a button does not debounce itself: two
 * presses landing in the same tick — a double tap, or a gloved hand on set —
 * push the destination twice, so the first Cancel reveals a second identical
 * form underneath. Verified in the web harness by firing `click(); click();`
 * inside one evaluation, which mounts two copies of the target screen.
 *
 * The timestamp lives in a ref and is written before the navigation runs, so
 * the second call in a tick sees the first. Reading it from state instead would
 * mean both calls see the pre-render value — the same reasoning as the take
 * counter in the on-set slate.
 */

import { useCallback, useRef } from 'react';

/** Long enough to swallow a double tap, short enough not to block a real second trip. */
const REPEAT_WINDOW_MS = 600;

export function useNavigateOnce(): (go: () => void) => void {
  const lastAt = useRef(0);

  return useCallback((go: () => void) => {
    const now = Date.now();
    if (now - lastAt.current < REPEAT_WINDOW_MS) return;
    lastAt.current = now;
    go();
  }, []);
}
