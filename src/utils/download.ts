import { Platform } from "react-native";

export const downloadPdfWithAuth = async (
  url: string,
  token: string,
  filename: string
): Promise<void> => {

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
  const FileSystem = require("expo-file-system");
  const Sharing = require("expo-sharing");

  const cacheDir =
    FileSystem.cacheDirectory || FileSystem.documentDirectory;
  const localPath = `${cacheDir}${filename}`;

  const result = await FileSystem.downloadAsync(url, localPath, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (result.status !== 200) {
    throw new Error(`Download failed (${result.status})`);
  }

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(result.uri, {
      mimeType: "application/pdf",
      dialogTitle: filename,
      UTI: "com.adobe.pdf",
    });
  }
};
