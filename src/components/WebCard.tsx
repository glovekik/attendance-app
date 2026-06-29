/**
 * WebCard - A card component with desktop hover effects.
 *
 * LEARNING POINT: Web-specific interactions
 * React Native Web supports Pressable with hover states via the
 * style callback function. This component provides:
 * - Hover state with subtle elevation/scale
 * - Press state with feedback
 * - Consistent styling across platforms
 *
 * Usage:
 *   <WebCard onPress={() => {}}>
 *     <Text>Card content</Text>
 *   </WebCard>
 */

import React, { ReactNode } from "react";
import {
  Pressable,
  View,
  StyleSheet,
  Platform,
  ViewStyle,
} from "react-native";

import { useTheme } from "../theme/ThemeProvider";

interface Props {
  children: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  /** Disable hover effects */
  noHover?: boolean;
  /** Card padding variant */
  padding?: "none" | "sm" | "md" | "lg";
}

export const WebCard = ({
  children,
  onPress,
  style,
  noHover = false,
  padding = "md",
}: Props) => {
  const { theme } = useTheme();
  const c = theme.colors;

  const paddingValue = {
    none: 0,
    sm: 12,
    md: 16,
    lg: 24,
  }[padding];

  const baseStyle: ViewStyle = {
    backgroundColor: c.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    padding: paddingValue,
    // Shadow
    shadowColor: c.shadow,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  };

  // For non-interactive cards
  if (!onPress) {
    return (
      <View style={[baseStyle, style]}>
        {children}
      </View>
    );
  }

  // For interactive cards with hover/press states
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered, pressed }: any) => [
        baseStyle,
        style,
        // Web hover state
        Platform.OS === "web" && !noHover && hovered && {
          transform: [{ scale: 1.01 }],
          shadowRadius: 20,
          shadowOpacity: 1.2,
          borderColor: c.accent,
        },
        // Press state
        pressed && {
          opacity: 0.9,
          transform: [{ scale: 0.99 }],
        },
      ]}
    >
      {children}
    </Pressable>
  );
};

/**
 * WebCardGrid - A responsive grid for cards.
 *
 * LEARNING POINT: Responsive grids
 * Uses flexWrap with calculated widths based on screen size.
 * On desktop, shows more columns; on mobile, fewer.
 */
interface GridProps {
  children: ReactNode;
  columns?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
  gap?: number;
  style?: ViewStyle;
}

export const WebCardGrid = ({
  children,
  columns = { mobile: 2, tablet: 3, desktop: 4 },
  gap = 12,
  style,
}: GridProps) => {
  return (
    <View
      style={[
        styles.grid,
        { gap },
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
});
