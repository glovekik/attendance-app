import React, { useCallback, useEffect, useMemo, useState } from "react";

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

import {
  listManagerTasks,
  deleteManagerTask,
  ManagerTask } from "../src/services/managerTeam";
import { TaskStatus } from "../src/types";
import { confirmAction, notify } from "../src/utils/confirm";
import { useTheme } from "../src/theme/ThemeProvider";
import {
  taskPriorityColor,
  taskStatusColor } from "../src/theme/statusColors";

const STATUS_FILTERS: (TaskStatus | "ALL")[] = [
  "ALL",
  "PENDING",
  "ONGOING",
  "COMPLETED",
];

export default function ManagerTasks() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);
  const [tasks, setTasks] = useState<ManagerTask[]>([]);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "ALL">(
    "ALL"
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const data = await listManagerTasks(token, {
        status: statusFilter === "ALL" ? undefined : statusFilter });
      setTasks(data || []);
    } catch (err: any) {
      Alert.alert(
        "Couldn't load tasks",
        err?.message || "Pull down to retry."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, router]);

  useEffect(() => {
    load();
  }, [load]);

  const onDelete = async (t: ManagerTask) => {
    const ok = await confirmAction({
      title: "Delete task?",
      message: `"${t.title}" — this can't be undone.`,
      confirmLabel: "Delete",
      destructive: true });
    if (!ok) return;
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await deleteManagerTask(token, t.id);
      setTasks((prev) => prev.filter((x) => x.id !== t.id));
    } catch (err: any) {
      notify("Delete failed", err?.message || "");
    }
  };

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
          <Text style={styles.title}>My Team Tasks</Text>
          <Text style={styles.subtitle}>{tasks.length} task(s)</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push("/manager-team" as any)}
        >
          <Ionicons name="people-outline" size={24} color={c.accent} />
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((s) => (
          <TouchableOpacity
            key={s}
            style={[
              styles.filterChip,
              statusFilter === s && styles.filterChipActive,
            ]}
            onPress={() => setStatusFilter(s)}
          >
            <Text
              style={[
                styles.filterText,
                statusFilter === s && styles.filterTextActive,
              ]}
            >
              {s}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(t) => t.id}
        contentContainerStyle={
          tasks.length === 0 ? styles.emptyWrap : { padding: 12 }
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
            <Ionicons name="checkbox-outline" size={42} color={c.textFaint} />
            <Text style={styles.emptyText}>No tasks yet.</Text>
            <Text style={styles.emptyHint}>
              Open My Team to assign one to a direct report.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const sc = taskStatusColor(item.status, c);
          const pc = taskPriorityColor(item.priority || "MEDIUM", c);
          return (
            <View style={styles.card}>
              <View
                style={[
                  styles.priorityStripe,
                  { backgroundColor: pc.solid },
                ]}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.cardMeta}>
                  Assigned to {item.assignee?.name || "—"}
                  {item.dueDate ? ` · Due ${item.dueDate}` : ""}
                </Text>
                {!!item.description && (
                  <Text style={styles.cardDesc} numberOfLines={2}>
                    {item.description}
                  </Text>
                )}
                <View style={{ flexDirection: "row", gap: 6, marginTop: 6 }}>
                  <View
                    style={[styles.statusPill, { backgroundColor: sc.bg }]}
                  >
                    <Text style={[styles.statusText, { color: sc.fg }]}>
                      {item.status}
                    </Text>
                  </View>
                  <View
                    style={[styles.statusPill, { backgroundColor: pc.bg }]}
                  >
                    <Text style={[styles.statusText, { color: pc.fg }]}>
                      {item.priority || "MEDIUM"}
                    </Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => onDelete(item)}
                style={styles.iconBtn}
                hitSlop={10}
              >
                <Ionicons
                  name="trash-outline"
                  size={18}
                  color={c.dangerText}
                />
              </TouchableOpacity>
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
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: c.surfaceBorder },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: c.surfaceMuted,
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  filterChipActive: { backgroundColor: c.accent, borderColor: c.accent },
  filterText: { color: c.textMuted, fontSize: 11, fontWeight: "700" },
  filterTextActive: { color: c.text },
  card: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: c.surface,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    overflow: "hidden" },
  priorityStripe: { width: 4 },
  cardTitle: {
    color: c.text,
    fontSize: 14,
    fontWeight: "700",
    paddingTop: 12,
    paddingHorizontal: 12 },
  cardMeta: {
    color: c.textMuted,
    fontSize: 11,
    paddingHorizontal: 12,
    marginTop: 4 },
  cardDesc: {
    color: c.textMuted,
    fontSize: 11,
    paddingHorizontal: 12,
    marginTop: 4 },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 12 },
  statusText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5 },
  iconBtn: { padding: 14, justifyContent: "center" },
  emptyWrap: { flex: 1, justifyContent: "center" },
  empty: { alignItems: "center", gap: 10, padding: 30 },
  emptyText: { color: c.text, fontSize: 14, fontWeight: "700" },
  emptyHint: {
    color: c.textMuted,
    fontSize: 12,
    textAlign: "center",
    paddingHorizontal: 30 } });

