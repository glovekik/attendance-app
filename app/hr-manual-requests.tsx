import React, { useEffect, useState, useCallback, useMemo} from "react";

import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  Platform } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../src/theme/ThemeProvider";
import {
  listHrManualRequests,
  decideHrManualRequest,
  ManualAttendanceRequest,
  ManualRequestStatus } from "../src/services/manualAttendance";

const TABS: { key: ManualRequestStatus; label: string }[] = [
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
];

const statusColor = (s: ManualRequestStatus) =>
  s === "APPROVED"
    ? "#16a34a"
    : s === "REJECTED"
    ? "#dc2626"
    : s === "CANCELLED"
    ? "#374151"
    : "#f59e0b";

const shortTime = (iso?: string | null) => {
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

export default function HRManualRequests() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);
  const [tab, setTab] = useState<ManualRequestStatus>("PENDING");
  const [items, setItems] = useState<ManualAttendanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selected, setSelected] = useState<ManualAttendanceRequest | null>(null);
  const [note, setNote] = useState("");
  const [acting, setActing] = useState<"APPROVE" | "REJECT" | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const data = await listHrManualRequests(token, tab);
      setItems(data || []);
    } catch (err: any) {
      Alert.alert(
        "Couldn't load manual requests",
        err?.message || "Pull down to retry."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router, tab]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const onDecide = async (action: "APPROVE" | "REJECT") => {
    if (!selected) return;
    if (action === "REJECT" && !note.trim()) {
      Alert.alert("Please add a note explaining the rejection");
      return;
    }
    setActing(action);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await decideHrManualRequest(token, selected.id, {
        action,
        note: note.trim() || undefined });
      setItems((prev) => prev.filter((x) => x.id !== selected.id));
      setSelected(null);
      setNote("");
    } catch (err: any) {
      Alert.alert(
        action === "APPROVE" ? "Approve failed" : "Reject failed",
        err?.message || ""
      );
    } finally {
      setActing(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}>
          <Ionicons name="arrow-back" size={24} color={c.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Manual Attendance (HR)</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.tabs}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => {
              setTab(t.key);
              setLoading(true);
            }}
          >
            <Text
              style={[styles.tabText, tab === t.key && styles.tabTextActive]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={c.accent} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(r) => r.id}
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
                name="checkmark-done"
                size={42}
                color={c.textFaint}
              />
              <Text style={styles.emptyText}>Nothing here</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isPending = item.status === "PENDING";
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => isPending && setSelected(item)}
                activeOpacity={isPending ? 0.8 : 1}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.who}>
                    {item.user?.name || "Employee"}
                  </Text>
                  <View
                    style={[
                      styles.statusPill,
                      { backgroundColor: statusColor(item.status) },
                    ]}
                  >
                    <Text style={styles.statusText}>{item.status}</Text>
                  </View>
                </View>
                <Text style={styles.line}>
                  {item.date}
                  {item.attendanceType ? `  ·  ${item.attendanceType}` : ""}
                </Text>
                <Text style={styles.line}>
                  {shortTime(item.checkIn)} → {shortTime(item.checkOut)}
                </Text>
                <Text style={styles.reasonLine} numberOfLines={2}>
                  {item.reason}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <Modal
        visible={!!selected}
        animationType="slide"
        transparent
        onRequestClose={() => setSelected(null)}
      >
        <KeyboardAvoidingView
          behavior="padding"
          style={styles.modalWrap}
        >
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Decide request</Text>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Ionicons name="close" size={24} color={c.textMuted} />
              </TouchableOpacity>
            </View>

            {selected && (
              <View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Employee</Text>
                  <Text style={styles.detailValue}>
                    {selected.user?.name}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Date</Text>
                  <Text style={styles.detailValue}>{selected.date}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Type</Text>
                  <Text style={styles.detailValue}>
                    {selected.attendanceType || "—"}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Time</Text>
                  <Text style={styles.detailValue}>
                    {shortTime(selected.checkIn)} → {shortTime(selected.checkOut)}
                  </Text>
                </View>
                <Text style={styles.labelTop}>Reason</Text>
                <Text style={styles.body}>{selected.reason}</Text>
              </View>
            )}

            <Text style={styles.labelTop}>Note (required to reject)</Text>
            <TextInput
              style={styles.input}
              value={note}
              onChangeText={setNote}
              placeholder="..."
              placeholderTextColor={c.textFaint}
              multiline
            />

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.btn, styles.btnReject]}
                onPress={() => onDecide("REJECT")}
                disabled={acting !== null}
              >
                <Text style={styles.btnText}>
                  {acting === "REJECT" ? "..." : "Reject"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnApprove]}
                onPress={() => onDecide("APPROVE")}
                disabled={acting !== null}
              >
                <Text style={styles.btnText}>
                  {acting === "APPROVE" ? "..." : "Approve"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: c.surfaceBorder },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: c.surface,
    alignItems: "center" },
  tabActive: { backgroundColor: c.accent },
  tabText: { color: c.textMuted, fontSize: 11, fontWeight: "700" },
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
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6 },
  who: { color: c.text, fontSize: 15, fontWeight: "700" },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6 },
  statusText: { color: c.text, fontSize: 10, fontWeight: "800" },
  line: { color: c.textMuted, fontSize: 12, marginTop: 3 },
  reasonLine: {
    color: c.text,
    fontSize: 13,
    marginTop: 8,
    lineHeight: 18 },
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
    borderTopColor: c.surfaceBorder },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8 },
  modalTitle: { color: c.text, fontSize: 18, fontWeight: "800" },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    gap: 10 },
  detailLabel: { color: c.textMuted, fontSize: 12 },
  detailValue: {
    color: c.text,
    fontSize: 14,
    fontWeight: "600",
    flexShrink: 1 },
  labelTop: {
    color: c.textMuted,
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 6 },
  body: { color: c.text, fontSize: 13, lineHeight: 18 },
  input: {
    backgroundColor: c.surface,
    color: c.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    minHeight: 60,
    textAlignVertical: "top" },
  actions: { flexDirection: "row", gap: 10, marginTop: 14 },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center" },
  btnReject: { backgroundColor: "#dc2626" },
  btnApprove: { backgroundColor: "#16a34a" },
  btnText: { color: c.text, fontWeight: "800" } });

