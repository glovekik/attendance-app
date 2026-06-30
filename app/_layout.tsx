import React, { useEffect, useState, useCallback } from "react";

import { Stack, useRouter, useFocusEffect, usePathname } from "expo-router";

import { StatusBar } from "expo-status-bar";

import * as SplashScreen from "expo-splash-screen";

import { AppState, Platform, View } from "react-native";
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import { KeyboardProvider } from "react-native-keyboard-controller";
import Toast from "react-native-toast-message";

import * as Notifications from "expo-notifications";

import { ErrorBoundary } from "../src/components/ErrorBoundary";
import { ThemeProvider, useTheme } from "../src/theme/ThemeProvider";
import { AnimatedSplash } from "../src/components/AnimatedSplash";
import { toastConfig } from "../src/components/toast";
import { checkForOtaUpdate } from "../src/utils/otaUpdates";
import { ensureFreshToken } from "../src/services/session";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getMe } from "../src/services/api";
import { SidebarNav } from "../src/components/SidebarNav";
import { useResponsive, SIDEBAR_WIDTH } from "../src/utils/responsive";
import { User } from "../src/types";
import { CommandPalette } from "../src/components/CommandPalette";
import { useKeyboardShortcuts } from "../src/hooks/useKeyboardShortcuts";
import { resolveNotificationRoute } from "../src/utils/notificationRoute";
// Side-effect import — patches Alert.alert so all the existing
// `Alert.alert("Failed", err.message)` calls in 56 screens render as
// our themed toast instead of the dated Material dialog. Destructive
// confirms (with Cancel/Delete buttons) are left on the native dialog.
import "../src/utils/alertPatch";

// Hold the native splash until our animated splash takes over (hidden in
// ThemedStack once mounted) so the branded intro is seamless on cold start.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Route a tapped notification to the right screen.
//
// Two classes of notification need different destinations:
//   • "decision/outcome" alerts go to the affected employee → their own
//     screen (e.g. /leaves, /reimbursements).
//   • "new request/submission" alerts fan out to approvers (the reporting
//     manager + every HR user via notify_approvers) → their approval queue,
//     which differs by role: managers use /manager-*, HR uses the HR screen.
// So for the approver types we resolve the current user's role first. The
// backend authorises HR on the /manager-* endpoints too, so those are the
// safe fallback when the role can't be read.
//
// NOTE: the `type` strings here must match exactly what the backend emits
// (see utils/notify.py callers) — e.g. "leave_decision" / "task_complete",
// NOT "leave_decided" / "task_completed".
const handleNotificationData = async (
  data: any,
  router: ReturnType<typeof useRouter>
) => {
  if (!data || typeof data !== "object") return;

  // Resolve the recipient's role, then route through the shared, role-gated
  // resolver (same logic the in-app bell uses). If the role can't access the
  // target page, resolveNotificationRoute returns null and we don't redirect.
  let role: string | null = null;
  try {
    const token = await AsyncStorage.getItem("token");
    const me = token ? await getMe(token) : null;
    role = (me?.role as string) || "USER";
  } catch {
    role = "USER";
  }

  const route = resolveNotificationRoute(data, role);
  if (route) router.push(route as any);
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
  const router = useRouter();
  const pathname = usePathname();
  const [splashDone, setSplashDone] = useState(false);
  const { showSidebar, sidebarCollapsed } = useResponsive();

  // Routes shown BEFORE authentication — the sidebar must never appear on
  // these (the bug: on web the sidebar rendered on the login page because
  // visibility was width-only). Gate it on not being on an auth screen.
  const AUTH_ROUTES = ["/login", "/forgot-password", "/reset-password"];
  const onAuthScreen = AUTH_ROUTES.some(
    (r) => pathname === r || (pathname?.startsWith(r + "/") ?? false)
  );
  const sidebarVisible = showSidebar && !onAuthScreen;

  // Fetch user for sidebar navigation (web only)
  const [user, setUser] = useState<User | null>(null);

  // Command palette state (web only)
  const [showCommandPalette, setShowCommandPalette] = useState(false);

  // LEARNING POINT: Keyboard Shortcuts for Web
  // Enable Cmd+K to open command palette on desktop web
  useKeyboardShortcuts({
    onCommandPalette: () => setShowCommandPalette(true),
    onEscape: () => {
      if (showCommandPalette) {
        setShowCommandPalette(false);
      } else {
        router.back();
      }
    },
  });

  const fetchUser = useCallback(async () => {
    // Only fetch user on web where sidebar is shown
    if (Platform.OS !== "web") return;
    try {
      const token = await AsyncStorage.getItem("token");
      if (token) {
        const me = await getMe(token);
        setUser(me);
      } else {
        // No session — clear any stale user so the sidebar/command
        // palette don't show authenticated state on the login page.
        setUser(null);
      }
    } catch {
      // User not logged in or token invalid - sidebar will show default tabs
    }
  }, []);

  useEffect(() => {
    // Re-runs on navigation (pathname change) so the sidebar picks up the
    // freshly-authenticated user right after login (web SPA navigation
    // doesn't fire an AppState change).
    fetchUser();
  }, [fetchUser, pathname]);

  useEffect(() => {
    // Re-fetch when app becomes active (e.g., returning from background)
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") fetchUser();
    });
    return () => sub.remove();
  }, [fetchUser]);

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  // Calculate sidebar width for content offset
  const sidebarWidth = sidebarVisible
    ? sidebarCollapsed
      ? SIDEBAR_WIDTH.collapsed
      : SIDEBAR_WIDTH.expanded
    : 0;

  return (
    <>
      <StatusBar style={theme.mode === "dark" ? "light" : "dark"} />

      <View
        style={{
          flex: 1,
          flexDirection: "row",
          backgroundColor: theme.colors.bg,
        }}
      >
        {/* LEARNING POINT: Desktop Sidebar Navigation
            On web with sufficient screen width, we show a sidebar instead of
            bottom tabs. The sidebar is fixed on the left side. */}
        {sidebarVisible && (
          <View
            style={{
              position: Platform.OS === "web" ? ("fixed" as any) : "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              zIndex: 100,
            }}
          >
            <SidebarNav user={user} collapsed={sidebarCollapsed} />
          </View>
        )}

        {/* Main Content Area */}
        <View
          style={{
            flex: 1,
            marginLeft: sidebarWidth,
            alignItems: "center",
          }}
        >
          <View
            style={{
              flex: 1,
              width: "100%",
              maxWidth: sidebarVisible ? undefined : 1400,
            }}
          >
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: {
                  backgroundColor: theme.colors.bg,
                },
              }}
            />
          </View>
        </View>
      </View>

      {/* LEARNING POINT: Desktop-optimized Toast Positioning
          On desktop web, toasts appear in the top-right corner (like Slack).
          On mobile, they stay centered at the top. The toast card width is
          responsive via the toastConfig styles. */}
      <Toast
        config={toastConfig(theme.colors)}
        position="top"
        topOffset={sidebarVisible ? 20 : 60}
      />

      {!splashDone && (
        <AnimatedSplash onFinish={() => setSplashDone(true)} />
      )}

      {/* LEARNING POINT: Command Palette (Cmd+K)
          A quick navigation modal for desktop web users.
          Press Cmd+K (Mac) or Ctrl+K (Windows) to open. */}
      {Platform.OS === "web" && !onAuthScreen && (
        <CommandPalette
          visible={showCommandPalette}
          onClose={() => setShowCommandPalette(false)}
          user={user}
        />
      )}
    </>
  );
};
