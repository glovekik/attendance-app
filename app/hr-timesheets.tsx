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
import { TimesheetSummaryBox } from "../src/components/TimesheetSummaryBox";
import { useTheme } from "../src/theme/ThemeProvider";
import { StatusTabs } from "../src/components/StatusTabs";
import { timesheetStatusColor } from "../src/theme/statusColors";
import {
  Timesheet,
  TimesheetEntry,
  TimesheetStatus } from "../src/types";

type FilterTab = "ALL" | TimesheetStatus;

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "2026-07" -> "July 2026". */
const monthLabel = (key: string): string => {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return key;
  return `${MONTH_NAMES[m - 1]} ${y}`;
};

/** "09:30" from an ISO timestamp; "—" when nothing was recorded. */
const fmtTime = (v?: string | null): string => {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
};

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

  // Two ways to read the same queue. "list" is the review inbox — what came
  // in, newest first. "employee" answers the other question HR asks: what has
  // one person filed, and when. Both drive the same detail modal, so there is
  // one place a timesheet is ever displayed.
  const [view, setView] = useState<"list" | "employee">("list");
  const [drillUser, setDrillUser] = useState<string | null>(null);
  const [drillMonth, setDrillMonth] = useState<string | null>(null);

  const nameOf = (t: Timesheet) =>
    (t as any).user?.name || t.userId || "Unknown";

  /** userId -> { name, sheets } for the employee level. */
  const byEmployee = useMemo(() => {
    const map = new Map<string, { name: string; sheets: Timesheet[] }>();
    for (const t of items) {
      const key = t.userId || "unknown";
      const entry = map.get(key);
      if (entry) entry.sheets.push(t);
      else map.set(key, { name: nameOf(t), sheets: [t] });
    }
    return [...map.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.sheets.length - a.sheets.length);
  }, [items]);

  /** "YYYY-MM" -> that month's sheets, for the drilled-into employee. */
  const monthsForUser = useMemo(() => {
    if (!drillUser) return [];
    const mine = items.filter((t) => t.userId === drillUser);
    const map = new Map<string, Timesheet[]>();
    for (const t of mine) {
      const k = (t.weekStart || "").slice(0, 7);
      if (!k) continue;
      const list = map.get(k);
      if (list) list.push(t);
      else map.set(k, [t]);
    }
    return [...map.entries()]
      .map(([key, sheets]) => ({
        key,
        sheets: [...sheets].sort((a, b) =>
          b.weekStart.localeCompare(a.weekStart)
        ),
        totalHours: sheets.reduce((s, t) => s + (t.totalHours || 0), 0),
      }))
      .sort((a, b) => b.key.localeCompare(a.key));
  }, [items, drillUser]);

  const drillUserName =
    byEmployee.find((e) => e.id === drillUser)?.name || "Employee";

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
        <TouchableOpacity
          onPress={() => {
            // Walk up the drill-down before leaving the screen.
            if (drillMonth) return setDrillMonth(null);
            if (drillUser) return setDrillUser(null);
            router.canGoBack() ? router.back() : router.replace("/");
          }}
        >
          <Ionicons name="arrow-back" size={24} color={c.text} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {drillMonth
            ? monthLabel(drillMonth)
            : drillUser
            ? drillUserName
            : "Timesheets (HR)"}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* One screen, two readings of the same data. Hidden while drilled in —
          switching grouping mid-drill would be disorienting. */}
      {!drillUser && (
        <View style={styles.viewToggle}>
          {(["list", "employee"] as const).map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[
                styles.viewBtn,
                view === mode && styles.viewBtnActive,
              ]}
              onPress={() => {
                setView(mode);
                setDrillUser(null);
                setDrillMonth(null);
              }}
            >
              <Ionicons
                name={mode === "list" ? "list-outline" : "people-outline"}
                size={15}
                color={view === mode ? c.accent : c.textMuted}
              />
              <Text
                style={[
                  styles.viewBtnText,
                  view === mode && { color: c.accent },
                ]}
              >
                {mode === "list" ? "All sheets" : "By employee"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Shared control, so this queue matches every other approval screen. */}
      <StatusTabs
        tabs={[
          { key: "PENDING", label: "Pending", tone: "#b45309" },
          { key: "APPROVED", label: "Approved", tone: "#16a34a" },
          { key: "REJECTED", label: "Rejected", tone: "#dc2626" },
          { key: "ALL", label: "All" },
        ]}
        value={tab}
        onChange={(k) => {
          setTab(k as any);
          setLoading(true);
        }}
        style={{ paddingHorizontal: 12, marginTop: 12 }}
      />

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
      ) : view === "employee" && !drillUser ? (
        /* Level 1 — employees who have sheets in the current filter. */
        <FlatList
          data={byEmployee}
          keyExtractor={(e) => e.id}
          contentContainerStyle={
            byEmployee.length === 0 ? styles.emptyWrap : { padding: 12 }
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
              <Ionicons name="people-outline" size={42} color={c.textFaint} />
              <Text style={styles.emptyText}>
                No employees with timesheets in this filter
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.8}
              onPress={() => setDrillUser(item.id)}
            >
              <View style={styles.cardTop}>
                <Text style={styles.who}>{item.name}</Text>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={c.textMuted}
                />
              </View>
              <Text style={styles.row}>
                {item.sheets.length} week
                {item.sheets.length === 1 ? "" : "s"} ·{" "}
                {item.sheets
                  .reduce((s, t) => s + (t.totalHours || 0), 0)
                  .toFixed(1)}{" "}
                h
              </Text>
            </TouchableOpacity>
          )}
        />
      ) : view === "employee" && drillUser && !drillMonth ? (
        /* Level 2 — that employee's months. */
        <FlatList
          data={monthsForUser}
          keyExtractor={(m) => m.key}
          contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.8}
              onPress={() => setDrillMonth(item.key)}
            >
              <View style={styles.cardTop}>
                <Text style={styles.who}>{monthLabel(item.key)}</Text>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={c.textMuted}
                />
              </View>
              <Text style={styles.row}>
                {item.sheets.length} week
                {item.sheets.length === 1 ? "" : "s"} ·{" "}
                {item.totalHours.toFixed(1)} h
              </Text>
            </TouchableOpacity>
          )}
        />
      ) : view === "employee" && drillMonth ? (
        /* Level 3 — that month's weeks. Opens the same detail modal. */
        <FlatList
          data={monthsForUser.find((m) => m.key === drillMonth)?.sheets || []}
          keyExtractor={(t) => t.id || `${t.weekStart}-${t.userId}`}
          contentContainerStyle={{ padding: 12 }}
          renderItem={({ item }) => {
            const sc = timesheetStatusColor(item.status, c);
            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.8}
                onPress={() => setSelected(item)}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.who}>Week of {item.weekStart}</Text>
                  <View
                    style={[styles.statusPill, { backgroundColor: sc.bg }]}
                  >
                    <Text style={[styles.statusText, { color: sc.fg }]}>
                      {item.status}
                    </Text>
                  </View>
                </View>
                <Text style={styles.row}>
                  {item.totalHours.toFixed(1)} h ·{" "}
                  {(item.entries || []).length} day
                  {(item.entries || []).length === 1 ? "" : "s"} logged
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
      ) : (
        <FlatList
          data={items}
          keyExtractor={(t) =>
            t.id || `${t.weekStart}-${t.userId}`
          }
          contentContainerStyle={
            items.length === 0 ? styles.emptyWrap : { padding: 12 }
          }
          ListHeaderComponent={
            <TimesheetSummaryBox
              scope="hr"
              filters={{
                status: tab === "ALL" ? undefined : tab,
                weekStart: weekFilter.trim() || undefined,
              }}
            />
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
                    // Times and the work note carry the actual evidence of
                    // what was done; date + hours alone gave an approver
                    // nothing to approve on.
                    <View key={i} style={styles.entryBlock}>
                      <View style={styles.entryRow}>
                        <Text style={styles.entryDate}>{e.date}</Text>
                        <Text style={styles.entryTimes}>
                          {e.exempt
                            ? e.exemptReason || "Non-working day"
                            : `${fmtTime(e.checkIn)} – ${fmtTime(e.checkOut)}`}
                        </Text>
                        <Text style={styles.entryHours}>
                          {e.exempt ? "—" : `${(e.hours || 0).toFixed(1)} h`}
                        </Text>
                        {e.billable && (
                          <View style={styles.tinyPill}>
                            <Text style={styles.tinyPillText}>BILL</Text>
                          </View>
                        )}
                      </View>
                      {!!e.notes && (
                        <Text style={styles.entryNotes}>{e.notes}</Text>
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
  entryBlock: {
    backgroundColor: c.surface,
    borderRadius: 8,
    marginBottom: 6,
    paddingBottom: 2 },
  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 10 },
  entryDate: { color: c.text, fontSize: 12, fontWeight: "700", width: 92 },
  entryTimes: { color: c.textMuted, fontSize: 12, flex: 1 },
  entryHours: { color: "#3b82f6", fontSize: 12, fontWeight: "700" },
  entryNotes: {
    color: c.text,
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: 10,
    paddingBottom: 8 },
  entryProj: { color: c.textMuted, fontSize: 11 },
  viewToggle: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 12 },
  viewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  viewBtnActive: {
    borderColor: c.accent,
    backgroundColor: c.accentSoft },
  viewBtnText: { color: c.textMuted, fontSize: 13, fontWeight: "700" },
  tinyPill: {
    backgroundColor: "#16a34a",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4 },
  tinyPillText: { color: "#fff", fontSize: 9, fontWeight: "800" } });

