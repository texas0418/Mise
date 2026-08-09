/**
 * utils/useGuardedRouter.ts
 *
 * `useRouter`, minus the double navigation.
 *
 * `router.push` is not idempotent and a touchable does not debounce itself, so
 * two presses landing in the same tick push the destination twice and the first
 * Cancel reveals a second identical screen underneath (#78). It affected every
 * button in the app, not any one screen, so the fix belongs at the router
 * rather than at seventy-nine call sites.
 *
 * Verified with `element.click(); element.click();` inside a single evaluation,
 * which is the only way this reproduces — a slow click-through never shows it.
 *
 * The rule for what counts as a repeat lives in utils/navigationThrottle.ts,
 * dependency-free so it can be tested under node.
 */

import { useMemo, useRef } from 'react';
import { useRouter } from 'expo-router';
import { createNavigationThrottle, navigationKey } from '@/utils/navigationThrottle';

export function useGuardedRouter(): ReturnType<typeof useRouter> {
  const router = useRouter();
  // One throttle per component instance, in a ref so it survives re-renders
  // and so a second call in the same tick sees the first.
  const throttle = useRef(createNavigationThrottle()).current;

  return useMemo(() => ({
    ...router,
    push: (href, options) => {
      if (throttle(navigationKey('push', href), Date.now())) router.push(href, options);
    },
    replace: (href, options) => {
      if (throttle(navigationKey('replace', href), Date.now())) router.replace(href, options);
    },
    navigate: (href, options) => {
      if (throttle(navigationKey('navigate', href), Date.now())) router.navigate(href, options);
    },
    back: () => {
      if (throttle(navigationKey('back'), Date.now())) router.back();
    },
  }), [router, throttle]);
}
