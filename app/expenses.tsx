import React, {
  useEffect,
  useState,
} from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  Platform,
  Alert,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useRouter } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import DateTimePicker from "@react-native-community/datetimepicker";

import {
  WebDateField,
  dateToYMD,
  ymdToDate,
} from "../src/components/WebDateField";

import {
  hrCreateExpense,
  hrListExpenses,
  hrExpenseSummary,
  hrUpdateExpense,
  hrDeleteExpense,
} from "../src/services/expenses";

import { Expense, ExpenseSummary } from "../src/types";

const isWeb = Platform.OS === "web";

const monthBounds = (year: number, month: number) => {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const last = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return { from, to };
};

const monthLabel = (year: number, month: number) =>
  new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

export default function Expenses() {

  const router = useRouter();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [items, setItems] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(new Date());
  const [showDate, setShowDate] = useState(false);
  const [description, setDescription] = useState("");
  const [vendor, setVendor] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const [popup, setPopup] = useState({
    visible: false,
    type: "success" as "success" | "error",
    message: "",
  });

  const showPopup = (
    msg: string,
    kind: "success" | "error" = "success"
  ) => {
    setPopup({ visible: true, type: kind, message: msg });
    setTimeout(() => {
      setPopup((p) => ({ ...p, visible: false }));
    }, 2500);
  };

  const load = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const { from, to } = monthBounds(year, month);
      const [list, sum] = await Promise.all([
        hrListExpenses(token, { from, to }),
        hrExpenseSummary(token, year, month).catch(() => null),
      ]);
      setItems(list || []);
      setSummary(sum);
    } catch (err: any) {
      showPopup(err?.message || "Failed to load", "error");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [year, month]);

  const goPrev = () => {
    if (month === 1) {
      setYear(year - 1);
      setMonth(12);
    } else {
      setMonth(month - 1);
    }
  };

  const goNext = () => {
    if (month === 12) {
      setYear(year + 1);
      setMonth(1);
    } else {
      setMonth(month + 1);
    }
  };

  const reset = () => {
    setEditingId(null);
    setTitle("");
    setAmount("");
    setCategory("");
    setDate(new Date());
    setDescription("");
    setVendor("");
    setPaymentMethod("");
    setReceiptUrl("");
  };

  const openCreate = () => {
    reset();
    setModalVisible(true);
  };

  const openEdit = (e: Expense) => {
    setEditingId(e.id);
    setTitle(e.title);
    setAmount(String(e.amount));
    setCategory(e.category);
    setDate(new Date(`${e.date}T00:00:00`));
    setDescription(e.description || "");
    setVendor(e.vendor || "");
    setPaymentMethod(e.paymentMethod || "");
    setReceiptUrl(e.receiptUrl || "");
    setModalVisible(true);
  };

  const submit = async () => {
    if (saving) return;

    const amt = parseFloat(amount);
    if (!title.trim()) {
      showPopup("Title required", "error");
      return;
    }
    if (!category.trim()) {
      showPopup("Category required", "error");
      return;
    }
    if (Number.isNaN(amt) || amt <= 0) {
      showPopup("Valid amount required", "error");
      return;
    }

    try {
      setSaving(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const payload = {
        title: title.trim(),
        amount: amt,
        category: category.trim(),
        date: dateToYMD(date),
        description: description.trim() || undefined,
        vendor: vendor.trim() || undefined,
        paymentMethod: paymentMethod.trim() || undefined,
        receiptUrl: receiptUrl.trim() || undefined,
      };

      if (editingId) {
        await hrUpdateExpense(token, editingId, payload);
        showPopup("Expense updated");
      } else {
        await hrCreateExpense(token, payload);
        showPopup("Expense added");
      }
      setModalVisible(false);
      reset();
      await load();
    } catch (err: any) {
      showPopup(err?.message || "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  const askDelete = (e: Expense) => {
    if (Platform.OS === "web") {
      if (
        typeof window !== "undefined" &&
        window.confirm(`Delete "${e.title}"?`)
      ) {
        doDelete(e.id);
      }
      return;
    }
    Alert.alert(
      "Delete expense?",
      e.title,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => doDelete(e.id),
        },
      ]
    );
  };

  const doDelete = async (id: string) => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await hrDeleteExpense(token, id);
      showPopup("Deleted");
      await load();
    } catch (err: any) {
      showPopup(err?.message || "Failed to delete", "error");
    }
  };

  if (loading) {
    return (
      <View style={s.loader}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <SafeAreaView style={s.safe}>

      {popup.visible && (
        <View
          style={[
            s.popup,
            popup.type === "success" ? s.popupOk : s.popupErr,
          ]}
        >
          <Text style={s.popupText}>{popup.message}</Text>
        </View>
      )}

      <ScrollView
        style={s.container}
        contentContainerStyle={s.content}
      >

        <View style={s.header}>
          <TouchableOpacity
            style={s.backBtn}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Office Expenses</Text>
          </View>
          <TouchableOpacity style={s.addBtn} onPress={openCreate}>
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* MONTH NAV */}
        <View style={s.monthNav}>
          <TouchableOpacity onPress={goPrev}>
            <Ionicons
              name="chevron-back"
              size={20}
              color="#94a3b8"
            />
          </TouchableOpacity>
          <Text style={s.monthLabel}>
            {monthLabel(year, month)}
          </Text>
          <TouchableOpacity onPress={goNext}>
            <Ionicons
              name="chevron-forward"
              size={20}
              color="#94a3b8"
            />
          </TouchableOpacity>
        </View>

        {/* SUMMARY */}
        {summary && (
          <View style={s.summaryCard}>
            <Text style={s.summaryLabel}>TOTAL THIS MONTH</Text>
            <Text style={s.summaryAmount}>
              ₹ {summary.totalAmount.toLocaleString("en-IN")}
            </Text>
            {summary.byCategory.length > 0 && (
              <View style={s.byCatRow}>
                {summary.byCategory.map((c) => (
                  <View key={c.category} style={s.catChip}>
                    <Text style={s.catLabel}>{c.category}</Text>
                    <Text style={s.catTotal}>
                      ₹{c.total.toLocaleString("en-IN")}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* SEARCH */}
        <View style={s.searchBox}>
          <Ionicons name="search" size={16} color="#64748b" />
          <TextInput
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search by title, category, vendor"
            placeholderTextColor="#64748b"
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons
                name="close-circle"
                size={16}
                color="#64748b"
              />
            </TouchableOpacity>
          )}
        </View>

        {/* LIST */}
        {items.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyTitle}>No expenses</Text>
            <Text style={s.emptySub}>
              Tap + to record one for this month.
            </Text>
          </View>
        ) : (
          items
            .filter((e) => {
              const q = search.trim().toLowerCase();
              if (!q) return true;
              return (
                e.title.toLowerCase().includes(q) ||
                e.category.toLowerCase().includes(q) ||
                (e.vendor || "").toLowerCase().includes(q)
              );
            })
            .map((e) => (
            <TouchableOpacity
              key={e.id}
              style={s.card}
              onPress={() => openEdit(e)}
              onLongPress={() => askDelete(e)}
              activeOpacity={0.85}
            >
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>{e.title}</Text>
                <Text style={s.cardMeta}>
                  {e.category}  ·  {e.date}
                  {e.vendor ? `  ·  ${e.vendor}` : ""}
                </Text>
                {e.description ? (
                  <Text style={s.cardDesc} numberOfLines={2}>
                    {e.description}
                  </Text>
                ) : null}
              </View>
              <Text style={s.cardAmount}>
                ₹ {e.amount.toLocaleString("en-IN")}
              </Text>
            </TouchableOpacity>
          ))
        )}

      </ScrollView>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={s.modalTitle}>
                {editingId ? "Edit Expense" : "New Expense"}
              </Text>

              <Text style={s.label}>Title</Text>
              <TextInput
                style={s.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Office rent · May"
                placeholderTextColor="#64748b"
              />

              <View style={s.twoCol}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Amount (₹)</Text>
                  <TextInput
                    style={s.input}
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="15000"
                    placeholderTextColor="#64748b"
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Category</Text>
                  <TextInput
                    style={s.input}
                    value={category}
                    onChangeText={setCategory}
                    placeholder="RENT / TRAVEL / …"
                    placeholderTextColor="#64748b"
                  />
                </View>
              </View>

              <Text style={s.label}>Date</Text>
              {isWeb ? (
                <View style={s.row}>
                  <Ionicons
                    name="calendar-outline"
                    size={18}
                    color="#94a3b8"
                  />
                  <WebDateField
                    mode="date"
                    value={dateToYMD(date)}
                    onChange={(v) => {
                      const d = ymdToDate(v);
                      if (d) setDate(d);
                    }}
                  />
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    style={s.row}
                    onPress={() => setShowDate(true)}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={18}
                      color="#94a3b8"
                    />
                    <Text style={s.rowText}>
                      {date.toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </Text>
                  </TouchableOpacity>
                  {showDate && (
                    <DateTimePicker
                      value={date}
                      mode="date"
                      onChange={(_, d) => {
                        setShowDate(Platform.OS === "ios");
                        if (d) setDate(d);
                      }}
                    />
                  )}
                </>
              )}

              <Text style={s.label}>Vendor</Text>
              <TextInput
                style={s.input}
                value={vendor}
                onChangeText={setVendor}
                placeholder="Optional"
                placeholderTextColor="#64748b"
              />

              <Text style={s.label}>Payment Method</Text>
              <TextInput
                style={s.input}
                value={paymentMethod}
                onChangeText={setPaymentMethod}
                placeholder="Bank / UPI / Card / Cash"
                placeholderTextColor="#64748b"
              />

              <Text style={s.label}>Receipt URL</Text>
              <TextInput
                style={s.input}
                value={receiptUrl}
                onChangeText={setReceiptUrl}
                placeholder="https://…"
                placeholderTextColor="#64748b"
                autoCapitalize="none"
              />

              <Text style={s.label}>Description</Text>
              <TextInput
                style={[s.input, s.multi]}
                value={description}
                onChangeText={setDescription}
                placeholder="Optional"
                placeholderTextColor="#64748b"
                multiline
              />

              <View style={s.modalActions}>
                <TouchableOpacity
                  style={s.cancelBtn}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={s.modalBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.saveBtn, saving && { opacity: 0.7 }]}
                  onPress={submit}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={s.modalBtnText}>
                      {editingId ? "Update" : "Save"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b1220" },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  loader: { flex: 1, backgroundColor: "#0b1220", justifyContent: "center", alignItems: "center" },
  popup: { position: "absolute", top: 60, left: 20, right: 20, padding: 14, borderRadius: 14, zIndex: 999 },
  popupOk: { backgroundColor: "#16a34a" },
  popupErr: { backgroundColor: "#dc2626" },
  popupText: { color: "#fff", fontWeight: "700", textAlign: "center" },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 12, marginTop: 10, gap: 12 },
  backBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: "#111827", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#1f2937" },
  addBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: "#2563eb", justifyContent: "center", alignItems: "center" },
  title: { color: "#fff", fontSize: 24, fontWeight: "800" },

  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#111827",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1f2937",
    marginBottom: 14,
  },
  monthLabel: { color: "#fff", fontSize: 15, fontWeight: "800" },

  summaryCard: {
    backgroundColor: "#111827",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#1f2937",
    marginBottom: 14,
  },
  summaryLabel: { color: "#64748b", fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  summaryAmount: { color: "#fff", fontSize: 30, fontWeight: "800", marginTop: 4 },
  byCatRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
  catChip: { backgroundColor: "#0f172a", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: "#1e293b" },
  catLabel: { color: "#94a3b8", fontSize: 10, fontWeight: "700", letterSpacing: 0.4 },
  catTotal: { color: "#fff", fontSize: 12, fontWeight: "700", marginTop: 2 },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1f2937",
    gap: 8,
  },
  searchInput: { flex: 1, color: "#fff", paddingVertical: 10, fontSize: 14 },

  empty: { padding: 30, backgroundColor: "#111827", borderRadius: 14, borderWidth: 1, borderColor: "#1f2937", alignItems: "center" },
  emptyTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  emptySub: { color: "#94a3b8", fontSize: 12, marginTop: 4 },

  card: { flexDirection: "row", backgroundColor: "#111827", borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#1f2937", gap: 10, alignItems: "flex-start" },
  cardTitle: { color: "#fff", fontSize: 14, fontWeight: "700" },
  cardMeta: { color: "#94a3b8", fontSize: 11, marginTop: 3 },
  cardDesc: { color: "#cbd5e1", fontSize: 12, marginTop: 4 },
  cardAmount: { color: "#16a34a", fontSize: 14, fontWeight: "800" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", padding: 20 },
  modalCard: { backgroundColor: "#111827", borderRadius: 18, padding: 20, maxHeight: "92%" },
  modalTitle: { color: "#fff", fontSize: 22, fontWeight: "800", marginBottom: 8 },

  label: { color: "#94a3b8", fontSize: 13, fontWeight: "600", marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: "#0f172a", color: "#fff", borderRadius: 12, padding: 13, borderWidth: 1, borderColor: "#1e293b", fontSize: 14 },
  multi: { minHeight: 70, textAlignVertical: "top" },
  twoCol: { flexDirection: "row", gap: 10 },

  row: { flexDirection: "row", alignItems: "center", backgroundColor: "#0f172a", borderRadius: 12, padding: 13, borderWidth: 1, borderColor: "#1e293b", gap: 10 },
  rowText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  modalActions: { flexDirection: "row", gap: 10, marginTop: 22 },
  cancelBtn: { flex: 1, backgroundColor: "#374151", padding: 14, borderRadius: 12, alignItems: "center" },
  saveBtn: { flex: 1, backgroundColor: "#16a34a", padding: 14, borderRadius: 12, alignItems: "center" },
  modalBtnText: { color: "#fff", fontWeight: "700" },
});
