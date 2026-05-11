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
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  listHrReimbursements,
  decideHrReimbursement,
} from "../src/services/reimbursements";
import {
  Reimbursement,
  ReimbursementStatus,
} from "../src/types";

const STATUS_COLOR: Record<ReimbursementStatus, string> = {
  PENDING_MANAGER: "#f59e0b",
  PENDING_HR: "#3b82f6",
  APPROVED: "#16a34a",
  REJECTED: "#dc2626",
};

const fmtMoney = (n: number) =>
  n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtDate = (iso?: string) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

const TABS: { key: ReimbursementStatus; label: string }[] = [
  { key: "PENDING_HR", label: "Pending (HR)" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
];

export default function HrReimbursements() {
  const router = useRouter();
  const [tab, setTab] = useState<ReimbursementStatus>("PENDING_HR");
  const [items, setItems] = useState<Reimbursement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Reimbursement | null>(null);
  const [note, setNote] = useState("");
  const [acting, setActing] = useState<"APPROVE" | "REJECT" | null>(
    null
  );

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const data = await listHrReimbursements(token, tab);
      setItems(data || []);
    } catch (err: any) {
      console.log("hr-reimb load error", err);
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

  const openDetail = (r: Reimbursement) => {
    setSelected(r);
    setNote("");
  };

  const close = () => {
    setSelected(null);
    setNote("");
    setActing(null);
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
      await decideHrReimbursement(token, selected.id, {
        action,
        note: note.trim() || undefined,
      });
      setItems((prev) => prev.filter((x) => x.id !== selected.id));
      close();
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
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Reimbursements (HR)</Text>
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
              style={[
                styles.tabText,
                tab === t.key && styles.tabTextActive,
              ]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#3b82f6" />
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
              tintColor="#3b82f6"
              colors={["#3b82f6"]}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons
                name="checkmark-done"
                size={42}
                color="#475569"
              />
              <Text style={styles.emptyText}>Nothing here</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isPending = item.status === "PENDING_HR";
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => (isPending ? openDetail(item) : null)}
                activeOpacity={isPending ? 0.8 : 1}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.who}>
                    {item.user?.name || "Unknown"}
                  </Text>
                  <Text style={styles.amount}>
                    ₹ {fmtMoney(item.amount)}
                  </Text>
                </View>
                <Text style={styles.titleLine} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.row}>
                  {item.category} · {item.expenseDate}
                  {item.paymentMode ? ` · ${item.paymentMode}` : ""}
                </Text>
                <View style={styles.cardFooter}>
                  <View
                    style={[
                      styles.statusPill,
                      {
                        backgroundColor:
                          STATUS_COLOR[
                            item.status as ReimbursementStatus
                          ] || "#64748b",
                      },
                    ]}
                  >
                    <Text style={styles.statusText}>{item.status}</Text>
                  </View>
                  {isPending ? (
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color="#64748b"
                    />
                  ) : (
                    <Text style={styles.meta}>
                      {fmtDate(
                        item.decidedByHrAt || item.decidedByManagerAt
                      )}
                    </Text>
                  )}
                </View>
                {item.status === "REJECTED" && !!item.decisionNote && (
                  <Text style={styles.rejectNote}>
                    ✕ {item.decisionNote}
                  </Text>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}

      <Modal
        visible={!!selected}
        animationType="slide"
        transparent
        onRequestClose={close}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalWrap}
        >
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Final approval</Text>
              <TouchableOpacity onPress={close}>
                <Ionicons name="close" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {selected && (
              <ScrollView style={{ maxHeight: 400 }}>
                <View style={styles.banner}>
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color="#16a34a"
                  />
                  <Text style={styles.bannerText}>
                    Manager approved
                    {selected.decidedByManagerAt
                      ? ` · ${fmtDate(selected.decidedByManagerAt)}`
                      : ""}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Employee</Text>
                  <Text style={styles.detailValue}>
                    {selected.user?.name}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Title</Text>
                  <Text
                    style={[styles.detailValue, { textAlign: "right" }]}
                  >
                    {selected.title}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Amount</Text>
                  <Text style={styles.detailValue}>
                    ₹ {fmtMoney(selected.amount)}
                    {selected.taxAmount
                      ? `  (incl. tax ₹${fmtMoney(selected.taxAmount)})`
                      : ""}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Category</Text>
                  <Text style={styles.detailValue}>
                    {selected.category}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Expense date</Text>
                  <Text style={styles.detailValue}>
                    {selected.expenseDate}
                  </Text>
                </View>
                {!!selected.paymentMode && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Payment mode</Text>
                    <Text style={styles.detailValue}>
                      {selected.paymentMode}
                    </Text>
                  </View>
                )}
                {!!selected.vendorName && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Vendor</Text>
                    <Text style={styles.detailValue}>
                      {selected.vendorName}
                    </Text>
                  </View>
                )}
                {!!selected.invoiceNumber && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Invoice #</Text>
                    <Text style={styles.detailValue}>
                      {selected.invoiceNumber}
                    </Text>
                  </View>
                )}
                {!!selected.description && (
                  <>
                    <Text style={styles.labelTop}>Description</Text>
                    <Text style={styles.body}>
                      {selected.description}
                    </Text>
                  </>
                )}
                {!!(
                  selected.attachments && selected.attachments.length
                ) && (
                  <>
                    <Text style={styles.labelTop}>Attachments</Text>
                    {selected.attachments!.map((a, i) => (
                      <Text key={i} style={styles.link} numberOfLines={1}>
                        {a}
                      </Text>
                    ))}
                  </>
                )}
              </ScrollView>
            )}

            <Text style={styles.labelTop}>Note (required to reject)</Text>
            <TextInput
              style={styles.input}
              value={note}
              onChangeText={setNote}
              placeholder="..."
              placeholderTextColor="#475569"
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
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#111827",
    alignItems: "center",
  },
  tabActive: { backgroundColor: "#3b82f6" },
  tabText: { color: "#94a3b8", fontSize: 11, fontWeight: "700" },
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
    justifyContent: "space-between",
    alignItems: "center",
  },
  who: { color: "#fff", fontSize: 15, fontWeight: "700" },
  amount: { color: "#3b82f6", fontSize: 15, fontWeight: "800" },
  titleLine: { color: "#cbd5e1", fontSize: 13, marginTop: 6 },
  row: { color: "#94a3b8", fontSize: 12, marginTop: 4 },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  meta: { color: "#64748b", fontSize: 11 },
  rejectNote: {
    color: "#fca5a5",
    fontSize: 12,
    marginTop: 8,
    fontStyle: "italic",
  },
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
    marginBottom: 8,
  },
  modalTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#052e21",
    borderColor: "#14532d",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
    marginBottom: 8,
  },
  bannerText: { color: "#86efac", fontSize: 11, fontWeight: "700" },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    gap: 10,
  },
  detailLabel: { color: "#94a3b8", fontSize: 12 },
  detailValue: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    flexShrink: 1,
  },
  labelTop: {
    color: "#94a3b8",
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 6,
  },
  body: { color: "#cbd5e1", fontSize: 13 },
  link: { color: "#3b82f6", fontSize: 12, marginTop: 2 },
  input: {
    backgroundColor: "#111827",
    color: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1f2937",
    minHeight: 60,
    textAlignVertical: "top",
  },
  actions: { flexDirection: "row", gap: 10, marginTop: 14 },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  btnReject: { backgroundColor: "#dc2626" },
  btnApprove: { backgroundColor: "#16a34a" },
  btnText: { color: "#fff", fontWeight: "800" },
});
