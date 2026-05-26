/**
 * Maps a saturated brand color to a soft pastel wash for icon-container
 * backgrounds, and gives back the foreground color the icon should use
 * on that wash (usually the original brand color).
 *
 * Lets us keep the existing per-tile `color` props in legacy hub screens
 * without rewriting each call site — `iconBg(color)` returns the pastel
 * to use instead of the saturated color, and the icon itself keeps the
 * original color.
 */

const map: Record<string, { bg: string; fg: string }> = {
  // sky / cyan
  "#0ea5e9": { bg: "#d6ecff", fg: "#0369a1" },
  "#06b6d4": { bg: "#cdf3fb", fg: "#0e7490" },
  // blue
  "#2563eb": { bg: "#dde7ff", fg: "#1d4ed8" },
  "#3b82f6": { bg: "#dde7ff", fg: "#1d4ed8" },
  "#1d4ed8": { bg: "#dde7ff", fg: "#1d4ed8" },
  "#6366f1": { bg: "#e1e1ff", fg: "#4338ca" },
  "#1d1838": { bg: "#e6e0f7", fg: "#1d1838" },
  // violet / purple
  "#7c3aed": { bg: "#e9deff", fg: "#6d28d9" },
  "#8b5cf6": { bg: "#e9deff", fg: "#6d28d9" },
  "#a855f7": { bg: "#f0e1ff", fg: "#7e22ce" },
  // pink / fuchsia
  "#db2777": { bg: "#fde0ea", fg: "#be185d" },
  "#ec4899": { bg: "#fde0ea", fg: "#be185d" },
  "#c026d3": { bg: "#fbe1f9", fg: "#a21caf" },
  // green / teal
  "#16a34a": { bg: "#d4f5e1", fg: "#15803d" },
  "#0d9488": { bg: "#cef3ee", fg: "#0f766e" },
  "#22c55e": { bg: "#d4f5e1", fg: "#15803d" },
  "#15803d": { bg: "#d4f5e1", fg: "#15803d" },
  // orange / amber / yellow
  "#f59e0b": { bg: "#ffe9c8", fg: "#9a5b00" },
  "#f97316": { bg: "#ffe2d3", fg: "#c2410c" },
  "#ea580c": { bg: "#ffe2d3", fg: "#c2410c" },
  "#eab308": { bg: "#fff2c2", fg: "#a16207" },
  // red
  "#dc2626": { bg: "#fde0e0", fg: "#b42a2a" },
  "#ef4444": { bg: "#fde0e0", fg: "#b42a2a" },
  // neutrals
  "#475569": { bg: "#e6e0f7", fg: "#374151" },
  "#64748b": { bg: "#e6e0f7", fg: "#374151" },
};

const DEFAULT_PASTEL = { bg: "#e9deff", fg: "#6d28d9" };

/**
 * Returns the pastel background a tile icon container should use given
 * the brand color it was originally styled with.
 */
export const iconBg = (color?: string): string => {
  if (!color) return DEFAULT_PASTEL.bg;
  return (map[color.toLowerCase()] || DEFAULT_PASTEL).bg;
};

/**
 * Returns the color the icon glyph should render in. Keeps the original
 * brand color where it has enough contrast on the matching pastel; falls
 * back to the default deep violet for unknown colors.
 */
export const iconFg = (color?: string): string => {
  if (!color) return DEFAULT_PASTEL.fg;
  return (map[color.toLowerCase()] || DEFAULT_PASTEL).fg;
};
