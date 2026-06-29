/**
 * AppShell - Responsive layout wrapper for web and mobile.
 *
 * LEARNING POINT: Responsive Layout Wrapper
 * This component provides a consistent layout structure across platforms:
 * - Desktop Web: Sidebar navigation on the left + content area
 * - Tablet Web: Collapsed sidebar (icons only) + content area
 * - Mobile: Just the content (BottomTabBar is rendered by each screen)
 *
 * Usage:
 * Wrap your screen content with AppShell to get the desktop sidebar:
 *
 *   <AppShell user={user}>
 *     <YourScreenContent />
 *     <BottomTabBar user={user} />  // Still needed for mobile
 *   </AppShell>
 *
 * The BottomTabBar will automatically hide itself on desktop web.
 */

import React, { ReactNode } from "react";
import { View, StyleSheet, Platform } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { useResponsive, SIDEBAR_WIDTH } from "../utils/responsive";
import { SidebarNav } from "./SidebarNav";
import { User } from "../types";

interface Props {
  children: ReactNode;
  user: User | null;
  /** Optional live unread count for the chat badge */
  chatUnread?: number;
  /** Optional badge counts keyed by tab key */
  badges?: Record<string, number>;
}

export const AppShell = ({ children, user, chatUnread, badges }: Props) => {
  const { theme } = useTheme();
  const { showSidebar, sidebarCollapsed } = useResponsive();

  // On mobile, just render children directly (no wrapper needed)
  if (!showSidebar) {
    return <>{children}</>;
  }

  // Desktop/Tablet web layout with sidebar
  return (
    <View style={styles.container}>
      {/* Fixed Sidebar */}
      <SidebarNav
        user={user}
        collapsed={sidebarCollapsed}
        chatUnread={chatUnread}
        badges={badges}
      />

      {/* Main Content Area */}
      <View
        style={[
          styles.content,
          {
            backgroundColor: theme.colors.bg,
            // Adjust content area based on sidebar width
            marginLeft: sidebarCollapsed
              ? SIDEBAR_WIDTH.collapsed
              : SIDEBAR_WIDTH.expanded,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
};

/**
 * Hook to get content padding for screens.
 * Returns different padding based on whether sidebar is visible.
 *
 * LEARNING POINT:
 * Use this hook in screens to adjust padding when sidebar is present.
 */
export const useContentPadding = () => {
  const { showSidebar, breakpoint } = useResponsive();

  if (!showSidebar) {
    // Mobile padding
    return {
      horizontal: 16,
      vertical: 16,
      bottom: 100, // Space for BottomTabBar
    };
  }

  // Desktop/Tablet padding (no bottom bar, more horizontal space)
  return {
    horizontal: breakpoint === "wide" ? 32 : 24,
    vertical: 24,
    bottom: 24,
  };
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "row",
  },
  content: {
    flex: 1,
    // The sidebar is position fixed on web, so we use marginLeft
    // instead of flex to push content over
    ...(Platform.OS === "web"
      ? {
          position: "absolute" as any,
          top: 0,
          right: 0,
          bottom: 0,
        }
      : {}),
  },
});
