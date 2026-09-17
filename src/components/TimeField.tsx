import React, { useMemo, useState } from "react";

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";

import { WebDateField, dateToHM, hmToDate } from "./WebDateField";
import { useTheme } from "../theme/ThemeProvider";

/**
 * A time-of-day field that reads and writes "HH:MM" (24h).
 *
 * Web gets the browser's own <input type="time">; native opens the platform
 * clock picker. Typing a time by hand is the thing this replaces — "6:30 PM",
 * "630" and "18.30" are all natural to type and none of them parse, so a
 * free-text field turns a correct answer into a failed submit.
 *
 * Time-of-day only, deliberately: the callers correcting an attendance row
 * already know which date they're fixing, and offering a date alongside it
 * only invites picking the wrong one.
 */
const isWeb = Platform.OS === "web";

export interface TimeFieldProps {
  /** "HH:MM", or "" when unset. */
  value: string;
  onChange: (hm: string) => void;
  /** Shown on native before a time is chosen. */
  placeholder?: string;
  /** Icon on the native row; ignored on web. */
  icon?: keyof typeof Ionicons.glyphMap;
}

const fmt12h = (hm: string): string => {
  const d = hmToDate(hm);
  if (!d) return hm;
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

export const TimeField = ({
  value,
  onChange,
  placeholder = "Tap to set",
  icon = "time-outline",
}: TimeFieldProps) => {
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);
  const [showPicker, setShowPicker] = useState(false);

  if (isWeb) {
    return (
      <WebDateField
        mode="time"
        value={value}
        onChange={(v) => onChange(v || "")}
      />
    );
  }

  return (
    <>
      <TouchableOpacity
        style={styles.row}
        onPress={() => setShowPicker(true)}
        activeOpacity={0.8}
      >
        <Ionicons name={icon} size={18} color={c.textMuted} />
        <Text style={[styles.value, !value && styles.placeholder]}>
          {value ? fmt12h(value) : placeholder}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={c.textMuted} />
      </TouchableOpacity>
      {showPicker && (
        <DateTimePicker
          // Seeding with the current time beats midnight: someone correcting
          // a forgotten check-out is usually reaching for an hour near now.
          value={hmToDate(value) || new Date()}
          mode="time"
          onChange={(event, d) => {
            // Android fires once and dismisses itself; iOS stays open as a
            // spinner until the sheet is closed. Dismissing on Android here
            // is what stops the picker reopening on every render.
            setShowPicker(Platform.OS === "ios");
            if (event.type === "dismissed") return;
            if (d) onChange(dateToHM(d));
          }}
        />
      )}
    </>
  );
};

const makeStyles = (c: any) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 12,
      backgroundColor: c.surface,
    },
    value: {
      flex: 1,
      color: c.text,
      fontSize: 15,
      fontWeight: "600",
    },
    placeholder: {
      color: c.textFaint,
      fontWeight: "400",
    },
  });
