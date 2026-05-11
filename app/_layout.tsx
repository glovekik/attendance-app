import React, { useEffect } from "react";

import { Stack, useRouter } from "expo-router";

import { StatusBar } from "expo-status-bar";

import { Platform } from "react-native";

import * as Notifications from "expo-notifications";

import { ErrorBoundary } from "../src/components/ErrorBoundary";

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
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#0b1220" },
        }}
      />
    </ErrorBoundary>
  );
}
