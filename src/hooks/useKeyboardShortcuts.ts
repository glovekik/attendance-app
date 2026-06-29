/**
 * useKeyboardShortcuts - Keyboard navigation for web.
 *
 * LEARNING POINT: Web-only keyboard shortcuts
 * React Native Web supports adding keyboard event listeners.
 * This hook provides global keyboard shortcuts for navigation.
 *
 * Default shortcuts:
 * - Cmd/Ctrl + K: Open command palette (if enabled)
 * - Cmd/Ctrl + /: Show keyboard shortcuts help
 * - G then H: Go to Home
 * - G then A: Go to Attendance
 * - G then T: Go to Tasks
 * - G then P: Go to Profile
 * - Escape: Close modals/go back
 *
 * Usage:
 *   useKeyboardShortcuts({
 *     onCommandPalette: () => setShowPalette(true),
 *   });
 */

import { useEffect, useRef, useCallback } from "react";
import { Platform } from "react-native";
import { useRouter } from "expo-router";

interface ShortcutHandlers {
  /** Called when Cmd/Ctrl+K is pressed */
  onCommandPalette?: () => void;
  /** Called when Escape is pressed */
  onEscape?: () => void;
  /** Called when Cmd/Ctrl+/ is pressed (show help) */
  onShowHelp?: () => void;
  /** Disable all navigation shortcuts */
  disableNavigation?: boolean;
}

// Vim-style "g" prefix for navigation
type GotoKey = "h" | "a" | "t" | "p" | "c" | "l" | "r" | "m";

const GOTO_ROUTES: Record<GotoKey, string> = {
  h: "/",           // Home
  a: "/attendance", // Attendance
  t: "/tasks",      // Tasks
  p: "/profile",    // Profile
  c: "/chat/office",// Chat
  l: "/leaves",     // Leaves
  r: "/hr-reports", // Reports
  m: "/manager",    // Manager console
};

export const useKeyboardShortcuts = ({
  onCommandPalette,
  onEscape,
  onShowHelp,
  disableNavigation = false,
}: ShortcutHandlers = {}) => {
  const router = useRouter();
  const gPressedRef = useRef(false);
  const gTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const { key, metaKey, ctrlKey, shiftKey } = event;
      const cmdOrCtrl = metaKey || ctrlKey;

      // Ignore if typing in an input
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        // Still allow Escape in inputs
        if (key === "Escape" && onEscape) {
          onEscape();
        }
        return;
      }

      // Cmd/Ctrl + K: Command palette
      if (cmdOrCtrl && key.toLowerCase() === "k") {
        event.preventDefault();
        onCommandPalette?.();
        return;
      }

      // Cmd/Ctrl + /: Show help
      if (cmdOrCtrl && key === "/") {
        event.preventDefault();
        onShowHelp?.();
        return;
      }

      // Escape: Close/back
      if (key === "Escape") {
        event.preventDefault();
        onEscape?.();
        return;
      }

      // Navigation shortcuts (if not disabled)
      if (disableNavigation) return;

      // "G" prefix for goto commands
      if (key.toLowerCase() === "g" && !cmdOrCtrl && !shiftKey) {
        gPressedRef.current = true;
        // Reset after 1 second
        if (gTimeoutRef.current) clearTimeout(gTimeoutRef.current);
        gTimeoutRef.current = setTimeout(() => {
          gPressedRef.current = false;
        }, 1000);
        return;
      }

      // Handle G + key navigation
      if (gPressedRef.current) {
        const lowerKey = key.toLowerCase() as GotoKey;
        if (GOTO_ROUTES[lowerKey]) {
          event.preventDefault();
          router.push(GOTO_ROUTES[lowerKey] as any);
          gPressedRef.current = false;
          if (gTimeoutRef.current) clearTimeout(gTimeoutRef.current);
        }
        return;
      }
    },
    [router, onCommandPalette, onEscape, onShowHelp, disableNavigation]
  );

  useEffect(() => {
    // Only add listeners on web
    if (Platform.OS !== "web") return;

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (gTimeoutRef.current) clearTimeout(gTimeoutRef.current);
    };
  }, [handleKeyDown]);
};

/**
 * Keyboard shortcuts reference for display in help modal.
 */
export const KEYBOARD_SHORTCUTS = [
  { keys: ["Cmd", "K"], description: "Open command palette" },
  { keys: ["Cmd", "/"], description: "Show keyboard shortcuts" },
  { keys: ["Esc"], description: "Close / Go back" },
  { keys: ["G", "H"], description: "Go to Home" },
  { keys: ["G", "A"], description: "Go to Attendance" },
  { keys: ["G", "T"], description: "Go to Tasks" },
  { keys: ["G", "P"], description: "Go to Profile" },
  { keys: ["G", "C"], description: "Go to Chat" },
  { keys: ["G", "L"], description: "Go to Leaves" },
];
