import React from "react";

// Use React Native's Image (react-native-web renders it as a plain <img>) —
// it's the same path the profile screens use and loads reliably on web,
// whereas expo-image can silently fail to render cross-origin URLs on web.
import { View, Text, Image, StyleProp, ViewStyle } from "react-native";

import { mediaUrl } from "../utils/media";
import { useTheme } from "../theme/ThemeProvider";

interface Props {
  /** Display name — its first letter is the fallback when there's no photo. */
  name?: string | null;
  /** Profile picture URL (relative or absolute); resolved via mediaUrl(). */
  uri?: string | null;
  /** Diameter in px (square side). Defaults to 40. */
  size?: number;
  /** Override the initials font size (defaults to ~42% of size). */
  fontSize?: number;
  /** Background for the initials circle (defaults to theme accentSoft). */
  bg?: string;
  /** Initials text colour (defaults to theme accentText). */
  fg?: string;
  /** Rounded-square instead of a full circle. */
  square?: boolean;
  /** Explicit border radius (wins over `square`/circle default). */
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * One avatar for the whole app: shows the person's profile photo when present,
 * and falls back to their first initial otherwise. Centralising this is what
 * makes an uploaded photo appear consistently everywhere (chat, attendance,
 * teams, lists) instead of only on the profile screens.
 */
export const Avatar = ({
  name,
  uri,
  size = 40,
  fontSize,
  bg,
  fg,
  square,
  borderRadius,
  style,
}: Props) => {
  const { theme } = useTheme();
  const c = theme.colors;

  const resolved = mediaUrl(uri || undefined);
  const radius =
    borderRadius != null ? borderRadius : square ? Math.round(size * 0.28) : size / 2;
  const initial = (name || "").trim().charAt(0).toUpperCase() || "?";

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: bg || c.accentSoft,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        },
        style,
      ]}
    >
      {resolved ? (
        <Image
          source={{ uri: resolved }}
          style={{ width: size, height: size }}
          resizeMode="cover"
        />
      ) : (
        <Text
          style={{
            color: fg || c.accentText,
            fontWeight: "800",
            fontSize: fontSize ?? Math.round(size * 0.42),
          }}
        >
          {initial}
        </Text>
      )}
    </View>
  );
};
