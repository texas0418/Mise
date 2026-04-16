import { Stack } from "expo-router";
import React from "react";
import Colors from "@/constants/colors";

export default function OnSetLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.bg.primary },
        headerTintColor: Colors.accent.gold,
        headerTitleStyle: { color: Colors.text.primary, fontWeight: '700' as const },
      }}
    >
      <Stack.Screen name="index" options={{ title: "On Set" }} />
    </Stack>
  );
}
