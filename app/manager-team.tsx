import React, { useCallback, useEffect, useMemo, useState } from "react";

import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { listMyTeam, TeamMember } from "../src/services/managerTeam";
import { useTheme } from "../src/theme/ThemeProvider";
import { Avatar } from "../src/components/Avatar";

export default function ManagerTeam() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const team = await listMyTeam(token);
      setMembers(team || []);
    } catch (err: any) {
      Alert.alert("Failed to load team", err?.message || "");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const openMember = (member: TeamMember) => {
    router.push({
      pathname: "/team-member/[id]",
      params: {
        id: member.id,
        name: member.name,
        email: member.email,
        employeeCode: member.employeeCode ?? "",
        role: member.role ?? "",
        tag: member.tag ?? "",
      },
    } as any);
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}>
          <Ionicons name="arrow-back" size={24} color={c.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>My Team</Text>
          <Text style={styles.subtitle}>
            {members.length} direct report{members.length === 1 ? "" : "s"}
          </Text>
        </View>
      </View>

      <FlatList
        data={members}
        keyExtractor={(m) => m.id}
        contentContainerStyle={
          members.length === 0 ? styles.emptyWrap : { padding: 12 }
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
            <Ionicons name="people-outline" size={42} color={c.textFaint} />
            <Text style={styles.emptyText}>
              No employees report to you yet.
            </Text>
            <Text style={styles.emptyHint}>
              Ask HR to set you as the reporting manager for your team.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.7}
            onPress={() => openMember(item)}
          >
            <Avatar name={item.name} uri={item.profilePictureUrl} size={42} bg={c.accent} fg="#fff" fontSize={15} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardName}>{item.name}</Text>
              <Text style={styles.cardSub}>
                {item.email}
                {item.employeeCode ? ` · ${item.employeeCode}` : ""}
              </Text>
              {!!item.tag && <Text style={styles.cardTag}>{item.tag}</Text>}
            </View>
            <Ionicons name="chevron-forward" size={20} color={c.textFaint} />
          </TouchableOpacity>
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
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surface,
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    gap: 12 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: c.accent,
    alignItems: "center",
    justifyContent: "center" },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  cardName: { color: c.text, fontSize: 15, fontWeight: "700" },
  cardSub: { color: c.textMuted, fontSize: 12, marginTop: 2 },
  cardTag: {
    color: c.accentText,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 4 },

  emptyWrap: { flex: 1, justifyContent: "center" },
  empty: { alignItems: "center", gap: 10, padding: 30 },
  emptyText: { color: c.text, fontSize: 14, fontWeight: "700" },
  emptyHint: {
    color: c.textMuted,
    fontSize: 12,
    textAlign: "center",
    paddingHorizontal: 30 } });
