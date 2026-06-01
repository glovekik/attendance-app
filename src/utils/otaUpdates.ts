import * as Updates from "expo-updates";

/**
 * Check for an EAS (OTA) update on launch and apply it.
 *
 * OTA is already configured (expo-updates + the updates URL/channels in
 * app.json + eas.json). By default expo-updates only downloads on launch
 * and applies on the NEXT launch — this makes a freshly published update
 * take effect on the current launch instead of one cold start later.
 *
 * No-op in dev (`__DEV__`) and when updates are disabled (e.g. Expo Go),
 * and fully best-effort: any failure (offline, timeout) is swallowed so a
 * flaky network never blocks app start — we just keep the current bundle.
 */
export const checkForOtaUpdate = async (): Promise<void> => {
  if (__DEV__ || !Updates.isEnabled) return;
  try {
    const res = await Updates.checkForUpdateAsync();
    if (res.isAvailable) {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    }
  } catch {
    // ignore — continue running the already-bundled version
  }
};
