/**
 * components/DesktopGate.web.tsx
 *
 * Mise on a desktop is part of a subscription, and requires one.
 *
 * Simon's rule (2026-08-12): "Mise desktop should be usable only if the user
 * has paid a subscription for at least one device. It would include use of the
 * desktop version." So the browser build gates the whole app rather than
 * individual features — unlike the phone, which has a free tier that has
 * always worked and keeps it.
 *
 * Two states before the app, and they are different problems:
 *
 * - **Signed out.** There is nothing to check against. Ask them to sign in;
 *   do not imply they need to buy anything, because they may already have.
 * - **Signed in without a subscription.** Say what would unlock it, and say
 *   where — subscribing happens on the phone or iPad through the App Store,
 *   because that is the only place Mise takes payment. Sending someone to a
 *   purchase button that does not exist here would be worse than saying so.
 *
 * The entitlement itself comes from `readDesktopEntitlement` — see that
 * function for why it reads licensed devices as well as the mirror, and for
 * why this is a soft gate rather than an authoritative one.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Monitor, LogIn } from 'lucide-react-native';
import { usePathname } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useDeviceLicense } from '@/contexts/DeviceLicenseContext';
import { useGuardedRouter } from '@/utils/useGuardedRouter';
import Colors from '@/constants/colors';

function Panel({ icon, title, body, action, onAction, secondary, onSecondary }: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: string;
  onAction?: () => void;
  secondary?: string;
  onSecondary?: () => void;
}) {
  return (
    <View style={styles.container}>
      <View style={styles.panel}>
        <View style={styles.iconWrap}>{icon}</View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
        {action && (
          <TouchableOpacity accessibilityRole="button" style={styles.button} onPress={onAction} activeOpacity={0.8}>
            <Text style={styles.buttonText}>{action}</Text>
          </TouchableOpacity>
        )}
        {secondary && (
          <TouchableOpacity accessibilityRole="button" onPress={onSecondary} activeOpacity={0.7}>
            <Text style={styles.secondary}>{secondary}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function DesktopGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, signOut } = useAuth();
  const { isPro } = useDeviceLicense();
  const router = useGuardedRouter();
  const pathname = usePathname();

  /*
   * The auth screens are how somebody gets past this gate, so they cannot sit
   * behind it.
   *
   * Without this the Sign in button worked perfectly and looked broken: it
   * changed the URL to /auth/sign-in, the gate re-rendered itself on that
   * route, and the panel stayed on screen. There was no way into the app at
   * all — not a degraded state, a closed door with the key behind it.
   *
   * Checked before everything else, including the loading state: these routes
   * are never gated, whatever auth is doing.
   */
  if (pathname.startsWith('/auth')) return <>{children}</>;

  /*
   * Nothing at all while auth resolves. A gate that flashes "sign in" at
   * someone who is already signed in reads as being logged out, and on a
   * desktop that is a reason to close the tab.
   */
  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={Colors.accent.gold} size="large" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <Panel
        icon={<LogIn color={Colors.accent.gold} size={28} />}
        title="Sign in to use Mise here"
        body={'Mise on a computer comes with your subscription. Sign in with the account you use on your phone or iPad and your films will be here.'}
        action="Sign in"
        onAction={() => router.push('/auth/sign-in' as never)}
      />
    );
  }

  if (!isPro) {
    return (
      <Panel
        icon={<Monitor color={Colors.accent.gold} size={28} />}
        title="Mise on a computer needs a subscription"
        body={'Your subscription covers every device you use, this one included — but this account does not have one yet.\n\nSubscriptions are bought in the app on your iPhone or iPad, through the App Store. Once one is active, sign in here again and this screen will be gone.'}
        secondary="Sign out"
        onSecondary={() => { void signOut(); }}
      />
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: Colors.bg.primary,
    alignItems: 'center', justifyContent: 'center', padding: 32,
  },
  panel: { maxWidth: 460, alignItems: 'center' },
  iconWrap: {
    width: 64, height: 64, borderRadius: 32, marginBottom: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.accent.gold + '18',
    borderWidth: 1, borderColor: Colors.accent.gold + '33',
  },
  title: {
    fontSize: 22, fontWeight: '800' as const, color: Colors.text.primary,
    textAlign: 'center', marginBottom: 12,
  },
  body: {
    fontSize: 15, color: Colors.text.secondary, textAlign: 'center', lineHeight: 22,
  },
  button: {
    marginTop: 24, backgroundColor: Colors.accent.gold,
    borderRadius: 12, paddingVertical: 14, paddingHorizontal: 28,
  },
  buttonText: { fontSize: 16, fontWeight: '700' as const, color: Colors.text.inverse },
  secondary: { marginTop: 20, fontSize: 14, color: Colors.text.tertiary },
});
