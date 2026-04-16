import { Stack } from "expo-router";
import React from "react";
import Colors from "@/constants/colors";

export default function MoreLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.bg.primary },
        headerTintColor: Colors.accent.gold,
        headerTitleStyle: { color: Colors.text.primary },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Tools" }} />
    </Stack>
  );
}
