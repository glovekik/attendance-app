import React, { useCallback, useEffect, useMemo, useState } from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  listConversations,
  createChatGroup,
  ChatConversation,
} from "../../src/services/chat";
import { listUserDirectory } from "../../src/services/users";
import { getMe } from "../../src/services/api";
import { WebModal, ModalActions } from "../../src/components/WebModal";
import { notify } from "../../src/utils/confirm";
import { User, hasRole } from "../../src/types";
import { chatUnreadStore } from "../../src/services/chatUnread";
import { useTheme } from "../../src/theme/ThemeProvider";
import { ChatPane } from "../../src/components/ChatPane";
import { useResponsive } from "../../src/utils/responsive";

/** Short relative stamp, WhatsApp-style: time today, "Yesterday", else date. */
const stamp = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (
    d.getDate() === yest.getDate() &&
    d.getMonth() === yest.getMonth() &&
    d.getFullYear() === yest.getFullYear()
  ) {
    return "Yesterday";
  }
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

export default function ChatList() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);

  const { isDesktop } = useResponsive();
  const [rows, setRows] = useState<ChatConversation[]>([]);
  // Desktop keeps the open conversation beside the list, WhatsApp-desktop
  // style, instead of navigating away and back.
  const [selected, setSelected] = useState<ChatConversation | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [me, setMe] = useState<User | null>(null);

  // Create-group modal. HR only — the server enforces it too.
  const [newOpen, setNewOpen] = useState(false);
  const [gName, setGName] = useState("");
  const [gMembers, setGMembers] = useState<string[]>([]);
  const [gSaving, setGSaving] = useState(false);
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [memberQuery, setMemberQuery] = useState("");

  const isHR = hasRole(me, "HR");

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const [data, user] = await Promise.all([
        listConversations(token),
        me ? Promise.resolve(me) : getMe(token),
      ]);
      setMe(user);
      setRows(data.conversations || []);
      // Same source of truth as the nav badge, so they can't disagree.
      chatUnreadStore.set(data.totalUnread || 0);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router, me]);

  // Refresh on every focus so counts settle after reading a chat.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [rows, query]);

  const routeFor = (r: ChatConversation) =>
    r.channelType === "office"
      ? "/chat/office"
      : r.channelType === "group"
      ? `/chat/group/${r.channelId}`
      : `/chat/project/${r.channelId}`;

  const open = (r: ChatConversation) => {
    if (isDesktop) {
      setSelected(r);
      // Opening marks it read; reflect that in the list without a round-trip.
      setRows((prev) =>
        prev.map((x) =>
          x.channelType === r.channelType && x.channelId === r.channelId
            ? { ...x, unread: 0 }
            : x
        )
      );
      return;
    }
    router.push(routeFor(r) as any);
  };

  const openCreate = useCallback(async () => {
    setGName("");
    setGMembers([]);
    setMemberQuery("");
    setNewOpen(true);
    if (people.length) return;
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const dir = await listUserDirectory(token);
      setPeople(
        (dir.items || []).map((u: any) => ({ id: u.id, name: u.name }))
      );
    } catch {
      setPeople([]);
    }
  }, [people.length]);

  const onCreateGroup = async () => {
    if (gSaving) return;
    if (!gName.trim()) {
      notify("Name required", "Give the group a name.");
      return;
    }
    try {
      setGSaving(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const { id } = await createChatGroup(token, {
        name: gName.trim(),
        memberIds: gMembers,
      });
      setNewOpen(false);
      await load();
      if (!isDesktop) router.push(`/chat/group/${id}` as any);
    } catch (err: any) {
      notify("Couldn't create group", err?.message || "");
    } finally {
      setGSaving(false);
    }
  };

  const memberMatches = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    if (!q) return people;
    return people.filter((p) => (p.name || "").toLowerCase().includes(q));
  }, [people, memberQuery]);

  // Default to the first conversation so the desktop pane is never empty.
  useEffect(() => {
    if (isDesktop && !selected && rows.length) setSelected(rows[0]);
    if (!isDesktop && selected) setSelected(null);
  }, [isDesktop, selected, rows]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loader}>
        <ActivityIndicator color={c.accent} />
      </SafeAreaView>
    );
  }

  const list = (
    <ScrollView
      style={styles.container}
        contentContainerStyle={[
        styles.content,
        isDesktop && styles.contentDesktop,
      ]}
        keyboardShouldPersistTaps="handled"
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
          {!isDesktop && (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace("/")
              }
            >
              <Ionicons name="chevron-back" size={22} color={c.text} />
            </TouchableOpacity>
          )}

          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Chats</Text>
            <Text style={styles.subtitle}>
              {rows.length} {rows.length === 1 ? "conversation" : "conversations"}
            </Text>
          </View>

          {isHR && (
            <TouchableOpacity style={styles.newBtn} onPress={openCreate}>
              <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={c.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search chats"
            placeholderTextColor={c.textFaint}
          />
          {!!query && (
            <TouchableOpacity onPress={() => setQuery("")} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={c.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {visible.map((r) => {
          const lm = r.lastMessage;
          const preview = !lm
            ? "No messages yet"
            : lm.hasAttachments && !lm.text
            ? "📎 Attachment"
            : `${lm.authorName ? `${lm.authorName.split(" ")[0]}: ` : ""}${
                lm.text
              }`;
          const isOffice = r.channelType === "office";

          return (
            <TouchableOpacity
              key={`${r.channelType}:${r.channelId ?? "office"}`}
              style={[
                styles.card,
                isDesktop &&
                  selected?.channelType === r.channelType &&
                  selected?.channelId === r.channelId &&
                  styles.cardSelected,
              ]}
              onPress={() => open(r)}
              activeOpacity={0.85}
            >
              <View
                style={[
                  styles.iconBox,
                  {
                    backgroundColor: isOffice
                      ? "#0ea5e9"
                      : r.channelType === "group"
                      ? "#0f9d8f"
                      : "#7c3aed",
                  },
                ]}
              >
                <Ionicons
                  name={
                    isOffice
                      ? "business-outline"
                      : r.channelType === "group"
                      ? "people-outline"
                      : "folder-outline"
                  }
                  size={20}
                  color="#fff"
                />
              </View>

              <View style={{ flex: 1 }}>
                <View style={styles.rowTop}>
                  <Text style={styles.cardName} numberOfLines={1}>
                    {r.name}
                  </Text>
                  <Text
                    style={[
                      styles.time,
                      r.unread > 0 && { color: c.accent, fontWeight: "700" },
                    ]}
                  >
                    {stamp(lm?.createdAt)}
                  </Text>
                </View>
                <View style={styles.rowBottom}>
                  <Text
                    style={[
                      styles.preview,
                      r.unread > 0 && { color: c.text, fontWeight: "600" },
                    ]}
                    numberOfLines={1}
                  >
                    {preview}
                  </Text>
                  {r.unread > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {r.unread > 99 ? "99+" : r.unread}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

      {visible.length === 0 && (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>
            {query ? "No chats match" : "No chats yet"}
          </Text>
          <Text style={styles.emptySub}>
            {query
              ? "Try a different name."
              : "Project chats appear here once you're added to a project."}
          </Text>
        </View>
      )}
    </ScrollView>
  );

  // Mobile: list only, tapping navigates. Desktop: list pinned to the left
  // with the open conversation beside it.
  if (!isDesktop) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        {list}

      <WebModal
        visible={newOpen}
        onClose={() => setNewOpen(false)}
        title="New group"
        size="md"
        scrollable
        footer={
          <ModalActions align="spread">
            <TouchableOpacity
              style={[styles.mBtn, styles.mBtnGhost]}
              onPress={() => setNewOpen(false)}
            >
              <Text style={styles.mBtnGhostText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.mBtn, styles.mBtnPrimary]}
              onPress={onCreateGroup}
              disabled={gSaving}
            >
              <Text style={styles.mBtnPrimaryText}>
                {gSaving ? "…" : "Create"}
              </Text>
            </TouchableOpacity>
          </ModalActions>
        }
      >
        <Text style={styles.fLabel}>Group name *</Text>
        <TextInput
          style={styles.fInput}
          value={gName}
          onChangeText={setGName}
          placeholder="Cricket Team, Diwali Planning…"
          placeholderTextColor={c.textFaint}
        />

        <Text style={styles.fLabel}>
          Members {gMembers.length > 0 ? `(${gMembers.length})` : ""}
        </Text>
        <View style={[styles.searchBox, { marginBottom: 8 }]}>
          <Ionicons name="search" size={15} color={c.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={memberQuery}
            onChangeText={setMemberQuery}
            placeholder="Search people"
            placeholderTextColor={c.textFaint}
          />
        </View>
        {memberMatches.length === 0 && (
          <Text style={styles.emptySub}>No people found.</Text>
        )}
        {memberMatches.map((p) => {
          const on = gMembers.includes(p.id);
          return (
            <TouchableOpacity
              key={p.id}
              style={styles.memberRow}
              onPress={() =>
                setGMembers((cur) =>
                  on ? cur.filter((x) => x !== p.id) : [...cur, p.id]
                )
              }
            >
              <Ionicons
                name={on ? "checkbox" : "square-outline"}
                size={18}
                color={on ? c.accent : c.textMuted}
              />
              <Text style={styles.memberName}>{p.name}</Text>
            </TouchableOpacity>
          );
        })}
        <Text style={styles.hint}>
          You&apos;re added automatically. Only HR can create or manage groups.
        </Text>
      </WebModal>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.split}>
        <View style={styles.listPane}>{list}</View>
        <View style={styles.chatPane}>
          {selected ? (
            <ChatPane
              channelType={selected.channelType}
              channelId={selected.channelId ?? undefined}
              embedded
            />
          ) : (
            <View style={styles.placeholder}>
              <Ionicons
                name="chatbubbles-outline"
                size={40}
                color={c.textFaint}
              />
              <Text style={styles.emptySub}>
                Pick a conversation to start reading.
              </Text>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (c: any) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    container: { flex: 1 },
    split: { flex: 1, flexDirection: "row" },
    listPane: { width: 340, borderRightWidth: 1, borderRightColor: c.surfaceBorder },
    chatPane: { flex: 1 },
    placeholder: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    },
    content: { padding: 20, paddingBottom: 60 },
    contentDesktop: { padding: 14, paddingBottom: 30 },
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
    memberRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 9,
    },
    memberName: { color: c.text, fontSize: 14, fontWeight: "600" },
    fLabel: {
      color: c.textMuted,
      fontSize: 12,
      fontWeight: "700",
      marginTop: 12,
      marginBottom: 6,
    },
    fInput: {
      backgroundColor: c.surfaceMuted,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: c.text,
      fontSize: 14,
    },
    hint: { color: c.textFaint, fontSize: 11.5, marginTop: 12 },
    mBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
    mBtnGhost: { borderWidth: 1, borderColor: c.surfaceBorder },
    mBtnGhostText: { color: c.textMuted, fontWeight: "700", fontSize: 13 },
    mBtnPrimary: { backgroundColor: c.accent },
    mBtnPrimaryText: { color: "#fff", fontWeight: "700", fontSize: 13 },
    newBtn: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: c.accent,
      justifyContent: "center",
      alignItems: "center",
    },
    title: { color: c.text, fontSize: 24, fontWeight: "800" },
    subtitle: { color: c.textMuted, fontSize: 13, marginTop: 3 },

    searchBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: c.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      paddingHorizontal: 12,
      height: 42,
      marginBottom: 14,
    },
    searchInput: { flex: 1, color: c.text, fontSize: 14, outlineStyle: "none" } as any,

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
    cardSelected: { borderColor: c.accent, backgroundColor: c.surfaceMuted },
    iconBox: {
      width: 44,
      height: 44,
      borderRadius: 12,
      justifyContent: "center",
      alignItems: "center",
    },
    rowTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    rowBottom: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      marginTop: 3,
    },
    cardName: { color: c.text, fontSize: 15, fontWeight: "700", flex: 1 },
    time: { color: c.textMuted, fontSize: 11 },
    preview: { color: c.textMuted, fontSize: 12, flex: 1 },
    badge: {
      minWidth: 20,
      height: 20,
      paddingHorizontal: 6,
      borderRadius: 10,
      backgroundColor: c.accent,
      justifyContent: "center",
      alignItems: "center",
    },
    badgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },

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
