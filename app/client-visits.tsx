import React, { useCallback, useEffect, useMemo, useState } from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { getMe } from "../src/services/api";
import { getWorkReport, WorkReportRow } from "../src/services/reports";
import { downloadAuthedFile } from "../src/utils/downloadFile";
import { WebDateField } from "../src/components/WebDateField";
import { WebModal, ModalActions } from "../src/components/WebModal";
import { useTheme } from "../src/theme/ThemeProvider";
import { useResponsive, getResponsiveSpacing } from "../src/utils/responsive";
import {
  BottomTabBar,
  BOTTOM_BAR_RESERVED_HEIGHT,
} from "../src/components/BottomTabBar";
import { User, hasRole } from "../src/types";
import { notify } from "../src/utils/confirm";

const isWeb = Platform.OS === "web";
type Period = "daily" | "weekly" | "monthly";

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayYMD = () => ymd(new Date());

/** [from, to] for the chosen period around an anchor date / month. */
function rangeFor(period: Period, anchor: string, month: string): [string, string] {
  if (period === "monthly") {
    const [y, m] = month.split("-").map(Number);
    if (!y || !m) return [todayYMD(), todayYMD()];
    return [`${month}-01`, ymd(new Date(y, m, 0))]; // day 0 of next month = last day
  }
  const d = new Date(`${anchor}T00:00:00`);
  if (period === "weekly") {
    const dow = (d.getDay() + 6) % 7; // Monday = 0
    const mon = new Date(d);
    mon.setDate(d.getDate() - dow);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return [ymd(mon), ymd(sun)];
  }
  return [anchor, anchor];
}

const prettyDay = (ymdStr: string) => {
  const d = new Date(`${ymdStr}T00:00:00`);
  if (isNaN(d.getTime())) return ymdStr;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

const TYPE_TONE: Record<string, string> = {
  OFFICE: "#2563EB",
  WFH: "#7C3AED",
  CLIENT: "#0EA5E9",
  LEAVE: "#F59E0B",
  HOLIDAY: "#64748B",
  ABSENT: "#DC2626",
};

export default function WorkReports() {
  const router = useRouter();
  // Optional focus on one employee (opened from their profile).
  const params = useLocalSearchParams<{ userId?: string; name?: string }>();
  const focusUserId =
    typeof params.userId === "string" && params.userId ? params.userId : undefined;
  const focusName =
    typeof params.name === "string" && params.name ? params.name : undefined;
  const { theme } = useTheme();
  const c = theme.colors;
  const responsive = useResponsive();
  const spacing = getResponsiveSpacing(responsive.breakpoint);
  const styles = useMemo(() => makeStyles(c), [c]);

  const [me, setMe] = useState<User | null>(null);
  const [period, setPeriod] = useState<Period>(focusUserId ? "monthly" : "daily");
  const [anchor, setAnchor] = useState<string>(todayYMD());
  const [month, setMonth] = useState<string>(todayYMD().slice(0, 7));
  const [rows, setRows] = useState<WorkReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<null | "xlsx" | "pdf">(null);
  // Which people to include. Empty (or all ticked) = everyone in scope.
  // When opened from an employee's profile, start focused on just them.
  const [picked, setPicked] = useState<Set<string>>(() =>
    focusUserId ? new Set([focusUserId]) : new Set()
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  const isHR = hasRole(me, "HR") || hasRole(me, "CEO");
  const base: "/hr/reports" | "/manager/reports" = isHR
    ? "/hr/reports"
    : "/manager/reports";

  const [fromDate, toDate] = useMemo(
    () => rangeFor(period, anchor, month),
    [period, anchor, month]
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const data = await getWorkReport(token, base, fromDate, toDate);
      setRows(data || []);
    } catch (err: any) {
      notify("Couldn't load report", err?.message || "");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [base, fromDate, toDate, router]);

  // resolve the user (decides HR vs manager scope), then load.
  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      try {
        setMe(await getMe(token));
      } catch {
        /* fall back to manager scope */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (me) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, fromDate, toDate]);

  const onDownload = async (fmt: "xlsx" | "pdf") => {
    if (downloading) return;
    try {
      setDownloading(fmt);
      const ids = everyone ? "" : [...picked].join(",");
      const path =
        `${base}/work/export.${fmt}` +
        `?fromDate=${fromDate}&toDate=${toDate}&period=${period}` +
        (ids ? `&userIds=${encodeURIComponent(ids)}` : "");
      await downloadAuthedFile(path, `work-report-${fromDate}_${toDate}.${fmt}`);
    } catch (err: any) {
      notify("Download failed", err?.message || "");
    } finally {
      setDownloading(null);
    }
  };

  // Distinct people present in the loaded range (only those with records).
  const people = useMemo(() => {
    const m = new Map<string, { userId: string; name: string; code: string }>();
    for (const r of rows) {
      if (r.userId && !m.has(r.userId)) {
        m.set(r.userId, { userId: r.userId, name: r.name, code: r.employeeCode });
      }
    }
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  // None ticked, or all of a non-empty list ticked → treat as "everyone".
  const everyone =
    picked.size === 0 || (people.length > 0 && picked.size >= people.length);

  const visibleRows = useMemo(
    () =>
      everyone ? rows : rows.filter((r) => r.userId && picked.has(r.userId)),
    [rows, picked, everyone]
  );

  const togglePick = (id: string) =>
    setPicked((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const totalHours = useMemo(
    () => visibleRows.reduce((s, r) => s + (Number(r.hours) || 0), 0),
    [visibleRows]
  );
  const rangeLabel =
    fromDate === toDate ? prettyDay(fromDate) : `${prettyDay(fromDate)} – ${prettyDay(toDate)}`;

  const bottomPadding = responsive.showSidebar
    ? 40
    : BOTTOM_BAR_RESERVED_HEIGHT + 24;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.padding,
          paddingBottom: bottomPadding,
          ...(responsive.isDesktop && {
            maxWidth: 900,
            alignSelf: "center" as const,
            width: "100%",
          }),
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/")
            }
            style={styles.iconBtn}
          >
            <Ionicons name="chevron-back" size={22} color={c.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.title}>Work Reports</Text>
            <Text style={styles.subtitle}>
              {focusName || (isHR ? "All employees" : "My team")} · who worked,
              when, and on what
            </Text>
          </View>
        </View>

        {/* Period */}
        <View style={styles.segment}>
          {(["daily", "weekly", "monthly"] as Period[]).map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.segBtn, period === p && styles.segBtnOn]}
              onPress={() => setPeriod(p)}
              activeOpacity={0.85}
            >
              <Text style={[styles.segText, period === p && styles.segTextOn]}>
                {p[0].toUpperCase() + p.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Date / month control */}
        <View style={styles.pickRow}>
          <Ionicons name="calendar-outline" size={18} color={c.textMuted} />
          {period === "monthly" ? (
            <TextInput
              style={styles.pickInput}
              value={month}
              onChangeText={setMonth}
              placeholder="YYYY-MM"
              placeholderTextColor={c.textFaint}
              autoCapitalize="none"
            />
          ) : isWeb ? (
            <WebDateField
              mode="date"
              value={anchor}
              onChange={(v) => v && setAnchor(v)}
            />
          ) : (
            <TextInput
              style={styles.pickInput}
              value={anchor}
              onChangeText={setAnchor}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={c.textFaint}
              autoCapitalize="none"
            />
          )}
          <Text style={styles.rangeLabel}>{rangeLabel}</Text>
        </View>

        {/* Who to include */}
        <TouchableOpacity
          style={styles.peopleRow}
          onPress={() => setPickerOpen(true)}
          activeOpacity={0.85}
          disabled={people.length === 0}
        >
          <Ionicons name="people-outline" size={18} color={c.textMuted} />
          <Text style={styles.peopleText}>
            {everyone
              ? isHR
                ? "All employees"
                : "My team"
              : `${picked.size} ${picked.size === 1 ? "person" : "people"} selected`}
          </Text>
          <Ionicons
            name="chevron-down"
            size={16}
            color={c.textMuted}
            style={{ marginLeft: "auto" }}
          />
        </TouchableOpacity>

        {/* Summary + downloads */}
        <View style={styles.summaryCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sumBig}>{visibleRows.length}</Text>
            <Text style={styles.sumLabel}>
              records · {totalHours.toFixed(1)} h total
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.dlBtn, styles.dlXlsx, downloading && { opacity: 0.6 }]}
            onPress={() => onDownload("xlsx")}
            disabled={!!downloading || visibleRows.length === 0}
          >
            <Ionicons name="grid-outline" size={16} color="#fff" />
            <Text style={styles.dlText}>
              {downloading === "xlsx" ? "…" : "Excel"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.dlBtn, styles.dlPdf, downloading && { opacity: 0.6 }]}
            onPress={() => onDownload("pdf")}
            disabled={!!downloading || visibleRows.length === 0}
          >
            <Ionicons name="document-text-outline" size={16} color="#fff" />
            <Text style={styles.dlText}>
              {downloading === "pdf" ? "…" : "PDF"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Preview */}
        {loading ? (
          <ActivityIndicator
            color={c.accent}
            style={{ paddingVertical: 40 }}
          />
        ) : visibleRows.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="reader-outline" size={36} color={c.textMuted} />
            <Text style={styles.emptyText}>
              {rows.length === 0
                ? "No attendance records in this period."
                : "No records for the selected people."}
            </Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            <Text style={styles.previewHint}>Preview</Text>
            {visibleRows.map((r, i) => (
              <View key={`${r.employeeCode}-${r.date}-${i}`} style={styles.row}>
                <View style={styles.rowTop}>
                  <Text style={styles.rName} numberOfLines={1}>
                    {r.name}
                    {r.employeeCode ? (
                      <Text style={styles.rCode}>  ·  {r.employeeCode}</Text>
                    ) : null}
                  </Text>
                  <Text style={styles.rDate}>
                    {prettyDay(r.date)} {r.day ? `(${r.day})` : ""}
                  </Text>
                </View>
                <View style={styles.rowMid}>
                  <Text style={styles.rTimes}>
                    {(r.checkIn || "—")} → {(r.checkOut || "—")}
                  </Text>
                  <Text style={styles.rHours}>{Number(r.hours).toFixed(1)} h</Text>
                  <View
                    style={[
                      styles.typePill,
                      { backgroundColor: (TYPE_TONE[r.type] || c.textMuted) + "22" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeText,
                        { color: TYPE_TONE[r.type] || c.textMuted },
                      ]}
                    >
                      {r.type || r.status}
                    </Text>
                  </View>
                </View>
                {!!r.workNotes && (
                  <Text style={styles.rNotes} numberOfLines={4}>
                    {r.workNotes}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <WebModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Choose people"
        subtitle={`Download the report for specific ${isHR ? "employees" : "team members"}`}
      >
        <Text style={styles.pickerHint}>
          Tick the people to include — or leave all unticked for{" "}
          {isHR ? "everyone" : "the whole team"}.
        </Text>

        <TouchableOpacity
          style={styles.pickAll}
          onPress={() =>
            setPicked((prev) =>
              prev.size >= people.length
                ? new Set()
                : new Set(people.map((p) => p.userId))
            )
          }
          activeOpacity={0.8}
        >
          <Ionicons
            name={
              people.length > 0 && picked.size >= people.length
                ? "checkbox"
                : "square-outline"
            }
            size={20}
            color={c.accent}
          />
          <Text style={styles.pickAllText}>Select all</Text>
        </TouchableOpacity>

        <ScrollView style={{ maxHeight: 340 }}>
          {people.map((p) => {
            const on = picked.has(p.userId);
            return (
              <TouchableOpacity
                key={p.userId}
                style={styles.pickRowItem}
                onPress={() => togglePick(p.userId)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={on ? "checkbox" : "square-outline"}
                  size={20}
                  color={on ? c.accent : c.textMuted}
                />
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={styles.pickName} numberOfLines={1}>
                    {p.name}
                  </Text>
                  {!!p.code && <Text style={styles.pickCode}>{p.code}</Text>}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <ModalActions align="spread">
          <TouchableOpacity onPress={() => setPicked(new Set())} activeOpacity={0.8}>
            <Text style={styles.pickClear}>Clear</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.pickDoneBtn}
            onPress={() => setPickerOpen(false)}
            activeOpacity={0.85}
          >
            <Text style={styles.pickDoneText}>
              {everyone ? "Use everyone" : `Use ${picked.size} selected`}
            </Text>
          </TouchableOpacity>
        </ModalActions>
      </WebModal>

      <BottomTabBar user={me} />
    </SafeAreaView>
  );
}

const makeStyles = (c: any) =>
  StyleSheet.create({
    safe: { flex: 1 },
    headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
    iconBtn: {
      width: 42,
      height: 42,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      backgroundColor: c.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    title: { fontSize: 24, fontWeight: "800", color: c.text },
    subtitle: { fontSize: 12.5, marginTop: 2, color: c.textMuted },

    segment: {
      flexDirection: "row",
      backgroundColor: c.surfaceMuted,
      borderRadius: 12,
      padding: 4,
      gap: 4,
      marginBottom: 12,
    },
    segBtn: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 9 },
    segBtnOn: { backgroundColor: c.accent },
    segText: { color: c.textMuted, fontSize: 13, fontWeight: "800" },
    segTextOn: { color: "#fff" },

    pickRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      borderRadius: 12,
      paddingHorizontal: 12,
      height: 46,
      marginBottom: 12,
    },
    pickInput: { flex: 1, color: c.text, fontSize: 14, padding: 0 },
    rangeLabel: { color: c.textMuted, fontSize: 12.5, fontWeight: "700" },

    summaryCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      borderRadius: 16,
      padding: 14,
      marginBottom: 16,
    },
    sumBig: { color: c.text, fontSize: 22, fontWeight: "900" },
    sumLabel: { color: c.textMuted, fontSize: 11.5, marginTop: 1, fontWeight: "600" },
    dlBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 11,
      ...(Platform.OS === "web" ? { cursor: "pointer" as any } : {}),
    },
    dlXlsx: { backgroundColor: "#16a34a" },
    dlPdf: { backgroundColor: "#10305F" },
    dlText: { color: "#fff", fontWeight: "800", fontSize: 13 },

    previewHint: {
      color: c.textMuted,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1,
      marginBottom: 2,
    },
    row: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      borderRadius: 14,
      padding: 12,
    },
    rowTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    rName: { color: c.text, fontSize: 14, fontWeight: "800", flexShrink: 1 },
    rCode: { color: c.textMuted, fontSize: 12, fontWeight: "600" },
    rDate: { color: c.textMuted, fontSize: 12, fontWeight: "700" },
    rowMid: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
    rTimes: { color: c.text, fontSize: 13, fontWeight: "600" },
    rHours: { color: c.accent, fontSize: 13, fontWeight: "800" },
    typePill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      marginLeft: "auto",
    },
    typeText: { fontSize: 10.5, fontWeight: "800" },
    rNotes: {
      color: c.textMuted,
      fontSize: 12.5,
      lineHeight: 17,
      marginTop: 8,
    },

    empty: { alignItems: "center", paddingVertical: 46, gap: 12 },
    emptyText: { color: c.textMuted, fontSize: 13, fontWeight: "600" },

    peopleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      borderRadius: 12,
      paddingHorizontal: 12,
      height: 46,
      marginBottom: 16,
      ...(Platform.OS === "web" ? { cursor: "pointer" as any } : {}),
    },
    peopleText: { color: c.text, fontSize: 14, fontWeight: "700" },

    pickerHint: { color: c.textMuted, fontSize: 13, marginBottom: 12, lineHeight: 18 },
    pickAll: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: c.surfaceBorder,
      marginBottom: 4,
      ...(Platform.OS === "web" ? { cursor: "pointer" as any } : {}),
    },
    pickAllText: { color: c.text, fontSize: 14, fontWeight: "800" },
    pickRowItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
      ...(Platform.OS === "web" ? { cursor: "pointer" as any } : {}),
    },
    pickName: { color: c.text, fontSize: 14, fontWeight: "700" },
    pickCode: { color: c.textMuted, fontSize: 12, marginTop: 1 },
    pickClear: { color: c.textMuted, fontSize: 14, fontWeight: "700" },
    pickDoneBtn: {
      backgroundColor: c.accent,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 11,
      ...(Platform.OS === "web" ? { cursor: "pointer" as any } : {}),
    },
    pickDoneText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  });
