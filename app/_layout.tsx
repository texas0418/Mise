import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState, useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider } from "@/contexts/AuthContext";
import { SyncProvider } from "@/contexts/SyncContext";
import { ProjectProvider } from "@/contexts/ProjectContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { DeviceLicenseProvider } from "@/contexts/DeviceLicenseContext";
import { PermissionProvider } from "@/contexts/PermissionContext";
import Colors from "@/constants/colors";
import {
  hasCompletedOnboarding,
  completeOnboarding,
} from "@/utils/onboarding";
import OnboardingFlow from "@/components/OnboardingFlow";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

export default function RootLayout() {
  const [checked, setChecked] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    hasCompletedOnboarding().then((done) => {
      setShowOnboarding(!done);
      setChecked(true);
      SplashScreen.hideAsync();
    });
  }, []);

  const handleOnboardingComplete = useCallback(async () => {
    await completeOnboarding();
    setShowOnboarding(false);
  }, []);

  if (!checked) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthProvider>
          <SyncProvider>
            <ProjectProvider>
            <SubscriptionProvider>
              <DeviceLicenseProvider>
              <PermissionProvider>
              {showOnboarding ? (
                <OnboardingFlow onComplete={handleOnboardingComplete} />
              ) : (
                <Stack
                  screenOptions={{
                    headerBackTitle: "Back",
                    headerStyle: { backgroundColor: Colors.bg.primary },
                    headerTintColor: Colors.accent.gold,
                    headerTitleStyle: { color: Colors.text.primary },
                    contentStyle: { backgroundColor: Colors.bg.primary },
                  }}
                >
                  <Stack.Screen
                    name="(tabs)"
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen
                    name="project-detail"
                    options={{ title: "Project" }}
                  />
                  <Stack.Screen
                    name="new-project"
                    options={{ presentation: "modal", title: "New Project" }}
                  />
                  <Stack.Screen
                    name="new-shot"
                    options={{ presentation: "modal", title: "New Shot" }}
                  />
                  <Stack.Screen
                    name="new-crew"
                    options={{
                      presentation: "modal",
                      title: "New Crew Member",
                    }}
                  />
                  <Stack.Screen
                    name="new-schedule-day"
                    options={{
                      presentation: "modal",
                      title: "New Shoot Day",
                    }}
                  />
                  <Stack.Screen
                    name="log-take"
                    options={{ presentation: "modal", title: "Log Take" }}
                  />
                  <Stack.Screen
                    name="script-breakdown"
                    options={{ title: "Script Breakdown" }}
                  />
                  <Stack.Screen
                    name="new-breakdown"
                    options={{
                      presentation: "modal",
                      title: "New Breakdown",
                    }}
                  />
                  <Stack.Screen
                    name="locations"
                    options={{ title: "Locations" }}
                  />
                  <Stack.Screen
                    name="new-location"
                    options={{
                      presentation: "modal",
                      title: "New Location",
                    }}
                  />
                  <Stack.Screen
                    name="budget"
                    options={{ title: "Budget" }}
                  />
                  <Stack.Screen
                    name="new-budget-item"
                    options={{
                      presentation: "modal",
                      title: "New Budget Item",
                    }}
                  />
                  <Stack.Screen
                    name="digital-slate"
                    options={{
                      title: "Digital Slate",
                      headerStyle: { backgroundColor: "#000" },
                    }}
                  />
                  <Stack.Screen
                    name="continuity"
                    options={{ title: "Continuity" }}
                  />
                  <Stack.Screen
                    name="new-continuity"
                    options={{
                      presentation: "modal",
                      title: "New Continuity Note",
                    }}
                  />
                  <Stack.Screen
                    name="lens-calculator"
                    options={{ title: "Lens Calculator" }}
                  />
                  <Stack.Screen
                    name="vfx-tracker"
                    options={{ title: "VFX Tracker" }}
                  />
                  <Stack.Screen
                    name="new-vfx"
                    options={{
                      presentation: "modal",
                      title: "New VFX Shot",
                    }}
                  />
                  <Stack.Screen
                    name="festival-tracker"
                    options={{ title: "Festivals" }}
                  />
                  <Stack.Screen
                    name="new-festival"
                    options={{
                      presentation: "modal",
                      title: "New Festival",
                    }}
                  />
                  <Stack.Screen
                    name="production-notes"
                    options={{ title: "Notes" }}
                  />
                  <Stack.Screen
                    name="new-note"
                    options={{ presentation: "modal", title: "New Note" }}
                  />
                  <Stack.Screen
                    name="mood-boards"
                    options={{ title: "Mood Boards" }}
                  />
                  <Stack.Screen
                    name="new-mood-item"
                    options={{
                      presentation: "modal",
                      title: "New Mood Item",
                    }}
                  />
                  <Stack.Screen
                    name="call-sheets"
                    options={{ title: "Call Sheets" }}
                  />
                  <Stack.Screen
                    name="crew-directory"
                    options={{ title: "Crew Directory" }}
                  />
                  <Stack.Screen
                    name="portfolio"
                    options={{ title: "Portfolio" }}
                  />
                  <Stack.Screen
                    name="frame-guides"
                    options={{ title: "Frame Guides" }}
                  />
                  <Stack.Screen
                    name="shot-references"
                    options={{ title: "Shot References" }}
                  />
                  <Stack.Screen
                    name="new-shot-reference"
                    options={{
                      presentation: "modal",
                      title: "New Reference",
                    }}
                  />
                  <Stack.Screen
                    name="wrap-reports"
                    options={{ title: "Wrap Reports" }}
                  />
                  <Stack.Screen
                    name="new-wrap-report"
                    options={{
                      presentation: "modal",
                      title: "New Wrap Report",
                    }}
                  />
                  <Stack.Screen
                    name="location-weather"
                    options={{ title: "Location Weather" }}
                  />
                  <Stack.Screen
                    name="blocking-notes"
                    options={{ title: "Blocking & Rehearsal" }}
                  />
                  <Stack.Screen
                    name="new-blocking-note"
                    options={{
                      presentation: "modal",
                      title: "New Blocking Note",
                    }}
                  />
                  <Stack.Screen
                    name="color-references"
                    options={{ title: "Color & LUT Reference" }}
                  />
                  <Stack.Screen
                    name="new-color-reference"
                    options={{
                      presentation: "modal",
                      title: "New Color Reference",
                    }}
                  />
                  <Stack.Screen
                    name="export-share"
                    options={{ title: "Export & Share" }}
                  />
                  <Stack.Screen
                    name="time-tracker"
                    options={{ title: "Time Tracker" }}
                  />
                  <Stack.Screen
                    name="new-time-entry"
                    options={{
                      presentation: "modal",
                      title: "New Time Entry",
                    }}
                  />
                  <Stack.Screen
                    name="script-sides"
                    options={{ title: "Script Sides" }}
                  />
                  <Stack.Screen
                    name="new-script-side"
                    options={{ presentation: "modal", title: "New Side" }}
                  />
                  <Stack.Screen
                    name="cast-manager"
                    options={{ title: "Cast" }}
                  />
                  <Stack.Screen
                    name="new-cast-member"
                    options={{
                      presentation: "modal",
                      title: "New Cast Member",
                    }}
                  />
                  <Stack.Screen
                    name="shot-checklist"
                    options={{ title: "Shot Checklist" }}
                  />
                  <Stack.Screen
                    name="lookbook"
                    options={{ title: "Lookbook" }}
                  />
                  <Stack.Screen
                    name="new-lookbook-item"
                    options={{
                      presentation: "modal",
                      title: "New Lookbook Item",
                    }}
                  />
                  <Stack.Screen
                    name="selects"
                    options={{ title: "Selects" }}
                  />
                  <Stack.Screen
                    name="new-select"
                    options={{ presentation: "modal", title: "New Select" }}
                  />
                  <Stack.Screen
                    name="comms-hub"
                    options={{ title: "Comms Hub" }}
                  />
                  <Stack.Screen
                    name="new-message"
                    options={{
                      presentation: "modal",
                      title: "New Message",
                    }}
                  />
                  <Stack.Screen
                    name="import-data"
                    options={{ presentation: "modal", title: "Import Data" }}
                  />
                  <Stack.Screen
                    name="ai-import"
                    options={{ presentation: "modal", title: "AI Import" }}
                  />
                  <Stack.Screen
                    name="paywall"
                    options={{ presentation: "modal", headerShown: false }}
                  />
                  <Stack.Screen
                    name="auth/sign-in"
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen
                    name="auth/sign-up"
                    options={{
                      presentation: "modal",
                      title: "Create Account",
                    }}
                  />
                  <Stack.Screen
                    name="auth/forgot-password"
                    options={{
                      presentation: "modal",
                      title: "Reset Password",
                    }}
                  />
                  <Stack.Screen
                    name="auth/profile"
                    options={{ title: "Profile" }}
                  />
                  <Stack.Screen
                    name="settings/sync"
                    options={{ title: "Sync Settings" }}
                  />
                  <Stack.Screen
                    name="settings/devices"
                    options={{ title: "My Devices" }}
                  />
                  <Stack.Screen
                    name="project/team"
                    options={{ title: "Team" }}
                  />
                  <Stack.Screen
                    name="project/invite"
                    options={{
                      presentation: "modal",
                      title: "Invite Member",
                    }}
                  />
                </Stack>
              )}
              </PermissionProvider>
              </DeviceLicenseProvider>
            </SubscriptionProvider>
            </ProjectProvider>
          </SyncProvider>
        </AuthProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
