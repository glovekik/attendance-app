import { Platform } from "react-native";

import { API_URL } from "../config";
import { ApiError } from "./http";
import type { UploadResult } from "../types";

export interface UploadFileInput {
  uri: string;
  name: string;
  mimeType?: string;
  // Web only: when expo-document-picker hands us a real File/Blob,
  // pass it through so we can append it directly without re-fetching
  // the (potentially expired) blob: URL.
  webFile?: Blob | File;
}

// Multipart upload. Two platform paths because RN and web have
// incompatible FormData conventions:
//
//   RN: append({ uri, name, type }) — the bridge reads from `uri` and
//       streams the actual bytes. Works on iOS + Android.
//   Web: that same object is just stringified to "[object Object]" and
//       FastAPI returns 422 with no file field. We must append a real
//       Blob/File. expo-document-picker exposes one as `assets[i].file`;
//       if the caller didn't pass it we fetch the blob: URI ourselves.
export const uploadFile = async (
  token: string,
  file: UploadFileInput
): Promise<UploadResult> => {
  const form = new FormData();

  if (Platform.OS === "web") {
    let blob: Blob | undefined = file.webFile;
    if (!blob) {
      // Fall back to fetching the picker's blob URI. Works for
      // blob:/data:/http(s): URIs in the browser.
      try {
        const resp = await fetch(file.uri);
        blob = await resp.blob();
      } catch (err: any) {
        throw new ApiError(
          err?.message || "Could not read picked file",
          0,
          null
        );
      }
    }
    // Wrap in a File so the multipart part carries a filename + type.
    const finalFile =
      typeof File !== "undefined" && blob instanceof Blob
        ? new File([blob], file.name, {
            type: file.mimeType || blob.type || "application/octet-stream" })
        : blob;
    form.append("file", finalFile as any, file.name);
  } else {
    form.append("file", {
      uri: file.uri,
      name: file.name,
      type: file.mimeType || "application/octet-stream",
    } as any);
  }

  const res = await fetch(`${API_URL}/uploads`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new ApiError(
      data?.detail || data?.message || `Upload failed (${res.status})`,
      res.status,
      data
    );
  }
  return data as UploadResult;
};
