import React, {
  useEffect,
  useState,
} from "react";

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  SafeAreaView,
  Image,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useRouter } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import { getMe } from "../src/services/api";

import { unregisterPushToken } from "../src/services/notifications";

import { User, hasRole } from "../src/types";

export default function Profile() {

  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // ================= LOAD USER =================
  const loadUser = async () => {
    try {
      const token = await AsyncStorage.getItem("token");

      if (!token) {
        router.replace("/login");
        return;
      }

      const res = await getMe(token);

      if (res) {
        setUser(res);
      }

    } catch (err) {
      console.log("Profile error:", err);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadUser();
  }, []);

  // ================= LOGOUT =================
  const handleLogout = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (token) {
        await unregisterPushToken(token).catch(() => {});
      }
      await AsyncStorage.removeItem("token");
      router.replace("/login");
    } catch (err) {
      console.log("Logout error:", err);
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>
          Loading profile...
        </Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.loader}>
        <Text style={{ color: "#fff" }}>
          Could not load profile
        </Text>
      </View>
    );
  }

  const isHR = hasRole(user, "HR");
  const ledCount = user.ledTeamIds?.length || 0;
  const memberCount = user.memberOfTeamIds?.length || 0;
  const initial = user.name.charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.safe}>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >

        {/* HEADER */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
          >
            <Ionicons
              name="chevron-back"
              size={22}
              color="#fff"
            />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Profile</Text>

          <View style={{ width: 42 }} />
        </View>

        {/* IDENTITY */}
        <View style={styles.identity}>

          {user.profilePictureUrl ? (
            <Image
              source={{ uri: user.profilePictureUrl }}
              style={styles.avatarImg}
            />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {initial}
              </Text>
            </View>
          )}

          <Text style={styles.name}>{user.name}</Text>

          <Text style={styles.email}>{user.email}</Text>

          <View style={styles.chipsRow}>
            <View
              style={[
                styles.chip,
                isHR && { backgroundColor: "#db2777" },
              ]}
            >
              <Text style={styles.chipText}>
                {user.role}
              </Text>
            </View>

            {user.tag && (
              <View
                style={[
                  styles.chip,
                  { backgroundColor: "#0ea5e9" },
                ]}
              >
                <Text style={styles.chipText}>
                  {user.tag.toUpperCase()}
                </Text>
              </View>
            )}

            {ledCount > 0 && (
              <View
                style={[
                  styles.chip,
                  { backgroundColor: "#7c3aed" },
                ]}
              >
                <Text style={styles.chipText}>
                  TEAM LEAD
                </Text>
              </View>
            )}

            {user.status && user.status !== "Active" && (
              <View
                style={[
                  styles.chip,
                  user.status === "Terminated"
                    ? { backgroundColor: "#dc2626" }
                    : { backgroundColor: "#f59e0b" },
                ]}
              >
                <Text style={styles.chipText}>
                  {user.status.toUpperCase()}
                </Text>
              </View>
            )}
          </View>

        </View>

        {/* ACCOUNT */}
        <Text style={styles.section}>ACCOUNT</Text>

        <View style={styles.card}>

          {user.employeeCode ? (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Employee Code</Text>
              <Text style={styles.rowValue}>
                {user.employeeCode}
              </Text>
            </View>
          ) : null}

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Email</Text>
            <Text
              style={styles.rowValue}
              numberOfLines={1}
            >
              {user.email}
            </Text>
          </View>

          {user.workPhone ? (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Work Phone</Text>
              <Text style={styles.rowValue}>
                {user.workPhone}
              </Text>
            </View>
          ) : null}

          {user.joiningDate ? (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Joined</Text>
              <Text style={styles.rowValue}>
                {new Date(
                  `${user.joiningDate}T00:00:00`
                ).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </Text>
            </View>
          ) : null}

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Role</Text>
            <Text style={styles.rowValue}>{user.role}</Text>
          </View>

          {user.tag ? (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Designation</Text>
              <Text style={styles.rowValue}>{user.tag}</Text>
            </View>
          ) : null}

          <View style={[styles.row, styles.rowLast]}>
            <Text style={styles.rowLabel}>User ID</Text>
            <Text style={styles.rowValue}>
              …{user.id.slice(-8)}
            </Text>
          </View>

        </View>

        {/* TEAMS */}
        {(ledCount > 0 || memberCount > 0) && (
          <>
            <Text style={styles.section}>TEAMS</Text>

            <View style={styles.card}>

              {ledCount > 0 && (
                <TouchableOpacity
                  style={[
                    styles.row,
                    memberCount === 0 && styles.rowLast,
                  ]}
                  onPress={() => router.push("/teams")}
                  activeOpacity={0.7}
                >
                  <View style={styles.rowIconWrap}>
                    <View
                      style={[
                        styles.rowIcon,
                        { backgroundColor: "#7c3aed" },
                      ]}
                    >
                      <Ionicons
                        name="ribbon-outline"
                        size={16}
                        color="#fff"
                      />
                    </View>
                    <Text style={styles.rowLabel}>
                      Leading
                    </Text>
                  </View>
                  <View style={styles.rowEnd}>
                    <Text style={styles.rowValue}>
                      {ledCount} team{ledCount === 1 ? "" : "s"}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color="#64748b"
                    />
                  </View>
                </TouchableOpacity>
              )}

              {memberCount > 0 && (
                <View style={[styles.row, styles.rowLast]}>
                  <View style={styles.rowIconWrap}>
                    <View
                      style={[
                        styles.rowIcon,
                        { backgroundColor: "#2563eb" },
                      ]}
                    >
                      <Ionicons
                        name="people-outline"
                        size={16}
                        color="#fff"
                      />
                    </View>
                    <Text style={styles.rowLabel}>
                      Member of
                    </Text>
                  </View>
                  <Text style={styles.rowValue}>
                    {memberCount} team
                    {memberCount === 1 ? "" : "s"}
                  </Text>
                </View>
              )}

            </View>
          </>
        )}

        {/* LOGOUT */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
        >
          <Ionicons
            name="log-out-outline"
            size={20}
            color="#fff"
          />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>

      </ScrollView>

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
    paddingBottom: 40,
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

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    marginBottom: 14,
  },

  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },

  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#111827",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1f2937",
  },

  identity: {
    alignItems: "center",
    marginVertical: 18,
  },

  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#2563eb",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },

  avatarImg: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginBottom: 14,
  },

  avatarText: {
    color: "#fff",
    fontSize: 36,
    fontWeight: "800",
  },

  name: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
  },

  email: {
    color: "#94a3b8",
    fontSize: 14,
    marginTop: 4,
  },

  chipsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    flexWrap: "wrap",
    justifyContent: "center",
  },

  chip: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },

  chipText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },

  section: {
    color: "#64748b",
    fontSize: 12,
    letterSpacing: 1.5,
    fontWeight: "700",
    marginTop: 18,
    marginBottom: 10,
  },

  card: {
    backgroundColor: "#111827",
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "#1f2937",
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
    gap: 12,
  },

  rowLast: {
    borderBottomWidth: 0,
  },

  rowIconWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  rowIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },

  rowLabel: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "600",
  },

  rowValue: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    flexShrink: 1,
    textAlign: "right",
  },

  rowEnd: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  logoutBtn: {
    backgroundColor: "#dc2626",
    paddingVertical: 16,
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 24,
  },

  logoutText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },

});
