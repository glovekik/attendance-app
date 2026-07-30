import React, { useCallback, useEffect, useState, useMemo} from "react";

import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
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
import { Avatar } from "../src/components/Avatar";

// Semantic tones: workload (amber), output (green), effort (blue).
const TONE = { open: "#F59E0B", done: "#16A34A", hours: "#2563EB" };

export default function ManagerProductivity() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);
  const [rows, setRows] = useState<TeamProductivityRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const nameOf = (r: TeamProductivityRow) =>
    r.userName || (r as any).name || "Unknown";
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((r) => nameOf(r).toLowerCase().includes(q)) : rows;
  }, [rows, query]);

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

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={17} color={c.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search a person…"
            placeholderTextColor={c.textFaint}
          />
          {query.length > 0 && (
            <TouchableOpacity hitSlop={8} onPress={() => setQuery("")}>
              <Ionicons name="close-circle" size={17} color={c.textFaint} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(r) => r.userId}
        contentContainerStyle={
          filtered.length === 0 ? styles.emptyWrap : { padding: 12 }
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
        renderItem={({ item }) => {
          const name = item.userName || (item as any).name || "Unknown";
          const code = (item as any).employeeCode || (item as any).empCode || "";
          const tiles = [
            {
              icon: "albums-outline" as const,
              value: String(item.openTasks),
              label: "Open tasks",
              tone: TONE.open,
            },
            {
              icon: "checkmark-done-outline" as const,
              value: String(item.completedTasksLast30d),
              label: "Done · 30d",
              tone: TONE.done,
            },
            {
              icon: "time-outline" as const,
              value: `${item.avgHoursPerDayLast7d.toFixed(1)}h`,
              label: "Avg/day · 7d",
              tone: TONE.hours,
            },
          ];
          return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Avatar
                  name={name}
                  uri={(item as any).profilePictureUrl}
                  size={44}
                />
                <View style={styles.cardWho}>
                  <Text style={styles.cardName} numberOfLines={1}>
                    {name}
                  </Text>
                  <Text style={styles.cardMeta} numberOfLines={1}>
                    {code ? `${code} · ` : ""}Direct report
                  </Text>
                </View>
              </View>
              <View style={styles.metricRow}>
                {tiles.map((t) => (
                  <View
                    key={t.label}
                    style={[styles.tile, { backgroundColor: t.tone + "14" }]}
                  >
                    <Ionicons name={t.icon} size={15} color={t.tone} />
                    <Text style={[styles.tileValue, { color: t.tone }]}>
                      {t.value}
                    </Text>
                    <Text style={styles.tileLabel}>{t.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        }}
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

  searchRow: { paddingHorizontal: 12, paddingTop: 12 },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: c.surfaceMuted,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42 },
  searchInput: { flex: 1, color: c.text, fontSize: 14, padding: 0 },

  card: {
    backgroundColor: c.surface,
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12 },
  cardWho: { flex: 1, minWidth: 0 },
  cardName: { color: c.text, fontSize: 15, fontWeight: "800" },
  cardMeta: {
    color: c.textMuted,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 1 },
  metricRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14 },
  tile: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 12,
    gap: 3 },
  tileValue: { fontSize: 19, fontWeight: "900", marginTop: 1 },
  tileLabel: {
    color: c.textMuted,
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: 0.2 },

  emptyWrap: { flex: 1, justifyContent: "center" },
  empty: { alignItems: "center", gap: 10, padding: 30 },
  emptyText: {
    color: c.textMuted,
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 30 } });

