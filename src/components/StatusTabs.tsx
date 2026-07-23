import React, { useMemo } from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from "react-native";

import { useTheme } from "../theme/ThemeProvider";

/**
 * The Pending / Approved / Rejected filter every approval queue needs.
 *
 * One component rather than a copy per screen: the queues were drifting —
 * some had tabs, some showed only pending with no way to see history, and
 * the ones that had them looked different from each other. An approver
 * should not have to relearn the control on each screen.
 *
 * Responsive by construction: the row scrolls horizontally when it doesn't
 * fit (phones, or five-plus tabs) and simply sits inline when it does, so
 * there's no separate mobile layout to keep in sync.
 */

export interface StatusTab<T extends string = string> {
  key: T;
  label: string;
  /** Shown as a badge. Omit (or undefined) to show no badge; 0 renders as 0. */
  count?: number;
  /** Overrides the accent for the selected pill — e.g. red for Rejected. */
  tone?: string;
}

export function StatusTabs<T extends string = string>({
  tabs,
  value,
  onChange,
  style,
}: {
  tabs: StatusTab<T>[];
  value: T;
  onChange: (key: T) => void;
  style?: any;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.wrap, style]}
      contentContainerStyle={styles.row}
      // Without this the row stretches and the pills lose their shape on
      // wide screens.
      alwaysBounceHorizontal={false}
    >
      {tabs.map((t) => {
        const on = t.key === value;
        const tone = t.tone || c.accent;
        return (
          <TouchableOpacity
            key={t.key}
            onPress={() => onChange(t.key)}
            activeOpacity={0.85}
            style={[
              styles.tab,
              on && { backgroundColor: tone, borderColor: tone },
            ]}
          >
            <Text style={[styles.label, on && styles.labelOn]}>{t.label}</Text>
            {t.count !== undefined && (
              <View style={[styles.badge, on && styles.badgeOn]}>
                <Text style={[styles.badgeText, on && styles.badgeTextOn]}>
                  {t.count > 99 ? "99+" : t.count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

/** The standard four. Counts are optional — pass what you have. */
export const approvalTabs = (
  counts: Partial<Record<"ALL" | "PENDING" | "APPROVED" | "REJECTED", number>>,
  c: any
): StatusTab<"ALL" | "PENDING" | "APPROVED" | "REJECTED">[] => [
  { key: "PENDING", label: "Pending", count: counts.PENDING, tone: "#b45309" },
  {
    key: "APPROVED",
    label: "Approved",
    count: counts.APPROVED,
    tone: c.successText || "#16a34a",
  },
  {
    key: "REJECTED",
    label: "Rejected",
    count: counts.REJECTED,
    tone: c.dangerText || "#dc2626",
  },
  { key: "ALL", label: "All", count: counts.ALL },
];

const makeStyles = (c: any) =>
  StyleSheet.create({
    wrap: { flexGrow: 0, marginBottom: 12 },
    row: { gap: 8, paddingRight: 4 },
    tab: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 999,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      ...(Platform.OS === "web" ? { cursor: "pointer" as any } : {}),
    },
    label: { color: c.textMuted, fontSize: 12.5, fontWeight: "800" },
    labelOn: { color: "#fff" },
    badge: {
      minWidth: 20,
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 999,
      backgroundColor: c.surfaceMuted,
      alignItems: "center",
    },
    badgeOn: { backgroundColor: "rgba(255,255,255,0.28)" },
    badgeText: { color: c.textMuted, fontSize: 10.5, fontWeight: "800" },
    badgeTextOn: { color: "#fff" },
  });
