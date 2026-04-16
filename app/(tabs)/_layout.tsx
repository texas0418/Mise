// ============================================
// THIS FILE GOES AT: app/(tabs)/_layout.tsx
// (The TABS layout — Tab navigator)
// ============================================
import { Tabs } from "expo-router";
import { Clapperboard, Camera, CalendarDays, CircleDot, LayoutGrid } from "lucide-react-native";
import React from "react";
import { useLayout } from "@/utils/useLayout";
import Colors from "@/constants/colors";

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
          fontSize: isTablet ? 14 : 10,
          fontWeight: '600' as const,
          letterSpacing: 0.3,
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
          : {},
        ...(isTablet ? { tabBarPosition: 'left' } : {}),
      }}
    >
      <Tabs.Screen
        name="(home)"
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
