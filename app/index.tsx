import React, { useEffect, useState, useMemo} from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useRouter, useFocusEffect } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import { getMe, getToday } from "../src/services/api";
import { getDashboardMe } from "../src/services/dashboard";
import { getUnreadCount } from "../src/services/inbox";
import { getChatUnreadCount } from "../src/services/chat";
import { openNotificationStream } from "../src/services/sse";
import { registerPushToken } from "../src/services/notifications";
import { refreshSession, clearSession } from "../src/services/session";

import { dateToYMD } from "../src/components/WebDateField";

import { useTheme } from "../src/theme/ThemeProvider";
import {
  BottomTabBar,
  BOTTOM_BAR_RESERVED_HEIGHT } from "../src/components/BottomTabBar";

import {
  hasRole,
  isManager,
  isCEO,
  User,
  DashboardMe } from "../src/types";

/**
 * Home screen — Koru-style. Hello card with avatar, today's status,
 * KPI strip, role hub callout, category tiles, recent activity.
 * Bottom tab bar anchored.
 */
export default function Home() {
  const router = useRouter();
  const { theme } = useTheme();

  const [user, setUser] = useState<User | null>(null);
  const [today, setToday] = useState<any>(null);
  const [dash, setDash] = useState<DashboardMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // True when the initial load failed for a non-auth reason (offline,
  // server hiccup). Drives a retry screen instead of logging the user out.
  const [loadError, setLoadError] = useState(false);
  const [tick, setTick] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatUnread, setChatUnread] = useState(0);

  const c = theme.colors;

  const styles = useMemo(() => makeStyles(c), [c]);

  const loadEverything = async (showSpinner = true) => {
    try {
      if (showSpinner) setLoading(true);
      let token = await AsyncStorage.getItem("token");
      if (!token) {
        setLoading(false);
        router.replace("/login");
        return;
      }

      // Validate the session. A 401 means the access token is dead — but
      // before logging out we try a silent refresh (long-lived refresh
      // token) and retry once. Only if refresh ALSO fails do we log out.
      // Network errors / 5xx (very common in the first seconds after the
      // app is relaunched from a recents swipe) keep the session as-is.
      let meRes;
      try {
        meRes = await getMe(token);
      } catch (err: any) {
        if (err?.status === 401) {
          const fresh = await refreshSession();
          if (!fresh) {
            await clearSession();
            setLoading(false);
            router.replace("/login");
            return;
          }
          // Refreshed — use the new token for this and all later calls.
          token = fresh;
          try {
            meRes = await getMe(token);
          } catch (retryErr: any) {
            if (retryErr?.status === 401) {
              await clearSession();
              setLoading(false);
              router.replace("/login");
              return;
            }
            console.log("DASHBOARD LOAD ERROR (kept session):", retryErr);
            setLoadError(true);
            setLoading(false);
            return;
          }
        } else {
          console.log("DASHBOARD LOAD ERROR (kept session):", err);
          setLoadError(true);
          setLoading(false);
          return;
        }
      }
      setLoadError(false);
      setUser(meRes);
      try {
        const todayRes = await getToday(token, dateToYMD(new Date()));
        setToday(todayRes);
      } catch {
        setToday(null);
      }
      try {
        const { count } = await getUnreadCount(token);
        setUnreadCount(count || 0);
      } catch {
        setUnreadCount(0);
      }
      try {
        const chat = await getChatUnreadCount(token);
        setChatUnread(chat.count || 0);
      } catch {
        setChatUnread(0);
      }
      try {
        const d = await getDashboardMe(token);
        setDash(d);
      } catch {
        // KPI strip just won't render — non-fatal.
      }
      setLoading(false);
    } catch (err) {
      // The token check above already handled auth. Anything reaching here
      // is a non-auth failure — keep the session, surface a retry instead
      // of silently logging the user out.
      console.log("DASHBOARD ERROR (kept session):", err);
      setLoadError(true);
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadEverything(false);
    setRefreshing(false);
  };

  useEffect(() => {
    loadEverything();
  }, []);

  // Update "5m ago" labels every minute.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Live notifications.
  useEffect(() => {
    let cleanup: (() => void) | null = null;
    (async () => {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      // Register this device's push token on every authenticated launch,
      // not just at login. Returning users (already logged in) would never
      // re-register otherwise, so a token that failed to send, rotated, or
      // changed after an app update stays stale and pushes silently stop.
      registerPushToken(token).catch(() => {});
      cleanup = openNotificationStream(token, {
        onNotification: async (n) => {
          if (n && n.poll) {
            try {
              const { count } = await getUnreadCount(token);
              setUnreadCount(count || 0);
            } catch {
              /* ignore */
            }
            try {
              const chat = await getChatUnreadCount(token);
              setChatUnread(chat.count || 0);
            } catch {
              /* ignore */
            }
            try {
              // Keep the tile counts (pending leaves/reimbursements/etc.)
              // live too — the dashboard payload is small.
              const d = await getDashboardMe(token);
              setDash(d);
            } catch {
              /* ignore */
            }
            return;
          }
          // chat_message events don't write a bell row (chat traffic
          // would flood Mongo). Refresh the dashboard chat-tile badge
          // only and skip the bell unread bump.
          if (n && n.type === "chat_message") {
            try {
              const chat = await getChatUnreadCount(token);
              setChatUnread(chat.count || 0);
            } catch {
              /* ignore */
            }
            return;
          }
          setUnreadCount((c) => c + 1);
          try {
            const { count } = await getUnreadCount(token);
            setUnreadCount(count || 0);
          } catch {
            /* ignore */
          }
          try {
            const chat = await getChatUnreadCount(token);
            setChatUnread(chat.count || 0);
          } catch {
            /* ignore */
          }
          try {
            // Refresh the tile counts so Leaves / Reimburse / etc. update
            // live as bell-firing events happen across the app.
            const d = await getDashboardMe(token);
            setDash(d);
          } catch {
            /* ignore */
          }
        } });
    })();
    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadEverything(false);
    }, [])
  );

  if (loading) {
    return (
      <View style={[styles.loader, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.loader, { backgroundColor: c.bg, padding: 32 }]}>
        <Ionicons
          name={loadError ? "cloud-offline-outline" : "person-outline"}
          size={40}
          color={c.textMuted}
          style={{ marginBottom: 14 }}
        />
        <Text
          style={{
            color: c.text,
            fontSize: 16,
            fontWeight: "700",
            textAlign: "center",
          }}
        >
          {loadError ? "Couldn't reach the server" : "Unable to load user"}
        </Text>
        {loadError && (
          <Text
            style={{
              color: c.textMuted,
              fontSize: 13,
              textAlign: "center",
              marginTop: 6,
              lineHeight: 18,
            }}
          >
            You're still signed in — check your connection and try again.
          </Text>
        )}
        <TouchableOpacity
          style={{
            marginTop: 20,
            backgroundColor: c.accent,
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 12,
          }}
          onPress={() => loadEverything()}
          activeOpacity={0.85}
        >
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>
            Retry
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isHR = hasRole(user, "HR");
  const isMgr = isManager(user);
  const isCeo = isCEO(user);
  // Teams card is shown to everyone. HR/CEO/leads get their full list;
  // a plain employee currently lands on an empty list until the backend
  // exposes a "teams I'm a member of" endpoint (see app/teams/index.tsx).
  const showTeams = true;

  const todayStatus = todayStatusInfo(today, tick, c);
  const checkedIn = today?.status === "CHECKED_IN";

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: BOTTOM_BAR_RESERVED_HEIGHT + 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={c.accent}
            colors={[c.accent]}
          />
        }
      >
        {/* ===== BRAND ===== */}
        <Image
          source={require("../assets/images/logo.jpg")}
          style={styles.brandLogo}
          resizeMode="contain"
        />

        {/* ===== HELLO ROW ===== */}
        <View style={styles.helloRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.helloLabel, { color: c.textMuted }]}>
              {greeting}
            </Text>
            <Text style={[styles.helloName, { color: c.text }]}>
              {user.name}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/notifications" as any)}
            style={[
              styles.bell,
              {
                backgroundColor: c.surface,
                borderColor: c.surfaceBorder },
            ]}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={20} color={c.text} />
            {unreadCount > 0 && (
              <View
                style={[
                  styles.bellBadge,
                  { backgroundColor: c.dangerText },
                ]}
              >
                <Text style={styles.bellBadgeText}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push("/profile")}
            activeOpacity={0.8}
            style={{ marginLeft: 8 }}
          >
            {user.profilePictureUrl ? (
              <Image
                source={{ uri: user.profilePictureUrl }}
                style={styles.avatarSmall}
              />
            ) : (
              <View
                style={[
                  styles.avatarSmallFallback,
                  { backgroundColor: c.accentSoft },
                ]}
              >
                <Text
                  style={[
                    styles.avatarSmallText,
                    { color: c.accentText },
                  ]}
                >
                  {user.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* ===== TODAY STATUS CARD ===== */}
        <TouchableOpacity
          onPress={() => router.push("/attendance")}
          activeOpacity={0.9}
          style={[
            styles.statusCard,
            {
              backgroundColor: c.surface,
              borderColor: c.surfaceBorder,
              shadowColor: c.shadow },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusLabel, { color: c.textMuted }]}>
              TODAY
            </Text>
            <Text style={[styles.statusTitle, { color: c.text }]}>
              {todayStatus.title}
            </Text>
            <Text style={[styles.statusSub, { color: c.textMuted }]}>
              {todayStatus.sub}
            </Text>
          </View>
          <View
            style={[
              styles.statusAction,
              {
                backgroundColor: checkedIn ? c.dangerText : c.accent,
                shadowColor: c.shadow },
            ]}
          >
            <Ionicons
              name={checkedIn ? "log-out-outline" : "log-in-outline"}
              size={22}
              color="#fff"
            />
          </View>
        </TouchableOpacity>

        {/* ===== ROLE HUB CALLOUTS ===== */}
        {isHR && (
          <RoleCallout
            title="HR Admin Console"
            sub="Employees · Approvals · Payroll · Reports"
            tint={c.roleHrBg}
            iconTint={c.roleHrText}
            icon="briefcase"
            onPress={() => router.push("/hr-admin")}
            theme={theme}
            styles={styles}
          />
        )}
        {isMgr && !isHR && (
          <RoleCallout
            title="Manager Approvals"
            sub="Pending leaves, corrections, reimbursements"
            tint={c.pastelMint}
            iconTint="#0f766e"
            icon="people"
            onPress={() => router.push("/manager" as any)}
            theme={theme}
            styles={styles}
          />
        )}
        {isCeo && (
          <RoleCallout
            title="CEO Console"
            sub="Org-wide KPIs · headcount · payroll · attrition"
            tint={c.roleCeoBg}
            iconTint={c.roleCeoText}
            icon="trending-up"
            onPress={() => router.push("/ceo" as any)}
            theme={theme}
            styles={styles}
          />
        )}

        {/* ===== KPI STRIP ===== */}
        {dash && (
          <>
            <Text style={[styles.section, { color: c.textMuted }]}>
              AT A GLANCE
            </Text>
            <View style={styles.kpiGrid}>
              <SimpleKpi
                label="Attendance"
                value={fmtPct(dash.attendanceRatePctMTD)}
                sub="month-to-date"
                icon="calendar-outline"
                tint={c.pastelLavender}
                iconColor="#6d28d9"
                onPress={() => router.push("/attendance")}
                theme={theme}
            styles={styles}
              />
              <SimpleKpi
                label="On-time"
                value={fmtPct(dash.onTimeCheckInRatePctMTD)}
                sub="check-ins"
                icon="time-outline"
                tint={c.pastelMint}
                iconColor="#15803d"
                theme={theme}
            styles={styles}
              />
              <SimpleKpi
                label="This week"
                value={`${dash.avgHoursPerDayThisWeek ?? "—"}h`}
                sub="avg / day"
                icon="stopwatch-outline"
                tint={c.pastelPeach}
                iconColor="#c2410c"
                theme={theme}
            styles={styles}
              />
              <SimpleKpi
                label="Tasks done"
                value={fmtPct(dash.myTaskCompletionRatePct30d)}
                sub="last 30 days"
                icon="checkmark-done-outline"
                tint={c.pastelPink}
                iconColor="#be185d"
                theme={theme}
            styles={styles}
              />
            </View>
          </>
        )}

        {/* ===== CATEGORY TILES ===== */}
        <Text style={[styles.section, { color: c.textMuted }]}>
          DAILY
        </Text>
        <View style={styles.tilesGrid}>
          <CategoryTile
            icon="checkbox-outline"
            label="Tasks"
            tint={c.pastelMint}
            iconColor="#15803d"
            count={dash?.openTasksCount}
            onPress={() => router.push("/tasks")}
            theme={theme}
            styles={styles}
          />
          <CategoryTile
            icon="list-outline"
            label="To-Do"
            tint={c.pastelPink}
            iconColor="#be185d"
            onPress={() => router.push("/todos" as any)}
            theme={theme}
            styles={styles}
          />
          {(isHR || isMgr || isCeo) && (
            <CategoryTile
              icon="calendar-clear-outline"
              label="Holidays"
              tint={c.pastelYellow}
              iconColor="#a16207"
              onPress={() => router.push("/holidays")}
              theme={theme}
            styles={styles}
            />
          )}
        </View>

        <Text style={[styles.section, { color: c.textMuted }]}>
          WORKPLACE
        </Text>
        <View style={styles.tilesGrid}>
          <CategoryTile
            icon="card-outline"
            label="Reimburse"
            tint={c.pastelSky}
            iconColor="#0369a1"
            count={dash?.pendingReimbursementRequests}
            onPress={() => router.push("/reimbursements" as any)}
            theme={theme}
            styles={styles}
          />
          {showTeams && (
            <CategoryTile
              icon="people-outline"
              label="Teams"
              tint={c.pastelMint}
              iconColor="#15803d"
              onPress={() => router.push("/teams")}
              theme={theme}
            styles={styles}
            />
          )}
          <CategoryTile
            icon="hardware-chip-outline"
            label="Assets"
            tint={c.pastelPink}
            iconColor="#be185d"
            onPress={() => router.push("/assets")}
            theme={theme}
            styles={styles}
          />
          <CategoryTile
            icon="document-outline"
            label="Policies"
            tint={c.pastelPeach}
            iconColor="#c2410c"
            onPress={() => router.push("/policies" as any)}
            theme={theme}
            styles={styles}
          />
          <CategoryTile
            icon="folder-open-outline"
            label="Documents"
            tint={c.pastelYellow}
            iconColor="#a16207"
            onPress={() => router.push("/my-documents" as any)}
            theme={theme}
            styles={styles}
          />
        </View>

        {/* ===== RECENT ACTIVITY ===== */}
        {dash?.recentTasks && dash.recentTasks.length > 0 && (
          <>
            <Text style={[styles.section, { color: c.textMuted }]}>
              RECENT TASKS
            </Text>
            <View
              style={[
                styles.listCard,
                {
                  backgroundColor: c.surface,
                  borderColor: c.surfaceBorder,
                  shadowColor: c.shadow },
              ]}
            >
              {dash.recentTasks.slice(0, 3).map((t, idx) => (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => router.push(`/tasks/${t.id}` as any)}
                  style={[
                    styles.listRow,
                    idx > 0 && {
                      borderTopWidth: 1,
                      borderTopColor: c.surfaceBorder },
                  ]}
                  activeOpacity={0.85}
                >
                  <View
                    style={[
                      styles.listIcon,
                      {
                        backgroundColor:
                          t.status === "COMPLETED"
                            ? c.pastelMint
                            : c.pastelLavender },
                    ]}
                  >
                    <Ionicons
                      name={
                        t.status === "COMPLETED"
                          ? "checkmark"
                          : "ellipse-outline"
                      }
                      size={16}
                      color={
                        t.status === "COMPLETED" ? "#15803d" : "#6d28d9"
                      }
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.listTitle, { color: c.text }]}
                      numberOfLines={1}
                    >
                      {t.title}
                    </Text>
                    <Text
                      style={[styles.listMeta, { color: c.textMuted }]}
                    >
                      {t.dueDate ? `Due ${t.dueDate}` : "No due date"}
                      {t.priority ? `  ·  ${t.priority}` : ""}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={c.textMuted}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <BottomTabBar user={user} chatUnread={chatUnread} />
    </SafeAreaView>
  );
}

// =============================================================
// Helpers / sub-components
// =============================================================

const fmtPct = (v: number | null | undefined): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `${Math.round(v)}%`;
};

const todayStatusInfo = (
  today: any,
  _tick: number,
  c: any
): { title: string; sub: string } => {
  if (!today || !today.id) {
    return { title: "Not checked in", sub: "Tap to start your day" };
  }
  if (today.status === "CHECKED_IN") {
    const since = today.checkIn ? new Date(today.checkIn) : null;
    const dur = since
      ? Math.floor((Date.now() - since.getTime()) / 60000)
      : 0;
    const h = Math.floor(dur / 60);
    const m = dur % 60;
    const elapsed = h > 0 ? `${h}h ${m}m` : `${m}m`;
    return {
      title: `Checked in · ${elapsed}`,
      sub: `${today.attendanceType || ""}`.trim() || "Tap to check out" };
  }
  if (today.status === "COMPLETED") {
    if (today.checkIn && today.checkOut) {
      const dur = Math.floor(
        (new Date(today.checkOut).getTime() -
          new Date(today.checkIn).getTime()) /
          60000
      );
      const h = Math.floor(dur / 60);
      const m = dur % 60;
      return {
        title: "Day complete",
        sub: `${h}h ${m}m worked${
          today.attendanceType ? ` · ${today.attendanceType}` : ""
        }` };
    }
    return { title: "Day complete", sub: "View today's record" };
  }
  return { title: today.status || "Today", sub: "" };
};

const RoleCallout = ({
  title,
  sub,
  tint,
  iconTint,
  icon,
  onPress,
  theme,
  styles }: {
  title: string;
  sub: string;
  tint: string;
  iconTint: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  theme: any;
  styles: any;
}) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.85}
    style={[
      styles.roleCallout,
      {
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.surfaceBorder,
        shadowColor: theme.colors.shadow },
    ]}
  >
    <View
      style={[styles.roleCalloutIcon, { backgroundColor: tint }]}
    >
      <Ionicons name={icon} size={24} color={iconTint} />
    </View>
    <View style={{ flex: 1 }}>
      <Text
        style={[styles.roleCalloutTitle, { color: theme.colors.text }]}
      >
        {title}
      </Text>
      <Text
        style={[styles.roleCalloutSub, { color: theme.colors.textMuted }]}
      >
        {sub}
      </Text>
    </View>
    <Ionicons
      name="chevron-forward"
      size={20}
      color={theme.colors.textMuted}
    />
  </TouchableOpacity>
);

const SimpleKpi = ({
  label,
  value,
  sub,
  icon,
  tint,
  iconColor,
  onPress,
  theme,
  styles }: {
  label: string;
  value: string;
  sub: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  iconColor: string;
  onPress?: () => void;
  theme: any;
  styles: any;
}) => {
  const body = (
    <>
      <View style={[styles.kpiIcon, { backgroundColor: tint }]}>
        <Ionicons name={icon} size={16} color={iconColor} />
      </View>
      <Text style={[styles.kpiValue, { color: theme.colors.text }]}>
        {value}
      </Text>
      <Text style={[styles.kpiLabel, { color: theme.colors.text }]}>
        {label}
      </Text>
      <Text style={[styles.kpiSub, { color: theme.colors.textMuted }]}>
        {sub}
      </Text>
    </>
  );
  const cellStyle = [
    styles.kpiCell,
    {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.surfaceBorder,
      shadowColor: theme.colors.shadow },
  ];
  if (onPress) {
    return (
      <TouchableOpacity style={cellStyle} onPress={onPress} activeOpacity={0.85}>
        {body}
      </TouchableOpacity>
    );
  }
  return <View style={cellStyle}>{body}</View>;
};

const CategoryTile = ({
  icon,
  label,
  tint,
  iconColor,
  onPress,
  count,
  theme,
  styles }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tint: string;
  iconColor: string;
  onPress: () => void;
  count?: number;
  theme: any;
  styles: any;
}) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.85}
    style={[
      styles.tile,
      {
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.surfaceBorder,
        shadowColor: theme.colors.shadow },
    ]}
  >
    <View style={[styles.tileIcon, { backgroundColor: tint }]}>
      <Ionicons name={icon} size={22} color={iconColor} />
    </View>
    <Text
      style={[styles.tileLabel, { color: theme.colors.text }]}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.75}
    >
      {label}
    </Text>
    {typeof count === "number" && count > 0 && (
      <View
        style={[
          styles.tileCountBadge,
          { backgroundColor: theme.colors.dangerText },
        ]}
      >
        <Text style={styles.tileCountText}>{count > 9 ? "9+" : count}</Text>
      </View>
    )}
  </TouchableOpacity>
);

// =============================================================
// Styles
// =============================================================

const makeStyles = (c: any) => StyleSheet.create({
  safe: { flex: 1 },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },

  brandLogo: {
    width: 140,
    height: 38,
    marginBottom: 16,
    alignSelf: "flex-start" },

  helloRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18 },
  helloLabel: { fontSize: 13, marginBottom: 2 },
  helloName: { fontSize: 28, fontWeight: "800" },

  bell: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative" },
  bellBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center" },
  bellBadgeText: { color: c.text, fontSize: 10, fontWeight: "800" },

  avatarSmall: { width: 42, height: 42, borderRadius: 21 },
  avatarSmallFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center" },
  avatarSmallText: { fontSize: 16, fontWeight: "800" },

  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3 },
  statusLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginBottom: 4 },
  statusTitle: { fontSize: 18, fontWeight: "800" },
  statusSub: { fontSize: 13, marginTop: 4 },
  statusAction: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4 },

  section: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginTop: 24,
    marginBottom: 10,
    marginLeft: 4 },

  roleCallout: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    gap: 14,
    marginTop: 14,
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3 },
  roleCalloutIcon: {
    width: 50,
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center" },
  roleCalloutTitle: { fontSize: 16, fontWeight: "800" },
  roleCalloutSub: { fontSize: 12, marginTop: 3, lineHeight: 17 },

  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10 },
  kpiCell: {
    width: "47%",
    flexGrow: 1,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2 },
  kpiIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8 },
  kpiValue: { fontSize: 22, fontWeight: "800", marginBottom: 4 },
  kpiLabel: { fontSize: 13, fontWeight: "700" },
  kpiSub: { fontSize: 11, marginTop: 2 },

  // 3-up grid. flexGrow stays 0 so tiles in a partial last row (e.g. 5
  // items in a section) don't stretch to fill the leftover space — that
  // was the "large button in between" problem.
  tilesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    columnGap: 10,
    rowGap: 10 },
  // flexBasis is intentionally below 33% so 3 tiles plus the two
  // column gaps always fit within 100% of the row. 31.5% was so tight
  // that the gap math pushed the 3rd tile to wrap on phones, giving a
  // 2-per-row layout.
  tile: {
    flexBasis: "30%",
    flexGrow: 0,
    flexShrink: 0,
    aspectRatio: 1,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    position: "relative" },
  tileIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8 },
  tileLabel: { fontSize: 12, fontWeight: "700", textAlign: "center" },
  tileCountBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center" },
  tileCountText: { color: c.text, fontSize: 10, fontWeight: "800" },

  listCard: {
    borderRadius: 18,
    borderWidth: 1,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2 },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12 },
  listIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center" },
  listTitle: { fontSize: 14, fontWeight: "700" },
  listMeta: { fontSize: 12, marginTop: 2 } });
