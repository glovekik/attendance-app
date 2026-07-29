import { Platform } from "react-native";

interface DownloadOptions {
  mimeType?: string;
  uti?: string;
}

const downloadWithAuth = async (
  url: string,
  token: string,
  filename: string,
  opts: DownloadOptions = {}
): Promise<void> => {

  const mimeType = opts.mimeType || "application/pdf";
  const uti = opts.uti || "com.adobe.pdf";

  if (Platform.OS === "web") {

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new Error(`Download failed (${res.status})`);
    }

    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(blobUrl);
    return;
  }

  // Native — download (authed) then save to a device folder (Android SAF /
  // iOS Files), with a share fallback. See fileSave.ts. mimeType/uti are
  // derived from the filename extension there.
  void mimeType;
  void uti;
  const { downloadAndSave } = require("./fileSave");
  await downloadAndSave(url, filename, token);
};

export const downloadPdfWithAuth = (
  url: string,
  token: string,
  filename: string,
): Promise<void> => downloadWithAuth(url, token, filename);

export const downloadXlsxWithAuth = (
  url: string,
  token: string,
  filename: string,
): Promise<void> => downloadWithAuth(url, token, filename, {
  mimeType:
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  uti: "org.openxmlformats.spreadsheetml.sheet",
});
