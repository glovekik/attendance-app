import React, { useEffect, useMemo, useRef } from "react";

import {
  View,
  Text,
  StyleSheet,
  Animated,
  Pressable,
  Platform,
  useWindowDimensions,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../theme/ThemeProvider";
import { daysRemaining, scheduleFraction } from "./ProjectProgress";

/**
 * The top of a project page: what it is, how far along, and the four
 * numbers worth knowing before you pick a tab.
 *
 * Replaces a title, a row of chips and a separate progress card that had
 * each been added at a different time and shared no visual hierarchy —
 * everything was the same weight, so nothing read first.
 *
 * The bar animates to its value rather than snapping. That isn't decoration:
 * when changing a task's weight moves the number, the motion is what tells
 * you your edit did something.
 */
export interface ProjectHeroStat {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  /** Colours the value — for the one stat that needs attention. */
  tone?: "default" | "warn" | "danger" | "good";
  onPress?: () => void;
}

export interface ProjectHeroProps {
  name: string;
  status: string;
  code?: string | null;
  managerNames?: string;
  percent: number;
  /** Where the number came from, shown under the bar. */
  sourceNote?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  stats: ProjectHeroStat[];
  onBack: () => void;
  onChat?: () => void;
}

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  Active: { bg: "rgba(22,163,74,0.14)", fg: "#15803d" },
  OnHold: { bg: "rgba(245,158,11,0.16)", fg: "#b45309" },
  Completed: { bg: "rgba(100,116,139,0.16)", fg: "#475569" },
};

export const ProjectHero = ({
  name,
  status,
  code,
  managerNames,
  percent,
  sourceNote,
  startDate,
  endDate,
  stats,
  onBack,
  onChat,
}: ProjectHeroProps) => {
  const { theme } = useTheme();
  const c = theme.colors;
  const { width } = useWindowDimensions();
  const narrow = width < 560;
  const styles = useMemo(() => makeStyles(c, narrow), [c, narrow]);

  // Animate to the new value so an edit elsewhere on the page is visibly
  // reflected here rather than silently re-rendering.
  const grow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(grow, {
      toValue: Math.max(0, Math.min(100, percent)),
      duration: 520,
      // Width can't be driven natively; this is a layout property.
      useNativeDriver: false,
    }).start();
  }, [percent, grow]);

  const sched = scheduleFraction(startDate, endDate);
  const left = daysRemaining(endDate);
  const behind = sched !== null && sched - percent / 100 > 0.1;
  const overdue = left !== null && left < 0 && percent < 100;
  const barColor = overdue ? "#dc2626" : behind ? "#d97706" : c.accent;
  const tone = STATUS_TONE[status] || STATUS_TONE.Completed;

  return (
    <View style={styles.hero}>
      <View style={styles.topRow}>
        <Pressable
          onPress={onBack}
          style={({ hovered, pressed }: any) => [
            styles.iconBtn,
            hovered && styles.iconBtnHover,
            pressed && styles.iconBtnPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Back to projects"
        >
          <Ionicons name="chevron-back" size={20} color={c.text} />
        </Pressable>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name} numberOfLines={2}>
            {name}
          </Text>
          <View style={styles.subRow}>
            <View style={[styles.statusChip, { backgroundColor: tone.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: tone.fg }]} />
              <Text style={[styles.statusText, { color: tone.fg }]}>
                {status}
              </Text>
            </View>
            {!!code && <Text style={styles.sub}>{code}</Text>}
            {!!managerNames && (
              <Text style={styles.sub} numberOfLines={1}>
                {managerNames}
              </Text>
            )}
          </View>
        </View>

        {!!onChat && (
          <Pressable
            onPress={onChat}
            style={({ hovered, pressed }: any) => [
              styles.chatBtn,
              hovered && styles.chatBtnHover,
              pressed && styles.iconBtnPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Project chat"
          >
            <Ionicons name="chatbubbles-outline" size={18} color="#fff" />
          </Pressable>
        )}
      </View>

      {/* ---- progress ---- */}
      <View style={styles.progressBlock}>
        <View style={styles.pctRow}>
          <Text style={styles.pct}>{percent}</Text>
          <Text style={styles.pctSign}>%</Text>
          <View style={{ flex: 1 }} />
          {left !== null && (
            <View
              style={[
                styles.duePill,
                overdue && styles.duePillBad,
                !overdue && behind && styles.duePillWarn,
              ]}
            >
              <Ionicons
                name={overdue ? "alert-circle" : "time-outline"}
                size={12}
                color={overdue ? "#dc2626" : behind ? "#b45309" : c.textMuted}
              />
              <Text
                style={[
                  styles.dueText,
                  overdue && { color: "#dc2626" },
                  !overdue && behind && { color: "#b45309" },
                ]}
              >
                {left < 0
                  ? `${Math.abs(left)}d overdue`
                  : left === 0
                  ? "Due today"
                  : `${left}d left`}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.track}>
          <Animated.View
            style={[
              styles.fill,
              {
                backgroundColor: barColor,
                width: grow.interpolate({
                  inputRange: [0, 100],
                  outputRange: ["0%", "100%"],
                }),
              },
            ]}
          />
          {sched !== null && (
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

      {/* ---- the four numbers ---- */}
      <View style={styles.statRow}>
        {stats.map((s) => {
          const valueColor =
            s.tone === "danger"
              ? "#dc2626"
              : s.tone === "warn"
              ? "#b45309"
              : s.tone === "good"
              ? "#15803d"
              : c.text;
          return (
            <Pressable
              key={s.label}
              onPress={s.onPress}
              disabled={!s.onPress}
              style={({ hovered, pressed }: any) => [
                styles.stat,
                !!s.onPress && hovered && styles.statHover,
                !!s.onPress && pressed && styles.statPressed,
              ]}
              accessibilityRole={s.onPress ? "button" : undefined}
              accessibilityLabel={`${s.label}: ${s.value}`}
            >
              <Ionicons name={s.icon} size={15} color={c.textMuted} />
              <Text style={[styles.statValue, { color: valueColor }]}>
                {s.value}
              </Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const makeStyles = (c: any, narrow: boolean) =>
  StyleSheet.create({
    hero: {
      backgroundColor: c.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      padding: narrow ? 14 : 18,
      gap: 16,
      ...Platform.select({
        web: { boxShadow: "0 1px 3px rgba(16,16,24,0.06)" as any },
        default: {
          shadowColor: "#000",
          shadowOpacity: 0.05,
          shadowRadius: 5,
          shadowOffset: { width: 0, height: 2 },
        },
      }),
    },
    topRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.surfaceMuted,
      ...Platform.select({
        web: { transition: "background-color 0.15s ease" as any },
        default: {},
      }),
    },
    iconBtnHover: { backgroundColor: c.accentSoft },
    iconBtnPressed: { opacity: 0.6 },
    name: {
      fontSize: narrow ? 19 : 23,
      fontWeight: "800",
      color: c.text,
      letterSpacing: -0.3,
      lineHeight: narrow ? 24 : 28,
    },
    subRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 6,
      flexWrap: "wrap",
    },
    statusChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 999,
    },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.2 },
    sub: { fontSize: 12, color: c.textMuted, flexShrink: 1 },
    chatBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.accent,
      ...Platform.select({
        web: { transition: "transform 0.15s ease, opacity 0.15s ease" as any },
        default: {},
      }),
    },
    chatBtnHover: { ...Platform.select({ web: { transform: [{ scale: 1.06 }] }, default: {} }) },
    progressBlock: { gap: 7 },
    pctRow: { flexDirection: "row", alignItems: "baseline", gap: 1 },
    pct: {
      fontSize: narrow ? 32 : 38,
      fontWeight: "800",
      color: c.text,
      letterSpacing: -1,
    },
    pctSign: { fontSize: 16, fontWeight: "700", color: c.textMuted },
    duePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: c.surfaceMuted,
      alignSelf: "center",
    },
    duePillWarn: { backgroundColor: "rgba(245,158,11,0.14)" },
    duePillBad: { backgroundColor: "rgba(220,38,38,0.12)" },
    dueText: { fontSize: 11.5, fontWeight: "700", color: c.textMuted },
    track: {
      height: 9,
      borderRadius: 999,
      backgroundColor: c.surfaceMuted,
      justifyContent: "center",
      overflow: "visible",
    },
    fill: { height: 9, borderRadius: 999 },
    marker: {
      position: "absolute",
      width: 2,
      height: 15,
      borderRadius: 1,
      backgroundColor: c.textMuted,
      opacity: 0.7,
    },
    legend: { fontSize: 11, color: c.textFaint },
    statRow: {
      flexDirection: "row",
      gap: narrow ? 6 : 10,
      borderTopWidth: 1,
      borderTopColor: c.surfaceBorder,
      paddingTop: 14,
    },
    stat: {
      flex: 1,
      alignItems: "center",
      gap: 3,
      paddingVertical: 8,
      borderRadius: 11,
      ...Platform.select({
        web: { transition: "background-color 0.15s ease" as any },
        default: {},
      }),
    },
    statHover: { backgroundColor: c.surfaceMuted },
    statPressed: { opacity: 0.6 },
    statValue: { fontSize: narrow ? 16 : 18, fontWeight: "800" },
    statLabel: {
      fontSize: 10,
      fontWeight: "700",
      color: c.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      textAlign: "center",
    },
  });
