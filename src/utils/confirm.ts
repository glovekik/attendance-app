import { Alert, Platform } from "react-native";
import Toast from "react-native-toast-message";

/**
 * Cross-platform confirmation prompt.
 *
 * Why this exists: React Native's `Alert.alert` is a silent no-op on
 * React Native Web — clicking a "Delete?" button on the browser build
 * just does nothing because the native modal never appears, so the
 * `onPress` for the destructive action never fires.
 *
 * This helper:
 *   - on web → window.confirm()
 *   - on native → Alert.alert with Cancel + destructive action
 * The returned promise resolves true if the user confirmed.
 *
 * Usage:
 *   if (await confirmAction({ title: "Delete?", message: "Sure?" })) {
 *     ...
 *   }
 */
export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

export const confirmAction = ({
  title,
  message,
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  destructive = false,
}: ConfirmOptions): Promise<boolean> => {
  return new Promise((resolve) => {
    if (Platform.OS === "web") {
      if (typeof window === "undefined") {
        resolve(false);
        return;
      }
      const body = message ? `${title}\n\n${message}` : title;
      resolve(window.confirm(body));
      return;
    }
    Alert.alert(title, message, [
      {
        text: cancelLabel,
        style: "cancel",
        onPress: () => resolve(false),
      },
      {
        text: confirmLabel,
        style: destructive ? "destructive" : "default",
        onPress: () => resolve(true),
      },
    ]);
  });
};

/**
 * Cross-platform informational notification. Renders a themed slide-in
 * toast on native (replaces the dated Material Alert dialog), and falls
 * back to window.alert on web (where Toast doesn't auto-mount cleanly
 * inside react-native-web's portal).
 *
 * Tone is inferred from the title — anything mentioning "fail",
 * "error", or "couldn't" routes to the red error toast; everything else
 * uses the neutral info style. Callers wanting an explicit success
 * toast should use `notifySuccess` instead.
 */
export const notify = (title: string, message?: string) => {
  if (Platform.OS === "web") {
    if (typeof window === "undefined") return;
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  const lower = title.toLowerCase();
  const isError =
    lower.includes("fail") ||
    lower.includes("error") ||
    lower.includes("couldn't") ||
    lower.includes("can't") ||
    lower.includes("invalid");
  Toast.show({
    type: isError ? "error" : "info",
    text1: title,
    text2: message,
    position: "top",
    visibilityTime: isError ? 4000 : 3000,
  });
};

/** Explicit success toast — green check + 2.5s visibility. */
export const notifySuccess = (title: string, message?: string) => {
  if (Platform.OS === "web") {
    if (typeof window === "undefined") return;
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Toast.show({
    type: "success",
    text1: title,
    text2: message,
    position: "top",
    visibilityTime: 2500,
  });
};

/**
 * Cross-platform "ask for a single line of text" prompt. Returns the
 * entered value, or null if cancelled / empty.
 *
 * Native: Alert.prompt is iOS-only — Android has no equivalent built in.
 * To keep one API across platforms we use `window.prompt` on web and on
 * iOS, but fall back to a passed `androidPromptHandler` (a modal the
 * caller renders) elsewhere. For the simple termination-reason case the
 * caller can opt into a render-a-modal flow if Android support matters;
 * for now this helper just supports web + iOS — Android users get
 * `null` and the caller can decide what to do.
 */
export const promptForText = (
  title: string,
  message?: string,
  defaultValue: string = ""
): Promise<string | null> => {
  return new Promise((resolve) => {
    if (Platform.OS === "web") {
      if (typeof window === "undefined") {
        resolve(null);
        return;
      }
      const body = message ? `${title}\n\n${message}` : title;
      const v = window.prompt(body, defaultValue);
      resolve(v === null ? null : v.trim() || null);
      return;
    }
    if (Platform.OS === "ios" && (Alert as any).prompt) {
      (Alert as any).prompt(
        title,
        message,
        (text: string) => resolve(text?.trim() || null),
        "plain-text",
        defaultValue
      );
      return;
    }
    // Android — Alert.prompt isn't available. Caller should render its
    // own input modal; this just resolves null so they can detect it.
    resolve(null);
  });
};
