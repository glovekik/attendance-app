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

import { useTheme } from "../src/theme/ThemeProvider";
import { Avatar } from "../src/components/Avatar";
import { formatDays } from "../src/utils/leaveDays";
import {
  listTeamLeaveBalances,
  TeamLeaveBalanceRow } from "../src/services/managerTeam";

export default function ManagerLeaveBalances() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);
  const [rows, setRows] = useState<TeamLeaveBalanceRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        (r.user.name || "").toLowerCase().includes(q) ||
        (r.user.email || "").toLowerCase().includes(q) ||
        (r.user.employeeCode || "").toLowerCase().includes(q)
    );
  }, [rows, query]);

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const data = await listTeamLeaveBalances(token);
      setRows(data || []);
    } catch (err: any) {
      Alert.alert(
        "Couldn't load team balances",
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
        <ActivityIndicator size="large" color="#0d9488" />
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
          <Text style={styles.title}>Team Leave Balances</Text>
          <Text style={styles.subtitle}>
            {rows.length} report{rows.length === 1 ? "" : "s"}
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
        keyExtractor={(r) => r.user.id}
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
            tintColor="#0d9488"
            colors={["#0d9488"]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="airplane-outline" size={42} color={c.textFaint} />
            <Text style={styles.emptyText}>
              No direct reports — or balances haven&apos;t been seeded yet.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Avatar
                name={item.user.name}
                uri={item.user.profilePictureUrl}
                size={38}
                bg="#0d9488"
                fg="#fff"
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{item.user.name}</Text>
                <Text style={styles.cardSub}>
                  {item.user.email}
                  {item.user.employeeCode ? ` · ${item.user.employeeCode}` : ""}
                </Text>
              </View>
            </View>

            {item.balances.length === 0 ? (
              <Text style={styles.muted}>No balances allocated.</Text>
            ) : (
              <View style={styles.balanceGrid}>
                {item.balances.map((b) => {
                  const remaining = Number(b.remaining ?? 0);
                  const allocated = Number(b.allocated ?? 0);
                  return (
                    <View
                      key={`${item.user.id}-${b.leaveTypeCode}`}
                      style={styles.balanceCell}
                    >
                      <Text style={styles.balanceCode} numberOfLines={1}>
                        {b.leaveType?.name || b.leaveTypeCode}
                      </Text>
                      <Text style={styles.balanceVal}>
                        {formatDays(remaining)}
                      </Text>
                      <Text style={styles.balanceUnit}>
                        of {formatDays(allocated)}
                      </Text>
                      {Number(b.pending ?? 0) > 0 && (
                        <Text style={styles.pending}>
                          {formatDays(b.pending)} pending
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
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
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    gap: 10 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardName: { color: c.text, fontSize: 14, fontWeight: "700" },
  cardSub: { color: c.textMuted, fontSize: 11, marginTop: 2 },
  muted: { color: c.textMuted, fontSize: 12, fontStyle: "italic" },

  balanceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8 },
  balanceCell: {
    backgroundColor: c.surfaceMuted,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    minWidth: 100,
    flex: 1 },
  balanceCode: {
    color: c.textMuted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5 },
  balanceVal: {
    color: c.text,
    fontSize: 22,
    fontWeight: "800",
    marginTop: 4 },
  balanceUnit: { color: c.textMuted, fontSize: 11 },
  pending: { color: "#fbbf24", fontSize: 10, fontWeight: "700", marginTop: 2 },

  emptyWrap: { flex: 1, justifyContent: "center" },
  empty: { alignItems: "center", gap: 10, padding: 30 },
  emptyText: {
    color: c.textMuted,
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 30 } });

