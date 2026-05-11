import React, { useState } from "react";

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

import { uploadFile } from "../services/uploads";

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

interface Props {
  // Called with the uploaded URL on success.
  onUploaded: (url: string, fileName: string) => void;

  label?: string;
  // Restrict accepted MIME types (e.g. "image/*", "application/pdf").
  mimeType?: string | string[];
  // Compact mode — small icon-only button.
  compact?: boolean;
}

export const FilePickButton = ({
  onUploaded,
  label,
  mimeType,
  compact,
}: Props) => {
  const [uploading, setUploading] = useState(false);

  const onPress = async () => {
    if (uploading) return;
    const picker = await tryGetPicker();
    if (!picker) {
      Alert.alert(
        "File picker not installed",
        "Run this in the project root, then rebuild:\n\n" +
          "npx expo install expo-document-picker"
      );
      return;
    }
    try {
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
      const result = await uploadFile(token, {
        uri: file.uri,
        name: file.name,
        mimeType: file.mimeType,
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
        style={[styles.iconBtn, uploading && styles.iconBtnBusy]}
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
      style={[styles.btn, uploading && styles.btnBusy]}
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

const styles = StyleSheet.create({
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
