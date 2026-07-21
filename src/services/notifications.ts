import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { apiCall } from "./http";

const isWeb = Platform.OS === "web";
const PUSH_TOKEN_KEY = "expo_push_token";
export const ANDROID_CHANNEL_ID = "default";
// Separate channels so check-in and check-out reminders feel different —
// Android ties sound + vibration to the channel, so distinct vibration
// patterns here let users tell the two nudges apart without looking.
export const CHECKIN_CHANNEL_ID = "checkin";
export const CHECKOUT_CHANNEL_ID = "checkout";

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
    // Check-in: two firm buzzes — a "start your day" feel.
    await Notifications.setNotificationChannelAsync(CHECKIN_CHANNEL_ID, {
      name: "Check-in reminders",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 400, 200, 400],
      lightColor: "#16a34a",
    });
    // Check-out: three short pulses — clearly different from check-in.
    await Notifications.setNotificationChannelAsync(CHECKOUT_CHANNEL_ID, {
      name: "Check-out reminders",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 150, 100, 150, 100, 150],
      lightColor: "#dc2626",
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

// Get this device's push token.
//
// Android → the NATIVE FCM registration token (direct FCM; the backend sends
// via FCM HTTP v1). Requires google-services.json, which app.json wires in.
// iOS / other → the Expo token (Expo relays to APNs; iOS's native token is an
// APNs token that FCM v1 can't target directly). The backend routes by token
// shape — ExponentPushToken[...] → Expo, everything else → FCM.
const getDevicePushToken =
  async (): Promise<string | null> => {

  if (isWeb) return null;

  try {
    const granted = await requestNotificationPermission();
    if (!granted) return null;

    await ensureAndroidChannel();

    if (Platform.OS === "android") {
      try {
        const dev = await Notifications.getDevicePushTokenAsync();
        if (dev?.data && typeof dev.data === "string") {
          // Dev-only: loud, easy-to-grep log so you can copy the raw FCM
          // registration token from logcat for a Firebase test send.
          if (__DEV__) {
            console.log("\n========== FCM DEVICE TOKEN (paste into Firebase test) ==========");
            console.log(dev.data);
            console.log("=================================================================\n");
          }
          return dev.data;
        }
      } catch (err) {
        // Fall back to Expo if the native FCM token isn't available (e.g.
        // Expo Go, or google-services.json missing in this build).
        console.log("Native FCM token unavailable, falling back to Expo:", err);
      }
    }

    // In a dev/standalone build (not Expo Go), getExpoPushTokenAsync needs
    // the EAS projectId explicitly — otherwise it throws "No projectId
    // found" and no token is ever registered.
    const projectId =
      (Constants?.expoConfig as any)?.extra?.eas?.projectId ??
      (Constants as any)?.easConfig?.projectId;

    const result = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );

    if (__DEV__) {
      console.log("\n========== EXPO PUSH TOKEN (native FCM unavailable — using Expo) ==========");
      console.log(result.data);
      console.log("==========================================================================\n");
    }

    return result.data || null;
  } catch (err) {
    console.log("Push token fetch failed:", err);
    return null;
  }
};

// Dev-only: fetch + log this device's push token WITHOUT needing to log in,
// so you can grab the FCM registration token from the console for a Firebase
// test send. No-op in production builds. Safe to call on every launch.
export const logDeviceTokenForDev = async (): Promise<void> => {
  if (isWeb || !__DEV__) return;
  try {
    await getDevicePushToken(); // logs the token (see getDevicePushToken)
  } catch {
    /* getDevicePushToken already logs its own failures */
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
