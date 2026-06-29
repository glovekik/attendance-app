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
  Alert,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  hrListAttendance,
  HrAttendanceRow,
} from "../src/services/hrAttendance";
import { listUsers } from "../src/services/users";
import { User } from "../src/types";
import { dateToYMD, WebDateField } from "../src/components/WebDateField";
import { DatePickerField } from "../src/components/DatePickerField";
import { useTheme } from "../src/theme/ThemeProvider";
import { attendanceStatusColor } from "../src/theme/statusColors";
import { useResponsive, getResponsiveSpacing } from "../src/utils/responsive";
import { PageHeader } from "../src/components/PageHeader";
import { DataTable, Column } from "../src/components/DataTable";
import { StatusBadge, Avatar } from "../src/components/ProUI";

const isWeb = Platform.OS === "web";

const formatHM = (iso?: string | null) => {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit" });
  } catch {
    return "-";
  }
};

// YYYY-MM helpers — kept inline so the screen has no extra deps.
const todayYMD = () => dateToYMD(new Date());
const yesterdayYMD = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dateToYMD(d);
};
const todayMonth = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${m}`;
};

type Mode = "day" | "month";

export default function HrAttendance() {
  const router = useRouter();
  const { theme } = useTheme();
  const responsive = useResponsive();
  const spacing = getResponsiveSpacing(responsive.breakpoint);
  const isDesktop = responsive.isDesktop;
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c, isDesktop), [c, isDesktop]);
  const [mode, setMode] = useState<Mode>("day");
  const [date, setDate] = useState<string>(todayYMD());
  const [month, setMonth] = useState<string>(todayMonth());
  const [rows, setRows] = useState<HrAttendanceRow[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
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

      const [list, allUsers] = await Promise.all([
        hrListAttendance(token, filters),
        // Cache users locally for the picker; cheap to re-fetch.
        listUsers(token).catch(() => [] as User[]),
      ]);
      setRows(list || []);
      setUsers(allUsers || []);
    } catch (err: any) {
      Alert.alert(
        "Couldn't load attendance",
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

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  // Apply local name filter on top of the server-side userId filter so
  // HR can type a quick name without resetting the picker.
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const n = r.user?.name || "";
      const e = r.user?.email || "";
      const code = r.user?.employeeCode || "";
      return (
        n.toLowerCase().includes(q) ||
        e.toLowerCase().includes(q) ||
        code.toLowerCase().includes(q)
      );
    });
  }, [rows, search]);

  const selectedUserName =
    users.find((u) => u.id === selectedUserId)?.name || "All employees";

  // DataTable columns for desktop
  const columns: Column<HrAttendanceRow>[] = useMemo(
    () => [
      {
        key: "employee",
        label: "Employee",
        width: "25%",
        render: (item) => (
          <View style={styles.employeeCell}>
            <Avatar name={item.user?.name || "?"} size="sm" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[styles.cellName, { color: c.text }]} numberOfLines={1}>
                {item.user?.name || item.userId}
              </Text>
              <Text style={[styles.cellEmail, { color: c.textMuted }]} numberOfLines={1}>
                {item.user?.employeeCode || item.user?.email || ""}
              </Text>
            </View>
          </View>
        ),
      },
      {
        key: "date",
        label: "Date",
        width: "12%",
        render: (item) => (
          <Text style={[styles.cellText, { color: c.text }]}>{item.date}</Text>
        ),
      },
      {
        key: "type",
        label: "Type",
        width: "10%",
        render: (item) => (
          <StatusBadge
            status={item.attendanceType || "—"}
            variant={item.attendanceType === "WFH" ? "info" : "default"}
          />
        ),
      },
      {
        key: "checkIn",
        label: "Check In",
        width: "12%",
        render: (item) => (
          <Text style={[styles.cellText, { color: c.text }]}>
            {formatHM(item.checkIn)}
          </Text>
        ),
      },
      {
        key: "checkOut",
        label: "Check Out",
        width: "12%",
        render: (item) => (
          <Text style={[styles.cellText, { color: c.text }]}>
            {formatHM(item.checkOut)}
          </Text>
        ),
      },
      {
        key: "hours",
        label: "Hours",
        width: "10%",
        render: (item) => (
          <Text style={[styles.cellText, { color: c.text }]}>
            {item.hoursWorked ? `${item.hoursWorked.toFixed(1)}h` : "—"}
          </Text>
        ),
      },
      {
        key: "status",
        label: "Status",
        width: "12%",
        render: (item) => {
          const variant = item.isLate
            ? "warning"
            : item.status === "PRESENT"
            ? "success"
            : item.status === "ABSENT"
            ? "danger"
            : "default";
          return (
            <StatusBadge
              status={item.isLate ? "LATE" : item.status || "—"}
              variant={variant as any}
            />
          );
        },
      },
    ],
    [c, styles]
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
      <View
        style={{
          flex: 1,
          paddingHorizontal: spacing.padding,
          ...(isDesktop && {
            maxWidth: 1400,
            alignSelf: "center" as const,
            width: "100%",
          }),
        }}
      >
        {/* HEADER */}
        {isDesktop ? (
          <PageHeader
            title="Attendance Records"
            subtitle={`${filteredRows.length} records`}
            breadcrumbs={[
              { label: "Home", href: "/" },
              { label: "HR Admin", href: "/hr-admin" },
              { label: "Attendance" },
            ]}
          />
        ) : (
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace("/")
              }
            >
              <Ionicons name="arrow-back" size={24} color={c.text} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Attendance</Text>
              <Text style={styles.subtitle}>{filteredRows.length} records</Text>
            </View>
          </View>
        )}

        {/* FILTER BAR */}
        <View style={[styles.filterBar, isDesktop && styles.filterBarDesktop]}>
          <View style={styles.modeRow}>
            <Pressable
              style={({ hovered }: any) => [
                styles.modeBtn,
                mode === "day" && styles.modeActive,
                Platform.OS === "web" && hovered && mode !== "day" && {
                  borderColor: c.accent,
                },
              ]}
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
            </Pressable>
            <Pressable
              style={({ hovered }: any) => [
                styles.modeBtn,
                mode === "month" && styles.modeActive,
                Platform.OS === "web" && hovered && mode !== "month" && {
                  borderColor: c.accent,
                },
              ]}
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
            </Pressable>
          </View>

          {mode === "day" ? (
            <View style={styles.dayFilterRow}>
              {/* Quick presets so HR doesn't open the picker for the two
                  most common views. */}
              {([
                { label: "Today", value: todayYMD() },
                { label: "Yesterday", value: yesterdayYMD() },
              ] as const).map((preset) => {
                const active = date === preset.value;
                return (
                  <Pressable
                    key={preset.label}
                    onPress={() => setDate(preset.value)}
                    style={({ hovered }: any) => [
                      styles.quickChip,
                      active && styles.quickChipActive,
                      Platform.OS === "web" &&
                        hovered &&
                        !active && { borderColor: c.accent },
                    ]}
                  >
                    <Text
                      style={[
                        styles.quickChipText,
                        active && styles.quickChipTextActive,
                      ]}
                    >
                      {preset.label}
                    </Text>
                  </Pressable>
                );
              })}
              {isWeb ? (
                <View style={styles.dateRow}>
                  <Ionicons
                    name="calendar-outline"
                    size={16}
                    color={c.textMuted}
                  />
                  <WebDateField
                    mode="date"
                    value={date}
                    onChange={(v) => v && setDate(v)}
                  />
                </View>
              ) : (
                <DatePickerField value={date} onChange={setDate} />
              )}
            </View>
          ) : (
            <View style={styles.dateRow}>
              <Ionicons name="calendar-outline" size={16} color={c.textMuted} />
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

          <View style={[styles.searchBox, isDesktop && styles.searchBoxDesktop]}>
            <Ionicons name="search" size={16} color={c.textMuted} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Filter by name / code"
              placeholderTextColor={c.textFaint}
              autoCapitalize="none"
            />
          </View>
        </View>

        {/* Employee picker chips */}
        <View style={styles.userChips}>
          <Pressable
            style={({ hovered }: any) => [
              styles.userChip,
              !selectedUserId && styles.userChipActive,
              Platform.OS === "web" && hovered && selectedUserId && {
                borderColor: c.accent,
              },
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
          </Pressable>
          {users
            .filter((u) => {
              const q = search.trim().toLowerCase();
              if (!q) return true;
              return (
                u.name.toLowerCase().includes(q) ||
                u.email.toLowerCase().includes(q) ||
                (u.employeeCode || "").toLowerCase().includes(q)
              );
            })
            .slice(0, isDesktop ? 50 : 30)
            .map((u) => (
              <Pressable
                key={u.id}
                style={({ hovered }: any) => [
                  styles.userChip,
                  selectedUserId === u.id && styles.userChipActive,
                  Platform.OS === "web" &&
                    hovered &&
                    selectedUserId !== u.id && {
                      borderColor: c.accent,
                    },
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
              </Pressable>
            ))}
        </View>
        {selectedUserId && (
          <Text style={styles.activeFilter}>Filtered to {selectedUserName}</Text>
        )}

        {/* LIST - DataTable for desktop, Cards for mobile */}
        {isDesktop ? (
          <DataTable
            columns={columns}
            data={filteredRows}
            keyExtractor={(r) => r.id}
            emptyMessage="No attendance records for the selected filters."
          />
        ) : (
          <FlatList
            data={filteredRows}
            keyExtractor={(r) => r.id}
            contentContainerStyle={
              filteredRows.length === 0
                ? styles.emptyWrap
                : { paddingBottom: 60 }
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
                  name="calendar-clear-outline"
                  size={42}
                  color={c.textFaint}
                />
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
                    {item.user?.employeeCode
                      ? ` · ${item.user.employeeCode}`
                      : ""}
                  </Text>
                  <Text style={styles.rowMeta}>
                    In {formatHM(item.checkIn)} · Out {formatHM(item.checkOut)}
                    {item.hoursWorked ? ` · ${item.hoursWorked.toFixed(2)}h` : ""}
                  </Text>
                  {!!item.workNotes && (
                    <Text style={styles.rowNotes}>Note: {item.workNotes}</Text>
                  )}
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
        )}
      </View>
    </SafeAreaView>
  );
}


const makeStyles = (c: any, isDesktop: boolean) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    loader: {
      flex: 1,
      backgroundColor: c.bg,
      justifyContent: "center",
      alignItems: "center",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: isDesktop ? 18 : 14,
      borderBottomWidth: 1,
      borderBottomColor: c.surfaceBorder,
      gap: 12,
    },
    title: { color: c.text, fontSize: isDesktop ? 20 : 18, fontWeight: "800" },
    subtitle: { color: c.textMuted, fontSize: isDesktop ? 13 : 12, marginTop: 2 },

    filterBar: {
      paddingTop: isDesktop ? 16 : 10,
      paddingBottom: isDesktop ? 12 : 6,
      gap: isDesktop ? 12 : 8,
      borderBottomWidth: 1,
      borderBottomColor: c.surfaceBorder,
    },
    filterBarDesktop: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
    },
    modeRow: { flexDirection: "row", gap: 6 },
    modeBtn: {
      paddingHorizontal: isDesktop ? 18 : 14,
      paddingVertical: isDesktop ? 9 : 7,
      borderRadius: 999,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      ...(Platform.OS === "web" && {
        cursor: "pointer" as any,
        transition: "all 0.15s ease" as any,
      }),
    },
    modeActive: { backgroundColor: c.accent, borderColor: c.accent },
    modeText: { color: c.textMuted, fontSize: isDesktop ? 13 : 12, fontWeight: "700" },
    modeTextActive: { color: "#fff" },

    dayFilterRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap",
    },
    quickChip: {
      paddingHorizontal: isDesktop ? 16 : 12,
      paddingVertical: isDesktop ? 9 : 7,
      borderRadius: 999,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      ...(Platform.OS === "web" && {
        cursor: "pointer" as any,
        transition: "all 0.15s ease" as any,
      }),
    },
    quickChipActive: { backgroundColor: c.accent, borderColor: c.accent },
    quickChipText: {
      color: c.textMuted,
      fontSize: isDesktop ? 13 : 12,
      fontWeight: "700",
    },
    quickChipTextActive: { color: "#fff" },

    dateRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.surface,
      borderRadius: 10,
      paddingHorizontal: isDesktop ? 14 : 10,
      gap: 8,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
    },
    dateInput: {
      flex: 1,
      color: c.text,
      paddingVertical: isDesktop ? 10 : 8,
      fontSize: isDesktop ? 14 : 13,
      ...(Platform.OS === "web" && {
        outlineStyle: "none" as any,
      }),
    },

    searchBox: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.surface,
      borderRadius: 10,
      paddingHorizontal: isDesktop ? 14 : 10,
      gap: 6,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
    },
    searchBoxDesktop: {
      width: 280,
      marginLeft: "auto",
    },
    searchInput: {
      flex: 1,
      color: c.text,
      paddingVertical: isDesktop ? 10 : 8,
      fontSize: isDesktop ? 14 : 13,
      ...(Platform.OS === "web" && {
        outlineStyle: "none" as any,
      }),
    },

    userChips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: isDesktop ? 8 : 6,
      marginTop: isDesktop ? 12 : 4,
      marginBottom: isDesktop ? 8 : 0,
    },
    userChip: {
      paddingHorizontal: isDesktop ? 12 : 10,
      paddingVertical: isDesktop ? 6 : 5,
      borderRadius: 999,
      backgroundColor: c.surfaceMuted,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      maxWidth: isDesktop ? 180 : 140,
      ...(Platform.OS === "web" && {
        cursor: "pointer" as any,
        transition: "all 0.15s ease" as any,
      }),
    },
    userChipActive: { backgroundColor: c.accent, borderColor: c.accent },
    userChipText: { color: c.textMuted, fontSize: isDesktop ? 12 : 11, fontWeight: "700" },
    userChipTextActive: { color: "#fff" },
    activeFilter: {
      color: c.accentText,
      fontSize: isDesktop ? 12 : 11,
      fontStyle: "italic",
      marginTop: 2,
      marginBottom: isDesktop ? 8 : 0,
    },

    row: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.surface,
      padding: isDesktop ? 14 : 12,
      borderRadius: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      gap: 12,
    },
    avatar: {
      width: isDesktop ? 42 : 38,
      height: isDesktop ? 42 : 38,
      borderRadius: isDesktop ? 21 : 19,
      backgroundColor: c.accentSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { color: c.accentText, fontWeight: "700" },
    rowName: { color: c.text, fontSize: isDesktop ? 15 : 14, fontWeight: "700" },
    rowMeta: { color: c.textMuted, fontSize: isDesktop ? 12 : 11, marginTop: 2 },
    rowNotes: {
      color: c.text,
      fontSize: isDesktop ? 13 : 12,
      marginTop: 5,
      fontStyle: "italic",
      lineHeight: 17,
    },

    statusPill: {
      paddingHorizontal: isDesktop ? 10 : 9,
      paddingVertical: isDesktop ? 5 : 4,
      borderRadius: 999,
    },
    statusText: {
      fontSize: isDesktop ? 11 : 10,
      fontWeight: "800",
      letterSpacing: 0.5,
    },

    emptyWrap: { flex: 1, justifyContent: "center" },
    empty: { alignItems: "center", gap: 10, padding: isDesktop ? 40 : 30 },
    emptyText: {
      color: c.textMuted,
      fontSize: isDesktop ? 14 : 13,
      textAlign: "center",
      paddingHorizontal: 30,
    },

    // DataTable cell styles
    employeeCell: {
      flexDirection: "row",
      alignItems: "center",
    },
    cellName: {
      fontSize: 14,
      fontWeight: "600",
    },
    cellEmail: {
      fontSize: 12,
      marginTop: 2,
    },
    cellText: {
      fontSize: 14,
    },
  });

