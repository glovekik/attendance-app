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

import {
  listManagerLeaves,
  decideManagerLeave } from "../src/services/manager";
import { LeaveRequest } from "../src/types";

import { useTheme } from "../src/theme/ThemeProvider";
export default function ManagerLeaves() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);
  const [items, setItems] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<LeaveRequest | null>(null);
  const [note, setNote] = useState("");
  const [acting, setActing] = useState<"APPROVE" | "REJECT" | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const data = await listManagerLeaves(token, "PENDING");
      setItems(data || []);
    } catch (err: any) {
      Alert.alert(
        "Couldn't load leaves",
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

  const openDetail = (req: LeaveRequest) => {
    setSelected(req);
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
      await decideManagerLeave(token, selected.id, {
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
        <Text style={styles.title}>Leave Requests</Text>
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
            <Text style={styles.emptyText}>No pending leaves</Text>
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
              <View style={styles.pill}>
                <Text style={styles.pillText}>
                  {item.leaveTypeCode}
                </Text>
              </View>
            </View>
            <Text style={styles.dates}>
              {item.fromDate} → {item.toDate}
              {item.halfDay
                ? `  · half-day (${item.halfDayPart})`
                : `  · ${item.totalDays} day(s)`}
            </Text>
            {!!item.reason && (
              <Text style={styles.reason} numberOfLines={2}>
                {item.reason}
              </Text>
            )}
            <View style={styles.cardFooter}>
              <Text style={styles.meta}>
                Requested{" "}
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

      <Modal
        visible={!!selected}
        animationType="slide"
        transparent
        onRequestClose={close}
      >
        <KeyboardAvoidingView
          behavior="padding"
          style={styles.modalWrap}
        >
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Decide leave</Text>
              <TouchableOpacity onPress={close}>
                <Ionicons name="close" size={24} color={c.textMuted} />
              </TouchableOpacity>
            </View>

            {selected && (
              <>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Employee</Text>
                  <Text style={styles.detailValue}>
                    {selected.user?.name}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Type</Text>
                  <Text style={styles.detailValue}>
                    {selected.leaveTypeCode}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>From</Text>
                  <Text style={styles.detailValue}>
                    {selected.fromDate}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>To</Text>
                  <Text style={styles.detailValue}>
                    {selected.toDate}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Total days</Text>
                  <Text style={styles.detailValue}>
                    {selected.halfDay
                      ? `0.5 (${selected.halfDayPart})`
                      : selected.totalDays}
                  </Text>
                </View>
                {!!selected.reason && (
                  <>
                    <Text style={styles.detailLabel}>Reason</Text>
                    <Text style={styles.detailBody}>
                      {selected.reason}
                    </Text>
                  </>
                )}

                <Text style={styles.detailLabel}>
                  Note (required to reject)
                </Text>
                <TextInput
                  style={styles.input}
                  value={note}
                  onChangeText={setNote}
                  placeholder="Optional note for approve, required for reject"
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
              </>
            )}
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
  who: { color: c.text, fontSize: 15, fontWeight: "700" },
  pill: {
    backgroundColor: "#0d9488",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6 },
  pillText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  dates: { color: c.text, fontSize: 13, marginTop: 6 },
  reason: { color: c.textMuted, fontSize: 12, marginTop: 6 },
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
    borderTopColor: c.surfaceBorder },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14 },
  modalTitle: { color: c.text, fontSize: 18, fontWeight: "800" },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6 },
  detailLabel: {
    color: c.textMuted,
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 6 },
  detailValue: { color: c.text, fontSize: 14, fontWeight: "600" },
  detailBody: { color: c.text, fontSize: 13 },
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

