import React, { useEffect, useState, useCallback } from "react";

import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  ScrollView,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  listFeedbackAboutMe,
  listFeedbackSent,
  sendFeedback,
} from "../src/services/feedback";
import { listUsers } from "../src/services/users";
import {
  FEEDBACK_TYPES,
  FeedbackItem,
  FeedbackType,
  User,
} from "../src/types";

const TYPE_COLOR: Record<FeedbackType, string> = {
  POSITIVE: "#16a34a",
  CONSTRUCTIVE: "#f59e0b",
  PEER: "#3b82f6",
  MANAGER_TO_REPORT: "#8b5cf6",
  REPORT_TO_MANAGER: "#06b6d4",
};

type Tab = "received" | "sent";

export default function FeedbackScreen() {
  const router = useRouter();
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
      console.log("feedback load error", err);
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
        anonymous,
      });
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
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Feedback</Text>
        <TouchableOpacity onPress={() => setShowForm(true)}>
          <Ionicons name="add-circle" size={28} color="#3b82f6" />
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
          <ActivityIndicator size="large" color="#3b82f6" />
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
              tintColor="#3b82f6"
              colors={["#3b82f6"]}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons
                name="chatbubbles-outline"
                size={42}
                color="#475569"
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
                      { backgroundColor: TYPE_COLOR[item.type] },
                    ]}
                  >
                    <Text style={styles.pillText}>
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
      <Modal
        visible={showForm}
        animationType="slide"
        transparent
        onRequestClose={() => setShowForm(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalWrap}
        >
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Send feedback</Text>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <Ionicons name="close" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 540 }}>
              <Text style={styles.label}>Recipient *</Text>
              <View style={styles.searchBox}>
                <Ionicons name="search" size={14} color="#64748b" />
                <TextInput
                  style={styles.searchInput}
                  value={userSearch}
                  onChangeText={setUserSearch}
                  placeholder="Search..."
                  placeholderTextColor="#475569"
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
                {FEEDBACK_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.chip,
                      type === t && {
                        backgroundColor: TYPE_COLOR[t],
                        borderColor: TYPE_COLOR[t],
                      },
                    ]}
                    onPress={() => setType(t)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        type === t && styles.chipTextActive,
                      ]}
                    >
                      {t.replace(/_/g, " ")}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Feedback *</Text>
              <TextInput
                style={[styles.input, { minHeight: 100 }]}
                value={text}
                onChangeText={setText}
                multiline
                textAlignVertical="top"
                placeholder="Be specific and actionable..."
                placeholderTextColor="#475569"
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
                  trackColor={{ false: "#1e293b", true: "#3b82f6" }}
                />
              </View>
              <View style={{ height: 14 }} />
            </ScrollView>

            <View style={styles.actions}>
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
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b1220" },
  loader: {
    flex: 1,
    backgroundColor: "#0b1220",
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
    gap: 12,
  },
  title: { color: "#fff", fontSize: 18, fontWeight: "800", flex: 1 },
  tabs: {
    flexDirection: "row",
    padding: 12,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#111827",
    alignItems: "center",
  },
  tabActive: { backgroundColor: "#3b82f6" },
  tabText: { color: "#94a3b8", fontSize: 12, fontWeight: "700" },
  tabTextActive: { color: "#fff" },
  card: {
    backgroundColor: "#111827",
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  who: { color: "#fff", fontSize: 12, fontWeight: "700" },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pillText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  text: { color: "#cbd5e1", fontSize: 13, marginTop: 8, lineHeight: 18 },
  time: { color: "#64748b", fontSize: 10, marginTop: 6 },
  emptyWrap: { flex: 1, justifyContent: "center" },
  empty: { alignItems: "center", gap: 10 },
  emptyText: { color: "#475569", fontSize: 14 },
  modalWrap: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modal: {
    backgroundColor: "#0f172a",
    padding: 20,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
    maxHeight: "92%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  modalTitle: { color: "#fff", fontSize: 17, fontWeight: "800" },
  label: {
    color: "#94a3b8",
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: "700",
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#111827",
    color: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  chipActive: { backgroundColor: "#3b82f6", borderColor: "#3b82f6" },
  chipText: { color: "#94a3b8", fontSize: 11, fontWeight: "700" },
  chipTextActive: { color: "#fff" },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 10,
    paddingHorizontal: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: "#1f2937",
    marginBottom: 6,
  },
  searchInput: {
    flex: 1,
    color: "#fff",
    paddingVertical: 7,
    fontSize: 12,
  },
  hint: { color: "#64748b", fontSize: 11, marginTop: 2 },
  row: { flexDirection: "row", alignItems: "center" },
  actions: { flexDirection: "row", gap: 10, marginTop: 14 },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  btnGhost: { backgroundColor: "#1e293b" },
  btnGhostText: { color: "#94a3b8", fontWeight: "700" },
  btnPrimary: { backgroundColor: "#3b82f6" },
  btnPrimaryText: { color: "#fff", fontWeight: "800" },
});
