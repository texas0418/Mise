import { Stack } from "expo-router";
import React from "react";
import Colors from "@/constants/colors";

export default function ScheduleLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.bg.primary },
        headerTintColor: Colors.accent.gold,
        headerTitleStyle: { color: Colors.text.primary, fontWeight: '700' as const },
      }}
    >
      {/* "Days", matching the tab. The route stays /schedule — renaming the
          label is a wording change, not a URL migration. */}
      <Stack.Screen name="index" options={{ title: "Days" }} />
    </Stack>
  );
}
