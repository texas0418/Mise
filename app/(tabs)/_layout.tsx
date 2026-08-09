// ============================================
// THIS FILE GOES AT: app/(tabs)/_layout.tsx
// (The TABS layout — Tab navigator)
// ============================================
import { Tabs } from "expo-router";
import { Clapperboard, Camera, CalendarDays, CircleDot, LayoutGrid, Sunrise } from "lucide-react-native";
import React from "react";
import { useLayout } from "@/utils/useLayout";
import Colors from "@/constants/colors";

// Day-of-shoot is where the app opens (#50).
//
// It owns `/` — the group is unnamed in the URL, so whichever group holds the
// index route is the landing surface, and `initialRouteName` alone could not
// move it: the root path still resolved to the projects list. Projects moved to
// its own `/projects` route to free `/` up.
export const unstable_settings = {
  initialRouteName: "(today)",
};

export default function TabLayout() {
  const { isTablet } = useLayout();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.accent.gold,
        tabBarInactiveTintColor: Colors.text.tertiary,
        tabBarStyle: {
          backgroundColor: Colors.bg.secondary,
          borderTopColor: Colors.border.subtle,
          borderTopWidth: 0.5,
          ...(isTablet
            ? {
                width: 200,
                height: '100%',
                borderTopWidth: 0,
                borderRightWidth: 0.5,
                borderRightColor: Colors.border.subtle,
                paddingTop: 24,
                paddingHorizontal: 8,
              }
            : {}),
        },
        tabBarLabelStyle: {
          // Was 10 on phones — the smallest text in the app, on the one control
          // that is on every screen. At 12 the six labels no longer fit the
          // width with letter spacing on, and "Schedule" truncated to
          // "Sched…"; the spacing is a phone-width luxury, the legibility is
          // not. Tablets keep it, having the room.
          fontSize: isTablet ? 14 : 12,
          fontWeight: '600' as const,
          letterSpacing: isTablet ? 0.3 : 0,
          ...(isTablet ? { marginTop: 2 } : {}),
        },
        tabBarIconStyle: isTablet ? { marginBottom: 0 } : {},
        tabBarItemStyle: isTablet
          ? {
              paddingVertical: 14,
              borderRadius: 12,
              marginVertical: 2,
              marginHorizontal: 4,
            }
          // Nothing here on phones. Six tabs across 375pt gives each item 63,
          // of which React Navigation's own 5pt padding leaves the label 53 —
          // and "Schedule" needs 55 at 12pt, so it truncates to "Sched…".
          // tabBarItemStyle padding is additive to that 5, not a replacement,
          // so it cannot buy the two points back. The fix is a shorter title
          // ("Days" would fit at any text size) and that is Simon's call.
          : {},
        ...(isTablet ? { tabBarPosition: 'left' } : {}),
      }}
    >
      <Tabs.Screen
        name="(today)"
        options={{
          title: "Today",
          tabBarIcon: ({ color, size }) => (
            <Sunrise color={color} size={isTablet ? 28 : size - 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          title: "Projects",
          tabBarIcon: ({ color, size }) => (
            <Clapperboard color={color} size={isTablet ? 28 : size - 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="shots"
        options={{
          title: "Shots",
          tabBarIcon: ({ color, size }) => (
            <Camera color={color} size={isTablet ? 28 : size - 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: "Schedule",
          tabBarIcon: ({ color, size }) => (
            <CalendarDays color={color} size={isTablet ? 28 : size - 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="onset"
        options={{
          title: "On Set",
          tabBarIcon: ({ color, size }) => (
            <CircleDot color={color} size={isTablet ? 28 : size - 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "Tools",
          tabBarIcon: ({ color, size }) => (
            <LayoutGrid color={color} size={isTablet ? 28 : size - 2} />
          ),
        }}
      />
      <Tabs.Screen
        name="crew"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
