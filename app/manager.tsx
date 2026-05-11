import React, { useEffect, useState, useCallback } from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  listManagerLeaves,
  listManagerCorrections,
  listManagerReimbursements,
  listManagerTimesheets,
} from "../src/services/manager";
import { getDashboardManager } from "../src/services/dashboard";
import { DashboardManager } from "../src/types";

interface CountTileProps {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  desc: string;
  count: number;
  onPress: () => void;
}

const CountTile = ({
  icon,
  color,
  title,
  desc,
  count,
  onPress,
}: CountTileProps) => (
  <TouchableOpacity
    style={styles.card}
    onPress={onPress}
    activeOpacity={0.85}
  >
    <View style={[styles.iconBox, { backgroundColor: color }]}>
      <Ionicons name={icon} size={22} color="#fff" />
    </View>
    <View style={styles.cardBody}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardDesc}>{desc}</Text>
    </View>
    {count > 0 && (
      <View style={styles.countPill}>
        <Text style={styles.countText}>{count}</Text>
      </View>
    )}
    <Ionicons name="chevron-forward" size={22} color="#64748b" />
  </TouchableOpacity>
);

export default function ManagerHub() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingLeave, setPendingLeave] = useState(0);
  const [pendingCorrection, setPendingCorrection] = useState(0);
  const [pendingReimb, setPendingReimb] = useState(0);
  const [pendingTimesheet, setPendingTimesheet] = useState(0);
  const [dash, setDash] = useState<DashboardManager | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      // Try dashboard first — it gives leave + correction counts in one call.
      try {
        const d = await getDashboardManager(token);
        setDash(d);
        setPendingLeave(d.pendingLeaveApprovals || 0);
        setPendingCorrection(d.pendingCorrectionApprovals || 0);
      } catch {
        // Fall back to raw lists if dashboard endpoint fails.
        const [leaves, corrections] = await Promise.all([
          listManagerLeaves(token).catch(() => []),
          listManagerCorrections(token).catch(() => []),
        ]);
        setPendingLeave(leaves.length);
        setPendingCorrection(corrections.length);
      }
      const [reimb, timesheets] = await Promise.all([
        listManagerReimbursements(token).catch(() => []),
        listManagerTimesheets(token).catch(() => []),
      ]);
      setPendingReimb(reimb.length);
      setPendingTimesheet(timesheets.length);
    } catch (err) {
      console.log("manager hub load error", err);
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

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Manager Approvals</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3b82f6"
            colors={["#3b82f6"]}
          />
        }
      >
        {dash && (
          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>
                  {dash.directReports}
                </Text>
                <Text style={styles.summaryLabel}>Direct reports</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>
                  {dash.openTasksForReports}
                </Text>
                <Text style={styles.summaryLabel}>Open tasks</Text>
              </View>
            </View>
          </View>
        )}

        <Text style={styles.section}>PENDING APPROVALS</Text>
        <CountTile
          icon="airplane-outline"
          color="#0d9488"
          title="Leave requests"
          desc="Approve or reject team leaves"
          count={pendingLeave}
          onPress={() => router.push("/manager-leaves" as any)}
        />
        <CountTile
          icon="create-outline"
          color="#f59e0b"
          title="Attendance corrections"
          desc="Approve corrected check-out times"
          count={pendingCorrection}
          onPress={() =>
            router.push("/manager-corrections" as any)
          }
        />
        <CountTile
          icon="card-outline"
          color="#3b82f6"
          title="Reimbursements"
          desc="Approve expense reimbursements"
          count={pendingReimb}
          onPress={() =>
            router.push("/manager-reimbursements" as any)
          }
        />
        <CountTile
          icon="time-outline"
          color="#6366f1"
          title="Timesheets"
          desc="Approve weekly timesheets"
          count={pendingTimesheet}
          onPress={() =>
            router.push("/manager-timesheets" as any)
          }
        />

        <Text style={styles.section}>PERFORMANCE</Text>
        <CountTile
          icon="flag-outline"
          color="#f59e0b"
          title="Goals"
          desc="Set & track goals for your reports"
          count={0}
          onPress={() => router.push("/manager-goals" as any)}
        />
        <CountTile
          icon="star-outline"
          color="#eab308"
          title="Reviews"
          desc="Create & complete performance reviews"
          count={0}
          onPress={() => router.push("/manager-reviews" as any)}
        />

        {dash?.upcomingDeadlines && dash.upcomingDeadlines.length > 0 && (
          <>
            <Text style={styles.section}>UPCOMING DEADLINES</Text>
            {dash.upcomingDeadlines.map((t) => (
              <View key={t.id} style={styles.card}>
                <View
                  style={[
                    styles.iconBox,
                    { backgroundColor: "#7c3aed" },
                  ]}
                >
                  <Ionicons
                    name="alert-circle-outline"
                    size={22}
                    color="#fff"
                  />
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle}>{t.title}</Text>
                  <Text style={styles.cardDesc}>
                    {t.dueDate ? `Due ${t.dueDate}` : "No due date"}
                    {t.priority ? ` · ${t.priority}` : ""}
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b1220" },
  loader: {
    flex: 1,
    backgroundColor: "#0b1220",
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
    gap: 12,
  },
  title: { color: "#fff", fontSize: 18, fontWeight: "800", flex: 1 },
  content: { padding: 16 },
  summary: {
    backgroundColor: "#0f172a",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1e293b",
    marginBottom: 18,
  },
  summaryRow: { flexDirection: "row", gap: 18 },
  summaryItem: { flex: 1 },
  summaryValue: { color: "#fff", fontSize: 26, fontWeight: "800" },
  summaryLabel: { color: "#94a3b8", fontSize: 11, marginTop: 4 },
  section: {
    color: "#64748b",
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 10,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#1f2937",
    gap: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: { flex: 1 },
  cardTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  cardDesc: { color: "#94a3b8", fontSize: 12, marginTop: 3 },
  countPill: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    minWidth: 28,
    alignItems: "center",
  },
  countText: { color: "#fff", fontSize: 12, fontWeight: "800" },
});
