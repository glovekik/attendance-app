import React, { useMemo } from "react";

import { View, Text, StyleSheet } from "react-native";

import { useTheme } from "../theme/ThemeProvider";

/**
 * How far along a project is, on two axes that are easy to confuse.
 *
 * Work done is tasks completed. Time elapsed is where today sits between
 * the start and end dates. Showing only the first flatters a project that
 * is 40% done with 90% of its schedule gone, which is exactly the project
 * someone needs to look at — so both are drawn on the same bar, with the
 * schedule as a marker over the fill.
 *
 * Everything here is derived from data the project already has. Nothing new
 * is stored, so there is no second number that can fall out of date.
 */
export interface ProjectProgressProps {
  completed: number;
  total: number;
  startDate?: string | null;
  endDate?: string | null;
  /** Hide the schedule marker where dates aren't meaningful. */
  showSchedule?: boolean;
  /**
   * The authoritative percentage, when something upstream knows better than
   * a task count — weighted phases, or a figure a manager pinned. Without
   * it this bar recomputed from completed/total and cheerfully disagreed
   * with the Phases tab on the same screen.
   */
  percentOverride?: number | null;
  /** Shown under the bar to say where the number came from. */
  sourceNote?: string | null;
}

/** 0–1, or null when the dates can't place today on a line. */
export const scheduleFraction = (
  startDate?: string | null,
  endDate?: string | null,
  now: number = Date.now()
): number | null => {
  if (!startDate || !endDate) return null;
  const start = new Date(`${startDate}T00:00:00`).getTime();
  const end = new Date(`${endDate}T23:59:59`).getTime();
  if (isNaN(start) || isNaN(end) || end <= start) return null;
  return Math.min(1, Math.max(0, (now - start) / (end - start)));
};

/**
 * Calendar days until the end date; 0 on the day itself, negative after.
 *
 * Counted as whole days between two dates rather than elapsed milliseconds.
 * Dividing a duration and rounding up reports "1d left" at breakfast on the
 * due date — the badge says there's a day in hand when there isn't.
 */
export const daysRemaining = (
  endDate?: string | null,
  now: number = Date.now()
): number | null => {
  if (!endDate) return null;
  const [y, m, d] = endDate.split("-").map(Number);
  if (!y || !m || !d) return null;
  const end = Date.UTC(y, m - 1, d);
  if (isNaN(end)) return null;
  // Today as a UTC midnight too, so both sides are plain calendar dates and
  // the subtraction can't be skewed by the time of day or the timezone.
  const t = new Date(now);
  const today = Date.UTC(t.getFullYear(), t.getMonth(), t.getDate());
  return Math.round((end - today) / 86_400_000);
};

export const ProjectProgress = ({
  completed,
  total,
  startDate,
  endDate,
  showSchedule = true,
  percentOverride,
  sourceNote,
}: ProjectProgressProps) => {
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);

  const pct =
    typeof percentOverride === "number"
      ? Math.max(0, Math.min(100, Math.round(percentOverride)))
      : total > 0
      ? Math.round(Math.min(1, completed / total) * 100)
      : 0;
  const done = pct / 100;
  const sched = showSchedule ? scheduleFraction(startDate, endDate) : null;
  const left = daysRemaining(endDate);

  // Behind means the calendar has run further than the work. A 10-point
  // margin keeps a normally-paced project from being flagged every day.
  const behind = sched !== null && sched - done > 0.1;
  const overdue = left !== null && left < 0 && done < 1;
  const barColor = overdue ? "#dc2626" : behind ? "#d97706" : c.accent;

  return (
    <View style={styles.wrap}>
      <View style={styles.headRow}>
        <Text style={styles.pct}>{pct}%</Text>
        <Text style={styles.count}>
          {total > 0 ? `${completed} of ${total} tasks` : "No tasks yet"}
        </Text>
        {left !== null && (
          <Text
            style={[
              styles.due,
              overdue && styles.dueBad,
              !overdue && behind && styles.dueWarn,
            ]}
          >
            {left < 0
              ? `${Math.abs(left)}d overdue`
              : left === 0
              ? "Due today"
              : `${left}d left`}
          </Text>
        )}
      </View>

      <View style={styles.track} accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: pct }}>
        <View
          style={[styles.fill, { width: `${pct}%`, backgroundColor: barColor }]}
        />
        {sched !== null && (
          // Where the schedule says we should be. Sitting ahead of the fill
          // is the signal worth noticing.
          <View
            style={[styles.marker, { left: `${Math.round(sched * 100)}%` }]}
          />
        )}
      </View>

      {(sched !== null || !!sourceNote) && (
        <Text style={styles.legend}>
          {[
            sourceNote,
            sched === null
              ? null
              : behind
              ? `schedule ${Math.round(sched * 100)}% elapsed — work is behind`
              : `schedule ${Math.round(sched * 100)}% elapsed`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      )}
    </View>
  );
};

const makeStyles = (c: any) =>
  StyleSheet.create({
    wrap: { gap: 6 },
    headRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
    pct: { fontSize: 20, fontWeight: "800", color: c.text },
    count: { flex: 1, fontSize: 12, color: c.textMuted },
    due: { fontSize: 12, fontWeight: "700", color: c.textMuted },
    dueWarn: { color: "#d97706" },
    dueBad: { color: "#dc2626" },
    track: {
      height: 8,
      borderRadius: 999,
      backgroundColor: c.surfaceMuted,
      overflow: "visible",
      justifyContent: "center",
    },
    fill: { height: 8, borderRadius: 999 },
    marker: {
      position: "absolute",
      width: 2,
      height: 14,
      borderRadius: 1,
      backgroundColor: c.textMuted,
    },
    legend: { fontSize: 11, color: c.textFaint },
  });
