import React, { useCallback, useState, useMemo} from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  checkIn,
  checkOut,
  getToday,
  getMe } from "../src/services/api";
import { getMyTasks } from "../src/services/tasks";
import { dateToYMD } from "../src/components/WebDateField";
import {
  OFFICE,
  ALLOWED_RADIUS,
  getCurrentLocation,
  getDistance } from "../src/utils/location";

import { useTheme } from "../src/theme/ThemeProvider";
import { User } from "../src/types";
import {
  BottomTabBar,
  BOTTOM_BAR_RESERVED_HEIGHT } from "../src/components/BottomTabBar";
import { notify } from "../src/utils/confirm";

const TYPES = ["OFFICE", "WFH", "LEAVE", "HOLIDAY"] as const;
type AttType = (typeof TYPES)[number];

/**
 * Attendance — single focus on today's status. Big check-in/out CTA,
 * attendance type chips, work notes on checkout, optional pull-from-tasks
 * helper. Keeps the geofence guard for OFFICE check-ins.
 */
export default function Attendance() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [todayAtt, setTodayAtt] = useState<any>(null);
  const [me, setMe] = useState<User | null>(null);
  const [attType, setAttType] = useState<AttType>("OFFICE");
  const [workNotes, setWorkNotes] = useState("");
  const [acting, setActing] = useState(false);
  const [pulling, setPulling] = useState(false);

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
      const summary = done.map((t) => `- ${t.title}`).join("\n");
      setWorkNotes((prev) =>
        prev.trim() ? `${prev}\n${summary}` : summary
      );
    } catch (err: any) {
      notify("Couldn't pull tasks", err?.message || "");
    } finally {
      setPulling(false);
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
    LEAVE: c.pastelPeach,
    HOLIDAY: c.pastelYellow };
  const typeIconFg: Record<AttType, string> = {
    OFFICE: "#6d28d9",
    WFH: "#15803d",
    LEAVE: "#c2410c",
    HOLIDAY: "#a16207" };
  const typeIconName: Record<AttType, keyof typeof Ionicons.glyphMap> = {
    OFFICE: "business-outline",
    WFH: "home-outline",
    LEAVE: "airplane-outline",
    HOLIDAY: "sunny-outline" };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: BOTTOM_BAR_RESERVED_HEIGHT + 24 }}
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
            <Text style={[styles.title, { color: c.text }]}>
              Attendance
            </Text>
            <Text style={[styles.subtitle, { color: c.textMuted }]}>
              {new Date().toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric" })}
            </Text>
          </View>
        </View>

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
                  <TouchableOpacity
                    key={t}
                    onPress={() => !checkedIn && setAttType(t)}
                    activeOpacity={0.85}
                    disabled={checkedIn}
                    style={[
                      styles.typeCard,
                      {
                        backgroundColor: c.surface,
                        borderColor: active ? c.accent : c.surfaceBorder,
                        shadowColor: c.shadow,
                        opacity: checkedIn && !active ? 0.4 : 1 },
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
                  </TouchableOpacity>
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
        <TouchableOpacity
          onPress={() => router.push("/history")}
          activeOpacity={0.85}
          style={[
            styles.historyLink,
            {
              backgroundColor: c.surface,
              borderColor: c.surfaceBorder,
              shadowColor: c.shadow },
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
        </TouchableOpacity>
      </ScrollView>

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

const makeStyles = (c: any) => StyleSheet.create({
  safe: { flex: 1 },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
    gap: 8 },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center" },
  title: { fontSize: 26, fontWeight: "800" },
  subtitle: { fontSize: 13, marginTop: 2 },

  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3 },
  statusDot: {
    width: 14,
    height: 14,
    borderRadius: 7 },
  statusLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginBottom: 4 },
  statusValue: { fontSize: 20, fontWeight: "800" },
  statusMeta: { fontSize: 12, marginTop: 6 },

  section: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginTop: 22,
    marginBottom: 10,
    marginLeft: 4 },

  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  typeCard: {
    width: "47%",
    flexGrow: 1,
    padding: 16,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: "center",
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2 },
  typeIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10 },
  typeLabel: { fontSize: 13, fontWeight: "800", letterSpacing: 0.5 },

  notesHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginRight: 4 },
  textArea: {
    minHeight: 110,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    fontSize: 14,
    lineHeight: 20 },

  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 18,
    borderRadius: 18,
    marginTop: 22,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5 },
  ctaText: {
    color: c.text,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.5 },

  completedCard: {
    alignItems: "center",
    padding: 28,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 16,
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3 },
  completedIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14 },
  completedTitle: { fontSize: 18, fontWeight: "800" },
  completedSub: { fontSize: 13, marginTop: 4 },
  completedNotes: {
    fontSize: 13,
    marginTop: 14,
    fontStyle: "italic",
    textAlign: "center",
    lineHeight: 19 },

  historyLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 16,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2 },
  historyTitle: { fontSize: 15, fontWeight: "800" },
  historySub: { fontSize: 12, marginTop: 2 } });
