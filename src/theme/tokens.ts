/**
 * Design tokens — "Calm Professional".
 *
 * Single indigo accent (#6366f1), warm off-white background, hairline
 * borders, generous typography. Inspired by Linear / Stripe Dashboard
 * rather than aesthetic-heavy references. The goal is something HR /
 * managers / employees can use 8 hours a day without visual fatigue.
 *
 * Two palettes:
 *   • light  — primary look
 *   • dark   — true dark mode (deep slate, same indigo accent)
 *
 * Note: Web desktop uses enhanced Keka-style overrides via webThemeOverrides.
 */

export type ColorTokens = {
  // Surfaces — increasing elevation top to bottom.
  bg: string;             // overall app background
  bgElevated: string;     // hero / featured area
  surface: string;        // cards
  surfaceMuted: string;   // alt rows / filter bars / inputs
  surfaceBorder: string;  // hairline divider

  // Text
  text: string;
  textMuted: string;
  textFaint: string;
  textInverse: string;    // on-accent text

  // Single accent — used sparingly for primary actions / active states.
  accent: string;
  accentSoft: string;     // wash behind accent icons / chips
  accentText: string;     // text/icon on accentSoft wash

  // Status — desaturated so they don't shout.
  successBg: string;
  successText: string;
  warningBg: string;
  warningText: string;
  dangerBg: string;
  dangerText: string;
  infoBg: string;
  infoText: string;

  // Role accents — distinct enough to identify, calm enough to coexist.
  roleHrBg: string;
  roleHrText: string;
  roleManagerBg: string;
  roleManagerText: string;
  roleCeoBg: string;
  roleCeoText: string;

  // Category-tinted washes (used by tile icon containers). All neutral,
  // none neon. Provides variety without breaking the calm.
  pastelLavender: string;
  pastelPink: string;
  pastelPeach: string;
  pastelYellow: string;
  pastelMint: string;
  pastelSky: string;

  shadow: string;
  overlay: string;
};

export const lightColors: ColorTokens = {
  bg: "#fafafa",
  bgElevated: "#ffffff",
  surface: "#ffffff",
  surfaceMuted: "#f4f4f5",
  surfaceBorder: "#ececec",

  text: "#0f172a",
  textMuted: "#64748b",
  textFaint: "#94a3b8",
  textInverse: "#ffffff",

  accent: "#6366f1",
  accentSoft: "#eef0ff",
  accentText: "#4f46e5",

  successBg: "#ecfdf5",
  successText: "#047857",
  warningBg: "#fffbeb",
  warningText: "#b45309",
  dangerBg: "#fef2f2",
  dangerText: "#b91c1c",
  infoBg: "#eff6ff",
  infoText: "#1d4ed8",

  roleHrBg: "#fdf2f8",
  roleHrText: "#a21caf",
  roleManagerBg: "#eef0ff",
  roleManagerText: "#4338ca",
  roleCeoBg: "#fff7ed",
  roleCeoText: "#9a3412",

  pastelLavender: "#eef0ff",
  pastelPink: "#fdf2f8",
  pastelPeach: "#fff7ed",
  pastelYellow: "#fefce8",
  pastelMint: "#ecfdf5",
  pastelSky: "#eff6ff",

  shadow: "rgba(15, 23, 42, 0.06)",
  overlay: "rgba(15, 23, 42, 0.38)",
};

export const darkColors: ColorTokens = {
  bg: "#0b0d12",
  bgElevated: "#111319",
  surface: "#15171f",
  surfaceMuted: "#1c1f29",
  surfaceBorder: "#23262f",

  text: "#f1f5f9",
  textMuted: "#94a3b8",
  textFaint: "#64748b",
  textInverse: "#0b0d12",

  accent: "#818cf8",
  accentSoft: "#1e1f3a",
  accentText: "#a5b4fc",

  successBg: "rgba(16, 185, 129, 0.12)",
  successText: "#6ee7b7",
  warningBg: "rgba(245, 158, 11, 0.14)",
  warningText: "#fcd34d",
  dangerBg: "rgba(220, 38, 38, 0.14)",
  dangerText: "#fca5a5",
  infoBg: "rgba(59, 130, 246, 0.14)",
  infoText: "#93c5fd",

  roleHrBg: "rgba(168, 85, 247, 0.14)",
  roleHrText: "#e9d5ff",
  roleManagerBg: "rgba(129, 140, 248, 0.16)",
  roleManagerText: "#c7d2fe",
  roleCeoBg: "rgba(249, 115, 22, 0.14)",
  roleCeoText: "#fdba74",

  pastelLavender: "rgba(129, 140, 248, 0.14)",
  pastelPink: "rgba(244, 114, 182, 0.12)",
  pastelPeach: "rgba(251, 146, 60, 0.12)",
  pastelYellow: "rgba(250, 204, 21, 0.12)",
  pastelMint: "rgba(34, 197, 94, 0.12)",
  pastelSky: "rgba(56, 189, 248, 0.12)",

  shadow: "rgba(0, 0, 0, 0.35)",
  overlay: "rgba(0, 0, 0, 0.55)",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
};

export const typography = {
  h1: { fontSize: 28, fontWeight: "800" as const, letterSpacing: -0.4 },
  h2: { fontSize: 22, fontWeight: "800" as const, letterSpacing: -0.3 },
  h3: { fontSize: 18, fontWeight: "700" as const },
  bodyLg: { fontSize: 16, fontWeight: "600" as const },
  body: { fontSize: 14, fontWeight: "500" as const },
  bodySm: { fontSize: 13, fontWeight: "500" as const },
  caption: { fontSize: 11, fontWeight: "700" as const, letterSpacing: 1.2 },
};

// Web-only: Professional shadows for desktop
export const shadows = {
  sm: "0 1px 2px rgba(15, 23, 42, 0.06)",
  md: "0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -1px rgba(15, 23, 42, 0.04)",
  lg: "0 10px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -2px rgba(15, 23, 42, 0.04)",
  xl: "0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 10px 10px -5px rgba(15, 23, 42, 0.04)",
};

/**
 * Web Desktop Theme Overrides - Keka-inspired professional look.
 * These are applied only on web via Platform.OS checks in components.
 */
export const webThemeOverrides = {
  colors: {
    // Keka-inspired orange accent for web
    accent: "#f97316",
    accentSoft: "#fff7ed",
    accentText: "#ea580c",
    // Cleaner borders for web
    surfaceBorder: "#e2e8f0",
  },
  // Web-specific typography adjustments
  typography: {
    body: { fontWeight: "400" as const },
    bodySm: { fontWeight: "400" as const },
  },
};

export type Theme = {
  mode: "light" | "dark";
  colors: ColorTokens;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
  shadows: typeof shadows;
};

export const buildTheme = (mode: "light" | "dark"): Theme => ({
  mode,
  colors: mode === "light" ? lightColors : darkColors,
  spacing,
  radii,
  typography,
  shadows,
});
