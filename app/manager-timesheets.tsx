import React, { useEffect, useState, useCallback, useMemo } from "react";

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
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  listManagerTimesheets,
  decideManagerTimesheet,
} from "../src/services/manager";
import {
  getTimesheetSummary,
  getTimesheetOverview,
  downloadEmployeeTimesheetsXlsx,
  downloadTimesheetsXlsx,
  TimesheetSummary,
  TimesheetOverviewRow,
} from "../src/services/timesheets";
import { Timesheet, TimesheetEntry } from "../src/types";

import { useTheme } from "../src/theme/ThemeProvider";
import { timesheetStatusColor } from "../src/theme/statusColors";
import { StatusTabs, approvalTabs } from "../src/components/StatusTabs";
import { WebModal, ModalActions } from "../src/components/WebModal";
import { useResponsive } from "../src/utils/responsive";

type Filter = "ALL" | "PENDING" | "APPROVED" | "REJECTED";

/** "2026-07-20T09:30:00" -> "09:30" */
const hm = (iso?: string | null): string => {
  if (!iso) return "";
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  return m ? `${m[1]}:${m[2]}` : "";
};

const prettyWeek = (weekStart?: string | null): string => {
  if (!weekStart) return "—";
  const [y, m, d] = weekStart.split("-").map(Number);
  if (!y) return weekStart;
  const a = new Date(y, m - 1, d);
  const b = new Date(y, m - 1, d + 6);
  return `${a.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  })} – ${b.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}`;
};

export default function ManagerTimesheets() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const responsive = useResponsive();
  const wide = responsive.isDesktop;
  const styles = useMemo(() => makeStyles(c, wide), [c, wide]);

  const [tab, setTab] = useState<Filter>("PENDING");
  const [view, setView] = useState<"people" | "sheets">("people");
  const [items, setItems] = useState<Timesheet[]>([]);
  const [people, setPeople] = useState<TimesheetOverviewRow[]>([]);
  const [summary, setSummary] = useState<TimesheetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Timesheet | null>(null);
  const [note, setNote] = useState("");
  const [acting, setActing] = useState<"APPROVE" | "REJECT" | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const status = tab === "ALL" ? undefined : tab;
      const [list, over, sum] = await Promise.all([
        listManagerTimesheets(token, (status || "") as any),
        getTimesheetOverview(token, "manager", { status }),
        // Unfiltered, so the tab badges show real totals rather than the
        // count of whatever happens to be on screen.
        getTimesheetSummary(token, "manager"),
      ]);
      setItems(list || []);
      setPeople(over || []);
      setSummary(sum);
    } catch (err: any) {
      Alert.alert("Couldn't load timesheets", err?.message || "Pull to retry.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router, tab]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const close = () => {
    setSelected(null);
    setNote("");
    setActing(null);
  };

  const onDecide = async (action: "APPROVE" | "REJECT") => {
    if (!selected?.id) return;
    if (action === "REJECT" && !note.trim()) {
      Alert.alert("Add a note so they know what to fix");
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
      close();
      load();
    } catch (err: any) {
      Alert.alert(
        action === "APPROVE" ? "Approve failed" : "Reject failed",
        err?.message || ""
      );
    } finally {
      setActing(null);
    }
  };

  const onDownloadPerson = async (row: TimesheetOverviewRow) => {
    if (busyId) return;
    setBusyId(row.userId);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await downloadEmployeeTimesheetsXlsx(
        token,
        "manager",
        row.userId,
        row.user?.name
      );
    } catch (err: any) {
      Alert.alert("Download failed", err?.message || "");
    } finally {
      setBusyId(null);
    }
  };

  const onDownloadAll = async () => {
    if (busyId) return;
    setBusyId("__all__");
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await downloadTimesheetsXlsx(token, "manager", {
        status: tab === "ALL" ? undefined : tab,
      });
    } catch (err: any) {
      Alert.alert("Download failed", err?.message || "");
    } finally {
      setBusyId(null);
    }
  };

  const counts = {
    ALL: summary?.count,
    PENDING: summary?.byStatus?.PENDING ?? 0,
    APPROVED: summary?.byStatus?.APPROVED ?? 0,
    REJECTED: summary?.byStatus?.REJECTED ?? 0,
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  const header = (
    <View>
      <View style={styles.summaryCard}>
        <View style={styles.summaryTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryHours}>
              {(summary?.approvedHours ?? 0).toFixed(1)}
              <Text style={styles.summaryUnit}> h</Text>
            </Text>
            <Text style={styles.summaryLabel}>
              Total hours worked · approved
            </Text>
          </View>
          <TouchableOpacity
            style={styles.dlBtn}
            onPress={onDownloadAll}
            disabled={busyId !== null}
          >
            <Ionicons name="download-outline" size={15} color={c.accent} />
            <Text style={styles.dlText}>
              {busyId === "__all__" ? "Preparing…" : "Download all"}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.statRow}>
          <Stat styles={styles} v={String(summary?.employees ?? 0)} l="People" />
          <Stat styles={styles} v={String(counts.PENDING)} l="Pending" />
          <Stat styles={styles} v={String(counts.APPROVED)} l="Approved" />
          <Stat styles={styles} v={String(counts.REJECTED)} l="Rejected" />
        </View>
      </View>

      <StatusTabs tabs={approvalTabs(counts, c)} value={tab} onChange={setTab} />

      <View style={styles.viewToggle}>
        {(
          [
            ["people", "By employee", "people-outline"],
            ["sheets", "All sheets", "documents-outline"],
          ] as const
        ).map(([k, label, icon]) => (
          <TouchableOpacity
            key={k}
            style={[styles.vt, view === k && styles.vtOn]}
            onPress={() => setView(k as any)}
          >
            <Ionicons
              name={icon as any}
              size={14}
              color={view === k ? "#fff" : c.textMuted}
            />
            <Text style={[styles.vtText, view === k && styles.vtTextOn]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/")
          }
        >
          <Ionicons name="arrow-back" size={24} color={c.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Time Sheets</Text>
        <View style={{ width: 24 }} />
      </View>

      {view === "people" ? (
        <FlatList
          key="people"
          data={people}
          keyExtractor={(p) => p.userId}
          ListHeaderComponent={header}
          contentContainerStyle={styles.listPad}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={c.accent}
              colors={[c.accent]}
            />
          }
          ListEmptyComponent={
            <Empty styles={styles} c={c} text="Nobody has submitted yet" />
          }
          renderItem={({ item }) => (
            <View style={styles.personCard}>
              <View style={styles.personTop}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(item.user?.name || "?").charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.personName} numberOfLines={1}>
                    {item.user?.name || item.userId}
                  </Text>
                  <Text style={styles.personSub} numberOfLines={1}>
                    {item.user?.employeeCode
                      ? `${item.user.employeeCode} · `
                      : ""}
                    latest {prettyWeek(item.lastWeek)}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => onDownloadPerson(item)}
                  disabled={busyId !== null}
                >
                  <Ionicons
                    name={
                      busyId === item.userId
                        ? "hourglass-outline"
                        : "download-outline"
                    }
                    size={17}
                    color={c.accent}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.personStats}>
                <Stat
                  styles={styles}
                  v={item.approvedHours.toFixed(1)}
                  l="Approved h"
                />
                <Stat styles={styles} v={String(item.sheets)} l="Sheets" />
                <Stat styles={styles} v={String(item.pending)} l="Pending" />
                <Stat styles={styles} v={String(item.rejected)} l="Rejected" />
              </View>
            </View>
          )}
        />
      ) : (
        <FlatList
          key="sheets"
          data={items}
          keyExtractor={(t) => t.id || `${t.weekStart}-${t.userId}`}
          ListHeaderComponent={header}
          contentContainerStyle={styles.listPad}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={c.accent}
              colors={[c.accent]}
            />
          }
          ListEmptyComponent={
            <Empty
              styles={styles}
              c={c}
              text={
                tab === "PENDING"
                  ? "No timesheets waiting for you"
                  : `No ${tab.toLowerCase()} timesheets`
              }
            />
          }
          renderItem={({ item }) => {
            const sc = timesheetStatusColor(item.status, c);
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => {
                  setSelected(item);
                  setNote("");
                }}
                activeOpacity={0.85}
              >
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.who} numberOfLines={1}>
                      {item.user?.name || item.userId}
                    </Text>
                    <Text style={styles.weekSub}>
                      {prettyWeek(item.weekStart)} · {item.weekStart}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.pill,
                      { backgroundColor: sc.bg, borderColor: sc.solid },
                    ]}
                  >
                    <Text style={[styles.pillText, { color: sc.fg }]}>
                      {item.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.hoursBig}>
                    {item.totalHours.toFixed(2)}
                    <Text style={styles.hoursUnit}> h</Text>
                  </Text>
                  <Text style={styles.meta}>
                    {item.entries?.filter(
                      (e: TimesheetEntry) =>
                        e.checkIn || (e.notes || "").trim()
                    ).length || 0}{" "}
                    day(s) logged
                  </Text>
                  <View style={{ flex: 1 }} />
                  {item.canDecide && (
                    <View style={styles.actionHint}>
                      <Text style={styles.actionHintText}>Review</Text>
                      <Ionicons
                        name="chevron-forward"
                        size={14}
                        color={c.accent}
                      />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <WebModal
        visible={!!selected}
        onClose={close}
        title={selected?.canDecide === false ? "Timesheet" : "Review timesheet"}
        size="lg"
        footer={
          selected?.canDecide === false ? (
            <ModalActions align="spread">
              <Text style={styles.readOnlyNote}>
                Only {selected?.user?.name || "this employee"}&apos;s reporting
                manager can approve or reject this week.
              </Text>
            </ModalActions>
          ) : (
            <ModalActions align="spread">
              <TouchableOpacity
                style={[styles.btn, styles.btnReject]}
                onPress={() => onDecide("REJECT")}
                disabled={acting !== null}
              >
                <Text style={[styles.btnText, { color: "#dc2626" }]}>
                  {acting === "REJECT" ? "…" : "Send back"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnApprove]}
                onPress={() => onDecide("APPROVE")}
                disabled={acting !== null}
              >
                <Text style={styles.btnText}>
                  {acting === "APPROVE" ? "…" : "Approve"}
                </Text>
              </TouchableOpacity>
            </ModalActions>
          )
        }
      >
        {selected && (
          <>
            <View style={styles.detailHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailName}>
                  {selected.user?.name || selected.userId}
                </Text>
                <Text style={styles.detailWeek}>
                  {prettyWeek(selected.weekStart)} · {selected.weekStart}
                </Text>
              </View>
              <Text style={styles.detailHours}>
                {selected.totalHours.toFixed(2)}
                <Text style={styles.hoursUnit}> h</Text>
              </Text>
            </View>

            {!!selected.note && (
              <View style={styles.noteBox}>
                <Text style={styles.noteLabelTight}>NOTE FROM EMPLOYEE</Text>
                <Text style={styles.noteText}>{selected.note}</Text>
              </View>
            )}

            <View style={styles.tableHead}>
              <Text style={[styles.th, { width: 92 }]}>Date</Text>
              <Text style={[styles.th, { width: 104, textAlign: "center" }]}>
                In → Out
              </Text>
              <Text style={[styles.th, { width: 48, textAlign: "right" }]}>
                Hrs
              </Text>
              <Text style={[styles.th, { flex: 1 }]}>Work notes</Text>
            </View>

            {(selected.entries || [])
              .filter(
                (e: TimesheetEntry) =>
                  e.checkIn || e.checkOut || (e.notes || "").trim()
              )
              .map((e: TimesheetEntry, i: number) => (
                <View key={i} style={[styles.tr, i % 2 === 1 && styles.trAlt]}>
                  <Text style={[styles.tdDate, { width: 92 }]}>{e.date}</Text>
                  <Text style={[styles.tdTime, { width: 104 }]}>
                    {hm(e.checkIn) || "—"} → {hm(e.checkOut) || "—"}
                  </Text>
                  <Text style={[styles.tdHours, { width: 48 }]}>
                    {(e.hours || 0).toFixed(2)}
                  </Text>
                  <Text style={[styles.tdNotes, { flex: 1 }]}>
                    {(e.notes || "").trim() || "—"}
                  </Text>
                </View>
              ))}

            <Text style={styles.applyHint}>
              Approving writes these times and notes into{" "}
              {selected.user?.name || "the employee"}&apos;s attendance, and
              creates any day that has no record yet.
            </Text>

            {selected.canDecide !== false && (
              <>
                <Text style={styles.noteLabel}>
                  NOTE (required to send back)
                </Text>
                <TextInput
                  style={styles.input}
                  value={note}
                  onChangeText={setNote}
                  placeholder="What needs fixing?"
                  placeholderTextColor={c.textFaint}
                  multiline
                />
              </>
            )}
          </>
        )}
      </WebModal>
    </SafeAreaView>
  );
}

const Stat = ({ styles, v, l }: any) => (
  <View style={styles.stat}>
    <Text style={styles.statV}>{v}</Text>
    <Text style={styles.statL}>{l}</Text>
  </View>
);

const Empty = ({ styles, c, text }: any) => (
  <View style={styles.empty}>
    <Ionicons name="checkmark-done" size={40} color={c.textFaint} />
    <Text style={styles.emptyText}>{text}</Text>
  </View>
);

const makeStyles = (c: any, wide: boolean) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    loader: {
      flex: 1,
      backgroundColor: c.bg,
      justifyContent: "center",
      alignItems: "center",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: c.surfaceBorder,
      gap: 12,
    },
    title: { color: c.text, fontSize: 18, fontWeight: "800", flex: 1 },
    listPad: {
      padding: wide ? 24 : 12,
      paddingBottom: 60,
      ...(wide
        ? { maxWidth: 1100, alignSelf: "center" as const, width: "100%" }
        : null),
    },

    summaryCard: {
      backgroundColor: c.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      padding: 16,
      marginBottom: 12,
    },
    summaryTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    summaryHours: {
      color: c.text,
      fontSize: 30,
      fontWeight: "900",
      letterSpacing: -0.8,
    },
    summaryUnit: { fontSize: 15, color: c.textMuted, fontWeight: "800" },
    summaryLabel: { color: c.textMuted, fontSize: 11.5, marginTop: 1 },
    dlBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: c.accentSoft,
      borderWidth: 1,
      borderColor: c.accent,
      ...(Platform.OS === "web" ? { cursor: "pointer" as any } : {}),
    },
    dlText: { color: c.accent, fontSize: 11.5, fontWeight: "800" },
    statRow: { flexDirection: "row", gap: 8, marginTop: 14 },
    stat: {
      flex: 1,
      backgroundColor: c.surfaceMuted,
      borderRadius: 10,
      paddingVertical: 9,
      alignItems: "center",
    },
    statV: { color: c.text, fontSize: 15, fontWeight: "800" },
    statL: {
      color: c.textMuted,
      fontSize: 9.5,
      fontWeight: "700",
      marginTop: 2,
      textAlign: "center",
    },

    viewToggle: { flexDirection: "row", gap: 8, marginBottom: 12 },
    vt: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 13,
      paddingVertical: 8,
      borderRadius: 10,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      ...(Platform.OS === "web" ? { cursor: "pointer" as any } : {}),
    },
    vtOn: { backgroundColor: c.accent, borderColor: c.accent },
    vtText: { color: c.textMuted, fontSize: 12, fontWeight: "800" },
    vtTextOn: { color: "#fff" },

    personCard: {
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      padding: 14,
      marginBottom: 10,
    },
    personTop: { flexDirection: "row", alignItems: "center", gap: 11 },
    avatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: c.accentSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { color: c.accent, fontSize: 16, fontWeight: "800" },
    personName: { color: c.text, fontSize: 14.5, fontWeight: "800" },
    personSub: { color: c.textMuted, fontSize: 11, marginTop: 2 },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.surfaceMuted,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      ...(Platform.OS === "web" ? { cursor: "pointer" as any } : {}),
    },
    personStats: { flexDirection: "row", gap: 8, marginTop: 12 },

    card: {
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      padding: 14,
      marginBottom: 10,
      ...(Platform.OS === "web" ? { cursor: "pointer" as any } : {}),
    },
    cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    who: { color: c.text, fontSize: 14.5, fontWeight: "800" },
    weekSub: { color: c.textMuted, fontSize: 11, marginTop: 2 },
    pill: {
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: 999,
      borderWidth: 1,
    },
    pillText: { fontSize: 9.5, fontWeight: "800", letterSpacing: 0.4 },
    cardFooter: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 10,
      marginTop: 10,
    },
    hoursBig: { color: c.text, fontSize: 18, fontWeight: "900" },
    hoursUnit: { fontSize: 12, color: c.textMuted, fontWeight: "700" },
    meta: { color: c.textMuted, fontSize: 11.5 },
    actionHint: { flexDirection: "row", alignItems: "center", gap: 2 },
    actionHintText: { color: c.accent, fontSize: 12, fontWeight: "800" },

    empty: { alignItems: "center", gap: 10, paddingVertical: 48 },
    emptyText: { color: c.textMuted, fontSize: 13.5, fontWeight: "600" },

    detailHead: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      marginBottom: 12,
    },
    detailName: { color: c.text, fontSize: 16, fontWeight: "800" },
    detailWeek: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    detailHours: { color: c.text, fontSize: 22, fontWeight: "900" },
    noteBox: {
      backgroundColor: c.surfaceMuted,
      borderRadius: 10,
      padding: 11,
      marginBottom: 12,
    },
    noteLabel: {
      color: c.textMuted,
      fontSize: 9.5,
      letterSpacing: 1.1,
      fontWeight: "800",
      marginTop: 12,
      marginBottom: 6,
    },
    noteLabelTight: {
      color: c.textMuted,
      fontSize: 9.5,
      letterSpacing: 1.1,
      fontWeight: "800",
      marginBottom: 5,
    },
    noteText: { color: c.text, fontSize: 12.5, lineHeight: 18 },
    tableHead: {
      flexDirection: "row",
      gap: 10,
      paddingVertical: 8,
      paddingHorizontal: 10,
      backgroundColor: c.surfaceMuted,
      borderRadius: 8,
    },
    th: {
      color: c.textMuted,
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 0.9,
    },
    tr: {
      flexDirection: "row",
      gap: 10,
      paddingVertical: 9,
      paddingHorizontal: 10,
      borderBottomWidth: 1,
      borderBottomColor: c.surfaceBorder,
    },
    trAlt: { backgroundColor: c.surfaceMuted },
    tdDate: { color: c.text, fontSize: 11.5, fontWeight: "700" },
    tdTime: {
      color: c.textMuted,
      fontSize: 11.5,
      fontWeight: "700",
      textAlign: "center",
    },
    tdHours: {
      color: c.text,
      fontSize: 11.5,
      fontWeight: "800",
      textAlign: "right",
    },
    tdNotes: { color: c.text, fontSize: 11.5, lineHeight: 16 },
    applyHint: {
      color: c.textMuted,
      fontSize: 11.5,
      lineHeight: 16,
      marginTop: 12,
    },
    readOnlyNote: {
      flex: 1,
      color: c.textMuted,
      fontSize: 12,
      lineHeight: 17,
      textAlign: "center",
    },
    input: {
      backgroundColor: c.surfaceMuted,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      padding: 11,
      color: c.text,
      minHeight: 62,
      textAlignVertical: "top",
    },
    btn: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      ...(Platform.OS === "web" ? { cursor: "pointer" as any } : {}),
    },
    btnReject: {
      backgroundColor: "transparent",
      borderWidth: 1.5,
      borderColor: "#dc2626",
    },
    btnApprove: { backgroundColor: "#16a34a" },
    btnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  });
