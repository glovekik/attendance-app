import * as TaskManager from "expo-task-manager";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { classifyOffice } from "../utils/location";

import {
  isWithinOfficeHours,
  getTodayKey,
} from "../utils/time";

import { API_URL } from "../config";

const TASK_NAME = "AUTO_CHECKIN_TASK";

// 🔥 Keep runtime state
let insideSince: number | null = null;

TaskManager.defineTask(TASK_NAME, async ({ data, error }: any) => {
  if (error) {
    console.log("Task error:", error);
    return;
  }

  const { locations } = data;
  const loc = locations[0];

  const lat = loc.coords.latitude;
  const lon = loc.coords.longitude;

  // Same rule as the manual check-in button, so a background auto-check-in
  // and a tap on Check in can never disagree about where the office is.
  const fix = classifyOffice({
    latitude: lat,
    longitude: lon,
    accuracy:
      typeof loc.coords.accuracy === "number" ? loc.coords.accuracy : null,
  });

  const now = Date.now();

  // ❌ Outside → reset
  if (!fix.inside) {
    insideSince = null;
    return;
  }

  // ✅ First detection inside
  if (!insideSince) {
    insideSince = now;
    return;
  }

  // ⏱ Stability (30 sec)
  if (now - insideSince < 30000) return;

  // ⏰ Time window
  if (!isWithinOfficeHours()) return;

  // 🧠 Prevent duplicate
  const todayKey = getTodayKey();
  const lastCheck = await AsyncStorage.getItem("checkedInDate");

  if (lastCheck === todayKey) return;

  // 🔐 Token
  const token = await AsyncStorage.getItem("token");
  if (!token) return;

  try {
    await fetch(`${API_URL}/attendance/mark`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        latitude: lat,
        longitude: lon,
      }),
    });

    await AsyncStorage.setItem("checkedInDate", todayKey);

    // 🔔 Notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Checked In",
        body: "Auto check-in completed",
      },
      trigger: null,
    });

  } catch (err) {
    console.log("Auto check-in failed:", err);
  }
});