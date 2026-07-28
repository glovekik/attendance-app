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
  downloadTimesheetsXlsx,
  TimesheetSummary,
} from "../src/services/timesheets";
import { Timesheet, TimesheetEntry } from "../src/types";

import { useTheme } from "../src/theme/ThemeProvider";
import { timesheetStatusColor } from "../src/theme/statusColors";
import { StatusTabs, approvalTabs } from "../src/components/StatusTabs";
import { WebModal, ModalActions } from "../src/components/WebModal";
import { useResponsive } from "../src/utils/responsive";
import { notify } from "../src/utils/confirm";

type Filter = "ALL" | "PENDING" | "APPROVED" | "REJECTED";

/** "2026-07-20T09:30:00" -> "09:30" */
const hm = (iso?: string | null): string => {
  if (!iso) return "";
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  return m ? `${m[1]}:${m[2]}` : "";
};

/** "2026-07-20" -> "Mon, 20 Jul" */
const dayDate = (ymd?: string | null): string => {
  if (!ymd) return "—";
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y) return ymd;
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
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
  })} – ${b.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })}`;
};

const initials = (name?: string) =>
  (name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] || "")
    .join("")
    .toUpperCase() || "?";

const loggedDays = (t: Timesheet) =>
  t.entries?.filter(
    (e: TimesheetEntry) => e.checkIn || (e.notes || "").trim()
  ).length || 0;

export default function ManagerTimesheets() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const responsive = useResponsive();
  const wide = responsive.isDesktop;
  const styles = useMemo(() => makeStyles(c, wide), [c, wide]);

  const [tab, setTab] = useState<Filter>("PENDING");
  const [items, setItems] = useState<Timesheet[]>([]);
  const [summary, setSummary] = useState<TimesheetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selected, setSelected] = useState<Timesheet | null>(null);
  const [note, setNote] = useState("");
  const [acting, setActing] = useState<"APPROVE" | "REJECT" | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const status = tab === "ALL" ? undefined : tab;
      const [list, sum] = await Promise.all([
        listManagerTimesheets(token, (status || "") as any),
        // Unfiltered, so the tab counts are real totals, not what's on screen.
        getTimesheetSummary(token, "manager"),
      ]);
      setItems(list || []);
      setSummary(sum);
    } catch (err: any) {
      notify("Couldn't load timesheets", err?.message || "Pull to retry.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router, tab]);

  useEffect(() => {
    setLoading(true);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const close = () => {
    setSelected(null);
    setNote("");
    setActing(null);
  };

  const onDecide = async (action: "APPROVE" | "REJECT") => {
    if (!selected?.id) return;
    if (action === "REJECT" && !note.trim()) {
      notify("Add a note", "Tell them what needs fixing before sending back.");
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
      notify(
        action === "APPROVE" ? "Approved" : "Sent back",
        action === "APPROVE"
          ? "Written into the employee's attendance."
          : "The employee has been asked to fix it."
      );
      close();
      load();
    } catch (err: any) {
      notify(
        action === "APPROVE" ? "Approve failed" : "Couldn't send back",
        err?.message || ""
      );
    } finally {
      setActing(null);
    }
  };

  // Distinct people who have sheets in the current filter — the pool you can
  // pick from when downloading a subset.
  const peopleInView = useMemo(() => {
    const map = new Map<string, { userId: string; name: string; code?: string }>();
    for (const t of items) {
      if (t.userId && !map.has(t.userId)) {
        map.set(t.userId, {
          userId: t.userId,
          name: t.user?.name || t.userId,
          code: t.user?.employeeCode,
        });
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  const togglePick = (uid: string) =>
    setPicked((prev) => {
      const n = new Set(prev);
      if (n.has(uid)) n.delete(uid);
      else n.add(uid);
      return n;
    });

  const doExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      // No ticks (or all ticked) = everyone; otherwise just the chosen people.
      const everyone = picked.size === 0 || picked.size === peopleInView.length;
      await downloadTimesheetsXlsx(token, "manager", {
        status: tab === "ALL" ? undefined : tab,
        userIds: everyone ? undefined : [...picked].join(","),
      });
      setExportOpen(false);
      setPicked(new Set());
    } catch (err: any) {
      notify("Download failed", err?.message || "");
    } finally {
      setExporting(false);
    }
  };

  const counts = {
    ALL: summary?.count,
    PENDING: summary?.byStatus?.PENDING ?? 0,
    APPROVED: summary?.byStatus?.APPROVED ?? 0,
    REJECTED: summary?.byStatus?.REJECTED ?? 0,
  };

  const openReview = (t: Timesheet) => {
    setSelected(t);
    setNote("");
  };

  const header = (
    <View>
      {/* Slim summary — three plain facts, not a wall of numbers */}
      <View style={styles.summary}>
        <SumStat
          styles={styles}
          icon="time-outline"
          v={`${(summary?.approvedHours ?? 0).toFixed(1)} h`}
          l="Approved"
          tint={c.accent}
        />
        <View style={styles.sumDivider} />
        <SumStat
          styles={styles}
          icon="people-outline"
          v={String(summary?.employees ?? 0)}
          l="People"
          tint={c.text}
        />
        <View style={styles.sumDivider} />
        <SumStat
          styles={styles}
          icon="hourglass-outline"
          v={String(counts.PENDING)}
          l="Pending"
          tint={counts.PENDING ? "#b45309" : c.textMuted}
        />
      </View>

      <StatusTabs tabs={approvalTabs(counts, c)} value={tab} onChange={setTab} />

      {items.length > 0 && (
        <Text style={styles.listLabel}>
          {tab === "PENDING"
            ? "Waiting for your review"
            : `${tab === "ALL" ? "All" : tab[0] + tab.slice(1).toLowerCase()} timesheets`}
        </Text>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header: back · title · one clear Export */}
      <View style={styles.header}>
        <TouchableOpacity
          hitSlop={10}
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/")
          }
        >
          <Ionicons name="arrow-back" size={24} color={c.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Timesheets</Text>
        <TouchableOpacity
          style={styles.exportBtn}
          onPress={() => setExportOpen(true)}
          disabled={items.length === 0}
        >
          <Ionicons name="download-outline" size={15} color={c.accent} />
          <Text style={styles.exportText}>Download</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(t) => t.id || `${t.weekStart}-${t.userId}`}
        ListHeaderComponent={header}
        contentContainerStyle={styles.listPad}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={c.accent}
            colors={[c.accent]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="checkmark-done" size={40} color={c.textFaint} />
            <Text style={styles.emptyText}>
              {tab === "PENDING"
                ? "Nothing waiting for your review."
                : `No ${tab === "ALL" ? "" : tab.toLowerCase() + " "}timesheets yet.`}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const sc = timesheetStatusColor(item.status, c);
          const canDecide = item.canDecide !== false && item.status === "PENDING";
          return (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => openReview(item)}
            >
              {/* who + status */}
              <View style={styles.cardTop}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {initials(item.user?.name)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.who} numberOfLines={1}>
                    {item.user?.name || item.userId}
                  </Text>
                  <Text style={styles.weekSub} numberOfLines={1}>
                    {item.user?.employeeCode
                      ? `${item.user.employeeCode} · `
                      : ""}
                    {prettyWeek(item.weekStart)}
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

              {/* two facts that matter */}
              <View style={styles.factRow}>
                <View style={styles.fact}>
                  <Text style={styles.factV}>
                    {item.totalHours.toFixed(2)}
                    <Text style={styles.factUnit}> h</Text>
                  </Text>
                  <Text style={styles.factL}>Total hours</Text>
                </View>
                <View style={styles.fact}>
                  <Text style={styles.factV}>{loggedDays(item)}</Text>
                  <Text style={styles.factL}>Days logged</Text>
                </View>
              </View>

              {/* one obvious action */}
              {canDecide ? (
                <View style={styles.cardActions}>
                  <View style={[styles.actBtn, styles.actGhost]}>
                    <Ionicons name="arrow-undo-outline" size={15} color="#dc2626" />
                    <Text style={[styles.actGhostText]}>Send back</Text>
                  </View>
                  <View style={[styles.actBtn, styles.actPrimary]}>
                    <Ionicons name="checkmark" size={16} color="#fff" />
                    <Text style={styles.actPrimaryText}>Review &amp; approve</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.viewRow}>
                  <Text style={styles.viewText}>View sheet</Text>
                  <Ionicons name="chevron-forward" size={15} color={c.accent} />
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />

      {/* Download picker — one · some · everyone */}
      <WebModal
        visible={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Download timesheets"
        subtitle={`${
          tab === "ALL" ? "All" : tab[0] + tab.slice(1).toLowerCase()
        } · Excel`}
        size="md"
        footer={
          <ModalActions align="spread">
            <TouchableOpacity
              style={[styles.btn, styles.btnCancel]}
              onPress={() => setExportOpen(false)}
            >
              <Text style={[styles.btnText, { color: c.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnApprove]}
              onPress={doExport}
              disabled={exporting}
            >
              <Ionicons name="download-outline" size={16} color="#fff" />
              <Text style={styles.btnText}>
                {exporting
                  ? "…"
                  : picked.size === 0 || picked.size === peopleInView.length
                  ? "Everyone"
                  : `${picked.size} selected`}
              </Text>
            </TouchableOpacity>
          </ModalActions>
        }
      >
        <Text style={styles.pickerHint}>
          Tick the people you want — or leave all unticked to download everyone.
        </Text>
        {peopleInView.length > 1 && (
          <TouchableOpacity
            style={styles.pickAll}
            onPress={() =>
              setPicked((prev) =>
                prev.size === peopleInView.length
                  ? new Set()
                  : new Set(peopleInView.map((p) => p.userId))
              )
            }
          >
            <Ionicons
              name={
                picked.size === peopleInView.length
                  ? "checkbox"
                  : "square-outline"
              }
              size={18}
              color={c.accent}
            />
            <Text style={styles.pickAllText}>
              {picked.size === peopleInView.length ? "Clear all" : "Select all"}
            </Text>
          </TouchableOpacity>
        )}
        {peopleInView.map((p) => {
          const on = picked.has(p.userId);
          return (
            <TouchableOpacity
              key={p.userId}
              style={styles.pickRow}
              onPress={() => togglePick(p.userId)}
              activeOpacity={0.75}
            >
              <View style={styles.avatarSm}>
                <Text style={styles.avatarSmText}>{initials(p.name)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.pickName}>{p.name}</Text>
                {!!p.code && <Text style={styles.pickCode}>{p.code}</Text>}
              </View>
              <Ionicons
                name={on ? "checkbox" : "square-outline"}
                size={22}
                color={on ? c.accent : c.textFaint}
              />
            </TouchableOpacity>
          );
        })}
      </WebModal>

      {/* Review / view sheet */}
      <WebModal
        visible={!!selected}
        onClose={close}
        title={
          selected?.canDecide !== false && selected?.status === "PENDING"
            ? "Review timesheet"
            : "Timesheet"
        }
        size="lg"
        footer={
          selected?.canDecide !== false && selected?.status === "PENDING" ? (
            <ModalActions align="spread">
              <TouchableOpacity
                style={[styles.btn, styles.btnReject]}
                onPress={() => onDecide("REJECT")}
                disabled={acting !== null}
              >
                <Ionicons name="arrow-undo-outline" size={16} color="#dc2626" />
                <Text style={[styles.btnText, { color: "#dc2626" }]}>
                  {acting === "REJECT" ? "…" : "Send back"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnApprove]}
                onPress={() => onDecide("APPROVE")}
                disabled={acting !== null}
              >
                <Ionicons name="checkmark" size={17} color="#fff" />
                <Text style={styles.btnText}>
                  {acting === "APPROVE" ? "…" : "Approve"}
                </Text>
              </TouchableOpacity>
            </ModalActions>
          ) : (
            <ModalActions align="spread">
              <Text style={styles.readOnlyNote}>
                {selected?.canDecide === false
                  ? `Only ${selected?.user?.name || "this employee"}'s reporting manager can approve or send this back.`
                  : selected?.status === "APPROVED"
                  ? "Approved — these hours are in the employee's attendance."
                  : selected?.status === "REJECTED"
                  ? "Sent back to the employee to fix and resubmit."
                  : `This timesheet is ${(selected?.status || "").toLowerCase()}.`}
              </Text>
            </ModalActions>
          )
        }
      >
        {selected && (
          <>
            <View style={styles.detailHead}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {initials(selected.user?.name)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.detailName}>
                  {selected.user?.name || selected.userId}
                </Text>
                <Text style={styles.detailWeek}>
                  {prettyWeek(selected.weekStart)}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.detailHours}>
                  {selected.totalHours.toFixed(2)}
                  <Text style={styles.hoursUnit}> h</Text>
                </Text>
                <Text style={styles.detailHoursL}>total</Text>
              </View>
            </View>

            {!!selected.note && (
              <View style={styles.noteBox}>
                <Text style={styles.noteLabelTight}>NOTE FROM EMPLOYEE</Text>
                <Text style={styles.noteText}>{selected.note}</Text>
              </View>
            )}

            {(() => {
              const days = (selected.entries || []).filter(
                (e: TimesheetEntry) =>
                  e.checkIn || e.checkOut || (e.notes || "").trim()
              );
              if (days.length === 0) {
                return (
                  <Text style={styles.noDays}>No days were logged this week.</Text>
                );
              }
              return (
                <>
                  <Text style={styles.sectionLabel}>
                    Daily breakdown · {days.length} day{days.length === 1 ? "" : "s"}
                  </Text>
                  {days.map((e: TimesheetEntry, i: number) => (
                    <View key={i} style={styles.dayCard}>
                      <View style={styles.dayTop}>
                        <Text style={styles.dayDate}>{dayDate(e.date)}</Text>
                        <View style={styles.dayRight}>
                          <Ionicons
                            name="time-outline"
                            size={13}
                            color={c.textMuted}
                          />
                          <Text style={styles.dayTime}>
                            {hm(e.checkIn) || "—"} → {hm(e.checkOut) || "—"}
                          </Text>
                          <View style={styles.hrChip}>
                            <Text style={styles.hrChipText}>
                              {(e.hours || 0).toFixed(2)} h
                            </Text>
                          </View>
                        </View>
                      </View>
                      {!!(e.notes || "").trim() ? (
                        <Text style={styles.dayNote}>{e.notes!.trim()}</Text>
                      ) : (
                        <Text style={styles.dayNoteEmpty}>No work note.</Text>
                      )}
                    </View>
                  ))}
                </>
              );
            })()}

            {selected.canDecide !== false && selected.status === "PENDING" && (
              <>
                <View style={styles.applyBox}>
                  <Ionicons
                    name="information-circle-outline"
                    size={16}
                    color={c.textMuted}
                  />
                  <Text style={styles.applyHint}>
                    Approving writes these times and notes into{" "}
                    {selected.user?.name || "the employee"}&apos;s attendance,
                    and creates any missing day.
                  </Text>
                </View>
                <Text style={styles.noteLabel}>
                  NOTE — required only to send back
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

const SumStat = ({ styles, icon, v, l, tint }: any) => (
  <View style={styles.sumStat}>
    <Ionicons name={icon} size={16} color={tint} />
    <Text style={[styles.sumV, { color: tint }]}>{v}</Text>
    <Text style={styles.sumL}>{l}</Text>
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
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.surfaceBorder,
      gap: 12,
    },
    title: { color: c.text, fontSize: 18, fontWeight: "800", flex: 1 },
    exportBtn: {
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
    exportText: { color: c.accent, fontSize: 12.5, fontWeight: "800" },

    listPad: {
      padding: wide ? 24 : 14,
      paddingBottom: 60,
      ...(wide
        ? { maxWidth: 720, alignSelf: "center" as const, width: "100%" }
        : null),
    },

    // slim summary strip
    summary: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      paddingVertical: 12,
      marginBottom: 14,
    },
    sumStat: { flex: 1, alignItems: "center", gap: 3 },
    sumV: { fontSize: 17, fontWeight: "900" },
    sumL: {
      color: c.textMuted,
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0.4,
    },
    sumDivider: { width: 1, height: 34, backgroundColor: c.surfaceBorder },

    listLabel: {
      color: c.textMuted,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 0.8,
      marginBottom: 8,
      marginTop: 2,
      textTransform: "uppercase",
    },

    // timesheet card
    card: {
      backgroundColor: c.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      padding: 14,
      marginBottom: 12,
      ...(Platform.OS === "web" ? { cursor: "pointer" as any } : {}),
    },
    cardTop: { flexDirection: "row", alignItems: "center", gap: 11 },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.accentSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarText: { color: c.accent, fontSize: 15, fontWeight: "800" },
    who: { color: c.text, fontSize: 15, fontWeight: "800" },
    weekSub: { color: c.textMuted, fontSize: 11.5, marginTop: 2 },
    pill: {
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: 999,
      borderWidth: 1,
    },
    pillText: { fontSize: 9.5, fontWeight: "800", letterSpacing: 0.4 },

    factRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 12,
    },
    fact: {
      flex: 1,
      backgroundColor: c.surfaceMuted,
      borderRadius: 10,
      paddingVertical: 9,
      alignItems: "center",
    },
    factV: { color: c.text, fontSize: 17, fontWeight: "900" },
    factUnit: { fontSize: 12, color: c.textMuted, fontWeight: "700" },
    factL: {
      color: c.textMuted,
      fontSize: 10,
      fontWeight: "700",
      marginTop: 2,
    },

    cardActions: { flexDirection: "row", gap: 10, marginTop: 12 },
    actBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 11,
      borderRadius: 11,
    },
    actGhost: {
      flex: 1,
      backgroundColor: "transparent",
      borderWidth: 1.5,
      borderColor: "#dc2626",
    },
    actGhostText: { color: "#dc2626", fontSize: 13, fontWeight: "800" },
    actPrimary: { flex: 1.6, backgroundColor: "#16a34a" },
    actPrimaryText: { color: "#fff", fontSize: 13.5, fontWeight: "800" },

    viewRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 3,
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: c.surfaceBorder,
    },
    viewText: { color: c.accent, fontSize: 12.5, fontWeight: "800" },

    empty: { alignItems: "center", gap: 10, paddingVertical: 54 },
    emptyText: {
      color: c.textMuted,
      fontSize: 13.5,
      fontWeight: "600",
      textAlign: "center",
    },

    // detail modal
    detailHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginBottom: 14,
    },
    detailName: { color: c.text, fontSize: 16, fontWeight: "800" },
    detailWeek: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    detailHours: { color: c.text, fontSize: 22, fontWeight: "900" },
    detailHoursL: { color: c.textMuted, fontSize: 10, fontWeight: "700" },
    hoursUnit: { fontSize: 12, color: c.textMuted, fontWeight: "700" },
    noteBox: {
      backgroundColor: c.surfaceMuted,
      borderRadius: 10,
      padding: 11,
      marginBottom: 14,
    },
    noteLabelTight: {
      color: c.textMuted,
      fontSize: 9.5,
      letterSpacing: 1.1,
      fontWeight: "800",
      marginBottom: 5,
    },
    noteText: { color: c.text, fontSize: 12.5, lineHeight: 18 },
    sectionLabel: {
      color: c.textMuted,
      fontSize: 10.5,
      fontWeight: "800",
      letterSpacing: 0.8,
      textTransform: "uppercase",
      marginBottom: 8,
    },
    dayCard: {
      backgroundColor: c.surfaceMuted,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      padding: 12,
      marginBottom: 8,
    },
    dayTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      flexWrap: "wrap",
    },
    dayDate: { color: c.text, fontSize: 13.5, fontWeight: "800" },
    dayRight: { flexDirection: "row", alignItems: "center", gap: 6 },
    dayTime: { color: c.textMuted, fontSize: 12.5, fontWeight: "700" },
    hrChip: {
      backgroundColor: c.accentSoft,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 3,
      marginLeft: 2,
    },
    hrChipText: { color: c.accent, fontSize: 11.5, fontWeight: "800" },
    dayNote: { color: c.text, fontSize: 13, lineHeight: 19, marginTop: 8 },
    dayNoteEmpty: {
      color: c.textFaint,
      fontSize: 12,
      fontStyle: "italic",
      marginTop: 6,
    },
    noDays: {
      color: c.textMuted,
      fontSize: 13,
      textAlign: "center",
      paddingVertical: 20,
    },
    applyBox: {
      flexDirection: "row",
      gap: 8,
      backgroundColor: c.surfaceMuted,
      borderRadius: 10,
      padding: 11,
      marginTop: 14,
    },
    applyHint: {
      flex: 1,
      color: c.textMuted,
      fontSize: 11.5,
      lineHeight: 16,
    },
    readOnlyNote: {
      flex: 1,
      color: c.textMuted,
      fontSize: 12,
      lineHeight: 17,
      textAlign: "center",
    },
    noteLabel: {
      color: c.textMuted,
      fontSize: 9.5,
      letterSpacing: 1.1,
      fontWeight: "800",
      marginTop: 14,
      marginBottom: 6,
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
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 13,
      borderRadius: 12,
      ...(Platform.OS === "web" ? { cursor: "pointer" as any } : {}),
    },
    btnReject: {
      backgroundColor: "transparent",
      borderWidth: 1.5,
      borderColor: "#dc2626",
    },
    btnApprove: { backgroundColor: "#16a34a" },
    btnCancel: { backgroundColor: c.surfaceMuted },
    btnText: { color: "#fff", fontSize: 14, fontWeight: "800" },

    // download picker
    pickerHint: {
      color: c.textMuted,
      fontSize: 12.5,
      lineHeight: 18,
      marginBottom: 12,
    },
    pickAll: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 8,
      marginBottom: 4,
      ...(Platform.OS === "web" ? { cursor: "pointer" as any } : {}),
    },
    pickAllText: { color: c.accent, fontSize: 13, fontWeight: "800" },
    pickRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      paddingVertical: 9,
      borderTopWidth: 1,
      borderTopColor: c.surfaceBorder,
      ...(Platform.OS === "web" ? { cursor: "pointer" as any } : {}),
    },
    avatarSm: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: c.accentSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarSmText: { color: c.accent, fontSize: 13, fontWeight: "800" },
    pickName: { color: c.text, fontSize: 14, fontWeight: "700" },
    pickCode: { color: c.textMuted, fontSize: 11.5, marginTop: 1 },
  });
