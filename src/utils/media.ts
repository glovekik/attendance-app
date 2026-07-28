import { Platform, Linking } from "react-native";

import { API_URL } from "../config";

/**
 * Resolve a possibly-relative media URL into an absolute one the native
 * <Image> / Linking layer can actually load.
 *
 * The backend returns upload URLs as "/static/uploads/<key>" (relative) unless
 * PUBLIC_BASE_URL is configured. A scheme-less path renders as a broken box on
 * mobile and 404s on web, so anything that isn't already absolute gets the API
 * origin prefixed. Absolute (http/https/data/blob/file) URLs pass through.
 */
export const mediaUrl = (u?: string | null): string | undefined => {
  if (!u) return undefined;
  if (/^(https?:|data:|blob:|file:)/i.test(u)) return u;
  return `${API_URL}${u.startsWith("/") ? "" : "/"}${u}`;
};

/**
 * Open an uploaded file (document, image, …) for viewing/download.
 *
 * Resolves the URL to absolute first, then opens it WITHOUT going through
 * expo-router. On web, Linking.openURL / a relative path gets intercepted by
 * the router and lands on the "unmatched route" screen, so use window.open
 * there and Linking only on native. Returns false if there's no usable URL.
 */
export const openMedia = (u?: string | null): boolean => {
  const uri = mediaUrl(u);
  if (!uri) return false;
  if (Platform.OS === "web") {
    try {
      window.open(uri, "_blank", "noopener");
      return true;
    } catch {
      /* fall through to Linking */
    }
  }
  Linking.openURL(uri).catch(() => {});
  return true;
};

/**
 * Open a location on Google Maps. Prefers exact coordinates (a pin), falling
 * back to an address search. Used to show where a client-site check-in
 * happened straight from the attendance view. Returns false if there's
 * nothing to open.
 */
export const openMaps = (
  latitude?: number | null,
  longitude?: number | null,
  address?: string | null
): boolean => {
  let url: string | null = null;
  if (typeof latitude === "number" && typeof longitude === "number") {
    url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  } else if (address && address.trim()) {
    url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      address.trim()
    )}`;
  }
  if (!url) return false;
  if (Platform.OS === "web") {
    try {
      window.open(url, "_blank", "noopener");
      return true;
    } catch {
      /* fall through to Linking */
    }
  }
  Linking.openURL(url).catch(() => {});
  return true;
};
