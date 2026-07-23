import React, { useState, useMemo} from "react";

import {
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleProp,
  ViewStyle,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

import { uploadFile } from "../services/uploads";

import { useTheme } from "../theme/ThemeProvider";
// Lazy import keeps the build alive if expo-document-picker isn't
// installed yet — the user gets a friendly install hint at runtime.
const tryGetPicker = async () => {
  try {
    // @ts-ignore — module is optional until user runs `npx expo install expo-document-picker`
    const mod = await import("expo-document-picker");
    return mod as any;
  } catch {
    return null;
  }
};

// Image picker (has the built-in cropper via allowsEditing) — used for
// profile photos so the user can crop before uploading.
const tryGetImagePicker = async () => {
  try {
    // @ts-ignore — optional until `npx expo install expo-image-picker`
    const mod = await import("expo-image-picker");
    return mod as any;
  } catch {
    return null;
  }
};

interface Props {
  // Called with the uploaded URL on success.
  onUploaded: (url: string, fileName: string) => void;

  label?: string;
  // Restrict accepted MIME types (e.g. "image/*", "application/pdf").
  mimeType?: string | string[];
  // Open the image cropper (expo-image-picker's editor) instead of the plain
  // file picker — for profile photos. `aspect` defaults to a square [1,1].
  crop?: boolean;
  aspect?: [number, number];
  // Compact mode — small icon-only button.
  compact?: boolean;
  // Override container styles (e.g. to stretch the button to fill a
  // parent row instead of the default alignSelf:'flex-start').
  style?: StyleProp<ViewStyle>;
}

export const FilePickButton = ({
  onUploaded,
  label,
  mimeType,
  crop,
  aspect,
  compact,
  style,
}: Props) => {
  const [uploading, setUploading] = useState(false);
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);

  const onPress = async () => {
    if (uploading) return;
    try {
      // CROP path — pick + crop an image with expo-image-picker's editor.
      // (Native shows a crop UI; web has no native cropper so it just picks.)
      if (crop) {
        const ip = await tryGetImagePicker();
        if (ip) {
          const perm = await ip.requestMediaLibraryPermissionsAsync?.();
          if (perm && perm.granted === false) {
            Alert.alert(
              "Permission needed",
              "Allow photo access to choose and crop a picture."
            );
            return;
          }
          const res = await ip.launchImageLibraryAsync({
            mediaTypes: ip.MediaTypeOptions ? ip.MediaTypeOptions.Images : ["images"],
            allowsEditing: true, // ← the built-in cropper
            aspect: aspect || [1, 1],
            quality: 0.85,
          });
          if (res.canceled) return;
          const asset = res.assets?.[0];
          if (!asset) return;

          setUploading(true);
          const token = await AsyncStorage.getItem("token");
          if (!token) {
            Alert.alert("Not signed in");
            return;
          }
          const webFile: any =
            (asset as any).file && typeof File !== "undefined"
              ? (asset as any).file
              : undefined;
          const result = await uploadFile(token, {
            uri: asset.uri,
            name: asset.fileName || `photo-${Date.now()}.jpg`,
            mimeType: asset.mimeType || "image/jpeg",
            webFile,
          });
          onUploaded(result.url, result.fileName);
          return;
        }
        // image-picker unavailable → fall through to the document picker
      }

      const picker = await tryGetPicker();
      if (!picker) {
        Alert.alert(
          "File picker not installed",
          "Run this in the project root, then rebuild:\n\n" +
            "npx expo install expo-document-picker"
        );
        return;
      }
      const res = await picker.getDocumentAsync({
        type: mimeType || "*/*",
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled) return;
      const file = res.assets?.[0];
      if (!file) return;

      setUploading(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Not signed in");
        return;
      }
      // expo-document-picker on web exposes the real File on
      // `file.file` — forward it so uploadFile doesn't have to re-fetch
      // a blob: URL that may already be revoked.
      const webFile: any =
        (file as any).file && typeof File !== "undefined"
          ? (file as any).file
          : undefined;
      const result = await uploadFile(token, {
        uri: file.uri,
        name: file.name,
        mimeType: file.mimeType,
        webFile,
      });
      onUploaded(result.url, result.fileName);
    } catch (err: any) {
      Alert.alert("Upload failed", err?.message || "");
    } finally {
      setUploading(false);
    }
  };

  if (compact) {
    return (
      <TouchableOpacity
        style={[styles.iconBtn, uploading && styles.iconBtnBusy, style]}
        onPress={onPress}
        disabled={uploading}
      >
        {uploading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Ionicons name="attach" size={20} color="#fff" />
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.btn, uploading && styles.btnBusy, style]}
      onPress={onPress}
      disabled={uploading}
    >
      {uploading ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <Ionicons name="cloud-upload-outline" size={16} color="#fff" />
      )}
      <Text style={styles.btnText}>
        {uploading ? "Uploading…" : label || "Pick file"}
      </Text>
    </TouchableOpacity>
  );
};

const makeStyles = (c: any) => StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3b82f6",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
    alignSelf: "flex-start",
  },
  btnBusy: { opacity: 0.7 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  iconBtn: {
    width: 44,
    height: 44,
    backgroundColor: "#3b82f6",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnBusy: { opacity: 0.7 },
});
