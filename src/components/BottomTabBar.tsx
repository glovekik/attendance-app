import React, { useEffect } from "react";

import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";

import { useRouter, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../theme/ThemeProvider";
import { chatUnreadStore, useChatUnreadBadge } from "../services/chatUnread";
import { User, hasRole, isManager, isCEO } from "../types";
import { useResponsive } from "../utils/responsive";

/**
 * Bottom tab bar shown on the main hub screens.
 *
 * Layout: a single rounded card pinned to the bottom of the screen.
 * Padding-bottom is driven by the real safe-area inset (gesture-bar on
 * Android, home indicator on iOS) instead of a hardcoded 22/12 — so it
 * fits every device cleanly without overlapping system UI.
 *
 * Active state: the active tab gets a soft pill behind its icon and an
 * accent-colored label. No more height-jumping center-lift — keeps the
 * bar visually stable as you switch tabs.
 *
 * Role-aware:
 *   Employee:  Home / Attendance / Office Chat / Tasks / Profile
 *   Manager:   Home / Team / Approvals / Tasks / Office Chat / Profile
 *   HR:        Home / Employees / HR Admin / Reports / Office Chat / Profile
 *   CEO:       Home / Console / Employees / Reports / Profile
 *
 * Layout contract: any screen that renders <BottomTabBar /> must leave
 * BOTTOM_BAR_RESERVED_HEIGHT of bottom padding on its scrollable content
 * (export below) so the last visible row isn't covered.
 */

export const BOTTOM_BAR_RESERVED_HEIGHT =
  Platform.OS === "ios" ? 92 : 80;

interface TabDef {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive?: keyof typeof Ionicons.glyphMap;
  route: string;
  matchPrefixes: string[];
}

const employeeTabs: TabDef[] = [
  {
    key: "home",
    label: "Home",
    icon: "home-outline",
    iconActive: "home",
    route: "/",
    matchPrefixes: ["/", "/index"],
  },
  {
    key: "attendance",
    label: "Attendance",
    icon: "calendar-outline",
    iconActive: "calendar",
    route: "/attendance",
    matchPrefixes: ["/attendance", "/history"],
  },
  {
    key: "chat",
    label: "Office Chat",
    icon: "chatbubbles-outline",
    iconActive: "chatbubbles",
    route: "/chat/office",
    matchPrefixes: ["/chat"],
  },
  {
    key: "tasks",
    label: "Tasks",
    icon: "checkbox-outline",
    iconActive: "checkbox",
    route: "/tasks",
    matchPrefixes: ["/tasks", "/todos"],
  },
  {
    key: "profile",
    label: "Profile",
    icon: "person-outline",
    iconActive: "person",
    route: "/profile",
    matchPrefixes: ["/profile", "/my-documents", "/my-payroll"],
  },
];

const managerTabs: TabDef[] = [
  employeeTabs[0],
  {
    key: "team",
    label: "Team",
    icon: "people-outline",
    iconActive: "people",
    route: "/manager-team",
    matchPrefixes: [
      "/manager-team",
      "/manager-attendance",
      "/manager-leave-balances",
      "/manager-productivity",
    ],
  },
  {
    key: "approvals",
    label: "Approvals",
    icon: "checkmark-done-outline",
    iconActive: "checkmark-done",
    route: "/manager",
    matchPrefixes: [
      "/manager",
      "/manager-leaves",
      "/manager-corrections",
      "/manager-reimbursements",
      "/manager-timesheets",
      "/manager-manual-requests",
    ],
  },
  {
    key: "tasks",
    label: "Tasks",
    icon: "list-outline",
    iconActive: "list",
    route: "/manager-tasks",
    matchPrefixes: ["/manager-tasks"],
  },
  employeeTabs[2], // Office Chat
  employeeTabs[4], // Profile
];

const hrTabs: TabDef[] = [
  employeeTabs[0],
  {
    key: "employees",
    label: "Employees",
    icon: "people-outline",
    iconActive: "people",
    route: "/users",
    matchPrefixes: ["/users", "/hr-user-profile"],
  },
  {
    key: "admin",
    label: "HR Admin",
    icon: "briefcase-outline",
    iconActive: "briefcase",
    route: "/hr-admin",
    matchPrefixes: [
      "/hr-admin",
      "/hr-departments",
      "/hr-manual-requests",
      "/hr-reimbursements",
      "/hr-timesheets",
      "/hr-attendance",
      "/hr-leave-allocations",
      "/leave-requests",
      "/corrections",
      "/leave-types",
    ],
  },
  {
    key: "reports",
    label: "Reports",
    icon: "bar-chart-outline",
    iconActive: "bar-chart",
    route: "/hr-reports",
    matchPrefixes: ["/hr-reports", "/hr-audit-logs", "/payroll"],
  },
  employeeTabs[2], // Office Chat
  employeeTabs[4], // Profile
];

const ceoTabs: TabDef[] = [
  employeeTabs[0],
  {
    key: "ceo",
    label: "Console",
    icon: "trending-up-outline",
    iconActive: "trending-up",
    route: "/ceo",
    matchPrefixes: ["/ceo"],
  },
  hrTabs[1],
  hrTabs[3],
  employeeTabs[4],
];

const pickTabs = (user: User | null): TabDef[] => {
  if (!user) return employeeTabs;
  if (hasRole(user, "HR")) return hrTabs;
  if (isCEO(user)) return ceoTabs;
  if (isManager(user) || (user.ledTeamIds && user.ledTeamIds.length > 0)) {
    return managerTabs;
  }
  return employeeTabs;
};

interface Props {
  user: User | null;
  // Optional live unread count for the Office Chat tab. When provided (e.g.
  // the dashboard keeps it fresh via SSE) it takes precedence; otherwise the
  // bar fetches the count itself whenever it regains focus.
  chatUnread?: number;
  // Optional badge counts keyed by tab key (e.g. { admin: 4 } or
  // { approvals: 7 }) — lets a console badge its primary action tab with
  // the aggregate pending count it already computed.
  badges?: Record<string, number>;
}

export const BottomTabBar = ({ user, chatUnread, badges }: Props) => {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { showSidebar } = useResponsive();

  // LEARNING POINT: Platform-specific rendering
  // On desktop web, we use SidebarNav instead of BottomTabBar.
  // Return null to hide this component when sidebar is visible.
  if (showSidebar) {
    return null;
  }

  const tabs = pickTabs(user);
  const showsChatTab = tabs.some((t) => t.key === "chat");

  // The badge reads from a shared store so it clears the moment the user
  // opens a chat (which sets the store to 0) and stays in sync everywhere.
  const unreadForChat = useChatUnreadBadge();

  // Feed any parent-provided live count (dashboard SSE) into the store.
  useEffect(() => {
    if (chatUnread !== undefined) chatUnreadStore.set(chatUnread);
  }, [chatUnread]);

  // Re-pull the authoritative count from the server on every navigation, so
  // leaving a chat reflects the just-read state.
  useEffect(() => {
    if (showsChatTab) chatUnreadStore.refresh();
  }, [pathname, showsChatTab]);

  const isActive = (t: TabDef): boolean => {
    if (t.key === "home") {
      return pathname === "/" || pathname === "/index";
    }
    return t.matchPrefixes.some(
      (p) => pathname === p || pathname.startsWith(p + "/")
    );
  };

  // Real device safe-area bottom plus a small minimum so the bar still
  // feels grounded on devices without a system gesture bar (iOS pre-X,
  // Android with 3-button nav). Clamp at 8 so very short insets don't
  // glue the bar to the screen edge.
  const bottomPad = Math.max(insets.bottom, 8);

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.outerWrap,
        { paddingBottom: bottomPad, paddingHorizontal: 10 },
      ]}
    >
      <View
        style={[
          styles.bar,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.surfaceBorder,
            shadowColor: theme.colors.shadow,
          },
        ]}
      >
        {tabs.map((t) => {
          const active = isActive(t);
          const iconName = active && t.iconActive ? t.iconActive : t.icon;
          // Chat badge is self-fetched; all others come from the badges map.
          const badgeCount =
            t.key === "chat" ? unreadForChat : badges?.[t.key] ?? 0;
          return (
            <TouchableOpacity
              key={t.key}
              style={styles.tab}
              onPress={() => router.push(t.route as any)}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.iconWrap,
                  active && {
                    backgroundColor: theme.colors.accentSoft,
                  },
                ]}
              >
                <Ionicons
                  name={iconName}
                  size={20}
                  color={active ? theme.colors.accent : theme.colors.textMuted}
                />
                {badgeCount > 0 && (
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: theme.colors.dangerText },
                    ]}
                  >
                    <Text style={styles.badgeText}>
                      {badgeCount > 9 ? "9+" : badgeCount}
                    </Text>
                  </View>
                )}
              </View>
              <Text
                style={[
                  styles.label,
                  {
                    color: active
                      ? theme.colors.accent
                      : theme.colors.textMuted,
                    fontWeight: active ? "700" : "500",
                  },
                ]}
                numberOfLines={1}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // pointerEvents="box-none" on the outer so taps fall through to the
  // page until they hit the bar itself.
  outerWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "stretch",
    paddingTop: 4,
  },
  bar: {
    flexDirection: "row",
    width: "100%",
    paddingHorizontal: 6,
    paddingTop: 8,
    paddingBottom: 8,
    borderRadius: 18,
    borderWidth: 1,
    // Softer shadow than the previous heavy treatment — keeps the bar
    // anchored without throwing a dark halo across the content above.
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 2,
    gap: 2,
  },
  iconWrap: {
    minWidth: 44,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.2,
  },
});
