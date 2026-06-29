/**
 * WebFormFields - Professional form components inspired by Keka.
 *
 * Clean, professional form inputs with:
 * - Subtle focus states (no harsh outlines)
 * - Smooth transitions
 * - Consistent sizing and spacing
 * - Clear visual hierarchy
 *
 * Components:
 * - WebInput: Clean text input
 * - WebTextArea: Multi-line text input
 * - WebSelect: Native dropdown select
 * - ChipPicker: Segmented control
 * - FormField: Label and error wrapper
 */

import React, { useState, useRef, ReactNode } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Platform,
  TextInputProps,
  DimensionValue,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../theme/ThemeProvider";
import { useResponsive } from "../utils/responsive";

// ============================================================================
// WebInput - Enhanced text input with focus/hover states
// ============================================================================

interface WebInputProps extends Omit<TextInputProps, "style"> {
  /** Left icon */
  leftIcon?: keyof typeof Ionicons.glyphMap;
  /** Right icon */
  rightIcon?: keyof typeof Ionicons.glyphMap;
  /** Called when right icon is pressed */
  onRightIconPress?: () => void;
  /** Error state */
  error?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Input variant */
  variant?: "outlined" | "filled";
}

export const WebInput = ({
  leftIcon,
  rightIcon,
  onRightIconPress,
  error = false,
  disabled = false,
  variant = "outlined",
  ...props
}: WebInputProps) => {
  const { theme } = useTheme();
  const c = theme.colors;
  const [focused, setFocused] = useState(false);

  const getBorderColor = () => {
    if (error) return c.dangerText;
    if (focused) return c.accent;
    return c.surfaceBorder;
  };

  const getBackgroundColor = () => {
    if (variant === "filled") {
      return focused ? c.surface : c.surfaceMuted;
    }
    return c.surface;
  };

  return (
    <View
      style={[
        styles.inputContainer,
        {
          borderColor: getBorderColor(),
          backgroundColor: getBackgroundColor(),
          opacity: disabled ? 0.6 : 1,
        },
        focused && styles.inputFocused,
      ]}
    >
      {leftIcon && (
        <Ionicons
          name={leftIcon}
          size={18}
          color={focused ? c.accent : c.textMuted}
          style={styles.inputIcon}
        />
      )}

      <TextInput
        {...props}
        editable={!disabled}
        style={[
          styles.input,
          { color: c.text },
          leftIcon && { paddingLeft: 0 },
          rightIcon && { paddingRight: 0 },
        ]}
        placeholderTextColor={c.textMuted}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
      />

      {rightIcon && (
        <Pressable
          onPress={onRightIconPress}
          disabled={!onRightIconPress}
          style={({ hovered }: any) => [
            styles.inputIconButton,
            hovered && { opacity: 0.7 },
          ]}
        >
          <Ionicons name={rightIcon} size={18} color={c.textMuted} />
        </Pressable>
      )}
    </View>
  );
};

// ============================================================================
// WebTextArea - Multi-line text input
// ============================================================================

interface WebTextAreaProps extends Omit<TextInputProps, "style" | "multiline"> {
  /** Number of visible rows (default: 4) */
  rows?: number;
  /** Error state */
  error?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Show character count */
  showCount?: boolean;
  /** Maximum characters */
  maxLength?: number;
}

export const WebTextArea = ({
  rows = 4,
  error = false,
  disabled = false,
  showCount = false,
  maxLength,
  value,
  ...props
}: WebTextAreaProps) => {
  const { theme } = useTheme();
  const c = theme.colors;
  const [focused, setFocused] = useState(false);

  const charCount = typeof value === "string" ? value.length : 0;

  return (
    <View>
      <View
        style={[
          styles.textAreaContainer,
          {
            borderColor: error ? c.dangerText : focused ? c.accent : c.surfaceBorder,
            backgroundColor: c.surface,
            opacity: disabled ? 0.6 : 1,
          },
          focused && styles.inputFocused,
        ]}
      >
        <TextInput
          {...props}
          value={value}
          multiline
          numberOfLines={rows}
          maxLength={maxLength}
          editable={!disabled}
          style={[
            styles.textArea,
            { color: c.text, minHeight: rows * 24 },
          ]}
          placeholderTextColor={c.textMuted}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
        />
      </View>

      {showCount && (
        <Text style={[styles.charCount, { color: c.textMuted }]}>
          {charCount}{maxLength ? `/${maxLength}` : ""}
        </Text>
      )}
    </View>
  );
};

// ============================================================================
// WebSelect - Native dropdown select for web
// ============================================================================

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface WebSelectProps {
  /** Selected value */
  value: string;
  /** Called when selection changes */
  onChange: (value: string) => void;
  /** Options list */
  options: SelectOption[];
  /** Placeholder text */
  placeholder?: string;
  /** Error state */
  error?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Left icon */
  icon?: keyof typeof Ionicons.glyphMap;
}

export const WebSelect = ({
  value,
  onChange,
  options,
  placeholder = "Select...",
  error = false,
  disabled = false,
  icon,
}: WebSelectProps) => {
  const { theme } = useTheme();
  const c = theme.colors;
  const { isDesktop } = useResponsive();

  // On web desktop, use native HTML select
  if (Platform.OS === "web" && isDesktop) {
    return (
      <View
        style={[
          styles.selectContainer,
          {
            borderColor: error ? c.dangerText : c.surfaceBorder,
            backgroundColor: c.surface,
            opacity: disabled ? 0.6 : 1,
          },
        ]}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={18}
            color={c.textMuted}
            style={styles.inputIcon}
          />
        )}

        {React.createElement("select", {
          value,
          disabled,
          onChange: (e: any) => onChange(e.target.value),
          style: {
            flex: 1,
            fontSize: 14,
            fontWeight: 500,
            color: value ? c.text : c.textMuted,
            backgroundColor: "transparent",
            border: "none",
            outline: "none",
            cursor: disabled ? "not-allowed" : "pointer",
            padding: "0 8px",
            appearance: "none",
            fontFamily: "inherit",
          },
        }, [
          !value && React.createElement("option", {
            key: "__placeholder",
            value: "",
            disabled: true,
          }, placeholder),
          ...options.map((opt) =>
            React.createElement("option", {
              key: opt.value,
              value: opt.value,
              disabled: opt.disabled,
            }, opt.label)
          ),
        ])}

        <Ionicons
          name="chevron-down"
          size={16}
          color={c.textMuted}
        />
      </View>
    );
  }

  // Mobile: Use pressable that opens a picker/modal
  const selectedLabel = options.find((o) => o.value === value)?.label;

  return (
    <Pressable
      disabled={disabled}
      style={({ pressed }: any) => [
        styles.selectContainer,
        {
          borderColor: error ? c.dangerText : c.surfaceBorder,
          backgroundColor: c.surface,
          opacity: disabled ? 0.6 : pressed ? 0.8 : 1,
        },
      ]}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={18}
          color={c.textMuted}
          style={styles.inputIcon}
        />
      )}

      <Text
        style={[
          styles.selectText,
          { color: selectedLabel ? c.text : c.textMuted },
        ]}
        numberOfLines={1}
      >
        {selectedLabel || placeholder}
      </Text>

      <Ionicons name="chevron-down" size={16} color={c.textMuted} />
    </Pressable>
  );
};

// ============================================================================
// ChipPicker - Horizontal segmented control / chip selection
// ============================================================================

interface ChipOption {
  value: string;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
}

interface ChipPickerProps {
  /** Selected value(s) */
  value: string | string[];
  /** Called when selection changes */
  onChange: (value: string | string[]) => void;
  /** Options list */
  options: ChipOption[];
  /** Allow multiple selection */
  multiple?: boolean;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Full width chips */
  fullWidth?: boolean;
}

export const ChipPicker = ({
  value,
  onChange,
  options,
  multiple = false,
  size = "md",
  fullWidth = false,
}: ChipPickerProps) => {
  const { theme } = useTheme();
  const c = theme.colors;

  const isSelected = (optValue: string) => {
    if (multiple && Array.isArray(value)) {
      return value.includes(optValue);
    }
    return value === optValue;
  };

  const handlePress = (optValue: string) => {
    if (multiple && Array.isArray(value)) {
      if (value.includes(optValue)) {
        onChange(value.filter((v) => v !== optValue));
      } else {
        onChange([...value, optValue]);
      }
    } else {
      onChange(optValue);
    }
  };

  const sizeStyles = {
    sm: { paddingHorizontal: 10, paddingVertical: 6, fontSize: 12 },
    md: { paddingHorizontal: 14, paddingVertical: 8, fontSize: 13 },
    lg: { paddingHorizontal: 18, paddingVertical: 10, fontSize: 14 },
  };

  return (
    <View style={[styles.chipContainer, fullWidth && { width: "100%" }]}>
      {options.map((opt) => {
        const selected = isSelected(opt.value);
        return (
          <Pressable
            key={opt.value}
            onPress={() => handlePress(opt.value)}
            disabled={opt.disabled}
            style={({ hovered, pressed }: any) => [
              styles.chip,
              {
                paddingHorizontal: sizeStyles[size].paddingHorizontal,
                paddingVertical: sizeStyles[size].paddingVertical,
                backgroundColor: selected ? c.accent : c.surfaceMuted,
                borderColor: selected ? c.accent : c.surfaceBorder,
                opacity: opt.disabled ? 0.5 : 1,
              },
              fullWidth && { flex: 1 },
              Platform.OS === "web" && hovered && !selected && {
                borderColor: c.accent,
                backgroundColor: c.accentSoft,
              },
              pressed && { opacity: 0.8 },
            ]}
          >
            {opt.icon && (
              <Ionicons
                name={opt.icon}
                size={sizeStyles[size].fontSize}
                color={selected ? c.textInverse : c.text}
                style={{ marginRight: 6 }}
              />
            )}
            <Text
              style={[
                styles.chipText,
                {
                  fontSize: sizeStyles[size].fontSize,
                  color: selected ? c.textInverse : c.text,
                },
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

// ============================================================================
// FormField - Wrapper with label, error message, and helper text
// ============================================================================

interface FormFieldProps {
  /** Field label */
  label?: string;
  /** Required indicator */
  required?: boolean;
  /** Error message */
  error?: string;
  /** Helper text */
  helper?: string;
  /** Field content */
  children: ReactNode;
  /** Horizontal layout for desktop */
  horizontal?: boolean;
  /** Label width for horizontal layout */
  labelWidth?: DimensionValue;
}

export const FormField = ({
  label,
  required = false,
  error,
  helper,
  children,
  horizontal = false,
  labelWidth = 140,
}: FormFieldProps) => {
  const { theme } = useTheme();
  const c = theme.colors;
  const { isDesktop } = useResponsive();

  const useHorizontal = horizontal && isDesktop;

  return (
    <View style={[styles.field, useHorizontal && styles.fieldHorizontal]}>
      {label && (
        <View
          style={[
            styles.labelContainer,
            useHorizontal && { width: labelWidth, marginBottom: 0 },
          ]}
        >
          <Text style={[styles.label, { color: c.text }]}>
            {label}
            {required && (
              <Text style={{ color: c.dangerText }}> *</Text>
            )}
          </Text>
        </View>
      )}

      <View style={[useHorizontal && { flex: 1 }]}>
        {children}

        {(error || helper) && (
          <Text
            style={[
              styles.helperText,
              { color: error ? c.dangerText : c.textMuted },
            ]}
          >
            {error || helper}
          </Text>
        )}
      </View>
    </View>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  // Input styles - Clean Keka-like design
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    minHeight: 42,
    ...(Platform.OS === "web" && {
      transition: "border-color 0.2s ease" as any,
    }),
  },
  inputFocused: {
    // Subtle focus - no heavy box-shadow
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: "400",
    paddingVertical: 10,
    ...(Platform.OS === "web" && {
      outlineStyle: "none" as any,
    }),
  },
  inputIcon: {
    marginRight: 10,
  },
  inputIconButton: {
    padding: 4,
    marginLeft: 4,
    borderRadius: 4,
    ...(Platform.OS === "web" && {
      cursor: "pointer" as any,
      transition: "opacity 0.15s ease" as any,
    }),
  },

  // TextArea styles
  textAreaContainer: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    ...(Platform.OS === "web" && {
      transition: "border-color 0.2s ease" as any,
    }),
  },
  textArea: {
    fontSize: 14,
    fontWeight: "400",
    textAlignVertical: "top",
    lineHeight: 20,
    ...(Platform.OS === "web" && {
      outlineStyle: "none" as any,
      resize: "vertical" as any,
    }),
  },
  charCount: {
    fontSize: 11,
    textAlign: "right",
    marginTop: 6,
  },

  // Select styles
  selectContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    minHeight: 42,
    ...(Platform.OS === "web" && {
      cursor: "pointer" as any,
      transition: "border-color 0.2s ease" as any,
    }),
  },
  selectText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "400",
  },

  // Chip styles - Clean segmented control
  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    borderWidth: 1,
    ...(Platform.OS === "web" && {
      cursor: "pointer" as any,
      transition: "all 0.15s ease" as any,
    }),
  },
  chipText: {
    fontWeight: "500",
  },

  // FormField styles - Professional labels
  field: {
    marginBottom: 20,
  },
  fieldHorizontal: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  labelContainer: {
    marginBottom: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
  },
  helperText: {
    fontSize: 12,
    marginTop: 6,
    lineHeight: 16,
  },
});
