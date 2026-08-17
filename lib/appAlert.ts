/**
 * lib/appAlert.ts — native
 *
 * A drop-in for `Alert.alert` that also exists on the web.
 *
 * `Alert` is a React Native API with no implementation in react-native-web:
 * calling it is a no-op, so no dialog appears and the confirm button's
 * `onPress` never runs. Every confirm-then-do flow in the app was silently
 * dead in a browser, and every destructive action had quietly lost its
 * confirmation step (#119).
 *
 * On native this is a pass-through — the OS dialog is the right dialog, and
 * nothing about it needed changing. The web build gets `lib/appAlert.web.ts`,
 * which drives an in-app modal instead.
 *
 * The signature is deliberately identical to `Alert.alert` so the 145 call
 * sites read the same as they always did and stay easy to compare against
 * upstream examples.
 */
import { Alert } from 'react-native';
import type { AlertButton, AlertOptions } from 'react-native';

export type { AlertButton };

export function appAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
  options?: AlertOptions
): void {
  Alert.alert(title, message, buttons, options);
}
