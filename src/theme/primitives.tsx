import React from "react";

import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp,
  TextInputProps,
  ActivityIndicator,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "./ThemeProvider";

/**
 * Design-system primitives that consume the active theme. New screens
 * should compose these instead of building styled Views from scratch —
 * makes a future palette tweak a single-file change.
 */

// ============================== Themed text ==============================
export const ThemedText = ({
  variant = "body",
  tone = "primary",
  align,
  style,
  children,
  numberOfLines,
}: {
  variant?:
    | "h1"
    | "h2"
    | "h3"
    | "bodyLg"
    | "body"
    | "bodySm"
    | "caption";
  tone?: "primary" | "muted" | "faint" | "accent" | "inverse";
  align?: "left" | "center" | "right";
  style?: StyleProp<TextStyle>;
  children: React.ReactNode;
  numberOfLines?: number;
}) => {
  const { theme } = useTheme();
  const colorByTone: Record<string, string> = {
    primary: theme.colors.text,
    muted: theme.colors.textMuted,
    faint: theme.colors.textFaint,
    accent: theme.colors.accent,
    inverse: theme.colors.textInverse,
  };
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        theme.typography[variant],
        { color: colorByTone[tone] },
        align && { textAlign: align },
        style,
      ]}
    >
      {children}
    </Text>
  );
};

// ============================== Themed surfaces ==============================
export const Screen = ({
  children,
  padded = true,
  style,
}: {
  children: React.ReactNode;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}) => {
  const { theme } = useTheme();
  return (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: theme.colors.bg,
          paddingHorizontal: padded ? theme.spacing.lg : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

export const ThemedCard = ({
  children,
  variant = "default",
  style,
  onPress,
}: {
  children: React.ReactNode;
  variant?: "default" | "muted" | "accent";
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) => {
  const { theme } = useTheme();
  const bg =
    variant === "muted"
      ? theme.colors.surfaceMuted
      : variant === "accent"
      ? theme.colors.accentSoft
      : theme.colors.surface;
  const wrapStyle: StyleProp<ViewStyle> = [
    {
      backgroundColor: bg,
      borderRadius: theme.radii.lg,
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      shadowColor: theme.colors.shadow,
      shadowOpacity: theme.mode === "light" ? 1 : 0,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: theme.mode === "light" ? 2 : 0,
    },
    style,
  ];
  if (onPress) {
    return (
      <TouchableOpacity
        style={wrapStyle}
        onPress={onPress}
        activeOpacity={0.85}
      >
        {children}
      </TouchableOpacity>
    );
  }
  return <View style={wrapStyle}>{children}</View>;
};

// ============================== Pastel category tile ==============================
export const ThemedTile = ({
  icon,
  label,
  pastel = "lavender",
  onPress,
  count,
  description,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  pastel?:
    | "lavender"
    | "pink"
    | "peach"
    | "yellow"
    | "mint"
    | "sky";
  onPress: () => void;
  count?: number;
  description?: string;
}) => {
  const { theme } = useTheme();
  const pastelMap = {
    lavender: theme.colors.pastelLavender,
    pink: theme.colors.pastelPink,
    peach: theme.colors.pastelPeach,
    yellow: theme.colors.pastelYellow,
    mint: theme.colors.pastelMint,
    sky: theme.colors.pastelSky,
  };
  const iconColorMap: Record<string, string> = {
    lavender: "#7c3aed",
    pink: "#db2777",
    peach: "#ea580c",
    yellow: "#a16207",
    mint: "#15803d",
    sky: "#0369a1",
  };
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: theme.colors.surface,
        padding: theme.spacing.md,
        borderRadius: theme.radii.lg,
        borderWidth: 1,
        borderColor: theme.colors.surfaceBorder,
        gap: 12,
        shadowColor: theme.colors.shadow,
        shadowOpacity: theme.mode === "light" ? 1 : 0,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: theme.mode === "light" ? 1 : 0,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: theme.radii.md,
          backgroundColor: pastelMap[pastel],
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons
          name={icon}
          size={20}
          color={
            theme.mode === "light" ? iconColorMap[pastel] : theme.colors.text
          }
        />
      </View>
      <View style={{ flex: 1 }}>
        <ThemedText variant="bodyLg">{label}</ThemedText>
        {!!description && (
          <ThemedText variant="bodySm" tone="muted">
            {description}
          </ThemedText>
        )}
      </View>
      {typeof count === "number" && count > 0 && (
        <View
          style={{
            minWidth: 24,
            height: 24,
            borderRadius: 12,
            paddingHorizontal: 7,
            backgroundColor: theme.colors.dangerText,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontSize: 11,
              fontWeight: "800",
            }}
          >
            {count > 99 ? "99+" : count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// ============================== Pill / status chip ==============================
export const ThemedPill = ({
  label,
  tone = "muted",
}: {
  label: string;
  tone?: "muted" | "success" | "warning" | "danger" | "info" | "accent";
}) => {
  const { theme } = useTheme();
  const toneMap: Record<string, { bg: string; fg: string }> = {
    muted: {
      bg: theme.colors.surfaceMuted,
      fg: theme.colors.textMuted,
    },
    success: {
      bg: theme.colors.successBg,
      fg: theme.colors.successText,
    },
    warning: {
      bg: theme.colors.warningBg,
      fg: theme.colors.warningText,
    },
    danger: {
      bg: theme.colors.dangerBg,
      fg: theme.colors.dangerText,
    },
    info: {
      bg: theme.colors.infoBg,
      fg: theme.colors.infoText,
    },
    accent: {
      bg: theme.colors.accentSoft,
      fg: theme.colors.accentText,
    },
  };
  const t = toneMap[tone];
  return (
    <View
      style={{
        backgroundColor: t.bg,
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.xs,
        borderRadius: theme.radii.pill,
        alignSelf: "flex-start",
      }}
    >
      <Text
        style={{
          color: t.fg,
          fontSize: 11,
          fontWeight: "800",
          letterSpacing: 0.5,
        }}
      >
        {label}
      </Text>
    </View>
  );
};

// ============================== Button ==============================
export const ThemedButton = ({
  label,
  onPress,
  variant = "primary",
  loading,
  disabled,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
}) => {
  const { theme } = useTheme();
  const palette: Record<
    string,
    { bg: string; fg: string; border?: string }
  > = {
    primary: {
      bg: theme.colors.accent,
      fg: theme.colors.textInverse,
    },
    secondary: {
      bg: theme.colors.accentSoft,
      fg: theme.colors.accentText,
    },
    ghost: {
      bg: "transparent",
      fg: theme.colors.text,
      border: theme.colors.surfaceBorder,
    },
    danger: {
      bg: theme.colors.dangerText,
      fg: "#fff",
    },
  };
  const p = palette[variant];
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      disabled={loading || disabled}
      style={[
        {
          backgroundColor: p.bg,
          borderRadius: theme.radii.md,
          paddingVertical: 13,
          paddingHorizontal: theme.spacing.lg,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          borderWidth: p.border ? 1 : 0,
          borderColor: p.border,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={16} color={p.fg} />}
          <Text style={{ color: p.fg, fontSize: 14, fontWeight: "800" }}>
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

// ============================== Input ==============================
export const ThemedInput = (
  props: TextInputProps & {
    label?: string;
    hint?: string;
    error?: string;
  }
) => {
  const { theme } = useTheme();
  const { label, hint, error, style, ...rest } = props;
  return (
    <View>
      {!!label && (
        <Text
          style={{
            color: theme.colors.textMuted,
            fontSize: 11,
            fontWeight: "700",
            letterSpacing: 1,
            marginBottom: 6,
            marginTop: 8,
          }}
        >
          {label.toUpperCase()}
        </Text>
      )}
      <TextInput
        {...rest}
        placeholderTextColor={theme.colors.textFaint}
        style={[
          {
            backgroundColor: theme.colors.surface,
            color: theme.colors.text,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: 11,
            borderRadius: theme.radii.md,
            borderWidth: 1,
            borderColor: error
              ? theme.colors.dangerText
              : theme.colors.surfaceBorder,
            fontSize: 14,
          },
          style,
        ]}
      />
      {!!error ? (
        <Text
          style={{
            color: theme.colors.dangerText,
            fontSize: 11,
            marginTop: 4,
          }}
        >
          {error}
        </Text>
      ) : !!hint ? (
        <Text
          style={{
            color: theme.colors.textFaint,
            fontSize: 11,
            marginTop: 4,
          }}
        >
          {hint}
        </Text>
      ) : null}
    </View>
  );
};

// Helper for screens that need a thin divider line
export const ThemedDivider = ({
  style,
}: {
  style?: StyleProp<ViewStyle>;
}) => {
  const { theme } = useTheme();
  return (
    <View
      style={[
        {
          height: StyleSheet.hairlineWidth,
          backgroundColor: theme.colors.surfaceBorder,
          marginVertical: theme.spacing.md,
        },
        style,
      ]}
    />
  );
};
