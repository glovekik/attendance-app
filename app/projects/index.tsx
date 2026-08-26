import React, { useCallback, useEffect, useMemo, useState } from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { listMyProjects, listProjects } from "../../src/services/projects";
import { listConversations } from "../../src/services/chat";
import { Project, User, hasRole } from "../../src/types";
import { getMe } from "../../src/services/api";
import { useTheme } from "../../src/theme/ThemeProvider";
import { projectStatusColor } from "../../src/theme/statusColors";

export default function ProjectsList() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);

  const [projects, setProjects] = useState<Project[]>([]);
  const [me, setMe] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAll, setShowAll] = useState(false);
  // projectId -> unread, so a card can show its own count.
  const [unread, setUnread] = useState<Record<string, number>>({});

  // HR sees every project; everyone else only the ones they're on.
  const isHR = hasRole(me, "HR") || hasRole(me, "CEO");

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const user = me || (await getMe(token));
      setMe(user);
      const wantsAll =
        showAll && (user?.role === "HR" || user?.role === "CEO");
      setProjects(
        (await (wantsAll ? listProjects(token) : listMyProjects(token))) || []
      );

      // Non-fatal: the list is still useful without unread counts.
      try {
        const { conversations } = await listConversations(token);
        const map: Record<string, number> = {};
        conversations.forEach((cv) => {
          if (cv.channelId) map[cv.channelId] = cv.unread;
        });
        setUnread(map);
      } catch {
        setUnread({});
      }
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [me, router, showAll]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loader}>
        <ActivityIndicator color={c.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
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
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/")
            }
          >
            <Ionicons name="chevron-back" size={22} color={c.text} />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Projects</Text>
            <Text style={styles.subtitle}>
              {projects.length} {isHR && showAll ? "total" : "you're on"}
            </Text>
          </View>

          {isHR && (
            <TouchableOpacity
              style={styles.toggleBtn}
              onPress={() => {
                setShowAll((v) => !v);
                setLoading(true);
              }}
            >
              <Text style={styles.toggleText}>{showAll ? "Mine" : "All"}</Text>
            </TouchableOpacity>
          )}
        </View>

        {projects.map((p) => {
          const sc = projectStatusColor(p.status, c);
          const headcount =
            (p.managerIds?.length || 0) + (p.memberIds?.length || 0);

          return (
            <TouchableOpacity
              key={p.id}
              style={styles.card}
              onPress={() => router.push(`/projects/${p.id}` as any)}
              activeOpacity={0.85}
            >
              <View style={[styles.iconBox, { backgroundColor: "#7c3aed" }]}>
                <Ionicons name="folder-outline" size={20} color="#fff" />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{p.name}</Text>
                <Text style={styles.cardMeta}>
                  {p.code ? `${p.code}  ·  ` : ""}
                  {headcount} members
                </Text>
                <View style={styles.chipRow}>
                  <View style={[styles.chip, { backgroundColor: sc.bg }]}>
                    <Text style={[styles.chipText, { color: sc.fg }]}>
                      {p.status}
                    </Text>
                  </View>
                  {!!p.viewerIsManager && (
                    <View style={styles.chip}>
                      <Ionicons name="star" size={10} color={c.accent} />
                      <Text style={[styles.chipText, { color: c.accent }]}>
                        You manage
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              <TouchableOpacity
                style={styles.chatBtnSm}
                onPress={() => router.push(`/chat/project/${p.id}` as any)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name="chatbubbles-outline"
                  size={20}
                  color={c.textMuted}
                />
                {(unread[p.id] || 0) > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {unread[p.id] > 99 ? "99+" : unread[p.id]}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              <Ionicons name="chevron-forward" size={20} color={c.textMuted} />
            </TouchableOpacity>
          );
        })}

        {projects.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>No projects yet</Text>
            <Text style={styles.emptySub}>
              {isHR
                ? "Create one from HR Admin → Projects."
                : "You're not on any project yet."}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c: any) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    container: { flex: 1 },
    content: { padding: 20, paddingBottom: 60 },
    loader: {
      flex: 1,
      backgroundColor: c.bg,
      justifyContent: "center",
      alignItems: "center",
    },

    header: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 18,
      marginTop: 10,
      gap: 12,
    },
    backBtn: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: c.surface,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: c.surfaceBorder,
    },
    toggleBtn: {
      height: 42,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: c.surface,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: c.surfaceBorder,
    },
    toggleText: { color: c.text, fontWeight: "700", fontSize: 13 },
    title: { color: c.text, fontSize: 24, fontWeight: "800" },
    subtitle: { color: c.textMuted, fontSize: 13, marginTop: 3 },

    card: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.surface,
      borderRadius: 14,
      padding: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      gap: 12,
    },
    iconBox: {
      width: 44,
      height: 44,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    cardName: { color: c.text, fontSize: 15, fontWeight: "700" },
    cardMeta: { color: c.textMuted, fontSize: 12, marginTop: 3 },
    chipRow: { flexDirection: "row", gap: 6, marginTop: 6 },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.surfaceMuted,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      gap: 4,
      alignSelf: "flex-start",
    },
    chipText: { fontSize: 11, fontWeight: "600" },
    chatBtnSm: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: c.surfaceMuted,
      justifyContent: "center",
      alignItems: "center",
    },
    badge: {
      position: "absolute",
      top: -5,
      right: -5,
      minWidth: 18,
      height: 18,
      paddingHorizontal: 5,
      borderRadius: 9,
      backgroundColor: c.accent,
      justifyContent: "center",
      alignItems: "center",
    },
    badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },

    emptyBox: {
      alignItems: "center",
      padding: 40,
      backgroundColor: c.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
    },
    emptyTitle: { color: c.text, fontSize: 16, fontWeight: "700" },
    emptySub: {
      color: c.textMuted,
      fontSize: 13,
      marginTop: 6,
      textAlign: "center",
    },
  });
