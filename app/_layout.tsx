import React, { useEffect } from "react";

import { Stack, useRouter } from "expo-router";

import { StatusBar } from "expo-status-bar";

import { AppState, Platform } from "react-native";

import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import { KeyboardProvider } from "react-native-keyboard-controller";
import Toast from "react-native-toast-message";

import * as Notifications from "expo-notifications";

import { ErrorBoundary } from "../src/components/ErrorBoundary";
import { ThemeProvider, useTheme } from "../src/theme/ThemeProvider";
import { toastConfig } from "../src/components/toast";
import { checkForOtaUpdate } from "../src/utils/otaUpdates";
import { ensureFreshToken } from "../src/services/session";
// Side-effect import — patches Alert.alert so all the existing
// `Alert.alert("Failed", err.message)` calls in 56 screens render as
// our themed toast instead of the dated Material dialog. Destructive
// confirms (with Cancel/Delete buttons) are left on the native dialog.
import "../src/utils/alertPatch";

const handleNotificationData = (
  data: any,
  router: ReturnType<typeof useRouter>
) => {
  if (!data || typeof data !== "object") return;

  switch (data.type) {
    case "task_assigned":
    case "task_completed":
      if (data.taskId) {
        router.push(`/tasks/${data.taskId}`);
      } else {
        router.push("/tasks");
      }
      break;
    case "leave_decided":
      router.push("/leaves");
      break;
    case "payslip_ready":
      router.push("/my-payroll");
      break;
    case "asset_assigned":
      router.push("/assets");
      break;
    case "checkout_reminder":
      router.push("/attendance");
      break;
    default:
      // No specific route — leave the user wherever they are.
      break;
  }
};

export default function RootLayout() {

  const router = useRouter();

  // Apply any published OTA update on launch (no-op in dev / Expo Go).
  useEffect(() => {
    checkForOtaUpdate();
  }, []);

  // Keep the access token fresh so the user never gets a silent logout
  // mid-session: refresh on launch, whenever the app returns to the
  // foreground, and on a slow timer while it stays open. No-op until the
  // token is near expiry (and a no-op entirely if there's no session).
  useEffect(() => {
    ensureFreshToken();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") ensureFreshToken();
    });
    const timer = setInterval(() => ensureFreshToken(), 60_000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") return;

    // Tap a notification while the app is foregrounded / backgrounded
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        handleNotificationData(
          response.notification.request.content.data,
          router
        );
      }
    );

    // App was launched cold by tapping a notification
    Notifications.getLastNotificationResponseAsync().then(
      (response) => {
        if (response) {
          handleNotificationData(
            response.notification.request.content.data,
            router
          );
        }
      }
    );

    return () => sub.remove();
  }, [router]);

  return (
    <ErrorBoundary>
      {/* SafeAreaProvider feeds every screen the correct top/bottom
          insets so headers stop crashing into the Android status bar
          and footers stop overlapping the gesture / home indicator.
          initialWindowMetrics lets the first paint use cached insets
          instead of waiting for a measurement round-trip (avoids a
          brief shift on cold start). */}
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        {/* KeyboardProvider powers react-native-keyboard-controller's
            keyboard-aware scroll/avoid views app-wide. It must sit above
            navigation so every screen (and Modal) can observe keyboard
            frames and animate content into view. */}
        <KeyboardProvider>
          <ThemeProvider>
            <ThemedStack />
          </ThemeProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

// Pulled inside ThemeProvider so contentStyle and StatusBar can read
// the active theme. Light mode → dark text on light bg; dark mode → light text.
const ThemedStack = () => {
  const { theme } = useTheme();
  return (
    <>
      <StatusBar style={theme.mode === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.bg },
        }}
      />
      {/* Toast host — themed slide-in notifications, replaces the
          dated Material Alert dialog for informational messages. */}
      <Toast config={toastConfig(theme.colors)} topOffset={60} />
    </>
  );
};
