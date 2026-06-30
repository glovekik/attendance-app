import React, { useCallback, useState, useMemo } from "react";

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Pressable,
  Platform,
  ScrollView,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  checkIn,
  checkOut,
  getToday,
  getMe,
} from "../src/services/api";
import { getMyTasks } from "../src/services/tasks";
import { listTodos } from "../src/services/todos";
import { dateToYMD } from "../src/components/WebDateField";
import {
  OFFICE,
  ALLOWED_RADIUS,
  getCurrentLocation,
  getDistance,
} from "../src/utils/location";

import { useTheme } from "../src/theme/ThemeProvider";
import { User } from "../src/types";
import {
  BottomTabBar,
  BOTTOM_BAR_RESERVED_HEIGHT,
} from "../src/components/BottomTabBar";
import { notify } from "../src/utils/confirm";
import { useResponsive, getResponsiveSpacing } from "../src/utils/responsive";
import { PageHeader } from "../src/components/PageHeader";

// LEAVE and HOLIDAY are intentionally not selectable here: leave days are
// set automatically when a leave request is approved, and holidays are
// declared by HR. Users only choose how they're working today.
const TYPES = ["OFFICE", "WFH"] as const;
type AttType = (typeof TYPES)[number];

/**
 * Attendance — single focus on today's status. Big check-in/out CTA,
 * attendance type chips, work notes on checkout, optional pull-from-tasks
 * helper. Keeps the geofence guard for OFFICE check-ins.
 */
export default function Attendance() {
  const router = useRouter();
  const { theme } = useTheme();
  const responsive = useResponsive();
  const spacing = getResponsiveSpacing(responsive.breakpoint);
  const isDesktop = responsive.isDesktop;
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c, isDesktop), [c, isDesktop]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [todayAtt, setTodayAtt] = useState<any>(null);
  const [me, setMe] = useState<User | null>(null);
  const [attType, setAttType] = useState<AttType>("OFFICE");
  const [workNotes, setWorkNotes] = useState("");
  const [acting, setActing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [pullingTodos, setPullingTodos] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const [t, meRes] = await Promise.all([
        getToday(token, dateToYMD(new Date())),
        getMe(token).catch(() => null),
      ]);
      setTodayAtt(t || null);
      setMe(meRes);
      if (t?.attendanceType) setAttType(t.attendanceType);
      if (t?.workNotes) setWorkNotes(t.workNotes);
    } catch (err: any) {
      notify("Couldn't load attendance", err?.message || "");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  // Reload whenever the screen regains focus — not just on mount.
  // expo-router keeps pushed screens mounted in the stack, so a plain
  // useEffect would never re-run after a checkout/checkin performed on
  // another screen (or a date rollover), leaving this page showing a
  // stale status while the dashboard's useFocusEffect stays fresh.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onCheckIn = async () => {
    if (acting) return;
    try {
      setActing(true);
      // Capture the moment the user tapped the button as the source of
      // truth for the timestamp — the backend should record this rather
      // than recomputing from its own clock (which may be in a different
      // timezone or drift from the device).
      const now = new Date();
      const payload: any = {
        date: dateToYMD(now),
        checkIn: now.toISOString(),
        attendanceType: attType };
      if (attType === "OFFICE") {
        try {
          const coords = await getCurrentLocation();
          const distance = getDistance(
            coords.latitude,
            coords.longitude,
            OFFICE.latitude,
            OFFICE.longitude
          );
          if (distance > ALLOWED_RADIUS) {
            notify(
              "Too far from office",
              `You're ${Math.round(
                distance
              )}m away. Switch to WFH if you're remote.`
            );
            return;
          }
          payload.latitude = coords.latitude;
          payload.longitude = coords.longitude;
        } catch (locErr: any) {
          notify(
            "Location required",
            locErr?.message ||
              "Enable location and try again, or switch to WFH."
          );
          return;
        }
      }
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await checkIn(token, payload);
      await load();
    } catch (err: any) {
      notify("Check-in failed", err?.message || "");
    } finally {
      setActing(false);
    }
  };

  const onCheckOut = async () => {
    if (acting) return;
    const trimmed = workNotes.trim();
    if (trimmed.length < 5) {
      notify(
        "Work notes required",
        "Briefly describe what you did today (at least 5 characters) before checking out."
      );
      return;
    }
    try {
      setActing(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const now = new Date();
      await checkOut(token, {
        date: dateToYMD(now),
        checkOut: now.toISOString(),
        workNotes: trimmed });
      await load();
    } catch (err: any) {
      notify("Check-out failed", err?.message || "");
    } finally {
      setActing(false);
    }
  };

  const pullFromTasks = async () => {
    if (pulling) return;
    try {
      setPulling(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const tasks = await getMyTasks(token, {
        status: "COMPLETED",
        limit: 30 });
      const today = new Date();
      const done = (tasks || []).filter((t) => {
        if (!t.completedAt) return false;
        const d = new Date(t.completedAt);
        return (
          d.getFullYear() === today.getFullYear() &&
          d.getMonth() === today.getMonth() &&
          d.getDate() === today.getDate()
        );
      });
      if (done.length === 0) {
        notify("Nothing today", "No tasks completed today yet.");
        return;
      }
      const summary = done
        .map((t) => {
          const desc = t.description?.trim();
          return desc ? `- ${t.title}: ${desc}` : `- ${t.title}`;
        })
        .join("\n");
      setWorkNotes((prev) =>
        prev.trim() ? `${prev}\n${summary}` : summary
      );
    } catch (err: any) {
      notify("Couldn't pull tasks", err?.message || "");
    } finally {
      setPulling(false);
    }
  };

  const pullFromTodos = async () => {
    if (pullingTodos) return;
    try {
      setPullingTodos(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const todos = await listTodos(token, {
        status: "DONE",
        limit: 30 });
      const today = new Date();
      const done = (todos || []).filter((t) => {
        if (!t.completedAt) return false;
        const d = new Date(t.completedAt);
        return (
          d.getFullYear() === today.getFullYear() &&
          d.getMonth() === today.getMonth() &&
          d.getDate() === today.getDate()
        );
      });
      if (done.length === 0) {
        notify("Nothing today", "No to-dos completed today yet.");
        return;
      }
      const summary = done
        .map((t) => {
          const desc = t.description?.trim();
          return desc ? `- ${t.title}: ${desc}` : `- ${t.title}`;
        })
        .join("\n");
      setWorkNotes((prev) =>
        prev.trim() ? `${prev}\n${summary}` : summary
      );
    } catch (err: any) {
      notify("Couldn't pull to-dos", err?.message || "");
    } finally {
      setPullingTodos(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.loader, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  // Once the user has a checkOut timestamp the day is done — regardless
  // of which terminal status the backend classified it as (the rules
  // engine maps to PRESENT/LATE/HALF_DAY at checkout, never "COMPLETED").
  // Treating any of those as "checked in" caused the page to wrongly
  // show "Not checked in" + the type chips after a real checkout.
  const completed = !!todayAtt?.checkOut;
  const checkedIn = !!todayAtt?.checkIn && !completed;

  const typeIconBg: Record<AttType, string> = {
    OFFICE: c.pastelLavender,
    WFH: c.pastelMint,
  };
  const typeIconFg: Record<AttType, string> = {
    OFFICE: "#6d28d9",
    WFH: "#15803d",
  };
  const typeIconName: Record<AttType, keyof typeof Ionicons.glyphMap> = {
    OFFICE: "business-outline",
    WFH: "home-outline",
  };

  // Desktop shows sidebar, so we don't need bottom bar padding
  const bottomPadding = responsive.showSidebar ? 40 : BOTTOM_BAR_RESERVED_HEIGHT + 24;

  // react-native-keyboard-controller's KeyboardAwareScrollView doesn't scroll
  // reliably on web, so use a plain ScrollView there (a bounded flex:1 host
  // makes it scrollable) and keep the keyboard-aware one on native.
  const isWeb = Platform.OS === "web";
  const Scroller: any = isWeb ? ScrollView : KeyboardAwareScrollView;
  const scrollerExtraProps = isWeb ? { style: { flex: 1 } } : { bottomOffset: 24 };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <Scroller
        {...scrollerExtraProps}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: spacing.padding,
          paddingBottom: bottomPadding,
          ...(isDesktop && {
            maxWidth: 800,
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
        {/* HEADER - Desktop uses PageHeader with breadcrumbs */}
        {isDesktop ? (
          <PageHeader
            title="Attendance"
            subtitle={new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
            breadcrumbs={[
              { label: "Home", href: "/" },
              { label: "Attendance" },
            ]}
          />
        ) : (
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
              <Text style={[styles.title, { color: c.text }]}>
                Attendance
              </Text>
              <Text style={[styles.subtitle, { color: c.textMuted }]}>
                {new Date().toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </Text>
            </View>
          </View>
        )}

        {/* STATUS CARD */}
        <View
          style={[
            styles.statusCard,
            {
              backgroundColor: c.surface,
              borderColor: c.surfaceBorder,
              shadowColor: c.shadow },
          ]}
        >
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: completed
                  ? c.successText
                  : checkedIn
                  ? c.accent
                  : c.warningText },
            ]}
          />
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusLabel, { color: c.textMuted }]}>
              STATUS
            </Text>
            <Text style={[styles.statusValue, { color: c.text }]}>
              {completed
                ? "Day complete"
                : checkedIn
                ? "Checked in"
                : "Not checked in"}
            </Text>
            {todayAtt?.checkIn && (
              <Text style={[styles.statusMeta, { color: c.textMuted }]}>
                In · {formatTime(todayAtt.checkIn)}
                {todayAtt?.checkOut
                  ? `   Out · ${formatTime(todayAtt.checkOut)}`
                  : ""}
              </Text>
            )}
          </View>
        </View>

        {/* TYPE PICKER */}
        {!completed && (
          <>
            <Text style={[styles.section, { color: c.textMuted }]}>
              TYPE
            </Text>
            <View style={styles.typeGrid}>
              {TYPES.map((t) => {
                const active = attType === t;
                return (
                  <Pressable
                    key={t}
                    onPress={() => !checkedIn && setAttType(t)}
                    disabled={checkedIn}
                    style={({ hovered, pressed }: any) => [
                      styles.typeCard,
                      {
                        backgroundColor: c.surface,
                        borderColor: active ? c.accent : c.surfaceBorder,
                        shadowColor: c.shadow,
                        opacity: checkedIn && !active ? 0.4 : 1,
                      },
                      Platform.OS === "web" && hovered && !active && !checkedIn && {
                        borderColor: c.accent,
                        transform: [{ scale: 1.02 }],
                      },
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <View
                      style={[
                        styles.typeIcon,
                        { backgroundColor: typeIconBg[t] },
                      ]}
                    >
                      <Ionicons
                        name={typeIconName[t]}
                        size={22}
                        color={typeIconFg[t]}
                      />
                    </View>
                    <Text style={[styles.typeLabel, { color: c.text }]}>
                      {t}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {/* WORK NOTES (only when checked in and need to check out) */}
        {checkedIn && (
          <>
            <View style={styles.notesHeader}>
              <Text style={[styles.section, { color: c.textMuted }]}>
                WORK NOTES
              </Text>
              <View style={styles.pullActions}>
                <TouchableOpacity
                  onPress={pullFromTasks}
                  disabled={pulling}
                  activeOpacity={0.7}
                >
                  <Text
                    style={{
                      color: c.accent,
                      fontSize: 12,
                      fontWeight: "800" }}
                  >
                    {pulling ? "…" : "Pull from tasks"}
                  </Text>
                </TouchableOpacity>
                <Text style={{ color: c.textFaint, fontSize: 12 }}>·</Text>
                <TouchableOpacity
                  onPress={pullFromTodos}
                  disabled={pullingTodos}
                  activeOpacity={0.7}
                >
                  <Text
                    style={{
                      color: c.accent,
                      fontSize: 12,
                      fontWeight: "800" }}
                  >
                    {pullingTodos ? "…" : "Pull from to-do"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
            <TextInput
              style={[
                styles.textArea,
                {
                  backgroundColor: c.surface,
                  color: c.text,
                  borderColor: c.surfaceBorder },
              ]}
              value={workNotes}
              onChangeText={setWorkNotes}
              placeholder="What did you work on today?"
              placeholderTextColor={c.textFaint}
              multiline
              textAlignVertical="top"
            />
          </>
        )}

        {/* COMPLETED CARD */}
        {completed && (
          <View
            style={[
              styles.completedCard,
              {
                backgroundColor: c.surface,
                borderColor: c.surfaceBorder,
                shadowColor: c.shadow },
            ]}
          >
            <View
              style={[
                styles.completedIcon,
                { backgroundColor: c.pastelMint },
              ]}
            >
              <Ionicons
                name="checkmark-circle"
                size={32}
                color="#15803d"
              />
            </View>
            <Text style={[styles.completedTitle, { color: c.text }]}>
              Attendance recorded
            </Text>
            <Text style={[styles.completedSub, { color: c.textMuted }]}>
              {todayAtt?.hoursWorked
                ? `${todayAtt.hoursWorked.toFixed(2)}h worked`
                : "Day complete"}
            </Text>
            {!!todayAtt?.workNotes && (
              <Text
                style={[styles.completedNotes, { color: c.textMuted }]}
              >
                &quot;{todayAtt.workNotes}&quot;
              </Text>
            )}
          </View>
        )}

        {/* CTA */}
        {!completed && (
          <TouchableOpacity
            onPress={checkedIn ? onCheckOut : onCheckIn}
            disabled={acting}
            activeOpacity={0.85}
            style={[
              styles.cta,
              {
                backgroundColor: checkedIn ? c.dangerText : c.accent,
                shadowColor: c.shadow,
                opacity: acting ? 0.7 : 1 },
            ]}
          >
            {acting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons
                  name={
                    checkedIn ? "log-out-outline" : "log-in-outline"
                  }
                  size={20}
                  color="#fff"
                />
                <Text style={styles.ctaText}>
                  {checkedIn ? "Check out" : "Check in"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* QUICK LINK to history */}
        <Pressable
          onPress={() => router.push("/history")}
          style={({ hovered, pressed }: any) => [
            styles.historyLink,
            {
              backgroundColor: c.surface,
              borderColor: c.surfaceBorder,
              shadowColor: c.shadow,
            },
            Platform.OS === "web" && hovered && {
              borderColor: c.accent,
              transform: [{ scale: 1.01 }],
            },
            pressed && { opacity: 0.85 },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.historyTitle, { color: c.text }]}>
              Attendance history
            </Text>
            <Text style={[styles.historySub, { color: c.textMuted }]}>
              See past months, request corrections
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={c.textMuted}
          />
        </Pressable>

        {/* QUICK LINK to leaves */}
        <Pressable
          onPress={() => router.push("/leaves")}
          style={({ hovered, pressed }: any) => [
            styles.historyLink,
            {
              backgroundColor: c.surface,
              borderColor: c.surfaceBorder,
              shadowColor: c.shadow,
            },
            Platform.OS === "web" && hovered && {
              borderColor: c.accent,
              transform: [{ scale: 1.01 }],
            },
            pressed && { opacity: 0.85 },
          ]}
        >
          <View
            style={[
              styles.leavesIcon,
              { backgroundColor: c.pastelPeach },
            ]}
          >
            <Ionicons name="airplane-outline" size={20} color="#c2410c" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.historyTitle, { color: c.text }]}>
              Leaves
            </Text>
            <Text style={[styles.historySub, { color: c.textMuted }]}>
              Apply for leave, view balances and requests
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={c.textMuted}
          />
        </Pressable>
      </Scroller>

      <BottomTabBar user={me} />
    </SafeAreaView>
  );
}

const formatTime = (iso?: string | null): string => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: true });
  } catch {
    return "—";
  }
};

const makeStyles = (c: any, isDesktop: boolean) =>
  StyleSheet.create({
    safe: { flex: 1 },
    loader: { flex: 1, alignItems: "center", justifyContent: "center" },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: isDesktop ? 24 : 18,
      gap: 8,
    },
    iconBtn: {
      width: 42,
      height: 42,
      borderRadius: 14,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    title: { fontSize: isDesktop ? 28 : 26, fontWeight: "800" },
    subtitle: { fontSize: isDesktop ? 14 : 13, marginTop: 2 },

    statusCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: isDesktop ? 18 : 14,
      padding: isDesktop ? 24 : 18,
      borderRadius: 20,
      borderWidth: 1,
      shadowOpacity: 1,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
    },
    statusDot: {
      width: isDesktop ? 16 : 14,
      height: isDesktop ? 16 : 14,
      borderRadius: isDesktop ? 8 : 7,
    },
    statusLabel: {
      fontSize: isDesktop ? 12 : 11,
      fontWeight: "800",
      letterSpacing: 1.4,
      marginBottom: 4,
    },
    statusValue: { fontSize: isDesktop ? 22 : 20, fontWeight: "800" },
    statusMeta: { fontSize: isDesktop ? 13 : 12, marginTop: 6 },

    section: {
      fontSize: isDesktop ? 12 : 11,
      fontWeight: "800",
      letterSpacing: 1.4,
      marginTop: isDesktop ? 28 : 22,
      marginBottom: isDesktop ? 14 : 10,
      marginLeft: 4,
    },

    typeGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: isDesktop ? 16 : 10,
    },
    typeCard: {
      width: isDesktop ? "48%" : "47%",
      flexGrow: 1,
      padding: isDesktop ? 24 : 16,
      borderRadius: 18,
      borderWidth: 2,
      alignItems: "center",
      shadowOpacity: 1,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
      ...(Platform.OS === "web" && {
        cursor: "pointer" as any,
        transition: "all 0.15s ease" as any,
      }),
    },
    typeIcon: {
      width: isDesktop ? 56 : 48,
      height: isDesktop ? 56 : 48,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: isDesktop ? 14 : 10,
    },
    typeLabel: { fontSize: isDesktop ? 14 : 13, fontWeight: "800", letterSpacing: 0.5 },

    notesHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginRight: 4,
    },
    pullActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: isDesktop ? 12 : 8,
    },
    textArea: {
      minHeight: isDesktop ? 140 : 110,
      padding: isDesktop ? 18 : 14,
      borderRadius: 16,
      borderWidth: 1,
      fontSize: 14,
      lineHeight: 20,
      ...(Platform.OS === "web" && {
        outlineStyle: "none" as any,
      }),
    },

    cta: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: isDesktop ? 20 : 18,
      borderRadius: 18,
      marginTop: isDesktop ? 28 : 22,
      shadowOpacity: 0.25,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 5,
      ...(Platform.OS === "web" && {
        cursor: "pointer" as any,
        transition: "all 0.15s ease" as any,
      }),
    },
    ctaText: {
      color: "#fff",
      fontSize: isDesktop ? 17 : 16,
      fontWeight: "800",
      letterSpacing: 0.5,
    },

    completedCard: {
      alignItems: "center",
      padding: isDesktop ? 36 : 28,
      borderRadius: 20,
      borderWidth: 1,
      marginTop: 16,
      shadowOpacity: 1,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
    },
    completedIcon: {
      width: isDesktop ? 72 : 64,
      height: isDesktop ? 72 : 64,
      borderRadius: isDesktop ? 36 : 32,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: isDesktop ? 18 : 14,
    },
    completedTitle: { fontSize: isDesktop ? 20 : 18, fontWeight: "800" },
    completedSub: { fontSize: isDesktop ? 14 : 13, marginTop: 4 },
    completedNotes: {
      fontSize: isDesktop ? 14 : 13,
      marginTop: isDesktop ? 18 : 14,
      fontStyle: "italic",
      textAlign: "center",
      lineHeight: 20,
    },

    historyLink: {
      flexDirection: "row",
      alignItems: "center",
      gap: isDesktop ? 16 : 12,
      padding: isDesktop ? 18 : 14,
      borderRadius: 18,
      borderWidth: 1,
      marginTop: 16,
      shadowOpacity: 1,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
      ...(Platform.OS === "web" && {
        cursor: "pointer" as any,
        transition: "all 0.15s ease" as any,
      }),
    },
    historyTitle: { fontSize: isDesktop ? 16 : 15, fontWeight: "800" },
    historySub: { fontSize: isDesktop ? 13 : 12, marginTop: 2 },
    leavesIcon: {
      width: isDesktop ? 44 : 40,
      height: isDesktop ? 44 : 40,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
  });
