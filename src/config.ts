import Constants from "expo-constants";

const fromEnv =
  (typeof process !== "undefined" &&
    (process.env.EXPO_PUBLIC_API_URL as string | undefined)) ||
  undefined;

const fromExtras =
  (Constants.expoConfig?.extra as any)?.apiUrl;

export const API_URL: string =
  fromEnv || fromExtras || "http://localhost:8000";

// One-time log so it's obvious which backend the JS bundle is actually
// pointing at. Check the dev console after a clean restart.
if (__DEV__) {
  console.log("[config] API_URL =", API_URL);
}
