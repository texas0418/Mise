import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState, useCallback } from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
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
import { hasRunPhotoMigration, runPhotoMigration } from "@/lib/photoMigration";
import { hasRunSceneMigration, runSceneMigration } from "@/lib/sceneMigration";
import { hasRunCrewMigration, runCrewMigration } from "@/lib/crewMigration";
import { noteFirstLaunch } from "@/utils/reviewPrompt";
import OnboardingFlow from "@/components/OnboardingFlow";
import { useGuardedRouter } from "@/utils/useGuardedRouter";
import { useTypography } from "@/utils/useTypography";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

/**
 * Explicit way out of a data-entry form.
 *
 * Form modals have swipe-to-dismiss disabled (#65) so a stray touch cannot
 * throw away what you typed. That makes a labelled exit essential rather than
 * optional — the inherited back chevron reads as "go back a screen", not
 * "discard this". Cancel replaces it so there is exactly one obvious way out.
 */
function ModalCancelButton() {
  const router = useGuardedRouter();
  const { denseTextCap } = useTypography();
  return (
    <TouchableOpacity
      onPress={() => router.back()}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      accessibilityRole="button"
      accessibilityLabel="Cancel and close this form"
      testID="modal-cancel-button"
    >
      {/*
        Capped, and this is the one place in the app where capping is right.
        A navigation bar's height belongs to UIKit, not to us, so text that
        outgrows it is not pushed down — it is sheared. At the largest setting
        "Cancel" rendered as the top half of its own letters, which is worse
        for the reader who turned text up than merely-large text would be.
        Everywhere the layout can actually grow, text is left uncapped.
      */}
      <Text style={styles.modalCancel} maxFontSizeMultiplier={denseTextCap}>Cancel</Text>
    </TouchableOpacity>
  );
}

/**
 * Rebuilds the screen tree when the reader changes their text size.
 *
 * ## Why this is not solvable by re-rendering
 *
 * Changing Dynamic Type while Mise is running left every screen clipped —
 * headings sheared to a sliver, button labels cut to a dark line, the day's
 * date showing only the bottom of its glyphs — until the app was killed and
 * relaunched. Reproduced on an iPad and again on the simulator with
 * `xcrun simctl ui <udid> content_size accessibility-extra-extra-extra-large`,
 * which changes the setting without a relaunch.
 *
 * The cause is in React Native itself, not in this app. On the New
 * Architecture a `<Text>` measures through `ParagraphShadowNode::getContent`,
 * which memoises the built string on the node:
 *
 *     const Content& ParagraphShadowNode::getContent(
 *         const LayoutContext& layoutContext) const {
 *       if (content_.has_value()) {
 *         return content_.value();          // never re-reads layoutContext
 *       }
 *       ...
 *       textAttributes.fontSizeMultiplier = layoutContext.fontSizeMultiplier;
 *
 * The multiplier is read only on the miss. iOS does deliver the change —
 * `RCTFabricSurface` observes `UIContentSizeCategoryDidChangeNotification` and
 * re-runs layout with the new multiplier — but a shadow node that survives that
 * pass answers from `content_` and reports the height it had at the old size.
 * The glyphs are painted at the new size inside a box measured for the old one,
 * which is the clipping. `content_` is only discarded when the node is cloned
 * with new props, so no amount of re-rendering with unchanged props clears it.
 *
 * Hence a `key`. Changing it unmounts the tree and builds new shadow nodes,
 * which take the current multiplier on their first measure. It sits inside the
 * providers deliberately: auth, sync, subscription and project state all
 * survive, and only the navigator and the screens below it are rebuilt.
 *
 * The cost is that navigation returns to the initial route, which is the reason
 * to key here and not around the providers — and text size is a setting a
 * reader changes in Settings and comes back from, not mid-task.
 */
function DynamicTypeBoundary({ children }: { children: React.ReactNode }) {
  const { fontScale } = useTypography();
  return <React.Fragment key={fontScale}>{children}</React.Fragment>;
}

/** Shared options for every data-entry modal. */
const FORM_MODAL_OPTIONS = {
  presentation: "modal" as const,
  gestureEnabled: false,
  headerBackVisible: false,
  headerLeft: () => <ModalCancelButton />,
};

// eslint-disable-next-line max-lines-per-function -- tracked in #2
export default function RootLayout() {
  const [checked, setChecked] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    (async () => {
      // Runs before the providers mount, so the stores read already-migrated
      // photo references rather than a stale in-memory copy.
      try {
        if (!(await hasRunPhotoMigration())) {
          const { rescued, lost } = await runPhotoMigration();
          if (rescued || lost) {
            console.log(`[photoMigration] rescued ${rescued}, cleared ${lost}`);
          }
        }
      } catch (e) {
        console.warn("[photoMigration] skipped:", e);
      }

      // Build Scene records from existing breakdowns and shots (#53).
      try {
        if (!(await hasRunSceneMigration())) {
          const r = await runSceneMigration();
          if (r.fromBreakdowns || r.fromShots || r.shotsLinked || r.daysLinked) {
            console.log(
              `[sceneMigration] ${r.fromBreakdowns} from breakdowns, ` +
              `${r.fromShots} from shots, ${r.shotsLinked} shots linked, ` +
              `${r.daysLinked} days linked`,
            );
          }
        }
      } catch (e) {
        console.warn("[sceneMigration] skipped:", e);
      }

      // Assign existing contacts to existing projects, so call sheets keep
      // listing the people they listed before crew became project-scoped.
      try {
        if (!(await hasRunCrewMigration())) {
          const { created } = await runCrewMigration();
          if (created) console.log(`[crewMigration] ${created} assignments created`);
        }
      } catch (e) {
        console.warn("[crewMigration] skipped:", e);
      }

      // Stamped once, so the review prompt can tell a new install from a
      // long-running one.
      await noteFirstLaunch();

      const done = await hasCompletedOnboarding();
      setShowOnboarding(!done);
      setChecked(true);
      SplashScreen.hideAsync();
    })();
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
              <DynamicTypeBoundary>
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
                    options={{ ...FORM_MODAL_OPTIONS, title: "New Project" }}
                  />
                  <Stack.Screen
                    name="new-shot"
                    options={{ ...FORM_MODAL_OPTIONS, title: "New Shot" }}
                  />
                  <Stack.Screen
                    name="new-crew"
                    options={{
                      ...FORM_MODAL_OPTIONS,
                      title: "New Crew Member",
                    }}
                  />
                  <Stack.Screen
                    name="new-schedule-day"
                    options={{
                      ...FORM_MODAL_OPTIONS,
                      title: "New Shoot Day",
                    }}
                  />
                  <Stack.Screen
                    name="log-take"
                    options={{ ...FORM_MODAL_OPTIONS, title: "Log Take" }}
                  />
                  <Stack.Screen
                    name="script-breakdown"
                    options={{ title: "Scenes" }}
                  />
                  <Stack.Screen
                    name="new-breakdown"
                    options={{
                      ...FORM_MODAL_OPTIONS,
                      title: "New Scene",
                    }}
                  />
                  <Stack.Screen
                    name="locations"
                    options={{ title: "Locations" }}
                  />
                  <Stack.Screen
                    name="new-location"
                    options={{
                      ...FORM_MODAL_OPTIONS,
                      title: "New Location",
                    }}
                  />
                  <Stack.Screen
                    name="budget"
                    options={{ title: "Budget" }}
                  />
                  <Stack.Screen
                    name="budget-spreadsheet"
                    options={{ title: "Budget" }}
                  />
                  <Stack.Screen
                    name="new-budget-item"
                    options={{
                      ...FORM_MODAL_OPTIONS,
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
                      ...FORM_MODAL_OPTIONS,
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
                      ...FORM_MODAL_OPTIONS,
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
                      ...FORM_MODAL_OPTIONS,
                      title: "New Festival",
                    }}
                  />
                  <Stack.Screen
                    name="production-notes"
                    options={{ title: "Notes" }}
                  />
                  <Stack.Screen
                    name="new-note"
                    options={{ ...FORM_MODAL_OPTIONS, title: "New Note" }}
                  />
                  <Stack.Screen
                    name="mood-boards"
                    options={{ title: "Mood Boards" }}
                  />
                  <Stack.Screen
                    name="new-mood-item"
                    options={{
                      ...FORM_MODAL_OPTIONS,
                      title: "New Mood Item",
                    }}
                  />
                  <Stack.Screen
                    name="call-sheets"
                    options={{ title: "Call Sheets" }}
                  />
                  <Stack.Screen
                    name="call-sheet-details"
                    options={{
                      ...FORM_MODAL_OPTIONS,
                      title: "Call Sheet Details",
                    }}
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
                      ...FORM_MODAL_OPTIONS,
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
                      ...FORM_MODAL_OPTIONS,
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
                      ...FORM_MODAL_OPTIONS,
                      title: "New Blocking Note",
                    }}
                  />
                  <Stack.Screen
                    name="lighting-diagrams"
                    options={{ title: "Lighting Diagrams" }}
                  />
                  <Stack.Screen
                    name="new-lighting-diagram"
                    options={{
                      ...FORM_MODAL_OPTIONS,
                      title: "New Lighting Diagram",
                    }}
                  />
                  <Stack.Screen
                    name="lighting-editor"
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen
                    name="color-references"
                    options={{ title: "Color & LUT Reference" }}
                  />
                  <Stack.Screen
                    name="new-color-reference"
                    options={{
                      ...FORM_MODAL_OPTIONS,
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
                      ...FORM_MODAL_OPTIONS,
                      title: "New Time Entry",
                    }}
                  />
                  <Stack.Screen
                    name="script-sides"
                    options={{ title: "Script Sides" }}
                  />
                  <Stack.Screen
                    name="new-script-side"
                    options={{ ...FORM_MODAL_OPTIONS, title: "New Side" }}
                  />
                  <Stack.Screen
                    name="cast-manager"
                    options={{ title: "Cast" }}
                  />
                  <Stack.Screen
                    name="new-cast-member"
                    options={{
                      ...FORM_MODAL_OPTIONS,
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
                      ...FORM_MODAL_OPTIONS,
                      title: "New Lookbook Item",
                    }}
                  />
                  <Stack.Screen
                    name="selects"
                    options={{ title: "Selects" }}
                  />
                  <Stack.Screen
                    name="new-select"
                    options={{ ...FORM_MODAL_OPTIONS, title: "New Select" }}
                  />
                  <Stack.Screen
                    name="comms-hub"
                    options={{ title: "Comms Hub" }}
                  />
                  <Stack.Screen
                    name="new-message"
                    options={{
                      ...FORM_MODAL_OPTIONS,
                      title: "New Message",
                    }}
                  />
                  <Stack.Screen
                    name="import-data"
                    options={{ ...FORM_MODAL_OPTIONS, title: "Import Data" }}
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
                      ...FORM_MODAL_OPTIONS,
                      title: "Create Account",
                    }}
                  />
                  <Stack.Screen
                    name="auth/forgot-password"
                    options={{
                      ...FORM_MODAL_OPTIONS,
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
                      ...FORM_MODAL_OPTIONS,
                      title: "Invite Member",
                    }}
                  />
                  <Stack.Screen
                    name="scripts"
                    options={{ title: "Scripts" }}
                  />
                  <Stack.Screen
                    name="new-script"
                    options={{
                      ...FORM_MODAL_OPTIONS,
                      title: "Upload Script",
                    }}
                  />
                  <Stack.Screen
                    name="script-viewer"
                    options={{ headerShown: false }}
                  />
                </Stack>
              )}
              </DynamicTypeBoundary>
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

const styles = StyleSheet.create({
  modalCancel: {
    fontSize: 17,
    color: Colors.accent.gold,
  },
});
