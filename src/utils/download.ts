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

  // Native — needs expo-file-system + expo-sharing
  const { File, Paths } = require("expo-file-system");
  const Sharing = require("expo-sharing");

  const destination = new File(Paths.cache, filename);

  // Throws on failure; `idempotent` overwrites a stale cached copy.
  const result = await File.downloadFileAsync(url, destination, {
    headers: { Authorization: `Bearer ${token}` },
    idempotent: true,
  });

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(result.uri, {
      mimeType,
      dialogTitle: filename,
      UTI: uti,
    });
  }
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
