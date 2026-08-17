/**
 * components/DesktopSidebar.web.tsx — web
 *
 * Navigation that survives opening a tool.
 *
 * The tab bar in `app/(tabs)/_layout.tsx` is the `Tabs` navigator's own bar,
 * so it exists only inside that group. Budget, call sheets, the crew directory
 * and every other tool are root Stack routes — siblings of `(tabs)`, not
 * children — so reaching one unmounts the group and takes the navigation with
 * it. On a phone that is right: a tool is a push, and the back button is the
 * way out. On a desk it means the window empties of navigation the moment you
 * open the thing you came to use, leaving a back arrow as the only route
 * anywhere (#120).
 *
 * So on web the sidebar is lifted out of the tab navigator entirely and
 * rendered beside the Stack in `app/_layout.tsx`, where nothing can unmount
 * it. `(tabs)` hides its own bar on desktop so there is exactly one.
 *
 * This is a second implementation of the same list, which is a real cost: a
 * destination added to one and not the other goes missing on one platform.
 * The alternative was moving ~30 routes inside `(tabs)`, which would change
 * every URL and make each tool a tab. DESTINATIONS below is the thing to keep
 * in step with `app/(tabs)/_layout.tsx`, and the only thing.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { usePathname } from 'expo-router';
import {
  Sunrise,
  Clapperboard,
  Camera,
  CalendarDays,
  CircleDot,
  LayoutGrid,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { useLayout } from '@/utils/useLayout';
import { useGuardedRouter } from '@/utils/useGuardedRouter';

/** Must stay in step with the Tabs.Screen list in app/(tabs)/_layout.tsx. */
const DESTINATIONS = [
  { label: 'Today', path: '/', icon: Sunrise },
  { label: 'Projects', path: '/projects', icon: Clapperboard },
  { label: 'Shots', path: '/shots', icon: Camera },
  { label: 'Days', path: '/schedule', icon: CalendarDays },
  { label: 'On Set', path: '/onset', icon: CircleDot },
  { label: 'Tools', path: '/more', icon: LayoutGrid },
] as const;

/**
 * Whether a destination is the one being looked at.
 *
 * Exact match for Today, because it is `/` and a prefix test would light it up
 * on every route in the app. Prefix for the rest, so `/projects/anything`
 * still shows Projects as current.
 *
 * A tool opened from Tools — `/budget`, `/call-sheets` — matches nothing, and
 * that is the honest answer: it is not one of these six places.
 */
export function isCurrent(pathname: string, path: string): boolean {
  if (path === '/') return pathname === '/';
  return pathname === path || pathname.startsWith(`${path}/`);
}

export default function DesktopSidebar() {
  const { isDesktop } = useLayout();
  const pathname = usePathname();
  const router = useGuardedRouter();

  if (!isDesktop) return null;

  return (
    <View style={styles.sidebar} accessibilityRole="menubar">
      {DESTINATIONS.map(({ label, path, icon: Icon }) => {
        const current = isCurrent(pathname, path);
        return (
          <TouchableOpacity
            key={path}
            style={[styles.item, current && styles.itemActive]}
            /*
              replace, not push or navigate: these six are places, not steps.
              Both of the others left a back arrow on the destination pointing
              at the tool you had just navigated away from — navigate included,
              because reaching a tool unmounts the tab group, so there is no
              existing route for it to return to and it pushes a new one.
              Replacing swaps the current entry, which is what switching
              section means and what the tab bar does on a phone.
            */
            onPress={() => router.replace(path as never)}
            activeOpacity={0.7}
            accessibilityRole="link"
            accessibilityLabel={label}
            accessibilityState={{ selected: current }}
          >
            <Icon color={current ? Colors.accent.gold : Colors.text.secondary} size={24} />
            <Text style={[styles.label, current && styles.labelActive]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 200,
    backgroundColor: Colors.bg.secondary,
    borderRightWidth: 0.5,
    borderRightColor: Colors.border.subtle,
    paddingTop: 12,
    paddingHorizontal: 12,
    gap: 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  itemActive: {
    backgroundColor: Colors.accent.goldBg,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
    color: Colors.text.secondary,
  },
  labelActive: {
    color: Colors.accent.gold,
  },
});
