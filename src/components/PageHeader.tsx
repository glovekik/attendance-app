/**
 * PageHeader - A responsive page header with breadcrumbs.
 *
 * LEARNING POINT: Desktop Navigation Context
 * On desktop web, users benefit from breadcrumb navigation to understand
 * their location in the app hierarchy. This component provides:
 * - Breadcrumb trail (desktop only)
 * - Page title
 * - Optional actions area
 * - Back button (mobile)
 *
 * Usage:
 *   <PageHeader
 *     title="Leave Requests"
 *     breadcrumbs={[
 *       { label: "Home", href: "/" },
 *       { label: "HR Admin", href: "/hr-admin" },
 *       { label: "Leave Requests" },
 *     ]}
 *     actions={<Button title="New Request" onPress={...} />}
 *   />
 */

import React, { ReactNode } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../theme/ThemeProvider";
import { useResponsive } from "../utils/responsive";

export interface Breadcrumb {
  label: string;
  href?: string;
}

interface Props {
  /** Page title */
  title: string;
  /** Breadcrumb trail - last item is current page (no href needed) */
  breadcrumbs?: Breadcrumb[];
  /** Optional subtitle/description */
  subtitle?: string;
  /** Actions to display on the right (buttons, etc.) */
  actions?: ReactNode;
  /** Show back button on mobile (default: true) */
  showBackButton?: boolean;
  /** Custom back handler */
  onBack?: () => void;
}

export const PageHeader = ({
  title,
  breadcrumbs,
  subtitle,
  actions,
  showBackButton = true,
  onBack,
}: Props) => {
  const { theme } = useTheme();
  const { isDesktop, showSidebar } = useResponsive();
  const router = useRouter();
  const c = theme.colors;

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  return (
    <View style={[styles.container, { borderBottomColor: c.surfaceBorder }]}>
      {/* Breadcrumbs - Desktop only */}
      {isDesktop && breadcrumbs && breadcrumbs.length > 0 && (
        <View style={styles.breadcrumbs}>
          {breadcrumbs.map((crumb, index) => (
            <View key={index} style={styles.breadcrumbItem}>
              {index > 0 && (
                <Ionicons
                  name="chevron-forward"
                  size={12}
                  color={c.textFaint}
                  style={styles.breadcrumbSeparator}
                />
              )}
              {crumb.href ? (
                <Pressable
                  onPress={() => router.push(crumb.href as any)}
                  style={({ hovered }: any) => [
                    styles.breadcrumbLink,
                    hovered && { textDecorationLine: "underline" as any },
                  ]}
                >
                  <Text
                    style={[styles.breadcrumbText, { color: c.textMuted }]}
                  >
                    {crumb.label}
                  </Text>
                </Pressable>
              ) : (
                <Text style={[styles.breadcrumbText, { color: c.text }]}>
                  {crumb.label}
                </Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Title Row */}
      <View style={styles.titleRow}>
        {/* Back button - Mobile only when no sidebar */}
        {!showSidebar && showBackButton && (
          <Pressable
            onPress={handleBack}
            style={({ pressed }: any) => [
              styles.backButton,
              { backgroundColor: c.surfaceMuted },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Ionicons name="arrow-back" size={20} color={c.text} />
          </Pressable>
        )}

        {/* Title & Subtitle */}
        <View style={styles.titleContent}>
          <Text style={[styles.title, { color: c.text }]}>{title}</Text>
          {subtitle && (
            <Text style={[styles.subtitle, { color: c.textMuted }]}>
              {subtitle}
            </Text>
          )}
        </View>

        {/* Actions */}
        {actions && <View style={styles.actions}>{actions}</View>}
      </View>
    </View>
  );
};

/**
 * Compact header variant for sub-pages or modals.
 */
export const PageHeaderCompact = ({
  title,
  onBack,
  actions,
}: {
  title: string;
  onBack?: () => void;
  actions?: ReactNode;
}) => {
  const { theme } = useTheme();
  const router = useRouter();
  const c = theme.colors;

  return (
    <View
      style={[
        styles.compactContainer,
        {
          backgroundColor: c.surface,
          borderBottomColor: c.surfaceBorder,
        },
      ]}
    >
      <Pressable
        onPress={onBack ?? router.back}
        style={({ pressed }: any) => [
          styles.compactBack,
          pressed && { opacity: 0.7 },
        ]}
      >
        <Ionicons name="arrow-back" size={22} color={c.text} />
      </Pressable>
      <Text
        style={[styles.compactTitle, { color: c.text }]}
        numberOfLines={1}
      >
        {title}
      </Text>
      <View style={styles.compactActions}>{actions}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 0,
  },

  // Breadcrumbs
  breadcrumbs: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    flexWrap: "wrap",
  },
  breadcrumbItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  breadcrumbSeparator: {
    marginHorizontal: 8,
  },
  breadcrumbLink: {
    ...(Platform.OS === "web" && { cursor: "pointer" as any }),
  },
  breadcrumbText: {
    fontSize: 13,
  },

  // Title Row
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  titleContent: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  // Compact variant
  compactContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  compactBack: {
    padding: 4,
    marginRight: 8,
  },
  compactTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
  },
  compactActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
