import React, { useEffect, useMemo, useState, useCallback } from "react";

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
  listNotifications,
  markRead,
  markAllRead } from "../src/services/inbox";
import { openNotificationStream } from "../src/services/sse";
import { NotificationItem } from "../src/types";
import { useTheme } from "../src/theme/ThemeProvider";

const iconForType = (
  type: string
): keyof typeof Ionicons.glyphMap => {
  if (type.startsWith("leave")) return "airplane-outline";
  if (type.startsWith("correction")) return "create-outline";
  if (type.startsWith("task")) return "checkbox-outline";
  if (type.startsWith("reimbursement")) return "card-outline";
  if (type.startsWith("timesheet")) return "time-outline";
  if (type.startsWith("interview")) return "people-outline";
  if (type.startsWith("offer")) return "mail-outline";
  if (type.startsWith("goal")) return "flag-outline";
  if (type.startsWith("review")) return "star-outline";
  if (type.startsWith("feedback")) return "chatbubbles-outline";
  return "notifications-outline";
};

const colorForType = (type: string): string => {
  if (type.startsWith("leave")) return "#0d9488";
  if (type.startsWith("correction")) return "#f59e0b";
  if (type.startsWith("task")) return "#16a34a";
  if (type.startsWith("reimbursement")) return "#3b82f6";
  if (type.startsWith("timesheet")) return "#6366f1";
  if (type.startsWith("interview")) return "#8b5cf6";
  if (type.startsWith("offer")) return "#ec4899";
  if (type.startsWith("goal")) return "#06b6d4";
  if (type.startsWith("review")) return "#eab308";
  if (type.startsWith("feedback")) return "#a855f7";
  return "#64748b";
};

const formatRelative = (iso: string): string => {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [marking, setMarking] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const data = await listNotifications(token, { limit: 100 });
      setItems(data || []);
    } catch (err: any) {
      Alert.alert(
        "Couldn't load notifications",
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

  // Re-render relative timestamps every minute so "just now" / "3m ago"
  // don't get stuck while the screen is open.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Live updates via SSE. New notifications get prepended (dedup by id);
  // when the stream falls back to polling we just reload.
  useEffect(() => {
    let cleanup: (() => void) | null = null;
    (async () => {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      cleanup = openNotificationStream(token, {
        onNotification: (payload) => {
          if (payload && payload.poll) {
            load();
            return;
          }
          if (!payload || !payload.id) return;
          const incoming = payload as NotificationItem;
          setItems((prev) => {
            if (prev.some((x) => x.id === incoming.id)) return prev;
            return [incoming, ...prev];
          });
        } });
    })();
    return () => {
      if (cleanup) cleanup();
    };
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const onTap = async (n: NotificationItem) => {
    if (!n.read) {
      try {
        const token = await AsyncStorage.getItem("token");
        if (token) {
          await markRead(token, n.id);
          setItems((prev) =>
            prev.map((x) => (x.id === n.id ? { ...x, read: true } : x))
          );
        }
      } catch {
        // best effort
      }
    }
    // Deep-link based on type/data
    const d = n.data || {};
    if (n.type.startsWith("leave")) router.push("/leaves");
    else if (n.type.startsWith("correction"))
      router.push("/corrections");
    else if (n.type.startsWith("task")) {
      if (d.taskId) router.push(`/tasks/${d.taskId}`);
      else router.push("/tasks");
    } else if (n.type.startsWith("reimbursement"))
      router.push("/expenses");
    else if (n.type.startsWith("timesheet")) router.push("/");
    // others: stay on screen
  };

  const onMarkAll = async () => {
    if (marking) return;
    setMarking(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await markAllRead(token);
      setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    } catch (err: any) {
      Alert.alert("Could not mark all as read", err?.message || "");
    } finally {
      setMarking(false);
    }
  };

  const unreadCount = items.filter((n) => !n.read).length;

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
        <Text style={styles.title}>Notifications</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity
            onPress={onMarkAll}
            disabled={marking}
            style={styles.markAll}
          >
            <Text style={styles.markAllText}>
              {marking ? "..." : "Mark all read"}
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 90 }} />
        )}
      </View>

      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        contentContainerStyle={
          items.length === 0
            ? styles.emptyWrap
            : { paddingVertical: 8 }
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={c.accent}
            colors={[c.accent]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons
              name="notifications-off-outline"
              size={42}
              color={c.textFaint}
            />
            <Text style={styles.emptyText}>No notifications yet</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.row,
              !item.read && styles.rowUnread,
            ]}
            onPress={() => onTap(item)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.iconBox,
                { backgroundColor: colorForType(item.type) },
              ]}
            >
              <Ionicons
                name={iconForType(item.type)}
                size={18}
                color="#fff"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.rowBody} numberOfLines={2}>
                {item.body}
              </Text>
              <Text style={styles.rowTime}>
                {formatRelative(item.createdAt)}
              </Text>
            </View>
            {!item.read && <View style={styles.dot} />}
          </TouchableOpacity>
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
  title: { color: c.text, fontSize: 18, fontWeight: "800", flex: 1 },
  markAll: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: c.surfaceMuted },
  markAllText: { color: c.text, fontSize: 11, fontWeight: "700" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: c.surfaceBorder },
  rowUnread: { backgroundColor: c.accentSoft },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center" },
  rowTitle: { color: c.text, fontSize: 14, fontWeight: "700" },
  rowBody: { color: c.textMuted, fontSize: 12, marginTop: 2 },
  rowTime: { color: c.textMuted, fontSize: 10, marginTop: 4 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: c.accent },
  emptyWrap: { flex: 1, justifyContent: "center" },
  empty: { alignItems: "center", gap: 10 },
  emptyText: { color: c.textMuted, fontSize: 14 } });

