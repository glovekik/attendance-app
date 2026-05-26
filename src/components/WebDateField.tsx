import React from "react";

import { useTheme } from "../theme/ThemeProvider";

type Mode = "date" | "time";

interface Props {
  mode: Mode;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
}

export const WebDateField = ({
  mode,
  value,
  onChange,
  min,
  max,
}: Props) => {

  const { theme } = useTheme();

  return React.createElement("input", {

    type: mode,

    value,

    min,

    max,

    onChange: (e: any) => onChange(e.target.value),

    style: {
      background: "transparent",
      border: "none",
      color: theme.colors.text,
      fontSize: "15px",
      fontWeight: 700,
      outline: "none",
      colorScheme: theme.mode === "dark" ? "dark" : "light",
      marginTop: "2px",
      fontFamily: "inherit",
      padding: 0,
      width: "100%",
      cursor: "pointer",
    },
  });
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
