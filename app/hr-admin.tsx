import React, { useEffect, useState, useMemo, useCallback } from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { getDashboardHr } from "../src/services/dashboard";
import { getMe } from "../src/services/api";
import { DashboardHR, User } from "../src/types";
import { useTheme } from "../src/theme/ThemeProvider";
import {
  BottomTabBar,
  BOTTOM_BAR_RESERVED_HEIGHT } from "../src/components/BottomTabBar";
import { useResponsive, getResponsiveSpacing } from "../src/utils/responsive";
import { PageHeader } from "../src/components/PageHeader";

const COLLAPSE_KEY = "hrConsoleCollapsed";

/**
 * HR Admin Console — "needs-attention first" layout. A summary strip
 * surfaces the pending approval queues, then collapsible sections group
 * the rest, with config split out of the approval queues.
 */
export default function HRAdmin() {
  const router = useRouter();
  const { theme } = useTheme();
  const responsive = useResponsive();
  const spacing = getResponsiveSpacing(responsive.breakpoint);
  const isDesktop = responsive.isDesktop;

  const [dash, setDash] = useState<DashboardHR | null>(null);
  const [me, setMe] = useState<User | null>(null);

  // Collapsed-section state, persisted per-user so the console remembers
  // how HR likes it laid out.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(COLLAPSE_KEY);
        if (raw) setCollapsed(JSON.parse(raw));
      } catch {
        /* ignore */
      }
      try {
        const token = await AsyncStorage.getItem("token");
        if (!token) {
          router.replace("/login");
          return;
        }
        const [d, meRes] = await Promise.all([
          getDashboardHr(token).catch(() => null),
          getMe(token).catch(() => null),
        ]);
        if (d) setDash(d);
        setMe(meRes);
      } catch {
        /* non-fatal */
      }
    })();
  }, [router]);

  const toggleSection = useCallback((title: string) => {
    setCollapsed((prev) => {
      const next = { ...prev, [title]: !prev[title] };
      AsyncStorage.setItem(COLLAPSE_KEY, JSON.stringify(next)).catch(
        () => {}
      );
      return next;
    });
  }, []);

  const c = theme.colors;

  const styles = useMemo(
    () => makeStyles(c, isDesktop, spacing),
    [c, isDesktop, spacing]
  );

  // Desktop shows sidebar, so we don't need bottom bar padding
  const bottomPadding = responsive.showSidebar ? 40 : BOTTOM_BAR_RESERVED_HEIGHT + 24;

  // The pending approval queues that drive the "needs attention" strip.
  const pendingQueues = [
    {
      label: "Leaves",
      count: dash?.pendingLeaveApprovals || 0,
      icon: "paper-plane" as const,
      color: "#0f766e",
      route: "/leave-requests" },
    {
      label: "Corrections",
      count: dash?.pendingCorrectionApprovals || 0,
      icon: "alert-circle" as const,
      color: "#a16207",
      route: "/corrections" },
    {
      label: "Reimburse",
      count: dash?.pendingReimbursementApprovals || 0,
      icon: "card" as const,
      color: "#0369a1",
      route: "/hr-reimbursements" },
  ];
  const activeQueues = pendingQueues.filter((q) => q.count > 0);
  const totalPending = activeQueues.reduce((s, q) => s + q.count, 0);

  const sectionProps = (title: string) => ({
    title,
    collapsed: !!collapsed[title],
    onToggle: () => toggleSection(title),
    theme,
    styles,
  });

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.padding,
          paddingBottom: bottomPadding,
          // Desktop: limit content width for readability
          ...(isDesktop && {
            maxWidth: 1200,
            alignSelf: "center" as const,
            width: "100%",
          }),
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER - Desktop uses PageHeader with breadcrumbs */}
        {isDesktop ? (
          <PageHeader
            title="HR Admin Console"
            subtitle="Manage employees, approvals, payroll, and more"
            breadcrumbs={[
              { label: "Home", href: "/" },
              { label: "HR Admin" },
            ]}
          />
        ) : (
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace("/")
              }
              style={[
                styles.iconBtn,
                {
                  backgroundColor: c.surface,
                  borderColor: c.surfaceBorder },
              ]}
            >
              <Ionicons name="chevron-back" size={22} color={c.text} />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.title, { color: c.text }]}>HR Admin</Text>
              <Text style={[styles.subtitle, { color: c.textMuted }]}>
                Everything HR-only, organised
              </Text>
            </View>
          </View>
        )}

        {/* ===== NEEDS ATTENTION ===== */}
        {totalPending > 0 ? (
          <View
            style={[
              styles.attentionCard,
              { backgroundColor: c.surface, borderColor: "rgba(245,158,11,0.4)" },
            ]}
          >
            <View style={styles.attentionHeader}>
              <Ionicons name="alert-circle" size={18} color="#d97706" />
              <Text style={[styles.attentionTitle, { color: c.text }]}>
                {totalPending} item{totalPending > 1 ? "s" : ""} need
                {totalPending > 1 ? "" : "s"} action
              </Text>
            </View>
            <View style={styles.pillRow}>
              {activeQueues.map((q) => (
                <TouchableOpacity
                  key={q.label}
                  style={[
                    styles.pill,
                    {
                      backgroundColor: c.surfaceMuted,
                      borderColor: c.surfaceBorder },
                  ]}
                  onPress={() => router.push(q.route as any)}
                  activeOpacity={0.8}
                >
                  <Ionicons name={q.icon} size={14} color={q.color} />
                  <Text style={[styles.pillText, { color: c.text }]}>
                    {q.label}
                  </Text>
                  <View
                    style={[
                      styles.pillCount,
                      { backgroundColor: c.dangerText },
                    ]}
                  >
                    <Text style={styles.pillCountText}>
                      {q.count > 9 ? "9+" : q.count}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <View
            style={[
              styles.caughtUp,
              { backgroundColor: c.surface, borderColor: c.surfaceBorder },
            ]}
          >
            <Ionicons
              name="checkmark-circle"
              size={18}
              color="#16a34a"
            />
            <Text style={[styles.caughtUpText, { color: c.textMuted }]}>
              All caught up — no pending approvals.
            </Text>
          </View>
        )}

        {/* ===== PEOPLE ===== */}
        <Section {...sectionProps("PEOPLE")}>
          <Tile
            icon="person-add-outline"
            label="Employees"
            tint={c.roleHrBg}
            iconColor={c.roleHrText}
            onPress={() => router.push("/users")}
            theme={theme}
            styles={styles}
          />
          <Tile
            icon="business-outline"
            label="Departments"
            tint={c.pastelSky}
            iconColor="#0369a1"
            onPress={() => router.push("/hr-departments" as any)}
            theme={theme}
            styles={styles}
          />
          <Tile
            icon="folder-outline"
            label="Projects"
            tint={c.pastelLavender}
            iconColor="#6d28d9"
            onPress={() => router.push("/hr-projects" as any)}
            theme={theme}
            styles={styles}
          />
          <Tile
            icon="rocket-outline"
            label="Onboardings"
            tint={c.pastelMint}
            iconColor="#15803d"
            count={dash?.pendingOnboardings}
            onPress={() => router.push("/onboardings")}
            theme={theme}
            styles={styles}
          />
          <Tile
            icon="exit-outline"
            label="Exits"
            tint={c.pastelPeach}
            iconColor="#c2410c"
            onPress={() => router.push("/exits")}
            theme={theme}
            styles={styles}
          />
        </Section>

        {/* ===== ATTENDANCE & APPROVALS ===== */}
        <Section {...sectionProps("ATTENDANCE & APPROVALS")}>
          <Tile
            icon="calendar-outline"
            label="Daily Attendance"
            tint={c.pastelSky}
            iconColor="#0369a1"
            onPress={() => router.push("/hr-attendance" as any)}
            theme={theme}
            styles={styles}
          />
          <Tile
            icon="paper-plane-outline"
            label="Leaves"
            tint={c.pastelMint}
            iconColor="#0f766e"
            count={dash?.pendingLeaveApprovals}
            onPress={() => router.push("/leave-requests")}
            theme={theme}
            styles={styles}
          />
          <Tile
            icon="alert-circle-outline"
            label="Corrections"
            tint={c.pastelYellow}
            iconColor="#a16207"
            count={dash?.pendingCorrectionApprovals}
            onPress={() => router.push("/corrections")}
            theme={theme}
            styles={styles}
          />
          <Tile
            icon="card-outline"
            label="Reimburse"
            tint={c.pastelSky}
            iconColor="#0369a1"
            count={dash?.pendingReimbursementApprovals}
            onPress={() => router.push("/hr-reimbursements" as any)}
            theme={theme}
            styles={styles}
          />
        </Section>

        {/* ===== CONFIGURE (setup, no pending queues) ===== */}
        <Section {...sectionProps("CONFIGURE")}>
          <Tile
            icon="options-outline"
            label="Leave Types"
            tint={c.pastelLavender}
            iconColor="#6d28d9"
            onPress={() => router.push("/leave-types")}
            theme={theme}
            styles={styles}
          />
          <Tile
            icon="checkmark-done-outline"
            label="Allocate Leave"
            tint={c.pastelMint}
            iconColor="#15803d"
            onPress={() => router.push("/hr-leave-allocations" as any)}
            theme={theme}
            styles={styles}
          />
          <Tile
            icon="calendar-clear-outline"
            label="Holidays"
            tint={c.pastelPeach}
            iconColor="#c2410c"
            onPress={() => router.push("/holidays")}
            theme={theme}
            styles={styles}
          />
          <Tile
            icon="document-outline"
            label="Policies"
            tint={c.pastelSky}
            iconColor="#0369a1"
            onPress={() => router.push("/hr-policies" as any)}
            theme={theme}
            styles={styles}
          />
        </Section>

        {/* ===== FINANCE ===== */}
        <Section {...sectionProps("FINANCE")}>
          <Tile
            icon="cash-outline"
            label="Payroll"
            tint={c.pastelMint}
            iconColor="#15803d"
            onPress={() => router.push("/payroll")}
            theme={theme}
            styles={styles}
          />
          <Tile
            icon="receipt-outline"
            label="Expenses"
            tint={c.pastelYellow}
            iconColor="#a16207"
            onPress={() => router.push("/expenses")}
            theme={theme}
            styles={styles}
          />
        </Section>

        {/* ===== ASSETS ===== */}
        <Section {...sectionProps("ASSETS")}>
          <Tile
            icon="cube-outline"
            label="Inventory"
            tint={c.pastelLavender}
            iconColor="#6d28d9"
            onPress={() => router.push("/hr-assets")}
            theme={theme}
            styles={styles}
          />
          <Tile
            icon="warning-outline"
            label="Asset Reports"
            tint={c.pastelPink}
            iconColor="#be185d"
            onPress={() => router.push("/asset-reports")}
            theme={theme}
            styles={styles}
          />
        </Section>

        {/* ===== INSIGHTS ===== */}
        <Section {...sectionProps("INSIGHTS")}>
          <Tile
            icon="bar-chart-outline"
            label="Reports"
            tint={c.pastelSky}
            iconColor="#0369a1"
            onPress={() => router.push("/hr-reports" as any)}
            theme={theme}
            styles={styles}
          />
          <Tile
            icon="shield-checkmark-outline"
            label="Audit Logs"
            tint={c.pastelLavender}
            iconColor="#6d28d9"
            onPress={() => router.push("/hr-audit-logs" as any)}
            theme={theme}
            styles={styles}
          />
        </Section>
      </ScrollView>

      <BottomTabBar user={me} badges={{ admin: totalPending }} />
    </SafeAreaView>
  );
}

// =============================================================
// Sub-components
// =============================================================

const Section = ({
  title,
  collapsed,
  onToggle,
  children,
  theme,
  styles }: {
  title: string;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  theme: any;
  styles: any;
}) => (
  <>
    <TouchableOpacity
      style={styles.sectionHeader}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      <Text style={[styles.section, { color: theme.colors.textMuted }]}>
        {title}
      </Text>
      <Ionicons
        name={collapsed ? "chevron-forward" : "chevron-down"}
        size={16}
        color={theme.colors.textMuted}
      />
    </TouchableOpacity>
    {!collapsed && <View style={styles.grid}>{children}</View>}
  </>
);

const Tile = ({
  icon,
  label,
  tint,
  iconColor,
  onPress,
  count,
  theme,
  styles }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tint: string;
  iconColor: string;
  onPress: () => void;
  count?: number;
  theme: any;
  styles: any;
}) => (
  <Pressable
    onPress={onPress}
    style={({ hovered, pressed }: any) => [
      styles.tile,
      {
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.surfaceBorder,
        shadowColor: theme.colors.shadow },
      // Web hover effect
      Platform.OS === "web" && hovered && {
        transform: [{ scale: 1.03 }],
        shadowRadius: 18,
        borderColor: theme.colors.accent,
      },
      pressed && {
        opacity: 0.9,
        transform: [{ scale: 0.97 }],
      },
    ]}
  >
    <View style={[styles.tileIcon, { backgroundColor: tint }]}>
      <Ionicons name={icon} size={20} color={iconColor} />
    </View>
    <Text
      style={[styles.tileLabel, { color: theme.colors.text }]}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.75}
    >
      {label}
    </Text>
    {typeof count === "number" && count > 0 && (
      <View
        style={[
          styles.badge,
          { backgroundColor: theme.colors.dangerText },
        ]}
      >
        <Text style={styles.badgeText}>{count > 9 ? "9+" : count}</Text>
      </View>
    )}
  </Pressable>
);

const makeStyles = (c: any, isDesktop: boolean, spacing: any) => StyleSheet.create({
  safe: { flex: 1 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: isDesktop ? 24 : 18 },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center" },
  title: { fontSize: isDesktop ? 28 : 26, fontWeight: "800" },
  subtitle: { fontSize: isDesktop ? 14 : 13, marginTop: 2 },

  // ===== NEEDS ATTENTION =====
  attentionCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: isDesktop ? 18 : 14,
    marginBottom: 4 },
  attentionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12 },
  attentionTitle: { fontSize: isDesktop ? 15 : 14, fontWeight: "800" },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: isDesktop ? 12 : 8 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: isDesktop ? 14 : 10,
    paddingVertical: isDesktop ? 9 : 7,
    borderRadius: 999,
    borderWidth: 1,
    ...(Platform.OS === "web" && { cursor: "pointer" as any }) },
  pillText: { fontSize: isDesktop ? 13 : 12, fontWeight: "700" },
  pillCount: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center" },
  pillCountText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  caughtUp: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: isDesktop ? 18 : 14,
    paddingVertical: isDesktop ? 14 : 12,
    marginBottom: 4 },
  caughtUpText: { fontSize: isDesktop ? 14 : 13, fontWeight: "600" },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: isDesktop ? 28 : 22,
    marginBottom: isDesktop ? 14 : 10,
    paddingRight: 4,
    ...(Platform.OS === "web" && { cursor: "pointer" as any }) },
  section: {
    fontSize: isDesktop ? 12 : 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginLeft: 4 },
  // Responsive grid: Desktop 5-6 per row, Mobile 3 per row
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    columnGap: isDesktop ? 16 : 10,
    rowGap: isDesktop ? 16 : 10 },
  tile: {
    // Desktop: ~16% (6 per row), Mobile: ~30% (3 per row)
    flexBasis: isDesktop ? "15%" : "30%",
    flexGrow: 0,
    flexShrink: 0,
    aspectRatio: 1,
    padding: isDesktop ? 16 : 12,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    position: "relative",
    ...(Platform.OS === "web" && { cursor: "pointer" as any }) },
  tileIcon: {
    width: isDesktop ? 50 : 46,
    height: isDesktop ? 50 : 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: isDesktop ? 10 : 8 },
  tileLabel: {
    fontSize: isDesktop ? 13 : 12,
    fontWeight: "700",
    textAlign: "center" },
  badge: {
    position: "absolute",
    top: 8,
    right: 8,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center" },
  badgeText: { color: c.text, fontSize: 10, fontWeight: "800" } });
