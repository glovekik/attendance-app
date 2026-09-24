import React, { useMemo, useState } from "react";

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { WebModal } from "./WebModal";
import { useTheme } from "../theme/ThemeProvider";

/**
 * A field with a fixed set of answers.
 *
 * The app had date pickers but no dropdown at all, so every controlled
 * field was a free-text input. Eighteen people produced seven spellings of
 * a blood group that way, including one ("B-positive") nobody can now read
 * with confidence off an ID card.
 *
 * Options come from the caller, which gets them from the server's
 * /meta/value-sets — so what's offered here is exactly what the API will
 * accept on save, rather than a second list that drifts from it.
 */
export interface SelectFieldProps {
  value?: string | null;
  onChange: (value: string) => void;
  options: string[];
  /** Shown in the picker's header and in the empty state. */
  label: string;
  placeholder?: string;
  /** Offer a "Clear" action — for fields that are genuinely optional. */
  clearable?: boolean;
  disabled?: boolean;
  /** Validation message; renders below and turns the control red. */
  error?: string | null;
}

export const SelectField = ({
  value,
  onChange,
  options,
  label,
  placeholder = "Select",
  clearable = true,
  disabled = false,
  error,
}: SelectFieldProps) => {
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);
  const [open, setOpen] = useState(false);

  const current = (value || "").trim();

  return (
    <>
      <TouchableOpacity
        style={[
          styles.control,
          !!error && styles.controlError,
          disabled && styles.controlDisabled,
        ]}
        onPress={() => !disabled && setOpen(true)}
        activeOpacity={0.8}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: current || placeholder }}
        accessibilityState={{ disabled, expanded: open }}
      >
        <Text style={[styles.value, !current && styles.placeholder]}>
          {current || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={c.textMuted} />
      </TouchableOpacity>

      {!!error && <Text style={styles.error}>{error}</Text>}

      <WebModal
        visible={open}
        onClose={() => setOpen(false)}
        title={label}
        size="sm"
      >
        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {options.map((opt) => {
            const selected = opt === current;
            return (
              <TouchableOpacity
                key={opt}
                style={[styles.option, selected && styles.optionSelected]}
                onPress={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text
                  style={[
                    styles.optionText,
                    selected && styles.optionTextSelected,
                  ]}
                >
                  {opt}
                </Text>
                {selected && (
                  <Ionicons name="checkmark" size={17} color={c.accent} />
                )}
              </TouchableOpacity>
            );
          })}

          {clearable && !!current && (
            <TouchableOpacity
              style={styles.clear}
              onPress={() => {
                onChange("");
                setOpen(false);
              }}
              accessibilityRole="button"
            >
              <Ionicons name="close-circle-outline" size={16} color={c.textMuted} />
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </WebModal>
    </>
  );
};

const makeStyles = (c: any) =>
  StyleSheet.create({
    control: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      borderRadius: 10,
      paddingHorizontal: 12,
      // Matches the text inputs it sits beside, and clears the 44px
      // minimum touch target.
      paddingVertical: 12,
      backgroundColor: c.surface,
    },
    controlError: { borderColor: "#dc2626" },
    controlDisabled: { opacity: 0.5 },
    value: { flex: 1, fontSize: 15, color: c.text, fontWeight: "600" },
    placeholder: { color: c.textFaint, fontWeight: "400" },
    error: { marginTop: 5, fontSize: 12, color: "#dc2626" },
    list: { maxHeight: 340 },
    option: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 13,
      paddingHorizontal: 12,
      borderRadius: 9,
    },
    optionSelected: { backgroundColor: c.accentSoft },
    optionText: { fontSize: 15, color: c.text },
    optionTextSelected: { color: c.accentText, fontWeight: "700" },
    clear: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      paddingVertical: 13,
      paddingHorizontal: 12,
      marginTop: 4,
      borderTopWidth: 1,
      borderTopColor: c.surfaceBorder,
    },
    clearText: { fontSize: 14, color: c.textMuted, fontWeight: "600" },
  });
