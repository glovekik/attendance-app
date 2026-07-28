import React, { useCallback, useEffect, useMemo, useState } from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  listTeamAttendance,
  listTeamLeaveBalances,
  listManagerLeaveRequests,
  listManagerTasks,
  createManagerTask,
  TeamAttendanceRow,
  ManagerTask,
} from "../../src/services/managerTeam";
import { teamProductivityReport } from "../../src/services/reports";
import {
  LeaveBalance,
  LeaveRequest,
  TeamProductivityRow,
  TASK_PRIORITIES,
  TaskPriority,
} from "../../src/types";
import { attendanceStatusColor } from "../../src/theme/statusColors";
import { DatePickerField } from "../../src/components/DatePickerField";
import { WebModal, ModalActions } from "../../src/components/WebModal";
import { Avatar } from "../../src/components/Avatar";
import { useTheme } from "../../src/theme/ThemeProvider";
import { notify } from "../../src/utils/confirm";
import { AttendanceCalendar } from "../../src/components/AttendanceCalendar";
import { ATT } from "../../src/theme/attendanceColors";
import { listHolidays } from "../../src/services/holidays";

// ---- date helpers (local time) ----
const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const fmtTime = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fmtDate = (s?: string) => {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};
const startOfWeek = (d: Date) => {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Mon=0 … Sun=6
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
};
// hoursWorked (a decimal) → "8h 12m" for a human-readable duration.
const fmtHours = (h?: number | null) => {
  if (!h || h <= 0) return "—";
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return mm ? `${hh}h ${mm}m` : `${hh}h`;
};

const PRESENT_STATUSES = ["PRESENT", "CHECKED_IN", "COMPLETED"];
const isPresent = (r: TeamAttendanceRow) => PRESENT_STATUSES.includes(r.status);
const isLate = (r: TeamAttendanceRow) => !!r.isLate || r.status === "LATE";

// One row → exactly one bucket. Buckets are mutually exclusive so a single
// day is never counted twice (e.g. a PRESENT row flagged isLate must not add
// to both "present" and "late"), and leave/holiday days are separated out so
// they never drag the attendance rate down.
type DayBucket = "present" | "late" | "half" | "absent" | "leave" | "holiday" | "other";
const bucketOf = (r?: TeamAttendanceRow): DayBucket => {
  if (!r) return "other";
  // LEAVE / HOLIDAY are carried on attendanceType, not status.
  const t = r.attendanceType;
  if (t === "LEAVE") return "leave";
  if (t === "HOLIDAY") return "holiday";
  if (r.status === "ABSENT") return "absent";
  if (r.status === "HALF_DAY") return "half";
  if (isLate(r)) return "late";
  if (isPresent(r) || r.checkIn) return "present";
  return "other";
};

type AttTab = "today" | "week" | "month";

export default function TeamMemberDetail() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);

  const userId = params.id as string;
  const name = (params.name as string) || "Team member";
  const email = (params.email as string) || "";
  const employeeCode = (params.employeeCode as string) || "";
  const tag = (params.tag as string) || "";
  // Where "back" should land when there's no in-app history to pop (e.g. a
  // hard refresh or a directly-opened URL). Managers come from the team
  // list; HR passes their own employee-profile route so back returns there
  // instead of bouncing into the manager area.
  const backTo = (params.backTo as string) || "/manager-team";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [attTab, setAttTab] = useState<AttTab>("today");

  const [attendance, setAttendance] = useState<TeamAttendanceRow[]>([]);
  const [holidayMap, setHolidayMap] = useState<Record<string, string>>({});
  // The Week tab is independently navigable (prev/next week). Its rows are
  // fetched on demand for whichever week is shown — the visible week can
  // straddle a month boundary (e.g. Mon Jun 29 → Sun Jul 5), so we fetch the
  // union of every month it touches, otherwise those days paint as "absent".
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [weekRows, setWeekRows] = useState<TeamAttendanceRow[]>([]);
  const [weekLoading, setWeekLoading] = useState(true);
  // Week is compact by default; the day-by-day breakdown expands on tap.
  const [weekExpanded, setWeekExpanded] = useState(false);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [productivity, setProductivity] = useState<TeamProductivityRow | null>(
    null
  );
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [tasks, setTasks] = useState<ManagerTask[]>([]);
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);

  // Add-task modal
  const [assignOpen, setAssignOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  // Work Done notes viewer
  const [wdOpen, setWdOpen] = useState(false);
  const [wdMonth, setWdMonth] = useState(monthKey(new Date()));
  const [wdPeriod, setWdPeriod] = useState<"today" | "week" | "month">("month");
  const [wdWeek, setWdWeek] = useState(1);
  const [wdRows, setWdRows] = useState<TeamAttendanceRow[]>([]);
  const [wdLoading, setWdLoading] = useState(false);

  const loadWorkDone = useCallback(async (month: string) => {
    setWdLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const rows = await listTeamAttendance(token, { userId, month });
      setWdRows((rows || []).filter((r) => r.workNotes && r.workNotes.trim()));
    } catch {
      setWdRows([]);
    } finally {
      setWdLoading(false);
    }
  }, [userId]);

  const openWorkDone = () => {
    const m = monthKey(new Date());
    setWdMonth(m);
    setWdPeriod("month");
    setWdWeek(1);
    setWdOpen(true);
    loadWorkDone(m);
  };

  const shiftMonth = (delta: number) => {
    const [y, mm] = wdMonth.split("-").map(Number);
    const d = new Date(y, mm - 1 + delta, 1);
    const m = monthKey(d);
    setWdMonth(m);
    setWdWeek(1);
    loadWorkDone(m);
  };

  // number of weeks in the viewed month
  const wdWeeksInMonth = useMemo(() => {
    const [y, mm] = wdMonth.split("-").map(Number);
    const days = new Date(y, mm, 0).getDate();
    return Math.ceil(days / 7);
  }, [wdMonth]);

  const wdList = useMemo(() => {
    const today = ymd(new Date());
    return wdRows
      .filter((r) => {
        if (wdPeriod === "today") return r.date === today;
        if (wdPeriod === "week") {
          const day = parseInt(r.date.slice(8, 10), 10) || 0;
          return Math.ceil(day / 7) === wdWeek;
        }
        return true; // month
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [wdRows, wdPeriod, wdWeek]);

  const wdMonthLabel = useMemo(() => {
    const [y, mm] = wdMonth.split("-").map(Number);
    return new Date(y, mm - 1, 1).toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
  }, [wdMonth]);

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const base = new Date();
      const month = monthKey(base);
      const [att, bal, prod, lv, tk] = await Promise.all([
        listTeamAttendance(token, { userId, month }).catch(() => []),
        listTeamLeaveBalances(token, userId).catch(() => []),
        teamProductivityReport(token, userId).catch(() => []),
        listManagerLeaveRequests(token).catch(() => []),
        listManagerTasks(token, { assigneeId: userId }).catch(() => []),
      ]);
      setAttendance(att || []);
      const balRow = bal?.find((r) => r.user?.id === userId);
      setBalances(balRow?.balances || []);
      setPhotoUrl(balRow?.user?.profilePictureUrl);
      setProductivity(prod?.find((r) => r.userId === userId) || null);
      setLeaves((lv || []).filter((r) => r.userId === userId));
      setTasks(tk || []);
    } catch (err: any) {
      notify("Failed to load", err?.message || "");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router, userId]);

  useEffect(() => {
    load();
  }, [load]);

  // Holidays for this year — the month calendar paints them distinctly.
  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        if (!token) return;
        const hols = await listHolidays(token, { year: new Date().getFullYear() });
        const map: Record<string, string> = {};
        (hols || []).forEach((h: any) => { if (h?.date) map[h.date] = h.name || "Holiday"; });
        setHolidayMap(map);
      } catch {
        /* non-fatal */
      }
    })();
  }, []);

  // Fetch attendance for the currently-shown week (on mount + whenever the
  // user navigates weeks). Fetches every month the week touches.
  const loadWeek = useCallback(
    async (ws: Date) => {
      const end = new Date(ws);
      end.setDate(ws.getDate() + 6);
      const months = Array.from(new Set([monthKey(ws), monthKey(end)]));
      const baseMonth = monthKey(new Date());

      // Fast path: the visible week sits entirely in the month `load()` already
      // fetched into `attendance`. Reuse it instead of firing the identical
      // request a second time (this was a duplicate call on every open). Until
      // that data lands, do nothing — the [attendance] dep re-runs this once
      // it arrives, so we never double-fetch the current month.
      if (months.length === 1 && months[0] === baseMonth) {
        if (attendance.length > 0) setWeekRows(attendance);
        return;
      }

      setWeekLoading(true);
      try {
        const token = await AsyncStorage.getItem("token");
        if (!token) return;
        // Cross-month week: still reuse the already-loaded base month, fetch
        // only the other month the week reaches into.
        const res = await Promise.all(
          months.map((m) =>
            m === baseMonth && attendance.length > 0
              ? Promise.resolve(attendance)
              : listTeamAttendance(token, { userId, month: m }).catch(() => [])
          )
        );
        setWeekRows(res.flat());
      } catch {
        setWeekRows([]);
      } finally {
        setWeekLoading(false);
      }
    },
    [userId, attendance]
  );

  useEffect(() => {
    loadWeek(weekStart);
  }, [weekStart, loadWeek]);

  const shiftWeek = (delta: number) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + delta * 7);
    setWeekStart(startOfWeek(d));
  };
  const goCurrentWeek = () => setWeekStart(startOfWeek(new Date()));

  // ---- attendance rollups ----
  const now = new Date();
  const todayRow = useMemo(
    () => attendance.find((r) => r.date === ymd(now)),
    [attendance] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const todayKey = ymd(now);
  const weekDays = useMemo(() => {
    const dowShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const monShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const key = ymd(d);
      const dow = d.getDay();
      return {
        key,
        dow,
        dayNum: d.getDate(),
        dayShort: dowShort[dow],
        monShort: monShort[d.getMonth()],
        // Sunday is the weekly off (matches the calendar logic in history.tsx).
        isOff: dow === 0,
        row: weekRows.find((r) => r.date === key),
        isToday: key === todayKey,
        isFuture: key > todayKey,
      };
    });
  }, [weekStart, weekRows, todayKey]);

  // Aggregate a set of rows into mutually-exclusive buckets + total hours.
  // `workingDaysCal` is the calendar working-days denominator (Mon–Sat minus
  // holidays, elapsed) — it counts days that have NO attendance row (true
  // absences), which recorded-only counting misses and which inflated the %.
  const tally = (rows: TeamAttendanceRow[], workingDaysCal?: number) => {
    let present = 0, late = 0, half = 0, absent = 0, leave = 0, holiday = 0, hours = 0;
    rows.forEach((r) => {
      switch (bucketOf(r)) {
        case "present": present++; break;
        case "late": late++; break;
        case "half": half++; break;
        case "absent": absent++; break;
        case "leave": leave++; break;
        case "holiday": holiday++; break;
      }
      hours += r.hoursWorked || 0;
    });
    // "Attended" = actually showed up (on-time, late, or half day).
    const attended = present + late + half;
    const recorded = attended + absent;
    // Prefer the calendar denominator; never below attended+leave so the
    // numerator can't exceed it. "No record" = working days with no attendance.
    const workingDays = Math.max(workingDaysCal ?? recorded, attended + leave);
    const noRecord = Math.max(0, workingDays - attended - leave);
    // Rate = attended ÷ (working days that weren't leave). Leave & holidays
    // are excluded so they never count against attendance.
    const denomForRate = attended + noRecord;
    const rate = denomForRate ? Math.round((attended / denomForRate) * 100) : 0;
    return { present, late, half, absent, leave, holiday, hours, attended, workingDays, noRecord, rate };
  };

  // Calendar working days elapsed so far this month (Sundays & holidays out).
  const monthWorkingElapsed = useMemo(() => {
    const y = now.getFullYear();
    const mo = now.getMonth() + 1;
    const daysInMonth = new Date(y, mo, 0).getDate();
    const todayStr = ymd(now);
    let count = 0;
    for (let dd = 1; dd <= daysInMonth; dd++) {
      const key = `${y}-${String(mo).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
      if (key > todayStr) break;
      if (new Date(y, mo - 1, dd).getDay() === 0) continue; // Sunday = weekly off
      if (holidayMap[key]) continue;
      count++;
    }
    return count;
  }, [holidayMap]); // eslint-disable-line react-hooks/exhaustive-deps

  // Working days elapsed in the visible week.
  const weekWorkingElapsed = useMemo(
    () => weekDays.filter((d) => !d.isFuture && !d.isOff && !holidayMap[d.key]).length,
    [weekDays, holidayMap]
  );

  const weekStats = useMemo(
    () => tally(weekDays.map((d) => d.row).filter(Boolean) as TeamAttendanceRow[], weekWorkingElapsed),
    [weekDays, weekWorkingElapsed] // eslint-disable-line react-hooks/exhaustive-deps
  );
  const monthStats = useMemo(
    () => tally(attendance, monthWorkingElapsed),
    [attendance, monthWorkingElapsed] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const isCurrentWeek = ymd(weekStart) === ymd(startOfWeek(now));
  const weekRangeLabel = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(weekStart.getDate() + 6);
    const sameMonth = weekStart.getMonth() === end.getMonth();
    const s = weekStart.toLocaleDateString(undefined, { day: "numeric", month: "short" });
    const e = end.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
    return sameMonth
      ? `${weekStart.getDate()} – ${e}`
      : `${s} – ${e}`;
  }, [weekStart]);

  // Month tab always shows the current month up to today ("month to date").
  const monthRangeLabel = useMemo(() => {
    const monthName = now.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    return `${monthName} · 1–${now.getDate()}`;
  }, [now]); // eslint-disable-line react-hooks/exhaustive-deps

  const rateColor = (r: number) =>
    r >= 90 ? c.successText : r >= 75 ? c.warningText : c.dangerText;

  const bucketColor = (b: DayBucket): string => {
    switch (b) {
      case "present": return ATT.present;
      case "late": return c.warningText; // amber — still spot late at a glance
      case "half": return ATT.present; // half day is still attended
      case "absent": return ATT.absent;
      case "leave": return ATT.leave;
      default: return ATT.holiday; // holiday / weekly off
    }
  };
  // Colour for a day cell in the compact week strip.
  const dayColor = (d: { row?: TeamAttendanceRow; isFuture: boolean; isOff: boolean }): string => {
    if (d.isFuture) return c.surfaceMuted;
    if (!d.row) return d.isOff ? c.surfaceMuted : c.dangerText; // missed working day
    return bucketColor(bucketOf(d.row));
  };

  // Month composition segments (drives the stacked bar + legend).
  const monthComp = [
    { key: "present", label: "Present", value: monthStats.present, color: ATT.present },
    { key: "late", label: "Late", value: monthStats.late, color: c.warningText },
    { key: "half", label: "Half day", value: monthStats.half, color: ATT.present },
    { key: "absent", label: "No record", value: monthStats.noRecord, color: ATT.absent },
    { key: "leave", label: "Leave", value: monthStats.leave, color: ATT.leave },
    { key: "holiday", label: "Holiday", value: monthStats.holiday, color: ATT.holiday },
  ];
  const monthCompTotal = monthComp.reduce((s, x) => s + x.value, 0);

  const openAssign = () => {
    setTitle("");
    setDescription("");
    setPriority("MEDIUM");
    setDueDate("");
    setAssignOpen(true);
  };

  const onAssign = async () => {
    if (saving) return;
    if (!title.trim()) {
      notify("Title is required");
      return;
    }
    try {
      setSaving(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await createManagerTask(token, {
        title: title.trim(),
        description: description.trim() || undefined,
        assigneeId: userId,
        priority,
        dueDate: dueDate.trim() || undefined,
      });
      setAssignOpen(false);
      setSaving(false);
      load();
      notify("Task assigned", `Sent to ${name}`);
    } catch (err: any) {
      notify("Assign failed", err?.message || "");
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Top bar */}
      <View style={styles.topbar}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() =>
            router.canGoBack()
              ? router.back()
              : router.replace(backTo as any)
          }
        >
          <Ionicons name="chevron-back" size={22} color={c.text} />
        </TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>
          Work Performance
        </Text>
        <View style={styles.iconBtnSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
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
      >
        {/* HERO — compact horizontal identity card */}
        <View style={styles.hero}>
          <Avatar
            name={name}
            uri={photoUrl}
            size={52}
            bg="rgba(255,255,255,0.22)"
            fg="#fff"
            fontSize={20}
            zoomable
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.heroName} numberOfLines={1}>{name}</Text>
            {!!email && (
              <Text style={styles.heroEmail} numberOfLines={1}>{email}</Text>
            )}
            <View style={styles.heroPills}>
              {!!employeeCode && (
                <View style={styles.heroPill}>
                  <Ionicons name="id-card-outline" size={12} color="#fff" />
                  <Text style={styles.heroPillText}>{employeeCode}</Text>
                </View>
              )}
              {!!tag && (
                <View style={styles.heroPill}>
                  <Text style={styles.heroPillText}>{tag}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* ATTENDANCE */}
        <SectionHeader c={c} icon="calendar-outline" title="Attendance" />
        <View style={styles.card}>
          {/* segmented control */}
          <View style={styles.segment}>
            {(["today", "week", "month"] as AttTab[]).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.segBtn, attTab === t && styles.segBtnActive]}
                onPress={() => setAttTab(t)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.segText,
                    attTab === t && styles.segTextActive,
                  ]}
                >
                  {t === "today" ? "Today" : t === "week" ? "Week" : "Month"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {attTab === "today" && (
            <View style={styles.tabBody}>
              <View style={styles.rowBetween}>
                <Text style={styles.mutedLabel}>Status</Text>
                <StatusPill c={c} status={todayRow?.status || "NO RECORD"} />
              </View>
              <View style={styles.timeCards}>
                <TimeCard c={c} icon="log-in-outline" label="Check in" value={fmtTime(todayRow?.checkIn)} />
                <TimeCard c={c} icon="log-out-outline" label="Check out" value={fmtTime(todayRow?.checkOut)} />
                <TimeCard c={c} icon="business-outline" label="Type" value={todayRow?.attendanceType || "—"} />
              </View>
            </View>
          )}

          {attTab === "week" && (
            <View style={styles.tabBody}>
              {/* week navigator */}
              <View style={styles.weekNav}>
                <TouchableOpacity style={styles.weekNavBtn} onPress={() => shiftWeek(-1)}>
                  <Ionicons name="chevron-back" size={18} color={c.text} />
                </TouchableOpacity>
                <View style={{ alignItems: "center" }}>
                  <Text style={styles.weekRangeText}>{weekRangeLabel}</Text>
                  {!isCurrentWeek && (
                    <TouchableOpacity onPress={goCurrentWeek} hitSlop={8}>
                      <Text style={styles.thisWeekLink}>Back to this week</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <TouchableOpacity
                  style={[styles.weekNavBtn, isCurrentWeek && { opacity: 0.35 }]}
                  disabled={isCurrentWeek}
                  onPress={() => shiftWeek(1)}
                >
                  <Ionicons name="chevron-forward" size={18} color={c.text} />
                </TouchableOpacity>
              </View>

              {/* compact strip — always visible */}
              {weekLoading ? (
                <ActivityIndicator color={c.accent} style={{ paddingVertical: 24 }} />
              ) : (
                <>
                  <View style={styles.strip}>
                    {weekDays.map((d) => (
                      <View key={d.key} style={styles.stripCol}>
                        <Text style={styles.stripDow}>{d.dayShort.charAt(0)}</Text>
                        <View
                          style={[
                            styles.stripDot,
                            {
                              backgroundColor: dayColor(d),
                              borderColor: d.isToday ? c.accent : "transparent",
                            },
                          ]}
                        />
                        <Text style={[styles.stripNum, d.isToday && { color: c.accent }]}>
                          {d.dayNum}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* week summary */}
                  <View style={styles.weekSummary}>
                    <StatBlock c={c} label="Present" value={weekStats.present} tone="ok" />
                    <StatBlock c={c} label="Late" value={weekStats.late} tone="warn" />
                    <StatBlock c={c} label="No record" value={weekStats.noRecord} tone="bad" />
                    <StatBlock c={c} label="Hours" value={Math.round(weekStats.hours * 10) / 10} />
                  </View>

                  {/* expand toggle */}
                  <TouchableOpacity
                    style={styles.expandBtn}
                    onPress={() => setWeekExpanded((v) => !v)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.expandBtnText}>
                      {weekExpanded ? "Hide day-by-day" : "Show day-by-day"}
                    </Text>
                    <Ionicons
                      name={weekExpanded ? "chevron-up" : "chevron-down"}
                      size={16}
                      color={c.accent}
                    />
                  </TouchableOpacity>
                </>
              )}

              {/* day-by-day breakdown — expanded */}
              {!weekLoading && weekExpanded && (
                <View style={styles.weekList}>
                  {weekDays.map((d, i) => {
                    const b = bucketOf(d.row);
                    const col = d.row ? attendanceStatusColor(d.row.status, c) : null;
                    let pillText: string;
                    let pillBg: string;
                    let pillFg: string;
                    let primary: string;
                    let secondary = "";
                    let muted = false;
                    if (d.isFuture) {
                      pillText = "—"; pillBg = c.surfaceMuted; pillFg = c.textMuted;
                      primary = "Upcoming"; muted = true;
                    } else if (d.isOff && !d.row) {
                      pillText = "WEEKLY OFF"; pillBg = c.surfaceMuted; pillFg = c.textMuted;
                      primary = "Weekly off (Sunday)"; muted = true;
                    } else if (!d.row) {
                      pillText = "NO RECORD"; pillBg = c.dangerBg; pillFg = c.dangerText;
                      primary = "No check-in recorded";
                    } else if (b === "leave") {
                      pillText = "LEAVE"; pillBg = c.infoBg; pillFg = c.infoText;
                      primary = "On approved leave";
                    } else if (b === "holiday") {
                      pillText = "HOLIDAY"; pillBg = c.surfaceMuted; pillFg = c.textMuted;
                      primary = "Holiday"; muted = true;
                    } else {
                      pillText = d.row.status;
                      pillBg = col?.bg || c.surfaceMuted;
                      pillFg = col?.fg || c.text;
                      primary = `In ${fmtTime(d.row.checkIn)} · Out ${fmtTime(d.row.checkOut)}`;
                      const type =
                        d.row.attendanceType && d.row.attendanceType !== "OFFICE"
                          ? d.row.attendanceType
                          : "";
                      const hrs = fmtHours(d.row.hoursWorked);
                      secondary = [hrs !== "—" ? hrs : "", type].filter(Boolean).join(" · ");
                    }
                    return (
                      <View key={d.key} style={[styles.weekDayRow, i === 0 && { borderTopWidth: 0 }]}>
                        <View style={[styles.dateChip, d.isToday && styles.dateChipToday]}>
                          <Text style={[styles.dateChipDow, d.isToday && { color: "#fff" }]}>
                            {d.dayShort}
                          </Text>
                          <Text style={[styles.dateChipNum, d.isToday && { color: "#fff" }]}>
                            {d.dayNum}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[styles.weekDayPrimary, muted && styles.weekDayPrimaryMuted]}
                            numberOfLines={1}
                          >
                            {primary}
                          </Text>
                          {!!secondary && (
                            <Text style={styles.weekDaySecondary}>{secondary}</Text>
                          )}
                          {!!d.row?.workNotes?.trim() && (
                            <Text style={styles.weekDayNotes} numberOfLines={3}>
                              {d.row.workNotes.trim()}
                            </Text>
                          )}
                        </View>
                        <View style={[styles.weekPill, { backgroundColor: pillBg }]}>
                          <Text style={[styles.weekPillText, { color: pillFg }]}>{pillText}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {attTab === "month" && (
            <View style={styles.tabBody}>
              <Text style={styles.periodCaption}>{monthRangeLabel}</Text>

              {/* hero: three headline numbers */}
              <View style={styles.mHero}>
                <View style={styles.mHeroCell}>
                  <Text style={[styles.mHeroValue, { color: rateColor(monthStats.rate) }]}>
                    {monthStats.rate}%
                  </Text>
                  <Text style={styles.mHeroLabel}>Attendance</Text>
                </View>
                <View style={styles.mHeroDivider} />
                <View style={styles.mHeroCell}>
                  <Text style={styles.mHeroValue}>
                    {monthStats.attended}
                    <Text style={styles.mHeroValueSub}>/{monthStats.workingDays}</Text>
                  </Text>
                  <Text style={styles.mHeroLabel}>Days present</Text>
                </View>
                <View style={styles.mHeroDivider} />
                <View style={styles.mHeroCell}>
                  <Text style={styles.mHeroValue}>{Math.round(monthStats.hours * 10) / 10}h</Text>
                  <Text style={styles.mHeroLabel}>Hours worked</Text>
                </View>
              </View>

              {/* stacked composition bar */}
              <View style={styles.compBar}>
                {monthCompTotal === 0 ? (
                  <View style={{ flex: 1, backgroundColor: c.surfaceMuted }} />
                ) : (
                  monthComp.map(
                    (s) =>
                      s.value > 0 && (
                        <View
                          key={s.key}
                          style={{ flex: s.value, backgroundColor: s.color }}
                        />
                      )
                  )
                )}
              </View>

              {/* legend */}
              <View style={styles.legendWrap}>
                {monthCompTotal === 0 ? (
                  <Text style={styles.mutedLabel}>No attendance recorded yet this month.</Text>
                ) : (
                  monthComp.map(
                    (s) =>
                      s.value > 0 && (
                        <View key={s.key} style={styles.legendChip}>
                          <View style={[styles.legendChipDot, { backgroundColor: s.color }]} />
                          <Text style={styles.legendChipText}>
                            {s.label} <Text style={styles.legendChipNum}>{s.value}</Text>
                          </Text>
                        </View>
                      )
                  )
                )}
              </View>

              <Text style={styles.periodNote}>
                Attendance = days present ÷ {monthStats.workingDays} recorded working day
                {monthStats.workingDays === 1 ? "" : "s"}
                {monthStats.leave > 0 || monthStats.holiday > 0
                  ? `. Leave (${monthStats.leave}) & holidays (${monthStats.holiday}) don't count against it.`
                  : "."}
              </Text>

              {/* Month calendar — tap a day to see that day's attendance */}
              <View style={styles.calWrap}>
                <Text style={styles.calHeading}>Day-by-day calendar</Text>
                <AttendanceCalendar
                  monthStr={monthKey(now)}
                  rows={attendance as any}
                  holidayMap={holidayMap}
                />
              </View>
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.wdBtn} onPress={openWorkDone} activeOpacity={0.85}>
          <Ionicons name="document-text-outline" size={18} color="#fff" />
          <Text style={styles.wdBtnText}>Work Done notes</Text>
          <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.85)" />
        </TouchableOpacity>

        {/* PRODUCTIVITY */}
        <SectionHeader c={c} icon="trending-up-outline" title="Productivity" />
        {productivity ? (
          <View style={styles.kpiGrid}>
            <KpiCell
              c={c}
              icon="list-outline"
              tint={c.infoText}
              tintBg={c.infoBg}
              value={productivity.openTasks}
              label="Open tasks"
            />
            <KpiCell
              c={c}
              icon="checkmark-done-outline"
              tint={c.successText}
              tintBg={c.successBg}
              value={productivity.completedTasksLast30d}
              label="Done · 30d"
            />
            <KpiCell
              c={c}
              icon="time-outline"
              tint={c.accent}
              tintBg={c.accentSoft}
              value={Math.round(productivity.avgHoursPerDayLast7d * 10) / 10}
              label="Avg hrs/day · 7d"
            />
          </View>
        ) : (
          <View style={styles.card}>
            <EmptyRow c={c} icon="trending-up-outline" text="No productivity data yet." />
          </View>
        )}

        {/* LEAVE BALANCES */}
        <SectionHeader c={c} icon="briefcase-outline" title="Leave balances" />
        <View style={styles.card}>
          {balances.length === 0 ? (
            <EmptyRow c={c} icon="briefcase-outline" text="No leave balances." />
          ) : (
            balances.map((b, idx) => {
              const pct =
                b.allocated > 0
                  ? Math.max(0, Math.min(1, b.remaining / b.allocated))
                  : 0;
              return (
                <View
                  key={b.leaveTypeCode}
                  style={[styles.balRow, idx === 0 && { marginTop: 0 }]}
                >
                  <View style={styles.balTop}>
                    <Text style={styles.balName}>
                      {b.leaveType?.name || b.leaveTypeCode}
                    </Text>
                    <Text style={styles.balRemain}>
                      {b.remaining}
                      <Text style={styles.balOf}> / {b.allocated}</Text>
                    </Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View
                      style={[styles.barFill, { width: `${pct * 100}%` }]}
                    />
                  </View>
                  <Text style={styles.balSub}>
                    used {b.used}
                    {b.pending ? ` · ${b.pending} pending` : ""}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        {/* LEAVE TAKEN */}
        <SectionHeader c={c} icon="airplane-outline" title="Leave taken" />
        <View style={styles.card}>
          {leaves.length === 0 ? (
            <EmptyRow c={c} icon="airplane-outline" text="No leave requests." />
          ) : (
            leaves.slice(0, 10).map((l, idx) => (
              <View
                key={l.id}
                style={[styles.listRow, idx === 0 && { borderTopWidth: 0 }]}
              >
                <View style={styles.leaveIcon}>
                  <Ionicons name="airplane" size={15} color={c.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>
                    {l.leaveType?.name || l.leaveTypeCode}
                  </Text>
                  <Text style={styles.rowSub}>
                    {fmtDate(l.fromDate)} – {fmtDate(l.toDate)} · {l.totalDays}d
                  </Text>
                </View>
                <MiniPill tone={statusTone(l.status, c)} text={l.status} />
              </View>
            ))
          )}
        </View>

        {/* TASKS */}
        <SectionHeader c={c} icon="checkbox-outline" title="Tasks assigned" />
        <View style={styles.card}>
          {tasks.length === 0 ? (
            <EmptyRow c={c} icon="checkbox-outline" text="No tasks assigned yet." />
          ) : (
            tasks.map((t, idx) => (
              <TouchableOpacity
                key={t.id}
                style={[styles.listRow, idx === 0 && { borderTopWidth: 0 }]}
                activeOpacity={0.7}
                onPress={() => router.push(`/tasks/${t.id}` as any)}
              >
                <View style={styles.leaveIcon}>
                  <Ionicons name="ellipse" size={9} color={priorityColor(t.priority, c)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {t.title}
                  </Text>
                  <Text style={styles.rowSub}>
                    {t.priority || "MEDIUM"}
                    {t.dueDate ? ` · due ${fmtDate(t.dueDate)}` : ""}
                  </Text>
                </View>
                <MiniPill tone={taskTone(t.status, c)} text={t.status} />
                <Ionicons name="chevron-forward" size={16} color={c.textFaint} />
              </TouchableOpacity>
            ))
          )}
          <TouchableOpacity style={styles.addTaskBtn} onPress={openAssign} activeOpacity={0.85}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.addTaskText}>Assign a task</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Add task modal */}
      <WebModal
        visible={assignOpen}
        onClose={() => !saving && setAssignOpen(false)}
        title={`Assign task to ${name}`}
        size="md"
        footer={
          <ModalActions align="spread">
            <TouchableOpacity
              style={[styles.btn, styles.btnGhost]}
              onPress={() => !saving && setAssignOpen(false)}
              disabled={saving}
            >
              <Text style={styles.btnGhostText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary]}
              onPress={onAssign}
              disabled={saving}
            >
              <Text style={styles.btnPrimaryText}>{saving ? "…" : "Assign"}</Text>
            </TouchableOpacity>
          </ModalActions>
        }
      >
        <Text style={styles.label}>Title *</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Short, action-oriented title"
          placeholderTextColor={c.textFaint}
        />
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, { minHeight: 80 }]}
          value={description}
          onChangeText={setDescription}
          placeholder="Context, links, expected output…"
          placeholderTextColor={c.textFaint}
          multiline
          textAlignVertical="top"
        />
        <Text style={styles.label}>Priority</Text>
        <View style={styles.chipRow}>
          {TASK_PRIORITIES.map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.chip, priority === p && styles.chipActive]}
              onPress={() => setPriority(p)}
            >
              <Text
                style={[styles.chipText, priority === p && styles.chipTextActive]}
              >
                {p}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.label}>Due date</Text>
        <DatePickerField
          value={dueDate}
          onChange={setDueDate}
          placeholder="Optional — tap to pick"
        />
      </WebModal>

      {/* Work Done notes viewer */}
      <WebModal
        visible={wdOpen}
        onClose={() => setWdOpen(false)}
        title={`${name} · Work done`}
        size="md"
        showCloseButton={false}
        footer={
          <ModalActions align="right">
            <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={() => setWdOpen(false)}>
              <Text style={styles.btnPrimaryText}>Close</Text>
            </TouchableOpacity>
          </ModalActions>
        }
      >
        {/* month navigator */}
        <View style={styles.wdMonthNav}>
          <TouchableOpacity style={styles.wdNavBtn} onPress={() => shiftMonth(-1)}>
            <Ionicons name="chevron-back" size={18} color={c.text} />
          </TouchableOpacity>
          <Text style={styles.wdMonthLabel}>{wdMonthLabel}</Text>
          <TouchableOpacity
            style={[styles.wdNavBtn, wdMonth >= monthKey(new Date()) && { opacity: 0.35 }]}
            disabled={wdMonth >= monthKey(new Date())}
            onPress={() => shiftMonth(1)}
          >
            <Ionicons name="chevron-forward" size={18} color={c.text} />
          </TouchableOpacity>
        </View>

        {/* period segmented */}
        <View style={styles.wdSeg}>
          {(["today", "week", "month"] as const).map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.wdSegBtn, wdPeriod === p && styles.wdSegBtnActive]}
              onPress={() => setWdPeriod(p)}
            >
              <Text style={[styles.wdSegText, wdPeriod === p && styles.wdSegTextActive]}>
                {p === "today" ? "Today" : p === "week" ? "Week" : "Month"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* week picker */}
        {wdPeriod === "week" && (
          <View style={styles.wdWeekRow}>
            {Array.from({ length: wdWeeksInMonth }, (_, i) => i + 1).map((w) => (
              <TouchableOpacity
                key={w}
                style={[styles.wdWeekChip, wdWeek === w && styles.wdWeekChipActive]}
                onPress={() => setWdWeek(w)}
              >
                <Text style={[styles.wdWeekText, wdWeek === w && styles.wdWeekTextActive]}>
                  W{w}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* list */}
        {wdLoading ? (
          <ActivityIndicator color={c.accent} style={{ paddingVertical: 24 }} />
        ) : wdList.length === 0 ? (
          <Text style={styles.wdEmpty}>No work notes for this {wdPeriod}.</Text>
        ) : (
          wdList.map((r, i) => (
            <View key={r.id} style={[styles.wdItem, i === 0 && { borderTopWidth: 0 }]}>
              <Text style={styles.wdDate}>{fmtDate(r.date)}</Text>
              <Text style={styles.wdText}>{r.workNotes?.trim()}</Text>
            </View>
          ))
        )}
      </WebModal>
    </SafeAreaView>
  );
}

// ---------- small presentational components ----------
function SectionHeader({ c, icon, title }: { c: any; icon: any; title: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 22, marginBottom: 10 }}>
      <Ionicons name={icon} size={16} color={c.textMuted} />
      <Text style={{ color: c.textMuted, fontSize: 12, fontWeight: "800", letterSpacing: 1 }}>
        {title.toUpperCase()}
      </Text>
    </View>
  );
}

function StatusPill({ c, status }: { c: any; status: string }) {
  const col = attendanceStatusColor(status, c);
  return (
    <View style={{ backgroundColor: col.bg, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 }}>
      <Text style={{ color: col.fg, fontSize: 12, fontWeight: "800" }}>{status}</Text>
    </View>
  );
}

function TimeCard({ c, icon, label, value }: { c: any; icon: any; label: string; value: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: c.surfaceMuted, borderRadius: 12, padding: 12, alignItems: "center", gap: 4 }}>
      <Ionicons name={icon} size={18} color={c.textMuted} />
      <Text style={{ color: c.text, fontSize: 15, fontWeight: "800" }}>{value}</Text>
      <Text style={{ color: c.textMuted, fontSize: 10 }}>{label}</Text>
    </View>
  );
}

function StatBlock({
  c,
  label,
  value,
  tone,
}: {
  c: any;
  label: string;
  value: number;
  tone?: "ok" | "warn" | "bad";
}) {
  const color =
    tone === "ok" ? c.successText : tone === "warn" ? c.warningText : tone === "bad" ? c.dangerText : c.text;
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={{ color, fontSize: 22, fontWeight: "800" }}>{value}</Text>
      <Text style={{ color: c.textMuted, fontSize: 11, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function KpiCell({
  c,
  icon,
  tint,
  tintBg,
  value,
  label,
}: {
  c: any;
  icon: any;
  tint: string;
  tintBg: string;
  value: number;
  label: string;
}) {
  return (
    <View
      style={{
        width: "31%",
        flexGrow: 1,
        backgroundColor: c.surface,
        borderColor: c.surfaceBorder,
        borderWidth: 1,
        borderRadius: 16,
        padding: 14,
        shadowColor: c.shadow,
        shadowOpacity: 1,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
      }}
    >
      <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: tintBg, alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
        <Ionicons name={icon} size={17} color={tint} />
      </View>
      <Text style={{ color: c.text, fontSize: 20, fontWeight: "800" }}>{value}</Text>
      <Text style={{ color: c.textMuted, fontSize: 11, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function MiniPill({ tone, text }: { tone: { bg: string; fg: string }; text: string }) {
  return (
    <View style={{ backgroundColor: tone.bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
      <Text style={{ color: tone.fg, fontSize: 10, fontWeight: "800" }}>{text}</Text>
    </View>
  );
}

function EmptyRow({ c, icon, text }: { c: any; icon: any; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 }}>
      <Ionicons name={icon} size={16} color={c.textFaint} />
      <Text style={{ color: c.textMuted, fontSize: 12 }}>{text}</Text>
    </View>
  );
}

const statusTone = (s: string, c: any) => {
  if (s === "APPROVED") return { bg: c.successBg, fg: c.successText };
  if (s === "REJECTED" || s === "CANCELLED") return { bg: c.dangerBg, fg: c.dangerText };
  return { bg: c.warningBg, fg: c.warningText };
};
const taskTone = (s: string, c: any) => {
  if (s === "COMPLETED") return { bg: c.successBg, fg: c.successText };
  if (s === "ONGOING") return { bg: c.infoBg, fg: c.infoText };
  return { bg: c.warningBg, fg: c.warningText };
};
const priorityColor = (p: string | undefined, c: any) => {
  if (p === "CRITICAL" || p === "HIGH") return c.dangerText;
  if (p === "MEDIUM") return c.warningText;
  return c.successText;
};

const makeStyles = (c: any) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    loader: { flex: 1, backgroundColor: c.bg, justifyContent: "center", alignItems: "center" },

    topbar: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 12,
    },
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
    topTitle: { flex: 1, color: c.text, fontSize: 16, fontWeight: "800", textAlign: "center" },
    iconBtnSpacer: { width: 42, height: 42 },

    // hero
    hero: {
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      backgroundColor: c.accent,
      borderRadius: 18,
      padding: 16,
      shadowColor: c.accent,
      shadowOpacity: 0.22,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
    heroAvatar: {
      width: 68,
      height: 68,
      borderRadius: 34,
      backgroundColor: "rgba(255,255,255,0.22)",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 10,
    },
    heroAvatarText: { color: "#fff", fontSize: 26, fontWeight: "800" },
    heroName: { color: "#fff", fontSize: 17, fontWeight: "800" },
    heroEmail: { color: "rgba(255,255,255,0.85)", fontSize: 12.5, marginTop: 2 },
    heroPills: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8, justifyContent: "flex-start" },
    heroPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: "rgba(255,255,255,0.18)",
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    heroPillText: { color: "#fff", fontSize: 11, fontWeight: "700" },

    // generic card
    card: {
      backgroundColor: c.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      padding: 14,
      shadowColor: c.shadow,
      shadowOpacity: 1,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },

    // segmented control
    segment: {
      flexDirection: "row",
      backgroundColor: c.surfaceMuted,
      borderRadius: 12,
      padding: 4,
      gap: 4,
    },
    segBtn: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: "center" },
    segBtnActive: {
      backgroundColor: c.surface,
      shadowColor: c.shadow,
      shadowOpacity: 1,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    segText: { color: c.textMuted, fontSize: 13, fontWeight: "700" },
    segTextActive: { color: c.text },
    tabBody: { marginTop: 14, gap: 14 },

    rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    mutedLabel: { color: c.textMuted, fontSize: 12 },
    timeCards: { flexDirection: "row", gap: 8 },

    // week navigator
    weekNav: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    weekNavBtn: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: c.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    weekRangeText: { color: c.text, fontSize: 14, fontWeight: "800" },
    thisWeekLink: { color: c.accent, fontSize: 11, fontWeight: "700", marginTop: 2 },

    // compact week strip
    strip: { flexDirection: "row", justifyContent: "space-between" },
    stripCol: { alignItems: "center", gap: 5, flex: 1 },
    stripDow: { color: c.textMuted, fontSize: 11, fontWeight: "700" },
    stripDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2 },
    stripNum: { color: c.textMuted, fontSize: 11, fontWeight: "700" },

    // expand toggle
    expandBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      paddingVertical: 8,
    },
    expandBtnText: { color: c.accent, fontSize: 13, fontWeight: "800" },

    // week day-by-day list (Keka-style)
    weekList: {
      backgroundColor: c.surfaceMuted,
      borderRadius: 14,
      paddingHorizontal: 12,
    },
    weekDayRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.surfaceBorder,
    },
    dateChip: {
      width: 44,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      alignItems: "center",
    },
    dateChipToday: { backgroundColor: c.accent, borderColor: c.accent },
    dateChipDow: { color: c.textMuted, fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
    dateChipNum: { color: c.text, fontSize: 16, fontWeight: "800", marginTop: 1 },
    weekDayPrimary: { color: c.text, fontSize: 13, fontWeight: "700" },
    weekDayPrimaryMuted: { color: c.textMuted, fontWeight: "600" },
    weekDaySecondary: { color: c.textMuted, fontSize: 11, marginTop: 2 },
    weekDayNotes: { color: c.textMuted, fontSize: 11, fontStyle: "italic", marginTop: 4, lineHeight: 15 },
    weekPill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
    weekPillText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
    weekSummary: {
      flexDirection: "row",
      marginTop: 4,
      paddingTop: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.surfaceBorder,
    },

    statRow: { flexDirection: "row" },

    // period context (month / week captions)
    periodCaption: {
      color: c.textMuted,
      fontSize: 12,
      fontWeight: "700",
      textAlign: "center",
    },
    periodNote: { color: c.textMuted, fontSize: 11, lineHeight: 16, marginTop: 2 },
    calWrap: {
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.surfaceBorder,
    },
    calHeading: { color: c.text, fontSize: 13, fontWeight: "800", marginBottom: 10 },

    // month hero row
    mHero: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.surfaceMuted,
      borderRadius: 14,
      paddingVertical: 16,
    },
    mHeroCell: { flex: 1, alignItems: "center" },
    mHeroDivider: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", backgroundColor: c.surfaceBorder, marginVertical: 6 },
    mHeroValue: { color: c.text, fontSize: 24, fontWeight: "800" },
    mHeroValueSub: { color: c.textMuted, fontSize: 15, fontWeight: "700" },
    mHeroLabel: { color: c.textMuted, fontSize: 11, marginTop: 3 },

    // stacked composition bar + legend
    compBar: {
      flexDirection: "row",
      height: 14,
      borderRadius: 7,
      overflow: "hidden",
      backgroundColor: c.surfaceMuted,
    },
    legendWrap: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    legendChip: { flexDirection: "row", alignItems: "center", gap: 6 },
    legendChipDot: { width: 9, height: 9, borderRadius: 3 },
    legendChipText: { color: c.textMuted, fontSize: 12, fontWeight: "600" },
    legendChipNum: { color: c.text, fontWeight: "800" },

    rateRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
      backgroundColor: c.surfaceMuted,
      borderRadius: 14,
      padding: 14,
    },
    rateValue: { color: c.accent, fontSize: 30, fontWeight: "800" },
    rateSide: { alignItems: "flex-end" },
    rateHours: { color: c.text, fontSize: 22, fontWeight: "800" },

    // leave balances
    balRow: {
      marginTop: 14,
      paddingTop: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.surfaceBorder,
    },
    balTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    balName: { color: c.text, fontSize: 13, fontWeight: "700" },
    balRemain: { color: c.text, fontSize: 15, fontWeight: "800" },
    balOf: { color: c.textMuted, fontSize: 12, fontWeight: "600" },
    barTrack: { height: 6, borderRadius: 3, backgroundColor: c.surfaceMuted, marginTop: 8, overflow: "hidden" },
    barFill: { height: 6, borderRadius: 3, backgroundColor: c.accent },
    balSub: { color: c.textMuted, fontSize: 11, marginTop: 6 },

    // list rows (leave taken + tasks)
    listRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 11,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.surfaceBorder,
    },
    leaveIcon: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: c.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    rowTitle: { color: c.text, fontSize: 13, fontWeight: "700" },
    rowSub: { color: c.textMuted, fontSize: 11, marginTop: 2 },

    addTaskBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      backgroundColor: c.accent,
      borderRadius: 12,
      paddingVertical: 12,
      marginTop: 14,
    },
    addTaskText: { color: "#fff", fontSize: 14, fontWeight: "800" },

    // Work Done notes
    wdBtn: {
      flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: c.accent, borderRadius: 14, paddingVertical: 13,
      paddingHorizontal: 16, marginTop: 12,
    },
    wdBtnText: { flex: 1, color: "#fff", fontSize: 14, fontWeight: "800" },
    wdMonthNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
    wdNavBtn: {
      width: 38, height: 38, borderRadius: 12, backgroundColor: c.surfaceMuted,
      alignItems: "center", justifyContent: "center",
    },
    wdMonthLabel: { color: c.text, fontSize: 15, fontWeight: "800" },
    wdSeg: { flexDirection: "row", backgroundColor: c.surfaceMuted, borderRadius: 12, padding: 4, gap: 4 },
    wdSegBtn: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 9 },
    wdSegBtnActive: { backgroundColor: c.accent },
    wdSegText: { color: c.textMuted, fontSize: 13, fontWeight: "700" },
    wdSegTextActive: { color: "#fff" },
    wdWeekRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
    wdWeekChip: {
      paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999,
      backgroundColor: c.surfaceMuted, borderWidth: 1, borderColor: c.surfaceBorder,
    },
    wdWeekChipActive: { backgroundColor: c.accent, borderColor: c.accent },
    wdWeekText: { color: c.textMuted, fontSize: 12, fontWeight: "800" },
    wdWeekTextActive: { color: "#fff" },
    wdItem: {
      paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.surfaceBorder,
    },
    wdDate: { color: c.accent, fontSize: 13, fontWeight: "800" },
    wdText: { color: c.text, fontSize: 14, lineHeight: 20, marginTop: 4 },
    wdEmpty: { color: c.textMuted, fontSize: 13, paddingVertical: 18, textAlign: "center" },

    kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },

    // modal
    label: { color: c.textMuted, fontSize: 11, letterSpacing: 1.2, fontWeight: "700", marginTop: 14, marginBottom: 6 },
    input: {
      backgroundColor: c.surfaceMuted,
      color: c.text,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      minHeight: 42,
    },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: c.surfaceMuted,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
    },
    chipActive: { backgroundColor: c.accent, borderColor: c.accent },
    chipText: { color: c.textMuted, fontSize: 11, fontWeight: "700" },
    chipTextActive: { color: "#fff" },
    btn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
    btnGhost: { backgroundColor: c.surfaceMuted },
    btnGhostText: { color: c.text, fontWeight: "700" },
    btnPrimary: { backgroundColor: c.accent },
    btnPrimaryText: { color: "#fff", fontWeight: "800" },
  });
