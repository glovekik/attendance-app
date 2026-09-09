/**
 * Shared chat-unread badge store.
 *
 * The unread count is shown in several places at once — the bottom tab bar,
 * the desktop sidebar, and (live) the dashboard. Previously each fetched
 * independently and nothing told them when the user had READ the chat, so
 * the badge kept its old number after viewing. This module is a single
 * source of truth: opening the chat sets it to 0 immediately, and the nav
 * components refresh it on navigation. All subscribers update together.
 */
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getChatUnreadCount } from "./chat";

let _count = 0;
const _listeners = new Set<(n: number) => void>();

/** Shortest gap between two server reads of the badge count. */
const MIN_REFRESH_MS = 15_000;
let _lastFetchedAt = 0;
let _inFlight: Promise<void> | null = null;

const _emit = () => {
  _listeners.forEach((l) => l(_count));
};

export const chatUnreadStore = {
  get: () => _count,
  set: (n: number) => {
    const v = Math.max(0, Math.floor(n) || 0);
    if (v === _count) return;
    _count = v;
    _emit();
  },
  subscribe: (fn: (n: number) => void) => {
    _listeners.add(fn);
    return () => {
      _listeners.delete(fn);
    };
  },
  /**
   * Pull the authoritative count from the server.
   *
   * Called from a pathname effect in the nav, so it fires on every single
   * navigation — and the nav re-mounts constantly on web. Two guards keep
   * that from turning into a request per screen change:
   *
   *   - in-flight sharing: concurrent callers await the same request rather
   *     than each opening their own,
   *   - a minimum interval: navigating six screens in ten seconds asks the
   *     server once, not six times.
   *
   * `force` skips the interval — used when the count is known to have just
   * changed (opening a chat marks it read), where staleness is the whole
   * problem being solved.
   */
  refresh: async (opts?: { force?: boolean }) => {
    const now = Date.now();
    if (!opts?.force && now - _lastFetchedAt < MIN_REFRESH_MS) return;
    if (_inFlight) return _inFlight;

    _inFlight = (async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        if (!token) return;
        const { count } = await getChatUnreadCount(token);
        _lastFetchedAt = Date.now();
        chatUnreadStore.set(count || 0);
      } catch {
        /* badge just won't update — non-fatal */
      } finally {
        _inFlight = null;
      }
    })();
    return _inFlight;
  },

  /** Drop throttle state — call on logout so the next session starts clean. */
  reset: () => {
    _count = 0;
    _lastFetchedAt = 0;
    _inFlight = null;
  },
};

/** Subscribe a component to the live unread count. */
export const useChatUnreadBadge = (): number => {
  const [n, setN] = useState(chatUnreadStore.get());
  useEffect(() => chatUnreadStore.subscribe(setN), []);
  return n;
};
