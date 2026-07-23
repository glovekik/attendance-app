import React, { useEffect, useMemo, useState } from "react";

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Platform,
} from "react-native";

import { WebModal, ModalActions } from "./WebModal";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useRouter } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import DateTimePicker from "@react-native-community/datetimepicker";

import { WebDateField, dateToHM, hmToDate } from "./WebDateField";
import { AttendanceCalendar, CalRow } from "./AttendanceCalendar";

import {
  getHistory,
  getMe,
  deleteAttendance,
  updateAttendance,
  addManualEntry,
} from "../services/api";

import {
  requestCorrection,
  requestCorrectionForDate,
  listMyCorrections,
} from "../services/corrections";

import { listHolidays } from "../services/holidays";

import { AttendanceCorrection, User, hasRole } from "../types";
import { useTheme } from "../theme/ThemeProvider";
import { notify, confirmAction } from "../utils/confirm";

const isWeb = Platform.OS === "web";

// How many auto-checkout date chips to show before collapsing behind "+N more".
const AUTO_CHIP_LIMIT = 12;

const pad2 = (n: number) => String(n).padStart(2, "0");
const thisMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
};

/**
 * The full attendance history + correction experience, embedded directly in
 * the Attendance screen (there is no separate History page anymore).
 *
 * The calendar itself is the shared AttendanceCalendar so the colour language
 * (teal "attended", violet WFH, …) stays identical to the HR and Work
 * Performance screens — this component only adds the data loading, the
 * correction request flow, and HR edit/delete on top of it.
 *
 * `onChanged` fires after any mutation so the parent can refresh today's status.
 */
export function AttendanceHistorySection({
  onChanged,
}: {
  onChanged?: () => void;
}) {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);

  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<any[]>([]);
  const [me, setMe] = useState<User | null>(null);
  const [corrections, setCorrections] = useState<AttendanceCorrection[]>([]);
  const [holidayByDate, setHolidayByDate] = useState<Record<string, string>>({});
  const [month, setMonth] = useState<string>(thisMonth);
  const [showAllAuto, setShowAllAuto] = useState(false);

  // ================= EDIT MODAL (HR) =================
  const [editVisible, setEditVisible] = useState(false);
  // Non-null while the modal is creating a record for a day that had none.
  const [creatingDate, setCreatingDate] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [editType, setEditType] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editCheckIn, setEditCheckIn] = useState<Date | null>(null);
  const [editCheckOut, setEditCheckOut] = useState<Date | null>(null);
  const [showInPicker, setShowInPicker] = useState(false);
  const [showOutPicker, setShowOutPicker] = useState(false);

  // ================= CORRECTION MODAL =================
  const [corrVisible, setCorrVisible] = useState(false);
  const [corrItem, setCorrItem] = useState<any>(null);
  const [corrDate, setCorrDate] = useState<string>("");
  const [corrCheckIn, setCorrCheckIn] = useState<Date | null>(null);
  const [corrCheckOut, setCorrCheckOut] = useState<Date | null>(null);
  const [corrType, setCorrType] = useState<
    "OFFICE" | "WFH" | "LEAVE" | "HOLIDAY"
  >("OFFICE");
  const [corrNotes, setCorrNotes] = useState("");
  const [corrReason, setCorrReason] = useState("");
  const [corrSaving, setCorrSaving] = useState(false);
  const [corrShowInPicker, setCorrShowInPicker] = useState(false);
  const [corrShowPicker, setCorrShowPicker] = useState(false);

  const formatTime = (d: Date) =>
    d.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

  const combine = (baseDateStr: string, t: Date) => {
    const base = new Date(`${baseDateStr}T00:00:00`);
    base.setHours(t.getHours(), t.getMinutes(), 0, 0);
    return base.toISOString();
  };

  const showSuccess = (message: string) => notify("Done", message);
  const showError = (err: any) =>
    notify(
      "Couldn't complete",
      err?.response?.data?.detail || err?.message || "Something went wrong"
    );

  const notifyChanged = () => {
    try {
      onChanged?.();
    } catch {
      /* non-fatal */
    }
  };

  // ================= LOAD =================
  const loadHistory = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const [histRes, corrRes, meRes] = await Promise.all([
        getHistory(token),
        listMyCorrections(token).catch(() => []),
        getMe(token).catch(() => null),
      ]);
      setHistory(histRes || []);
      setCorrections(corrRes || []);
      setMe(meRes);
    } catch (err) {
      showError(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // HR-declared holidays for whichever year is on screen.
  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        if (!token) return;
        const year = Number(month.slice(0, 4));
        const hols = await listHolidays(token, { year });
        setHolidayByDate((prev) => {
          const next = { ...prev };
          for (const h of hols || []) {
            if (h?.date) next[h.date] = h.name || "Holiday";
          }
          return next;
        });
      } catch {
        /* Non-fatal — calendar just won't show declared holidays. */
      }
    })();
  }, [month]);

  // Days the 11:59 PM cron closed for the user because they forgot to check
  // out. Split into "the month currently on screen" vs all-time so the count
  // moves with the calendar as they navigate.
  const autoRows = useMemo(
    () =>
      (history || [])
        .filter((h) => h?.autoClosedByCron)
        .sort((a, b) => (b?.date || "").localeCompare(a?.date || "")),
    [history]
  );
  const monthAutoRows = useMemo(
    () => autoRows.filter((r) => (r?.date || "").startsWith(month)),
    [autoRows, month]
  );

  const monthLabelText = useMemo(() => {
    const [yy, mm] = month.split("-").map(Number);
    return new Date(yy, mm - 1, 1).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  }, [month]);

  const visibleAutoRows = showAllAuto
    ? autoRows
    : autoRows.slice(0, AUTO_CHIP_LIMIT);

  const dayChipLabel = (ymd: string) => {
    const [yy, mm, dd] = ymd.split("-").map(Number);
    return new Date(yy, mm - 1, dd).toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
    });
  };

  // Latest correction status per attendance date, for the calendar panel.
  const correctionByDate = useMemo(() => {
    const map: Record<string, "PENDING" | "APPROVED" | "REJECTED"> = {};
    const sorted = [...corrections].sort((a, b) =>
      (a.requestedAt || "").localeCompare(b.requestedAt || "")
    );
    for (const cr of sorted) {
      const key =
        cr.attendanceDate ||
        cr.attendance?.date ||
        cr.requestedDate ||
        undefined;
      if (key) map[key] = cr.status as any;
    }
    return map;
  }, [corrections]);

  // ================= CORRECTION =================
  const openCorrection = (item: any) => {
    setCorrItem(item);
    setCorrDate(item.date || "");
    setCorrCheckIn(item.checkIn ? new Date(item.checkIn) : null);
    setCorrCheckOut(item.checkOut ? new Date(item.checkOut) : null);
    setCorrType(item.attendanceType || "OFFICE");
    setCorrNotes(item.workNotes || "");
    setCorrReason("");
    setCorrVisible(true);
  };

  const openCorrectionForDate = (ymd: string) => {
    setCorrItem(null);
    setCorrDate(ymd);
    setCorrCheckIn(null);
    setCorrCheckOut(null);
    setCorrType("OFFICE");
    setCorrNotes("");
    setCorrReason("");
    setCorrVisible(true);
  };

  // Calendar callback — an existing record edits it, a bare day creates one.
  const handleRequestCorrection = (dayKey: string, rec?: CalRow) => {
    const full = rec ? history.find((h) => h?.date === rec.date) || rec : null;
    if (full) openCorrection(full);
    else openCorrectionForDate(dayKey);
  };

  const submitCorrection = async () => {
    if (corrSaving) return;

    if (!corrReason.trim()) {
      showError({ message: "Please give a reason" });
      return;
    }

    const notesRequired = corrType === "OFFICE" || corrType === "WFH";
    if (notesRequired && corrNotes.trim().length < 5) {
      showError({
        message:
          "Please add work notes — briefly describe what you did that day.",
      });
      return;
    }

    // ===== MISSED DAY (no existing record) =====
    if (!corrItem) {
      const baseDateStr = (corrDate || "").trim();
      if (!baseDateStr) {
        showError({ message: "Pick a date" });
        return;
      }
      if (!corrCheckIn || !corrCheckOut) {
        showError({ message: "Set both check-in and check-out times." });
        return;
      }
      const inMins = corrCheckIn.getHours() * 60 + corrCheckIn.getMinutes();
      const outMins = corrCheckOut.getHours() * 60 + corrCheckOut.getMinutes();
      if (outMins <= inMins) {
        showError({ message: "Check-out must be after check-in." });
        return;
      }
      try {
        setCorrSaving(true);
        const token = await AsyncStorage.getItem("token");
        if (!token) return;
        await requestCorrectionForDate(token, {
          date: baseDateStr,
          requestedCheckIn: combine(baseDateStr, corrCheckIn),
          requestedCheckOut: combine(baseDateStr, corrCheckOut),
          requestedAttendanceType: corrType,
          requestedWorkNotes: corrNotes.trim() || undefined,
          reason: corrReason.trim(),
        });
        showSuccess("Correction request submitted");
        setCorrVisible(false);
        await loadHistory();
        notifyChanged();
      } catch (err) {
        showError(err);
      } finally {
        setCorrSaving(false);
      }
      return;
    }

    try {
      setCorrSaving(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;

      const baseDateStr = (corrDate || corrItem.date).trim();
      const body: any = { reason: corrReason.trim() };

      if (baseDateStr && baseDateStr !== corrItem.date) {
        body.requestedDate = baseDateStr;
      }

      const origIn = corrItem.checkIn ? new Date(corrItem.checkIn) : null;
      const origOut = corrItem.checkOut ? new Date(corrItem.checkOut) : null;
      const timeChanged = (a: Date | null, b: Date | null) => {
        if (!a && !b) return false;
        if (!a || !b) return true;
        return (
          a.getHours() !== b.getHours() || a.getMinutes() !== b.getMinutes()
        );
      };

      if (
        corrCheckIn &&
        (timeChanged(corrCheckIn, origIn) || baseDateStr !== corrItem.date)
      ) {
        body.requestedCheckIn = combine(baseDateStr, corrCheckIn);
      }
      if (
        corrCheckOut &&
        (timeChanged(corrCheckOut, origOut) || baseDateStr !== corrItem.date)
      ) {
        body.requestedCheckOut = combine(baseDateStr, corrCheckOut);
      }
      if (corrType !== corrItem.attendanceType) {
        body.requestedAttendanceType = corrType;
      }
      if ((corrNotes || "") !== (corrItem.workNotes || "")) {
        body.requestedWorkNotes = corrNotes;
      }

      const hasChange = Object.keys(body).some((k) => k !== "reason");
      if (!hasChange) {
        showError({
          message:
            "Change at least one field (date, check-in, check-out, type, or notes) before submitting.",
        });
        setCorrSaving(false);
        return;
      }

      await requestCorrection(token, corrItem.id, body);

      showSuccess("Correction request submitted");
      setCorrVisible(false);
      await loadHistory();
      notifyChanged();
    } catch (err) {
      showError(err);
    } finally {
      setCorrSaving(false);
    }
  };

  // ================= HR EDIT / DELETE / ADD =================
  /** A day with no record at all. Edit and Delete both need an existing
   *  record and HR doesn't raise correction requests, so without this an
   *  empty day gave HR no action whatsoever. */
  const openCreate = (dayKey: string) => {
    setCreatingDate(dayKey);
    setSelectedItem({ date: dayKey });
    setEditType("OFFICE");
    setEditNotes("");
    setEditCheckIn(null);
    setEditCheckOut(null);
    setEditVisible(true);
  };

  const openEdit = (rec: CalRow) => {
    setCreatingDate(null);
    const item = history.find((h) => h?.date === rec.date) || rec;
    setSelectedItem(item);
    setEditType((item as any).attendanceType || "OFFICE");
    setEditNotes((item as any).workNotes || "");
    setEditCheckIn(item.checkIn ? new Date(item.checkIn) : null);
    setEditCheckOut(item.checkOut ? new Date(item.checkOut) : null);
    setEditVisible(true);
  };

  const handleDelete = async (rec: CalRow) => {
    const item: any = history.find((h) => h?.date === rec.date) || rec;
    if (!item?.id) return;
    const ok = await confirmAction({
      title: "Delete attendance?",
      message: `This permanently removes the record for ${item.date}.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await deleteAttendance(token, item.id);
      showSuccess("Attendance deleted");
      await loadHistory();
      notifyChanged();
    } catch (err) {
      showError(err);
    }
  };

  const saveEdit = async () => {
    try {
      const creating = !!creatingDate;
      const token = await AsyncStorage.getItem("token");
      if (!token) return;

      const requiresTime = editType === "OFFICE" || editType === "WFH";
      if (requiresTime) {
        if (!editCheckIn) {
          showError({ message: "Check-in time required" });
          return;
        }
        if (!editCheckOut) {
          showError({ message: "Check-out time required" });
          return;
        }
        const inMins = editCheckIn.getHours() * 60 + editCheckIn.getMinutes();
        const outMins = editCheckOut.getHours() * 60 + editCheckOut.getMinutes();
        if (outMins <= inMins) {
          showError({ message: "Check-out must be after check-in" });
          return;
        }
      }
      if (!creating && !editNotes.trim()) {
        showError({ message: "Notes required" });
        return;
      }

      const baseDate = selectedItem.date;
      const checkIn =
        requiresTime && editCheckIn ? combine(baseDate, editCheckIn) : null;
      const checkOut =
        requiresTime && editCheckOut ? combine(baseDate, editCheckOut) : null;

      if (creating) {
        // Upserts by (userId, date) — the same route HR uses to fill a
        // missing day, which flags it for work notes if none were given.
        await addManualEntry(token, {
          date: baseDate,
          attendanceType: editType,
          checkIn,
          checkOut,
          workNotes: editNotes.trim() || undefined,
        });
      } else {
        await updateAttendance(token, selectedItem.id, {
          attendanceType: editType,
          workNotes: editNotes,
          checkIn,
          checkOut,
        });
      }

      showSuccess(creating ? "Attendance added" : "Attendance updated");
      setEditVisible(false);
      setCreatingDate(null);
      await loadHistory();
      notifyChanged();
    } catch (err) {
      showError(err);
    }
  };

  if (loading) {
    return (
      <View style={styles.sectionLoader}>
        <ActivityIndicator color={c.accent} />
      </View>
    );
  }

  const isHR = hasRole(me, "HR");

  return (
    <View style={styles.wrap}>
      <View style={styles.sectionHeadRow}>
        <Text style={styles.sectionHeading}>Attendance history</Text>
        {/* The weekly sheet is where gaps in this calendar actually get
            fixed, so it belongs next to the calendar — not only on the
            dashboard. HR fixes other people's days elsewhere. */}
        {!isHR && (
          <TouchableOpacity
            style={styles.tsLink}
            onPress={() => router.push("/my-timesheet" as any)}
            activeOpacity={0.85}
          >
            <Ionicons name="time-outline" size={14} color={c.accent} />
            <Text style={styles.tsLinkText}>Weekly timesheet</Text>
            <Ionicons name="chevron-forward" size={13} color={c.accent} />
          </TouchableOpacity>
        )}
      </View>

      {/* ===== AUTO CHECK-OUTS ===== */}
      <View style={styles.autoCard}>
        <View style={styles.autoHead}>
          <View style={styles.autoIcon}>
            <Ionicons name="alarm-outline" size={19} color="#b45309" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.autoTitle}>Auto check-outs</Text>
            <Text style={styles.autoSub}>
              Records the system closed at 11:59 PM because check-out was missed
            </Text>
          </View>
        </View>

        {/* Two explicit counts so "how many" is never ambiguous. */}
        <View style={styles.autoStatRow}>
          <View style={styles.autoStat}>
            <Text
              style={[
                styles.autoStatValue,
                autoRows.length === 0 && styles.autoStatValueZero,
              ]}
            >
              {autoRows.length}
            </Text>
            <Text style={styles.autoStatLabel}>TOTAL</Text>
          </View>
          <View style={styles.autoStat}>
            <Text
              style={[
                styles.autoStatValue,
                monthAutoRows.length === 0 && styles.autoStatValueZero,
              ]}
            >
              {monthAutoRows.length}
            </Text>
            <Text style={styles.autoStatLabel}>
              {monthLabelText.toUpperCase()}
            </Text>
          </View>
        </View>

        {autoRows.length > 0 ? (
          <>
            <View style={styles.chipWrap}>
              {visibleAutoRows.map((r) => (
                <TouchableOpacity
                  key={r.date}
                  style={styles.dayChip}
                  activeOpacity={0.8}
                  onPress={() =>
                    isHR
                      ? openEdit(r as CalRow)
                      : handleRequestCorrection(r.date, r)
                  }
                >
                  <Ionicons name="calendar-outline" size={12} color="#b45309" />
                  <Text style={styles.dayChipText}>{dayChipLabel(r.date)}</Text>
                </TouchableOpacity>
              ))}
              {autoRows.length > AUTO_CHIP_LIMIT && (
                <TouchableOpacity
                  style={styles.moreChip}
                  onPress={() => setShowAllAuto((v) => !v)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.moreChipText}>
                    {showAllAuto
                      ? "Show less"
                      : `+${autoRows.length - AUTO_CHIP_LIMIT} more`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.autoHint}>
              {isHR
                ? "Tap a date to edit that record."
                : "Tap a date to request the correct check-out time — the count drops once it's approved."}
            </Text>
          </>
        ) : (
          <Text style={styles.autoNone}>
            No auto check-outs — nicely done.
          </Text>
        )}
      </View>

      <View style={styles.calCard}>
        <AttendanceCalendar
          monthStr={month}
          rows={history as CalRow[]}
          holidayMap={holidayByDate}
          navigable
          onMonthChange={setMonth}
          correctionByDate={correctionByDate}
          onRequestCorrection={isHR ? undefined : handleRequestCorrection}
          onAddRecord={isHR ? openCreate : undefined}
          onEdit={isHR ? openEdit : undefined}
          onDelete={isHR ? handleDelete : undefined}
        />
      </View>

      {/* ================= EDIT MODAL (HR) ================= */}
      <WebModal
        visible={editVisible}
        onClose={() => {
          setEditVisible(false);
          setCreatingDate(null);
        }}
        title={
          creatingDate ? `Add record — ${creatingDate}` : "Edit Attendance"
        }
        size="md"
        footer={
          <ModalActions align="right">
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => {
                setEditVisible(false);
                setCreatingDate(null);
              }}
            >
              <Text style={styles.modalBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={saveEdit}>
              <Text style={[styles.modalBtnText, { color: "#fff" }]}>Save</Text>
            </TouchableOpacity>
          </ModalActions>
        }
      >
        <Text style={styles.modalLabel}>Attendance Type</Text>
        <View style={styles.typeRow}>
          {(["OFFICE", "WFH", "LEAVE", "HOLIDAY"] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.typeChip, editType === t && styles.typeChipActive]}
              onPress={() => setEditType(t)}
            >
              <Text
                style={[
                  styles.typeChipText,
                  editType === t && styles.typeChipTextActive,
                ]}
              >
                {t}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {(editType === "OFFICE" || editType === "WFH") && (
          <>
            <Text style={styles.modalLabel}>Work Hours</Text>
            <TimeField
              label="Check In"
              value={editCheckIn}
              onChange={setEditCheckIn}
              tone="in"
              c={c}
              styles={styles}
              showPicker={showInPicker}
              setShowPicker={setShowInPicker}
              formatTime={formatTime}
            />
            <TimeField
              label="Check Out"
              value={editCheckOut}
              onChange={setEditCheckOut}
              tone="out"
              c={c}
              styles={styles}
              showPicker={showOutPicker}
              setShowPicker={setShowOutPicker}
              formatTime={formatTime}
            />
          </>
        )}

        <Text style={styles.modalLabel}>
          Notes{creatingDate ? " (optional)" : ""}
        </Text>
        <TextInput
          style={styles.input}
          value={editNotes}
          onChangeText={setEditNotes}
          multiline
          placeholder={
            creatingDate
              ? "What was worked on — leave blank if you don't know"
              : "Enter notes"
          }
          placeholderTextColor={c.textFaint}
        />
        {!!creatingDate && !editNotes.trim() && (
          <Text style={styles.createHint}>
            Saved without notes, this day is flagged so the employee is asked
            to describe the work in their weekly timesheet.
          </Text>
        )}
      </WebModal>

      {/* ================= CORRECTION MODAL ================= */}
      <WebModal
        visible={corrVisible}
        onClose={() => setCorrVisible(false)}
        title="Request Correction"
        size="md"
        footer={
          <ModalActions align="right">
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setCorrVisible(false)}
            >
              <Text style={styles.modalBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, corrSaving && { opacity: 0.7 }]}
              onPress={submitCorrection}
              disabled={corrSaving}
            >
              {corrSaving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[styles.modalBtnText, { color: "#fff" }]}>
                  Submit
                </Text>
              )}
            </TouchableOpacity>
          </ModalActions>
        }
      >
        <View style={styles.corrBanner}>
          <View style={styles.corrBannerIcon}>
            <Ionicons
              name={corrItem ? "create-outline" : "add-circle-outline"}
              size={18}
              color={c.accent}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.corrBannerTitle}>
              {corrItem
                ? `Correcting ${corrItem.date}`
                : `No record for ${corrDate}`}
            </Text>
            <Text style={styles.corrBannerSub}>
              {corrItem
                ? `Currently ${corrItem.attendanceType || "—"} · change any field below.`
                : "Fill in the times below."}{" "}
              Your manager or HR approves before it applies.
            </Text>
          </View>
        </View>

        <Text style={styles.modalLabel}>Date</Text>
        <View style={styles.timeRow}>
          <View style={[styles.timeIcon, { backgroundColor: c.infoBg }]}>
            <Ionicons name="calendar-outline" size={18} color={c.infoText} />
          </View>
          {isWeb ? (
            <WebDateField
              mode="date"
              value={corrDate}
              onChange={(v) => v && setCorrDate(v)}
            />
          ) : (
            <TextInput
              style={[styles.input, { flex: 1, minHeight: 0, marginTop: 0 }]}
              value={corrDate}
              onChangeText={setCorrDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={c.textFaint}
              autoCapitalize="none"
            />
          )}
        </View>

        <Text style={styles.modalLabel}>Attendance Type</Text>
        <View style={styles.typeRow}>
          {(["OFFICE", "WFH", "LEAVE", "HOLIDAY"] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.typeChip, corrType === t && styles.typeChipActive]}
              onPress={() => setCorrType(t)}
            >
              <Text
                style={[
                  styles.typeChipText,
                  corrType === t && styles.typeChipTextActive,
                ]}
              >
                {t}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.modalLabel}>Check-in Time</Text>
        <TimeField
          label="Check In"
          value={corrCheckIn}
          onChange={setCorrCheckIn}
          tone="in"
          c={c}
          styles={styles}
          showPicker={corrShowInPicker}
          setShowPicker={setCorrShowInPicker}
          formatTime={formatTime}
        />

        <Text style={styles.modalLabel}>Check-out Time</Text>
        <TimeField
          label="Check Out"
          value={corrCheckOut}
          onChange={setCorrCheckOut}
          tone="out"
          c={c}
          styles={styles}
          showPicker={corrShowPicker}
          setShowPicker={setCorrShowPicker}
          formatTime={formatTime}
        />

        <Text style={styles.modalLabel}>
          Work Notes{corrType === "OFFICE" || corrType === "WFH" ? " *" : ""}
        </Text>
        <TextInput
          style={styles.input}
          value={corrNotes}
          onChangeText={setCorrNotes}
          multiline
          placeholder="What did you do that day?"
          placeholderTextColor={c.textFaint}
        />

        <Text style={styles.modalLabel}>Reason for correction *</Text>
        <TextInput
          style={styles.input}
          value={corrReason}
          onChangeText={setCorrReason}
          multiline
          placeholder="Why does this record need to change?"
          placeholderTextColor={c.textFaint}
        />
      </WebModal>
    </View>
  );
}

/** Shared check-in/out time field — web date input on web, picker on native. */
const TimeField = ({
  label,
  value,
  onChange,
  tone,
  c,
  styles,
  showPicker,
  setShowPicker,
  formatTime,
}: {
  label: string;
  value: Date | null;
  onChange: (d: Date) => void;
  tone: "in" | "out";
  c: any;
  styles: any;
  showPicker: boolean;
  setShowPicker: (v: boolean) => void;
  formatTime: (d: Date) => string;
}) => {
  const bg = tone === "in" ? c.successBg : c.dangerBg;
  const fg = tone === "in" ? c.successText : c.dangerText;
  const icon = tone === "in" ? "log-in-outline" : "log-out-outline";

  if (isWeb) {
    return (
      <View style={styles.timeRow}>
        <View style={[styles.timeIcon, { backgroundColor: bg }]}>
          <Ionicons name={icon as any} size={18} color={fg} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.timeLabel}>{label}</Text>
          <WebDateField
            mode="time"
            value={value ? dateToHM(value) : ""}
            onChange={(v) => {
              const d = hmToDate(v);
              if (d) onChange(d);
            }}
          />
        </View>
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity
        style={styles.timeRow}
        onPress={() => setShowPicker(true)}
        activeOpacity={0.8}
      >
        <View style={[styles.timeIcon, { backgroundColor: bg }]}>
          <Ionicons name={icon as any} size={18} color={fg} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.timeLabel}>{label}</Text>
          <Text
            style={[styles.timeValue, !value && styles.timePlaceholder]}
          >
            {value ? formatTime(value) : "Tap to set"}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
      </TouchableOpacity>
      {showPicker && (
        <DateTimePicker
          value={value || new Date()}
          mode="time"
          onChange={(_, d) => {
            setShowPicker(Platform.OS === "ios");
            if (d) onChange(d);
          }}
        />
      )}
    </>
  );
};

const makeStyles = (c: any) =>
  StyleSheet.create({
    wrap: { marginTop: 16 },
    sectionLoader: { paddingVertical: 40, alignItems: "center" },
    createHint: {
      color: c.textMuted,
      fontSize: 11.5,
      lineHeight: 16,
      marginTop: 8,
    },
    sectionHeadRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      flexWrap: "wrap",
    },
    tsLink: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: c.accentSoft,
      borderWidth: 1,
      borderColor: c.accent,
      ...(Platform.OS === "web" ? { cursor: "pointer" as any } : {}),
    },
    tsLinkText: { color: c.accent, fontSize: 11.5, fontWeight: "800" },
    sectionHeading: {
      color: c.text,
      fontSize: 16,
      fontWeight: "800",
      marginBottom: 12,
      marginLeft: 4,
    },
    calCard: {
      backgroundColor: c.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      padding: 14,
    },

    // ===== auto check-outs =====
    autoCard: {
      backgroundColor: c.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      padding: 14,
      marginBottom: 14,
    },
    autoHead: { flexDirection: "row", alignItems: "center", gap: 12 },
    autoIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: "rgba(245,158,11,0.14)",
      alignItems: "center",
      justifyContent: "center",
    },
    autoTitle: { color: c.text, fontSize: 14.5, fontWeight: "800" },
    autoSub: {
      color: c.textMuted,
      fontSize: 11.5,
      lineHeight: 16,
      marginTop: 2,
    },
    autoStatRow: { flexDirection: "row", gap: 10, marginTop: 14 },
    autoStat: {
      flex: 1,
      backgroundColor: c.surfaceMuted,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      paddingVertical: 10,
      alignItems: "center",
    },
    autoStatValue: { color: "#b45309", fontSize: 22, fontWeight: "900" },
    autoStatValueZero: { color: "#15803d" },
    autoStatLabel: {
      color: c.textMuted,
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 0.9,
      marginTop: 3,
    },

    moreChip: {
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: c.surfaceMuted,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      ...(Platform.OS === "web" ? { cursor: "pointer" as any } : {}),
    },
    moreChipText: { color: c.textMuted, fontSize: 12, fontWeight: "800" },

    chipWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 14,
    },
    dayChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: "rgba(245,158,11,0.10)",
      borderWidth: 1,
      borderColor: "rgba(245,158,11,0.35)",
      ...(Platform.OS === "web" ? { cursor: "pointer" as any } : {}),
    },
    dayChipText: { color: "#b45309", fontSize: 12, fontWeight: "800" },
    autoHint: {
      color: c.textFaint,
      fontSize: 11,
      marginTop: 10,
      fontStyle: "italic",
    },
    autoNone: {
      color: c.textMuted,
      fontSize: 12.5,
      marginTop: 12,
      fontWeight: "600",
    },
    autoTotal: {
      color: c.textFaint,
      fontSize: 11.5,
      marginTop: 10,
      fontWeight: "600",
    },

    corrBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: c.surfaceMuted,
      borderRadius: 12,
      padding: 12,
      marginBottom: 16,
    },
    corrBannerIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: c.accentSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    corrBannerTitle: { color: c.text, fontSize: 14, fontWeight: "800" },
    corrBannerSub: {
      color: c.textMuted,
      fontSize: 12,
      lineHeight: 17,
      marginTop: 2,
    },

    timeRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.surfaceMuted,
      borderRadius: 12,
      padding: 12,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      gap: 8,
    },
    timeIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    timeLabel: { color: c.textMuted, fontSize: 12, fontWeight: "600" },
    timeValue: { color: c.text, fontSize: 14, fontWeight: "700", marginTop: 2 },
    timePlaceholder: { color: c.textMuted, fontWeight: "600" },

    typeRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginBottom: 12,
      marginTop: 4,
    },
    typeChip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: c.surfaceMuted,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
    },
    typeChipActive: { backgroundColor: c.accent, borderColor: c.accent },
    typeChipText: { color: c.textMuted, fontSize: 12, fontWeight: "700" },
    typeChipTextActive: { color: "#fff" },

    modalLabel: { color: c.textMuted, marginBottom: 10, fontWeight: "600" },
    input: {
      backgroundColor: c.surfaceMuted,
      borderRadius: 12,
      padding: 14,
      color: c.text,
      minHeight: 100,
      textAlignVertical: "top",
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      marginBottom: 4,
    },

    cancelBtn: {
      width: "48%",
      backgroundColor: c.surfaceMuted,
      padding: 14,
      borderRadius: 12,
      alignItems: "center",
    },
    saveBtn: {
      width: "48%",
      backgroundColor: c.accent,
      padding: 14,
      borderRadius: 12,
      alignItems: "center",
    },
    modalBtnText: { color: c.text, fontWeight: "700" },
  });
