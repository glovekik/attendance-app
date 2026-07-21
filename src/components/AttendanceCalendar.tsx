import React, { useMemo, useState } from "react";

import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../theme/ThemeProvider";
import { ATT, ATT_BG } from "../theme/attendanceColors";

// Distinct tone for the client-address icon in the detail panel.
const CLIENT_FG = "#7c3aed";

const pad = (n: number) => String(n).padStart(2, "0");
const todayYMD = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const formatHM = (iso?: string | null) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? "-"
    : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const PRESENT = new Set(["PRESENT", "CHECKED_IN", "COMPLETED", "LATE", "HALF_DAY"]);
type Cat = "office" | "wfh" | "client" | "leave" | "absent";

// One row → a category (matches the attendance screens' catOf).
export interface CalRow {
  date: string;
  checkIn?: string | null;
  checkOut?: string | null;
  hoursWorked?: number;
  workNotes?: string;
  attendanceType?: string | null;
  status?: string;
  clientAddress?: string | null;
  unpaid?: boolean;
}

const catOf = (r?: CalRow): Cat => {
  if (!r) return "absent";
  if (r.attendanceType === "LEAVE") return "leave";
  if (r.attendanceType === "CLIENT") return "client";
  if (r.status === "ABSENT") return "absent";
  if (r.checkIn || (r.status && PRESENT.has(r.status))) {
    return r.attendanceType === "WFH" ? "wfh" : "office";
  }
  return "absent";
};

/**
 * A month calendar for ONE person's attendance — day cells coloured by type,
 * a legend, and a tap-to-see-details panel. Preselects a sensible day so the
 * detail is visible immediately. Shared by the HR and Work-Performance screens.
 */
export function AttendanceCalendar({
  monthStr,
  rows,
  holidayMap = {},
}: {
  monthStr: string; // "YYYY-MM"
  rows: CalRow[];
  holidayMap?: Record<string, string>;
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

  // Preselect today when this month is showing, else the latest recorded day.
  const [sel, setSel] = useState<string | null>(() => {
    const [ty, tm] = todayY.split("-").map(Number);
    if (ty === y && tm === m) return todayY;
    const ds = rows.map((r) => r.date).filter(Boolean).sort();
    return ds.length ? ds[ds.length - 1] : null;
  });

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

  return (
    <View>
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
            return (
              <TouchableOpacity
                key={di}
                style={[
                  styles.cell,
                  info.softBg ? { backgroundColor: info.softBg } : null,
                  isToday && styles.cellToday,
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
          <View style={styles.detailHead}>
            {!!selInfo.color && <View style={[styles.detailDot, { backgroundColor: selInfo.color }]} />}
            <Text style={styles.detailDate}>{prettyDay(selInfo.key)}</Text>
          </View>
          <Text style={styles.detailLabel}>{selInfo.label}</Text>
          {!!selInfo.rec && (!!selInfo.rec.checkIn || !!selInfo.rec.checkOut) && (
            <View style={styles.detailRow}>
              <Ionicons name="time-outline" size={14} color={c.textMuted} />
              <Text style={styles.detailTimes}>
                In {formatHM(selInfo.rec.checkIn)} · Out {formatHM(selInfo.rec.checkOut)}
                {selInfo.rec.hoursWorked ? ` · ${selInfo.rec.hoursWorked.toFixed(1)}h` : ""}
              </Text>
            </View>
          )}
          {!!selInfo.rec?.clientAddress && (
            <View style={styles.detailRow}>
              <Ionicons name="navigate-outline" size={14} color={CLIENT_FG} />
              <Text style={styles.detailTimes}>{selInfo.rec.clientAddress}</Text>
            </View>
          )}
          {!!selInfo.rec?.workNotes?.trim() ? (
            <Text style={styles.detailNotes}>{selInfo.rec.workNotes.trim()}</Text>
          ) : !!selInfo.rec ? (
            <Text style={styles.detailNotesMuted}>No work notes for this day.</Text>
          ) : null}
        </View>
      ) : (
        <Text style={styles.tapHint}>Tap a day to see its attendance.</Text>
      )}

      <View style={styles.legend}>
        {([
          ["P · Present", ATT.present],
          ["W · WFH", ATT.wfh],
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
    cellSel: { borderColor: c.accent },
    dayNum: { color: c.text, fontSize: 13, fontWeight: "700" },
    dayNumSel: { color: c.accent, fontWeight: "800" },
    // Type letter in the top-right of each card (W / L / U / N / H / C / P).
    cellLetter: { position: "absolute", top: 3, right: 4, fontSize: 8.5, fontWeight: "900", opacity: 0.9 },
    legend: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12, marginTop: 14 },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { color: c.textMuted, fontSize: 11, fontWeight: "600" },
    detail: {
      marginTop: 14,
      backgroundColor: c.surfaceMuted,
      borderRadius: 12,
      padding: 12,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
    },
    detailHead: { flexDirection: "row", alignItems: "center", gap: 7 },
    detailDot: { width: 9, height: 9, borderRadius: 5 },
    detailDate: { color: c.textMuted, fontSize: 12, fontWeight: "700" },
    detailLabel: { color: c.text, fontSize: 15, fontWeight: "800", marginTop: 4 },
    detailRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
    detailTimes: { color: c.textMuted, fontSize: 13, flexShrink: 1 },
    detailNotes: { color: c.text, fontSize: 13, lineHeight: 19, marginTop: 8 },
    detailNotesMuted: { color: c.textFaint, fontSize: 12, fontStyle: "italic", marginTop: 8 },
    tapHint: { color: c.textFaint, fontSize: 12, textAlign: "center", marginTop: 14 },
  });
