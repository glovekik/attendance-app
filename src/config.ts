import Constants from "expo-constants";

const fromExtras =
  (Constants.expoConfig?.extra as any)?.apiUrl;

export const API_URL: string =
  fromExtras || "http://localhost:8000";
