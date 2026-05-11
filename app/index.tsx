import React, {
  useEffect,
  useState,
} from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  SafeAreaView,
  RefreshControl,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useRouter, useFocusEffect } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import { getMe, getToday } from "../src/services/api";

import { unregisterPushToken } from "../src/services/notifications";

import { getUnreadCount } from "../src/services/inbox";

import { openNotificationStream } from "../src/services/sse";

import { dateToYMD } from "../src/components/WebDateField";

import { hasRole, isManager, User } from "../src/types";

interface TileProps {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  desc: string;
  onPress: () => void;
}

interface MiniTileProps {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  onPress: () => void;
}

const MiniTile = ({ icon, color, title, onPress }: MiniTileProps) => (
  <TouchableOpacity
    style={styles.mini}
    onPress={onPress}
    activeOpacity={0.85}
  >
    <View style={[styles.miniIcon, { backgroundColor: color }]}>
      <Ionicons name={icon} size={20} color="#fff" />
    </View>
    <Text style={styles.miniTitle} numberOfLines={1}>
      {title}
    </Text>
  </TouchableOpacity>
);

const formatElapsed = (since: Date): string => {
  const ms = Date.now() - since.getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
};

const todayStatusLabel = (today: any, _tick: number): string => {
  if (!today || !today.id) return "Not checked in yet";
  if (today.status === "CHECKED_IN") {
    if (today.checkIn) {
      return `Checked in · ${formatElapsed(new Date(today.checkIn))} elapsed`;
    }
    return "Checked in";
  }
  if (today.status === "COMPLETED") {
    return "Day complete";
  }
  return "Not checked in yet";
};

const todaySubLabel = (today: any): string => {
  if (!today || !today.id) return "Tap to check in";
  if (today.attendanceType) {
    if (today.checkIn && today.checkOut) {
      const dur = Math.floor(
        (new Date(today.checkOut).getTime() -
          new Date(today.checkIn).getTime()) /
          60000
      );
      const h = Math.floor(dur / 60);
      const m = dur % 60;
      return `${today.attendanceType} · ${h}h ${m}m worked`;
    }
    if (today.checkIn) {
      const t = new Date(today.checkIn).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      return `${today.attendanceType} · since ${t}`;
    }
    return today.attendanceType;
  }
  return "Tap to begin";
};

const Tile = ({ icon, color, title, desc, onPress }: TileProps) => (
  <TouchableOpacity
    style={styles.card}
    onPress={onPress}
    activeOpacity={0.85}
  >
    <View style={[styles.iconBox, { backgroundColor: color }]}>
      <Ionicons name={icon} size={22} color="#fff" />
    </View>
    <View style={styles.cardBody}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardDesc}>{desc}</Text>
    </View>
    <Ionicons
      name="chevron-forward"
      size={22}
      color="#64748b"
    />
  </TouchableOpacity>
);

export default function Dashboard() {

  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [today, setToday] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadEverything(false);
    setRefreshing(false);
  };

  const loadEverything = async (showSpinner = true) => {
    try {
      if (showSpinner) setLoading(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        setLoading(false);
        router.replace("/login");
        return;
      }
      const meRes = await getMe(token);
      if (!meRes) {
        await AsyncStorage.removeItem("token");
        setLoading(false);
        router.replace("/login");
        return;
      }
      setUser(meRes);
      try {
        const todayRes = await getToday(
          token,
          dateToYMD(new Date())
        );
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
      setLoading(false);
    } catch (err) {
      console.log("DASHBOARD ERROR:", err);
      await AsyncStorage.removeItem("token");
      setLoading(false);
      router.replace("/login");
    }
  };

  useEffect(() => {
    loadEverything();
  }, []);

  // tick every minute so elapsed time updates
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Live notification stream — bumps the bell badge as events arrive.
  // Falls back to a 30s poll if SSE isn't available.
  useEffect(() => {
    let cleanup: (() => void) | null = null;
    (async () => {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      cleanup = openNotificationStream(token, {
        onNotification: async (n) => {
          if (n && n.poll) {
            // Polling tick — re-fetch count.
            try {
              const { count } = await getUnreadCount(token);
              setUnreadCount(count || 0);
            } catch {
              /* ignore */
            }
            return;
          }
          // Real SSE event: optimistic bump, then reconcile with server.
          setUnreadCount((c) => c + 1);
          try {
            const { count } = await getUnreadCount(token);
            setUnreadCount(count || 0);
          } catch {
            /* ignore */
          }
        },
      });
    })();
    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  // refetch today when screen regains focus
  useFocusEffect(
    React.useCallback(() => {
      loadEverything(false);
    }, [])
  );

  const ledTeamCount = user?.ledTeamIds?.length || 0;
  const isHR = hasRole(user, "HR");
  const isMgr = isManager(user);
  const showTeams = isHR || ledTeamCount > 0;
  const roleChipColor = isHR
    ? "#db2777"
    : isMgr
    ? "#7c3aed"
    : "#1e293b";

  const logout = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (token) {
        await unregisterPushToken(token).catch(() => {});
      }
      await AsyncStorage.removeItem("token");
      router.replace("/login");
    } catch (err) {
      console.log("LOGOUT ERROR:", err);
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading workspace…</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.loader}>
        <Text style={{ color: "#fff", fontSize: 16 }}>
          Unable to load user
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3b82f6"
            colors={["#3b82f6"]}
          />
        }
      >

        {/* HERO */}
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.welcome}>Welcome back</Text>
              <Text style={styles.name}>
                {user.name || "Employee"}
              </Text>
              <View style={styles.heroChips}>
                <View
                  style={[
                    styles.heroChip,
                    { backgroundColor: roleChipColor },
                  ]}
                >
                  <Text style={styles.heroChipText}>
                    {user.role}
                  </Text>
                </View>
                {user.tag && (
                  <View
                    style={[
                      styles.heroChip,
                      { backgroundColor: "#0ea5e9" },
                    ]}
                  >
                    <Text style={styles.heroChipText}>
                      {user.tag}
                    </Text>
                  </View>
                )}
                {ledTeamCount > 0 && (
                  <View
                    style={[
                      styles.heroChip,
                      { backgroundColor: "#7c3aed" },
                    ]}
                  >
                    <Text style={styles.heroChipText}>
                      TEAM LEAD
                    </Text>
                  </View>
                )}
              </View>
            </View>
            <TouchableOpacity
              style={styles.bellWrap}
              onPress={() => router.push("/notifications" as any)}
              activeOpacity={0.7}
            >
              <Ionicons
                name="notifications-outline"
                size={26}
                color="#fff"
              />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* TODAY'S STATUS */}
          <TouchableOpacity
            style={styles.statusRow}
            onPress={() => router.push("/attendance")}
            activeOpacity={0.85}
          >
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    today?.status === "CHECKED_IN"
                      ? "#16a34a"
                      : today?.status === "COMPLETED"
                      ? "#94a3b8"
                      : "#f59e0b",
                },
              ]}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.statusText}>
                {todayStatusLabel(today, tick)}
              </Text>
              <Text style={styles.statusSub}>
                {todaySubLabel(today)}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color="#64748b"
            />
          </TouchableOpacity>

          {/* QUICK ACTIONS */}
          <View style={styles.quickRow}>
            <TouchableOpacity
              style={styles.quickBtn}
              onPress={() => router.push("/attendance")}
            >
              <Ionicons
                name={
                  today?.status === "CHECKED_IN"
                    ? "log-out-outline"
                    : "log-in-outline"
                }
                size={16}
                color="#fff"
              />
              <Text style={styles.quickText}>
                {today?.status === "CHECKED_IN"
                  ? "Check out"
                  : today?.status === "COMPLETED"
                  ? "View day"
                  : "Check in"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.quickBtn,
                { backgroundColor: "#0d9488" },
              ]}
              onPress={() => router.push("/leaves")}
            >
              <Ionicons
                name="airplane-outline"
                size={16}
                color="#fff"
              />
              <Text style={styles.quickText}>Apply leave</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ROLE-SPECIFIC HUBS — pinned to top so HR/Manager land here first */}
        {isHR && (
          <TouchableOpacity
            style={styles.hrHub}
            onPress={() => router.push("/hr-admin")}
            activeOpacity={0.85}
          >
            <View style={styles.hrHubIcon}>
              <Ionicons name="briefcase" size={26} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.hrHubTitle}>HR Admin Console</Text>
              <Text style={styles.hrHubDesc}>
                Users · Leaves · Payroll · Recruitment · Reports
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={22} color="#fff" />
          </TouchableOpacity>
        )}
        {isMgr && (
          <TouchableOpacity
            style={[styles.hrHub, { backgroundColor: "#0d9488" }]}
            onPress={() => router.push("/manager" as any)}
            activeOpacity={0.85}
          >
            <View style={styles.hrHubIcon}>
              <Ionicons name="people" size={26} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.hrHubTitle}>Manager Approvals</Text>
              <Text style={styles.hrHubDesc}>
                Pending leaves · corrections · reimbursements · timesheets
              </Text>
            </View>
            <Ionicons name="arrow-forward" size={22} color="#fff" />
          </TouchableOpacity>
        )}

        {/* DAILY */}
        <Text style={styles.section}>DAILY</Text>
        <View style={styles.grid}>
          <MiniTile
            icon="calendar-outline"
            color="#0ea5e9"
            title="Attendance"
            onPress={() => router.push("/attendance")}
          />
          <MiniTile
            icon="checkbox-outline"
            color="#16a34a"
            title="Assigned"
            onPress={() => router.push("/tasks")}
          />
          <MiniTile
            icon="list-outline"
            color="#a855f7"
            title="To-Do"
            onPress={() => router.push("/todos" as any)}
          />
          <MiniTile
            icon="time-outline"
            color="#6366f1"
            title="Timesheet"
            onPress={() => router.push("/my-timesheet" as any)}
          />
          <MiniTile
            icon="airplane-outline"
            color="#0d9488"
            title="Leaves"
            onPress={() => router.push("/leaves")}
          />
          <MiniTile
            icon="calendar-clear-outline"
            color="#f97316"
            title="Holidays"
            onPress={() => router.push("/holidays")}
          />
        </View>

        {/* WORKPLACE */}
        <Text style={styles.section}>WORKPLACE</Text>
        <View style={styles.grid}>
          <MiniTile
            icon="card-outline"
            color="#3b82f6"
            title="Reimburse"
            onPress={() => router.push("/reimbursements" as any)}
          />
          <MiniTile
            icon="chatbubbles-outline"
            color="#0ea5e9"
            title="Office Chat"
            onPress={() => router.push("/chat/office")}
          />
          {showTeams && (
            <MiniTile
              icon="people-outline"
              color="#7c3aed"
              title="Teams"
              onPress={() => router.push("/teams")}
            />
          )}
          <MiniTile
            icon="hardware-chip-outline"
            color="#a855f7"
            title="Assets"
            onPress={() => router.push("/assets")}
          />
        </View>

        {/* PERFORMANCE */}
        <Text style={styles.section}>PERFORMANCE</Text>
        <View style={styles.grid}>
          <MiniTile
            icon="flag-outline"
            color="#f59e0b"
            title="Goals"
            onPress={() => router.push("/my-goals" as any)}
          />
          <MiniTile
            icon="star-outline"
            color="#eab308"
            title="Reviews"
            onPress={() => router.push("/my-reviews" as any)}
          />
          <MiniTile
            icon="chatbubble-ellipses-outline"
            color="#a855f7"
            title="Feedback"
            onPress={() => router.push("/feedback" as any)}
          />
          <MiniTile
            icon="chatbubbles-outline"
            color="#8b5cf6"
            title="Interviews"
            onPress={() => router.push("/my-interviews" as any)}
          />
        </View>

        {/* MY ACCOUNT */}
        <Text style={styles.section}>MY ACCOUNT</Text>
        <View style={styles.grid}>
          <MiniTile
            icon="person-outline"
            color="#1d4ed8"
            title="Profile"
            onPress={() => router.push("/profile")}
          />
          <MiniTile
            icon="cash-outline"
            color="#16a34a"
            title="Payslips"
            onPress={() => router.push("/my-payroll")}
          />
          <MiniTile
            icon="folder-open-outline"
            color="#06b6d4"
            title="Documents"
            onPress={() => router.push("/my-documents" as any)}
          />
          <MiniTile
            icon="rocket-outline"
            color="#06b6d4"
            title="Onboarding"
            onPress={() => router.push("/my-onboarding")}
          />
          <MiniTile
            icon="exit-outline"
            color="#64748b"
            title="Exit"
            onPress={() => router.push("/exit")}
          />
        </View>

        <View style={{ height: 90 }} />

      </ScrollView>

      {/* LOGOUT */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={logout}
        >
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({

  safe: {
    flex: 1,
    backgroundColor: "#0b1220",
  },

  container: {
    flex: 1,
  },

  content: {
    padding: 20,
  },

  loader: {
    flex: 1,
    backgroundColor: "#0b1220",
    justifyContent: "center",
    alignItems: "center",
  },

  loadingText: {
    color: "#94a3b8",
    marginTop: 10,
  },

  hero: {
    backgroundColor: "#0f172a",
    padding: 18,
    borderRadius: 18,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: "#1e293b",
  },

  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  logo: {
    width: 60,
    height: 60,
  },

  bellWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },

  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "#ef4444",
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#0f172a",
  },

  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
  },

  welcome: {
    color: "#94a3b8",
    fontSize: 13,
  },

  name: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "800",
    marginTop: 4,
  },

  heroChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },

  heroChip: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },

  heroChipText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: "#1e293b",
  },

  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  statusText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },

  statusSub: {
    color: "#94a3b8",
    fontSize: 11,
    marginTop: 2,
  },

  quickRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },

  quickBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },

  quickText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },

  section: {
    color: "#64748b",
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "700",
    marginTop: 18,
    marginBottom: 10,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  mini: {
    width: "48%",
    backgroundColor: "#111827",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#1f2937",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  miniIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  miniTitle: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },

  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#1f2937",
  },

  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#0ea5e9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  cardBody: {
    flex: 1,
  },

  cardTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },

  cardDesc: {
    color: "#94a3b8",
    fontSize: 12,
    marginTop: 3,
  },

  hrHub: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#7c3aed",
    padding: 18,
    borderRadius: 18,
    gap: 14,
    shadowColor: "#7c3aed",
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },

  hrHubIcon: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
  },

  hrHubTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "800",
  },

  hrHubDesc: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
  },

  bottomBar: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "#1f2937",
    backgroundColor: "#0b1220",
  },

  logoutBtn: {
    backgroundColor: "#dc2626",
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
  },

  logoutText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },

});
