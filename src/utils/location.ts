import { Platform } from "react-native";
import * as Location from "expo-location";

// 🔥 Office coordinates (UPDATE if needed)
export const OFFICE = {
  latitude: 17.421639,
  longitude: 78.460774,
};

// 🔥 Radius (keep realistic)
export const ALLOWED_RADIUS = 200; // meters

/**
 * How much of a fix's own uncertainty we're willing to forgive.
 *
 * A browser reports `accuracy` as the radius of a circle it believes the
 * device is somewhere inside. A laptop on office WiFi typically reports
 * 20–150m, and that circle straddling the geofence edge is the usual reason
 * someone sitting at their desk is told they're too far away. Forgiving the
 * reported uncertainty fixes that — but only up to a cap, because a fix that
 * claims to be accurate to 5km would otherwise let anyone check in from
 * anywhere. Past the cap we stop trusting it rather than stretching further.
 */
export const ACCURACY_ALLOWANCE = 150; // meters

/** Past this, the fix says so little that we'd rather ask than guess. */
export const UNRELIABLE_ACCURACY = 2000; // meters

/** A browser/device position reduced to what the geofence actually needs. */
export interface Coords {
  latitude: number;
  longitude: number;
  /** Radius of uncertainty in metres, or null when the platform won't say. */
  accuracy: number | null;
}

// Desktop fixes arrive in stages: the browser answers quickly from its WiFi
// cache, then refines. 20s is generous enough for a cold lookup without
// leaving someone staring at a spinner.
const WEB_TIMEOUT_MS = 20000;
// After the first fix, keep listening briefly for a better one.
const WEB_REFINE_MS = 6000;

/**
 * One browser position.
 *
 * Called directly rather than through expo-location because its web shim
 * passes `maximumAge: Infinity` (node_modules/expo-location/build/
 * ExpoLocation.web.js), which explicitly authorises the browser to return a
 * position of any age. On a laptop that means this morning's position at
 * home is a valid answer to "where are you now" — the single biggest cause
 * of someone at their desk being marked too far from the office. Its
 * permission probe also throws outright on browsers without
 * navigator.permissions, which would fail check-in rather than prompt.
 */
const webPosition = (options: PositionOptions) =>
  new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });

const fromWeb = (p: GeolocationPosition): Coords => ({
  latitude: p.coords.latitude,
  longitude: p.coords.longitude,
  accuracy:
    typeof p.coords.accuracy === "number" && isFinite(p.coords.accuracy)
      ? p.coords.accuracy
      : null,
});

/** Human-readable reason a browser refused, with what to do about it. */
const webError = (err: GeolocationPositionError): Error => {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return new Error(
        "Location is blocked for this site. Click the padlock in the " +
          "address bar, set Location to Allow, then reload."
      );
    case err.POSITION_UNAVAILABLE:
      return new Error(
        "Your browser couldn't determine a location. Check that location " +
          "services are on for your operating system, then try again."
      );
    case err.TIMEOUT:
      return new Error(
        "Finding your location took too long. Try again, or switch to WFH " +
          "if you're remote."
      );
    default:
      return new Error(err.message || "Could not get your location.");
  }
};

/**
 * Listen a little longer for a tighter fix.
 *
 * The first answer on a desktop is often the browser's cached WiFi estimate;
 * a better one frequently follows a second or two later. Returns the best
 * fix seen, or the one we started with. Never rejects — a failed refinement
 * just means we keep what we already had.
 */
const refineOnWeb = (best: Coords): Promise<Coords> =>
  new Promise((resolve) => {
    // Already tight enough to decide with — don't make the user wait.
    if (best.accuracy != null && best.accuracy <= ACCURACY_ALLOWANCE) {
      resolve(best);
      return;
    }

    let current = best;
    let settled = false;
    let watchId: number | null = null;

    const finish = () => {
      if (settled) return;
      settled = true;
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      resolve(current);
    };

    const timer = setTimeout(finish, WEB_REFINE_MS);

    try {
      watchId = navigator.geolocation.watchPosition(
        (p) => {
          const next = fromWeb(p);
          const better =
            current.accuracy == null ||
            (next.accuracy != null && next.accuracy < current.accuracy);
          if (better) current = next;
          // Good enough — stop early rather than burning the full window.
          if (next.accuracy != null && next.accuracy <= ACCURACY_ALLOWANCE) {
            clearTimeout(timer);
            finish();
          }
        },
        () => {
          // A refinement error is not a failure; we still have `best`.
          clearTimeout(timer);
          finish();
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: WEB_REFINE_MS }
      );
    } catch {
      clearTimeout(timer);
      finish();
    }
  });

export const getCurrentLocation = async (): Promise<Coords> => {
  if (Platform.OS === "web") {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      throw new Error("This browser doesn't support location.");
    }
    // Browsers only expose geolocation over HTTPS (localhost excepted).
    // Without this check the failure surfaces as a bare PERMISSION_DENIED,
    // which sends people into their browser settings for a problem that
    // isn't there.
    if (
      typeof window !== "undefined" &&
      window.isSecureContext === false
    ) {
      throw new Error(
        "Location needs a secure (https) connection. Open the app over " +
          "https and try again."
      );
    }

    let first: GeolocationPosition;
    try {
      first = await webPosition({
        enableHighAccuracy: true,
        // The fix that matters is the one from now, not from wherever this
        // laptop was last opened.
        maximumAge: 0,
        timeout: WEB_TIMEOUT_MS,
      });
    } catch (err: any) {
      throw webError(err as GeolocationPositionError);
    }
    return refineOnWeb(fromWeb(first));
  }

  // Native: unchanged. expo-location's defaults are correct here, and the
  // OS permission prompt is the one users expect.
  const { status } = await Location.requestForegroundPermissionsAsync();

  if (status !== "granted") {
    throw new Error("Permission denied");
  }

  const loc = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  return {
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    accuracy:
      typeof loc.coords.accuracy === "number" ? loc.coords.accuracy : null,
  };
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

/** What a fix means for the office geofence. */
export interface OfficeFix {
  /** Metres from the office to the reported point. */
  distance: number;
  accuracy: number | null;
  /** Inside the geofence, allowing for the fix's own uncertainty. */
  inside: boolean;
  /** False when the fix is too vague to decide either way. */
  reliable: boolean;
}

/**
 * Decide whether a position counts as being at the office.
 *
 * The reported point is the centre of a circle of uncertainty, not a pin.
 * Someone is inside if that circle reaches the geofence — which is what
 * stops a desk-bound laptop with a 120m fix from being told it's too far —
 * with the allowance capped at ACCURACY_ALLOWANCE so vagueness can't be
 * used as a way in from across town.
 */
export const classifyOffice = (coords: Coords): OfficeFix => {
  const distance = getDistance(
    coords.latitude,
    coords.longitude,
    OFFICE.latitude,
    OFFICE.longitude
  );
  const accuracy = coords.accuracy;
  const reliable = accuracy == null || accuracy <= UNRELIABLE_ACCURACY;
  const allowance = Math.min(accuracy ?? 0, ACCURACY_ALLOWANCE);

  return {
    distance,
    accuracy,
    reliable,
    inside: reliable && distance - allowance <= ALLOWED_RADIUS,
  };
};

/** Why a fix was rejected, phrased for the person reading it. */
export const officeRejectionMessage = (fix: OfficeFix): string => {
  if (!fix.reliable) {
    return (
      `Your location is only accurate to about ${Math.round(
        fix.accuracy ?? 0
      )}m, which isn't precise enough to confirm you're at the office. ` +
      "Turn on WiFi (it sharpens the fix), or switch to WFH if you're remote."
    );
  }
  return `You're ${Math.round(
    fix.distance
  )}m away. Switch to WFH if you're remote.`;
};
