import React, { useCallback, useEffect, useMemo, useState } from "react";

import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  Platform,
  Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  listTeamAttendance,
  listMyTeam,
  TeamAttendanceRow,
  TeamMember } from "../src/services/managerTeam";
import { dateToYMD, WebDateField } from "../src/components/WebDateField";
import { useTheme } from "../src/theme/ThemeProvider";
import { attendanceStatusColor } from "../src/theme/statusColors";

const isWeb = Platform.OS === "web";

const formatHM = (iso?: string | null) => {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit" });
  } catch {
    return "-";
  }
};

const todayYMD = () => dateToYMD(new Date());
const todayMonth = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${m}`;
};

type Mode = "day" | "month";

export default function ManagerAttendance() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);
  const [mode, setMode] = useState<Mode>("day");
  const [date, setDate] = useState<string>(todayYMD());
  const [month, setMonth] = useState<string>(todayMonth());
  const [rows, setRows] = useState<TeamAttendanceRow[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const filters: any = {};
      if (mode === "day") filters.date = date;
      else filters.month = month;
      if (selectedUserId) filters.userId = selectedUserId;

      const [list, members] = await Promise.all([
        listTeamAttendance(token, filters),
        listMyTeam(token).catch(() => [] as TeamMember[]),
      ]);
      setRows(list || []);
      setTeam(members || []);
    } catch (err: any) {
      Alert.alert(
        "Couldn't load team attendance",
        err?.message || "Pull down to retry."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [mode, date, month, selectedUserId, router]);

  useEffect(() => {
    load();
  }, [load]);

  const selectedName = useMemo(
    () => team.find((u) => u.id === selectedUserId)?.name || "All reports",
    [team, selectedUserId]
  );

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
          <Text style={styles.title}>Team Attendance</Text>
          <Text style={styles.subtitle}>{rows.length} records</Text>
        </View>
      </View>

      <View style={styles.filterBar}>
        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === "day" && styles.modeActive]}
            onPress={() => setMode("day")}
          >
            <Text
              style={[
                styles.modeText,
                mode === "day" && styles.modeTextActive,
              ]}
            >
              Day
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === "month" && styles.modeActive]}
            onPress={() => setMode("month")}
          >
            <Text
              style={[
                styles.modeText,
                mode === "month" && styles.modeTextActive,
              ]}
            >
              Month
            </Text>
          </TouchableOpacity>
        </View>

        {mode === "day" ? (
          isWeb ? (
            <View style={styles.dateRow}>
              <Ionicons name="calendar-outline" size={16} color={c.textMuted} />
              <WebDateField
                mode="date"
                value={date}
                onChange={(v) => v && setDate(v)}
              />
            </View>
          ) : (
            <View style={styles.dateRow}>
              <Ionicons name="calendar-outline" size={16} color={c.textMuted} />
              <TextInput
                style={styles.dateInput}
                value={date}
                onChangeText={setDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={c.textFaint}
                autoCapitalize="none"
              />
            </View>
          )
        ) : (
          <View style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={16} color="#94a3b8" />
            <TextInput
              style={styles.dateInput}
              value={month}
              onChangeText={setMonth}
              placeholder="YYYY-MM"
              placeholderTextColor={c.textFaint}
              autoCapitalize="none"
            />
          </View>
        )}

        <View style={styles.userChips}>
          <TouchableOpacity
            style={[
              styles.userChip,
              !selectedUserId && styles.userChipActive,
            ]}
            onPress={() => setSelectedUserId(null)}
          >
            <Text
              style={[
                styles.userChipText,
                !selectedUserId && styles.userChipTextActive,
              ]}
            >
              All
            </Text>
          </TouchableOpacity>
          {team.map((u) => (
            <TouchableOpacity
              key={u.id}
              style={[
                styles.userChip,
                selectedUserId === u.id && styles.userChipActive,
              ]}
              onPress={() =>
                setSelectedUserId(selectedUserId === u.id ? null : u.id)
              }
            >
              <Text
                style={[
                  styles.userChipText,
                  selectedUserId === u.id && styles.userChipTextActive,
                ]}
                numberOfLines={1}
              >
                {u.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {selectedUserId && (
          <Text style={styles.activeFilter}>Filtered to {selectedName}</Text>
        )}
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        contentContainerStyle={
          rows.length === 0
            ? styles.emptyWrap
            : { padding: 12, paddingBottom: 60 }
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
            <Ionicons name="calendar-clear-outline" size={42} color={c.textFaint} />
            <Text style={styles.emptyText}>
              No attendance records for the selected filters.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(item.user?.name || "?").charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowName}>
                {item.user?.name || item.userId}
              </Text>
              <Text style={styles.rowMeta}>
                {item.date}
                {item.attendanceType ? ` · ${item.attendanceType}` : ""}
              </Text>
              <Text style={styles.rowMeta}>
                In {formatHM(item.checkIn)} · Out {formatHM(item.checkOut)}
                {item.hoursWorked
                  ? ` · ${item.hoursWorked.toFixed(2)}h`
                  : ""}
              </Text>
            </View>
            {(() => {
              const tone = item.isLate
                ? { bg: c.warningBg, fg: c.warningText }
                : attendanceStatusColor(item.status, c);
              return (
                <View
                  style={[styles.statusPill, { backgroundColor: tone.bg }]}
                >
                  <Text style={[styles.statusText, { color: tone.fg }]}>
                    {item.isLate ? "LATE" : item.status}
                  </Text>
                </View>
              );
            })()}
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

  filterBar: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: c.surfaceBorder },
  modeRow: { flexDirection: "row", gap: 6 },
  modeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: c.surfaceMuted,
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  modeActive: { backgroundColor: c.accent, borderColor: c.accent },
  modeText: { color: c.textMuted, fontSize: 12, fontWeight: "700" },
  modeTextActive: { color: c.text },

  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surfaceMuted,
    borderRadius: 10,
    paddingHorizontal: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  dateInput: {
    flex: 1,
    color: c.text,
    paddingVertical: 8,
    fontSize: 13 },

  userChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4 },
  userChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: c.surfaceMuted,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    maxWidth: 140 },
  userChipActive: { backgroundColor: c.accent, borderColor: c.accent },
  userChipText: { color: c.textMuted, fontSize: 11, fontWeight: "700" },
  userChipTextActive: { color: c.text },
  activeFilter: {
    color: c.accentText,
    fontSize: 11,
    fontStyle: "italic",
    marginTop: 2 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surface,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    gap: 12 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: c.accentSoft,
    alignItems: "center",
    justifyContent: "center" },
  avatarText: { color: c.accentText, fontWeight: "700" },
  rowName: { color: c.text, fontSize: 14, fontWeight: "700" },
  rowMeta: { color: c.textMuted, fontSize: 11, marginTop: 2 },

  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999 },
  statusText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5 },

  emptyWrap: { flex: 1, justifyContent: "center" },
  empty: { alignItems: "center", gap: 10, padding: 30 },
  emptyText: {
    color: c.textMuted,
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 30 } });

