import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { ToastConfig, ToastConfigParams } from "react-native-toast-message";

/**
 * Theme-aware toast UIs registered with <Toast config={toastConfig(colors)} />
 * in app/_layout.tsx. We define three types:
 *   - success → green accent + checkmark
 *   - error   → red accent + alert icon
 *   - info    → accent color + info icon (default for notify())
 *
 * Each card uses the active theme's surface/text colors so the toast
 * doesn't look out of place in either light or dark mode. The card is
 * tall enough to fit a title + optional message without truncation, and
 * caps body text at 3 lines to keep things readable.
 */

type Tone = {
  bg: string;
  border: string;
  iconBg: string;
  iconFg: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const renderCard =
  (colors: any, tone: Tone) =>
  (props: ToastConfigParams<any>) => {
    const { text1, text2 } = props;
    return (
      <View
        style={[
          styles.card,
          { backgroundColor: tone.bg, borderColor: tone.border },
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: tone.iconBg }]}>
          <Ionicons name={tone.icon} size={18} color={tone.iconFg} />
        </View>
        <View style={{ flex: 1 }}>
          {!!text1 && (
            <Text
              style={[styles.title, { color: colors.text }]}
              numberOfLines={2}
            >
              {text1}
            </Text>
          )}
          {!!text2 && (
            <Text
              style={[styles.message, { color: colors.textMuted }]}
              numberOfLines={3}
            >
              {text2}
            </Text>
          )}
        </View>
      </View>
    );
  };

export const toastConfig = (colors: any): ToastConfig => ({
  success: renderCard(colors, {
    bg: colors.surface,
    border: "rgba(22,163,74,0.35)",
    iconBg: "rgba(22,163,74,0.15)",
    iconFg: "#16a34a",
    icon: "checkmark-circle",
  }),
  error: renderCard(colors, {
    bg: colors.surface,
    border: "rgba(239,68,68,0.35)",
    iconBg: "rgba(239,68,68,0.15)",
    iconFg: "#ef4444",
    icon: "alert-circle",
  }),
  info: renderCard(colors, {
    bg: colors.surface,
    border: colors.surfaceBorder,
    iconBg: "rgba(96,165,250,0.15)",
    iconFg: "#60a5fa",
    icon: "information-circle",
  }),
});

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    width: "92%",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    // Subtle elevation so the toast floats over content without a heavy
    // drop-shadow that competes with the bottom-tab shadow.
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  title: { fontSize: 14, fontWeight: "700" },
  message: { fontSize: 12, marginTop: 2, lineHeight: 17 },
});
