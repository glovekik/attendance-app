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
  TextInput,
  Modal,
  ScrollView,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { listAuditLogs, AuditFilters } from "../src/services/audit";
import { listUsers } from "../src/services/users";
import { AuditLog, User } from "../src/types";

// Quick action filter chips — covers the most common audit prefixes.
const ACTION_FILTERS: { key: string; label: string }[] = [
  { key: "", label: "All" },
  { key: "user.", label: "Users" },
  { key: "role.", label: "Roles" },
  { key: "department.", label: "Departments" },
  { key: "project.", label: "Projects" },
  { key: "leave.", label: "Leave" },
  { key: "correction.", label: "Corrections" },
  { key: "reimbursement.", label: "Reimbursements" },
  { key: "timesheet.", label: "Timesheets" },
  { key: "offer.", label: "Offers" },
  { key: "candidate.", label: "Candidates" },
  { key: "review.", label: "Reviews" },
  { key: "goal.", label: "Goals" },
  { key: "document.", label: "Documents" },
];

const actionColor = (action: string): string => {
  if (action.includes("approve")) return "#16a34a";
  if (action.includes("reject")) return "#dc2626";
  if (action.includes("delete") || action.includes("revoke"))
    return "#dc2626";
  if (action.includes("create") || action.includes("add"))
    return "#3b82f6";
  if (action.includes("update") || action.includes("change"))
    return "#f59e0b";
  return "#64748b";
};

const formatTime = (iso: string): string => {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
};

const relativeTime = (iso: string): string => {
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const h = Math.floor(mins / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  } catch {
    return iso;
  }
};

export default function HrAuditLogs() {
  const router = useRouter();
  const [items, setItems] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [actionFilter, setActionFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Detail modal
  const [selected, setSelected] = useState<AuditLog | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const filters: AuditFilters = {
        action: actionFilter || undefined,
        fromDate: fromDate.trim() || undefined,
        toDate: toDate.trim() || undefined,
        limit: 200,
      };
      const [logs, allUsers] = await Promise.all([
        listAuditLogs(token, filters),
        users.length > 0
          ? Promise.resolve(users)
          : listUsers(token).catch(() => [] as User[]),
      ]);
      setItems(logs || []);
      if (users.length === 0) setUsers(allUsers || []);
    } catch (err: any) {
      console.log("audit load error", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router, actionFilter, fromDate, toDate, users]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const actorName = (id?: string | null) => {
    if (!id) return "System";
    return users.find((u) => u.id === id)?.name || `User ${id.slice(-6)}`;
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Audit Logs</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.filtersWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, gap: 6 }}
        >
          {ACTION_FILTERS.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[
                styles.chip,
                actionFilter === f.key && styles.chipActive,
              ]}
              onPress={() => {
                setActionFilter(f.key);
                setLoading(true);
              }}
            >
              <Text
                style={[
                  styles.chipText,
                  actionFilter === f.key && styles.chipTextActive,
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.dateRow}>
          <View style={styles.dateField}>
            <Ionicons name="calendar-outline" size={14} color="#64748b" />
            <TextInput
              style={styles.dateInput}
              value={fromDate}
              onChangeText={setFromDate}
              placeholder="From YYYY-MM-DD"
              placeholderTextColor="#475569"
              autoCapitalize="none"
              onSubmitEditing={() => setLoading(true)}
            />
          </View>
          <View style={styles.dateField}>
            <Ionicons name="calendar-outline" size={14} color="#64748b" />
            <TextInput
              style={styles.dateInput}
              value={toDate}
              onChangeText={setToDate}
              placeholder="To YYYY-MM-DD"
              placeholderTextColor="#475569"
              autoCapitalize="none"
              onSubmitEditing={() => setLoading(true)}
            />
          </View>
          {(fromDate || toDate) && (
            <TouchableOpacity
              onPress={() => {
                setFromDate("");
                setToDate("");
                setLoading(true);
              }}
            >
              <Ionicons name="close-circle" size={20} color="#64748b" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(l) => l.id}
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
                name="document-text-outline"
                size={42}
                color="#475569"
              />
              <Text style={styles.emptyText}>
                No audit entries match
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => setSelected(item)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.dot,
                  { backgroundColor: actionColor(item.action) },
                ]}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.action}>{item.action}</Text>
                <Text style={styles.meta} numberOfLines={1}>
                  by {actorName(item.actorId)} · {item.entityType}
                </Text>
                <Text style={styles.time}>{relativeTime(item.at)}</Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color="#64748b"
              />
            </TouchableOpacity>
          )}
        />
      )}

      {/* DETAIL MODAL */}
      <Modal
        visible={!!selected}
        animationType="slide"
        transparent
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.modalWrap}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Audit detail</Text>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Ionicons name="close" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {selected && (
              <ScrollView style={{ maxHeight: 520 }}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Action</Text>
                  <View
                    style={[
                      styles.actionPill,
                      {
                        backgroundColor: actionColor(selected.action),
                      },
                    ]}
                  >
                    <Text style={styles.actionPillText}>
                      {selected.action}
                    </Text>
                  </View>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Actor</Text>
                  <Text style={styles.detailValue}>
                    {actorName(selected.actorId)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Entity</Text>
                  <Text style={styles.detailValue}>
                    {selected.entityType}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Entity ID</Text>
                  <Text style={styles.detailMono} numberOfLines={1}>
                    {selected.entityId}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>When</Text>
                  <Text style={styles.detailValue}>
                    {formatTime(selected.at)}
                  </Text>
                </View>

                {!!selected.before && (
                  <>
                    <Text style={styles.sectionLabel}>BEFORE</Text>
                    <Text style={styles.json}>
                      {JSON.stringify(selected.before, null, 2)}
                    </Text>
                  </>
                )}
                {!!selected.after && (
                  <>
                    <Text style={styles.sectionLabel}>AFTER</Text>
                    <Text style={styles.json}>
                      {JSON.stringify(selected.after, null, 2)}
                    </Text>
                  </>
                )}
                {!!selected.metadata && (
                  <>
                    <Text style={styles.sectionLabel}>METADATA</Text>
                    <Text style={styles.json}>
                      {JSON.stringify(selected.metadata, null, 2)}
                    </Text>
                  </>
                )}
                <View style={{ height: 20 }} />
              </ScrollView>
            )}
          </View>
        </View>
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
  filtersWrap: { paddingVertical: 8, gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  chipActive: { backgroundColor: "#3b82f6", borderColor: "#3b82f6" },
  chipText: { color: "#94a3b8", fontSize: 11, fontWeight: "700" },
  chipTextActive: { color: "#fff" },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  dateField: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1f2937",
    gap: 6,
  },
  dateInput: {
    flex: 1,
    color: "#fff",
    paddingVertical: 7,
    fontSize: 11,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    padding: 12,
    borderRadius: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#1f2937",
    gap: 10,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  action: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    fontFamily: "monospace",
  },
  meta: { color: "#94a3b8", fontSize: 11, marginTop: 2 },
  time: { color: "#64748b", fontSize: 10, marginTop: 2 },
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
    marginBottom: 10,
  },
  modalTitle: { color: "#fff", fontSize: 17, fontWeight: "800" },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  detailLabel: { color: "#94a3b8", fontSize: 12 },
  detailValue: { color: "#fff", fontSize: 13, fontWeight: "600" },
  detailMono: {
    color: "#cbd5e1",
    fontSize: 11,
    fontFamily: "monospace",
  },
  actionPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  actionPillText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
    fontFamily: "monospace",
  },
  sectionLabel: {
    color: "#64748b",
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: "800",
    marginTop: 14,
    marginBottom: 6,
  },
  json: {
    color: "#cbd5e1",
    fontSize: 11,
    fontFamily: "monospace",
    backgroundColor: "#0b1220",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
});
