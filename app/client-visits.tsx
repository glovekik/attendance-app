import React, { useCallback, useEffect, useMemo, useState } from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  listTeamClientLocations,
  ClientVisit,
} from "../src/services/clientLocation";
import { useTheme } from "../src/theme/ThemeProvider";

const fmtDate = (s?: string) => {
  if (!s) return "—";
  const d = new Date(`${s}T00:00:00`);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
};

// capturedAt is IST wall-clock (naive, no Z) — render the raw HH:mm.
const fmtTime = (iso?: string | null) => {
  if (!iso) return "";
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return "";
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${min} ${ampm}`;
};

export default function ClientVisits() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<ClientVisit[]>([]);
  const [search, setSearch] = useState("");
  const [todayOnly, setTodayOnly] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const data = await listTeamClientLocations(token).catch(
        () => [] as ClientVisit[]
      );
      setRows(data || []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const todayYmd = useMemo(() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => (todayOnly ? r.date === todayYmd : true))
      .filter((r) => {
        if (!q) return true;
        return (
          (r.user?.name || "").toLowerCase().includes(q) ||
          (r.user?.employeeCode || "").toLowerCase().includes(q) ||
          (r.address || "").toLowerCase().includes(q) ||
          (r.notes || "").toLowerCase().includes(q)
        );
      });
  }, [rows, search, todayOnly, todayYmd]);

  const openInMaps = (r: ClientVisit) => {
    const url =
      Platform.OS === "ios"
        ? `https://maps.apple.com/?q=${r.latitude},${r.longitude}`
        : `https://www.google.com/maps/search/?api=1&query=${r.latitude},${r.longitude}`;
    Linking.openURL(url).catch(() => {});
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
      <View style={styles.topbar}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/")
          }
        >
          <Ionicons name="chevron-back" size={22} color={c.text} />
        </TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>
          Client Locations
        </Text>
        <View style={styles.iconBtnSpacer} />
      </View>

      {/* search + today toggle */}
      <View style={styles.controls}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={c.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search name, address or notes"
            placeholderTextColor={c.textFaint}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={c.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.todayChip, todayOnly && styles.todayChipActive]}
          onPress={() => setTodayOnly((v) => !v)}
        >
          <Text
            style={[
              styles.todayChipText,
              todayOnly && { color: "#fff" },
            ]}
          >
            Today
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
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
      >
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="navigate-outline" size={34} color={c.textFaint} />
            <Text style={styles.emptyText}>
              {search || todayOnly
                ? "No matching client visits"
                : "No client-location check-ins yet"}
            </Text>
          </View>
        ) : (
          filtered.map((r) => (
            <View key={r.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(r.user?.name || "?").charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {r.user?.name || "Unknown"}
                    {r.user?.employeeCode ? `  ·  ${r.user.employeeCode}` : ""}
                  </Text>
                  <Text style={styles.when}>
                    {fmtDate(r.date)}
                    {fmtTime(r.capturedAt) ? `  ·  ${fmtTime(r.capturedAt)}` : ""}
                    {r.checkOut ? `–${fmtTime(r.checkOut)}` : " · open"}
                    {r.hoursWorked ? `  ·  ${r.hoursWorked.toFixed(1)}h` : ""}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.mapBtn}
                  onPress={() => openInMaps(r)}
                  hitSlop={6}
                >
                  <Ionicons name="map-outline" size={16} color={c.accent} />
                </TouchableOpacity>
              </View>

              <View style={styles.addrRow}>
                <Ionicons name="location" size={15} color={c.accent} />
                <Text style={styles.addr}>
                  {r.address ||
                    `${r.latitude.toFixed(5)}, ${r.longitude.toFixed(5)}`}
                </Text>
              </View>

              {!!r.notes && <Text style={styles.notes}>{r.notes}</Text>}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: any) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    loader: {
      flex: 1,
      backgroundColor: c.bg,
      justifyContent: "center",
      alignItems: "center",
    },
    topbar: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 12,
    },
    iconBtn: {
      width: 42,
      height: 42,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      backgroundColor: c.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    topTitle: {
      flex: 1,
      color: c.text,
      fontSize: 16,
      fontWeight: "800",
      textAlign: "center",
    },
    iconBtnSpacer: { width: 42, height: 42 },

    controls: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    searchBox: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      borderRadius: 12,
      paddingHorizontal: 12,
    },
    searchInput: {
      flex: 1,
      color: c.text,
      paddingVertical: 10,
      fontSize: 14,
      ...(Platform.OS === "web" && { outlineStyle: "none" as any }),
    },
    todayChip: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: c.surfaceMuted,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
    },
    todayChipActive: { backgroundColor: c.accent, borderColor: c.accent },
    todayChipText: { color: c.textMuted, fontSize: 13, fontWeight: "800" },

    empty: { alignItems: "center", gap: 10, paddingVertical: 60 },
    emptyText: { color: c.textMuted, fontSize: 14, fontWeight: "600" },

    card: {
      backgroundColor: c.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      padding: 14,
      marginBottom: 10,
      shadowColor: c.shadow,
      shadowOpacity: 1,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
      elevation: 1,
    },
    cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.accentSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { color: c.accentText, fontSize: 16, fontWeight: "800" },
    name: { color: c.text, fontSize: 14, fontWeight: "800" },
    when: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    mapBtn: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: c.accentSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    addrRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      marginTop: 12,
    },
    addr: { flex: 1, color: c.text, fontSize: 13, lineHeight: 18 },
    notes: {
      color: c.textMuted,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.surfaceBorder,
    },
  });
