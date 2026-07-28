import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { API_URL } from "../config";
import { notify } from "./confirm";

/**
 * Download an authenticated file (PDF/JPG/xlsx) from the API and save it.
 *
 * The download endpoints require a Bearer token, so a plain <a href> or
 * window.open won't work — we fetch with the token, then hand the browser a
 * blob to save. On native there's no filesystem save wired up yet, so we point
 * the user at the web app (these are the same "download on a computer" flows
 * the ID card / payslip already use).
 */
export async function downloadAuthedFile(
  path: string,
  fallbackName: string
): Promise<void> {
  if (Platform.OS !== "web" || typeof document === "undefined") {
    notify(
      "Open on a computer",
      "Download this from the web app to save the file."
    );
    return;
  }

  const token = await AsyncStorage.getItem("token");
  const res = await fetch(`${API_URL}${path}`, {
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

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
