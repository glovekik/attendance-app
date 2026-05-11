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
  listManagerTimesheets,
  decideManagerTimesheet,
} from "../src/services/manager";
import { Timesheet, TimesheetEntry } from "../src/types";

export default function ManagerTimesheets() {
  const router = useRouter();
  const [items, setItems] = useState<Timesheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Timesheet | null>(null);
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
      const data = await listManagerTimesheets(token, "PENDING");
      setItems(data || []);
    } catch (err: any) {
      console.log("manager-timesheets load error", err);
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

  const openDetail = (t: Timesheet) => {
    setSelected(t);
    setNote("");
  };

  const close = () => {
    setSelected(null);
    setNote("");
    setActing(null);
  };

  const onDecide = async (action: "APPROVE" | "REJECT") => {
    if (!selected || !selected.id) return;
    if (action === "REJECT" && !note.trim()) {
      Alert.alert("Please add a note explaining the rejection");
      return;
    }
    setActing(action);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await decideManagerTimesheet(token, selected.id, {
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
        <Text style={styles.title}>Timesheets</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={items}
        keyExtractor={(t) => t.id || t.weekStart + t.userId}
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
            <Ionicons name="checkmark-done" size={42} color="#475569" />
            <Text style={styles.emptyText}>No pending timesheets</Text>
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
                Week of {item.weekStart}
              </Text>
              <View style={styles.pill}>
                <Text style={styles.pillText}>
                  {item.totalHours.toFixed(1)} h
                </Text>
              </View>
            </View>
            <Text style={styles.row}>User: {item.userId}</Text>
            {!!item.note && (
              <Text style={styles.note} numberOfLines={2}>
                {item.note}
              </Text>
            )}
            <View style={styles.cardFooter}>
              <Text style={styles.meta}>
                {item.entries?.length || 0} day(s) logged
              </Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color="#64748b"
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
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalWrap}
        >
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Decide timesheet</Text>
              <TouchableOpacity onPress={close}>
                <Ionicons name="close" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {selected && (
              <ScrollView style={{ maxHeight: 380 }}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabelInline}>Week of</Text>
                  <Text style={styles.detailValue}>
                    {selected.weekStart}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabelInline}>Total</Text>
                  <Text style={styles.detailValue}>
                    {selected.totalHours.toFixed(2)} h
                  </Text>
                </View>
                {!!selected.note && (
                  <>
                    <Text style={styles.detailLabel}>Note</Text>
                    <Text style={styles.detailBody}>{selected.note}</Text>
                  </>
                )}

                <Text style={styles.detailLabel}>Entries</Text>
                {(selected.entries || []).map(
                  (e: TimesheetEntry, i: number) => (
                    <View key={i} style={styles.entryRow}>
                      <Text style={styles.entryDate}>{e.date}</Text>
                      <Text style={styles.entryHours}>
                        {e.hours.toFixed(1)} h
                      </Text>
                      {!!e.projectId && (
                        <Text style={styles.entryProj}>
                          {e.projectId}
                        </Text>
                      )}
                      {e.billable && (
                        <View style={styles.tinyPill}>
                          <Text style={styles.tinyPillText}>BILL</Text>
                        </View>
                      )}
                    </View>
                  )
                )}
              </ScrollView>
            )}

            <Text style={styles.detailLabel}>
              Note (required to reject)
            </Text>
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
  pill: {
    backgroundColor: "#6366f1",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pillText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  row: { color: "#cbd5e1", fontSize: 12, marginTop: 6 },
  note: { color: "#94a3b8", fontSize: 12, marginTop: 4 },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  meta: { color: "#64748b", fontSize: 11 },
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
    marginBottom: 14,
  },
  modalTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  detailLabelInline: { color: "#94a3b8", fontSize: 12 },
  detailValue: { color: "#fff", fontSize: 14, fontWeight: "600" },
  detailLabel: {
    color: "#94a3b8",
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 6,
  },
  detailBody: { color: "#cbd5e1", fontSize: 13 },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 4,
    gap: 10,
  },
  entryDate: { color: "#fff", fontSize: 12, fontWeight: "700", flex: 1 },
  entryHours: { color: "#3b82f6", fontSize: 12, fontWeight: "700" },
  entryProj: { color: "#94a3b8", fontSize: 11 },
  tinyPill: {
    backgroundColor: "#16a34a",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  tinyPillText: { color: "#fff", fontSize: 9, fontWeight: "800" },
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
