import * as Location from "expo-location";

// 🔥 Office coordinates (UPDATE if needed)
export const OFFICE = {
  latitude: 16.507020515758303,
  longitude: 80.62279856266548,
};

// 🔥 Radius (keep realistic)
export const ALLOWED_RADIUS = 200; // meters

export const getCurrentLocation = async () => {
  const { status } =
    await Location.requestForegroundPermissionsAsync();

  if (status !== "granted") {
    throw new Error("Permission denied");
  }

  const loc = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  return loc.coords;
};

// Best-effort reverse geocode → a human-readable single-line address.
// Returns "" when unavailable (e.g. web, no network, or no permission) so
// callers can fall back to raw coordinates without special-casing errors.
export const reverseGeocode = async (
  latitude: number,
  longitude: number
): Promise<string> => {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude, longitude });
    const p = results?.[0];
    if (!p) return "";
    const parts = [
      p.name,
      p.street,
      p.district,
      p.city,
      p.region,
      p.postalCode,
      p.country,
    ].filter((x): x is string => !!x && x.trim().length > 0);
    // De-dupe consecutive repeats (name often equals street) and cap length.
    const seen = new Set<string>();
    const cleaned = parts.filter((x) => {
      const k = x.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return cleaned.join(", ");
  } catch {
    return "";
  }
};

// Haversine formula
export const getDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) => {
  const R = 6371e3;

  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;

  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) *
      Math.cos(φ2) *
      Math.sin(Δλ / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};