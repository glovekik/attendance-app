import { API_URL } from "../config";
import { ApiError } from "./http";
import type { UploadResult } from "../types";

export interface UploadFileInput {
  uri: string;
  name: string;
  mimeType?: string;
}

// Multipart upload — fetch handles FormData natively on RN.
// On Expo / React Native, files are passed as { uri, name, type }.
export const uploadFile = async (
  token: string,
  file: UploadFileInput
): Promise<UploadResult> => {
  const form = new FormData();
  form.append("file", {
    // RN FormData expects this shape; cast keeps TS happy.
    uri: file.uri,
    name: file.name,
    type: file.mimeType || "application/octet-stream",
  } as any);

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
