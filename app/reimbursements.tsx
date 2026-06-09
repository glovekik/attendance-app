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
  Platform,
  ScrollView } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { FilePickButton } from "../src/components/FilePickButton";
import { DatePickerField } from "../src/components/DatePickerField";
import { useTheme } from "../src/theme/ThemeProvider";
import {
  reimbursementStatusColor,
  reimbursementStatusLabel } from "../src/theme/statusColors";
import {
  listMyReimbursements,
  submitReimbursement } from "../src/services/reimbursements";
import {
  PAYMENT_MODES,
  PaymentMode,
  Reimbursement } from "../src/types";

const fmtMoney = (n: number) =>
  n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2 });

const todayYMD = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function ReimbursementsScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);
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
      Alert.alert(
        "Couldn't load reimbursements",
        err?.message || "Pull down to retry."
      );
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
        attachments: attachments.length ? attachments : undefined });
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
        <Text style={styles.title}>Reimbursements</Text>
        <TouchableOpacity onPress={() => setShowForm(true)}>
          <Ionicons name="add-circle" size={28} color={c.accent} />
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
            tintColor={c.accent}
            colors={[c.accent]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="card-outline" size={42} color={c.textFaint} />
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
          const sc = reimbursementStatusColor(item.status, c);
          const label = reimbursementStatusLabel(item.status);
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
                  style={[styles.statusPill, { backgroundColor: sc.bg }]}
                >
                  <Text style={[styles.statusText, { color: sc.fg }]}>{label}</Text>
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
          behavior="padding"
          style={styles.modalWrap}
        >
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New reimbursement</Text>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <Ionicons name="close" size={24} color={c.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 500 }}>
              <Text style={styles.label}>Title *</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Client lunch — Wipro"
                placeholderTextColor={c.textFaint}
              />

              <Text style={styles.label}>Category *</Text>
              <TextInput
                style={styles.input}
                value={category}
                onChangeText={setCategory}
                placeholder="Food / Travel / Software ..."
                placeholderTextColor={c.textFaint}
              />

              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Expense date *</Text>
                  <DatePickerField
                    value={expenseDate}
                    onChange={setExpenseDate}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Amount (₹) *</Text>
                  <TextInput
                    style={styles.input}
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="0.00"
                    placeholderTextColor={c.textFaint}
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
                    placeholderTextColor={c.textFaint}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Invoice #</Text>
                  <TextInput
                    style={styles.input}
                    value={invoiceNumber}
                    onChangeText={setInvoiceNumber}
                    placeholder="INV-7793"
                    placeholderTextColor={c.textFaint}
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
                placeholderTextColor={c.textFaint}
                keyboardType="decimal-pad"
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, { height: 70 }]}
                value={description}
                onChangeText={setDescription}
                placeholder="What was it for?"
                placeholderTextColor={c.textFaint}
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
                  placeholderTextColor={c.textFaint}
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
                    color={c.textMuted}
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
                      color={c.textMuted}
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
    alignItems: "center" },
  cardTitle: {
    color: c.text,
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
    marginRight: 8 },
  amount: { color: "#3b82f6", fontSize: 15, fontWeight: "800" },
  row: { color: c.textMuted, fontSize: 12, marginTop: 6 },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10 },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6 },
  statusText: { color: c.text, fontSize: 10, fontWeight: "800" },
  meta: { color: c.textMuted, fontSize: 11 },
  rejectNote: {
    color: "#fca5a5",
    fontSize: 12,
    marginTop: 8,
    fontStyle: "italic" },
  emptyWrap: { flex: 1, justifyContent: "center" },
  empty: { alignItems: "center", gap: 10, padding: 24 },
  emptyText: { color: c.textMuted, fontSize: 14 },
  emptyBtn: {
    backgroundColor: c.accent,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 6 },
  emptyBtnText: { color: "#fff", fontWeight: "700" },
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
    marginBottom: 8 },
  modalTitle: { color: c.text, fontSize: 18, fontWeight: "800" },
  label: {
    color: c.textMuted,
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 6 },
  input: {
    backgroundColor: c.surface,
    color: c.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  modeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  modeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  modeBtnActive: {
    backgroundColor: c.accent,
    borderColor: c.accent },
  modeText: { color: c.textMuted, fontSize: 11, fontWeight: "700" },
  modeTextActive: { color: c.text },
  addBtn: {
    width: 44,
    backgroundColor: c.accent,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center" },
  attachRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 6,
    gap: 6 },
  attachUrl: { color: c.text, fontSize: 11, flex: 1 },
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

