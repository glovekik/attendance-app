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

import { WebDateField } from "./WebDateField";
import { useTheme } from "../theme/ThemeProvider";

/**
 * Reusable date+time picker that reads/writes an ISO-8601 string
 * (e.g. `new Date().toISOString()`). Used for to-do reminders.
 *
 * - Web   → native <input type="datetime-local"> via WebDateField.
 * - iOS   → single `datetime` picker (live update).
 * - Android → two-step: pick the date, then the time.
 *
 * Pass "" to mean "no value". A clear (✕) button appears when set.
 */
const isWeb = Platform.OS === "web";

export interface DateTimePickerFieldProps {
  value: string; // ISO string, or "" when unset
  onChange: (iso: string) => void;
  placeholder?: string;
  // Earliest selectable instant (e.g. now, so reminders can't be in the past).
  minimumDate?: Date;
}

const pad = (n: number) => String(n).padStart(2, "0");

// ISO → "YYYY-MM-DDTHH:mm" in LOCAL time for <input type="datetime-local">.
const isoToLocalInput = (iso: string): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
};

const fmtDisplay = (iso: string): string => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export const DateTimePickerField = ({
  value,
  onChange,
  placeholder = "No reminder set",
  minimumDate,
}: DateTimePickerFieldProps) => {
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);

  const [showIOS, setShowIOS] = useState(false);
  const [androidStep, setAndroidStep] = useState<"none" | "date" | "time">(
    "none"
  );
  const [draft, setDraft] = useState<Date | null>(null);

  const clearBtn = !!value && (
    <TouchableOpacity
      onPress={() => onChange("")}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name="close-circle" size={18} color={c.textMuted} />
    </TouchableOpacity>
  );

  if (isWeb) {
    return (
      <View style={styles.row}>
        <Ionicons name="alarm-outline" size={18} color={c.textMuted} />
        <View style={{ flex: 1 }}>
          <WebDateField
            mode="datetime-local"
            value={isoToLocalInput(value)}
            onChange={(v) => {
              if (!v) {
                onChange("");
                return;
              }
              const d = new Date(v); // interpreted as local time
              if (!isNaN(d.getTime())) onChange(d.toISOString());
            }}
          />
        </View>
        {clearBtn}
      </View>
    );
  }

  const open = () => {
    const base = value ? new Date(value) : minimumDate || new Date();
    setDraft(isNaN(base.getTime()) ? new Date() : base);
    if (Platform.OS === "ios") {
      setShowIOS((v) => !v);
    } else {
      setAndroidStep("date");
    }
  };

  return (
    <>
      <TouchableOpacity style={styles.row} onPress={open} activeOpacity={0.7}>
        <Ionicons name="alarm-outline" size={18} color={c.textMuted} />
        <Text style={[styles.text, !value && { color: c.textMuted }]}>
          {value ? fmtDisplay(value) : placeholder}
        </Text>
        {clearBtn}
      </TouchableOpacity>

      {showIOS && Platform.OS === "ios" && (
        <DateTimePicker
          value={draft || new Date()}
          mode="datetime"
          minimumDate={minimumDate}
          onChange={(e, d) => {
            if (e.type === "dismissed") {
              setShowIOS(false);
              return;
            }
            if (d) {
              setDraft(d);
              onChange(d.toISOString());
            }
          }}
        />
      )}

      {androidStep === "date" && (
        <DateTimePicker
          value={draft || new Date()}
          mode="date"
          minimumDate={minimumDate}
          onChange={(e, d) => {
            if (e.type !== "set" || !d) {
              setAndroidStep("none");
              return;
            }
            const next = new Date(draft || new Date());
            next.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
            setDraft(next);
            setAndroidStep("time");
          }}
        />
      )}

      {androidStep === "time" && (
        <DateTimePicker
          value={draft || new Date()}
          mode="time"
          onChange={(e, d) => {
            setAndroidStep("none");
            if (e.type !== "set" || !d) return;
            const next = new Date(draft || new Date());
            next.setHours(d.getHours(), d.getMinutes(), 0, 0);
            onChange(next.toISOString());
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
      backgroundColor: c.surfaceMuted,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      minHeight: 42,
      gap: 10,
    },
    text: {
      color: c.text,
      fontSize: 14,
      fontWeight: "600",
      flex: 1,
    },
  });
