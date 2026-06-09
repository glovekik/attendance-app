// Central session/token store. Holds the access token (read by every
// screen before each request) and a long-lived refresh token, and knows
// how to silently swap an expired access token for a fresh one.
//
// Design notes:
//  - Screens read AsyncStorage("token") right before each API batch, so
//    keeping that key fresh keeps the whole app authenticated without a
//    fetch interceptor in every service.
//  - refreshSession() is single-flight: concurrent 401s trigger ONE
//    network refresh, and all callers await the same result.
//  - Everything degrades gracefully: if the backend hasn't shipped the
//    refresh endpoint yet (no refresh token stored, or /auth/refresh 401s),
//    refreshSession() resolves to null and the caller logs out as before.
import AsyncStorage from "@react-native-async-storage/async-storage";

import { refreshAccessToken, logoutApi } from "./api";

const TOKEN_KEY = "token";
const REFRESH_KEY = "refresh_token";

export const setSession = async (
  accessToken: string,
  refreshToken?: string | null
): Promise<void> => {
  await AsyncStorage.setItem(TOKEN_KEY, accessToken);
  if (refreshToken) await AsyncStorage.setItem(REFRESH_KEY, refreshToken);
};

export const getToken = (): Promise<string | null> =>
  AsyncStorage.getItem(TOKEN_KEY);

export const clearSession = async (): Promise<void> => {
  await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_KEY]);
};

// Explicit user logout: revoke the refresh token server-side (best-effort)
// so it can't be used to mint new access tokens, then clear local storage.
export const logoutSession = async (): Promise<void> => {
  try {
    const rt = await AsyncStorage.getItem(REFRESH_KEY);
    if (rt) await logoutApi(rt);
  } catch {
    // ignore — clear locally regardless
  }
  await clearSession();
};

// ── JWT expiry ──────────────────────────────────────────────────────────
// Decode a base64url segment to its raw string. Hermes ships atob; we still
// provide a manual fallback so this never throws on an odd runtime.
const decodeBase64Url = (input: string): string => {
  let b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  if (typeof atob === "function") return atob(b64);
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  let buffer = 0;
  let bits = 0;
  for (const ch of b64) {
    if (ch === "=") break;
    const idx = chars.indexOf(ch);
    if (idx === -1) continue;
    buffer = (buffer << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  return out;
};

// Returns the token's expiry in epoch-ms, or null if it can't be read.
export const getTokenExpiryMs = (token: string): number | null => {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const payload = JSON.parse(decodeBase64Url(part));
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
};

// ── Refresh ─────────────────────────────────────────────────────────────
let refreshInFlight: Promise<string | null> | null = null;

// Swap the stored refresh token for a fresh access token. Resolves to the
// new access token, or null if refresh isn't possible (no refresh token,
// or the server rejected it → the caller should log out).
export const refreshSession = (): Promise<string | null> => {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const rt = await AsyncStorage.getItem(REFRESH_KEY);
      if (!rt) return null;
      const res = await refreshAccessToken(rt);
      if (!res?.access_token) return null;
      // Backend may rotate the refresh token; keep the old one if it doesn't.
      await setSession(res.access_token, res.refresh_token ?? rt);
      return res.access_token;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
};

// Proactively refresh if the access token is within `thresholdMs` of
// expiring (or already expired). No-op when there's no token or the token
// has no decodable expiry. Called on launch, on app-foreground, and on a
// timer so the user never hits a hard 401 mid-session.
export const ensureFreshToken = async (
  thresholdMs = 120_000
): Promise<void> => {
  const token = await getToken();
  if (!token) return;
  const expMs = getTokenExpiryMs(token);
  if (expMs == null) return;
  if (expMs - Date.now() <= thresholdMs) {
    await refreshSession();
  }
};
