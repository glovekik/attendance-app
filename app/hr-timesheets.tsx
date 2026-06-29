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
  Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { WebModal } from "../src/components/WebModal";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { listHrTimesheets } from "../src/services/timesheets";
import { useTheme } from "../src/theme/ThemeProvider";
import { timesheetStatusColor } from "../src/theme/statusColors";
import {
  Timesheet,
  TimesheetEntry,
  TimesheetStatus } from "../src/types";

type FilterTab = "ALL" | TimesheetStatus;

const TABS: { key: FilterTab; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
];

export default function HrTimesheets() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);
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
        limit: 100 });
      setItems(data || []);
    } catch (err: any) {
      Alert.alert(
        "Couldn't load timesheets",
        err?.message || "Pull down to retry."
      );
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
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}>
          <Ionicons name="arrow-back" size={24} color={c.text} />
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
        <Ionicons name="calendar-outline" size={16} color={c.textMuted} />
        <TextInput
          style={styles.filterInput}
          value={weekFilter}
          onChangeText={setWeekFilter}
          placeholder="Filter by week (YYYY-MM-DD, Monday)"
          placeholderTextColor={c.textFaint}
          autoCapitalize="none"
        />
        {!!weekFilter && (
          <TouchableOpacity onPress={() => setWeekFilter("")}>
            <Ionicons name="close-circle" size={18} color={c.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={c.accent} />
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
              tintColor={c.accent}
              colors={[c.accent]}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons
                name="document-text-outline"
                size={42}
                color={c.textFaint}
              />
              <Text style={styles.emptyText}>No timesheets</Text>
            </View>
          }
          renderItem={({ item }) => {
            const sc = timesheetStatusColor(item.status, c);
            return (
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
                      { backgroundColor: sc.bg },
                    ]}
                  >
                    <Text style={[styles.statusText, { color: sc.fg }]}>{item.status}</Text>
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
            );
          }}
        />
      )}

      <WebModal
        visible={!!selected}
        onClose={() => setSelected(null)}
        title="Timesheet detail"
        size="lg"
      >
            {selected && (
              <>
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
                  {(() => {
                    const sc = timesheetStatusColor(selected.status, c);
                    return (
                      <View
                        style={[
                          styles.statusPill,
                          { backgroundColor: sc.bg },
                        ]}
                      >
                        <Text style={[styles.statusText, { color: sc.fg }]}>
                          {selected.status}
                        </Text>
                      </View>
                    );
                  })()}
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
  tabs: {
    flexDirection: "row",
    padding: 12,
    gap: 6 },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: c.surface,
    alignItems: "center" },
  tabActive: { backgroundColor: c.accent },
  tabText: { color: c.textMuted, fontSize: 11, fontWeight: "700" },
  tabTextActive: { color: c.text },
  filterBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surface,
    marginHorizontal: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  filterInput: {
    flex: 1,
    color: c.text,
    paddingVertical: 8,
    fontSize: 12 },
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
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6 },
  statusText: { color: c.text, fontSize: 10, fontWeight: "800" },
  row: { color: c.text, fontSize: 12, marginTop: 6 },
  note: { color: c.textMuted, fontSize: 11, marginTop: 4 },
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
    marginBottom: 8 },
  modalTitle: { color: c.text, fontSize: 18, fontWeight: "800" },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6 },
  detailLabel: { color: c.textMuted, fontSize: 12 },
  detailValue: { color: c.text, fontSize: 14, fontWeight: "600" },
  labelTop: {
    color: c.textMuted,
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 6 },
  body: { color: c.text, fontSize: 13 },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 4,
    gap: 10 },
  entryDate: { color: c.text, fontSize: 12, fontWeight: "700", flex: 1 },
  entryHours: { color: "#3b82f6", fontSize: 12, fontWeight: "700" },
  entryProj: { color: c.textMuted, fontSize: 11 },
  tinyPill: {
    backgroundColor: "#16a34a",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4 },
  tinyPillText: { color: "#fff", fontSize: 9, fontWeight: "800" } });

