import React, { useState, useMemo } from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../src/theme/ThemeProvider";
import { DatePickerField } from "../src/components/DatePickerField";
import {
  attendanceReport,
  leaveReport,
  payrollReport,
  departmentsReport,
  attritionReport,
  downloadAttendanceXlsx,
  downloadLeaveRequestsXlsx,
  downloadPayrollXlsx,
  downloadUsersXlsx,
  DownloadResult } from "../src/services/reports";

type ReportKey =
  | "attendance"
  | "leave"
  | "payroll"
  | "departments"
  | "attrition";

interface ReportDef {
  key: ReportKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  accent: string;
  blurb: string;
}

const todayYMD = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
};

const firstOfMonthYMD = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-01`;
};

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Pretty-format a value for the results card. Dates are short, booleans
// become Yes/No, numbers stay raw, objects/arrays get a compact summary.
const formatReportValue = (v: unknown): string => {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return "—";
    return Number.isInteger(v) ? String(v) : v.toFixed(2);
  }
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) {
      try {
        return new Date(v).toLocaleString([], {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit" });
      } catch {
        return v;
      }
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      try {
        return new Date(`${v}T00:00:00`).toLocaleDateString([], {
          year: "numeric",
          month: "short",
          day: "numeric" });
      } catch {
        return v;
      }
    }
    return v;
  }
  if (Array.isArray(v)) return `${v.length} item${v.length === 1 ? "" : "s"}`;
  if (typeof v === "object") {
    const n = Object.keys(v as object).length;
    return `${n} field${n === 1 ? "" : "s"}`;
  }
  return String(v);
};

const humanizeKey = (k: string) =>
  k
    .replace(/_/g, " ")
    .replace(/([A-Z])/g, " $1")
    .trim()
    .toLowerCase();

// Cross-platform XLSX save. Web → anchor download. Native → fall back
// to an info alert because we don't have expo-file-system wired up.
const saveXlsx = async (result: DownloadResult) => {
  if (Platform.OS === "web") {
    // @ts-ignore — web-only
    const url = URL.createObjectURL(result.blob);
    // @ts-ignore — web-only
    const a = document.createElement("a");
    a.href = url;
    a.download = result.fileName;
    // @ts-ignore
    document.body.appendChild(a);
    a.click();
    // @ts-ignore
    document.body.removeChild(a);
    // @ts-ignore
    URL.revokeObjectURL(url);
    return;
  }
  Alert.alert(
    "XLSX downloaded",
    `${result.fileName} (${Math.round(result.blob.size / 1024)} KB). ` +
      "To save the file, open this in the web app — RN doesn't currently " +
      "have file-save support wired up."
  );
};

export default function HrReports() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);

  // The five built-in reports. Each carries its own icon + tint so the
  // tab strip reads as a glanceable category picker, not a row of text.
  const REPORTS: ReportDef[] = useMemo(
    () => [
      {
        key: "attendance",
        label: "Attendance",
        icon: "calendar-outline",
        tint: c.pastelLavender,
        accent: "#6d28d9",
        blurb: "Daily check-ins, hours, and statuses per employee for a date range." },
      {
        key: "leave",
        label: "Leave",
        icon: "airplane-outline",
        tint: c.pastelMint,
        accent: "#15803d",
        blurb: "Year-to-date leave balances and consumption across all leave types." },
      {
        key: "payroll",
        label: "Payroll",
        icon: "cash-outline",
        tint: c.pastelPeach,
        accent: "#c2410c",
        blurb: "Generated payslips for a specific month — net pay, deductions, LOP." },
      {
        key: "departments",
        label: "Departments",
        icon: "business-outline",
        tint: c.pastelSky,
        accent: "#0369a1",
        blurb: "Headcount and managers per department." },
      {
        key: "attrition",
        label: "Attrition",
        icon: "exit-outline",
        tint: c.pastelPink,
        accent: "#be185d",
        blurb: "Exits in a given window with exit type and notice period." },
    ],
    [c]
  );

  const [activeReport, setActiveReport] = useState<ReportKey>("attendance");
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [hasRun, setHasRun] = useState(false);

  // Filters
  const [fromDate, setFromDate] = useState(firstOfMonthYMD());
  const [toDate, setToDate] = useState(todayYMD());
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));

  const active = REPORTS.find((r) => r.key === activeReport) || REPORTS[0];

  const runReport = async () => {
    setLoading(true);
    setRows([]);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      let data: any[] = [];
      if (activeReport === "attendance") {
        data = await attendanceReport(token, fromDate, toDate);
      } else if (activeReport === "leave") {
        data = await leaveReport(token, parseInt(year, 10));
      } else if (activeReport === "payroll") {
        data = await payrollReport(
          token,
          parseInt(year, 10),
          parseInt(month, 10)
        );
      } else if (activeReport === "departments") {
        data = await departmentsReport(token);
      } else if (activeReport === "attrition") {
        data = await attritionReport(token, fromDate, toDate);
      }
      setRows(data || []);
      setHasRun(true);
    } catch (err: any) {
      Alert.alert("Report failed", err?.message || "");
    } finally {
      setLoading(false);
    }
  };

  const onDownload = async (which: string) => {
    setDownloading(which);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      let result: DownloadResult;
      if (which === "users") {
        result = await downloadUsersXlsx(token);
      } else if (which === "attendance") {
        result = await downloadAttendanceXlsx(token, fromDate, toDate);
      } else if (which === "leaves") {
        result = await downloadLeaveRequestsXlsx(token);
      } else if (which === "payroll") {
        result = await downloadPayrollXlsx(
          token,
          parseInt(year, 10),
          parseInt(month, 10)
        );
      } else {
        return;
      }
      await saveXlsx(result);
    } catch (err: any) {
      Alert.alert("Download failed", err?.message || "");
    } finally {
      setDownloading(null);
    }
  };

  // Human-readable summary of the current filter set — shown above
  // results so it's obvious what window the data is from.
  const periodLabel = (() => {
    if (activeReport === "attendance" || activeReport === "attrition") {
      return `${fromDate} → ${toDate}`;
    }
    if (activeReport === "leave") return `Year ${year}`;
    if (activeReport === "payroll") {
      const mIdx = (parseInt(month, 10) || 1) - 1;
      const mName = MONTH_NAMES[mIdx] || month;
      return `${mName} ${year}`;
    }
    return "Current snapshot";
  })();

  const reportHasXlsx =
    activeReport === "attendance" || activeReport === "payroll";

  return (
    <SafeAreaView style={styles.safe}>
      {/* ===== HEADER ===== */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/")
          }
          style={styles.iconBack}
        >
          <Ionicons name="chevron-back" size={22} color={c.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Reports</Text>
          <Text style={styles.subtitle}>
            Run, view, and export HR data
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: 30 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ===== REPORT TYPE TABS ===== */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabRow}
        >
          {REPORTS.map((r) => {
            const isActive = r.key === activeReport;
            return (
              <TouchableOpacity
                key={r.key}
                style={[
                  styles.tabCard,
                  isActive && {
                    borderColor: r.accent,
                    backgroundColor: r.tint },
                ]}
                onPress={() => {
                  setActiveReport(r.key);
                  setRows([]);
                  setHasRun(false);
                }}
                activeOpacity={0.85}
              >
                <View
                  style={[
                    styles.tabIcon,
                    {
                      backgroundColor: isActive ? "#ffffff" : r.tint },
                  ]}
                >
                  <Ionicons name={r.icon} size={18} color={r.accent} />
                </View>
                <Text
                  style={[
                    styles.tabLabel,
                    { color: isActive ? r.accent : c.text },
                  ]}
                >
                  {r.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ===== FILTER + ACTION CARD ===== */}
        <View style={styles.filterCard}>
          <View style={styles.filterHeader}>
            <View
              style={[
                styles.filterIcon,
                { backgroundColor: active.tint },
              ]}
            >
              <Ionicons name={active.icon} size={18} color={active.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.filterTitle}>{active.label} report</Text>
              <Text style={styles.filterBlurb}>{active.blurb}</Text>
            </View>
          </View>

          {/* Date-range filter (attendance + attrition) */}
          {(activeReport === "attendance" || activeReport === "attrition") && (
            <View style={styles.filterRow}>
              <View style={styles.filterField}>
                <Text style={styles.label}>From</Text>
                <DatePickerField
                  value={fromDate}
                  onChange={setFromDate}
                  max={toDate || undefined}
                />
              </View>
              <View style={styles.filterField}>
                <Text style={styles.label}>To</Text>
                <DatePickerField
                  value={toDate}
                  onChange={setToDate}
                  min={fromDate || undefined}
                  max={todayYMD()}
                />
              </View>
            </View>
          )}

          {/* Year filter (leave) */}
          {activeReport === "leave" && (
            <View style={styles.filterRow}>
              <View style={styles.filterField}>
                <Text style={styles.label}>Year</Text>
                <TextInput
                  style={styles.input}
                  value={year}
                  onChangeText={setYear}
                  keyboardType="number-pad"
                  placeholderTextColor={c.textFaint}
                  maxLength={4}
                />
              </View>
            </View>
          )}

          {/* Month + Year filter (payroll) — month picker chip strip is
              easier to use on a phone than typing 1..12. */}
          {activeReport === "payroll" && (
            <>
              <View style={styles.filterRow}>
                <View style={styles.filterField}>
                  <Text style={styles.label}>Year</Text>
                  <TextInput
                    style={styles.input}
                    value={year}
                    onChangeText={setYear}
                    keyboardType="number-pad"
                    placeholderTextColor={c.textFaint}
                    maxLength={4}
                  />
                </View>
              </View>
              <Text style={[styles.label, { marginTop: 12 }]}>Month</Text>
              <View style={styles.monthGrid}>
                {MONTH_NAMES.map((name, idx) => {
                  const m = idx + 1;
                  const isSel = parseInt(month, 10) === m;
                  return (
                    <TouchableOpacity
                      key={name}
                      style={[
                        styles.monthChip,
                        isSel && {
                          backgroundColor: active.tint,
                          borderColor: active.accent },
                      ]}
                      onPress={() => setMonth(String(m))}
                    >
                      <Text
                        style={[
                          styles.monthChipText,
                          { color: isSel ? active.accent : c.textMuted },
                        ]}
                      >
                        {name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* Departments has no filters — show a note so the empty
              filter area doesn't look like a bug. */}
          {activeReport === "departments" && (
            <View style={styles.noFilterNote}>
              <Ionicons
                name="information-circle-outline"
                size={14}
                color={c.textMuted}
              />
              <Text style={styles.noFilterText}>
                No filters — this report returns the current org snapshot.
              </Text>
            </View>
          )}

          {/* Action row — Run + XLSX side by side. XLSX hidden when the
              report doesn't have an XLSX endpoint. */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[
                styles.runBtn,
                { backgroundColor: active.accent },
                loading && { opacity: 0.7 },
              ]}
              onPress={runReport}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="play" size={14} color="#fff" />
              )}
              <Text style={styles.runBtnText}>
                {loading ? "Loading…" : "Run report"}
              </Text>
            </TouchableOpacity>

            {reportHasXlsx && (
              <TouchableOpacity
                style={[
                  styles.xlsxBtn,
                  downloading === activeReport && { opacity: 0.6 },
                ]}
                onPress={() => onDownload(activeReport)}
                disabled={downloading === activeReport}
                activeOpacity={0.85}
              >
                {downloading === activeReport ? (
                  <ActivityIndicator size="small" color={c.text} />
                ) : (
                  <Ionicons
                    name="download-outline"
                    size={14}
                    color={c.text}
                  />
                )}
                <Text style={styles.xlsxBtnText}>XLSX</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ===== RESULTS SUMMARY STRIP ===== */}
        {hasRun && !loading && (
          <View style={styles.summary}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{rows.length}</Text>
              <Text style={styles.summaryLabel}>rows</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={[styles.summaryItem, { flex: 2 }]}>
              <Text style={styles.summaryValue} numberOfLines={1}>
                {periodLabel}
              </Text>
              <Text style={styles.summaryLabel}>period</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{active.label}</Text>
              <Text style={styles.summaryLabel}>type</Text>
            </View>
          </View>
        )}

        {/* ===== RESULTS LIST ===== */}
        {rows.length > 0 && (
          <View style={{ marginTop: 12, gap: 8 }}>
            {rows.map((r, i) => {
              const entries =
                r && typeof r === "object"
                  ? Object.entries(r as Record<string, unknown>)
                  : [];
              return (
                <View key={i} style={styles.resultCard}>
                  <View style={styles.resultIndex}>
                    <Text style={styles.resultIndexText}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    {entries.length === 0 ? (
                      <Text style={styles.rowValue}>{String(r)}</Text>
                    ) : (
                      entries.map(([k, v]) => (
                        <View key={k} style={styles.rowField}>
                          <Text style={styles.rowKey}>{humanizeKey(k)}</Text>
                          <Text
                            style={styles.rowValue}
                            numberOfLines={2}
                          >
                            {formatReportValue(v)}
                          </Text>
                        </View>
                      ))
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ===== EMPTY STATES ===== */}
        {!hasRun && !loading && (
          <View style={styles.empty}>
            <View
              style={[styles.emptyIcon, { backgroundColor: active.tint }]}
            >
              <Ionicons
                name={active.icon}
                size={28}
                color={active.accent}
              />
            </View>
            <Text style={styles.emptyTitle}>
              Run a {active.label.toLowerCase()} report
            </Text>
            <Text style={styles.emptyBody}>{active.blurb}</Text>
          </View>
        )}
        {hasRun && rows.length === 0 && !loading && (
          <View style={styles.empty}>
            <View
              style={[styles.emptyIcon, { backgroundColor: c.surfaceMuted }]}
            >
              <Ionicons
                name="document-outline"
                size={28}
                color={c.textMuted}
              />
            </View>
            <Text style={styles.emptyTitle}>No rows returned</Text>
            <Text style={styles.emptyBody}>
              Try widening the date range or switching to another report.
            </Text>
          </View>
        )}

        {/* ===== OTHER EXPORTS ===== */}
        <Text style={styles.sectionHeader}>OTHER EXPORTS</Text>
        <Text style={styles.sectionBlurb}>
          Direct XLSX downloads — no filters required.
        </Text>
        <View style={styles.exportGrid}>
          <ExportTile
            icon="people-outline"
            label="All users"
            sub="Employee directory"
            tint={c.pastelSky}
            iconColor="#0369a1"
            loading={downloading === "users"}
            onPress={() => onDownload("users")}
            styles={styles}
          />
          <ExportTile
            icon="airplane-outline"
            label="Leave reqs"
            sub="Every request"
            tint={c.pastelMint}
            iconColor="#15803d"
            loading={downloading === "leaves"}
            onPress={() => onDownload("leaves")}
            styles={styles}
          />
          <ExportTile
            icon="calendar-outline"
            label="Attendance"
            sub={`${fromDate} → ${toDate}`}
            tint={c.pastelLavender}
            iconColor="#6d28d9"
            loading={downloading === "attendance"}
            onPress={() => onDownload("attendance")}
            styles={styles}
          />
          <ExportTile
            icon="cash-outline"
            label="Payroll"
            sub={`${MONTH_NAMES[parseInt(month, 10) - 1] || month} ${year}`}
            tint={c.pastelPeach}
            iconColor="#c2410c"
            loading={downloading === "payroll"}
            onPress={() => onDownload("payroll")}
            styles={styles}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Reused tile for the "Other Exports" grid.
const ExportTile = ({
  icon,
  label,
  sub,
  tint,
  iconColor,
  loading,
  onPress,
  styles }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub: string;
  tint: string;
  iconColor: string;
  loading: boolean;
  onPress: () => void;
  styles: any;
}) => (
  <TouchableOpacity
    style={[styles.exportTile, loading && { opacity: 0.6 }]}
    onPress={onPress}
    disabled={loading}
    activeOpacity={0.85}
  >
    <View style={[styles.exportIcon, { backgroundColor: tint }]}>
      {loading ? (
        <ActivityIndicator size="small" color={iconColor} />
      ) : (
        <Ionicons name={icon} size={18} color={iconColor} />
      )}
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.exportLabel}>{label}</Text>
      <Text style={styles.exportSub} numberOfLines={1}>
        {sub}
      </Text>
    </View>
    <Ionicons name="download-outline" size={16} color={iconColor} />
  </TouchableOpacity>
);

const makeStyles = (c: any) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 10,
      borderBottomWidth: 1,
      borderBottomColor: c.surfaceBorder },
    iconBack: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      alignItems: "center",
      justifyContent: "center" },
    title: { color: c.text, fontSize: 18, fontWeight: "800" },
    subtitle: { color: c.textMuted, fontSize: 12, marginTop: 2 },

    // Tabs — category cards w/ icon + label
    tabRow: {
      flexDirection: "row",
      gap: 8,
      paddingVertical: 6,
      paddingHorizontal: 2 },
    tabCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: c.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.surfaceBorder },
    tabIcon: {
      width: 28,
      height: 28,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center" },
    tabLabel: { fontSize: 12, fontWeight: "800" },

    // Filter + action card
    filterCard: {
      marginTop: 14,
      padding: 14,
      backgroundColor: c.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      gap: 12 },
    filterHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12 },
    filterIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center" },
    filterTitle: { color: c.text, fontSize: 14, fontWeight: "800" },
    filterBlurb: {
      color: c.textMuted,
      fontSize: 11,
      marginTop: 2,
      lineHeight: 15 },
    filterRow: {
      flexDirection: "row",
      gap: 10 },
    filterField: { flex: 1 },
    label: {
      color: c.textMuted,
      fontSize: 10,
      letterSpacing: 1.2,
      fontWeight: "800",
      marginBottom: 6 },
    input: {
      backgroundColor: c.surfaceMuted,
      color: c.text,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      fontSize: 14,
      fontWeight: "600" },

    monthGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6 },
    monthChip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 10,
      backgroundColor: c.surfaceMuted,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      minWidth: 56,
      alignItems: "center" },
    monthChipText: { fontSize: 12, fontWeight: "700" },

    noFilterNote: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 9,
      backgroundColor: c.surfaceMuted,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.surfaceBorder },
    noFilterText: { color: c.textMuted, fontSize: 11, flex: 1 },

    actions: {
      flexDirection: "row",
      gap: 8,
      marginTop: 4 },
    runBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 12,
      borderRadius: 12,
      gap: 8 },
    runBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
    xlsxBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 12,
      gap: 6,
      backgroundColor: c.surfaceMuted,
      borderWidth: 1,
      borderColor: c.surfaceBorder },
    xlsxBtnText: { color: c.text, fontWeight: "800", fontSize: 13 },

    // Summary strip
    summary: {
      marginTop: 14,
      flexDirection: "row",
      alignItems: "stretch",
      backgroundColor: c.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      paddingVertical: 10 },
    summaryItem: {
      flex: 1,
      alignItems: "center",
      paddingHorizontal: 6 },
    summaryValue: {
      color: c.text,
      fontSize: 14,
      fontWeight: "800" },
    summaryLabel: {
      color: c.textMuted,
      fontSize: 10,
      marginTop: 2,
      letterSpacing: 0.8,
      textTransform: "uppercase" },
    summaryDivider: { width: 1, backgroundColor: c.surfaceBorder },

    // Result cards
    resultCard: {
      flexDirection: "row",
      gap: 12,
      padding: 12,
      backgroundColor: c.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.surfaceBorder },
    resultIndex: {
      width: 26,
      height: 26,
      borderRadius: 8,
      backgroundColor: c.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: c.surfaceBorder },
    resultIndexText: {
      color: c.textMuted,
      fontSize: 11,
      fontWeight: "800" },
    rowField: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 12 },
    rowKey: {
      color: c.textMuted,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.3,
      textTransform: "capitalize",
      flex: 0,
      minWidth: 110 },
    rowValue: {
      color: c.text,
      fontSize: 12,
      fontWeight: "600",
      flex: 1,
      textAlign: "right" },

    // Empty states
    empty: {
      marginTop: 22,
      paddingVertical: 28,
      paddingHorizontal: 22,
      alignItems: "center",
      gap: 10 },
    emptyIcon: {
      width: 60,
      height: 60,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center" },
    emptyTitle: {
      color: c.text,
      fontSize: 15,
      fontWeight: "800",
      textAlign: "center" },
    emptyBody: {
      color: c.textMuted,
      fontSize: 12,
      textAlign: "center",
      lineHeight: 17 },

    // Other exports section
    sectionHeader: {
      color: c.textMuted,
      fontSize: 10,
      letterSpacing: 1.5,
      fontWeight: "800",
      marginTop: 26 },
    sectionBlurb: {
      color: c.textMuted,
      fontSize: 11,
      marginTop: 4,
      marginBottom: 10 },
    exportGrid: { gap: 8 },
    exportTile: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 12,
      backgroundColor: c.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.surfaceBorder },
    exportIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center" },
    exportLabel: { color: c.text, fontSize: 13, fontWeight: "800" },
    exportSub: {
      color: c.textMuted,
      fontSize: 11,
      marginTop: 2 } });
