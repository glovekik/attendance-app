import { Alert, AlertButton, AlertOptions, Platform } from "react-native";
import Toast from "react-native-toast-message";

/**
 * Monkey-patches Alert.alert so that informational pop-ups (no buttons
 * array, or a single OK button) render as a themed toast instead of the
 * dated Material Design dialog Android ships by default.
 *
 * The destructive / multi-choice variant — `Alert.alert(title, msg,
 * [{text: 'Cancel'}, {text: 'Delete', ...}])` — still uses the native
 * dialog so we don't break the "are you sure?" flows.
 *
 * Imported for side-effects from app/_layout.tsx so it runs once at
 * app boot. Web is a no-op because react-native-web's Alert doesn't
 * surface anything visible anyway — confirm.ts handles web fallbacks.
 */

if (Platform.OS !== "web") {
  const originalAlert = Alert.alert.bind(Alert);

  // The .alert signature is overloaded; we accept the broadest form.
  Alert.alert = function patchedAlert(
    title: string,
    message?: string,
    buttons?: AlertButton[],
    options?: AlertOptions
  ): void {
    // If the caller passed buttons that include any non-default style
    // (cancel/destructive) or multiple buttons, treat it as a real
    // confirm and fall through to the native dialog. A lone "OK" button
    // is treated as informational and routed to toast.
    const isConfirm =
      Array.isArray(buttons) &&
      (buttons.length > 1 ||
        buttons.some((b) => b.style === "cancel" || b.style === "destructive"));

    if (isConfirm) {
      return originalAlert(title, message, buttons, options);
    }

    // Pick a tone from common error words — error variant gets the red
    // accent + longer visibility, otherwise neutral info.
    const lower = (title || "").toLowerCase();
    const isError =
      lower.includes("fail") ||
      lower.includes("error") ||
      lower.includes("couldn't") ||
      lower.includes("can't") ||
      lower.includes("invalid") ||
      lower.includes("denied");

    Toast.show({
      type: isError ? "error" : "info",
      text1: title,
      text2: message,
      position: "top",
      visibilityTime: isError ? 4000 : 3000,
    });

    // If there's a single button with an onPress (e.g. "OK -> navigate"),
    // invoke it after a beat so the toast has a moment to render.
    if (Array.isArray(buttons) && buttons.length === 1) {
      const onPress = buttons[0].onPress;
      if (onPress) setTimeout(() => onPress(), 150);
    }
  };
}

export {};
