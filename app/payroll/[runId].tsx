import React, {
  useEffect,
  useState, useMemo} from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  TextInput,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { WebModal, ModalActions } from "../../src/components/WebModal";

import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  useRouter,
  useLocalSearchParams,
} from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import {
  hrGetPayrollRun,
  hrProcessPayrollRun,
  hrLockPayrollRun,
  hrEmailAllPayslips,
  hrListPayslipsForRun,
  hrEmailPayslip,
  hrPayslipPdfUrl,
  hrUpdatePayslip,
  hrSendPayslip,
  hrSendAllPayslips,
} from "../../src/services/payroll";

import { downloadPdfWithAuth } from "../../src/utils/download";

import { PayrollRun, Payslip, LeaveRequest } from "../../src/types";
import { hrListAttendance } from "../../src/services/hrAttendance";
import { listHolidays } from "../../src/services/holidays";
import { hrListLeaveRequests } from "../../src/services/leaves";
import { AttendanceCalendar } from "../../src/components/AttendanceCalendar";

import { useTheme } from "../../src/theme/ThemeProvider";
import { formatDays } from "../../src/utils/leaveDays";
import { ATT, ATT_BG } from "../../src/theme/attendanceColors";
import { notify, notifySuccess } from "../../src/utils/confirm";
const monthLabel = (year: number, month: number) =>
  new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

// Friendly names for the leave codes stored on leave attendance rows
// (workNotes are written as "<CODE> leave", e.g. "SL leave").
const LEAVE_NAMES: Record<string, string> = {
  SL: "Sick", SICK: "Sick",
  EL: "Earned", EARNED: "Earned",
  CL: "Casual", CASUAL: "Casual",
  ML: "Maternity", PL: "Paternity",
  COMP: "Comp-off", LOP: "Loss of pay",
};

const pad2 = (n: number) => String(n).padStart(2, "0");
const ymdOf = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

// The WORKING dates of a leave that fall within the given year/month
// (inclusive) — Sundays (weekly off) and declared holidays are skipped so a
// leave spanning a weekend/holiday isn't over-counted.
const leaveDatesInMonth = (
  l: LeaveRequest,
  year: number,
  month: number,
  holidayMap: Record<string, string> = {}
): string[] => {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  const from = new Date(`${l.fromDate}T00:00:00`);
  const to = new Date(`${l.toDate || l.fromDate}T00:00:00`);
  const start = from > monthStart ? from : monthStart;
  const end = to < monthEnd ? to : monthEnd;
  const out: string[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 0) continue; // Sunday = weekly off
    const key = ymdOf(d);
    if (holidayMap[key]) continue; // declared holiday
    out.push(key);
  }
  return out;
};

export default function HRPayrollRun() {

  const router = useRouter();

  const { theme } = useTheme();

  const c = theme.colors;

  const s = useMemo(() => makeStyles(c), [c]);
  const params = useLocalSearchParams();
  const runId = params.runId as string;

  const [run, setRun] = useState<PayrollRun | null>(null);
  const [items, setItems] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [emailingId, setEmailingId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  // Per-payslip working-days edit
  const [editPayslip, setEditPayslip] = useState<Payslip | null>(null);
  const [editWorkingDays, setEditWorkingDays] = useState("");
  const [editAttendedDays, setEditAttendedDays] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // The opened employee's attendance for the payroll month — powers the
  // calendar HR reviews alongside the days figures.
  const [calRows, setCalRows] = useState<any[]>([]);
  const [calLoading, setCalLoading] = useState(false);
  const [holidayMap, setHolidayMap] = useState<Record<string, string>>({});
  const [monthLeaves, setMonthLeaves] = useState<LeaveRequest[]>([]);


  // Routed through the shared toast host rather than an in-screen View:
  // a screen-level popup renders BEHIND any open modal, so errors raised
  // from inside a dialog were invisible. See components/ModalToastHost.
  const showPopup = (
    msg: string,
    kind: "success" | "error" = "success"
  ) => {
    if (kind === "error") notify(msg);
    else notifySuccess(msg);
  };

  const load = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const [r, list] = await Promise.all([
        hrGetPayrollRun(token, runId),
        hrListPayslipsForRun(token, runId).catch(() => []),
      ]);
      setRun(r);
      setItems(list || []);
    } catch (err: any) {
      showPopup(err?.message || "Failed to load", "error");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [runId]);

  const process = async () => {
    if (!run || busy) return;
    try {
      setBusy(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const r = await hrProcessPayrollRun(token, run.id);
      showPopup(
        `Generated ${r.generated} · Skipped ${r.skipped}`
      );
      await load();
    } catch (err: any) {
      showPopup(err?.message || "Failed to process", "error");
    } finally {
      setBusy(false);
    }
  };

  const lock = async () => {
    if (!run || busy) return;
    const ask = (msg: string): Promise<boolean> => {
      if (Platform.OS === "web") {
        return Promise.resolve(
          typeof window !== "undefined" && window.confirm(msg)
        );
      }
      return new Promise((resolve) => {
        Alert.alert("Lock run?", msg, [
          { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
          { text: "Lock", onPress: () => resolve(true) },
        ]);
      });
    };
    if (
      !(await ask(
        "Once locked, payslips can no longer be overridden."
      ))
    )
      return;

    try {
      setBusy(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await hrLockPayrollRun(token, run.id);
      showPopup("Locked");
      await load();
    } catch (err: any) {
      showPopup(err?.message || "Failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const emailAll = async () => {
    if (!run || busy) return;
    try {
      setBusy(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const r = await hrEmailAllPayslips(token, run.id);
      showPopup(
        `Sent ${r.sentCount} · Failed ${r.failedCount} · Skipped ${r.skippedCount}`
      );
    } catch (err: any) {
      showPopup(err?.message || "Failed to email", "error");
    } finally {
      setBusy(false);
    }
  };

  const downloadPdf = async (p: Payslip) => {
    try {
      setDownloadingId(p.id);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const filename = `Payslip_${p.user?.name || "user"}_${p.year}_${String(p.month).padStart(2, "0")}.pdf`;
      await downloadPdfWithAuth(
        hrPayslipPdfUrl(p.id),
        token,
        filename
      );
    } catch (err: any) {
      showPopup(err?.message || "Failed", "error");
    } finally {
      setDownloadingId(null);
    }
  };

  const emailOne = async (p: Payslip) => {
    try {
      setEmailingId(p.id);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await hrEmailPayslip(token, p.id);
      showPopup(`Emailed to ${p.user?.email}`);
    } catch (err: any) {
      showPopup(err?.message || "Failed to email", "error");
    } finally {
      setEmailingId(null);
    }
  };

  // Releases a payslip to the employee — makes it visible in My Payslips
  // and notifies them. Distinct from "Email" (which sends the PDF).
  const sendOne = async (p: Payslip) => {
    try {
      setSendingId(p.id);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await hrSendPayslip(token, p.id);
      showPopup(`Payslip sent to ${p.user?.name || "employee"}`);
      await load();
    } catch (err: any) {
      showPopup(err?.message || "Failed to send", "error");
    } finally {
      setSendingId(null);
    }
  };

  const sendAll = async () => {
    try {
      setBusy(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const r = await hrSendAllPayslips(token, runId);
      showPopup(`Sent ${r.sentCount} payslip${r.sentCount === 1 ? "" : "s"}`);
      await load();
    } catch (err: any) {
      showPopup(err?.message || "Failed to send", "error");
    } finally {
      setBusy(false);
    }
  };

  const openEditDays = (p: Payslip) => {
    setEditPayslip(p);
    setEditWorkingDays(String(p.workingDays ?? ""));
    setEditAttendedDays(String(p.attendedDays ?? ""));
    loadEmployeeCalendar(p);
  };

  // Fetch the employee's day-by-day attendance for the payroll month so HR
  // can see exactly which days back the "attended" figure.
  const loadEmployeeCalendar = async (p: Payslip) => {
    setCalRows([]);
    setMonthLeaves([]);
    setCalLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const monthStr = `${p.year}-${String(p.month).padStart(2, "0")}`;
      const [att, hols, leaves] = await Promise.all([
        hrListAttendance(token, { userId: p.userId, month: monthStr }),
        listHolidays(token, { year: p.year }).catch(() => []),
        hrListLeaveRequests(token, "APPROVED").catch(() => [] as LeaveRequest[]),
      ]);
      const map: Record<string, string> = {};
      (hols || []).forEach((h: any) => { if (h?.date) map[h.date] = h.name || "Holiday"; });
      setHolidayMap(map);

      // This employee's approved leaves that fall in the payroll month.
      const mine = (leaves || []).filter(
        (l) => l.userId === p.userId && leaveDatesInMonth(l, p.year, p.month, map).length > 0
      );
      setMonthLeaves(mine);

      // Merge synthetic LEAVE rows for leave dates missing an attendance row,
      // so the calendar paints them "On leave" instead of "No record".
      const rows: any[] = [...(att || [])];
      const seen = new Set(rows.map((r: any) => r.date));
      mine.forEach((l) => {
        leaveDatesInMonth(l, p.year, p.month, map).forEach((date) => {
          if (seen.has(date)) return;
          seen.add(date);
          rows.push({
            id: `leave-${l.id}-${date}`,
            userId: p.userId,
            date,
            attendanceType: "LEAVE",
            status: "ON_LEAVE",
            checkIn: null,
            checkOut: null,
            workNotes: l.leaveType?.name || l.leaveTypeCode || "Leave",
          });
        });
      });
      setCalRows(rows);
    } catch {
      setCalRows([]);
    } finally {
      setCalLoading(false);
    }
  };

  // Leave taken in the payroll month, from the approved leave requests:
  // total days + a per-type breakdown (accurate names & half-day handling).
  const leaveSummary = useMemo(() => {
    const byType: Record<string, number> = {};
    let total = 0;
    if (!editPayslip) return { total, byType };
    monthLeaves.forEach((l) => {
      const dates = leaveDatesInMonth(l, editPayslip.year, editPayslip.month, holidayMap);
      if (!dates.length) return;
      const days = l.halfDay && dates.length === 1 ? 0.5 : dates.length;
      total += days;
      const name =
        l.leaveType?.name || LEAVE_NAMES[l.leaveTypeCode] || l.leaveTypeCode || "Leave";
      byType[name] = (byType[name] || 0) + days;
    });
    return { total, byType };
  }, [monthLeaves, editPayslip, holidayMap]);

  const saveEditDays = async () => {
    if (!editPayslip || savingEdit) return;
    const wd = parseFloat(editWorkingDays);
    const ad = parseFloat(editAttendedDays);
    if (Number.isNaN(wd) || wd <= 0) {
      showPopup("Working days must be > 0", "error");
      return;
    }
    if (Number.isNaN(ad) || ad < 0 || ad > wd) {
      showPopup("Attended days must be between 0 and working days", "error");
      return;
    }
    try {
      setSavingEdit(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await hrUpdatePayslip(token, editPayslip.id, {
        workingDays: wd,
        attendedDays: ad,
      } as any);
      showPopup("Working days updated");
      setEditPayslip(null);
      await load();
    } catch (err: any) {
      showPopup(err?.message || "Failed to update", "error");
    } finally {
      setSavingEdit(false);
    }
  };

  if (loading) {
    return (
      <View style={s.loader}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  if (!run) {
    return (
      <View style={s.loader}>
        <Text style={{ color: c.text }}>Run not found</Text>
      </View>
    );
  }

  const statusColor = (st: string) =>
    st === "LOCKED"
      ? "#16a34a"
      : st === "PROCESSED"
      ? "#2563eb"
      : "#f59e0b";

  return (
    <SafeAreaView style={s.safe}>

      

      <ScrollView
        style={s.container}
        contentContainerStyle={s.content}
      >

        <View style={s.header}>
          <TouchableOpacity
            style={s.backBtn}
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          >
            <Ionicons name="chevron-back" size={22} color={c.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>
              {monthLabel(run.year, run.month)}
            </Text>
            <Text style={s.subtitle}>
              {run.workingDays} working days  ·  {items.length} payslips
            </Text>
          </View>
          <View
            style={[
              s.statusChip,
              { backgroundColor: statusColor(run.status) },
            ]}
          >
            <Text style={s.statusText}>{run.status}</Text>
          </View>
        </View>

        {/* RUN ACTIONS */}
        <View style={s.runActions}>
          {run.status !== "LOCKED" && (
            <TouchableOpacity
              style={s.processBtn}
              onPress={process}
              disabled={busy}
            >
              <Ionicons
                name="play-outline"
                size={16}
                color="#fff"
              />
              <Text style={s.actionText}>
                {run.status === "DRAFT" ? "Process" : "Re-process"}
              </Text>
            </TouchableOpacity>
          )}
          {run.status === "PROCESSED" && (
            <TouchableOpacity
              style={s.lockBtn}
              onPress={lock}
              disabled={busy}
            >
              <Ionicons
                name="lock-closed-outline"
                size={16}
                color="#fff"
              />
              <Text style={s.actionText}>Lock</Text>
            </TouchableOpacity>
          )}
          {items.length > 0 && (
            <TouchableOpacity
              style={s.sendAllBtn}
              onPress={sendAll}
              disabled={busy}
            >
              <Ionicons
                name="paper-plane-outline"
                size={16}
                color="#fff"
              />
              <Text style={s.actionText}>Send all</Text>
            </TouchableOpacity>
          )}
          {items.length > 0 && (
            <TouchableOpacity
              style={s.emailAllBtn}
              onPress={emailAll}
              disabled={busy}
            >
              <Ionicons
                name="mail-outline"
                size={16}
                color="#fff"
              />
              <Text style={s.actionText}>Email all</Text>
            </TouchableOpacity>
          )}
        </View>

        {items.length === 0 && (
          <View style={s.empty}>
            <Text style={s.emptyTitle}>
              No payslips yet
            </Text>
            <Text style={s.emptySub}>
              Tap Process to generate payslips for everyone with a salary structure.
            </Text>
          </View>
        )}

        {items.map((p) => (
          <View key={p.id} style={s.card}>
            <View style={s.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={s.cardName}>
                  {p.user?.name || "User"}
                </Text>
                <Text style={s.cardMeta}>
                  {p.user?.email}
                  {p.user?.employeeCode
                    ? `  ·  ${p.user.employeeCode}`
                    : ""}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={s.netPay}>
                  ₹ {p.netPay.toLocaleString("en-IN")}
                </Text>
                <View
                  style={[
                    s.sentChip,
                    {
                      backgroundColor: p.sent
                        ? "rgba(22,163,74,0.14)"
                        : "rgba(245,158,11,0.14)" },
                  ]}
                >
                  <Ionicons
                    name={p.sent ? "checkmark-circle" : "ellipse-outline"}
                    size={11}
                    color={p.sent ? "#16a34a" : "#f59e0b"}
                  />
                  <Text
                    style={[
                      s.sentChipText,
                      { color: p.sent ? "#16a34a" : "#f59e0b" },
                    ]}
                  >
                    {p.sent ? "Sent" : "Not sent"}
                  </Text>
                </View>
              </View>
            </View>

            <View style={s.metaRow}>
              <Text style={s.metaText}>
                Att {formatDays(p.attendedDays)}/{formatDays(p.workingDays)}
                {p.lopDays > 0 ? `  ·  LOP ${formatDays(p.lopDays)}d` : ""}
                {"  ·  "}
                Gross ₹{p.totalGross.toLocaleString("en-IN")}
                {"  ·  "}
                Ded ₹{p.totalDeductions.toLocaleString("en-IN")}
              </Text>
              {p.status === "OVERRIDDEN" && (
                <View style={s.overChip}>
                  <Text style={s.overText}>OVERRIDDEN</Text>
                </View>
              )}
            </View>

            <View style={s.payActions}>
              {run.status !== "LOCKED" && (
                <TouchableOpacity
                  style={[s.smallBtn, { backgroundColor: "#f59e0b" }]}
                  onPress={() => openEditDays(p)}
                >
                  <Ionicons
                    name="create-outline"
                    size={14}
                    color="#fff"
                  />
                  <Text style={s.smallBtnText}>Edit days</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[s.smallBtn, { backgroundColor: "#2563eb" }]}
                onPress={() => sendOne(p)}
                disabled={sendingId === p.id}
              >
                {sendingId === p.id ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons
                      name="paper-plane-outline"
                      size={14}
                      color="#fff"
                    />
                    <Text style={s.smallBtnText}>
                      {p.sent ? "Resend" : "Send"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={s.smallBtn}
                onPress={() => downloadPdf(p)}
                disabled={downloadingId === p.id}
              >
                {downloadingId === p.id ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons
                      name="download-outline"
                      size={14}
                      color="#fff"
                    />
                    <Text style={s.smallBtnText}>PDF</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  s.smallBtn,
                  { backgroundColor: "#0d9488" },
                ]}
                onPress={() => emailOne(p)}
                disabled={emailingId === p.id}
              >
                {emailingId === p.id ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons
                      name="mail-outline"
                      size={14}
                      color="#fff"
                    />
                    <Text style={s.smallBtnText}>Email</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ))}

      </ScrollView>

      <WebModal
        visible={!!editPayslip}
        onClose={() => setEditPayslip(null)}
        title="Attendance & working days"
        subtitle={
          editPayslip
            ? `${editPayslip.user?.name ?? ""}${
                editPayslip.user?.employeeCode
                  ? `  ·  ${editPayslip.user.employeeCode}`
                  : ""
              }`
            : undefined
        }
        size="lg"
        footer={
          <ModalActions align="spread">
            <TouchableOpacity
              style={s.modalCancel}
              onPress={() => setEditPayslip(null)}
            >
              <Text style={s.modalBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                s.modalSave,
                savingEdit && { opacity: 0.7 },
              ]}
              onPress={saveEditDays}
              disabled={savingEdit}
            >
              {savingEdit ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[s.modalBtnText, { color: "#fff" }]}>Save</Text>
              )}
            </TouchableOpacity>
          </ModalActions>
        }
      >
            {/* PREVIEW — current computed figures HR is reviewing. They
                recalculate from the days below when saved. */}
            {editPayslip && (
              <View style={s.previewBox}>
                <View style={s.previewRow}>
                  <Text style={s.previewLabel}>Gross</Text>
                  <Text style={s.previewValue}>
                    ₹ {editPayslip.totalGross.toLocaleString("en-IN")}
                  </Text>
                </View>
                <View style={s.previewRow}>
                  <Text style={s.previewLabel}>Deductions</Text>
                  <Text style={s.previewValue}>
                    ₹ {editPayslip.totalDeductions.toLocaleString("en-IN")}
                  </Text>
                </View>
                {editPayslip.lopDays > 0 && (
                  <View style={s.previewRow}>
                    <Text style={s.previewLabel}>
                      LOP ({formatDays(editPayslip.lopDays)}d)
                    </Text>
                    <Text style={s.previewValue}>
                      − ₹ {editPayslip.lopDeduction.toLocaleString("en-IN")}
                    </Text>
                  </View>
                )}
                <View style={[s.previewRow, s.previewNetRow]}>
                  <Text style={s.previewNetLabel}>Net pay</Text>
                  <Text style={s.previewNetValue}>
                    ₹ {editPayslip.netPay.toLocaleString("en-IN")}
                  </Text>
                </View>
              </View>
            )}

            <Text style={s.modalLabel}>Working days</Text>
            <TextInput
              style={s.modalInput}
              value={editWorkingDays}
              onChangeText={setEditWorkingDays}
              keyboardType="decimal-pad"
              placeholder="e.g. 22"
              placeholderTextColor={c.textFaint}
            />
            <Text style={s.modalLabel}>Attended days</Text>
            <TextInput
              style={s.modalInput}
              value={editAttendedDays}
              onChangeText={setEditAttendedDays}
              keyboardType="decimal-pad"
              placeholder="e.g. 20"
              placeholderTextColor={c.textFaint}
            />
            <Text style={s.modalHint}>
              The payslip&apos;s gross and LOP deduction are recalculated
              from these numbers when you save.
            </Text>

            {/* Employee attendance for this payroll month */}
            <View style={s.calSection}>
              <View style={s.calSummaryRow}>
                <Ionicons name="calendar-outline" size={16} color={c.accent} />
                <Text style={s.calSummaryText}>Attendance this month</Text>
              </View>

              {editPayslip && (
                <View style={s.payStatsRow}>
                  <View style={s.payStat}>
                    <Text style={[s.payStatValue, { color: ATT.present }]}>
                      {formatDays(editPayslip.attendedDays)}
                      <Text style={s.payStatDenom}>/{editPayslip.workingDays}</Text>
                    </Text>
                    <Text style={s.payStatLabel}>Days worked</Text>
                  </View>
                  <View style={s.payStat}>
                    <Text style={[s.payStatValue, { color: ATT.leave }]}>{leaveSummary.total}</Text>
                    <Text style={s.payStatLabel}>Leave taken</Text>
                  </View>
                  <View style={s.payStat}>
                    <Text style={[s.payStatValue, { color: ATT.unpaid }]}>{formatDays(editPayslip.lopDays)}</Text>
                    <Text style={s.payStatLabel}>LOP</Text>
                  </View>
                </View>
              )}

              {leaveSummary.total > 0 && (
                <View style={s.leaveTypesRow}>
                  {Object.entries(leaveSummary.byType).map(([name, n]) => (
                    <View key={name} style={s.leaveTypeChip}>
                      <Ionicons name="airplane-outline" size={12} color={ATT.leave} />
                      <Text style={s.leaveTypeText}>
                        {name} · {n}d
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {calLoading ? (
                <ActivityIndicator color={c.accent} style={{ paddingVertical: 20 }} />
              ) : editPayslip ? (
                <AttendanceCalendar
                  monthStr={`${editPayslip.year}-${String(editPayslip.month).padStart(2, "0")}`}
                  rows={calRows}
                  holidayMap={holidayMap}
                />
              ) : null}
            </View>
      </WebModal>

    </SafeAreaView>
  );
}

const makeStyles = (c: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  loader: { flex: 1, backgroundColor: c.bg, justifyContent: "center", alignItems: "center" },
  popup: { position: "absolute", top: 60, left: 20, right: 20, padding: 14, borderRadius: 14, zIndex: 999 },
  popupOk: { backgroundColor: "#16a34a" },
  popupErr: { backgroundColor: "#dc2626" },
  popupText: { color: c.text, fontWeight: "700", textAlign: "center" },

  header: { flexDirection: "row", alignItems: "center", marginBottom: 14, marginTop: 10, gap: 12 },
  backBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: c.surface, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: c.surfaceBorder },
  title: { color: c.text, fontSize: 22, fontWeight: "800" },
  subtitle: { color: c.textMuted, fontSize: 12, marginTop: 3 },

  statusChip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  statusText: { color: c.text, fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },

  runActions: { flexDirection: "row", gap: 8, marginBottom: 14, flexWrap: "wrap" },
  processBtn: { flexDirection: "row", alignItems: "center", backgroundColor: c.accent, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, gap: 5 },
  lockBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#16a34a", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, gap: 5 },
  emailAllBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#0d9488", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, gap: 5 },
  sendAllBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#2563eb", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, gap: 5 },
  actionText: { color: c.text, fontWeight: "700", fontSize: 13 },

  empty: { padding: 30, backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.surfaceBorder, alignItems: "center" },
  emptyTitle: { color: c.text, fontSize: 15, fontWeight: "700" },
  emptySub: { color: c.textMuted, fontSize: 12, marginTop: 4, textAlign: "center" },

  card: { backgroundColor: c.surface, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: c.surfaceBorder },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  cardName: { color: c.text, fontSize: 14, fontWeight: "700" },
  cardMeta: { color: c.textMuted, fontSize: 11, marginTop: 2 },
  netPay: { color: "#16a34a", fontSize: 16, fontWeight: "800" },
  sentChip: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, marginTop: 4 },
  sentChipText: { fontSize: 10, fontWeight: "800" },

  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  metaText: { color: c.textMuted, fontSize: 11, flex: 1 },

  overChip: { backgroundColor: "#f59e0b", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  overText: { color: c.text, fontSize: 9, fontWeight: "800" },

  payActions: { flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" },
  smallBtn: { flexDirection: "row", alignItems: "center", backgroundColor: c.accent, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 5 },
  smallBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },

  modalOverlay: { flex: 1, backgroundColor: c.overlay, justifyContent: "center", padding: 20 },
  modalCard: { backgroundColor: c.surface, borderRadius: 18, padding: 20 },
  modalTitle: { color: c.text, fontSize: 18, fontWeight: "800" },
  modalSub: { color: c.textMuted, fontSize: 12, marginTop: 4 },
  modalLabel: { color: c.textMuted, fontSize: 12, fontWeight: "600", marginTop: 14, marginBottom: 6 },
  modalInput: { backgroundColor: c.surfaceMuted, color: c.text, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: c.surfaceBorder, fontSize: 14 },
  modalHint: { color: c.textMuted, fontSize: 11, marginTop: 10, lineHeight: 16 },
  calSection: {
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.surfaceBorder,
  },
  calSummaryRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  calSummaryText: { flex: 1, color: c.text, fontSize: 13, fontWeight: "800" },
  calSummaryDays: { color: c.accent, fontSize: 13, fontWeight: "800" },
  payStatsRow: {
    flexDirection: "row",
    backgroundColor: c.surfaceMuted,
    borderRadius: 12,
    paddingVertical: 12,
  },
  payStat: { flex: 1, alignItems: "center" },
  payStatValue: { fontSize: 20, fontWeight: "800" },
  payStatDenom: { color: c.textMuted, fontSize: 13, fontWeight: "700" },
  payStatLabel: { color: c.textMuted, fontSize: 11, fontWeight: "600", marginTop: 2 },
  leaveTypesRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  leaveTypeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: ATT_BG.leave,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  leaveTypeText: { color: ATT.leave, fontSize: 12, fontWeight: "700" },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 18 },
  modalCancel: { flex: 1, backgroundColor: c.surfaceMuted, padding: 13, borderRadius: 11, alignItems: "center" },
  modalSave: { flex: 1, backgroundColor: "#16a34a", padding: 13, borderRadius: 11, alignItems: "center" },
  modalBtnText: { color: c.text, fontWeight: "700" },

  previewBox: { backgroundColor: c.surfaceMuted, borderRadius: 12, borderWidth: 1, borderColor: c.surfaceBorder, padding: 12, marginTop: 12 },
  previewRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 3 },
  previewLabel: { color: c.textMuted, fontSize: 12 },
  previewValue: { color: c.text, fontSize: 12, fontWeight: "700" },
  previewNetRow: { borderTopWidth: 1, borderTopColor: c.surfaceBorder, marginTop: 4, paddingTop: 7 },
  previewNetLabel: { color: c.text, fontSize: 13, fontWeight: "800" },
  previewNetValue: { color: "#16a34a", fontSize: 15, fontWeight: "800" },
});
