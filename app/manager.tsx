import React, { useCallback, useEffect, useState, useMemo} from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { getDashboardManager } from "../src/services/dashboard";
import { getMe } from "../src/services/api";
import { DashboardManager, User } from "../src/types";
import { useTheme } from "../src/theme/ThemeProvider";
import {
  BottomTabBar,
  BOTTOM_BAR_RESERVED_HEIGHT } from "../src/components/BottomTabBar";

/**
 * Manager hub — KPI strip, approval queues, team management entry points.
 * White cards with pastel icon containers and badge counts.
 */
export default function ManagerHub() {
  const router = useRouter();
  const { theme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dash, setDash] = useState<DashboardManager | null>(null);
  const [me, setMe] = useState<User | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const [d, meRes] = await Promise.all([
        getDashboardManager(token).catch(() => null),
        getMe(token).catch(() => null),
      ]);
      if (d) setDash(d);
      setMe(meRes);
    } catch (err: any) {
      Alert.alert("Couldn't load manager hub", err?.message || "");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const c = theme.colors;

  const styles = useMemo(() => makeStyles(c), [c]);

  if (loading) {
    return (
      <View style={[styles.loader, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: BOTTOM_BAR_RESERVED_HEIGHT + 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={c.accent}
            colors={[c.accent]}
          />
        }
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
              Manager Hub
            </Text>
            <Text style={[styles.subtitle, { color: c.textMuted }]}>
              Approvals · Team · Tasks
            </Text>
          </View>
        </View>

        {/* TEAM SUMMARY */}
        {dash && (
          <View
            style={[
              styles.summaryCard,
              {
                backgroundColor: c.surface,
                borderColor: c.surfaceBorder,
                shadowColor: c.shadow },
            ]}
          >
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: c.text }]}>
                {dash.directReports}
              </Text>
              <Text style={[styles.summaryLabel, { color: c.textMuted }]}>
                Direct reports
              </Text>
            </View>
            <View
              style={[
                styles.summaryDivider,
                { backgroundColor: c.surfaceBorder },
              ]}
            />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: c.text }]}>
                {dash.openTasksForReports ?? 0}
              </Text>
              <Text style={[styles.summaryLabel, { color: c.textMuted }]}>
                Open tasks
              </Text>
            </View>
            <View
              style={[
                styles.summaryDivider,
                { backgroundColor: c.surfaceBorder },
              ]}
            />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: c.text }]}>
                {dash.pendingApprovalsTotal ?? 0}
              </Text>
              <Text style={[styles.summaryLabel, { color: c.textMuted }]}>
                Pending
              </Text>
            </View>
          </View>
        )}

        {/* KPIs */}
        {dash && (
          <>
            <Text style={[styles.section, { color: c.textMuted }]}>
              KPIs
            </Text>
            <View style={styles.kpiGrid}>
              <SimpleKpi
                label="Team Attendance"
                value={fmtPct(dash.teamAttendanceRatePctMTD)}
                sub="month-to-date"
                icon="calendar-outline"
                tint={c.pastelLavender}
                iconColor="#6d28d9"
                theme={theme}
          styles={styles}
              />
              <SimpleKpi
                label="WFH Today"
                value={fmtPct(dash.teamWfhRatioPctToday)}
                sub="of team"
                icon="home-outline"
                tint={c.pastelMint}
                iconColor="#15803d"
                theme={theme}
          styles={styles}
              />
              <SimpleKpi
                label="On-time Tasks"
                value={fmtPct(dash.onTimeTaskDeliveryPct30d)}
                sub="last 30 days"
                icon="checkmark-done-outline"
                tint={c.pastelPink}
                iconColor="#be185d"
                theme={theme}
          styles={styles}
              />
              <SimpleKpi
                label="Avg Hours"
                value={
                  dash.teamAvgHoursPerDay7d != null
                    ? `${dash.teamAvgHoursPerDay7d.toFixed(1)}h`
                    : "—"
                }
                sub="per day, 7d"
                icon="stopwatch-outline"
                tint={c.pastelPeach}
                iconColor="#c2410c"
                theme={theme}
          styles={styles}
              />
            </View>
          </>
        )}

        {/* MY TEAM */}
        <Text style={[styles.section, { color: c.textMuted }]}>
          MY TEAM
        </Text>
        <View style={styles.tileRow}>
          <Tile
            icon="people-outline"
            label="My Team"
            sub="Direct reports & assign tasks"
            tint={c.pastelLavender}
            iconColor="#6d28d9"
            count={dash?.directReports}
            onPress={() => router.push("/manager-team" as any)}
            theme={theme}
          styles={styles}
          />
          <Tile
            icon="list-outline"
            label="My Team Tasks"
            sub="All tasks you assigned"
            tint={c.pastelMint}
            iconColor="#15803d"
            count={dash?.openTasksForReports}
            onPress={() => router.push("/manager-tasks" as any)}
            theme={theme}
          styles={styles}
          />
          <Tile
            icon="calendar-outline"
            label="Team Attendance"
            sub="Day / month view"
            tint={c.pastelSky}
            iconColor="#0369a1"
            onPress={() => router.push("/manager-attendance" as any)}
            theme={theme}
          styles={styles}
          />
          <Tile
            icon="airplane-outline"
            label="Leave Balances"
            sub="Per report"
            tint={c.pastelPeach}
            iconColor="#c2410c"
            onPress={() => router.push("/manager-leave-balances" as any)}
            theme={theme}
          styles={styles}
          />
          <Tile
            icon="bar-chart-outline"
            label="Productivity"
            sub="Open tasks · avg hours"
            tint={c.pastelPink}
            iconColor="#be185d"
            onPress={() => router.push("/manager-productivity" as any)}
            theme={theme}
          styles={styles}
          />
        </View>

        {/* PENDING APPROVALS */}
        <Text style={[styles.section, { color: c.textMuted }]}>
          PENDING APPROVALS
        </Text>
        <View style={styles.tileRow}>
          <Tile
            icon="paper-plane-outline"
            label="Leave requests"
            sub="Approve / reject"
            tint={c.pastelMint}
            iconColor="#0f766e"
            count={dash?.pendingLeaveApprovals}
            onPress={() => router.push("/manager-leaves" as any)}
            theme={theme}
          styles={styles}
          />
          <Tile
            icon="alert-circle-outline"
            label="Corrections"
            sub="Attendance fixes"
            tint={c.pastelYellow}
            iconColor="#a16207"
            count={dash?.pendingCorrectionApprovals}
            onPress={() => router.push("/manager-corrections" as any)}
            theme={theme}
          styles={styles}
          />
          <Tile
            icon="card-outline"
            label="Reimbursements"
            sub="Expense approvals"
            tint={c.pastelSky}
            iconColor="#0369a1"
            count={dash?.pendingReimbursementApprovals}
            onPress={() => router.push("/manager-reimbursements" as any)}
            theme={theme}
          styles={styles}
          />
          <Tile
            icon="document-text-outline"
            label="Manual attendance"
            sub="Missed-day requests"
            tint={c.pastelLavender}
            iconColor="#6d28d9"
            count={dash?.pendingManualAttendanceApprovals}
            onPress={() => router.push("/manager-manual-requests" as any)}
            theme={theme}
          styles={styles}
          />
          <Tile
            icon="time-outline"
            label="Timesheets"
            sub="Weekly approval"
            tint={c.pastelPink}
            iconColor="#be185d"
            count={dash?.pendingTimesheetApprovals}
            onPress={() => router.push("/manager-timesheets" as any)}
            theme={theme}
          styles={styles}
          />
        </View>

        {/* PERFORMANCE */}
        <Text style={[styles.section, { color: c.textMuted }]}>
          PERFORMANCE
        </Text>
        <View style={styles.tileRow}>
          <Tile
            icon="flag-outline"
            label="Goals"
            sub="Set & track"
            tint={c.pastelPeach}
            iconColor="#c2410c"
            onPress={() => router.push("/manager-goals" as any)}
            theme={theme}
          styles={styles}
          />
          <Tile
            icon="star-outline"
            label="Reviews"
            sub="Create & complete"
            tint={c.pastelYellow}
            iconColor="#a16207"
            onPress={() => router.push("/manager-reviews" as any)}
            theme={theme}
          styles={styles}
          />
        </View>
      </ScrollView>

      <BottomTabBar user={me} />
    </SafeAreaView>
  );
}

const fmtPct = (v: number | null | undefined) => {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `${Math.round(v)}%`;
};

const Tile = ({
  icon,
  label,
  sub,
  tint,
  iconColor,
  count,
  onPress,
  theme,
  styles }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub?: string;
  tint: string;
  iconColor: string;
  count?: number;
  onPress: () => void;
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
      <Ionicons name={icon} size={22} color={iconColor} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={[styles.tileLabel, { color: theme.colors.text }]}>
        {label}
      </Text>
      {!!sub && (
        <Text style={[styles.tileSub, { color: theme.colors.textMuted }]}>
          {sub}
        </Text>
      )}
    </View>
    {typeof count === "number" && count > 0 && (
      <View
        style={[
          styles.tileBadge,
          { backgroundColor: theme.colors.dangerText },
        ]}
      >
        <Text style={styles.tileBadgeText}>{count > 99 ? "99+" : count}</Text>
      </View>
    )}
    <Ionicons
      name="chevron-forward"
      size={20}
      color={theme.colors.textMuted}
    />
  </TouchableOpacity>
);

const SimpleKpi = ({
  label,
  value,
  sub,
  icon,
  tint,
  iconColor,
  theme,
  styles }: {
  label: string;
  value: string;
  sub: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  iconColor: string;
  theme: any;
  styles: any;
}) => (
  <View
    style={[
      styles.kpiCell,
      {
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.surfaceBorder,
        shadowColor: theme.colors.shadow },
    ]}
  >
    <View style={[styles.kpiIcon, { backgroundColor: tint }]}>
      <Ionicons name={icon} size={16} color={iconColor} />
    </View>
    <Text style={[styles.kpiValue, { color: theme.colors.text }]}>
      {value}
    </Text>
    <Text style={[styles.kpiLabel, { color: theme.colors.text }]}>
      {label}
    </Text>
    <Text style={[styles.kpiSub, { color: theme.colors.textMuted }]}>
      {sub}
    </Text>
  </View>
);

const makeStyles = (c: any) => StyleSheet.create({
  safe: { flex: 1 },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
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

  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3 },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryValue: { fontSize: 24, fontWeight: "800" },
  summaryLabel: { fontSize: 11, marginTop: 4, letterSpacing: 0.5 },
  summaryDivider: { width: 1, height: 36 },

  section: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginTop: 24,
    marginBottom: 10,
    marginLeft: 4 },

  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpiCell: {
    width: "47%",
    flexGrow: 1,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2 },
  kpiIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8 },
  kpiValue: { fontSize: 22, fontWeight: "800", marginBottom: 4 },
  kpiLabel: { fontSize: 13, fontWeight: "700" },
  kpiSub: { fontSize: 11, marginTop: 2 },

  tileRow: { gap: 10 },
  tile: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2 },
  tileIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center" },
  tileLabel: { fontSize: 15, fontWeight: "800" },
  tileSub: { fontSize: 12, marginTop: 2 },
  tileBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 7,
    alignItems: "center",
    justifyContent: "center" },
  tileBadgeText: { color: c.text, fontSize: 11, fontWeight: "800" } });
