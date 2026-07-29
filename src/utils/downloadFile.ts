import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { API_URL } from "../config";
import { downloadAndSave } from "./fileSave";

/**
 * Download an authenticated file (PDF/JPG/xlsx) from the API and save it.
 *
 * The download endpoints require a Bearer token, so a plain <a href> or
 * window.open won't work.
 *   - Web: fetch with the token, hand the browser a blob to save.
 *   - Native: download with the token, then save to a device folder
 *     (Android Storage Access Framework / iOS Files) — see fileSave.ts.
 */
export async function downloadAuthedFile(
  path: string,
  fallbackName: string
): Promise<void> {
  const token = await AsyncStorage.getItem("token");
  const url = `${API_URL}${path}`;

  if (Platform.OS === "web" && typeof document !== "undefined") {
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) {
      let msg = "Download failed.";
      try {
        msg = (await res.json())?.detail || msg;
      } catch {
        /* non-JSON error body */
      }
      throw new Error(msg);
    }

    const blob = await res.blob();
    const cd = res.headers.get("Content-Disposition") || "";
    const m = /filename="?([^"]+)"?/.exec(cd);
    const name = m?.[1] || fallbackName;

    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    return;
  }

  // Native: download (authed) then save to the device.
  await downloadAndSave(url, fallbackName, token || undefined);
}
