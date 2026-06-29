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

import {
  listManagerReimbursements,
  decideManagerReimbursement } from "../src/services/manager";
import { Reimbursement } from "../src/types";
import { WebModal, ModalActions } from "../src/components/WebModal";

import { useTheme } from "../src/theme/ThemeProvider";
const fmtMoney = (n: number): string => {
  if (typeof n !== "number") return "—";
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2 });
};

export default function ManagerReimbursements() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);
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
      const data = await listManagerReimbursements(
        token,
        "PENDING_MANAGER"
      );
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
      await decideManagerReimbursement(token, selected.id, {
        action,
        note: note.trim() || undefined });
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
        <View style={{ width: 24 }} />
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
            <Ionicons name="checkmark-done" size={42} color={c.textFaint} />
            <Text style={styles.emptyText}>
              No pending reimbursements
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => openDetail(item)}
            activeOpacity={0.8}
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
            {!!item.vendorName && (
              <Text style={styles.row} numberOfLines={1}>
                Vendor: {item.vendorName}
              </Text>
            )}
            <View style={styles.cardFooter}>
              <Text style={styles.meta}>
                Submitted{" "}
                {new Date(item.createdAt).toLocaleDateString()}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={c.textMuted}
              />
            </View>
          </TouchableOpacity>
        )}
      />

      <WebModal
        visible={!!selected}
        onClose={close}
        title="Decide reimbursement"
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
              <>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabelInline}>
                    Employee
                  </Text>
                  <Text style={styles.detailValue}>
                    {selected.user?.name}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabelInline}>Title</Text>
                  <Text
                    style={[styles.detailValue, { textAlign: "right" }]}
                  >
                    {selected.title}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabelInline}>Amount</Text>
                  <Text style={styles.detailValue}>
                    ₹ {fmtMoney(selected.amount)}
                    {selected.taxAmount
                      ? ` (incl. tax ₹${fmtMoney(selected.taxAmount)})`
                      : ""}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabelInline}>Category</Text>
                  <Text style={styles.detailValue}>
                    {selected.category}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabelInline}>
                    Expense date
                  </Text>
                  <Text style={styles.detailValue}>
                    {selected.expenseDate}
                  </Text>
                </View>
                {!!selected.paymentMode && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabelInline}>
                      Payment mode
                    </Text>
                    <Text style={styles.detailValue}>
                      {selected.paymentMode}
                    </Text>
                  </View>
                )}
                {!!selected.vendorName && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabelInline}>Vendor</Text>
                    <Text style={styles.detailValue}>
                      {selected.vendorName}
                    </Text>
                  </View>
                )}
                {!!selected.invoiceNumber && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabelInline}>
                      Invoice #
                    </Text>
                    <Text style={styles.detailValue}>
                      {selected.invoiceNumber}
                    </Text>
                  </View>
                )}
                {!!selected.description && (
                  <>
                    <Text style={styles.detailLabel}>Description</Text>
                    <Text style={styles.detailBody}>
                      {selected.description}
                    </Text>
                  </>
                )}
                {!!(selected.attachments && selected.attachments.length) && (
                  <>
                    <Text style={styles.detailLabel}>Attachments</Text>
                    {selected.attachments!.map((a, i) => (
                      <Text key={i} style={styles.link} numberOfLines={1}>
                        {a}
                      </Text>
                    ))}
                  </>
                )}

                <Text style={styles.detailLabel}>
                  Note (required to reject)
                </Text>
                <TextInput
                  style={styles.input}
                  value={note}
                  onChangeText={setNote}
                  placeholder="..."
                  placeholderTextColor={c.textFaint}
                  multiline
                />
              </>
            )}
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
  who: { color: c.text, fontSize: 15, fontWeight: "700" },
  amount: { color: "#3b82f6", fontSize: 15, fontWeight: "800" },
  titleLine: { color: c.text, fontSize: 13, marginTop: 6 },
  row: { color: c.textMuted, fontSize: 12, marginTop: 4 },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10 },
  meta: { color: c.textMuted, fontSize: 11 },
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
    marginBottom: 14 },
  modalTitle: { color: c.text, fontSize: 18, fontWeight: "800" },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    gap: 10 },
  detailLabelInline: { color: c.textMuted, fontSize: 12 },
  detailValue: {
    color: c.text,
    fontSize: 14,
    fontWeight: "600",
    flexShrink: 1 },
  detailLabel: {
    color: c.textMuted,
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 6 },
  detailBody: { color: c.text, fontSize: 13 },
  link: { color: "#3b82f6", fontSize: 12, marginTop: 2 },
  input: {
    backgroundColor: c.surface,
    color: c.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    minHeight: 70,
    textAlignVertical: "top" },
  actions: { flexDirection: "row", gap: 10, marginTop: 18 },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center" },
  btnReject: { backgroundColor: "#dc2626" },
  btnApprove: { backgroundColor: "#16a34a" },
  btnText: { color: c.text, fontWeight: "800" } });

