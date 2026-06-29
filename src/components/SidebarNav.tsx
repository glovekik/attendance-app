/**
 * Desktop Sidebar Navigation - Web-only component.
 *
 * LEARNING POINT: Web-specific navigation
 * This sidebar only renders on desktop web (controlled by useResponsive).
 * Features Keka-inspired professional design:
 * - Clean white background with subtle border
 * - User profile section at bottom
 * - Organized navigation sections
 * - Smooth hover transitions
 * - Professional iconography
 *
 * Mobile uses BottomTabBar instead (see BottomTabBar.tsx).
 */

import React, { useCallback, useState, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Image,
  Platform,
} from "react-native";
import { useRouter, usePathname, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useTheme } from "../theme/ThemeProvider";
import { getChatUnreadCount } from "../services/chat";
import {
  getUpcomingEvents,
  UpcomingEvents,
} from "../services/dashboard";
import { User, hasRole, isManager, isCEO } from "../types";
import { SIDEBAR_WIDTH } from "../utils/responsive";

// "Today" / "Tomorrow" / "Jul 12" label for an upcoming event.
const whenLabel = (daysUntil: number, dateStr?: string): string => {
  if (daysUntil <= 0) return "Today";
  if (daysUntil === 1) return "Tomorrow";
  if (dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
    }
  }
  return `In ${daysUntil}d`;
};

// Tab definitions - same structure as BottomTabBar for consistency
interface TabDef {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive?: keyof typeof Ionicons.glyphMap;
  route: string;
  matchPrefixes: string[];
  section?: "main" | "admin" | "settings";
}

const employeeTabs: TabDef[] = [
  {
    key: "home",
    label: "Dashboard",
    icon: "home-outline",
    iconActive: "home",
    route: "/",
    matchPrefixes: ["/", "/index"],
    section: "main",
  },
  {
    key: "attendance",
    label: "Attendance",
    icon: "calendar-outline",
    iconActive: "calendar",
    route: "/attendance",
    matchPrefixes: ["/attendance", "/history"],
    section: "main",
  },
  {
    key: "chat",
    label: "Office Chat",
    icon: "chatbubbles-outline",
    iconActive: "chatbubbles",
    route: "/chat/office",
    matchPrefixes: ["/chat"],
    section: "main",
  },
  {
    key: "tasks",
    label: "Tasks",
    icon: "checkbox-outline",
    iconActive: "checkbox",
    route: "/tasks",
    matchPrefixes: ["/tasks", "/todos"],
    section: "main",
  },
  {
    key: "leaves",
    label: "Leaves",
    icon: "airplane-outline",
    iconActive: "airplane",
    route: "/leaves",
    matchPrefixes: ["/leaves"],
    section: "main",
  },
  {
    key: "profile",
    label: "My Profile",
    icon: "person-outline",
    iconActive: "person",
    route: "/profile",
    matchPrefixes: ["/profile", "/my-documents", "/my-payroll"],
    section: "settings",
  },
];

const managerTabs: TabDef[] = [
  employeeTabs[0],
  {
    key: "team",
    label: "My Team",
    icon: "people-outline",
    iconActive: "people",
    route: "/manager-team",
    matchPrefixes: [
      "/manager-team",
      "/manager-attendance",
      "/manager-leave-balances",
      "/manager-productivity",
    ],
    section: "main",
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
    section: "main",
  },
  {
    key: "tasks",
    label: "Team Tasks",
    icon: "list-outline",
    iconActive: "list",
    route: "/manager-tasks",
    matchPrefixes: ["/manager-tasks"],
    section: "main",
  },
  employeeTabs[2], // chat
  employeeTabs[5], // profile
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
    section: "main",
  },
  {
    key: "attendance-hr",
    label: "Attendance",
    icon: "time-outline",
    iconActive: "time",
    route: "/hr-attendance",
    matchPrefixes: ["/hr-attendance"],
    section: "main",
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
      "/hr-leave-allocations",
      "/leave-requests",
      "/corrections",
      "/leave-types",
    ],
    section: "admin",
  },
  {
    key: "reports",
    label: "Reports",
    icon: "bar-chart-outline",
    iconActive: "bar-chart",
    route: "/hr-reports",
    matchPrefixes: ["/hr-reports", "/hr-audit-logs", "/payroll"],
    section: "admin",
  },
  employeeTabs[2], // chat
  employeeTabs[5], // profile
];

const ceoTabs: TabDef[] = [
  employeeTabs[0],
  {
    key: "ceo",
    label: "CEO Console",
    icon: "trending-up-outline",
    iconActive: "trending-up",
    route: "/ceo",
    matchPrefixes: ["/ceo"],
    section: "main",
  },
  hrTabs[1], // employees
  hrTabs[4], // reports
  employeeTabs[2], // chat
  employeeTabs[5], // profile
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
  collapsed?: boolean;
  chatUnread?: number;
  badges?: Record<string, number>;
}

export const SidebarNav = ({
  user,
  collapsed = false,
  chatUnread,
  badges,
}: Props) => {
  const router = useRouter();
  const pathname = usePathname() || "/";
  const { theme } = useTheme();

  const tabs = pickTabs(user);

  const showsChatTab = tabs.some((t) => t.key === "chat");

  // Fetch unread count for chat badge
  const [fetchedUnread, setFetchedUnread] = useState(0);
  useFocusEffect(
    useCallback(() => {
      if (chatUnread !== undefined || !showsChatTab) return;
      let active = true;
      (async () => {
        try {
          const token = await AsyncStorage.getItem("token");
          if (!token) return;
          const { count } = await getChatUnreadCount(token);
          if (active) setFetchedUnread(count || 0);
        } catch {
          /* non-fatal */
        }
      })();
      return () => {
        active = false;
      };
    }, [chatUnread, showsChatTab])
  );

  const unreadForChat = chatUnread ?? fetchedUnread;

  // Upcoming holidays + birthdays widget. Only fetched when the sidebar is
  // expanded (the widget is hidden when collapsed, so skip the call).
  const [upcoming, setUpcoming] = useState<UpcomingEvents | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (collapsed) return;
      let active = true;
      (async () => {
        try {
          const token = await AsyncStorage.getItem("token");
          if (!token) return;
          const data = await getUpcomingEvents(token);
          if (active) setUpcoming(data);
        } catch {
          /* non-fatal — widget just stays hidden */
        }
      })();
      return () => {
        active = false;
      };
    }, [collapsed])
  );

  const isActive = (t: TabDef): boolean => {
    if (t.key === "home") {
      return pathname === "/" || pathname === "/index";
    }
    return t.matchPrefixes.some(
      (p) => pathname === p || pathname.startsWith(p + "/")
    );
  };

  // Group tabs by section
  const mainTabs = tabs.filter((t) => t.section !== "admin" && t.section !== "settings");
  const adminTabs = tabs.filter((t) => t.section === "admin");
  const settingsTabs = tabs.filter((t) => t.section === "settings");

  const styles = useMemo(() => makeStyles(theme.colors, collapsed), [theme.colors, collapsed]);

  const renderTab = (t: TabDef) => {
    const active = isActive(t);
    const iconName = active && t.iconActive ? t.iconActive : t.icon;
    const badgeCount = t.key === "chat" ? unreadForChat : badges?.[t.key] ?? 0;

    return (
      <Pressable
        key={t.key}
        style={({ hovered, pressed }: any) => [
          styles.navItem,
          active && styles.navItemActive,
          hovered && !active && styles.navItemHover,
          pressed && styles.navItemPressed,
        ]}
        onPress={() => router.push(t.route as any)}
        // @ts-ignore - web-only prop for accessibility
        role="button"
        accessibilityRole="button"
        accessibilityLabel={t.label}
      >
        <View style={styles.iconContainer}>
          <Ionicons
            name={iconName}
            size={20}
            color={active ? theme.colors.accent : theme.colors.textMuted}
          />
          {badgeCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {badgeCount > 9 ? "9+" : badgeCount}
              </Text>
            </View>
          )}
        </View>
        {!collapsed && (
          <Text
            style={[
              styles.navLabel,
              active && styles.navLabelActive,
            ]}
            numberOfLines={1}
          >
            {t.label}
          </Text>
        )}
      </Pressable>
    );
  };

  const renderSection = (title: string, items: TabDef[]) => {
    if (items.length === 0) return null;
    return (
      <View style={styles.section}>
        {!collapsed && title && (
          <Text style={styles.sectionTitle}>{title}</Text>
        )}
        {items.map(renderTab)}
      </View>
    );
  };

  // Get user initials for avatar
  const getInitials = (name?: string) => {
    if (!name) return "U";
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const renderUpcoming = () => {
    if (collapsed || !upcoming) return null;
    const holidays = upcoming.holidays || [];
    const birthdays = upcoming.birthdays || [];
    const anniversaries = upcoming.anniversaries || [];
    const newJoiners = upcoming.newJoiners || [];
    if (
      holidays.length === 0 &&
      birthdays.length === 0 &&
      anniversaries.length === 0 &&
      newJoiners.length === 0
    )
      return null;

    return (
      <View>
        {holidays.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upcoming Holidays</Text>
            {holidays.slice(0, 3).map((h) => (
              <View key={`${h.date}-${h.name}`} style={styles.eventRow}>
                <View
                  style={[
                    styles.eventIcon,
                    { backgroundColor: theme.colors.accentSoft },
                  ]}
                >
                  <Ionicons
                    name="sparkles-outline"
                    size={14}
                    color={theme.colors.accent}
                  />
                </View>
                <View style={styles.eventInfo}>
                  <Text style={styles.eventName} numberOfLines={1}>
                    {h.name}
                  </Text>
                  <Text style={styles.eventWhen}>
                    {whenLabel(h.daysUntil, h.date)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {birthdays.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Birthdays</Text>
            {birthdays.slice(0, 4).map((b) => (
              <View key={b.id} style={styles.eventRow}>
                <View
                  style={[
                    styles.birthdayAvatar,
                    { backgroundColor: theme.colors.accent },
                  ]}
                >
                  {b.profilePictureUrl ? (
                    <Image
                      source={{ uri: b.profilePictureUrl }}
                      style={styles.birthdayAvatarImg}
                    />
                  ) : (
                    <Text style={styles.birthdayInitials}>
                      {getInitials(b.name)}
                    </Text>
                  )}
                </View>
                <View style={styles.eventInfo}>
                  <Text style={styles.eventName} numberOfLines={1}>
                    {b.name}
                  </Text>
                  <Text style={styles.eventWhen}>
                    🎂 {whenLabel(b.daysUntil, b.birthday)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {anniversaries.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Work Anniversaries</Text>
            {anniversaries.slice(0, 4).map((a) => (
              <View key={a.id} style={styles.eventRow}>
                <View
                  style={[
                    styles.birthdayAvatar,
                    { backgroundColor: theme.colors.accent },
                  ]}
                >
                  {a.profilePictureUrl ? (
                    <Image
                      source={{ uri: a.profilePictureUrl }}
                      style={styles.birthdayAvatarImg}
                    />
                  ) : (
                    <Text style={styles.birthdayInitials}>
                      {getInitials(a.name)}
                    </Text>
                  )}
                </View>
                <View style={styles.eventInfo}>
                  <Text style={styles.eventName} numberOfLines={1}>
                    {a.name}
                  </Text>
                  <Text style={styles.eventWhen}>
                    🎉 {a.years} yr{a.years === 1 ? "" : "s"} ·{" "}
                    {whenLabel(a.daysUntil, a.joiningDate)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {newJoiners.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>New Joiners</Text>
            {newJoiners.slice(0, 4).map((n) => (
              <View key={n.id} style={styles.eventRow}>
                <View
                  style={[
                    styles.birthdayAvatar,
                    { backgroundColor: theme.colors.accent },
                  ]}
                >
                  {n.profilePictureUrl ? (
                    <Image
                      source={{ uri: n.profilePictureUrl }}
                      style={styles.birthdayAvatarImg}
                    />
                  ) : (
                    <Text style={styles.birthdayInitials}>
                      {getInitials(n.name)}
                    </Text>
                  )}
                </View>
                <View style={styles.eventInfo}>
                  <Text style={styles.eventName} numberOfLines={1}>
                    {n.name}
                  </Text>
                  <Text style={styles.eventWhen}>
                    👋 {n.daysAgo === 0 ? "Joined today" : `Joined ${n.daysAgo}d ago`}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Logo / Brand - Clean Keka-style header */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <View style={styles.logoIcon}>
            <Ionicons
              name="shield-checkmark"
              size={collapsed ? 24 : 22}
              color="#fff"
            />
          </View>
          {!collapsed && (
            <View>
              <Text style={styles.brandText}>ForeSentry</Text>
              <Text style={styles.brandSubtext}>HR Platform</Text>
            </View>
          )}
        </View>
      </View>

      {/* Navigation Items */}
      <ScrollView
        style={styles.navScroll}
        contentContainerStyle={styles.navContent}
        showsVerticalScrollIndicator={false}
      >
        {renderSection("", mainTabs)}
        {adminTabs.length > 0 && renderSection("Administration", adminTabs)}
        {renderUpcoming()}
      </ScrollView>

      {/* User Profile Section - Keka style */}
      <View style={styles.footer}>
        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: theme.colors.surfaceBorder }]} />

        {/* User profile card */}
        <Pressable
          style={({ hovered }: any) => [
            styles.userCard,
            hovered && styles.userCardHover,
          ]}
          onPress={() => router.push("/profile" as any)}
        >
          {/* Avatar */}
          <View style={[styles.avatar, { backgroundColor: theme.colors.accent }]}>
            {user?.profilePictureUrl ? (
              <Image source={{ uri: user.profilePictureUrl }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarText}>{getInitials(user?.name)}</Text>
            )}
          </View>

          {!collapsed && (
            <View style={styles.userInfo}>
              <Text style={styles.userName} numberOfLines={1}>
                {user?.name || "User"}
              </Text>
              <Text style={styles.userRole} numberOfLines={1}>
                {user?.role === "HR" ? "HR Admin" : user?.role === "CEO" ? "CEO" : user?.work?.jobTitle || "Employee"}
              </Text>
            </View>
          )}

          {!collapsed && (
            <Ionicons
              name="chevron-forward"
              size={16}
              color={theme.colors.textMuted}
            />
          )}
        </Pressable>
      </View>
    </View>
  );
};

const makeStyles = (colors: any, collapsed: boolean) =>
  StyleSheet.create({
    container: {
      width: collapsed ? SIDEBAR_WIDTH.collapsed : SIDEBAR_WIDTH.expanded,
      height: "100%",
      backgroundColor: colors.surface,
      borderRightWidth: 1,
      borderRightColor: colors.surfaceBorder,
      flexDirection: "column",
      ...(Platform.OS === "web" && {
        boxShadow: "2px 0 8px rgba(0,0,0,0.04)" as any,
      }),
    },
    header: {
      paddingVertical: 20,
      paddingHorizontal: collapsed ? 16 : 20,
    },
    logoContainer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      justifyContent: collapsed ? "center" : "flex-start",
    },
    logoIcon: {
      width: 36,
      height: 36,
      borderRadius: 8,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    brandText: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.text,
      letterSpacing: -0.3,
    },
    brandSubtext: {
      fontSize: 11,
      fontWeight: "500",
      color: colors.textMuted,
      marginTop: 1,
    },
    navScroll: {
      flex: 1,
    },
    navContent: {
      paddingTop: 8,
      paddingBottom: 16,
    },
    section: {
      marginBottom: 4,
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textFaint,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      paddingHorizontal: collapsed ? 16 : 24,
      marginBottom: 8,
      marginTop: 20,
    },
    navItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      paddingHorizontal: collapsed ? 16 : 16,
      marginHorizontal: collapsed ? 8 : 12,
      borderRadius: 8,
      gap: 12,
      justifyContent: collapsed ? "center" : "flex-start",
      ...(Platform.OS === "web" && {
        transition: "all 0.15s ease" as any,
        cursor: "pointer" as any,
      }),
    },
    navItemActive: {
      backgroundColor: colors.accentSoft,
    },
    navItemHover: {
      // Subtle hover - just a light tint, not heavy background
      backgroundColor: "rgba(0, 0, 0, 0.04)",
    },
    navItemPressed: {
      backgroundColor: "rgba(0, 0, 0, 0.06)",
    },
    iconContainer: {
      width: 22,
      height: 22,
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
    },
    navLabel: {
      fontSize: 14,
      fontWeight: "500",
      color: colors.text,
      flex: 1,
    },
    navLabelActive: {
      color: colors.accent,
      fontWeight: "600",
    },
    badge: {
      position: "absolute",
      top: -5,
      right: -8,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: colors.dangerText,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 4,
    },
    badgeText: {
      color: "#fff",
      fontSize: 9,
      fontWeight: "700",
    },
    eventRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 7,
      paddingHorizontal: 16,
      marginHorizontal: 12,
    },
    eventIcon: {
      width: 30,
      height: 30,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
    },
    birthdayAvatar: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    birthdayAvatarImg: {
      width: 30,
      height: 30,
      borderRadius: 15,
    },
    birthdayInitials: {
      color: "#fff",
      fontSize: 11,
      fontWeight: "700",
    },
    eventInfo: {
      flex: 1,
      minWidth: 0,
    },
    eventName: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.text,
    },
    eventWhen: {
      fontSize: 11,
      fontWeight: "500",
      color: colors.textMuted,
      marginTop: 1,
    },
    footer: {
      paddingHorizontal: collapsed ? 8 : 12,
      paddingBottom: 16,
    },
    divider: {
      height: 1,
      marginHorizontal: collapsed ? 8 : 12,
      marginBottom: 16,
    },
    userCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: collapsed ? 8 : 12,
      borderRadius: 10,
      gap: 12,
      justifyContent: collapsed ? "center" : "flex-start",
      ...(Platform.OS === "web" && {
        transition: "background-color 0.15s ease" as any,
        cursor: "pointer" as any,
      }),
    },
    userCardHover: {
      backgroundColor: "rgba(0, 0, 0, 0.04)",
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },
    avatarImage: {
      width: 36,
      height: 36,
      borderRadius: 18,
    },
    avatarText: {
      color: "#fff",
      fontSize: 13,
      fontWeight: "700",
    },
    userInfo: {
      flex: 1,
      minWidth: 0,
    },
    userName: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.text,
    },
    userRole: {
      fontSize: 12,
      fontWeight: "400",
      color: colors.textMuted,
      marginTop: 1,
    },
  });
