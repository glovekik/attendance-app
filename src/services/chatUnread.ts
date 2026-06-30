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
  // Pull the authoritative count from the server.
  refresh: async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const { count } = await getChatUnreadCount(token);
      chatUnreadStore.set(count || 0);
    } catch {
      /* badge just won't update — non-fatal */
    }
  },
};

/** Subscribe a component to the live unread count. */
export const useChatUnreadBadge = (): number => {
  const [n, setN] = useState(chatUnreadStore.get());
  useEffect(() => chatUnreadStore.subscribe(setN), []);
  return n;
};
