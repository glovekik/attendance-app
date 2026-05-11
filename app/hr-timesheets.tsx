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
  ScrollView,
  TextInput,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { listHrTimesheets } from "../src/services/timesheets";
import {
  Timesheet,
  TimesheetEntry,
  TimesheetStatus,
} from "../src/types";

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "#64748b",
  PENDING: "#f59e0b",
  APPROVED: "#16a34a",
  REJECTED: "#dc2626",
};

type FilterTab = "ALL" | TimesheetStatus;

const TABS: { key: FilterTab; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
];

export default function HrTimesheets() {
  const router = useRouter();
  const [tab, setTab] = useState<FilterTab>("ALL");
  const [weekFilter, setWeekFilter] = useState("");
  const [items, setItems] = useState<Timesheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Timesheet | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const data = await listHrTimesheets(token, {
        status: tab === "ALL" ? undefined : tab,
        weekStart: weekFilter.trim() || undefined,
        limit: 100,
      });
      setItems(data || []);
    } catch (err: any) {
      console.log("hr-timesheets load error", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router, tab, weekFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Timesheets (HR)</Text>
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

      <View style={styles.filterBar}>
        <Ionicons name="calendar-outline" size={16} color="#64748b" />
        <TextInput
          style={styles.filterInput}
          value={weekFilter}
          onChangeText={setWeekFilter}
          placeholder="Filter by week (YYYY-MM-DD, Monday)"
          placeholderTextColor="#475569"
          autoCapitalize="none"
        />
        {!!weekFilter && (
          <TouchableOpacity onPress={() => setWeekFilter("")}>
            <Ionicons name="close-circle" size={18} color="#64748b" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(t) =>
            t.id || `${t.weekStart}-${t.userId}`
          }
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
              <Text style={styles.emptyText}>No timesheets</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => setSelected(item)}
              activeOpacity={0.8}
            >
              <View style={styles.cardTop}>
                <Text style={styles.who}>
                  {(item as any).user?.name || item.userId}
                </Text>
                <View
                  style={[
                    styles.statusPill,
                    {
                      backgroundColor:
                        STATUS_COLOR[item.status] || "#64748b",
                    },
                  ]}
                >
                  <Text style={styles.statusText}>{item.status}</Text>
                </View>
              </View>
              <Text style={styles.row}>
                Week of {item.weekStart} ·{" "}
                {item.totalHours.toFixed(1)} h
              </Text>
              {!!item.decisionNote && (
                <Text style={styles.note} numberOfLines={2}>
                  {item.decisionNote}
                </Text>
              )}
            </TouchableOpacity>
          )}
        />
      )}

      <Modal
        visible={!!selected}
        animationType="slide"
        transparent
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.modalWrap}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Timesheet detail</Text>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Ionicons name="close" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {selected && (
              <ScrollView style={{ maxHeight: 460 }}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Employee</Text>
                  <Text style={styles.detailValue}>
                    {(selected as any).user?.name || selected.userId}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Week of</Text>
                  <Text style={styles.detailValue}>
                    {selected.weekStart}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status</Text>
                  <View
                    style={[
                      styles.statusPill,
                      {
                        backgroundColor:
                          STATUS_COLOR[selected.status] || "#64748b",
                      },
                    ]}
                  >
                    <Text style={styles.statusText}>
                      {selected.status}
                    </Text>
                  </View>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Total hours</Text>
                  <Text style={styles.detailValue}>
                    {selected.totalHours.toFixed(2)} h
                  </Text>
                </View>
                {!!selected.note && (
                  <>
                    <Text style={styles.labelTop}>Employee note</Text>
                    <Text style={styles.body}>{selected.note}</Text>
                  </>
                )}
                {!!selected.decisionNote && (
                  <>
                    <Text style={styles.labelTop}>Manager note</Text>
                    <Text style={styles.body}>
                      {selected.decisionNote}
                    </Text>
                  </>
                )}

                <Text style={styles.labelTop}>Entries</Text>
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
  tabs: {
    flexDirection: "row",
    padding: 12,
    gap: 6,
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
  filterBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    marginHorizontal: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  filterInput: {
    flex: 1,
    color: "#fff",
    paddingVertical: 8,
    fontSize: 12,
  },
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
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  row: { color: "#cbd5e1", fontSize: 12, marginTop: 6 },
  note: { color: "#94a3b8", fontSize: 11, marginTop: 4 },
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
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
  },
  detailLabel: { color: "#94a3b8", fontSize: 12 },
  detailValue: { color: "#fff", fontSize: 14, fontWeight: "600" },
  labelTop: {
    color: "#94a3b8",
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 6,
  },
  body: { color: "#cbd5e1", fontSize: 13 },
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
});
