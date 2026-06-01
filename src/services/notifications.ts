import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { apiCall } from "./http";

const isWeb = Platform.OS === "web";
const PUSH_TOKEN_KEY = "expo_push_token";
export const ANDROID_CHANNEL_ID = "default";

if (!isWeb) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      // shouldShowAlert was deprecated in SDK 51 in favour of these two
      // explicit flags. Keep it set as well so older SDKs still respect it.
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

// On Android a notification channel must exist for notifications to show
// (and to surface as heads-up). Expo's auto-created channel uses default
// importance, which can suppress the banner; create an explicit high-
// importance channel so pushes actually pop. Safe to call repeatedly.
const ensureAndroidChannel = async () => {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: "Default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#2563eb",
    });
  } catch (err) {
    console.log("Android channel setup failed:", err);
  }
};

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

    await ensureAndroidChannel();

    // In a dev/standalone build (not Expo Go), getExpoPushTokenAsync needs
    // the EAS projectId explicitly — otherwise it throws "No projectId
    // found" and no token is ever registered. Resolve it from the Expo
    // config (app.json → extra.eas.projectId).
    const projectId =
      (Constants?.expoConfig as any)?.extra?.eas?.projectId ??
      (Constants as any)?.easConfig?.projectId;

    const result = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );

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
