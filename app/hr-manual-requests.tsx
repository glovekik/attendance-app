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
  Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../src/theme/ThemeProvider";
import { WebModal, ModalActions } from "../src/components/WebModal";
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const data = await listHrManualRequests(token, tab);
      setItems(data || []);
      setSelectedIds(new Set());
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

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = items.length > 0 && selectedIds.size === items.length;

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(items.map((i) => i.id)));
  };

  const confirmBulk = async (count: number): Promise<boolean> => {
    const msg = `Approve ${count} request${count === 1 ? "" : "s"}?`;
    if (Platform.OS === "web") {
      return Promise.resolve(
        typeof window !== "undefined" && window.confirm(msg)
      );
    }
    return new Promise((resolve) => {
      Alert.alert("Approve requests?", msg, [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        { text: "Approve", onPress: () => resolve(true) },
      ]);
    });
  };

  const approveMany = async (targets: ManualAttendanceRequest[]) => {
    if (bulkBusy || acting || targets.length === 0) return;
    const ok = await confirmBulk(targets.length);
    if (!ok) return;
    setBulkBusy(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const results = await Promise.allSettled(
        targets.map((t) =>
          decideHrManualRequest(token, t.id, { action: "APPROVE" })
        )
      );
      const approvedIds = new Set(
        targets
          .filter((_, idx) => results[idx].status === "fulfilled")
          .map((t) => t.id)
      );
      const failed = results.length - approvedIds.size;
      setItems((prev) => prev.filter((x) => !approvedIds.has(x.id)));
      setSelectedIds(new Set());
      if (failed > 0) {
        Alert.alert(
          "Some approvals failed",
          `Approved ${approvedIds.size}, ${failed} failed.`
        );
      }
    } catch (err: any) {
      Alert.alert("Bulk approve failed", err?.message || "");
    } finally {
      setBulkBusy(false);
    }
  };

  const approveAll = () => approveMany(items);
  const approveSelected = () =>
    approveMany(items.filter((i) => selectedIds.has(i.id)));

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

      {tab === "PENDING" && !loading && items.length > 0 && (
        <View style={styles.bulkBar}>
          <TouchableOpacity
            style={styles.selectAllBtn}
            onPress={toggleSelectAll}
            disabled={bulkBusy}
          >
            <Ionicons
              name={allSelected ? "checkbox" : "square-outline"}
              size={20}
              color={allSelected ? c.accent : c.textMuted}
            />
            <Text style={styles.selectAllText}>
              {allSelected ? "Deselect all" : "Select all"}
            </Text>
          </TouchableOpacity>

          <View style={{ flex: 1 }} />

          {selectedIds.size > 0 && (
            <TouchableOpacity
              style={[styles.bulkBtn, styles.bulkSelectedBtn, bulkBusy && { opacity: 0.6 }]}
              onPress={approveSelected}
              disabled={bulkBusy}
            >
              <Ionicons name="checkmark" size={15} color="#fff" />
              <Text style={styles.bulkBtnText}>
                Approve selected ({selectedIds.size})
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.bulkBtn, styles.bulkAllBtn, bulkBusy && { opacity: 0.6 }]}
            onPress={approveAll}
            disabled={bulkBusy}
          >
            {bulkBusy ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-done" size={15} color="#fff" />
                <Text style={styles.bulkBtnText}>Approve all</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

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
            const isSelected = selectedIds.has(item.id);
            return (
              <TouchableOpacity
                style={[styles.card, isSelected && styles.cardSelected]}
                onPress={() => isPending && !bulkBusy && setSelected(item)}
                activeOpacity={isPending ? 0.8 : 1}
              >
                <View style={styles.cardTop}>
                  <View style={styles.cardTopLeft}>
                    {isPending && (
                      <TouchableOpacity
                        style={styles.checkbox}
                        onPress={() => toggleSelect(item.id)}
                        disabled={bulkBusy}
                        hitSlop={8}
                      >
                        <Ionicons
                          name={isSelected ? "checkbox" : "square-outline"}
                          size={22}
                          color={isSelected ? c.accent : c.textMuted}
                        />
                      </TouchableOpacity>
                    )}
                    <Text style={styles.who}>
                      {item.user?.name || "Employee"}
                    </Text>
                  </View>
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

      <WebModal
        visible={!!selected}
        onClose={() => {
          setSelected(null);
          setNote("");
        }}
        title="Decide request"
        size="md"
        footer={
          <ModalActions align="spread">
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
          </ModalActions>
        }
      >
        {selected && (
          <View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Employee</Text>
              <Text style={styles.detailValue}>{selected.user?.name}</Text>
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
  bulkBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: c.surfaceBorder,
    flexWrap: "wrap" },
  selectAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4 },
  selectAllText: {
    color: c.text,
    fontSize: 14,
    fontWeight: "600" },
  bulkBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10 },
  bulkSelectedBtn: { backgroundColor: c.accent },
  bulkAllBtn: { backgroundColor: "#16a34a" },
  bulkBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13 },
  card: {
    backgroundColor: c.surface,
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  cardSelected: {
    borderColor: c.accent,
    backgroundColor: c.accentSoft || c.surface },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6 },
  cardTopLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 1 },
  checkbox: {
    justifyContent: "center",
    alignItems: "center" },
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

