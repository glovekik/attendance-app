import React, { useCallback, useEffect, useState, useMemo} from "react";

import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { teamProductivityReport } from "../src/services/reports";
import { TeamProductivityRow } from "../src/types";

import { useTheme } from "../src/theme/ThemeProvider";
export default function ManagerProductivity() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);
  const [rows, setRows] = useState<TeamProductivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const data = await teamProductivityReport(token);
      setRows(data || []);
    } catch (err: any) {
      Alert.alert(
        "Couldn't load productivity",
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

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}>
          <Ionicons name="arrow-back" size={24} color={c.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Team Productivity</Text>
          <Text style={styles.subtitle}>
            Open tasks · 30-day completion · 7-day avg hours
          </Text>
        </View>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r) => r.userId}
        contentContainerStyle={
          rows.length === 0 ? styles.emptyWrap : { padding: 12 }
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={c.accent}
            colors={[c.accent]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="bar-chart-outline" size={42} color={c.textFaint} />
            <Text style={styles.emptyText}>No direct reports yet.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(item.userName || "?").charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.cardName} numberOfLines={1}>
                {item.userName}
              </Text>
            </View>
            <View style={styles.metricRow}>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>{item.openTasks}</Text>
                <Text style={styles.metricLabel}>Open tasks</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>
                  {item.completedTasksLast30d}
                </Text>
                <Text style={styles.metricLabel}>Done (30d)</Text>
              </View>
              <View style={styles.metric}>
                <Text style={styles.metricValue}>
                  {item.avgHoursPerDayLast7d.toFixed(1)}h
                </Text>
                <Text style={styles.metricLabel}>Avg/day (7d)</Text>
              </View>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

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
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: c.surfaceBorder,
    gap: 12 },
  title: { color: c.text, fontSize: 18, fontWeight: "800" },
  subtitle: { color: c.textMuted, fontSize: 12, marginTop: 2 },

  card: {
    backgroundColor: c.surface,
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: c.accentSoft,
    alignItems: "center",
    justifyContent: "center" },
  avatarText: { color: c.accentText, fontWeight: "700", fontSize: 15 },
  cardName: { color: c.text, fontSize: 14, fontWeight: "700" },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: c.surfaceBorder },
  metric: { alignItems: "center", flex: 1 },
  metricValue: { color: c.text, fontSize: 18, fontWeight: "800" },
  metricLabel: {
    color: c.textMuted,
    fontSize: 10,
    marginTop: 2,
    letterSpacing: 0.3 },

  emptyWrap: { flex: 1, justifyContent: "center" },
  empty: { alignItems: "center", gap: 10, padding: 30 },
  emptyText: {
    color: c.textMuted,
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 30 } });

