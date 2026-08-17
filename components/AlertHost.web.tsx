/**
 * components/AlertHost.web.tsx — web
 *
 * Draws the dialog that `Alert.alert` would have drawn on a phone, because in
 * a browser it draws nothing at all (#119).
 *
 * Mounted once in `app/_layout.tsx`. It reads the queue in `lib/appAlert.web`
 * rather than owning it, so `appAlert` stays callable from anywhere, including
 * outside React — same as the API it replaces.
 *
 * Ordering conventions follow the platform rather than the array: a `cancel`
 * button is pulled to the left and the rest keep their order, which is what a
 * desktop user expects to find. On iOS the OS does this itself; here it has to
 * be done deliberately.
 */
import React, { useSyncExternalStore } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import Colors from '@/constants/colors';
import {
  getCurrentAlert,
  resolveAlert,
  subscribeToAlerts,
  type AlertButton,
} from '@/lib/appAlert.web';

function buttonOrder(buttons: AlertButton[]): AlertButton[] {
  const cancel = buttons.filter((b) => b.style === 'cancel');
  const rest = buttons.filter((b) => b.style !== 'cancel');
  return [...cancel, ...rest];
}

function labelColor(style: AlertButton['style']): string {
  if (style === 'destructive') return Colors.status.error;
  if (style === 'cancel') return Colors.text.secondary;
  return Colors.accent.gold;
}

export default function AlertHost() {
  const alert = useSyncExternalStore(subscribeToAlerts, getCurrentAlert, getCurrentAlert);

  if (!alert) return null;

  const buttons = buttonOrder(alert.buttons);
  const cancelButton = alert.buttons.find((b) => b.style === 'cancel');

  /*
   * Clicking the backdrop is a cancel, and only when there is something to
   * cancel to. Dismissing a two-button confirm by clicking outside it is
   * ordinary desktop behaviour; doing the same to a single-button message
   * would just be a way to miss it.
   */
  const onBackdrop = () => {
    if (cancelButton) resolveAlert(cancelButton);
  };

  return (
    <View style={styles.backdrop}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onBackdrop}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <View
        style={styles.dialog}
        accessibilityRole="alert"
        accessibilityViewIsModal
        accessibilityLabel={alert.title}
      >
        <Text style={styles.title}>{alert.title}</Text>
        {!!alert.message && <Text style={styles.message}>{alert.message}</Text>}

        <View style={styles.actions}>
          {buttons.map((button, i) => (
            <TouchableOpacity
              key={`${button.text ?? 'button'}-${i}`}
              style={styles.action}
              onPress={() => resolveAlert(button)}
              accessibilityRole="button"
              accessibilityLabel={button.text ?? 'OK'}
            >
              <Text style={[styles.actionText, { color: labelColor(button.style) }]}>
                {button.text ?? 'OK'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  dialog: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: Colors.bg.elevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border.medium,
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text.primary,
    textAlign: 'center',
  },
  message: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  actions: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
  },
  action: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginLeft: 4,
  },
  actionText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
