import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { apiCall } from "./http";

const isWeb = Platform.OS === "web";
const PUSH_TOKEN_KEY = "expo_push_token";

if (!isWeb) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export const requestNotificationPermission = async () => {

  if (isWeb) return false;

  const settings =
    await Notifications.getPermissionsAsync();

  let status = settings.status;

  if (status !== "granted") {
    const ask = await Notifications.requestPermissionsAsync();
    status = ask.status;
  }

  return status === "granted";
};

// Get the Expo push token for this device.
const getDevicePushToken =
  async (): Promise<string | null> => {

  if (isWeb) return null;

  try {
    const granted = await requestNotificationPermission();
    if (!granted) return null;

    const result =
      await Notifications.getExpoPushTokenAsync();

    return result.data || null;
  } catch (err) {
    console.log("Push token fetch failed:", err);
    return null;
  }
};

// Register the device with the backend after login.
export const registerPushToken = async (
  authToken: string
): Promise<void> => {

  if (isWeb) return;

  try {
    const pushToken = await getDevicePushToken();
    if (!pushToken) return;

    await apiCall("/auth/push-token", {
      method: "POST",
      body: {
        token: pushToken,
        platform: Platform.OS,
      },
      token: authToken,
    });

    await AsyncStorage.setItem(PUSH_TOKEN_KEY, pushToken);
  } catch (err) {
    console.log("Push token register failed:", err);
  }
};

// Unregister on logout (best-effort).
export const unregisterPushToken = async (
  authToken: string
): Promise<void> => {

  if (isWeb) return;

  try {
    const pushToken = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (!pushToken) return;

    await apiCall("/auth/push-token", {
      method: "DELETE",
      body: { token: pushToken },
      token: authToken,
    });

    await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
  } catch (err) {
    console.log("Push token unregister failed:", err);
  }
};

export const sendAttendanceNotification = async (
  title: string,
  body: string
) => {

  if (isWeb) return;

  await Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: null,
  });
};
