import React, { useEffect, useState, useCallback, useMemo} from "react";

import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
  Switch,
  Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { WebModal, ModalActions } from "../src/components/WebModal";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  listFeedbackAboutMe,
  listFeedbackSent,
  sendFeedback } from "../src/services/feedback";
import { listUsers } from "../src/services/users";
import { useTheme } from "../src/theme/ThemeProvider";
import { feedbackTypeColor } from "../src/theme/statusColors";
import {
  FEEDBACK_TYPES,
  FeedbackItem,
  FeedbackType,
  User } from "../src/types";


type Tab = "received" | "sent";

export default function FeedbackScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);
  const [tab, setTab] = useState<Tab>("received");
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Send modal
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toUserId, setToUserId] = useState<string | null>(null);
  const [type, setType] = useState<FeedbackType>("POSITIVE");
  const [text, setText] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [userSearch, setUserSearch] = useState("");

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const list =
        tab === "received"
          ? await listFeedbackAboutMe(token).catch(() => [])
          : await listFeedbackSent(token).catch(() => []);
      setItems(list || []);
      if (users.length === 0) {
        const u = await listUsers(token).catch(() => [] as User[]);
        setUsers(u || []);
      }
    } catch (err: any) {
      Alert.alert(
        "Couldn't load feedback",
        err?.message || "Pull down to retry."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router, tab, users]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const onSend = async () => {
    if (!toUserId) return Alert.alert("Pick a recipient");
    if (!text.trim()) return Alert.alert("Write some feedback");
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await sendFeedback(token, {
        toUserId,
        type,
        text: text.trim(),
        anonymous });
      setShowForm(false);
      setToUserId(null);
      setType("POSITIVE");
      setText("");
      setAnonymous(false);
      load();
    } catch (err: any) {
      Alert.alert("Send failed", err?.message || "");
    } finally {
      setSaving(false);
    }
  };

  const senderName = (id?: string | null) => {
    if (!id) return "Anonymous";
    return users.find((u) => u.id === id)?.name || "Someone";
  };

  const filteredUsers = users.filter((u) => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}>
          <Ionicons name="arrow-back" size={24} color={c.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Feedback</Text>
        <TouchableOpacity onPress={() => setShowForm(true)}>
          <Ionicons name="add-circle" size={28} color={c.accent} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === "received" && styles.tabActive]}
          onPress={() => {
            setTab("received");
            setLoading(true);
          }}
        >
          <Text
            style={[
              styles.tabText,
              tab === "received" && styles.tabTextActive,
            ]}
          >
            About me
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === "sent" && styles.tabActive]}
          onPress={() => {
            setTab("sent");
            setLoading(true);
          }}
        >
          <Text
            style={[
              styles.tabText,
              tab === "sent" && styles.tabTextActive,
            ]}
          >
            Sent
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={c.accent} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(f) => f.id}
          contentContainerStyle={
            items.length === 0 ? styles.emptyWrap : { padding: 12 }
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={c.accent}
              colors={[c.accent]}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons
                name="chatbubbles-outline"
                size={42}
                color={c.textFaint}
              />
              <Text style={styles.emptyText}>
                {tab === "received"
                  ? "No feedback about you yet"
                  : "You haven't sent any feedback"}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const who =
              tab === "received"
                ? senderName(item.fromUserId)
                : users.find((u) => u.id === item.toUserId)?.name ||
                  "Someone";
            const tc = feedbackTypeColor(item.type, c);
            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.who}>
                    {tab === "received" ? "From" : "To"}: {who}
                    {item.anonymous && tab === "received"
                      ? "  · anonymous"
                      : ""}
                  </Text>
                  <View
                    style={[
                      styles.pill,
                      { backgroundColor: tc.bg },
                    ]}
                  >
                    <Text style={[styles.pillText, { color: tc.fg }]}>
                      {item.type.replace(/_/g, " ")}
                    </Text>
                  </View>
                </View>
                <Text style={styles.text}>{item.text}</Text>
                <Text style={styles.time}>
                  {new Date(item.createdAt).toLocaleString()}
                </Text>
              </View>
            );
          }}
        />
      )}

      {/* SEND */}
      <WebModal
        visible={showForm}
        onClose={() => setShowForm(false)}
        title="Send feedback"
        size="md"
        footer={
          <ModalActions align="spread">
            <TouchableOpacity
              style={[styles.btn, styles.btnGhost]}
              onPress={() => setShowForm(false)}
              disabled={saving}
            >
              <Text style={styles.btnGhostText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary]}
              onPress={onSend}
              disabled={saving}
            >
              <Text style={styles.btnPrimaryText}>
                {saving ? "..." : "Send"}
              </Text>
            </TouchableOpacity>
          </ModalActions>
        }
      >
              <Text style={styles.label}>Recipient *</Text>
              <View style={styles.searchBox}>
                <Ionicons name="search" size={14} color={c.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  value={userSearch}
                  onChangeText={setUserSearch}
                  placeholder="Search..."
                  placeholderTextColor={c.textFaint}
                  autoCapitalize="none"
                />
              </View>
              <View style={styles.chipRow}>
                {filteredUsers.slice(0, 25).map((u) => (
                  <TouchableOpacity
                    key={u.id}
                    style={[
                      styles.chip,
                      toUserId === u.id && styles.chipActive,
                    ]}
                    onPress={() => setToUserId(u.id)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        toUserId === u.id && styles.chipTextActive,
                      ]}
                    >
                      {u.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Type</Text>
              <View style={styles.chipRow}>
                {FEEDBACK_TYPES.map((t) => {
                  const tc = feedbackTypeColor(t, c);
                  return (
                    <TouchableOpacity
                      key={t}
                      style={[
                        styles.chip,
                        type === t && {
                          backgroundColor: tc.bg,
                          borderColor: tc.solid },
                      ]}
                      onPress={() => setType(t)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          type === t && { color: tc.fg },
                        ]}
                      >
                        {t.replace(/_/g, " ")}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>Feedback *</Text>
              <TextInput
                style={[styles.input, { minHeight: 100 }]}
                value={text}
                onChangeText={setText}
                multiline
                textAlignVertical="top"
                placeholder="Be specific and actionable..."
                placeholderTextColor={c.textFaint}
              />

              <View
                style={[
                  styles.row,
                  { marginTop: 14, justifyContent: "space-between" },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Anonymous</Text>
                  <Text style={styles.hint}>
                    HR can still see your identity for audit
                  </Text>
                </View>
                <Switch
                  value={anonymous}
                  onValueChange={setAnonymous}
                  trackColor={{ false: "#1f2937", true: "#3b82f6" }}
                />
              </View>
              <View style={{ height: 14 }} />
      </WebModal>
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
  title: { color: c.text, fontSize: 18, fontWeight: "800", flex: 1 },
  tabs: {
    flexDirection: "row",
    padding: 12,
    gap: 8 },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: c.surface,
    alignItems: "center" },
  tabActive: { backgroundColor: c.accent },
  tabText: { color: c.textMuted, fontSize: 12, fontWeight: "700" },
  tabTextActive: { color: c.text },
  card: {
    backgroundColor: c.surface,
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8 },
  who: { color: c.text, fontSize: 12, fontWeight: "700" },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6 },
  pillText: { color: c.text, fontSize: 10, fontWeight: "800" },
  text: { color: c.text, fontSize: 13, marginTop: 8, lineHeight: 18 },
  time: { color: c.textMuted, fontSize: 10, marginTop: 6 },
  emptyWrap: { flex: 1, justifyContent: "center" },
  empty: { alignItems: "center", gap: 10 },
  emptyText: { color: c.textMuted, fontSize: 14 },
  modalWrap: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: c.overlay },
  modal: {
    backgroundColor: c.surfaceMuted,
    padding: 20,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    borderTopColor: c.surfaceBorder,
    maxHeight: "92%" },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10 },
  modalTitle: { color: c.text, fontSize: 17, fontWeight: "800" },
  label: {
    color: c.textMuted,
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: "700",
    marginTop: 14,
    marginBottom: 6 },
  input: {
    backgroundColor: c.surface,
    color: c.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  chipActive: { backgroundColor: c.accent, borderColor: c.accent },
  chipText: { color: c.textMuted, fontSize: 11, fontWeight: "700" },
  chipTextActive: { color: c.text },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surface,
    borderRadius: 10,
    paddingHorizontal: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    marginBottom: 6 },
  searchInput: {
    flex: 1,
    color: c.text,
    paddingVertical: 7,
    fontSize: 12 },
  hint: { color: c.textMuted, fontSize: 11, marginTop: 2 },
  row: { flexDirection: "row", alignItems: "center" },
  actions: { flexDirection: "row", gap: 10, marginTop: 14 },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center" },
  btnGhost: { backgroundColor: c.surfaceMuted },
  btnGhostText: { color: c.textMuted, fontWeight: "700" },
  btnPrimary: { backgroundColor: c.accent },
  btnPrimaryText: { color: "#fff", fontWeight: "800" } });

