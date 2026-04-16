/**
 * utils/onboarding.ts
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'mise_onboarding_v1';

export async function hasCompletedOnboarding(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === 'done';
  } catch {
    return false;
  }
}

export async function completeOnboarding(): Promise<void> {
  await AsyncStorage.setItem(KEY, 'done');
}

export async function resetOnboarding(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
