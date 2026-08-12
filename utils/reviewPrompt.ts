/**
 * utils/reviewPrompt.ts
 *
 * Asking for an App Store review, at a moment that has been earned.
 *
 * Three constraints shape this:
 *
 * 1. Apple decides, not us. `requestReview` shows the system sheet at most
 *    three times per year per user and may show nothing at all. It cannot be
 *    forced, and there is no callback telling us what happened.
 *
 * 2. No sentiment gating. Apple's guidelines forbid asking "enjoying the app?"
 *    first and only forwarding happy users to the real prompt. So this asks
 *    plainly or not at all.
 *
 * 3. Never on set. This is the one specific to Mise: interrupting a director
 *    mid-shoot to ask for a star rating is the worst thing this app could do.
 *    The prompt only fires from a calm surface, never from the On Set flow.
 *
 * The bar is "this person has actually made something with it" — not a launch
 * count, which measures nothing.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { hasEarnedTheAsk, MIN_DAYS_INSTALLED, ReviewSignals } from '@/utils/reviewPolicy';

/*
 * expo-store-review is required lazily, behind a native-registry check —
 * copied from number-nine's src/review.ts, where the comment is load-bearing:
 *
 * Do NOT rely on try/catch around require() for fail-open here: when a
 * module's factory throws (native half missing from the binary), Metro's
 * guardedLoadModule reports it as a FATAL error itself — the exception never
 * reaches the catch, and a release build aborts at launch. That bricked
 * number-nine's 2026-07-27 device build. Checking the registry BEFORE
 * requiring means the factory can never throw. A static top-level import —
 * what this file had — is the same crash one import-graph change earlier.
 */
function getStoreReview(): typeof import('expo-store-review') | null {
  const native = (globalThis as unknown as { expo?: { modules?: Record<string, unknown> } })
    .expo?.modules?.ExpoStoreReview;
  if (!native) return null;
  try {
    return require('expo-store-review');
  } catch {
    return null;
  }
}

export type { ReviewSignals };
export { hasEarnedTheAsk };

const FIRST_LAUNCH_KEY = 'mise_review_first_launch';
/** Once ever — the catalog convention. The versioned key below is honoured as
 * "already asked" so nobody prompted under the 1.1.0 per-version rule is
 * asked a second time by the change. */
const ASKED_EVER_KEY = 'mise_review_asked';
const LEGACY_ASKED_VERSION_KEY = 'mise_review_asked_version';

/** Record the first launch so the install age can be checked later. */
export async function noteFirstLaunch(): Promise<void> {
  try {
    const existing = await AsyncStorage.getItem(FIRST_LAUNCH_KEY);
    if (!existing) {
      await AsyncStorage.setItem(FIRST_LAUNCH_KEY, new Date().toISOString());
    }
  } catch {}
}

async function daysSinceFirstLaunch(): Promise<number> {
  try {
    const raw = await AsyncStorage.getItem(FIRST_LAUNCH_KEY);
    if (!raw) return 0;
    const ms = Date.now() - new Date(raw).getTime();
    return ms / (1000 * 60 * 60 * 24);
  } catch {
    return 0;
  }
}

/**
 * Ask for a review if the moment is right. Safe to call often — it is cheap
 * and silent when the conditions are not met.
 *
 * Returns true only when the request was actually handed to the OS, which is
 * still not a guarantee the user saw anything.
 */
export async function maybeAskForReview(signals: ReviewSignals): Promise<boolean> {
  try {
    if (!hasEarnedTheAsk(signals)) return false;
    if (await daysSinceFirstLaunch() < MIN_DAYS_INSTALLED) return false;

    // Once ever. Apple rate-limits too, but a request it silently swallows
    // still burns one of the user's three yearly slots.
    if (await AsyncStorage.getItem(ASKED_EVER_KEY)) return false;
    if (await AsyncStorage.getItem(LEGACY_ASKED_VERSION_KEY)) return false;

    const StoreReview = getStoreReview();
    if (!StoreReview) return false;
    if (!(await StoreReview.hasAction())) return false;

    await AsyncStorage.setItem(ASKED_EVER_KEY, new Date().toISOString());
    await StoreReview.requestReview();
    return true;
  } catch {
    // A review prompt is never worth surfacing an error for.
    return false;
  }
}
