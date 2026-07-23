import React, { useCallback, useMemo, useState } from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  RefreshControl,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { getMe } from "../src/services/api";
import {
  hrListIdCards,
  hrApproveIdCard,
  IDCardState,
  IDCardStatus,
} from "../src/services/idCard";

import { useTheme } from "../src/theme/ThemeProvider";
import { useResponsive, getResponsiveSpacing } from "../src/utils/responsive";
import {
  BottomTabBar,
  BOTTOM_BAR_RESERVED_HEIGHT,
} from "../src/components/BottomTabBar";
import { User, hasRole } from "../src/types";
import { notify } from "../src/utils/confirm";
import { mediaUrl } from "../src/utils/media";

type Filter = "PENDING" | "ALL";

const STATUS_TONE: Record<
  string,
  { bg: string; fg: string; label: string }
> = {
  PENDING: { bg: "rgba(245,158,11,0.14)", fg: "#b45309", label: "Pending" },
  APPROVED: { bg: "rgba(22,163,74,0.14)", fg: "#15803d", label: "Approved" },
  REJECTED: { bg: "rgba(220,38,38,0.12)", fg: "#dc2626", label: "Rejected" },
  NONE: { bg: "rgba(100,116,139,0.14)", fg: "#475569", label: "Not submitted" },
};

/** HR queue for reviewing employee ID-card photos. */
export default function HrIdCardsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const responsive = useResponsive();
  const spacing = getResponsiveSpacing(responsive.breakpoint);
  const styles = useMemo(() => makeStyles(c), [c]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [me, setMe] = useState<User | null>(null);
  const [rows, setRows] = useState<IDCardState[]>([]);
  const [filter, setFilter] = useState<Filter>("PENDING");
  const [denied, setDenied] = useState(false);

  const load = useCallback(
    async (f: Filter = filter) => {
      try {
        const token = await AsyncStorage.getItem("token");
        if (!token) {
          router.replace("/login");
          return;
        }
        const meRes = await getMe(token);
        setMe(meRes);
        if (!hasRole(meRes, "HR")) {
          setDenied(true);
          return;
        }
        const list = await hrListIdCards(
          token,
          f === "PENDING" ? ("PENDING" as IDCardStatus) : undefined
        );
        setRows(list || []);
      } catch (err: any) {
        notify("Couldn't load ID card requests", err?.message || "");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router, filter]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const switchFilter = (f: Filter) => {
    setFilter(f);
    setLoading(true);
    load(f);
  };

  const approve = async (userId?: string) => {
    if (!userId || busyId) return;
    try {
      setBusyId(userId);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await hrApproveIdCard(token, userId);
      notify("Approved", "The employee's ID card is now available to them.");
      await load();
    } catch (err: any) {
      notify("Couldn't approve", err?.message || "");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <View style={[styles.loader, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  if (denied) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
        <View style={styles.deniedWrap}>
          <Ionicons name="lock-closed-outline" size={40} color={c.textMuted} />
          <Text style={styles.deniedText}>HR access required.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const bottomPadding = responsive.showSidebar
    ? 40
    : BOTTOM_BAR_RESERVED_HEIGHT + 24;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.padding,
          paddingBottom: bottomPadding,
          ...(responsive.isDesktop && {
            maxWidth: 860,
            alignSelf: "center" as const,
            width: "100%",
          }),
        }}
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
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/")
            }
            style={[
              styles.iconBtn,
              { backgroundColor: c.surface, borderColor: c.surfaceBorder },
            ]}
          >
            <Ionicons name="chevron-back" size={22} color={c.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.title}>ID Card Requests</Text>
            <Text style={styles.subtitle}>
              Approve an employee&apos;s photo to issue their badge
            </Text>
          </View>
        </View>

        {/* FILTER */}
        <View style={styles.tabs}>
          {(["PENDING", "ALL"] as Filter[]).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.tab, filter === f && styles.tabActive]}
              onPress={() => switchFilter(f)}
            >
              <Text
                style={[
                  styles.tabText,
                  filter === f && styles.tabTextActive,
                ]}
              >
                {f === "PENDING" ? "Pending" : "All"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {rows.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons
              name="checkmark-done-outline"
              size={34}
              color={c.textMuted}
            />
            <Text style={styles.emptyText}>
              {filter === "PENDING"
                ? "Nothing waiting for review."
                : "No ID card requests yet."}
            </Text>
          </View>
        ) : (
          rows.map((r) => {
            const tone = STATUS_TONE[r.status] || STATUS_TONE.NONE;
            const photo = r.photoUrl ? mediaUrl(r.photoUrl) : null;
            const uid = r.userId || r.user?.id;
            return (
              <View key={uid || Math.random()} style={styles.row}>
                {photo ? (
                  <Image source={{ uri: photo }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, styles.thumbEmpty]}>
                    <Ionicons
                      name="person-outline"
                      size={22}
                      color={c.textMuted}
                    />
                  </View>
                )}

                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {r.user?.name || "Employee"}
                  </Text>
                  {!!r.user?.employeeCode && (
                    <Text style={styles.code}>{r.user.employeeCode}</Text>
                  )}
                  <View
                    style={[styles.pill, { backgroundColor: tone.bg }]}
                  >
                    <Text style={[styles.pillText, { color: tone.fg }]}>
                      {tone.label}
                    </Text>
                  </View>
                </View>

                <View style={styles.rowActions}>
                  <TouchableOpacity
                    style={[styles.smallBtn, styles.ghostBtn]}
                    onPress={() =>
                      router.push(`/id-card?userId=${uid}` as any)
                    }
                  >
                    <Text style={styles.ghostBtnText}>Review</Text>
                  </TouchableOpacity>
                  {r.status === "PENDING" && (
                    <TouchableOpacity
                      style={[
                        styles.smallBtn,
                        styles.approveBtn,
                        busyId === uid && { opacity: 0.6 },
                      ]}
                      onPress={() => approve(uid)}
                      disabled={busyId === uid}
                    >
                      <Text style={styles.approveBtnText}>
                        {busyId === uid ? "…" : "Approve"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <BottomTabBar user={me} />
    </SafeAreaView>
  );
}

const makeStyles = (c: any) =>
  StyleSheet.create({
    safe: { flex: 1 },
    loader: { flex: 1, alignItems: "center", justifyContent: "center" },

    headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 18 },
    iconBtn: {
      width: 42,
      height: 42,
      borderRadius: 14,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    title: { fontSize: 24, fontWeight: "800", color: c.text },
    subtitle: { fontSize: 13, marginTop: 2, color: c.textMuted },

    tabs: { flexDirection: "row", gap: 8, marginBottom: 16 },
    tab: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: c.surfaceMuted,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      ...(Platform.OS === "web" ? { cursor: "pointer" as any } : {}),
    },
    tabActive: { backgroundColor: c.accent, borderColor: c.accent },
    tabText: { color: c.textMuted, fontWeight: "800", fontSize: 12.5 },
    tabTextActive: { color: "#fff" },

    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      backgroundColor: c.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      padding: 14,
      marginBottom: 12,
    },
    thumb: {
      width: 54,
      height: 72,
      borderRadius: 10,
      backgroundColor: c.surfaceMuted,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
    },
    thumbEmpty: { alignItems: "center", justifyContent: "center" },

    name: { color: c.text, fontSize: 15, fontWeight: "800" },
    code: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    pill: {
      alignSelf: "flex-start",
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 999,
      marginTop: 7,
    },
    pillText: { fontSize: 11, fontWeight: "800" },

    rowActions: { gap: 8, alignItems: "stretch" },
    smallBtn: {
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      ...(Platform.OS === "web" ? { cursor: "pointer" as any } : {}),
    },
    ghostBtn: {
      backgroundColor: c.surfaceMuted,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
    },
    ghostBtnText: { color: c.text, fontSize: 12.5, fontWeight: "800" },
    approveBtn: { backgroundColor: "#16a34a" },
    approveBtnText: { color: "#fff", fontSize: 12.5, fontWeight: "800" },

    empty: { alignItems: "center", paddingVertical: 50, gap: 12 },
    emptyText: { color: c.textMuted, fontSize: 13, fontWeight: "600" },

    deniedWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 14,
      padding: 32,
    },
    deniedText: { color: c.textMuted, fontSize: 14, fontWeight: "600" },
  });
