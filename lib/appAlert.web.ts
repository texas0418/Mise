/**
 * lib/appAlert.web.ts — web
 *
 * The browser implementation of `appAlert`. See `lib/appAlert.ts` for why this
 * exists at all: `Alert.alert` is a no-op in react-native-web, so on the web
 * build every confirmation silently did nothing (#119).
 *
 * This half is only the queue. `components/AlertHost.web.tsx` renders it.
 * Splitting them keeps `appAlert` importable from anywhere — including
 * non-React code — exactly like the native `Alert.alert` it replaces.
 *
 * `window.confirm` was the cheaper option and was rejected: it cannot express
 * three buttons, cannot mark a destructive action as destructive, and looks
 * like a browser warning rather than like Mise.
 */

export interface AlertButton {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface AlertRequest {
  title: string;
  message?: string;
  buttons: AlertButton[];
}

let current: AlertRequest | null = null;
const pending: AlertRequest[] = [];
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

/**
 * Queue an alert.
 *
 * Alerts queue rather than replace one another, because native does the same:
 * a second `Alert.alert` while one is open does not silently discard the
 * first. Dropping one here would lose whatever its buttons were going to do.
 */
export function appAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[]
): void {
  // No buttons means an acknowledgement, which still needs a way out of the
  // modal. Native supplies an OK button in the same situation.
  const request: AlertRequest = {
    title,
    message,
    buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }],
  };

  if (current) {
    pending.push(request);
    return;
  }
  current = request;
  emit();
}

export function getCurrentAlert(): AlertRequest | null {
  return current;
}

export function subscribeToAlerts(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Close the open alert and run the chosen button's handler.
 *
 * The handler runs *after* the modal has been dismissed and the next queued
 * alert promoted, matching native ordering — a handler that opens another
 * alert (several do) must not race the dismissal of the one it came from.
 */
export function resolveAlert(button?: AlertButton): void {
  const chosen = button;
  current = pending.shift() ?? null;
  emit();
  chosen?.onPress?.();
}
