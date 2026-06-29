/**
 * Tooltip - A web-only tooltip component for desktop hover hints.
 *
 * LEARNING POINT: Web-specific hover tooltips
 * On desktop, tooltips provide contextual information on hover.
 * This component uses CSS positioning and transitions for smooth display.
 * On mobile (where hover doesn't exist), it renders nothing.
 *
 * Features:
 * - Multiple positions: top, bottom, left, right
 * - Smooth fade-in animation
 * - Theme-aware styling
 * - Automatic arrow pointing to trigger element
 *
 * Usage:
 *   <Tooltip content="Edit this item" position="top">
 *     <Pressable onPress={handleEdit}>
 *       <Ionicons name="pencil" />
 *     </Pressable>
 *   </Tooltip>
 */

import React, { useState, useRef, useCallback, ReactNode } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";

import { useTheme } from "../theme/ThemeProvider";

type Position = "top" | "bottom" | "left" | "right";

interface Props {
  /** Content to display in tooltip */
  content: string | ReactNode;
  /** Position relative to child element */
  position?: Position;
  /** Child element that triggers tooltip on hover */
  children: ReactNode;
  /** Delay before showing tooltip in ms (default: 200) */
  delay?: number;
  /** Maximum width of tooltip (default: 200) */
  maxWidth?: number;
  /** Disable the tooltip */
  disabled?: boolean;
}

export const Tooltip = ({
  content,
  position = "top",
  children,
  delay = 200,
  maxWidth = 200,
  disabled = false,
}: Props) => {
  const { theme } = useTheme();
  const c = theme.colors;
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // No-op on non-web platforms
  if (Platform.OS !== "web") {
    return <>{children}</>;
  }

  const handleMouseEnter = useCallback(() => {
    if (disabled) return;
    timeoutRef.current = setTimeout(() => {
      setVisible(true);
    }, delay);
  }, [delay, disabled]);

  const handleMouseLeave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setVisible(false);
  }, []);

  // Position-specific styles
  const getPositionStyles = (): object => {
    const base = {
      position: "absolute" as const,
      zIndex: 9999,
    };

    switch (position) {
      case "top":
        return {
          ...base,
          bottom: "100%",
          left: "50%",
          transform: [{ translateX: "-50%" as any }],
          marginBottom: 8,
        };
      case "bottom":
        return {
          ...base,
          top: "100%",
          left: "50%",
          transform: [{ translateX: "-50%" as any }],
          marginTop: 8,
        };
      case "left":
        return {
          ...base,
          right: "100%",
          top: "50%",
          transform: [{ translateY: "-50%" as any }],
          marginRight: 8,
        };
      case "right":
        return {
          ...base,
          left: "100%",
          top: "50%",
          transform: [{ translateY: "-50%" as any }],
          marginLeft: 8,
        };
    }
  };

  // Arrow position styles
  const getArrowStyles = (): object => {
    const arrowSize = 6;
    const base = {
      position: "absolute" as const,
      width: 0,
      height: 0,
      borderStyle: "solid" as const,
    };

    switch (position) {
      case "top":
        return {
          ...base,
          bottom: -arrowSize,
          left: "50%",
          marginLeft: -arrowSize,
          borderWidth: arrowSize,
          borderColor: `${c.bgElevated} transparent transparent transparent`,
        };
      case "bottom":
        return {
          ...base,
          top: -arrowSize,
          left: "50%",
          marginLeft: -arrowSize,
          borderWidth: arrowSize,
          borderColor: `transparent transparent ${c.bgElevated} transparent`,
        };
      case "left":
        return {
          ...base,
          right: -arrowSize,
          top: "50%",
          marginTop: -arrowSize,
          borderWidth: arrowSize,
          borderColor: `transparent transparent transparent ${c.bgElevated}`,
        };
      case "right":
        return {
          ...base,
          left: -arrowSize,
          top: "50%",
          marginTop: -arrowSize,
          borderWidth: arrowSize,
          borderColor: `transparent ${c.bgElevated} transparent transparent`,
        };
    }
  };

  return (
    <View
      style={styles.container}
      // @ts-ignore - web-only events
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}

      {visible && (
        <View
          style={[
            styles.tooltip,
            getPositionStyles(),
            {
              backgroundColor: c.bgElevated,
              maxWidth,
            },
          ]}
        >
          {typeof content === "string" ? (
            <Text style={[styles.text, { color: c.text }]}>{content}</Text>
          ) : (
            content
          )}
          <View style={getArrowStyles()} />
        </View>
      )}
    </View>
  );
};

/**
 * IconTooltip - A convenience wrapper for icon buttons with tooltips.
 */
interface IconTooltipProps {
  icon: ReactNode;
  tooltip: string;
  position?: Position;
}

export const IconTooltip = ({
  icon,
  tooltip,
  position = "top",
}: IconTooltipProps) => {
  return (
    <Tooltip content={tooltip} position={position}>
      <View style={styles.iconWrapper}>{icon}</View>
    </Tooltip>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  tooltip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    ...(Platform.OS === "web" && {
      boxShadow: "0 2px 8px rgba(0,0,0,0.15)" as any,
      animation: "fadeIn 0.15s ease" as any,
    }),
  },
  text: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
  },
  iconWrapper: {
    padding: 4,
  },
});
