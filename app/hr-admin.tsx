import React, { useEffect, useState, useMemo} from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity } from "react-native";
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

/**
 * HR Admin Console — Koru-style category grid grouped by section.
 * White cards with pastel icon containers and red badge counts.
 */
export default function HRAdmin() {
  const router = useRouter();
  const { theme } = useTheme();
  const [dash, setDash] = useState<DashboardHR | null>(null);
  const [me, setMe] = useState<User | null>(null);

  useEffect(() => {
    (async () => {
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

  const c = theme.colors;

  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: BOTTOM_BAR_RESERVED_HEIGHT + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
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
            <Text style={[styles.title, { color: c.text }]}>
              HR Admin
            </Text>
            <Text style={[styles.subtitle, { color: c.textMuted }]}>
              Everything HR-only, organised
            </Text>
          </View>
        </View>

        {/* PEOPLE */}
        <Section title="PEOPLE" theme={theme}
            styles={styles}>
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

        {/* ATTENDANCE */}
        <Section title="ATTENDANCE" theme={theme}
            styles={styles}>
          <Tile
            icon="calendar-outline"
            label="Daily Attendance"
            tint={c.pastelSky}
            iconColor="#0369a1"
            onPress={() => router.push("/hr-attendance" as any)}
            theme={theme}
            styles={styles}
          />
        </Section>

        {/* APPROVALS */}
        <Section title="APPROVALS" theme={theme}
            styles={styles}>
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
            icon="document-text-outline"
            label="Manual Attendance"
            tint={c.pastelLavender}
            iconColor="#6d28d9"
            count={dash?.pendingManualAttendanceApprovals}
            onPress={() => router.push("/hr-manual-requests" as any)}
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
          <Tile
            icon="time-outline"
            label="Timesheets"
            tint={c.pastelPink}
            iconColor="#be185d"
            count={dash?.pendingTimesheetApprovals}
            onPress={() => router.push("/hr-timesheets" as any)}
            theme={theme}
            styles={styles}
          />
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

        {/* FINANCE */}
        <Section title="FINANCE" theme={theme}
            styles={styles}>
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

        {/* ASSETS */}
        <Section title="ASSETS" theme={theme}
            styles={styles}>
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
            label="Reports"
            tint={c.pastelPink}
            iconColor="#be185d"
            onPress={() => router.push("/asset-reports")}
            theme={theme}
            styles={styles}
          />
        </Section>

        {/* INSIGHTS */}
        <Section title="INSIGHTS" theme={theme}
            styles={styles}>
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

      <BottomTabBar user={me} />
    </SafeAreaView>
  );
}

// =============================================================
// Sub-components
// =============================================================

const Section = ({
  title,
  children,
  theme,
  styles }: {
  title: string;
  children: React.ReactNode;
  theme: any;
  styles: any;
}) => (
  <>
    <Text style={[styles.section, { color: theme.colors.textMuted }]}>
      {title}
    </Text>
    <View style={styles.grid}>{children}</View>
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
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.85}
    style={[
      styles.tile,
      {
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.surfaceBorder,
        shadowColor: theme.colors.shadow },
    ]}
  >
    <View style={[styles.tileIcon, { backgroundColor: tint }]}>
      <Ionicons name={icon} size={20} color={iconColor} />
    </View>
    <Text
      style={[styles.tileLabel, { color: theme.colors.text }]}
      numberOfLines={2}
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
  </TouchableOpacity>
);

const makeStyles = (c: any) => StyleSheet.create({
  safe: { flex: 1 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18 },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center" },
  title: { fontSize: 26, fontWeight: "800" },
  subtitle: { fontSize: 13, marginTop: 2 },
  section: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginTop: 22,
    marginBottom: 10,
    marginLeft: 4 },
  // 3-up grid. flexGrow is intentionally 0 so tiles in a partial last
  // row (e.g. 4 or 5 tiles in a section) don't stretch to fill the
  // remaining space — that was the misalignment.
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    columnGap: 10,
    rowGap: 10 },
  tile: {
    // < 33% so 3 tiles + 2 column gaps always fit on one row. At
    // 31.5% the gap math pushed the 3rd tile to wrap on phones.
    flexBasis: "30%",
    flexGrow: 0,
    flexShrink: 0,
    aspectRatio: 1,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    position: "relative" },
  tileIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8 },
  tileLabel: {
    fontSize: 12,
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
