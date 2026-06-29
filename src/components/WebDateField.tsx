/**
 * WebDateField - Enhanced date/time input for web.
 *
 * LEARNING POINT: Web-specific form inputs
 * React Native Web can render native HTML elements using React.createElement.
 * This provides native date/time pickers on web browsers.
 *
 * Features:
 * - Native browser date/time picker
 * - Theme-aware styling (light/dark mode)
 * - Configurable variants (inline, bordered, filled)
 */

import React from "react";

import { useTheme } from "../theme/ThemeProvider";

type Mode = "date" | "time" | "datetime-local";

interface Props {
  mode: Mode;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  /** Visual variant */
  variant?: "inline" | "bordered" | "filled";
  /** Disable the input */
  disabled?: boolean;
  /** Placeholder text */
  placeholder?: string;
}

export const WebDateField = ({
  mode,
  value,
  onChange,
  min,
  max,
  variant = "inline",
  disabled = false,
  placeholder,
}: Props) => {
  const { theme } = useTheme();
  const c = theme.colors;

  // Base styles for all variants
  const baseStyle: React.CSSProperties = {
    color: disabled ? c.textMuted : c.text,
    fontSize: "15px",
    fontWeight: 600,
    outline: "none",
    colorScheme: theme.mode === "dark" ? "dark" : "light",
    fontFamily: "inherit",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
  };

  // Variant-specific styles
  const variantStyles: Record<string, React.CSSProperties> = {
    inline: {
      background: "transparent",
      border: "none",
      padding: 0,
      marginTop: "2px",
      width: "100%",
    },
    bordered: {
      background: "transparent",
      border: `1px solid ${c.surfaceBorder}`,
      borderRadius: "10px",
      padding: "12px 14px",
      width: "100%",
      transition: "border-color 0.15s ease",
    },
    filled: {
      background: c.surfaceMuted,
      border: `1px solid transparent`,
      borderRadius: "10px",
      padding: "12px 14px",
      width: "100%",
      transition: "border-color 0.15s ease",
    },
  };

  return React.createElement("input", {
    type: mode,
    value,
    min,
    max,
    disabled,
    placeholder,
    onChange: (e: any) => onChange(e.target.value),
    onFocus: (e: any) => {
      if (variant !== "inline") {
        e.target.style.borderColor = c.accent;
      }
    },
    onBlur: (e: any) => {
      if (variant !== "inline") {
        e.target.style.borderColor =
          variant === "bordered" ? c.surfaceBorder : "transparent";
      }
    },
    style: {
      ...baseStyle,
      ...variantStyles[variant],
    },
  });
};

/**
 * WebDateRangePicker - Date range selection for web.
 */
interface DateRangeProps {
  startDate: string;
  endDate: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  minDate?: string;
  maxDate?: string;
}

export const WebDateRangePicker = ({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  minDate,
  maxDate,
}: DateRangeProps) => {
  const { theme } = useTheme();
  const c = theme.colors;

  return React.createElement(
    "div",
    {
      style: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
      },
    },
    [
      React.createElement(WebDateField, {
        key: "start",
        mode: "date",
        value: startDate,
        onChange: onStartChange,
        min: minDate,
        max: endDate || maxDate,
        variant: "bordered",
      }),
      React.createElement(
        "span",
        {
          key: "separator",
          style: { color: c.textMuted, fontSize: "14px" },
        },
        "to"
      ),
      React.createElement(WebDateField, {
        key: "end",
        mode: "date",
        value: endDate,
        onChange: onEndChange,
        min: startDate || minDate,
        max: maxDate,
        variant: "bordered",
      }),
    ]
  );
};

export const dateToYMD = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export const dateToHM = (d: Date) => {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
};

export const ymdToDate = (s: string) => {
  if (!s) return null;
  return new Date(`${s}T00:00:00`);
};

export const hmToDate = (s: string, base?: Date) => {
  if (!s) return null;

  const [h, m] = s.split(":").map(Number);

  const d = base ? new Date(base) : new Date();

  d.setHours(h || 0, m || 0, 0, 0);

  return d;
};
