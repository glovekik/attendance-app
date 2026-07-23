import React, { useState } from "react";

// Use React Native's Image (react-native-web renders it as a plain <img>) —
// it's the same path the profile screens use and loads reliably on web,
// whereas expo-image can silently fail to render cross-origin URLs on web.
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleProp,
  ViewStyle,
} from "react-native";

import { mediaUrl } from "../utils/media";
import { useTheme } from "../theme/ThemeProvider";
import { FullScreenImage } from "./FullScreenImage";

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
  /** When true, tapping the avatar (if it has a photo) opens it full-screen. */
  zoomable?: boolean;
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
  zoomable,
  style,
}: Props) => {
  const { theme } = useTheme();
  const c = theme.colors;
  const [zoomed, setZoomed] = useState(false);

  const resolved = mediaUrl(uri || undefined);
  const radius =
    borderRadius != null ? borderRadius : square ? Math.round(size * 0.28) : size / 2;
  const initial = (name || "").trim().charAt(0).toUpperCase() || "?";
  const canZoom = zoomable && !!resolved;

  const circle = (
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

  if (!canZoom) return circle;

  return (
    <>
      <TouchableOpacity activeOpacity={0.8} onPress={() => setZoomed(true)}>
        {circle}
      </TouchableOpacity>
      <FullScreenImage
        uri={uri}
        visible={zoomed}
        onClose={() => setZoomed(false)}
      />
    </>
  );
};
