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
import * as StoreReview from 'expo-store-review';
import * as Application from 'expo-application';
import { hasEarnedTheAsk, MIN_DAYS_INSTALLED, ReviewSignals } from '@/utils/reviewPolicy';

export type { ReviewSignals };
export { hasEarnedTheAsk };

const FIRST_LAUNCH_KEY = 'mise_review_first_launch';
const ASKED_VERSION_KEY = 'mise_review_asked_version';

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

    // Once per released version. Apple rate-limits too, but a request it
    // silently swallows still burns one of the user's three yearly slots.
    const version = Application.nativeApplicationVersion ?? 'unknown';
    if (await AsyncStorage.getItem(ASKED_VERSION_KEY) === version) return false;

    if (!(await StoreReview.hasAction())) return false;

    await AsyncStorage.setItem(ASKED_VERSION_KEY, version);
    await StoreReview.requestReview();
    return true;
  } catch {
    // A review prompt is never worth surfacing an error for.
    return false;
  }
}
