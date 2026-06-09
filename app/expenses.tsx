import React, {
  useEffect,
  useState, useMemo} from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Platform,
  Alert } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useRouter } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import DateTimePicker from "@react-native-community/datetimepicker";

import {
  WebDateField,
  dateToYMD,
  ymdToDate } from "../src/components/WebDateField";

import {
  hrCreateExpense,
  hrListExpenses,
  hrExpenseSummary,
  hrUpdateExpense,
  hrDeleteExpense,
  ExpenseSortColumn } from "../src/services/expenses";

import { downloadXlsxWithAuth } from "../src/utils/download";
import { API_URL } from "../src/config";

import { Expense, ExpenseSummary } from "../src/types";

import { useTheme } from "../src/theme/ThemeProvider";
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
    year: "numeric" });

export default function Expenses() {

  const router = useRouter();

  const { theme } = useTheme();

  const c = theme.colors;

  const s = useMemo(() => makeStyles(c), [c]);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const [items, setItems] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [sortBy, setSortBy] = useState<ExpenseSortColumn>("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const toggleSort = (col: ExpenseSortColumn) => {
    if (sortBy === col) {
      // Same column: flip direction.
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      // New column: default to descending for date/amount, ascending for text.
      setSortBy(col);
      setSortOrder(col === "date" || col === "amount" ? "desc" : "asc");
    }
  };

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
    message: "" });

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
        hrListExpenses(token, {
          from,
          to,
          sort: sortBy,
          order: sortOrder }),
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
  }, [year, month, sortBy, sortOrder]);

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
        receiptUrl: receiptUrl.trim() || undefined };

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
          onPress: () => doDelete(e.id) },
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

  const exportExcel = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const { from, to } = monthBounds(year, month);
      const url =
        `${API_URL}/hr/export/expenses.xlsx?from=${from}&to=${to}`;
      const filename =
        `expenses_${year}_${String(month).padStart(2, "0")}.xlsx`;
      await downloadXlsxWithAuth(url, token, filename);
    } catch (err: any) {
      showPopup(err?.message || "Failed to export", "error");
    }
  };

  if (loading) {
    return (
      <View style={s.loader}>
        <ActivityIndicator size="large" color={c.accent} />
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
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          >
            <Ionicons name="chevron-back" size={22} color={c.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Office Expenses</Text>
          </View>
          <TouchableOpacity
            style={[s.addBtn, { backgroundColor: "#16a34a" }]}
            onPress={exportExcel}
          >
            <Ionicons
              name="download-outline"
              size={20}
              color="#fff"
            />
          </TouchableOpacity>
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
              color={c.textMuted}
            />
          </TouchableOpacity>
          <Text style={s.monthLabel}>
            {monthLabel(year, month)}
          </Text>
          <TouchableOpacity onPress={goNext}>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={c.textMuted}
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
          <Ionicons name="search" size={16} color={c.textMuted} />
          <TextInput
            style={s.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search by title, category, vendor"
            placeholderTextColor={c.textFaint}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons
                name="close-circle"
                size={16}
                color={c.textMuted}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* TABLE */}
        {items.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyTitle}>No expenses</Text>
            <Text style={s.emptySub}>
              Tap + to record one for this month.
            </Text>
          </View>
        ) : (
          <View style={s.tableCard}>
            <View style={[s.tableRow, s.tableHead]}>
              <HeaderCell
                col="date"
                label="Date"
                style={[s.colDate]}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onPress={toggleSort}
              />
              <HeaderCell
                col="title"
                label="Title"
                style={[s.colTitle]}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onPress={toggleSort}
              />
              <HeaderCell
                col="category"
                label="Category"
                style={[s.colCategory]}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onPress={toggleSort}
              />
              <HeaderCell
                col="vendor"
                label="Vendor"
                style={[s.colVendor]}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onPress={toggleSort}
              />
              <HeaderCell
                col="amount"
                label="Amount"
                style={[s.colAmount, { alignItems: "flex-end" }]}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onPress={toggleSort}
                rightAlign
              />
            </View>
            {items
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
                  style={s.tableRow}
                  onPress={() => openEdit(e)}
                  onLongPress={() => askDelete(e)}
                  activeOpacity={0.85}
                >
                  <Text style={[s.tableCell, s.colDate]} numberOfLines={1}>
                    {e.date}
                  </Text>
                  <Text
                    style={[s.tableCell, s.colTitle, { color: "#fff" }]}
                    numberOfLines={1}
                  >
                    {e.title}
                  </Text>
                  <Text style={[s.tableCell, s.colCategory]} numberOfLines={1}>
                    {e.category}
                  </Text>
                  <Text style={[s.tableCell, s.colVendor]} numberOfLines={1}>
                    {e.vendor || "—"}
                  </Text>
                  <Text
                    style={[
                      s.tableCell,
                      s.colAmount,
                      { color: "#16a34a", fontWeight: "800", textAlign: "right" },
                    ]}
                  >
                    ₹ {e.amount.toLocaleString("en-IN")}
                  </Text>
                </TouchableOpacity>
              ))}
          </View>
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
            <KeyboardAwareScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              bottomOffset={24}
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
                placeholderTextColor={c.textFaint}
              />

              <View style={s.twoCol}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Amount (₹)</Text>
                  <TextInput
                    style={s.input}
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="15000"
                    placeholderTextColor={c.textFaint}
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
                    placeholderTextColor={c.textFaint}
                  />
                </View>
              </View>

              <Text style={s.label}>Date</Text>
              {isWeb ? (
                <View style={s.row}>
                  <Ionicons
                    name="calendar-outline"
                    size={18}
                    color={c.textMuted}
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
                      color={c.textMuted}
                    />
                    <Text style={s.rowText}>
                      {date.toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric" })}
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
                placeholderTextColor={c.textFaint}
              />

              <Text style={s.label}>Payment Method</Text>
              <TextInput
                style={s.input}
                value={paymentMethod}
                onChangeText={setPaymentMethod}
                placeholder="Bank / UPI / Card / Cash"
                placeholderTextColor={c.textFaint}
              />

              <Text style={s.label}>Receipt URL</Text>
              <TextInput
                style={s.input}
                value={receiptUrl}
                onChangeText={setReceiptUrl}
                placeholder="https://…"
                placeholderTextColor={c.textFaint}
                autoCapitalize="none"
              />

              <Text style={s.label}>Description</Text>
              <TextInput
                style={[s.input, s.multi]}
                value={description}
                onChangeText={setDescription}
                placeholder="Optional"
                placeholderTextColor={c.textFaint}
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
            </KeyboardAwareScrollView>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

interface HeaderCellProps {
  col: ExpenseSortColumn;
  label: string;
  sortBy: ExpenseSortColumn;
  sortOrder: "asc" | "desc";
  onPress: (col: ExpenseSortColumn) => void;
  style?: any;
  rightAlign?: boolean;
}

const HeaderCell = ({
  col,
  label,
  sortBy,
  sortOrder,
  onPress,
  style,
  rightAlign }: HeaderCellProps) => {
  const active = sortBy === col;
  return (
    <TouchableOpacity
      style={[
        { flexDirection: "row", alignItems: "center", gap: 3 },
        rightAlign && { justifyContent: "flex-end" },
        style,
      ]}
      onPress={() => onPress(col)}
      activeOpacity={0.6}
    >
      <Text
        style={{
          color: active ? "#fff" : "#94a3b8",
          fontSize: 10,
          fontWeight: "800",
          letterSpacing: 0.5,
          textTransform: "uppercase" }}
      >
        {label}
      </Text>
      {active && (
        <Ionicons
          name={sortOrder === "asc" ? "arrow-up" : "arrow-down"}
          size={11}
          color="#fff"
        />
      )}
    </TouchableOpacity>
  );
};

const makeStyles = (c: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  loader: { flex: 1, backgroundColor: c.bg, justifyContent: "center", alignItems: "center" },
  popup: { position: "absolute", top: 60, left: 20, right: 20, padding: 14, borderRadius: 14, zIndex: 999 },
  popupOk: { backgroundColor: "#16a34a" },
  popupErr: { backgroundColor: "#dc2626" },
  popupText: { color: c.text, fontWeight: "700", textAlign: "center" },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 12, marginTop: 10, gap: 12 },
  backBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: c.surface, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: c.surfaceBorder },
  addBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: c.accent, justifyContent: "center", alignItems: "center" },
  title: { color: c.text, fontSize: 24, fontWeight: "800" },

  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: c.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    marginBottom: 14 },
  monthLabel: { color: c.text, fontSize: 15, fontWeight: "800" },

  summaryCard: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    marginBottom: 14 },
  summaryLabel: { color: c.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  summaryAmount: { color: c.text, fontSize: 30, fontWeight: "800", marginTop: 4 },
  byCatRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
  catChip: { backgroundColor: c.surfaceMuted, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: c.surfaceBorder },
  catLabel: { color: c.textMuted, fontSize: 10, fontWeight: "700", letterSpacing: 0.4 },
  catTotal: { color: c.text, fontSize: 12, fontWeight: "700", marginTop: 2 },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    gap: 8 },
  searchInput: { flex: 1, color: c.text, paddingVertical: 10, fontSize: 14 },

  empty: { padding: 30, backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.surfaceBorder, alignItems: "center" },
  emptyTitle: { color: c.text, fontSize: 15, fontWeight: "700" },
  emptySub: { color: c.textMuted, fontSize: 12, marginTop: 4 },

  card: { flexDirection: "row", backgroundColor: c.surface, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: c.surfaceBorder, gap: 10, alignItems: "flex-start" },
  cardTitle: { color: c.text, fontSize: 14, fontWeight: "700" },
  cardMeta: { color: c.textMuted, fontSize: 11, marginTop: 3 },
  cardDesc: { color: c.text, fontSize: 12, marginTop: 4 },
  cardAmount: { color: "#16a34a", fontSize: 14, fontWeight: "800" },

  tableCard: {
    backgroundColor: c.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    overflow: "hidden" },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: c.surfaceBorder,
    alignItems: "center",
    gap: 6 },
  tableHead: { backgroundColor: c.surfaceMuted },
  tableCell: { color: c.text, fontSize: 12 },
  tableHeadText: {
    color: c.textMuted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase" },
  colDate: { flex: 1.1 },
  colTitle: { flex: 1.7 },
  colCategory: { flex: 1.1 },
  colVendor: { flex: 1.1 },
  colAmount: { flex: 1.2 },

  modalOverlay: { flex: 1, backgroundColor: c.overlay, justifyContent: "center", padding: 20 },
  modalCard: { backgroundColor: c.surface, borderRadius: 18, padding: 20, maxHeight: "92%" },
  modalTitle: { color: c.text, fontSize: 22, fontWeight: "800", marginBottom: 8 },

  label: { color: c.textMuted, fontSize: 13, fontWeight: "600", marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: c.surfaceMuted, color: c.text, borderRadius: 12, padding: 13, borderWidth: 1, borderColor: c.surfaceBorder, fontSize: 14 },
  multi: { minHeight: 70, textAlignVertical: "top" },
  twoCol: { flexDirection: "row", gap: 10 },

  row: { flexDirection: "row", alignItems: "center", backgroundColor: c.surfaceMuted, borderRadius: 12, padding: 13, borderWidth: 1, borderColor: c.surfaceBorder, gap: 10 },
  rowText: { color: c.text, fontWeight: "700", fontSize: 14 },

  modalActions: { flexDirection: "row", gap: 10, marginTop: 22 },
  cancelBtn: { flex: 1, backgroundColor: c.surfaceMuted, padding: 14, borderRadius: 12, alignItems: "center" },
  saveBtn: { flex: 1, backgroundColor: "#16a34a", padding: 14, borderRadius: 12, alignItems: "center" },
  modalBtnText: { color: c.text, fontWeight: "700" } });

