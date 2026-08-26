import { Platform } from "react-native";

/**
 * Whether `Animated` may hand an animation to the native driver.
 *
 * react-native-web has no native animated module, so every animation started
 * with `useNativeDriver: true` logs a multi-hundred-line warning — "Animated:
 * `useNativeDriver` is not supported because the native animated module is
 * missing" plus a full React stack — and then silently falls back to the JS
 * driver anyway. On the login screen (card entrance + AnimatedSplash) that
 * fired nine times before the page had even rendered, burying real errors in
 * the console.
 *
 * Native keeps the native driver, which is where it actually buys anything:
 * the animation runs on the UI thread and survives a busy JS thread. On web
 * everything is the JS driver regardless, so asking for it only produces
 * noise. Safe for opacity and transform — the only properties the native
 * driver supports, and all this app animates.
 */
export const USE_NATIVE_DRIVER = Platform.OS !== "web";
