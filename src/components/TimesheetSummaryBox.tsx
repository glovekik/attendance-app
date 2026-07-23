import React, { useCallback, useEffect, useMemo, useState } from "react";

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

import {
  getTimesheetSummary,
  downloadTimesheetsXlsx,
  TimesheetScope,
  TimesheetFilters,
  TimesheetSummary,
} from "../services/timesheets";
import { useTheme } from "../theme/ThemeProvider";
import { notify } from "../utils/confirm";

/**
 * The "Time Sheets" box HR and managers see above their queue.
 *
 * Same component for both — the only difference is scope, which the server
 * enforces: HR gets the whole company, a manager gets their own reports.
 * Building it once means the two can't drift into disagreeing about what
 * "total hours" means.
 *
 * Approved hours are shown as the headline rather than total hours: hours
 * nobody has signed off aren't a fact yet, they're a claim.
 */
export function TimesheetSummaryBox({
  scope,
  filters,
  /** Bumped by the parent after an approve/reject so the totals refresh. */
  refreshKey,
}: {
  scope: TimesheetScope;
  filters?: TimesheetFilters;
  refreshKey?: number;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);

  const [summary, setSummary] = useState<TimesheetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  const status = filters?.status;
  const userId = filters?.userId;
  const weekStart = filters?.weekStart;

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      setSummary(
        await getTimesheetSummary(token, scope, {
          status,
          userId,
          weekStart,
        })
      );
    } catch {
      // A failed total shouldn't blank the queue underneath it.
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [scope, status, userId, weekStart]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const onDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await downloadTimesheetsXlsx(token, scope, {
        status,
        userId,
        weekStart,
      });
    } catch (err: any) {
      notify("Download failed", err?.message || "");
    } finally {
      setDownloading(false);
    }
  };

  const hours = summary?.approvedHours ?? 0;
  const claimed = summary?.totalHours ?? 0;
  const unapproved = Math.max(0, Math.round((claimed - hours) * 100) / 100);

  return (
    <View style={styles.box}>
      <View style={styles.head}>
        <View style={styles.titleWrap}>
          <Ionicons name="time-outline" size={17} color={c.accent} />
          <Text style={styles.title}>Time Sheets</Text>
        </View>

        <TouchableOpacity
          style={[styles.dlBtn, downloading && { opacity: 0.6 }]}
          onPress={onDownload}
          disabled={downloading}
          activeOpacity={0.85}
        >
          <Ionicons
            name={downloading ? "hourglass-outline" : "download-outline"}
            size={15}
            color={c.accent}
          />
          <Text style={styles.dlText}>
            {downloading ? "Preparing…" : "Download"}
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator
          size="small"
          color={c.accent}
          style={{ marginVertical: 16 }}
        />
      ) : (
        <>
          <Text style={styles.bigNumber}>
            {hours.toFixed(1)}
            <Text style={styles.bigUnit}> h</Text>
          </Text>
          <Text style={styles.bigLabel}>
            Total hours worked · approved
            {weekStart ? ` · week of ${weekStart}` : ""}
          </Text>

          <View style={styles.stats}>
            <Stat
              styles={styles}
              value={String(summary?.count ?? 0)}
              label="Sheets"
            />
            <Stat
              styles={styles}
              value={String(summary?.employees ?? 0)}
              label="People"
            />
            <Stat
              styles={styles}
              value={String(summary?.byStatus?.PENDING ?? 0)}
              label="Pending"
            />
            <Stat
              styles={styles}
              value={unapproved ? unapproved.toFixed(1) : "0"}
              label="Unapproved h"
            />
          </View>
        </>
      )}
    </View>
  );
}

const Stat = ({
  styles,
  value,
  label,
}: {
  styles: any;
  value: string;
  label: string;
}) => (
  <View style={styles.stat}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const makeStyles = (c: any) =>
  StyleSheet.create({
    box: {
      backgroundColor: c.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      padding: 16,
      marginBottom: 12,
    },
    head: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    titleWrap: { flexDirection: "row", alignItems: "center", gap: 7 },
    title: {
      color: c.text,
      fontSize: 13,
      fontWeight: "800",
      letterSpacing: 0.3,
    },
    dlBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: c.accentSoft,
      borderWidth: 1,
      borderColor: c.accent,
      ...(Platform.OS === "web" ? { cursor: "pointer" as any } : {}),
    },
    dlText: { color: c.accent, fontSize: 11.5, fontWeight: "800" },

    bigNumber: {
      color: c.text,
      fontSize: 34,
      fontWeight: "900",
      letterSpacing: -1,
      marginTop: 12,
    },
    bigUnit: { fontSize: 17, fontWeight: "800", color: c.textMuted },
    bigLabel: { color: c.textMuted, fontSize: 11.5, marginTop: 2 },

    stats: { flexDirection: "row", gap: 8, marginTop: 14 },
    stat: {
      flex: 1,
      backgroundColor: c.surfaceMuted,
      borderRadius: 10,
      paddingVertical: 9,
      alignItems: "center",
    },
    statValue: { color: c.text, fontSize: 15, fontWeight: "800" },
    statLabel: {
      color: c.textMuted,
      fontSize: 9.5,
      fontWeight: "700",
      marginTop: 2,
      textAlign: "center",
    },
  });
