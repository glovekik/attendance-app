import React, { useEffect, useState, useCallback, useMemo} from "react";

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
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { getDashboardHr } from "../src/services/dashboard";
import { getMe } from "../src/services/api";
import { DashboardHR, User } from "../src/types";
import { KpiCard } from "../src/components/KpiCard";
import { BottomTabBar } from "../src/components/BottomTabBar";

import { useTheme } from "../src/theme/ThemeProvider";
// CEO console — read-only org-wide KPIs. Reuses HR's dashboard endpoint
// (backend opens it to CEO via require_hr_or_ceo). No write actions
// surface here; any mutate-style buttons belong on the HR Console.
export default function CEOConsole() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);
  const [dash, setDash] = useState<DashboardHR | null>(null);
  const [me, setMe] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const [d, meRes] = await Promise.all([
        getDashboardHr(token),
        getMe(token).catch(() => null),
      ]);
      setDash(d);
      setMe(meRes);
    } catch (err: any) {
      Alert.alert(
        "Couldn't load CEO console",
        err?.message || "Pull down to retry."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#f59e0b" />
      </View>
    );
  }

  const headcount = dash?.totalEmployees ?? 0;
  const present = dash?.presentToday ?? 0;
  const absent = dash?.absentToday ?? 0;
  const onLeave = dash?.onLeaveToday ?? 0;
  const pendingLeaves = dash?.pendingLeaveApprovals ?? 0;
  const pendingCorrections = dash?.pendingCorrectionApprovals ?? 0;
  const presencePct =
    headcount > 0 ? Math.round((present / headcount) * 100) : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        >
          <Ionicons name="chevron-back" size={22} color={c.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>CEO Console</Text>
          <Text style={styles.subtitle}>Read-only · org-wide</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#f59e0b"
            colors={["#f59e0b"]}
          />
        }
      >
        {/* HEADCOUNT */}
        <Text style={styles.section}>HEADCOUNT</Text>
        <View style={styles.bigCard}>
          <Text style={styles.bigValue}>{headcount}</Text>
          <Text style={styles.bigLabel}>active employees</Text>
        </View>

        {/* TODAY */}
        <Text style={styles.section}>TODAY</Text>
        <View style={styles.kpiGrid}>
          <View style={styles.kpi}>
            <Text style={[styles.kpiValue, { color: "#16a34a" }]}>
              {present}
            </Text>
            <Text style={styles.kpiLabel}>Present</Text>
            <Text style={styles.kpiSub}>{presencePct}% of org</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={[styles.kpiValue, { color: "#0d9488" }]}>
              {onLeave}
            </Text>
            <Text style={styles.kpiLabel}>On leave</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={[styles.kpiValue, { color: "#dc2626" }]}>
              {absent}
            </Text>
            <Text style={styles.kpiLabel}>Absent</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={[styles.kpiValue, { color: "#f59e0b" }]}>
              {pendingLeaves + pendingCorrections}
            </Text>
            <Text style={styles.kpiLabel}>Pending approvals</Text>
            <Text style={styles.kpiSub}>
              {pendingLeaves} leaves · {pendingCorrections} corr.
            </Text>
          </View>
        </View>

        {/* VITALS — new KPI strip */}
        {dash && (
          <>
            <Text style={styles.section}>VITALS</Text>
            <View style={styles.kpiStrip}>
              <KpiCard
                label="WFH Today"
                value={dash.wfhToday ?? 0}
                subLabel={`${dash.officeToday ?? 0} in office`}
                icon="home-outline"
                tone="none"
              />
              <KpiCard
                label="Pending Approvals"
                value={dash.pendingApprovalsTotal ?? 0}
                subLabel="all queues"
                icon="hourglass-outline"
                greenAt={0}
                amberAt={10}
                higherIsBetter={false}
              />
              <KpiCard
                label="Pay-cycle Accuracy"
                value={dash.payCycleAccuracyPct ?? "—"}
                unit="%"
                subLabel="latest run"
                icon="cash-outline"
                greenAt={95}
                amberAt={80}
                higherIsBetter
                numericForThreshold={dash.payCycleAccuracyPct ?? undefined}
              />
              <KpiCard
                label="Holidays Set"
                value={dash.holidayCountThisYear ?? 0}
                subLabel="this year"
                icon="calendar-clear-outline"
                greenAt={8}
                amberAt={4}
                higherIsBetter
              />
              <KpiCard
                label="Late Arrivals"
                value={dash.lateArrivalRatePct ?? "—"}
                unit="%"
                subLabel="last 30 days"
                icon="alert-circle-outline"
                greenAt={10}
                amberAt={25}
                higherIsBetter={false}
                numericForThreshold={dash.lateArrivalRatePct ?? undefined}
              />
            </View>
          </>
        )}

        {/* PAYROLL */}
        {dash?.payrollStatus && (
          <>
            <Text style={styles.section}>CURRENT PAYROLL</Text>
            <View style={styles.payCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.payMonth}>
                  {new Date(
                    dash.payrollStatus.year,
                    dash.payrollStatus.month - 1,
                    1
                  ).toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric" })}
                </Text>
                <Text style={styles.paySub}>
                  Status: {dash.payrollStatus.status}
                </Text>
              </View>
              <Ionicons name="cash-outline" size={32} color="#16a34a" />
            </View>
          </>
        )}

        {/* DEPARTMENT DISTRIBUTION */}
        {dash?.employeeDistribution &&
          dash.employeeDistribution.length > 0 && (
            <>
              <Text style={styles.section}>BY DEPARTMENT</Text>
              <View style={styles.listCard}>
                {dash.employeeDistribution.map((row) => (
                  <View
                    key={row.departmentId || "unassigned"}
                    style={styles.listRow}
                  >
                    <Text style={styles.listLabel} numberOfLines={1}>
                      {row.departmentName || "Unassigned"}
                    </Text>
                    <Text style={styles.listValue}>{row.count}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

        {/* UPCOMING BIRTHDAYS */}
        {dash?.upcomingBirthdays && dash.upcomingBirthdays.length > 0 && (
          <>
            <Text style={styles.section}>UPCOMING BIRTHDAYS</Text>
            <View style={styles.listCard}>
              {dash.upcomingBirthdays.map((b) => (
                <View key={b.id} style={styles.listRow}>
                  <Text style={styles.listLabel} numberOfLines={1}>
                    {b.name}
                  </Text>
                  <Text style={styles.listValue}>{b.birthday}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* QUICK LINKS */}
        <Text style={styles.section}>EXPLORE</Text>
        <View style={styles.linkGrid}>
          <LinkTile
            icon="people-outline"
            color="#db2777"
            title="Employees"
            onPress={() => router.push("/users")}
            styles={styles}
          />
          <LinkTile
            icon="cash-outline"
            color="#16a34a"
            title="Payroll"
            onPress={() => router.push("/payroll")}
            styles={styles}
          />
          <LinkTile
            icon="bar-chart-outline"
            color="#0ea5e9"
            title="Reports"
            onPress={() => router.push("/hr-reports" as any)}
            styles={styles}
          />
          <LinkTile
            icon="receipt-outline"
            color="#f59e0b"
            title="Expenses"
            onPress={() => router.push("/expenses")}
            styles={styles}
          />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
      <BottomTabBar user={me} />
    </SafeAreaView>
  );
}

interface LinkTileProps {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  onPress: () => void;
  styles: any;
}

const LinkTile = ({ icon, color, title, onPress, styles }: LinkTileProps) => (
  <TouchableOpacity
    style={styles.linkTile}
    onPress={onPress}
    activeOpacity={0.85}
  >
    <View style={[styles.linkIcon, { backgroundColor: color }]}>
      <Ionicons name={icon} size={20} color="#fff" />
    </View>
    <Text style={styles.linkTitle}>{title}</Text>
  </TouchableOpacity>
);

const makeStyles = (c: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  loader: {
    flex: 1,
    backgroundColor: c.bg,
    justifyContent: "center",
    alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: c.surfaceBorder },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: c.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  title: { color: c.text, fontSize: 22, fontWeight: "800" },
  subtitle: { color: c.textMuted, fontSize: 12, marginTop: 3 },

  content: { padding: 16 },
  section: {
    color: c.textMuted,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "700",
    marginTop: 18,
    marginBottom: 10 },

  bigCard: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 22,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    alignItems: "center" },
  bigValue: {
    color: c.text,
    fontSize: 48,
    fontWeight: "900",
    letterSpacing: -1 },
  bigLabel: {
    color: c.textMuted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
    letterSpacing: 0.5,
    textTransform: "uppercase" },

  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpiStrip: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 6 },
  kpi: {
    width: "47%",
    flexGrow: 1,
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  kpiValue: { fontSize: 26, fontWeight: "800" },
  kpiLabel: {
    color: c.textMuted,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 4,
    letterSpacing: 0.4,
    textTransform: "uppercase" },
  kpiSub: { color: c.textMuted, fontSize: 10, marginTop: 3 },

  payCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    gap: 12 },
  payMonth: { color: c.text, fontSize: 16, fontWeight: "800" },
  paySub: { color: c.textMuted, fontSize: 12, marginTop: 3 },

  listCard: {
    backgroundColor: c.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    overflow: "hidden" },
  listRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: c.surfaceBorder },
  listLabel: { color: c.text, fontSize: 13, fontWeight: "600", flex: 1 },
  listValue: { color: c.textMuted, fontSize: 13, fontWeight: "700" },

  linkGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  linkTile: {
    width: "48%",
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    flexDirection: "row",
    alignItems: "center",
    gap: 10 },
  linkIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center" },
  linkTitle: { color: c.text, fontSize: 13, fontWeight: "700", flex: 1 } });

