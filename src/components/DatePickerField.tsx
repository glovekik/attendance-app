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

import {
  WebDateField,
  dateToYMD,
  ymdToDate,
} from "./WebDateField";
import { useTheme } from "../theme/ThemeProvider";

/**
 * Reusable date picker that picks a YYYY-MM-DD string. Web uses the
 * native HTML date input via `WebDateField`; native uses a tappable
 * row that opens `DateTimePicker`.
 *
 * Pattern duplicated across hr-user-profile / users.tsx etc. — this
 * extracts it so every date field looks and behaves the same.
 */
const isWeb = Platform.OS === "web";

export interface DatePickerFieldProps {
  value: string;
  onChange: (v: string) => void;
  // Optional min/max as YYYY-MM-DD.
  min?: string;
  max?: string;
  placeholder?: string;
  // Default date used when value is empty and user opens the picker.
  // Helpful for "Birthday" (default to 25y ago) vs "Joining Date" (today).
  fallbackDate?: Date;
}

export const DatePickerField = ({
  value,
  onChange,
  min,
  max,
  placeholder = "Pick a date",
  fallbackDate,
}: DatePickerFieldProps) => {
  const [showPicker, setShowPicker] = useState(false);
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);

  if (isWeb) {
    return (
      <View style={styles.row}>
        <Ionicons name="calendar-outline" size={18} color={c.textMuted} />
        <WebDateField
          mode="date"
          value={value}
          min={min}
          max={max}
          onChange={(v) => v && onChange(v)}
        />
      </View>
    );
  }

  const display = value
    ? new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : placeholder;

  return (
    <>
      <TouchableOpacity
        style={styles.row}
        onPress={() => setShowPicker(true)}
        activeOpacity={0.7}
      >
        <Ionicons name="calendar-outline" size={18} color={c.textMuted} />
        <Text
          style={[styles.text, !value && { color: c.textMuted }]}
        >
          {display}
        </Text>
      </TouchableOpacity>
      {showPicker && (
        <DateTimePicker
          value={ymdToDate(value) || fallbackDate || new Date()}
          mode="date"
          maximumDate={max ? ymdToDate(max) || undefined : undefined}
          minimumDate={min ? ymdToDate(min) || undefined : undefined}
          onChange={(_, d) => {
            setShowPicker(Platform.OS === "ios");
            if (d) onChange(dateToYMD(d));
          }}
        />
      )}
    </>
  );
};

const makeStyles = (c: any) => StyleSheet.create({
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
