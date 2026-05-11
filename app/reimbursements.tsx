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

import { FilePickButton } from "../src/components/FilePickButton";
import {
  listMyReimbursements,
  submitReimbursement,
} from "../src/services/reimbursements";
import {
  PAYMENT_MODES,
  PaymentMode,
  Reimbursement,
  ReimbursementStatus,
} from "../src/types";

const STATUS_COLOR: Record<ReimbursementStatus, string> = {
  PENDING_MANAGER: "#f59e0b",
  PENDING_HR: "#3b82f6",
  APPROVED: "#16a34a",
  REJECTED: "#dc2626",
};

const STATUS_LABEL: Record<ReimbursementStatus, string> = {
  PENDING_MANAGER: "Awaiting manager",
  PENDING_HR: "Awaiting HR",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

const fmtMoney = (n: number) =>
  n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const todayYMD = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function ReimbursementsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Reimbursement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Submit form state
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [expenseDate, setExpenseDate] = useState(todayYMD());
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("UPI");
  const [vendorName, setVendorName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [taxAmount, setTaxAmount] = useState("");
  const [description, setDescription] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const data = await listMyReimbursements(token);
      setItems(data || []);
    } catch (err: any) {
      console.log("reimb load error", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const resetForm = () => {
    setTitle("");
    setCategory("");
    setExpenseDate(todayYMD());
    setAmount("");
    setPaymentMode("UPI");
    setVendorName("");
    setInvoiceNumber("");
    setTaxAmount("");
    setDescription("");
    setAttachmentUrl("");
    setAttachments([]);
  };

  const addAttachment = () => {
    const u = attachmentUrl.trim();
    if (!u) return;
    setAttachments((prev) => [...prev, u]);
    setAttachmentUrl("");
  };

  const removeAttachment = (i: number) => {
    setAttachments((prev) => prev.filter((_, idx) => idx !== i));
  };

  const onSubmit = async () => {
    if (!title.trim()) return Alert.alert("Title required");
    if (!category.trim()) return Alert.alert("Category required");
    const amt = parseFloat(amount);
    if (!amt || amt <= 0)
      return Alert.alert("Amount must be greater than 0");
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await submitReimbursement(token, {
        title: title.trim(),
        category: category.trim(),
        expenseDate,
        amount: amt,
        paymentMode,
        vendorName: vendorName.trim() || undefined,
        invoiceNumber: invoiceNumber.trim() || undefined,
        taxAmount: taxAmount ? parseFloat(taxAmount) : undefined,
        description: description.trim() || undefined,
        attachments: attachments.length ? attachments : undefined,
      });
      setShowForm(false);
      resetForm();
      load();
    } catch (err: any) {
      Alert.alert("Submit failed", err?.message || "");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Reimbursements</Text>
        <TouchableOpacity onPress={() => setShowForm(true)}>
          <Ionicons name="add-circle" size={28} color="#3b82f6" />
        </TouchableOpacity>
      </View>

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
            <Ionicons name="card-outline" size={42} color="#475569" />
            <Text style={styles.emptyText}>
              No reimbursements yet
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => setShowForm(true)}
            >
              <Text style={styles.emptyBtnText}>
                Submit your first
              </Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => {
          const color =
            STATUS_COLOR[item.status as ReimbursementStatus] ||
            "#64748b";
          const label =
            STATUS_LABEL[item.status as ReimbursementStatus] ||
            item.status;
          return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.amount}>
                  ₹ {fmtMoney(item.amount)}
                </Text>
              </View>
              <Text style={styles.row}>
                {item.category} · {item.expenseDate}
                {item.paymentMode ? ` · ${item.paymentMode}` : ""}
              </Text>
              <View style={styles.cardFooter}>
                <View
                  style={[styles.statusPill, { backgroundColor: color }]}
                >
                  <Text style={styles.statusText}>{label}</Text>
                </View>
                <Text style={styles.meta}>
                  {new Date(item.createdAt).toLocaleDateString()}
                </Text>
              </View>
              {item.status === "REJECTED" && !!item.decisionNote && (
                <Text style={styles.rejectNote}>
                  ✕ {item.decisionNote}
                </Text>
              )}
            </View>
          );
        }}
      />

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
              <Text style={styles.modalTitle}>New reimbursement</Text>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <Ionicons name="close" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 500 }}>
              <Text style={styles.label}>Title *</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Client lunch — Wipro"
                placeholderTextColor="#475569"
              />

              <Text style={styles.label}>Category *</Text>
              <TextInput
                style={styles.input}
                value={category}
                onChangeText={setCategory}
                placeholder="Food / Travel / Software ..."
                placeholderTextColor="#475569"
              />

              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Expense date *</Text>
                  <TextInput
                    style={styles.input}
                    value={expenseDate}
                    onChangeText={setExpenseDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#475569"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Amount (₹) *</Text>
                  <TextInput
                    style={styles.input}
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="0.00"
                    placeholderTextColor="#475569"
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <Text style={styles.label}>Payment mode</Text>
              <View style={styles.modeRow}>
                {PAYMENT_MODES.map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.modeBtn,
                      paymentMode === m && styles.modeBtnActive,
                    ]}
                    onPress={() => setPaymentMode(m)}
                  >
                    <Text
                      style={[
                        styles.modeText,
                        paymentMode === m && styles.modeTextActive,
                      ]}
                    >
                      {m}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Vendor</Text>
                  <TextInput
                    style={styles.input}
                    value={vendorName}
                    onChangeText={setVendorName}
                    placeholder="Olive Beach"
                    placeholderTextColor="#475569"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Invoice #</Text>
                  <TextInput
                    style={styles.input}
                    value={invoiceNumber}
                    onChangeText={setInvoiceNumber}
                    placeholder="INV-7793"
                    placeholderTextColor="#475569"
                    autoCapitalize="characters"
                  />
                </View>
              </View>

              <Text style={styles.label}>Tax amount (optional)</Text>
              <TextInput
                style={styles.input}
                value={taxAmount}
                onChangeText={setTaxAmount}
                placeholder="0.00"
                placeholderTextColor="#475569"
                keyboardType="decimal-pad"
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, { height: 70 }]}
                value={description}
                onChangeText={setDescription}
                placeholder="What was it for?"
                placeholderTextColor="#475569"
                multiline
              />

              <Text style={styles.label}>Attachments</Text>
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                <FilePickButton
                  label="Pick receipt"
                  onUploaded={(url) =>
                    setAttachments((prev) => [...prev, url])
                  }
                />
              </View>
              <Text
                style={[
                  styles.label,
                  { marginTop: 12, fontSize: 10 },
                ]}
              >
                Or paste a URL
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={attachmentUrl}
                  onChangeText={setAttachmentUrl}
                  placeholder="https://..."
                  placeholderTextColor="#475569"
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={addAttachment}
                >
                  <Ionicons name="add" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
              {attachments.map((a, i) => (
                <View key={i} style={styles.attachRow}>
                  <Ionicons
                    name="attach"
                    size={14}
                    color="#94a3b8"
                  />
                  <Text style={styles.attachUrl} numberOfLines={1}>
                    {a}
                  </Text>
                  <TouchableOpacity
                    onPress={() => removeAttachment(i)}
                  >
                    <Ionicons
                      name="close"
                      size={16}
                      color="#94a3b8"
                    />
                  </TouchableOpacity>
                </View>
              ))}

              <View style={{ height: 16 }} />
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
                onPress={onSubmit}
                disabled={saving}
              >
                <Text style={styles.btnPrimaryText}>
                  {saving ? "Submitting..." : "Submit"}
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
  cardTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
    marginRight: 8,
  },
  amount: { color: "#3b82f6", fontSize: 15, fontWeight: "800" },
  row: { color: "#94a3b8", fontSize: 12, marginTop: 6 },
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
  empty: { alignItems: "center", gap: 10, padding: 24 },
  emptyText: { color: "#475569", fontSize: 14 },
  emptyBtn: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 6,
  },
  emptyBtnText: { color: "#fff", fontWeight: "700" },
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
  label: {
    color: "#94a3b8",
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: "700",
    marginTop: 12,
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
  modeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  modeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  modeBtnActive: {
    backgroundColor: "#3b82f6",
    borderColor: "#3b82f6",
  },
  modeText: { color: "#94a3b8", fontSize: 11, fontWeight: "700" },
  modeTextActive: { color: "#fff" },
  addBtn: {
    width: 44,
    backgroundColor: "#3b82f6",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  attachRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 6,
    gap: 6,
  },
  attachUrl: { color: "#cbd5e1", fontSize: 11, flex: 1 },
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
