/**
 * ProUI - Professional UI components inspired by Keka HR.
 *
 * Clean, professional components for a desktop-class HR application:
 * - ProButton: Clean buttons with multiple variants
 * - ProCard: Elevated cards with proper shadows
 * - StatusBadge: Professional status indicators
 * - Avatar: User avatars with fallback initials
 * - Divider: Clean section dividers
 */

import React, { ReactNode } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Image,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../theme/ThemeProvider";
import { useResponsive } from "../utils/responsive";

// ============================================================================
// ProButton - Professional button component
// ============================================================================

type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "success";
type ButtonSize = "sm" | "md" | "lg";

interface ProButtonProps {
  /** Button label */
  label: string;
  /** Called when button is pressed */
  onPress: () => void;
  /** Button variant */
  variant?: ButtonVariant;
  /** Button size */
  size?: ButtonSize;
  /** Left icon (alias: `icon`) */
  leftIcon?: keyof typeof Ionicons.glyphMap;
  /** Left icon — convenience alias for `leftIcon` */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Right icon */
  rightIcon?: keyof typeof Ionicons.glyphMap;
  /** Loading state */
  loading?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Full width button */
  fullWidth?: boolean;
  /** Extra container style */
  style?: ViewStyle;
}

export const ProButton = ({
  label,
  onPress,
  variant = "primary",
  size = "md",
  leftIcon,
  icon,
  rightIcon,
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
}: ProButtonProps) => {
  const { theme } = useTheme();
  const c = theme.colors;

  const sizeStyles = {
    sm: { paddingVertical: 8, paddingHorizontal: 14, fontSize: 13, iconSize: 14 },
    md: { paddingVertical: 10, paddingHorizontal: 18, fontSize: 14, iconSize: 16 },
    lg: { paddingVertical: 14, paddingHorizontal: 24, fontSize: 15, iconSize: 18 },
  };

  const getVariantStyles = () => {
    switch (variant) {
      case "primary":
        return {
          bg: c.accent,
          bgHover: c.accentText,
          text: "#ffffff",
          border: "transparent",
        };
      case "secondary":
        return {
          bg: c.surfaceMuted,
          bgHover: c.surfaceBorder,
          text: c.text,
          border: "transparent",
        };
      case "outline":
        return {
          bg: "transparent",
          bgHover: c.surfaceMuted,
          text: c.text,
          border: c.surfaceBorder,
        };
      case "ghost":
        return {
          bg: "transparent",
          bgHover: c.surfaceMuted,
          text: c.textMuted,
          border: "transparent",
        };
      case "danger":
        return {
          bg: c.dangerText,
          bgHover: "#b91c1c",
          text: "#ffffff",
          border: "transparent",
        };
      case "success":
        return {
          bg: c.successText,
          bgHover: "#15803d",
          text: "#ffffff",
          border: "transparent",
        };
    }
  };

  const vs = getVariantStyles();
  const ss = sizeStyles[size];
  const startIcon = leftIcon ?? icon;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ hovered, pressed }: any) => [
        styles.button,
        {
          paddingVertical: ss.paddingVertical,
          paddingHorizontal: ss.paddingHorizontal,
          backgroundColor: vs.bg,
          borderColor: vs.border,
          opacity: disabled ? 0.5 : 1,
        },
        fullWidth && { width: "100%" },
        Platform.OS === "web" && hovered && { backgroundColor: vs.bgHover },
        pressed && { opacity: 0.9 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={vs.text} />
      ) : (
        <>
          {startIcon && (
            <Ionicons
              name={startIcon}
              size={ss.iconSize}
              color={vs.text}
              style={{ marginRight: 8 }}
            />
          )}
          <Text style={[styles.buttonText, { fontSize: ss.fontSize, color: vs.text }]}>
            {label}
          </Text>
          {rightIcon && (
            <Ionicons
              name={rightIcon}
              size={ss.iconSize}
              color={vs.text}
              style={{ marginLeft: 8 }}
            />
          )}
        </>
      )}
    </Pressable>
  );
};

// ============================================================================
// ProCard - Professional card component
// ============================================================================

interface ProCardProps {
  children: ReactNode;
  /** Card padding */
  padding?: "none" | "sm" | "md" | "lg";
  /** Show border */
  bordered?: boolean;
  /** Clickable card */
  onPress?: () => void;
  /** Custom style */
  style?: ViewStyle;
  /** Header content */
  header?: ReactNode;
  /** Footer content */
  footer?: ReactNode;
}

export const ProCard = ({
  children,
  padding = "md",
  bordered = true,
  onPress,
  style,
  header,
  footer,
}: ProCardProps) => {
  const { theme } = useTheme();
  const c = theme.colors;
  const { isDesktop } = useResponsive();

  const paddingMap = {
    none: 0,
    sm: 12,
    md: isDesktop ? 20 : 16,
    lg: isDesktop ? 28 : 20,
  };

  const Wrapper = onPress ? Pressable : View;

  return (
    <Wrapper
      onPress={onPress}
      style={({ hovered, pressed }: any) => [
        styles.card,
        {
          backgroundColor: c.surface,
          borderColor: bordered ? c.surfaceBorder : "transparent",
        },
        Platform.OS === "web" && isDesktop && {
          boxShadow: theme.shadows.sm as any,
        },
        onPress && Platform.OS === "web" && hovered && {
          borderColor: c.accent,
          boxShadow: theme.shadows.md as any,
        },
        pressed && { opacity: 0.95 },
        style,
      ]}
    >
      {header && (
        <View
          style={[
            styles.cardHeader,
            {
              paddingHorizontal: paddingMap[padding],
              borderBottomColor: c.surfaceBorder,
            },
          ]}
        >
          {header}
        </View>
      )}

      <View style={{ padding: paddingMap[padding] }}>{children}</View>

      {footer && (
        <View
          style={[
            styles.cardFooter,
            {
              paddingHorizontal: paddingMap[padding],
              borderTopColor: c.surfaceBorder,
            },
          ]}
        >
          {footer}
        </View>
      )}
    </Wrapper>
  );
};

// ============================================================================
// StatusBadge - Professional status indicator
// ============================================================================

type StatusType =
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "neutral"
  | "accent"
  | "default";

interface StatusBadgeProps {
  /** Text shown in the badge. Falls back to `status` when omitted. */
  label?: string;
  /** Status text — used as the label when `label` is not provided. */
  status?: string;
  /** Color variant */
  variant?: StatusType;
  /** Show dot indicator */
  showDot?: boolean;
  /** Size variant */
  size?: "sm" | "md";
  /** Icon */
  icon?: keyof typeof Ionicons.glyphMap;
}

export const StatusBadge = ({
  label,
  status,
  variant = "neutral",
  showDot = false,
  size = "md",
  icon,
}: StatusBadgeProps) => {
  const { theme } = useTheme();
  const c = theme.colors;

  const text = label ?? status ?? "";

  const getStatusColors = () => {
    switch (variant) {
      case "success":
        return { bg: c.successBg, text: c.successText };
      case "warning":
        return { bg: c.warningBg, text: c.warningText };
      case "danger":
        return { bg: c.dangerBg, text: c.dangerText };
      case "info":
        return { bg: c.infoBg, text: c.infoText };
      case "accent":
        return { bg: c.accentSoft, text: c.accentText };
      default:
        return { bg: c.surfaceMuted, text: c.textMuted };
    }
  };

  const sc = getStatusColors();
  const isSmall = size === "sm";

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: sc.bg,
          paddingVertical: isSmall ? 3 : 5,
          paddingHorizontal: isSmall ? 8 : 10,
        },
      ]}
    >
      {showDot && (
        <View
          style={[
            styles.badgeDot,
            { backgroundColor: sc.text, width: isSmall ? 5 : 6, height: isSmall ? 5 : 6 },
          ]}
        />
      )}
      {icon && (
        <Ionicons
          name={icon}
          size={isSmall ? 12 : 14}
          color={sc.text}
          style={{ marginRight: 4 }}
        />
      )}
      <Text
        style={[
          styles.badgeText,
          { color: sc.text, fontSize: isSmall ? 11 : 12 },
        ]}
      >
        {text}
      </Text>
    </View>
  );
};

// ============================================================================
// Avatar - User avatar with fallback
// ============================================================================

interface AvatarProps {
  /** Image URL */
  src?: string | null;
  /** User name for initials fallback */
  name?: string;
  /** Avatar size — named preset or an explicit pixel diameter */
  size?: "xs" | "sm" | "md" | "lg" | "xl" | number;
  /** Background color */
  color?: string;
  /** Show online indicator */
  online?: boolean;
}

export const Avatar = ({
  src,
  name = "User",
  size = "md",
  color,
  online,
}: AvatarProps) => {
  const { theme } = useTheme();
  const c = theme.colors;

  const sizeMap = {
    xs: 24,
    sm: 32,
    md: 40,
    lg: 56,
    xl: 80,
  };

  const fontSizeMap = {
    xs: 10,
    sm: 12,
    md: 14,
    lg: 20,
    xl: 28,
  };

  const getInitials = () => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const s = typeof size === "number" ? size : sizeMap[size];
  const fs = typeof size === "number" ? Math.round(size * 0.4) : fontSizeMap[size];

  return (
    <View style={{ position: "relative" }}>
      <View
        style={[
          styles.avatar,
          {
            width: s,
            height: s,
            borderRadius: s / 2,
            backgroundColor: color || c.accent,
          },
        ]}
      >
        {src ? (
          <Image
            source={{ uri: src }}
            style={{ width: s, height: s, borderRadius: s / 2 }}
          />
        ) : (
          <Text style={[styles.avatarText, { fontSize: fs }]}>{getInitials()}</Text>
        )}
      </View>
      {online !== undefined && (
        <View
          style={[
            styles.onlineIndicator,
            {
              backgroundColor: online ? c.successText : c.textFaint,
              borderColor: c.surface,
              width: s / 4,
              height: s / 4,
              right: 0,
              bottom: 0,
            },
          ]}
        />
      )}
    </View>
  );
};

// ============================================================================
// AvatarGroup - Stack of avatars
// ============================================================================

interface AvatarGroupProps {
  /** List of avatars */
  avatars: Array<{ src?: string; name: string }>;
  /** Max avatars to show */
  max?: number;
  /** Size */
  size?: "sm" | "md";
}

export const AvatarGroup = ({ avatars, max = 4, size = "sm" }: AvatarGroupProps) => {
  const { theme } = useTheme();
  const c = theme.colors;
  const visible = avatars.slice(0, max);
  const remaining = avatars.length - max;

  const s = size === "sm" ? 28 : 36;
  const overlap = size === "sm" ? 10 : 12;

  return (
    <View style={{ flexDirection: "row" }}>
      {visible.map((a, i) => (
        <View
          key={i}
          style={{
            marginLeft: i === 0 ? 0 : -overlap,
            zIndex: visible.length - i,
          }}
        >
          <Avatar src={a.src} name={a.name} size={size} />
        </View>
      ))}
      {remaining > 0 && (
        <View
          style={[
            styles.avatar,
            {
              width: s,
              height: s,
              borderRadius: s / 2,
              backgroundColor: c.surfaceMuted,
              marginLeft: -overlap,
              borderWidth: 2,
              borderColor: c.surface,
            },
          ]}
        >
          <Text style={[styles.avatarText, { color: c.textMuted, fontSize: 11 }]}>
            +{remaining}
          </Text>
        </View>
      )}
    </View>
  );
};

// ============================================================================
// Divider - Section divider
// ============================================================================

interface DividerProps {
  /** Label in the middle */
  label?: string;
  /** Spacing */
  spacing?: "sm" | "md" | "lg";
}

export const Divider = ({ label, spacing = "md" }: DividerProps) => {
  const { theme } = useTheme();
  const c = theme.colors;

  const spacingMap = { sm: 12, md: 20, lg: 32 };

  if (label) {
    return (
      <View style={[styles.dividerWithLabel, { marginVertical: spacingMap[spacing] }]}>
        <View style={[styles.dividerLine, { backgroundColor: c.surfaceBorder }]} />
        <Text style={[styles.dividerLabel, { color: c.textMuted }]}>{label}</Text>
        <View style={[styles.dividerLine, { backgroundColor: c.surfaceBorder }]} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.divider,
        { backgroundColor: c.surfaceBorder, marginVertical: spacingMap[spacing] },
      ]}
    />
  );
};

// ============================================================================
// EmptyState - Professional empty state
// ============================================================================

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  action?: ReactNode;
}

export const EmptyState = ({
  icon = "document-outline",
  title,
  description,
  action,
}: EmptyStateProps) => {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: c.surfaceMuted }]}>
        <Ionicons name={icon} size={32} color={c.textMuted} />
      </View>
      <Text style={[styles.emptyTitle, { color: c.text }]}>{title}</Text>
      {description && (
        <Text style={[styles.emptyDescription, { color: c.textMuted }]}>
          {description}
        </Text>
      )}
      {action && <View style={styles.emptyAction}>{action}</View>}
    </View>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  // Button
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    ...(Platform.OS === "web" && {
      cursor: "pointer" as any,
      transition: "all 0.15s ease" as any,
    }),
  },
  buttonText: {
    fontWeight: "600",
  },

  // Card
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    ...(Platform.OS === "web" && {
      transition: "border-color 0.15s ease, box-shadow 0.15s ease" as any,
    }),
  },
  cardHeader: {
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  cardFooter: {
    paddingVertical: 16,
    borderTopWidth: 1,
  },

  // Badge
  badge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  badgeDot: {
    borderRadius: 999,
    marginRight: 6,
  },
  badgeText: {
    fontWeight: "600",
  },

  // Avatar
  avatar: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  onlineIndicator: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 2,
  },

  // Divider
  divider: {
    height: 1,
  },
  dividerWithLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerLabel: {
    fontSize: 12,
    fontWeight: "500",
  },

  // Empty state
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    textAlign: "center",
    maxWidth: 300,
    lineHeight: 20,
  },
  emptyAction: {
    marginTop: 20,
  },
});
