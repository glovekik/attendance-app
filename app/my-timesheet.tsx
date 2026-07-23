import React, { useEffect, useMemo, useState, useCallback } from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
  Platform,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  getMyTimesheet,
  submitTimesheet,
  downloadMyTimesheetXlsx,
  importMyTimesheet,
  recallMyTimesheet,
} from "../src/services/timesheets";
import { Timesheet, TimesheetEntry, TimesheetStatus } from "../src/types";
import { useTheme } from "../src/theme/ThemeProvider";
import {
  timesheetStatusColor,
  timesheetStatusLabel,
} from "../src/theme/statusColors";
import { useResponsive } from "../src/utils/responsive";
import { ATT } from "../src/theme/attendanceColors";

// ===== date helpers =====
const ymd = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/** Monday of the week containing `d`. */
const mondayOf = (d: Date): Date => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0=Sun
  x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day));
  return x;
};

const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** "2026-07-21" -> "21 Jul" — the year lives in the week header. */
const prettyDate = (s: string): string => {
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return s;
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
};

/** Monday..Sunday as "20 – 26 Jul 2026", spanning months/years correctly. */
const weekRangeLabel = (monday: Date): string => {
  const end = addDays(monday, 6);
  const sameMonth = monday.getMonth() === end.getMonth();
  const sameYear = monday.getFullYear() === end.getFullYear();
  const left = monday.toLocaleDateString("en-GB", {
    day: "2-digit",
    ...(sameMonth && sameYear ? {} : { month: "short" }),
    ...(sameYear ? {} : { year: "numeric" }),
  });
  const right = end.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return `${left} – ${right}`;
};

// ===== time helpers =====
// Times are entered as plain HH:mm — identical on web and native, and faster
// to type than spinning a wheel.

const isoToHm = (iso?: string | null): string => {
  if (!iso) return "";
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  return m ? `${m[1]}:${m[2]}` : "";
};

/** "9:5" -> "09:05". "" when it isn't a valid time yet. */
const normalizeHm = (raw: string): string => {
  const m = /^(\d{1,2}):?(\d{0,2})$/.exec((raw || "").trim());
  if (!m) return "";
  const h = Number(m[1]);
  const mi = m[2] === "" ? 0 : Number(m[2]);
  if (isNaN(h) || isNaN(mi) || h > 23 || mi > 59) return "";
  return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
};

const hmToIso = (date: string, hm: string): string | null => {
  const norm = normalizeHm(hm);
  return norm ? `${date}T${norm}:00` : null;
};

const hoursBetween = (inHm: string, outHm: string): number => {
  const a = normalizeHm(inHm);
  const b = normalizeHm(outHm);
  if (!a || !b) return 0;
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  const mins = bh * 60 + bm - (ah * 60 + am);
  return mins > 0 ? Math.round((mins / 60) * 100) / 100 : 0;
};

/** An entry plus the HH:mm strings the inputs bind to. */
type Row = TimesheetEntry & {
  inHm: string;
  outHm: string;
};

/** Pick an .xlsx. Web uses a file input; native uses the document picker. */
const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const pickSpreadsheet = async (): Promise<any | null> => {
  if (Platform.OS === "web") {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = `${XLSX_MIME},.xlsx`;
      input.onchange = () => resolve(input.files?.[0] || null);
      // A cancelled dialog fires no change event in some browsers; resolving
      // on the window regaining focus stops the promise hanging forever.
      window.addEventListener(
        "focus",
        () => setTimeout(() => resolve(input.files?.[0] || null), 500),
        { once: true }
      );
      input.click();
    });
  }

  const DocumentPicker = await import("expo-document-picker");
  const res = await DocumentPicker.getDocumentAsync({
    type: [XLSX_MIME, "application/vnd.ms-excel"],
    copyToCacheDirectory: true,
  });
  if (res.canceled || !res.assets?.length) return null;
  const a = res.assets[0];
  return { uri: a.uri, name: a.name, mimeType: a.mimeType || XLSX_MIME };
};

export default function MyTimesheet() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const responsive = useResponsive();
  const wide = responsive.isDesktop;
  const styles = useMemo(() => makeStyles(c, wide), [c, wide]);

  const [weekStart, setWeekStart] = useState<Date>(mondayOf(new Date()));
  const [timesheet, setTimesheet] = useState<Timesheet | null>(null);
  const [entries, setEntries] = useState<Row[]>([]);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [busyFile, setBusyFile] = useState<"up" | "down" | null>(null);
  const [recalling, setRecalling] = useState(false);
  // Read-only until the employee chooses to edit. A week of live inputs
  // invites accidental changes to days that were already correct.
  const [editing, setEditing] = useState(false);
  const [workedExempt, setWorkedExempt] = useState<Record<string, boolean>>({});

  const rowsFrom = useCallback((data: any, base: Date): Row[] => {
    const byDate: Record<string, TimesheetEntry> = {};
    (data?.entries || []).forEach((e: TimesheetEntry) => {
      byDate[e.date] = e;
    });
    const exemptMap = data?.exempt || {};
    const out: Row[] = [];
    for (let i = 0; i < 7; i++) {
      const date = ymd(addDays(base, i));
      const e: TimesheetEntry =
        byDate[date] || { date, hours: 0, notes: "", billable: false };
      out.push({
        ...e,
        exempt: e.exempt ?? Object.hasOwn(exemptMap, date),
        exemptReason: e.exemptReason ?? exemptMap[date] ?? null,
        inHm: isoToHm(e.checkIn),
        outHm: isoToHm(e.checkOut),
      });
    }
    return out;
  }, []);

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const data = await getMyTimesheet(token, ymd(weekStart));
      setTimesheet(data);
      setEntries(rowsFrom(data, weekStart));
      setNote(data.note || "");
      setEditing(false);
      setWorkedExempt({});
    } catch (err: any) {
      Alert.alert("Couldn't load timesheet", err?.message || "Pull to retry.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router, weekStart, rowsFrom]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const updateEntry = (i: number, patch: Partial<Row>) =>
    setEntries((prev) => {
      const next = [...prev];
      next[i] = { ...next[i], ...patch };
      return next;
    });

  const hoursOf = (e: Row) => hoursBetween(e.inHm, e.outHm);

  /** Off only while genuinely empty and not opened up by the employee. */
  const isOff = (e: Row) =>
    !!e.exempt &&
    !workedExempt[e.date] &&
    !normalizeHm(e.inHm) &&
    !normalizeHm(e.outHm) &&
    !(e.notes || "").trim();

  const totalHours = entries.reduce((s, e) => s + hoursOf(e), 0);

  /** In, out and notes all present — AND the out-time actually after the in.
   *  Without the last check a reversed pair looked "complete", submitted
   *  fine, and landed in attendance as a 0-hour day. */
  const incomplete = entries.filter(
    (e) =>
      !isOff(e) &&
      (!normalizeHm(e.inHm) ||
        !normalizeHm(e.outHm) ||
        !(e.notes || "").trim() ||
        hoursOf(e) <= 0)
  );

  const status: TimesheetStatus =
    (timesheet?.status as TimesheetStatus) || "DRAFT";
  const canEdit = status === "DRAFT" || status === "REJECTED";
  const workingDays = entries.filter((e) => !isOff(e)).length;
  const doneDays = workingDays - incomplete.length;

  // ===== file round-trip =====
  const onDownload = async () => {
    if (busyFile) return;
    setBusyFile("down");
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await downloadMyTimesheetXlsx(token, ymd(weekStart));
    } catch (err: any) {
      Alert.alert("Download failed", err?.message || "");
    } finally {
      setBusyFile(null);
    }
  };

  const onUpload = async () => {
    if (busyFile || !canEdit) return;
    try {
      const picked = await pickSpreadsheet();
      if (!picked) return;
      setBusyFile("up");
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const res = await importMyTimesheet(token, ymd(weekStart), picked);
      setEntries(rowsFrom(res, weekStart));
      setEditing(true);

      const warn: string[] = [];
      if (res.futureDates?.length)
        warn.push(
          `These days haven't happened, so they can't be submitted: ${res.futureDates.join(
            ", "
          )}`
        );
      if (res.reversedDates?.length)
        warn.push(
          `Out-time isn't after in-time: ${res.reversedDates.join(", ")}`
        );
      if (res.incompleteDates?.length)
        warn.push(`Still missing details: ${res.incompleteDates.join(", ")}`);

      Alert.alert(
        "Loaded from file",
        `${res.totalHours} h read in. Nothing has been sent yet — review it, then press Send to manager.${
          warn.length ? `\n\n${warn.join("\n\n")}` : ""
        }`
      );
    } catch (err: any) {
      Alert.alert("Couldn't read that file", err?.message || "");
    } finally {
      setBusyFile(null);
    }
  };

  const onRecall = async () => {
    if (recalling) return;
    setRecalling(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await recallMyTimesheet(token, ymd(weekStart));
      await load();
      setEditing(true);
      Alert.alert(
        "Withdrawn",
        "Your manager has been told. Make your changes and send it again."
      );
    } catch (err: any) {
      Alert.alert("Couldn't withdraw", err?.message || "");
    } finally {
      setRecalling(false);
    }
  };

  const onSubmit = async () => {
    if (!canEdit) return;
    if (incomplete.length) {
      Alert.alert(
        "Week isn't complete",
        "Every working day needs an in-time, an out-time and work notes.\n\n" +
          `Still missing: ${incomplete.map((e) => e.date).join(", ")}`
      );
      return;
    }
    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await submitTimesheet(token, {
        weekStart: ymd(weekStart),
        note: note.trim() || undefined,
        entries: entries.map((e) => ({
          date: e.date,
          checkIn: hmToIso(e.date, e.inHm),
          checkOut: hmToIso(e.date, e.outHm),
          hours: hoursOf(e),
          attendanceType: e.attendanceType || undefined,
          notes: e.notes || undefined,
        })),
      });
      Alert.alert(
        "Sent to your manager",
        "Once they approve it, your attendance for the week is updated."
      );
      load();
    } catch (err: any) {
      Alert.alert("Submit failed", err?.message || "");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  const sc = timesheetStatusColor(status, c);
  const openDay = (d: string) =>
    setWorkedExempt((p) => ({ ...p, [d]: true }));

  const dayProps = {
    entries,
    editing: editing && canEdit,
    styles,
    c,
    isOff,
    hoursOf,
    updateEntry,
    onOpenDay: openDay,
  };

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
        <Text style={styles.title}>My Timesheet</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={c.accent}
              colors={[c.accent]}
            />
          }
        >
          <View style={styles.page}>
            {/* ===== WEEK + SUMMARY ===== */}
            <View style={styles.summary}>
              <View style={styles.weekNav}>
                <TouchableOpacity
                  style={styles.navBtn}
                  onPress={() => setWeekStart(addDays(weekStart, -7))}
                >
                  <Ionicons name="chevron-back" size={19} color={c.text} />
                </TouchableOpacity>
                <View style={{ flex: 1, alignItems: "center" }}>
                  <Text style={styles.weekLabel}>
                    {weekRangeLabel(weekStart)}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setWeekStart(mondayOf(new Date()))}
                  >
                    <Text style={styles.currentLink}>This week</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={styles.navBtn}
                  onPress={() => setWeekStart(addDays(weekStart, 7))}
                >
                  <Ionicons name="chevron-forward" size={19} color={c.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.summaryBody}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bigHours}>
                    {totalHours.toFixed(2)}
                    <Text style={styles.bigUnit}> h</Text>
                  </Text>
                  <Text style={styles.bigLabel}>
                    {doneDays} of {workingDays} working day
                    {workingDays === 1 ? "" : "s"} complete
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusChip,
                    { backgroundColor: sc.bg, borderColor: sc.solid },
                  ]}
                >
                  <Text style={[styles.statusChipText, { color: sc.fg }]}>
                    {timesheetStatusLabel(status)}
                  </Text>
                </View>
              </View>

              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${
                        workingDays
                          ? Math.max(0, (doneDays / workingDays) * 100)
                          : 0
                      }%`,
                      backgroundColor:
                        incomplete.length === 0 ? ATT.present : "#b45309",
                    },
                  ]}
                />
              </View>

              {/* ===== TOOLBAR ===== */}
              <View style={styles.toolbar}>
                {canEdit && (
                  <TouchableOpacity
                    style={[styles.tool, editing && styles.toolOn]}
                    onPress={() => setEditing((v) => !v)}
                  >
                    <Ionicons
                      name={editing ? "checkmark" : "create-outline"}
                      size={15}
                      color={editing ? "#fff" : c.accent}
                    />
                    <Text
                      style={[styles.toolText, editing && styles.toolTextOn]}
                    >
                      {editing ? "Done" : "Edit"}
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.tool}
                  onPress={onDownload}
                  disabled={busyFile !== null}
                >
                  <Ionicons name="download-outline" size={15} color={c.accent} />
                  <Text style={styles.toolText}>
                    {busyFile === "down" ? "Preparing…" : "Download"}
                  </Text>
                </TouchableOpacity>
                {canEdit && (
                  <TouchableOpacity
                    style={styles.tool}
                    onPress={onUpload}
                    disabled={busyFile !== null}
                  >
                    <Ionicons
                      name="cloud-upload-outline"
                      size={15}
                      color={c.accent}
                    />
                    <Text style={styles.toolText}>
                      {busyFile === "up" ? "Reading…" : "Upload"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {canEdit && (
                <Text style={styles.toolHint}>
                  Prefer Excel? <Text style={styles.toolHintStrong}>Download</Text>{" "}
                  gives you this week already filled in, with the column rules
                  on a second tab. Fill it in and{" "}
                  <Text style={styles.toolHintStrong}>Upload</Text> it back —
                  nothing is sent until you press Send to manager.
                </Text>
              )}
            </View>

            {status === "REJECTED" && !!timesheet?.decisionNote && (
              <View style={styles.rejectBox}>
                <Text style={styles.rejectTitle}>
                  SENT BACK BY YOUR MANAGER
                </Text>
                <Text style={styles.rejectBody}>{timesheet.decisionNote}</Text>
              </View>
            )}

            {!canEdit && (
              <View style={styles.lockedNote}>
                <Ionicons
                  name="lock-closed-outline"
                  size={14}
                  color={c.textMuted}
                />
                <Text style={styles.lockedText}>
                  {status === "PENDING"
                    ? "With your manager, so it's locked. Withdraw it to make changes — they haven't acted on it yet."
                    : "Approved and already written into your attendance. To change a day now, raise an attendance correction."}
                </Text>
                {status === "PENDING" && (
                  <TouchableOpacity
                    style={styles.recallBtn}
                    onPress={onRecall}
                    disabled={recalling}
                  >
                    <Ionicons
                      name="arrow-undo-outline"
                      size={14}
                      color={c.accent}
                    />
                    <Text style={styles.recallText}>
                      {recalling ? "Withdrawing…" : "Withdraw"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* ===== THE WEEK ===== */}
            {wide ? <WeekTable {...dayProps} /> : <WeekCards {...dayProps} />}

            {/* ===== NOTE TO MANAGER ===== */}
            {canEdit && editing ? (
              <>
                <Text style={styles.sectionLabel}>NOTE TO YOUR MANAGER</Text>
                <TextInput
                  style={[styles.input, { minHeight: 64 }]}
                  value={note}
                  onChangeText={setNote}
                  placeholder="Anything they should know (optional)"
                  placeholderTextColor={c.textFaint}
                  multiline
                />
              </>
            ) : !!note.trim() ? (
              <>
                <Text style={styles.sectionLabel}>NOTE TO YOUR MANAGER</Text>
                <Text style={styles.noteRead}>{note}</Text>
              </>
            ) : null}
          </View>
        </ScrollView>

        {canEdit && (
          <View style={styles.bottomBar}>
            <View style={styles.bottomInner}>
              {incomplete.length > 0 && (
                <Text style={styles.blockedHint}>
                  {incomplete.length} day
                  {incomplete.length === 1 ? "" : "s"} still need an in-time,
                  out-time or notes
                </Text>
              )}
              <TouchableOpacity
                style={[
                  styles.submitBtn,
                  (submitting || incomplete.length > 0) && { opacity: 0.45 },
                ]}
                onPress={onSubmit}
                disabled={submitting || incomplete.length > 0}
              >
                <Ionicons name="paper-plane-outline" size={17} color="#fff" />
                <Text style={styles.submitText}>
                  {submitting
                    ? "Sending…"
                    : status === "REJECTED"
                    ? "Resubmit to manager"
                    : "Send to manager"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ============ DESKTOP: a real timesheet grid ============
const WeekTable = ({
  entries,
  editing,
  styles,
  c,
  isOff,
  hoursOf,
  updateEntry,
  onOpenDay,
}: any) => (
  <View style={styles.table}>
    <View style={styles.thead}>
      <Text style={[styles.th, { width: 140 }]}>Date</Text>
      <Text style={[styles.th, { width: 92, textAlign: "center" }]}>In</Text>
      <Text style={[styles.th, { width: 92, textAlign: "center" }]}>Out</Text>
      <Text style={[styles.th, { width: 74, textAlign: "center" }]}>Hours</Text>
      <Text style={[styles.th, { flex: 1 }]}>Work notes</Text>
    </View>

    {entries.map((e: Row, i: number) => {
      const off = isOff(e);
      const hrs = hoursOf(e);
      const noIn = !normalizeHm(e.inHm);
      // A reversed pair looks complete but is worth 0 h — flag the
      // OUT box so the person can see which end is wrong.
      const reversed =
        !!normalizeHm(e.inHm) && !!normalizeHm(e.outHm) && hoursOf(e) <= 0;
      const noOut = !normalizeHm(e.outHm) || reversed;
      const noNotes = !(e.notes || "").trim();
      const bad = !off && (noIn || noOut || noNotes);

      return (
        <View
          key={e.date}
          style={[
            styles.tr,
            i % 2 === 1 && styles.trAlt,
            off && styles.trOff,
            bad && editing && styles.trBad,
          ]}
        >
          <View style={{ width: 140 }}>
            <Text style={styles.tdDate}>
              {WEEKDAYS[i]} · {prettyDate(e.date)}
            </Text>
            {off ? (
              <Text style={styles.tdSub}>{e.exemptReason || "Off"}</Text>
            ) : e.needsNotes ? (
              <Text style={styles.tdWarn}>HR filled the times</Text>
            ) : e.exempt ? (
              <Text style={styles.tdWorkedOff}>Worked a day off</Text>
            ) : e.hasRecord === false ? (
              <Text style={styles.tdSub}>Nothing recorded</Text>
            ) : null}
          </View>

          {off ? (
            <View style={{ flex: 1 }}>
              {editing && !e.future && (
                <TouchableOpacity
                  style={styles.miniBtn}
                  onPress={() => onOpenDay(e.date)}
                >
                  <Ionicons name="add" size={13} color={c.accent} />
                  <Text style={styles.miniBtnText}>I worked this day</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <>
              <View style={{ width: 92 }}>
                {editing ? (
                  <TextInput
                    style={[styles.cellInput, noIn && styles.cellBad]}
                    value={e.inHm}
                    onChangeText={(v) => updateEntry(i, { inHm: v })}
                    onBlur={() =>
                      updateEntry(i, { inHm: normalizeHm(e.inHm) || e.inHm })
                    }
                    placeholder="09:30"
                    placeholderTextColor={c.textFaint}
                    maxLength={5}
                  />
                ) : (
                  <Text style={styles.tdTime}>{e.inHm || "—"}</Text>
                )}
              </View>
              <View style={{ width: 92 }}>
                {editing ? (
                  <TextInput
                    style={[styles.cellInput, noOut && styles.cellBad]}
                    value={e.outHm}
                    onChangeText={(v) => updateEntry(i, { outHm: v })}
                    onBlur={() =>
                      updateEntry(i, { outHm: normalizeHm(e.outHm) || e.outHm })
                    }
                    placeholder="18:30"
                    placeholderTextColor={c.textFaint}
                    maxLength={5}
                  />
                ) : (
                  <Text style={styles.tdTime}>{e.outHm || "—"}</Text>
                )}
              </View>
              <Text style={[styles.tdHours, { width: 74 }]}>
                {hrs ? hrs.toFixed(2) : "—"}
              </Text>
              <View style={{ flex: 1 }}>
                {editing ? (
                  <TextInput
                    style={[
                      styles.cellInput,
                      styles.notesInput,
                      noNotes && styles.cellBad,
                    ]}
                    value={e.notes || ""}
                    onChangeText={(v) => updateEntry(i, { notes: v })}
                    placeholder="What did you work on? (required)"
                    placeholderTextColor={c.textFaint}
                    multiline
                  />
                ) : (
                  <Text
                    style={[styles.tdNotes, noNotes && styles.tdNotesEmpty]}
                  >
                    {(e.notes || "").trim() || "No notes"}
                  </Text>
                )}
              </View>
            </>
          )}
        </View>
      );
    })}
  </View>
);

// ============ MOBILE: one card per day ============
const WeekCards = ({
  entries,
  editing,
  styles,
  c,
  isOff,
  hoursOf,
  updateEntry,
  onOpenDay,
}: any) =>
  entries.map((e: Row, i: number) => {
    const off = isOff(e);
    const hrs = hoursOf(e);
    const noIn = !normalizeHm(e.inHm);
    // A reversed pair looks complete but is worth 0 h — flag the
    // OUT box so the person can see which end is wrong.
    const reversed =
      !!normalizeHm(e.inHm) && !!normalizeHm(e.outHm) && hoursOf(e) <= 0;
    const noOut = !normalizeHm(e.outHm) || reversed;
    const noNotes = !(e.notes || "").trim();
    const bad = !off && (noIn || noOut || noNotes);

    return (
      <View
        key={e.date}
        style={[
          styles.card,
          off && styles.cardOff,
          bad && editing && styles.cardBad,
        ]}
      >
        <View style={styles.cardHead}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardDay}>
              {WEEKDAYS[i]} · {prettyDate(e.date)}
            </Text>
            {off ? (
              <Text style={styles.tdSub}>{e.exemptReason || "Off"}</Text>
            ) : e.needsNotes ? (
              <Text style={styles.tdWarn}>
                HR filled the times — add what you worked on
              </Text>
            ) : e.exempt ? (
              <Text style={styles.tdWorkedOff}>Worked a day off</Text>
            ) : e.hasRecord === false ? (
              <Text style={styles.tdSub}>Nothing recorded yet</Text>
            ) : null}
          </View>
          <Text style={styles.cardHours}>
            {hrs ? hrs.toFixed(2) : "—"}
            <Text style={styles.cardHoursUnit}> h</Text>
          </Text>
        </View>

        {off ? (
          editing && !e.future ? (
            <TouchableOpacity
              style={styles.miniBtn}
              onPress={() => onOpenDay(e.date)}
            >
              <Ionicons name="add" size={13} color={c.accent} />
              <Text style={styles.miniBtnText}>I worked this day</Text>
            </TouchableOpacity>
          ) : null
        ) : editing ? (
          <>
            <View style={styles.timeRow}>
              <View style={styles.timeField}>
                <Text style={styles.fieldLabel}>IN</Text>
                <TextInput
                  style={[styles.cellInput, noIn && styles.cellBad]}
                  value={e.inHm}
                  onChangeText={(v) => updateEntry(i, { inHm: v })}
                  onBlur={() =>
                    updateEntry(i, { inHm: normalizeHm(e.inHm) || e.inHm })
                  }
                  placeholder="09:30"
                  placeholderTextColor={c.textFaint}
                  maxLength={5}
                />
              </View>
              <View style={styles.timeField}>
                <Text style={styles.fieldLabel}>OUT</Text>
                <TextInput
                  style={[styles.cellInput, noOut && styles.cellBad]}
                  value={e.outHm}
                  onChangeText={(v) => updateEntry(i, { outHm: v })}
                  onBlur={() =>
                    updateEntry(i, { outHm: normalizeHm(e.outHm) || e.outHm })
                  }
                  placeholder="18:30"
                  placeholderTextColor={c.textFaint}
                  maxLength={5}
                />
              </View>
            </View>
            <TextInput
              style={[
                styles.cellInput,
                styles.notesInput,
                noNotes && styles.cellBad,
              ]}
              value={e.notes || ""}
              onChangeText={(v) => updateEntry(i, { notes: v })}
              placeholder="What did you work on? (required)"
              placeholderTextColor={c.textFaint}
              multiline
            />
          </>
        ) : (
          <>
            <View style={styles.readRow}>
              <Text style={styles.readTime}>{e.inHm || "—"}</Text>
              <Ionicons name="arrow-forward" size={13} color={c.textMuted} />
              <Text style={styles.readTime}>{e.outHm || "—"}</Text>
            </View>
            <Text style={[styles.tdNotes, noNotes && styles.tdNotesEmpty]}>
              {(e.notes || "").trim() || "No notes"}
            </Text>
          </>
        )}
      </View>
    );
  });

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
    scroll: { padding: wide ? 24 : 12, paddingBottom: 130 },
    page: { width: "100%", maxWidth: 1100, alignSelf: "center" },

    summary: {
      backgroundColor: c.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      padding: 16,
      marginBottom: 14,
    },
    weekNav: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
    navBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: c.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      ...(Platform.OS === "web" ? { cursor: "pointer" as any } : {}),
    },
    weekLabel: { color: c.text, fontSize: 15, fontWeight: "800" },
    currentLink: {
      color: c.accent,
      fontSize: 11,
      marginTop: 2,
      fontWeight: "700",
    },
    summaryBody: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    bigHours: {
      color: c.text,
      fontSize: 34,
      fontWeight: "900",
      letterSpacing: -1,
    },
    bigUnit: { fontSize: 16, fontWeight: "800", color: c.textMuted },
    bigLabel: { color: c.textMuted, fontSize: 12, marginTop: 1 },
    statusChip: {
      paddingHorizontal: 11,
      paddingVertical: 5,
      borderRadius: 999,
      borderWidth: 1,
    },
    statusChipText: { fontSize: 10.5, fontWeight: "800", letterSpacing: 0.4 },
    progressTrack: {
      height: 5,
      borderRadius: 3,
      backgroundColor: c.surfaceMuted,
      overflow: "hidden",
      marginTop: 12,
    },
    progressFill: { height: "100%", borderRadius: 3 },

    toolbar: { flexDirection: "row", gap: 8, marginTop: 14, flexWrap: "wrap" },
    tool: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 13,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.accent,
      backgroundColor: c.accentSoft,
      ...(Platform.OS === "web" ? { cursor: "pointer" as any } : {}),
    },
    toolOn: { backgroundColor: c.accent, borderColor: c.accent },
    toolText: { color: c.accent, fontSize: 12, fontWeight: "800" },
    toolTextOn: { color: "#fff" },

    rejectBox: {
      backgroundColor: c.dangerBg,
      borderColor: c.dangerText,
      borderWidth: 1,
      padding: 12,
      borderRadius: 12,
      marginBottom: 12,
    },
    rejectTitle: {
      color: c.dangerText,
      fontSize: 9.5,
      letterSpacing: 1.1,
      fontWeight: "800",
    },
    rejectBody: {
      color: c.dangerText,
      fontSize: 13,
      marginTop: 4,
      lineHeight: 18,
    },

    lockedNote: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: c.surfaceMuted,
      borderRadius: 10,
      padding: 11,
      marginBottom: 12,
    },
    lockedText: { color: c.textMuted, fontSize: 12, flex: 1, lineHeight: 17 },
    recallBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.accent,
      backgroundColor: c.accentSoft,
      ...(Platform.OS === "web" ? { cursor: "pointer" as any } : {}),
    },
    recallText: { color: c.accent, fontSize: 11.5, fontWeight: "800" },
    toolHint: {
      color: c.textMuted,
      fontSize: 11.5,
      lineHeight: 17,
      marginTop: 10,
    },
    toolHintStrong: { color: c.text, fontWeight: "800" },

    // desktop table
    table: {
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      overflow: "hidden",
    },
    thead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: c.surfaceMuted,
      borderBottomWidth: 1,
      borderBottomColor: c.surfaceBorder,
    },
    th: {
      color: c.textMuted,
      fontSize: 9.5,
      fontWeight: "800",
      letterSpacing: 1,
    },
    tr: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderBottomWidth: 1,
      borderBottomColor: c.surfaceBorder,
    },
    trAlt: { backgroundColor: c.surfaceMuted },
    trOff: { opacity: 0.6 },
    trBad: { backgroundColor: "rgba(180,83,9,0.07)" },
    tdDate: { color: c.text, fontSize: 13, fontWeight: "700" },
    tdSub: { color: c.textMuted, fontSize: 10.5, marginTop: 2 },
    tdWarn: {
      color: "#b45309",
      fontSize: 10.5,
      marginTop: 2,
      fontWeight: "700",
    },
    tdWorkedOff: {
      color: ATT.halfday,
      fontSize: 10.5,
      marginTop: 2,
      fontWeight: "700",
    },
    tdTime: {
      color: c.text,
      fontSize: 14,
      fontWeight: "700",
      letterSpacing: 0.5,
      textAlign: "center",
      paddingTop: 2,
    },
    tdHours: {
      color: c.text,
      fontSize: 14,
      fontWeight: "800",
      textAlign: "center",
      paddingTop: 2,
    },
    tdNotes: { color: c.text, fontSize: 12.5, lineHeight: 18 },
    tdNotesEmpty: { color: c.textFaint, fontStyle: "italic" },

    // mobile card
    card: {
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      padding: 13,
      marginBottom: 9,
    },
    cardOff: { opacity: 0.62 },
    cardBad: { borderColor: "#b45309" },
    cardHead: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    cardDay: { color: c.text, fontSize: 14, fontWeight: "800" },
    cardHours: { color: c.text, fontSize: 17, fontWeight: "800" },
    cardHoursUnit: { fontSize: 11, color: c.textMuted, fontWeight: "700" },
    readRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 9,
      marginBottom: 6,
    },
    readTime: {
      color: c.text,
      fontSize: 14,
      fontWeight: "700",
      letterSpacing: 0.5,
    },
    timeRow: { flexDirection: "row", gap: 9, marginTop: 10 },
    timeField: { flex: 1 },
    fieldLabel: {
      color: c.textMuted,
      fontSize: 9,
      letterSpacing: 1.1,
      fontWeight: "800",
      marginBottom: 4,
    },

    cellInput: {
      backgroundColor: c.surfaceMuted,
      color: c.text,
      fontSize: 13.5,
      fontWeight: "700",
      textAlign: "center",
      paddingVertical: 8,
      paddingHorizontal: 8,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
    },
    notesInput: {
      textAlign: "left",
      fontWeight: "500",
      fontSize: 12.5,
      minHeight: 42,
      marginTop: 8,
    },
    cellBad: { borderColor: "#b45309", borderWidth: 1.5 },
    miniBtn: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      marginTop: 8,
      ...(Platform.OS === "web" ? { cursor: "pointer" as any } : {}),
    },
    miniBtnText: { color: c.accent, fontSize: 11, fontWeight: "800" },

    sectionLabel: {
      color: c.textMuted,
      fontSize: 9.5,
      letterSpacing: 1.1,
      fontWeight: "800",
      marginTop: 18,
      marginBottom: 7,
    },
    input: {
      backgroundColor: c.surface,
      color: c.text,
      fontSize: 13,
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      textAlignVertical: "top",
    },
    noteRead: { color: c.text, fontSize: 13, lineHeight: 19 },

    bottomBar: {
      borderTopWidth: 1,
      borderTopColor: c.surfaceBorder,
      backgroundColor: c.bg,
      paddingVertical: 12,
      paddingHorizontal: wide ? 24 : 12,
    },
    bottomInner: { width: "100%", maxWidth: 1100, alignSelf: "center" },
    blockedHint: {
      color: "#b45309",
      fontSize: 11.5,
      fontWeight: "700",
      textAlign: "center",
      marginBottom: 8,
    },
    submitBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: c.accent,
      paddingVertical: 14,
      borderRadius: 13,
      ...(Platform.OS === "web" ? { cursor: "pointer" as any } : {}),
    },
    submitText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  });
