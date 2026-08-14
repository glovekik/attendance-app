import React from "react";
import {
  Modal,
  View,
  Image,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { mediaUrl } from "../utils/media";
import { ModalToastHost } from "./ModalToastHost";

/**
 * Full-screen image lightbox. Tap the backdrop or the close button to dismiss.
 * Reused for profile photos (and any avatar) so a picture can be maximized.
 */
export function FullScreenImage({
  uri,
  visible,
  onClose,
}: {
  uri?: string | null;
  visible: boolean;
  onClose: () => void;
}) {
  const src = uri ? mediaUrl(uri) : null;
  return (
    <Modal
      visible={visible && !!src}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        {/* Tap anywhere to dismiss. */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
        {src ? (
          <Image
            source={{ uri: src }}
            style={styles.image}
            resizeMode="contain"
          />
        ) : null}
        <TouchableOpacity
          style={styles.close}
          onPress={onClose}
          hitSlop={12}
        >
          <Ionicons name="close" size={26} color="#fff" />
        </TouchableOpacity>
      </View>
      <ModalToastHost />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.93)",
    alignItems: "center",
    justifyContent: "center",
  },
  image: { width: "100%", height: "82%" },
  close: {
    position: "absolute",
    top: Platform.OS === "web" ? 24 : 46,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
});
