import React, { useEffect, useMemo, useState } from "react";

import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../theme/ThemeProvider";
import { ATT, ATT_BG, ATT_LETTER } from "../theme/attendanceColors";

// Distinct tone for the client-address icon in the detail panel.
const CLIENT_FG = "#7c3aed";

const pad = (n: number) => String(n).padStart(2, "0");
const todayYMD = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const formatHM = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const durationOf = (r?: CalRow): string => {
  if (!r) return "—";
  if (typeof r.hoursWorked === "number" && r.hoursWorked > 0) {
    const h = Math.floor(r.hoursWorked);
    const m = Math.round((r.hoursWorked - h) * 60);
    return `${h}h ${pad(m)}m`;
  }
  if (!r.checkIn || !r.checkOut) return "—";
  const mins =
    (new Date(r.checkOut).getTime() - new Date(r.checkIn).getTime()) / 60000;
  if (!(mins > 0)) return "—";
  return `${Math.floor(mins / 60)}h ${pad(Math.round(mins % 60))}m`;
};

const PRESENT = new Set(["PRESENT", "CHECKED_IN", "COMPLETED", "LATE", "HALF_DAY"]);
type Cat = "office" | "wfh" | "client" | "halfday" | "leave" | "absent";

// One row → a category (matches the attendance screens' catOf).
export interface CalRow {
  id?: string;
  date: string;
  checkIn?: string | null;
  checkOut?: string | null;
  hoursWorked?: number;
  workNotes?: string;
  attendanceType?: string | null;
  status?: string;
  isLate?: boolean;
  clientAddress?: string | null;
  clientName?: string | null;
  autoClosedByCron?: boolean;
  unpaid?: boolean;
  halfDay?: boolean;
  halfDayPart?: string | null;
}

const catOf = (r?: CalRow): Cat => {
  if (!r) return "absent";
  // Half-day leave is half a working day, so it reads as a half day rather
  // than a full "on leave" — checked before the LEAVE branch, which would
  // otherwise swallow it and show the day as entirely off.
  if (r.halfDay) return "halfday";
  if (r.attendanceType === "LEAVE") return "leave";
  // Worked part of the day and took the rest off. Checked BEFORE the office /
  // WFH split: where the person sat matters less than that half the day is
  // unaccounted for.
  if (r.status === "HALF_DAY") return "halfday";
  if (r.attendanceType === "CLIENT") return "client";
  if (r.status === "ABSENT") return "absent";
  if (r.checkIn || (r.status && PRESENT.has(r.status))) {
    return r.attendanceType === "WFH" ? "wfh" : "office";
  }
  return "absent";
};

const monthTitle = (monthStr: string) => {
  const [y, m] = monthStr.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
};

const shiftMonth = (monthStr: string, delta: number): string => {
  const [y, m] = monthStr.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

/**
 * A month calendar for ONE person's attendance — day cells coloured by type,
 * a legend, and a tap-to-see-details panel. Preselects a sensible day so the
 * detail is visible immediately. Shared by the HR and Work-Performance screens.
 *
 * Optional props turn it into the interactive version used on the Attendance
 * screen: month navigation plus correction / HR-edit actions in the detail
 * panel. When they're omitted the component behaves exactly as before, so the
 * read-only HR surfaces are unaffected.
 */
export function AttendanceCalendar({
  monthStr,
  rows,
  holidayMap = {},
  navigable = false,
  onMonthChange,
  onRequestCorrection,
  onAddRecord,
  onEdit,
  onDelete,
  onToggleUnpaid,
  correctionByDate = {},
}: {
  monthStr: string; // "YYYY-MM"
  rows: CalRow[];
  holidayMap?: Record<string, string>;
  navigable?: boolean;
  onMonthChange?: (monthStr: string) => void;
  /** Employee action — request a correction for this day (rec may be absent). */
  onRequestCorrection?: (dayKey: string, rec?: CalRow) => void;
  /** HR only: create a record for a day that has none. Without this, an
   *  empty day offered HR nothing at all — Edit and Delete both need an
   *  existing record, and HR doesn't raise correction requests. */
  onAddRecord?: (dayKey: string) => void;
  /** HR actions on an existing record. */
  onEdit?: (rec: CalRow) => void;
  onDelete?: (rec: CalRow) => void;
  /** HR only: mark/clear this day as unpaid (LOP) leave. Works on a day with
   *  no record too — that's the common case, since an unpaid day is usually
   *  one nobody checked in on. `next` is the state being moved TO. */
  onToggleUnpaid?: (dayKey: string, next: boolean, rec?: CalRow) => void;
  /** Latest correction status per date, so the panel can show pending state. */
  correctionByDate?: Record<string, "PENDING" | "APPROVED" | "REJECTED">;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);

  const [y, m] = monthStr.split("-").map(Number);
  const todayY = todayYMD();

  const byDate = useMemo(() => {
    const map: Record<string, CalRow> = {};
    rows.forEach((r) => { if (r.date) map[r.date] = r; });
    return map;
  }, [rows]);

  const defaultSel = () => {
    const [ty, tm] = todayY.split("-").map(Number);
    if (ty === y && tm === m) return todayY;
    const ds = rows.map((r) => r.date).filter(Boolean).sort();
    return ds.length ? ds[ds.length - 1] : null;
  };

  // Preselect today when this month is showing, else the latest recorded day.
  const [sel, setSel] = useState<string | null>(defaultSel);

  // Navigating to another month must drop a selection that belongs to the old
  // one — otherwise the detail panel describes a day that isn't on screen.
  useEffect(() => {
    setSel((prev) => (prev && prev.startsWith(monthStr) ? prev : null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthStr]);

  const prettyDay = (key: string) => {
    const [yy, mm, dd] = key.split("-").map(Number);
    return new Date(yy, mm - 1, dd).toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const weeks = useMemo(() => {
    const firstWd = new Date(y, m - 1, 1).getDay();
    const days = new Date(y, m, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstWd; i++) cells.push(null);
    for (let d = 1; d <= days; d++) cells.push(d);
    while (cells.length % 7) cells.push(null);
    const out: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7));
    return out;
  }, [y, m]);

  const classify = (day: number) => {
    const key = `${y}-${pad(m)}-${pad(day)}`;
    const rec = byDate[key];
    const isSunday = new Date(y, m - 1, day).getDay() === 0;
    if (rec) {
      const cat = catOf(rec);
      // Attended days (office / client) share the teal "Attended" tone; WFH is
      // violet. Paid leave is blue, unpaid leave (LOP) is orange — detected
      // from the leave day's note ("LOP leave" / "Loss of pay").
      if (cat === "leave") {
        const note = (rec.workNotes || "").toLowerCase();
        const unpaid = rec.unpaid === true || /\blop\b|loss of pay|unpaid/.test(note);
        return unpaid
          ? { color: ATT.unpaid, softBg: ATT_BG.unpaid, letter: "U", label: "Unpaid leave", rec, key }
          : { color: ATT.leave, softBg: ATT_BG.leave, letter: "L", label: "On leave", rec, key };
      }
      if (cat === "halfday") {
        // Two ways to land here: half a day of approved leave, or a short
        // worked day. Same swatch, but the tooltip should say which.
        const part = rec.halfDayPart === "SECOND" ? "second half" : "first half";
        return {
          color: ATT.halfday,
          softBg: ATT_BG.halfday,
          letter: ATT_LETTER.halfday,
          label: rec.halfDay
            ? `Half day leave — ${part} off`
            : "Half day — worked part of the day",
          rec,
          key,
        };
      }
      if (cat === "absent") return { color: ATT.absent, softBg: ATT_BG.absent, letter: "N", label: "No record found", rec, key };
      if (cat === "client") return { color: ATT.present, softBg: ATT_BG.present, letter: "C", label: "At client", rec, key };
      if (cat === "wfh") return { color: ATT.wfh, softBg: ATT_BG.wfh, letter: "W", label: "Work from home", rec, key };
      return { color: ATT.present, softBg: ATT_BG.present, letter: "P", label: "Office", rec, key };
    }
    if (holidayMap[key]) return { color: ATT.holiday, softBg: ATT_BG.holiday, letter: "H", label: `Holiday — ${holidayMap[key]}`, rec: undefined, key };
    if (isSunday) return { color: ATT.holiday, softBg: ATT_BG.holiday, letter: "H", label: "Weekly off (Sunday)", rec: undefined, key };
    if (key < todayY) return { color: ATT.absent, softBg: ATT_BG.absent, letter: "N", label: "No record found", rec: undefined, key };
    return { color: null as string | null, softBg: null as string | null, letter: "", label: "Upcoming", rec: undefined, key };
  };

  const selInfo = sel ? classify(Number(sel.slice(8, 10))) : null;
  const selLate = !!(
    selInfo?.rec &&
    (selInfo.rec.status === "LATE" || selInfo.rec.isLate)
  );
  const selCorrection = sel ? correctionByDate[sel] : undefined;
  const isFuture = !!sel && sel > todayY;
  const interactive =
    !!onRequestCorrection ||
    !!onAddRecord ||
    !!onEdit ||
    !!onDelete ||
    !!onToggleUnpaid;

  return (
    <View>
      {navigable && (
        <View style={styles.monthNav}>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => onMonthChange?.(shiftMonth(monthStr, -1))}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={18} color={c.text} />
          </TouchableOpacity>
          <Text style={styles.monthTitle}>{monthTitle(monthStr)}</Text>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => onMonthChange?.(shiftMonth(monthStr, 1))}
            hitSlop={8}
          >
            <Ionicons name="chevron-forward" size={18} color={c.text} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.weekHead}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <Text key={d} style={styles.weekHeadCell}>{d}</Text>
        ))}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.weekRow}>
          {week.map((day, di) => {
            if (day === null) return <View key={di} style={styles.cell} />;
            const key = `${y}-${pad(m)}-${pad(day)}`;
            const info = classify(day);
            const isSel = key === sel;
            const isToday = key === todayY;
            // A late arrival still counts as present (letter "P"), but the cell
            // gets a red outline so late days stand out on every calendar.
            const isLate = !!(
              info.rec && (info.rec.status === "LATE" || info.rec.isLate)
            );
            return (
              <TouchableOpacity
                key={di}
                style={[
                  styles.cell,
                  info.softBg ? { backgroundColor: info.softBg } : null,
                  isToday && styles.cellToday,
                  isLate && styles.cellLate,
                  isSel && styles.cellSel,
                ]}
                activeOpacity={0.7}
                onPress={() => setSel(isSel ? null : key)}
              >
                <Text style={[styles.dayNum, isSel && styles.dayNumSel]}>{day}</Text>
                {!!info.letter && (
                  <Text style={[styles.cellLetter, info.color ? { color: info.color } : null]}>
                    {info.letter}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      {selInfo ? (
        <View style={styles.detail}>
          {/* Status header — colour chip + date + label */}
          <View style={styles.detailHead}>
            <View
              style={[
                styles.statusChip,
                {
                  backgroundColor: selInfo.softBg || c.surfaceMuted,
                  borderColor: selInfo.color || c.surfaceBorder,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusChipText,
                  { color: selInfo.color || c.textMuted },
                ]}
              >
                {selInfo.letter || "·"}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailDate}>{prettyDay(selInfo.key)}</Text>
              <Text style={styles.detailLabel}>{selInfo.label}</Text>
            </View>
            {selLate && (
              <View style={styles.latePill}>
                <Ionicons name="alert-circle-outline" size={12} color="#DC2626" />
                <Text style={styles.latePillText}>Late</Text>
              </View>
            )}
            {selCorrection === "PENDING" && (
              <View style={styles.pendingPill}>
                <Ionicons name="time-outline" size={12} color="#b45309" />
                <Text style={styles.pendingPillText}>Pending</Text>
              </View>
            )}
          </View>

          {/* Times as three clean stat tiles */}
          {!!selInfo.rec && (!!selInfo.rec.checkIn || !!selInfo.rec.checkOut) && (
            <View style={styles.statRow}>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>IN</Text>
                <Text style={styles.statValue}>{formatHM(selInfo.rec.checkIn)}</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>OUT</Text>
                <Text style={styles.statValue}>{formatHM(selInfo.rec.checkOut)}</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>TOTAL</Text>
                <Text style={[styles.statValue, { color: ATT.present }]}>
                  {durationOf(selInfo.rec)}
                </Text>
              </View>
            </View>
          )}

          {(!!selInfo.rec?.clientName || !!selInfo.rec?.clientAddress) && (
            <View style={styles.metaRow}>
              <Ionicons name="navigate-outline" size={14} color={CLIENT_FG} />
              <Text style={styles.metaText}>
                {selInfo.rec.clientName || selInfo.rec.clientAddress}
              </Text>
            </View>
          )}

          {selInfo.rec?.autoClosedByCron && (
            <View style={styles.warnRow}>
              <Ionicons name="alert-circle-outline" size={14} color="#b45309" />
              <Text style={styles.warnText}>
                Auto-closed at midnight — looks like you forgot to check out.
              </Text>
            </View>
          )}

          {!!selInfo.rec?.workNotes?.trim() ? (
            <View style={styles.notesBox}>
              <Text style={styles.notesLabel}>WORK NOTES</Text>
              <Text style={styles.notesText}>
                {selInfo.rec.workNotes.trim()}
              </Text>
            </View>
          ) : !!selInfo.rec ? (
            <Text style={styles.notesMuted}>No work notes for this day.</Text>
          ) : null}

          {/* Actions */}
          {interactive && !isFuture && (
            <View style={styles.actions}>
              {!!onEdit && !!selInfo.rec && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionGhost]}
                  onPress={() => onEdit(selInfo.rec!)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="create-outline" size={15} color={c.text} />
                  <Text style={styles.actionGhostText}>Edit</Text>
                </TouchableOpacity>
              )}
              {!!onDelete && !!selInfo.rec && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionDanger]}
                  onPress={() => onDelete(selInfo.rec!)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="trash-outline" size={15} color="#dc2626" />
                  <Text style={styles.actionDangerText}>Delete</Text>
                </TouchableOpacity>
              )}
              {!!onAddRecord && !selInfo.rec && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionPrimary]}
                  onPress={() => onAddRecord(selInfo.key)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add" size={16} color="#fff" />
                  <Text style={styles.actionPrimaryText}>Add record</Text>
                </TouchableOpacity>
              )}
              {!!onRequestCorrection && selCorrection !== "PENDING" && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionPrimary]}
                  onPress={() => onRequestCorrection(selInfo.key, selInfo.rec)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="time-outline" size={15} color="#fff" />
                  <Text style={styles.actionPrimaryText}>
                    {selCorrection === "REJECTED"
                      ? "Request again"
                      : selInfo.rec
                      ? "Request correction"
                      : "Add this day"}
                  </Text>
                </TouchableOpacity>
              )}
              {!!onToggleUnpaid && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionUnpaid]}
                  onPress={() =>
                    onToggleUnpaid(
                      selInfo.key,
                      !selInfo.rec?.unpaid,
                      selInfo.rec
                    )
                  }
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name={
                      selInfo.rec?.unpaid
                        ? "close-circle-outline"
                        : "remove-circle-outline"
                    }
                    size={15}
                    color={ATT.unpaid}
                  />
                  <Text style={styles.actionUnpaidText}>
                    {selInfo.rec?.unpaid
                      ? "Remove unpaid leave"
                      : "Mark unpaid leave"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      ) : (
        <Text style={styles.tapHint}>Tap a day to see its attendance.</Text>
      )}

      <View style={styles.legend}>
        {([
          ["P · Present", ATT.present],
          ["W · WFH", ATT.wfh],
          [`${ATT_LETTER.halfday} · Half day`, ATT.halfday],
          ["L · Paid leave", ATT.leave],
          ["U · Unpaid leave", ATT.unpaid],
          ["N · No record", ATT.absent],
          ["H · Holiday / Off", ATT.holiday],
        ] as [string, string][]).map(([l, col]) => (
          <View key={l} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: col }]} />
            <Text style={styles.legendText}>{l}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const makeStyles = (c: any) =>
  StyleSheet.create({
    monthNav: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },
    navBtn: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.surfaceMuted,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      ...(Platform.OS === "web" ? { cursor: "pointer" as any } : {}),
    },
    monthTitle: { color: c.text, fontSize: 14, fontWeight: "800", letterSpacing: 0.3 },

    weekHead: { flexDirection: "row", marginBottom: 6 },
    weekHeadCell: { flex: 1, textAlign: "center", color: c.textMuted, fontSize: 11, fontWeight: "800" },
    weekRow: { flexDirection: "row" },
    // Each day is a color-filled "card" (fill = attendance status). Selected /
    // today are rings so the status fill underneath stays visible.
    cell: {
      flex: 1,
      aspectRatio: 1,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 9,
      marginHorizontal: 2,
      marginVertical: 2,
      borderWidth: 2,
      borderColor: "transparent",
    },
    cellToday: { borderColor: c.textFaint },
    cellLate: { borderColor: "#DC2626" },
    cellSel: { borderColor: c.accent },
    dayNum: { color: c.text, fontSize: 13, fontWeight: "700" },
    dayNumSel: { color: c.accent, fontWeight: "800" },
    // Type letter in the top-right of each card (W / L / U / N / H / C / P).
    cellLetter: { position: "absolute", top: 3, right: 4, fontSize: 8.5, fontWeight: "900", opacity: 0.9 },

    legend: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12, marginTop: 14 },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { color: c.textMuted, fontSize: 11, fontWeight: "600" },

    // ===== detail panel =====
    detail: {
      marginTop: 14,
      backgroundColor: c.surfaceMuted,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
    },
    detailHead: { flexDirection: "row", alignItems: "center", gap: 10 },
    statusChip: {
      width: 34,
      height: 34,
      borderRadius: 10,
      borderWidth: 1.5,
      alignItems: "center",
      justifyContent: "center",
    },
    statusChipText: { fontSize: 14, fontWeight: "900" },
    detailDate: { color: c.textMuted, fontSize: 11.5, fontWeight: "700" },
    detailLabel: { color: c.text, fontSize: 15, fontWeight: "800", marginTop: 2 },

    pendingPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: "rgba(245,158,11,0.14)",
      borderColor: "rgba(245,158,11,0.4)",
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
    },
    pendingPillText: { color: "#b45309", fontSize: 11, fontWeight: "800" },
    latePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: "rgba(220,38,38,0.12)",
      borderColor: "rgba(220,38,38,0.4)",
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
    },
    latePillText: { color: "#DC2626", fontSize: 11, fontWeight: "800" },

    statRow: { flexDirection: "row", gap: 8, marginTop: 12 },
    stat: {
      flex: 1,
      backgroundColor: c.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      paddingVertical: 9,
      paddingHorizontal: 8,
      alignItems: "center",
    },
    statLabel: {
      color: c.textMuted,
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 1,
    },
    statValue: { color: c.text, fontSize: 13.5, fontWeight: "800", marginTop: 3 },

    metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
    metaText: { color: c.textMuted, fontSize: 12.5, flexShrink: 1 },

    warnRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 6,
      marginTop: 10,
      backgroundColor: "rgba(245,158,11,0.10)",
      borderRadius: 9,
      padding: 8,
    },
    warnText: { color: "#b45309", fontSize: 11.5, lineHeight: 16, flex: 1 },

    notesBox: {
      marginTop: 12,
      backgroundColor: c.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      padding: 10,
    },
    notesLabel: {
      color: c.textMuted,
      fontSize: 9,
      fontWeight: "800",
      letterSpacing: 1,
      marginBottom: 4,
    },
    notesText: { color: c.text, fontSize: 12.5, lineHeight: 18 },
    notesMuted: { color: c.textFaint, fontSize: 12, fontStyle: "italic", marginTop: 10 },

    actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
    actionBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 10,
      flexGrow: 1,
      ...(Platform.OS === "web" ? { cursor: "pointer" as any } : {}),
    },
    actionPrimary: { backgroundColor: c.accent },
    actionPrimaryText: { color: "#fff", fontSize: 12.5, fontWeight: "800" },
    actionGhost: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
    },
    actionGhostText: { color: c.text, fontSize: 12.5, fontWeight: "800" },
    actionDanger: {
      backgroundColor: "rgba(220,38,38,0.10)",
      borderWidth: 1,
      borderColor: "rgba(220,38,38,0.35)",
    },
    actionDangerText: { color: "#dc2626", fontSize: 12.5, fontWeight: "800" },

    actionUnpaid: {
      backgroundColor: ATT_BG.unpaid,
      borderWidth: 1,
      borderColor: ATT.unpaid,
    },
    actionUnpaidText: { color: ATT.unpaid, fontSize: 12.5, fontWeight: "800" },

    tapHint: { color: c.textFaint, fontSize: 12, textAlign: "center", marginTop: 14 },
  });
