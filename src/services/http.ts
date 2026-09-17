import { Platform } from "react-native";

import { API_URL } from "../config";
import { refreshSession, clearSession } from "./session";

/**
 * Called once when a session is proven dead. Wipes the stored tokens and
 * sends the user to /login.
 *
 * The router isn't importable here (this module is imported by services the
 * router itself pulls in, so it would cycle), hence the injected navigator —
 * set once from the root layout. Without it we still clear the tokens and,
 * on web, fall back to a hard location change; the next screen that reads a
 * token then finds none and redirects itself.
 */
let navigateToLogin: (() => void) | null = null;
export const setSessionExpiredHandler = (fn: () => void) => {
  navigateToLogin = fn;
};

let expiring: Promise<void> | null = null;

/** Clear the session and go to /login. Safe to call repeatedly. */
export const endDeadSession = (): Promise<void> => onSessionExpired();

const onSessionExpired = (): Promise<void> => {
  // Single-flight: a screen firing six parallel requests must not trigger
  // six logouts and six navigations.
  if (expiring) return expiring;
  expiring = (async () => {
    try {
      await clearSession();
      if (navigateToLogin) {
        navigateToLogin();
      } else if (Platform.OS === "web" && typeof window !== "undefined") {
        window.location.assign("/login");
      }
    } finally {
      // Let a genuinely new session fail again later.
      setTimeout(() => {
        expiring = null;
      }, 1500);
    }
  })();
  return expiring;
};

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface Options {
  method?: Method;
  body?: any;
  token?: string;
}

export class ApiError extends Error {
  status: number;
  data: any;
  constructor(message: string, status: number, data: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export const apiCall = async <T = any>(
  path: string,
  opts: Options = {}
): Promise<T> => {

  const { method = "GET", body, token } = opts;

  const doFetch = (authToken?: string) => {
    const headers: Record<string, string> = {};
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }
    return fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let res = await doFetch(token);

  // Reactive refresh: a 401 on an authenticated request means the access
  // token expired mid-session. Silently swap it for a fresh one (single-
  // flight, so concurrent 401s share one refresh) and retry ONCE.
  if (res.status === 401 && token) {
    const outcome = await refreshSession();

    if (outcome.status === "refreshed") {
      res = await doFetch(outcome.token);
      // A brand-new access token still refused: the session really is over
      // (deleted user, a token minted against a different database). End it
      // here rather than throwing an error every screen renders as its own
      // dead end — that's how you get "Could not load profile." with no way
      // forward but a manual reload.
      if (res.status === 401) await onSessionExpired();
    } else if (outcome.status === "dead") {
      await onSessionExpired();
    }
    // "unavailable" — we never got an answer about this session, so we don't
    // get to end it. The 401 falls through as an ordinary error and the user
    // stays signed in; the next request, once the network is back, succeeds.
  }

  let data: any = null;

  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new ApiError(
      data?.detail ||
      data?.message ||
      `Request failed (${res.status})`,
      res.status,
      data
    );
  }

  return data as T;
};
