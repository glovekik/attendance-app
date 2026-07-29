import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { notify, notifySuccess } from "./confirm";

/**
 * Native file saving for authenticated downloads (PDF / JPG / xlsx).
 *
 * Web has a real "download" via a blob + <a download>; native did not, so
 * files were either desktop-only or opened the share sheet with no way to keep
 * them. This saves straight to a device folder:
 *   - Android: Storage Access Framework — the user picks a folder once
 *     (e.g. Downloads); we remember it and write there every time after.
 *   - iOS: the share sheet, whose "Save to Files" is the OS save path.
 * If the folder pick is declined or SAF fails, we fall back to sharing so the
 * file is never lost.
 *
 * Uses only expo-file-system (legacy API, for StorageAccessFramework) and
 * expo-sharing — both already bundled, so no new native module is needed.
 */

const SAF_DIR_KEY = "android_save_dir_uri";

export function mimeForName(name: string): { mimeType: string; uti: string } {
  const ext = (name.split(".").pop() || "").toLowerCase();
  switch (ext) {
    case "pdf":
      return { mimeType: "application/pdf", uti: "com.adobe.pdf" };
    case "jpg":
    case "jpeg":
      return { mimeType: "image/jpeg", uti: "public.jpeg" };
    case "png":
      return { mimeType: "image/png", uti: "public.png" };
    case "xlsx":
      return {
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        uti: "org.openxmlformats.spreadsheetml.sheet",
      };
    default:
      return { mimeType: "application/octet-stream", uti: "public.data" };
  }
}

/** Download an (optionally authed) URL to a temp cache file; returns its uri. */
async function fetchToCache(
  url: string,
  filename: string,
  token?: string
): Promise<string> {
  const FS = require("expo-file-system/legacy");
  const safe = filename.replace(/[^\w.\-]+/g, "_");
  const dest = `${FS.cacheDirectory}${safe}`;
  const res = await FS.downloadAsync(url, dest, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (typeof res.status === "number" && res.status >= 400) {
    throw new Error(`Download failed (${res.status})`);
  }
  return res.uri;
}

async function shareLocal(
  uri: string,
  mimeType: string,
  uti: string,
  filename: string
): Promise<boolean> {
  const Sharing = require("expo-sharing");
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType, UTI: uti, dialogTitle: filename });
    return true;
  }
  return false;
}

/** Prompt for (or reuse) a device folder and write the file into it. */
async function saveViaSAF(
  localUri: string,
  filename: string,
  mimeType: string
): Promise<boolean> {
  const FS = require("expo-file-system/legacy");
  const SAF = FS.StorageAccessFramework;

  const writeInto = async (dirUri: string): Promise<void> => {
    const b64 = await FS.readAsStringAsync(localUri, {
      encoding: FS.EncodingType.Base64,
    });
    const target = await SAF.createFileAsync(dirUri, filename, mimeType);
    await FS.writeAsStringAsync(target, b64, {
      encoding: FS.EncodingType.Base64,
    });
  };

  const stored = await AsyncStorage.getItem(SAF_DIR_KEY);
  let dirUri: string;
  if (stored) {
    dirUri = stored;
  } else {
    const perm = await SAF.requestDirectoryPermissionsAsync();
    if (!perm.granted) return false;
    dirUri = perm.directoryUri;
    await AsyncStorage.setItem(SAF_DIR_KEY, dirUri);
  }

  try {
    await writeInto(dirUri);
    return true;
  } catch {
    // The remembered folder was revoked / removed — ask once more.
    await AsyncStorage.removeItem(SAF_DIR_KEY);
    const perm = await SAF.requestDirectoryPermissionsAsync();
    if (!perm.granted) return false;
    await AsyncStorage.setItem(SAF_DIR_KEY, perm.directoryUri);
    await writeInto(perm.directoryUri);
    return true;
  }
}

/** Save an already-downloaded local file to the device (Android SAF / iOS Files). */
export async function saveLocalToDevice(
  localUri: string,
  filename: string
): Promise<void> {
  const { mimeType, uti } = mimeForName(filename);

  if (Platform.OS === "android") {
    try {
      const saved = await saveViaSAF(localUri, filename, mimeType);
      if (saved) {
        notifySuccess("Saved to device", `${filename} saved to your folder.`);
        return;
      }
      // Folder declined → don't lose the file, offer share instead.
      await shareLocal(localUri, mimeType, uti, filename);
      return;
    } catch (e: any) {
      const shared = await shareLocal(localUri, mimeType, uti, filename);
      if (!shared) notify("Couldn't save", e?.message || "Please try again.");
      return;
    }
  }

  // iOS and everything else: the share sheet's "Save to Files" is the save path.
  const shared = await shareLocal(localUri, mimeType, uti, filename);
  if (!shared) notify("Saved", `${filename} is ready.`);
}

/** Authenticated download + save-to-device in one call (native). */
export async function downloadAndSave(
  url: string,
  filename: string,
  token?: string
): Promise<void> {
  const localUri = await fetchToCache(url, filename, token);
  await saveLocalToDevice(localUri, filename);
}
