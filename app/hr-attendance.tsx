import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Share } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  hrListAttendance,
  hrMarkUnpaidLeave,
  HrAttendanceRow } from "../src/services/hrAttendance";
import { listUsers } from "../src/services/users";
import { listHolidays } from "../src/services/holidays";
import { User } from "../src/types";
import { dateToYMD, WebDateField } from "../src/components/WebDateField";
import { WebModal, ModalActions } from "../src/components/WebModal";
import { Avatar } from "../src/components/Avatar";
import { AttendanceCalendar } from "../src/components/AttendanceCalendar";
import { useTheme } from "../src/theme/ThemeProvider";
import { attendanceStatusColor } from "../src/theme/statusColors";
import { ATT, ATT_BG } from "../src/theme/attendanceColors";
import { notify } from "../src/utils/confirm";
import { openMaps } from "../src/utils/media";

const isWeb = Platform.OS === "web";
const PRESENT = new Set(["PRESENT", "CHECKED_IN", "COMPLETED", "LATE", "HALF_DAY"]);
type Cat = "office" | "wfh" | "client" | "leave" | "absent";
type Mode = "day" | "month";
type StatusFilter = "all" | Cat;
// Distinct tone for the client-location category (kept off the accent hue).
// Client days share the teal "Attended" tone (legend collapses attended types).
const CLIENT_FG = ATT.present;
const CLIENT_BG = ATT_BG.present;

// One employee, minimal shape used by the roster (so people with no
// attendance row still appear in the day view).
interface Person {
  id: string;
  name: string;
  email: string;
  profilePictureUrl?: string;
}

// Attendance times are stored/served as IST wall-clock — render as-is.
const parseServerDate = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
};
const formatHM = (iso?: string | null) => {
  const d = parseServerDate(iso);
  return d ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-";
};
const todayYMD = () => dateToYMD(new Date());
const hoursOf = (row?: HrAttendanceRow): number => {
  if (row?.hoursWorked) return row.hoursWorked;
  // Live-elapsed only makes sense for a session that is still open TODAY. For a
  // past day left open (missed checkout), Date.now() - checkIn would show a
  // wildly inflated "so far" figure, so fall back to 0 there.
  const inAt = parseServerDate(row?.checkIn);
  if (inAt && !row?.checkOut && row?.date === todayYMD()) {
    return Math.max(0, (Date.now() - inAt.getTime()) / 3600000);
  }
  return 0;
};
const todayMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const parseYMD = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
const prettyDate = (s: string) => {
  const d = parseYMD(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
};

const catOf = (r?: HrAttendanceRow): Cat => {
  if (!r) return "absent";
  if (r.attendanceType === "LEAVE") return "leave";
  if (r.attendanceType === "CLIENT") return "client";
  if (r.status === "ABSENT") return "absent";
  if (r.checkIn || PRESENT.has(r.status)) {
    return r.attendanceType === "WFH" ? "wfh" : "office";
  }
  return "absent";
};

export default function HrAttendance() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);

  const [mode, setMode] = useState<Mode>("day");
  const [date, setDate] = useState<string>(todayYMD());
  const [month, setMonth] = useState<string>(todayMonth());
  const [rows, setRows] = useState<HrAttendanceRow[]>([]);
  const [team, setTeam] = useState<Person[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftIds, setDraftIds] = useState<string[]>([]);
  const [detail, setDetail] = useState<{ member: Person; row?: HrAttendanceRow; cat: Cat } | null>(null);
  // Per-employee day-row action menu (mark / remove unpaid leave).
  const [leaveMenuFor, setLeaveMenuFor] = useState<{ member: Person; row?: HrAttendanceRow; cat: Cat } | null>(null);
  const [markingLeave, setMarkingLeave] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Work-done notes history (per member) + company work-done list
  const [notesFor, setNotesFor] = useState<Person | null>(null);
  const [notesRows, setNotesRows] = useState<HrAttendanceRow[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [teamListOpen, setTeamListOpen] = useState(false);

  // Month view: which employee row is expanded, per-employee calendar modal,
  // and the HR-declared holidays for the shown month (drive working-day math).
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [calFor, setCalFor] = useState<Person | null>(null);
  const [holidayMap, setHolidayMap] = useState<Record<string, string>>({});

  // Load holidays for the shown month's year so the summary + calendar can
  // exclude them from working days and paint them distinctly.
  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        if (!token) return;
        const year = Number(month.split("-")[0]);
        const hols = await listHolidays(token, { year });
        const map: Record<string, string> = {};
        (hols || []).forEach((h: any) => {
          if (h?.date) map[h.date] = h.name || "Holiday";
        });
        setHolidayMap(map);
      } catch {
        /* non-fatal — working-day math just won't subtract holidays */
      }
    })();
  }, [month]);

  const openNotes = async (member: Person) => {
    setDetail(null);
    setNotesFor(member);
    setNotesLoading(true);
    setNotesRows([]);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const list = await hrListAttendance(token, { userId: member.id, month });
      setNotesRows(
        (list || [])
          .filter((r) => r.workNotes && r.workNotes.trim())
          .sort((a, b) => b.date.localeCompare(a.date))
      );
    } catch (err: any) {
      notify("Couldn't load notes", err?.message || "");
    } finally {
      setNotesLoading(false);
    }
  };

  const copyText = async (text: string) => {
    try {
      const Clip = require("expo-clipboard");
      await Clip.setStringAsync(text);
      notify("Copied", "Ready to paste into chat.");
      return;
    } catch {
      /* native module not in this build — try web, else share */
    }
    if (typeof navigator !== "undefined" && (navigator as any).clipboard) {
      try {
        await (navigator as any).clipboard.writeText(text);
        notify("Copied", "Ready to paste into chat.");
        return;
      } catch {
        /* fall through to share */
      }
    }
    Share.share({ message: text }).catch(() => {});
  };

  const shareText = (text: string) => {
    Share.share({ message: text }).catch(() => {});
  };

  // Monotonic request id: only the most recently issued load may write state.
  // Without this, stepping through days (or toggling Day/Month) can let an
  // earlier request resolve AFTER a later one and overwrite `rows` with the
  // wrong day's data — showing one day's records under another day's header.
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const filters: any = mode === "day" ? { date } : { month };
      const [list, allUsers] = await Promise.all([
        hrListAttendance(token, filters),
        listUsers(token).catch(() => [] as User[]),
      ]);
      // A newer load started while we were awaiting — its result wins.
      if (seq !== loadSeq.current) return;
      setRows(list || []);
      setTeam(
        (allUsers || [])
          .filter((u) => u.status !== "Terminated")
          .map((u) => ({ id: u.id, name: u.name, email: u.email, profilePictureUrl: u.profilePictureUrl }))
      );
    } catch (err: any) {
      if (seq !== loadSeq.current) return;
      notify("Couldn't load attendance", err?.message || "Pull down to retry.");
    } finally {
      if (seq === loadSeq.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [mode, date, month, router]);

  useEffect(() => {
    load();
  }, [load]);

  // Mark (or clear) one employee's day as unpaid leave.
  //
  // Two entry points share this: the row's ⋮ menu (which always acts on the
  // currently-selected `date`) and the month calendar (which passes the day
  // the HR user tapped). Taking userId/day as arguments keeps the calendar
  // from having to move the whole screen to that date first.
  // Both entry points (the row ⋮ menu and the month calendar) open this
  // confirmation rather than firing straight away — marking a day unpaid
  // moves someone's pay, so it shouldn't be one stray tap.
  const [unpaidConfirm, setUnpaidConfirm] = useState<{
    userId: string;
    name: string;
    dayKey: string;
    next: boolean;
    currentReason?: string | null;
  } | null>(null);
  const [unpaidReason, setUnpaidReason] = useState("");

  const askUnpaid = (
    userId: string,
    name: string,
    dayKey: string,
    next: boolean,
    currentReason?: string | null
  ) => {
    setUnpaidReason("");
    setUnpaidConfirm({ userId, name, dayKey, next, currentReason });
  };

  const applyUnpaid = async () => {
    if (!unpaidConfirm || markingLeave) return;
    const { userId, dayKey, next } = unpaidConfirm;
    setMarkingLeave(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await hrMarkUnpaidLeave(
        token,
        userId,
        dayKey,
        next,
        unpaidReason.trim() || undefined
      );
      notify(next ? "Marked as unpaid leave" : "Unpaid leave removed");
      setUnpaidConfirm(null);
      setUnpaidReason("");
      load();
    } catch (err: any) {
      notify("Couldn't update", err?.message || "");
    } finally {
      setMarkingLeave(false);
    }
  };

  const markUnpaid = (unpaid: boolean) => {
    if (!leaveMenuFor) return;
    const row = leaveMenuFor.row;
    setLeaveMenuFor(null);
    askUnpaid(
      leaveMenuFor.member.id,
      leaveMenuFor.member.name,
      date,
      unpaid,
      row?.unpaidReason
    );
  };

  // Day view: one entry per employee (so people with no check-in still show).
  const entries = useMemo(() => {
    const byUser = new Map(rows.map((r) => [r.userId, r]));
    return team.map((m) => {
      const row = byUser.get(m.id);
      return { member: m, row, cat: catOf(row) };
    });
  }, [rows, team]);

  const teamWorkDone = useMemo(
    () =>
      entries
        .filter((e) => e.row?.workNotes && e.row.workNotes.trim())
        .map((e) => ({ name: e.member.name, notes: e.row!.workNotes!.trim() })),
    [entries]
  );

  const buildTeamWorkText = () => {
    const header = `📋 Company Work Done — ${prettyDate(date)}`;
    const body = teamWorkDone.length
      ? teamWorkDone.map((w) => `• ${w.name}: ${w.notes}`).join("\n")
      : "No work notes submitted yet.";
    return `${header}\n\n${body}`;
  };

  const kpis = useMemo(() => {
    let office = 0, wfh = 0, client = 0, leave = 0, absent = 0;
    entries.forEach((e) => {
      if (e.cat === "office") office++;
      else if (e.cat === "wfh") wfh++;
      else if (e.cat === "client") client++;
      else if (e.cat === "leave") leave++;
      else absent++;
    });
    return { office, wfh, client, leave, absent, total: entries.length };
  }, [entries]);

  const shiftDay = (delta: number) => {
    const d = parseYMD(date);
    d.setDate(d.getDate() + delta);
    setDate(dateToYMD(d));
  };

  const q = query.trim().toLowerCase();
  const dayList = useMemo(
    () =>
      entries
        .filter((e) => statusFilter === "all" || e.cat === statusFilter)
        .filter((e) => selectedIds.length === 0 || selectedIds.includes(e.member.id))
        .filter((e) => !q || e.member.name.toLowerCase().includes(q)),
    [entries, statusFilter, selectedIds, q]
  );
  // Month view: one summary per employee with attendance %.
  const monthList = useMemo(() => {
    const byUser = new Map<string, HrAttendanceRow[]>();
    rows.forEach((r) => {
      const arr = byUser.get(r.userId) || [];
      arr.push(r);
      byUser.set(r.userId, arr);
    });
    return team
      .map((m) => {
        const mine = byUser.get(m.id) || [];
        let office = 0, wfh = 0, client = 0, leave = 0, absent = 0, late = 0;
        mine.forEach((r) => {
          const cat = catOf(r);
          if (cat === "office") office++;
          else if (cat === "wfh") wfh++;
          else if (cat === "client") client++;
          else if (cat === "leave") leave++;
          else absent++;
          if (r.isLate) late++;
        });
        const present = office + wfh + client;
        const recorded = present + absent;
        const rate = recorded > 0 ? Math.round((present / recorded) * 100) : 0;
        return { member: m, present, office, wfh, client, leave, absent, late, recorded, rate, hasData: mine.length > 0 };
      })
      .filter((e) => selectedIds.length === 0 || selectedIds.includes(e.member.id))
      .filter((e) => !q || e.member.name.toLowerCase().includes(q));
  }, [rows, team, selectedIds, q]);

  const teamAvg = useMemo(() => {
    const withData = monthList.filter((e) => e.recorded > 0);
    if (!withData.length) return 0;
    return Math.round(withData.reduce((s, e) => s + e.rate, 0) / withData.length);
  }, [monthList]);

  // Calendar math for the shown month: days, holidays, and working days
  // (Sundays are the weekly off; HR-declared holidays are excluded too).
  const monthMeta = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    if (!y || !m) return { daysInMonth: 0, holidays: 0, sundays: 0, workingTotal: 0, workingElapsed: 0 };
    const daysInMonth = new Date(y, m, 0).getDate();
    const today = todayYMD();
    const pad = (n: number) => String(n).padStart(2, "0");
    let holidays = 0, sundays = 0, workingTotal = 0, workingElapsed = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${y}-${pad(m)}-${pad(d)}`;
      const isSunday = new Date(y, m - 1, d).getDay() === 0;
      const isHoliday = !!holidayMap[key];
      // Sunday takes precedence so a holiday that lands on a Sunday isn't
      // counted twice in the "Holidays" total.
      if (isSunday) {
        sundays++;
      } else if (isHoliday) {
        holidays++;
      } else {
        workingTotal++;
        if (key <= today) workingElapsed++;
      }
    }
    return { daysInMonth, holidays, sundays, workingTotal, workingElapsed };
  }, [month, holidayMap]);

  const prettyMonth = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    if (!y || !m) return month;
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }, [month]);

  const rateColor = (rate: number) =>
    rate >= 90 ? c.successText : rate >= 75 ? c.warningText : c.dangerText;

  const openFilter = () => {
    setDraftIds(selectedIds);
    setFilterOpen(true);
  };
  const toggleDraft = (id: string) =>
    setDraftIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const renderDayRow = (e: { member: Person; row?: HrAttendanceRow; cat: Cat }) => {
    const { member, row, cat } = e;
    let pill: string, tone: { bg: string; fg: string }, meta: string;
    if (cat === "client") {
      pill = "CLIENT";
      tone = { bg: CLIENT_BG, fg: CLIENT_FG };
      const h = hoursOf(row);
      const hStr = h > 0 ? ` · ${h.toFixed(1)}h${!row?.checkOut ? " so far" : ""}` : "";
      const where = row?.clientName
        ? `${row.clientName} · `
        : row?.clientAddress ? `${row.clientAddress} · ` : "";
      meta = `${where}In ${formatHM(row?.checkIn)} · Out ${formatHM(row?.checkOut)}${hStr}`;
    } else if (cat === "leave") {
      pill = "ON LEAVE";
      tone = { bg: ATT_BG.leave, fg: ATT.leave };
      meta = "Approved leave";
    } else if (cat === "absent") {
      pill = "NOT IN";
      tone = { bg: ATT_BG.absent, fg: ATT.absent };
      meta = "No check-in yet";
    } else {
      const late = !!row?.isLate;
      if (cat === "wfh") {
        pill = "WFH";
        tone = { bg: ATT_BG.wfh, fg: ATT.wfh };
      } else {
        pill = late ? "LATE" : row?.status || "PRESENT";
        tone = late ? { bg: c.warningBg, fg: c.warningText } : attendanceStatusColor(row?.status, c);
      }
      const h = hoursOf(row);
      const hStr = h > 0 ? ` · ${h.toFixed(1)}h${!row?.checkOut ? " so far" : ""}` : "";
      meta = `In ${formatHM(row?.checkIn)} · Out ${formatHM(row?.checkOut)}${hStr}${
        cat === "wfh" && late ? " · late" : ""
      }`;
    }
    // HR-marked unpaid leave overrides the derived look (orange "UNPAID LEAVE").
    if (row?.unpaid) {
      pill = "UNPAID LEAVE";
      tone = { bg: ATT_BG.unpaid, fg: ATT.unpaid };
      meta = "Unpaid leave (LOP) — deducted in payroll";
    }
    return (
      <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={() => setDetail(e)}>
        <Avatar name={member.name} uri={member.profilePictureUrl} size={38} bg={c.accentSoft} fg={c.accentText} />
        <View style={{ flex: 1 }}>
          <Text style={styles.rowName} numberOfLines={1}>{member.name}</Text>
          <Text style={styles.rowMeta}>{meta}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
          <Text style={[styles.statusText, { color: tone.fg }]}>{pill}</Text>
        </View>
        <TouchableOpacity
          hitSlop={10}
          style={styles.rowMenuBtn}
          // Nested inside the row's Touchable: on react-native-web the outer
          // onPress fires too, so the detail sheet opened over this menu and
          // the unpaid-leave actions looked missing.
          onPress={(ev: any) => {
            ev?.stopPropagation?.();
            setLeaveMenuFor(e);
          }}
        >
          <Ionicons name="ellipsis-vertical" size={16} color={c.textMuted} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity hitSlop={10} onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}>
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Daily Attendance</Text>
        {/* Client location lives in the day-detail popup (with a map button)
            — no separate page. */}
        <TouchableOpacity hitSlop={10} onPress={() => setTeamListOpen(true)}>
          <Ionicons name="clipboard-outline" size={22} color={c.accent} />
        </TouchableOpacity>
      </View>

      {/* Day / Month segmented */}
      <View style={styles.segmentWrap}>
        <View style={styles.segment}>
          {(["day", "month"] as Mode[]).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.segBtn, mode === m && styles.segBtnActive]}
              onPress={() => setMode(m)}
              activeOpacity={0.85}
            >
              <Text style={[styles.segText, mode === m && styles.segTextActive]}>
                {m === "day" ? "Day" : "Month"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Date control */}
      <View style={styles.dateBar}>
        {mode === "day" ? (
          <>
            <TouchableOpacity style={styles.stepBtn} onPress={() => shiftDay(-1)}>
              <Ionicons name="chevron-back" size={18} color={c.text} />
            </TouchableOpacity>
            <View style={styles.dateCenter}>
              {isWeb ? (
                <WebDateField mode="date" value={date} onChange={(v) => v && setDate(v)} />
              ) : (
                <Text style={styles.dateLabel}>{prettyDate(date)}</Text>
              )}
              {date !== todayYMD() && (
                <TouchableOpacity onPress={() => setDate(todayYMD())}>
                  <Text style={styles.todayLink}>Today</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity style={styles.stepBtn} onPress={() => shiftDay(1)}>
              <Ionicons name="chevron-forward" size={18} color={c.text} />
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.monthField}>
            <Ionicons name="calendar-outline" size={16} color={c.textMuted} />
            <TextInput
              style={styles.monthInput}
              value={month}
              onChangeText={setMonth}
              placeholder="YYYY-MM"
              placeholderTextColor={c.textFaint}
              autoCapitalize="none"
            />
          </View>
        )}
      </View>

      {/* KPIs (day) — tap to filter */}
      {mode === "day" && (
        <View style={styles.kpiRow}>
          <Kpi
            c={c}
            active={statusFilter === "office"}
            onPress={() => setStatusFilter(statusFilter === "office" ? "all" : "office")}
            value={kpis.office}
            label="In office"
            icon="business"
            tint={ATT.present}
            tintBg={ATT_BG.present}
          />
          <Kpi
            c={c}
            active={statusFilter === "wfh"}
            onPress={() => setStatusFilter(statusFilter === "wfh" ? "all" : "wfh")}
            value={kpis.wfh}
            label="WFH"
            icon="home"
            tint={ATT.wfh}
            tintBg={ATT_BG.wfh}
          />
          <Kpi
            c={c}
            active={statusFilter === "client"}
            onPress={() => setStatusFilter(statusFilter === "client" ? "all" : "client")}
            value={kpis.client}
            label="Client"
            icon="navigate"
            tint={CLIENT_FG}
            tintBg={CLIENT_BG}
          />
          <Kpi
            c={c}
            active={statusFilter === "leave"}
            onPress={() => setStatusFilter(statusFilter === "leave" ? "all" : "leave")}
            value={kpis.leave}
            label="On leave"
            icon="airplane"
            tint={ATT.leave}
            tintBg={ATT_BG.leave}
          />
          <Kpi
            c={c}
            active={statusFilter === "absent"}
            onPress={() => setStatusFilter(statusFilter === "absent" ? "all" : "absent")}
            value={kpis.absent}
            label="Not in"
            icon="alert-circle"
            tint={ATT.absent}
            tintBg={ATT_BG.absent}
          />
        </View>
      )}

      {/* Search + people filter */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={17} color={c.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search a person…"
            placeholderTextColor={c.textFaint}
          />
          {query.length > 0 && (
            <TouchableOpacity hitSlop={8} onPress={() => setQuery("")}>
              <Ionicons name="close-circle" size={17} color={c.textFaint} />
            </TouchableOpacity>
          )}
        </View>
        {team.length > 0 && (
          <TouchableOpacity
            style={[styles.filterBtn, selectedIds.length > 0 && styles.filterBtnActive]}
            onPress={openFilter}
            activeOpacity={0.8}
          >
            <Ionicons name="funnel" size={16} color={selectedIds.length > 0 ? "#fff" : c.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {mode === "day" ? (
        <FlatList
          data={dayList}
          keyExtractor={(e) => e.member.id}
          style={styles.list}
          contentContainerStyle={dayList.length === 0 ? styles.emptyWrap : { padding: 16, paddingTop: 8, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={c.accent} colors={[c.accent]} />
          }
          ListEmptyComponent={<Empty c={c} text="No one matches these filters." />}
          renderItem={({ item }) => renderDayRow(item)}
        />
      ) : (
        <FlatList
          data={monthList}
          keyExtractor={(e) => e.member.id}
          style={styles.list}
          contentContainerStyle={monthList.length === 0 ? styles.emptyWrap : { padding: 16, paddingTop: 8, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={c.accent} colors={[c.accent]} />
          }
          ListHeaderComponent={
            <View style={styles.monthSummary}>
              <View style={styles.msTop}>
                <Ionicons name="calendar-outline" size={18} color={c.accent} />
                <Text style={styles.msTitle}>{prettyMonth}</Text>
                {monthList.some((e) => e.recorded > 0) && (
                  <View style={styles.msAvgPill}>
                    <Text style={styles.msAvgLabel}>Avg attendance</Text>
                    <Text style={[styles.msAvgVal, { color: rateColor(teamAvg) }]}>{teamAvg}%</Text>
                  </View>
                )}
              </View>
              <View style={styles.msStats}>
                <MetaStat c={c} value={monthMeta.daysInMonth} label="Days in month" />
                <MetaStat
                  c={c}
                  value={monthMeta.holidays + monthMeta.sundays}
                  label="Holidays"
                  sub={monthMeta.sundays > 0 ? `incl. ${monthMeta.sundays} Sundays` : undefined}
                />
                <MetaStat
                  c={c}
                  value={monthMeta.workingElapsed}
                  label="Working days"
                  sub={
                    monthMeta.workingElapsed !== monthMeta.workingTotal
                      ? `so far · ${monthMeta.workingTotal} total`
                      : undefined
                  }
                />
              </View>
              <Text style={styles.msHint}>Tap an employee to see their breakdown, work done and calendar.</Text>
            </View>
          }
          ListEmptyComponent={<Empty c={c} text="No attendance records this month." />}
          renderItem={({ item }) => {
            const rc = rateColor(item.rate);
            const expanded = expandedId === item.member.id;
            // Never let the worked count exceed the denominator — someone can
            // work a Sunday/holiday, pushing "present" above the working days.
            const baseDenom = monthMeta.workingElapsed || item.recorded || 0;
            const denom = Math.max(baseDenom, item.present + item.leave);
            // Working days with no positive attendance = "no record found".
            const noRecord = Math.max(0, denom - item.present - item.leave);
            return (
              <View style={styles.mCard}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setExpandedId(expanded ? null : item.member.id)}
                  style={styles.mTop}
                >
                  <Avatar name={item.member.name} uri={item.member.profilePictureUrl} size={38} bg={c.accentSoft} fg={c.accentText} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName} numberOfLines={1}>{item.member.name}</Text>
                    <Text style={styles.mSub}>
                      {item.hasData ? `${item.rate}% attendance` : "No records this month"}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end", marginRight: 4 }}>
                    <Text style={styles.mWorked}>
                      <Text style={{ color: rc }}>{item.present}</Text>
                      <Text style={styles.mWorkedDenom}>/{denom}</Text>
                    </Text>
                    <Text style={styles.mWorkedLabel}>days worked</Text>
                  </View>
                  <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color={c.textFaint} />
                </TouchableOpacity>

                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${item.rate}%`, backgroundColor: rc }]} />
                </View>

                {expanded && (
                  <>
                    <View style={styles.chipRow}>
                      <StatChip c={c} icon="business" tint={ATT.present} label="Office" value={item.office} />
                      <StatChip c={c} icon="home" tint={ATT.wfh} label="WFH" value={item.wfh} />
                      <StatChip c={c} icon="navigate" tint={ATT.present} label="Client" value={item.client} />
                      <StatChip c={c} icon="airplane" tint={ATT.leave} label="Leave" value={item.leave} />
                      <StatChip c={c} icon="time" tint={c.warningText} label="Late" value={item.late} />
                      <StatChip c={c} icon="help-circle" tint={ATT.absent} label="No record" value={noRecord} />
                    </View>
                    <View style={styles.mActions}>
                      <TouchableOpacity style={styles.mActionBtn} onPress={() => openNotes(item.member)} activeOpacity={0.8}>
                        <Ionicons name="document-text-outline" size={15} color={c.accent} />
                        <Text style={styles.mActionText}>Work done</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.mActionBtn} onPress={() => setCalFor(item.member)} activeOpacity={0.8}>
                        <Ionicons name="calendar-outline" size={15} color={c.accent} />
                        <Text style={styles.mActionText}>Calendar</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            );
          }}
        />
      )}

      {/* People filter modal */}
      <WebModal
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Filter by people"
        size="md"
        showCloseButton={false}
        footer={
          <ModalActions align="spread">
            <TouchableOpacity style={[styles.mBtn, styles.mBtnGhost]} onPress={() => setDraftIds([])}>
              <Text style={styles.mBtnGhostText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.mBtn, styles.mBtnPrimary]}
              onPress={() => { setSelectedIds(draftIds); setFilterOpen(false); }}
            >
              <Text style={styles.mBtnPrimaryText}>Apply{draftIds.length ? ` (${draftIds.length})` : ""}</Text>
            </TouchableOpacity>
          </ModalActions>
        }
      >
        {team.map((m) => {
          const checked = draftIds.includes(m.id);
          return (
            <TouchableOpacity key={m.id} style={styles.pplRow} onPress={() => toggleDraft(m.id)} activeOpacity={0.7}>
              <Avatar name={m.name} uri={m.profilePictureUrl} size={36} bg={c.accent} fg="#fff" fontSize={15} />
              <View style={{ flex: 1 }}>
                <Text style={styles.pplName}>{m.name}</Text>
                {!!m.email && <Text style={styles.pplEmail} numberOfLines={1}>{m.email}</Text>}
              </View>
              <Ionicons name={checked ? "checkbox" : "square-outline"} size={22} color={checked ? c.accent : c.textFaint} />
            </TouchableOpacity>
          );
        })}
      </WebModal>

      {/* Attendance detail */}
      <WebModal
        visible={!!detail}
        onClose={() => setDetail(null)}
        title="Attendance"
        size="md"
        showCloseButton={false}
        footer={
          <ModalActions align="spread">
            <TouchableOpacity style={[styles.mBtn, styles.mBtnGhost]} onPress={() => setDetail(null)}>
              <Text style={styles.mBtnGhostText}>Close</Text>
            </TouchableOpacity>
            {detail && (
              <TouchableOpacity style={[styles.mBtn, styles.mBtnPrimary]} onPress={() => openNotes(detail.member)}>
                <Text style={styles.mBtnPrimaryText}>Work Done notes</Text>
              </TouchableOpacity>
            )}
          </ModalActions>
        }
      >
        {detail && (() => {
          const { member, row, cat } = detail;
          const label =
            cat === "client" ? "At a client location"
            : cat === "leave" ? "On leave"
            : cat === "absent" ? "Not checked in"
            : cat === "wfh" ? "Work from home"
            : "In office";
          return (
            <View>
              <View style={styles.dHead}>
                <Avatar name={member.name} uri={member.profilePictureUrl} size={44} bg={c.accent} fg="#fff" fontSize={18} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.dName}>{member.name}</Text>
                  <Text style={styles.dState}>{label}{row?.date ? ` · ${row.date}` : ""}</Text>
                </View>
                {row?.isLate && (
                  <View style={[styles.statusPill, { backgroundColor: c.warningBg }]}>
                    <Text style={[styles.statusText, { color: c.warningText }]}>LATE</Text>
                  </View>
                )}
              </View>

              {cat === "client" ? (
                <>
                  <View style={styles.dInfoRow}>
                    <Ionicons name="navigate-outline" size={18} color={CLIENT_FG} />
                    <Text style={styles.dInfoText}>
                      {row?.clientName
                        ? `${row.clientName}${row?.clientAddress ? ` — ${row.clientAddress}` : ""}`
                        : row?.clientAddress || "Working from a client location."}
                    </Text>
                  </View>
                  {(row?.latitude != null || !!row?.clientAddress) && (
                    <TouchableOpacity
                      style={styles.mapBtn}
                      activeOpacity={0.85}
                      onPress={() =>
                        openMaps(row?.latitude, row?.longitude, row?.clientAddress)
                      }
                    >
                      <Ionicons name="map-outline" size={16} color="#fff" />
                      <Text style={styles.mapBtnText}>View on map</Text>
                    </TouchableOpacity>
                  )}
                  <View style={styles.dGrid}>
                    <DetailStat c={c} icon="log-in-outline" label="Check in" value={formatHM(row?.checkIn)} />
                    <DetailStat c={c} icon="log-out-outline" label="Check out" value={row?.checkOut ? formatHM(row.checkOut) : "Open"} />
                    <DetailStat
                      c={c}
                      icon="time-outline"
                      label={row?.checkOut ? "Hours" : "So far"}
                      value={hoursOf(row) > 0 ? `${hoursOf(row).toFixed(1)}h` : "—"}
                    />
                  </View>
                  <Text style={styles.dLabel}>Work notes</Text>
                  <Text style={styles.dNotes}>
                    {row?.workNotes?.trim() || "No notes added for this day."}
                  </Text>
                </>
              ) : cat === "absent" ? (
                <View style={styles.dInfoRow}>
                  <Ionicons name="alert-circle-outline" size={18} color={c.textMuted} />
                  <Text style={styles.dInfoText}>No check-in recorded for this day.</Text>
                </View>
              ) : cat === "leave" ? (
                <View style={styles.dInfoRow}>
                  <Ionicons name="airplane-outline" size={18} color={c.textMuted} />
                  <Text style={styles.dInfoText}>On approved leave.</Text>
                </View>
              ) : (
                <>
                  <View style={styles.dGrid}>
                    <DetailStat c={c} icon="log-in-outline" label="Check in" value={formatHM(row?.checkIn)} />
                    <DetailStat c={c} icon="log-out-outline" label="Check out" value={formatHM(row?.checkOut)} />
                    <DetailStat
                      c={c}
                      icon="time-outline"
                      label={row?.checkOut ? "Hours" : "So far"}
                      value={hoursOf(row) > 0 ? `${hoursOf(row).toFixed(1)}h` : "—"}
                    />
                  </View>
                  <Text style={styles.dLabel}>Work notes</Text>
                  <Text style={styles.dNotes}>
                    {row?.workNotes?.trim() ? row.workNotes : "No notes added for this day."}
                  </Text>
                </>
              )}
            </View>
          );
        })()}
      </WebModal>

      {/* Work Done notes — history for one employee */}
      <WebModal
        visible={!!notesFor}
        onClose={() => setNotesFor(null)}
        title={notesFor ? `${notesFor.name} · Work done` : "Work done"}
        subtitle={month}
        size="md"
        showCloseButton={false}
        footer={
          <ModalActions align="spread">
            <TouchableOpacity style={[styles.mBtn, styles.mBtnGhost]} onPress={() => setNotesFor(null)}>
              <Text style={styles.mBtnGhostText}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.mBtn, styles.mBtnPrimary]}
              onPress={() => {
                const header = `${notesFor?.name} · Work done (${month})`;
                const body = notesRows.length
                  ? notesRows.map((r) => `${r.date}\n${r.workNotes?.trim()}`).join("\n\n")
                  : "No work notes.";
                copyText(`${header}\n\n${body}`);
              }}
            >
              <Text style={styles.mBtnPrimaryText}>Copy</Text>
            </TouchableOpacity>
          </ModalActions>
        }
      >
        {notesLoading ? (
          <ActivityIndicator color={c.accent} style={{ paddingVertical: 24 }} />
        ) : notesRows.length === 0 ? (
          <Text style={styles.dNotes}>No work notes for this month.</Text>
        ) : (
          notesRows.map((r, i) => (
            <View key={r.id} style={[styles.noteItem, i === 0 && { borderTopWidth: 0 }]}>
              <View style={styles.noteDateRow}>
                <Ionicons name="calendar-outline" size={14} color={c.accent} />
                <Text style={styles.noteDate}>{r.date}</Text>
                {r.hoursWorked ? <Text style={styles.noteHrs}>{r.hoursWorked.toFixed(1)}h</Text> : null}
              </View>
              <Text style={styles.noteText}>{r.workNotes?.trim()}</Text>
            </View>
          ))
        )}
      </WebModal>

      {/* Company work done list — copyable for the CEO */}
      <WebModal
        visible={teamListOpen}
        onClose={() => setTeamListOpen(false)}
        title="Company work done"
        subtitle={prettyDate(date)}
        size="md"
        showCloseButton={false}
        footer={
          <ModalActions align="spread">
            <TouchableOpacity style={[styles.mBtn, styles.mBtnGhost]} onPress={() => shareText(buildTeamWorkText())}>
              <Text style={styles.mBtnGhostText}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.mBtn, styles.mBtnPrimary]} onPress={() => copyText(buildTeamWorkText())}>
              <Text style={styles.mBtnPrimaryText}>Copy</Text>
            </TouchableOpacity>
          </ModalActions>
        }
      >
        {teamWorkDone.length === 0 ? (
          <Text style={styles.dNotes}>No work notes submitted for {prettyDate(date)} yet.</Text>
        ) : (
          <>
            <Text style={styles.dLabel}>{teamWorkDone.length} employee(s) · tap Copy to paste in chat</Text>
            <Text selectable style={styles.copyBlock}>
              {buildTeamWorkText()}
            </Text>
          </>
        )}
      </WebModal>

      {/* Per-employee attendance calendar — everything the employee sees */}
      <WebModal
        visible={!!calFor}
        onClose={() => setCalFor(null)}
        title={calFor ? calFor.name : "Attendance calendar"}
        subtitle={prettyMonth}
        size="md"
        showCloseButton
      >
        {calFor && (
          <AttendanceCalendar
            monthStr={month}
            rows={rows.filter((r) => r.userId === calFor.id)}
            holidayMap={holidayMap}
            // Lets HR pick any day of the month here instead of stepping the
            // whole screen day by day to reach it.
            onToggleUnpaid={(dayKey, next, rec) =>
              askUnpaid(
                calFor.id,
                calFor.name,
                dayKey,
                next,
                (rec as any)?.unpaidReason
              )
            }
          />
        )}
      </WebModal>

      {/* Confirm marking / clearing an unpaid day, with an optional reason. */}
      <WebModal
        visible={!!unpaidConfirm}
        onClose={() => setUnpaidConfirm(null)}
        title={
          unpaidConfirm?.next
            ? "Mark as unpaid leave?"
            : "Remove unpaid leave?"
        }
        subtitle={
          unpaidConfirm
            ? `${unpaidConfirm.name} · ${prettyDate(unpaidConfirm.dayKey)}`
            : undefined
        }
        size="sm"
        scrollable={false}
        footer={
          <ModalActions align="spread">
            <TouchableOpacity
              style={styles.uCancel}
              onPress={() => setUnpaidConfirm(null)}
              disabled={markingLeave}
            >
              <Text style={styles.uCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.uConfirm, markingLeave && { opacity: 0.5 }]}
              onPress={applyUnpaid}
              disabled={markingLeave}
            >
              {markingLeave ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.uConfirmText}>
                  {unpaidConfirm?.next ? "Mark unpaid" : "Remove"}
                </Text>
              )}
            </TouchableOpacity>
          </ModalActions>
        }
      >
        <Text style={styles.uBody}>
          {unpaidConfirm?.next
            ? "This day becomes Loss of Pay — it is excluded from paid days and deducted in payroll. Any existing record for the day is replaced."
            : "This clears the unpaid marker and deletes the day's record. Attendance for the day goes back to having no entry."}
        </Text>

        {!unpaidConfirm?.next && !!unpaidConfirm?.currentReason && (
          <Text style={styles.uCurrent}>
            Marked because: {unpaidConfirm.currentReason}
          </Text>
        )}

        {unpaidConfirm?.next && (
          <>
            <Text style={styles.uLabel}>REASON (OPTIONAL)</Text>
            <TextInput
              style={styles.uInput}
              value={unpaidReason}
              onChangeText={setUnpaidReason}
              placeholder="e.g. Unapproved absence"
              placeholderTextColor={c.textFaint}
              editable={!markingLeave}
              multiline
              maxLength={300}
            />
          </>
        )}
      </WebModal>

      {/* Per-employee day action menu — mark / remove unpaid leave */}
      <WebModal
        visible={!!leaveMenuFor}
        onClose={() => setLeaveMenuFor(null)}
        title="Attendance action"
        subtitle={leaveMenuFor ? `${leaveMenuFor.member.name} · ${prettyDate(date)}` : undefined}
        size="sm"
        scrollable={false}
      >
        {leaveMenuFor && (
          <>
            {leaveMenuFor.row?.unpaid ? (
              <TouchableOpacity
                style={[styles.menuItem, markingLeave && { opacity: 0.5 }]}
                disabled={markingLeave}
                onPress={() => markUnpaid(false)}
              >
                <Ionicons name="close-circle-outline" size={18} color={c.text} />
                <Text style={styles.menuItemText}>Remove unpaid leave</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.menuItem, markingLeave && { opacity: 0.5 }]}
                disabled={markingLeave}
                onPress={() => markUnpaid(true)}
              >
                <Ionicons name="remove-circle-outline" size={18} color={ATT.unpaid} />
                <Text style={[styles.menuItemText, { color: ATT.unpaid }]}>Mark as unpaid leave</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.menuHint}>
              Unpaid (LOP) days are deducted from salary in payroll and show orange on the calendar.
              Paid leave is what an employee requests against their leave balance.
            </Text>
          </>
        )}
      </WebModal>
    </SafeAreaView>
  );
}

function MetaStat({ c, value, label, sub }: { c: any; value: number; label: string; sub?: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={{ color: c.text, fontSize: 21, fontWeight: "800" }}>{value}</Text>
      <Text style={{ color: c.textMuted, fontSize: 11, fontWeight: "600", marginTop: 2 }}>{label}</Text>
      {!!sub && <Text style={{ color: c.textFaint, fontSize: 10, marginTop: 1 }}>{sub}</Text>}
    </View>
  );
}

function StatChip({ c, icon, tint, label, value }: { c: any; icon: any; tint: string; label: string; value: number }) {
  const on = value > 0;
  return (
    <View
      style={{
        flexGrow: 1,
        flexBasis: "30%",
        minWidth: 84,
        alignItems: "center",
        gap: 2,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: c.surfaceMuted,
        opacity: on ? 1 : 0.55,
      }}
    >
      <Ionicons name={icon} size={14} color={on ? tint : c.textFaint} />
      <Text style={{ color: on ? c.text : c.textMuted, fontSize: 15, fontWeight: "800" }}>{value}</Text>
      <Text style={{ color: c.textMuted, fontSize: 9.5, fontWeight: "600" }} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function DetailStat({ c, icon, label, value }: { c: any; icon: any; label: string; value: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: c.surfaceMuted, borderRadius: 12, padding: 12, alignItems: "center", gap: 4 }}>
      <Ionicons name={icon} size={18} color={c.textMuted} />
      <Text style={{ color: c.text, fontSize: 15, fontWeight: "800" }}>{value}</Text>
      <Text style={{ color: c.textMuted, fontSize: 10 }}>{label}</Text>
    </View>
  );
}

function Kpi({
  c, active, onPress, value, label, icon, tint, tintBg,
}: {
  c: any; active: boolean; onPress: () => void; value: number; label: string; icon: any; tint: string; tintBg: string;
}) {
  return (
    <TouchableOpacity
      style={[
        {
          flex: 1,
          backgroundColor: c.surface,
          borderRadius: 14,
          borderWidth: 1.5,
          borderColor: active ? tint : c.surfaceBorder,
          paddingVertical: 10,
          paddingHorizontal: 8,
        },
      ]}
      activeOpacity={0.8}
      onPress={onPress}
    >
      <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: tintBg, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={15} color={tint} />
      </View>
      <Text style={{ color: c.text, fontSize: 20, fontWeight: "800", marginTop: 8 }}>{value}</Text>
      <Text style={{ color: c.textMuted, fontSize: 10.5, fontWeight: "600" }} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

function Empty({ c, text }: { c: any; text: string }) {
  return (
    <View style={{ alignItems: "center", gap: 10, padding: 40 }}>
      <Ionicons name="people-outline" size={40} color={c.textFaint} />
      <Text style={{ color: c.textMuted, fontSize: 13, textAlign: "center" }}>{text}</Text>
    </View>
  );
}

const makeStyles = (c: any) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    loader: { flex: 1, backgroundColor: c.bg, justifyContent: "center", alignItems: "center" },

    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      height: 52,
    },
    title: { color: c.text, fontSize: 18, fontWeight: "700" },

    segmentWrap: { paddingHorizontal: 16, paddingTop: 2 },
    segment: { flexDirection: "row", backgroundColor: c.surfaceMuted, borderRadius: 12, padding: 4, gap: 4 },
    segBtn: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 9 },
    segBtnActive: { backgroundColor: c.accent },
    segText: { color: c.textMuted, fontSize: 13, fontWeight: "700" },
    segTextActive: { color: "#fff" },

    dateBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 12, gap: 10 },
    stepBtn: {
      width: 40, height: 40, borderRadius: 12, backgroundColor: c.surfaceMuted,
      alignItems: "center", justifyContent: "center",
    },
    dateCenter: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2 },
    dateLabel: { color: c.text, fontSize: 15, fontWeight: "700" },
    todayLink: { color: c.accent, fontSize: 12, fontWeight: "700" },
    monthField: {
      flex: 1, flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: c.surfaceMuted, borderRadius: 12, paddingHorizontal: 12, height: 42,
    },
    monthInput: { flex: 1, color: c.text, fontSize: 14 },

    kpiRow: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 14 },

    searchRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 12 },
    searchBox: {
      flex: 1, flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: c.surfaceMuted, borderRadius: 12, paddingHorizontal: 12, height: 42,
    },
    searchInput: { flex: 1, color: c.text, fontSize: 14, padding: 0 },
    filterBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: c.surfaceMuted, alignItems: "center", justifyContent: "center" },
    filterBtnActive: { backgroundColor: c.accent },

    row: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.surface,
      padding: 12,
      borderRadius: 12,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      gap: 12,
    },
    avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: c.accentSoft, alignItems: "center", justifyContent: "center" },
    avatarText: { color: c.accentText, fontWeight: "700" },
    rowName: { color: c.text, fontSize: 14, fontWeight: "700" },
    rowMeta: { color: c.textMuted, fontSize: 12, marginTop: 3 },
    statusPill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
    statusText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
    rowMenuBtn: { width: 26, height: 30, alignItems: "center", justifyContent: "center" },
    uBody: { color: c.textMuted, fontSize: 13, lineHeight: 19 },
    uCurrent: {
      color: c.text,
      fontSize: 12.5,
      marginTop: 10,
      padding: 10,
      borderRadius: 8,
      backgroundColor: c.surfaceMuted,
    },
    uLabel: {
      color: c.textFaint,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.6,
      marginTop: 16,
      marginBottom: 6,
    },
    uInput: {
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      backgroundColor: c.surface,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: c.text,
      fontSize: 14,
      minHeight: 68,
      textAlignVertical: "top",
    },
    uCancel: {
      flex: 1,
      minHeight: 44,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      alignItems: "center",
      justifyContent: "center",
      ...(Platform.OS === "web" ? { cursor: "pointer" as any } : {}),
    },
    uCancelText: { color: c.text, fontSize: 14, fontWeight: "600" },
    uConfirm: {
      flex: 1,
      minHeight: 44,
      borderRadius: 10,
      backgroundColor: ATT.unpaid,
      alignItems: "center",
      justifyContent: "center",
      ...(Platform.OS === "web" ? { cursor: "pointer" as any } : {}),
    },
    uConfirmText: { color: "#fff", fontSize: 14, fontWeight: "700" },
    menuItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: c.surfaceMuted,
    },
    menuItemText: { color: c.text, fontSize: 15, fontWeight: "700" },
    menuHint: { color: c.textMuted, fontSize: 12, marginTop: 12, lineHeight: 17 },

    avgBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: c.surfaceMuted,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      marginBottom: 10,
    },
    avgText: { flex: 1, color: c.text, fontSize: 13, fontWeight: "700" },
    avgValue: { fontSize: 18, fontWeight: "800" },

    // month per-person card
    mCard: {
      backgroundColor: c.surface,
      padding: 14,
      borderRadius: 14,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
    },
    mTop: { flexDirection: "row", alignItems: "center", gap: 12 },
    mSub: { color: c.textMuted, fontSize: 12, marginTop: 3 },
    chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 },
    lateRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 10 },
    lateText: { color: c.warningText, fontSize: 12, fontWeight: "600" },

    // worked/working-days figure on the row
    mWorked: { fontSize: 18, fontWeight: "800", color: c.text },
    mWorkedDenom: { color: c.textMuted, fontSize: 13, fontWeight: "700" },
    mWorkedLabel: { color: c.textFaint, fontSize: 10, marginTop: 1 },

    // expand actions
    mActions: { flexDirection: "row", gap: 10, marginTop: 14 },
    mActionBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: c.accentSoft,
    },
    mActionText: { color: c.accent, fontSize: 13, fontWeight: "800" },

    // month summary bar
    monthSummary: {
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      padding: 14,
      marginBottom: 12,
    },
    msTop: { flexDirection: "row", alignItems: "center", gap: 8 },
    msTitle: { flex: 1, color: c.text, fontSize: 15, fontWeight: "800" },
    msAvgPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: c.surfaceMuted,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    msAvgLabel: { color: c.textMuted, fontSize: 11, fontWeight: "600" },
    msAvgVal: { fontSize: 14, fontWeight: "800" },
    msStats: {
      flexDirection: "row",
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.surfaceBorder,
    },
    msHint: { color: c.textFaint, fontSize: 11, marginTop: 12, textAlign: "center" },

    // per-employee calendar
    calWeekHead: { flexDirection: "row", marginBottom: 6 },
    calWeekHeadCell: { flex: 1, textAlign: "center", color: c.textMuted, fontSize: 11, fontWeight: "800" },
    calWeekRow: { flexDirection: "row" },
    calCell: {
      flex: 1,
      aspectRatio: 1,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 10,
      marginHorizontal: 2,
      marginVertical: 2,
    },
    calCellToday: { borderWidth: 1.5, borderColor: c.accent },
    calCellSel: { backgroundColor: c.accent },
    calDayNum: { color: c.text, fontSize: 13, fontWeight: "700" },
    calDot: { position: "absolute", bottom: 6, width: 6, height: 6, borderRadius: 3 },
    calLegend: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: 12,
      marginTop: 14,
    },
    calLegendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
    calLegendDot: { width: 8, height: 8, borderRadius: 4 },
    calLegendText: { color: c.textMuted, fontSize: 11, fontWeight: "600" },
    calDetail: {
      marginTop: 14,
      backgroundColor: c.surfaceMuted,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
    },
    calDetailHead: { flexDirection: "row", alignItems: "center", gap: 7 },
    calDetailDot: { width: 9, height: 9, borderRadius: 5 },
    calDetailDate: { color: c.textMuted, fontSize: 12, fontWeight: "700" },
    calDetailLabel: { color: c.text, fontSize: 15, fontWeight: "800", marginTop: 4 },
    calDetailRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
    calDetailTimes: { color: c.textMuted, fontSize: 13, flexShrink: 1 },
    calDetailNotes: { color: c.text, fontSize: 13, lineHeight: 19, marginTop: 8 },
    calDetailNotesMuted: { color: c.textFaint, fontSize: 12, fontStyle: "italic", marginTop: 8 },
    calTapHint: { color: c.textFaint, fontSize: 12, textAlign: "center", marginTop: 14 },

    barTrack: { height: 5, borderRadius: 3, backgroundColor: c.surfaceMuted, marginTop: 10, overflow: "hidden" },
    barFill: { height: 5, borderRadius: 3 },
    ratePct: { fontSize: 17, fontWeight: "800", minWidth: 44, textAlign: "right" },

    pplRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
    pplAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" },
    pplAvatarText: { color: "#fff", fontSize: 15, fontWeight: "800" },
    pplName: { color: c.text, fontSize: 14, fontWeight: "700" },
    pplEmail: { color: c.textMuted, fontSize: 12, marginTop: 1 },
    mBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: "center" },
    mBtnGhost: { backgroundColor: c.surfaceMuted },
    mBtnGhostText: { color: c.text, fontWeight: "700" },
    mBtnPrimary: { backgroundColor: c.accent },
    mBtnPrimaryText: { color: "#fff", fontWeight: "800" },

    dHead: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 6 },
    dAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.accent, alignItems: "center", justifyContent: "center" },
    dAvatarText: { color: "#fff", fontSize: 18, fontWeight: "800" },
    dName: { color: c.text, fontSize: 16, fontWeight: "800" },
    dState: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    dGrid: { flexDirection: "row", gap: 8, marginTop: 16 },
    dLabel: { color: c.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginTop: 18, marginBottom: 6 },
    dNotes: { color: c.text, fontSize: 14, lineHeight: 20 },
    dInfoRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 18 },
    dInfoText: { color: c.textMuted, fontSize: 14, flexShrink: 1 },
    mapBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      alignSelf: "flex-start",
      marginTop: 12,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 10,
      backgroundColor: CLIENT_FG,
      ...(Platform.OS === "web" ? { cursor: "pointer" as any } : {}),
    },
    mapBtnText: { color: "#fff", fontSize: 13, fontWeight: "800" },

    noteItem: {
      paddingVertical: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.surfaceBorder,
    },
    noteDateRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    noteDate: { color: c.text, fontSize: 13, fontWeight: "800" },
    noteHrs: { color: c.textMuted, fontSize: 12, marginLeft: "auto" },
    noteText: { color: c.text, fontSize: 14, lineHeight: 20, marginTop: 6 },
    copyBlock: {
      color: c.text,
      fontSize: 13,
      lineHeight: 20,
      backgroundColor: c.surfaceMuted,
      borderRadius: 12,
      padding: 12,
      marginTop: 8,
    },

    // On web a FlatList needs a bounded flex:1 host to become scrollable;
    // without it the list grows to its content and no scrollbar appears.
    list: { flex: 1 },
    emptyWrap: { flex: 1, justifyContent: "center" },
  });
