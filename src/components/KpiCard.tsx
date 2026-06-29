import React, { useMemo } from "react";

import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../theme/ThemeProvider";
/**
 * Compact KPI card. Renders:
 *   - big number (or formatted string)
 *   - short label
 *   - optional sub-label
 *   - color band derived from value vs thresholds
 *
 * Thresholds:
 *   higherIsBetter (default true):
 *     value >= greenAt  → green
 *     value >= amberAt  → amber
 *     value <  amberAt  → red
 *   higherIsBetter=false (e.g. pending approvals — lower is better):
 *     value <= greenAt  → green
 *     value <= amberAt  → amber
 *     value >  amberAt  → red
 *
 * Pass color="none" to skip the threshold band entirely (informational).
 */
export interface KpiCardProps {
  label: string;
  value: number | string;
  unit?: string;            // e.g. "%", "h", "days"
  subLabel?: string;        // small line beneath
  icon?: keyof typeof Ionicons.glyphMap;
  // Threshold config — omit to render neutral.
  greenAt?: number;
  amberAt?: number;
  higherIsBetter?: boolean;
  // Bypass thresholds entirely.
  tone?: "none" | "auto" | "green" | "amber" | "red";
  // Manual override of computed numeric value used for threshold comparison.
  // Useful when `value` is a string like "12 / 18".
  numericForThreshold?: number;
  // When provided, the card becomes tappable (drill into a detail screen)
  // and shows a chevron affordance.
  onPress?: () => void;
}

const TONES = {
  green: {
    bg: "rgba(22,163,74,0.12)",
    border: "rgba(22,163,74,0.45)",
    accent: "#16a34a",
  },
  amber: {
    bg: "rgba(245,158,11,0.12)",
    border: "rgba(245,158,11,0.45)",
    accent: "#f59e0b",
  },
  red: {
    bg: "rgba(220,38,38,0.12)",
    border: "rgba(220,38,38,0.45)",
    accent: "#dc2626",
  },
  none: {
    bg: "#111827",
    border: "#1f2937",
    accent: "#0ea5e9",
  },
};

const resolveTone = (
  props: KpiCardProps
): "green" | "amber" | "red" | "none" => {
  if (props.tone && props.tone !== "auto") return props.tone;
  if (props.greenAt === undefined || props.amberAt === undefined) {
    return "none";
  }
  const n =
    props.numericForThreshold ??
    (typeof props.value === "number" ? props.value : NaN);
  if (!Number.isFinite(n)) return "none";
  const higher = props.higherIsBetter !== false; // default true
  if (higher) {
    if (n >= props.greenAt) return "green";
    if (n >= props.amberAt) return "amber";
    return "red";
  }
  if (n <= props.greenAt) return "green";
  if (n <= props.amberAt) return "amber";
  return "red";
};

export const KpiCard = (props: KpiCardProps) => {
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);
  const tone = resolveTone(props);
  const colors = TONES[tone];
  const displayValue =
    typeof props.value === "number"
      ? Number.isFinite(props.value)
        ? formatNumber(props.value)
        : "—"
      : props.value;
  const body = (
    <>
      <View style={styles.headerRow}>
        {props.icon && (
          <Ionicons name={props.icon} size={14} color={colors.accent} />
        )}
        <Text style={styles.label} numberOfLines={1}>
          {props.label}
        </Text>
        {!!props.onPress && (
          <Ionicons name="chevron-forward" size={14} color={colors.accent} />
        )}
      </View>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: colors.accent }]}>
          {displayValue}
        </Text>
        {!!props.unit && (
          <Text style={[styles.unit, { color: colors.accent }]}>
            {props.unit}
          </Text>
        )}
      </View>
      {!!props.subLabel && (
        <Text style={styles.sub}>{props.subLabel}</Text>
      )}
    </>
  );

  if (props.onPress) {
    return (
      <Pressable
        onPress={props.onPress}
        style={({ hovered, pressed }: any) => [
          styles.card,
          { backgroundColor: colors.bg, borderColor: colors.border },
          Platform.OS === "web" && hovered && { borderColor: colors.accent },
          pressed && { opacity: 0.85 },
        ]}
      >
        {body}
      </Pressable>
    );
  }

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.bg, borderColor: colors.border },
      ]}
    >
      {body}
    </View>
  );
};

// Round to a sensible number of decimals based on magnitude — keeps the
// card compact without losing meaning for small fractions.
const formatNumber = (n: number) => {
  if (n >= 100) return Math.round(n).toString();
  if (n >= 10) return n.toFixed(1).replace(/\.0$/, "");
  return n.toFixed(1).replace(/\.0$/, "");
};

const makeStyles = (c: any) => StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 140,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  label: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.7,
    textTransform: "uppercase",
    flex: 1,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
    marginTop: 4,
  },
  value: { fontSize: 22, fontWeight: "800" },
  unit: { fontSize: 12, fontWeight: "700", opacity: 0.85 },
  sub: { color: "#94a3b8", fontSize: 10, marginTop: 3 },
});
