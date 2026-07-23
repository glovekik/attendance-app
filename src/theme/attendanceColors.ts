/**
 * Attendance status palette — matches the HR legend:
 *   Employee Attended (teal) · Half day (rose) · Sick/PTO (blue) ·
 *   Unpaid PTO (orange) · No show/No call (dark) ·
 *   Non-working/Public holiday (gold)
 *
 * These are fixed brand colors (not theme tokens) so the legend reads the
 * same everywhere. Every attendance surface — calendars, status pills,
 * composition bars, KPI cards — resolves through here so there's one place
 * to tweak the palette.
 */

export type AttCat =
  | "present"
  | "wfh"
  | "halfday"
  | "leave"
  | "unpaid"
  | "absent"
  | "holiday";

// Fully-saturated colors (dots, bars, borders, filled pills). Hues are kept
// well-separated around the wheel: teal · violet · rose · blue · red-orange ·
// slate · amber — with a letter badge on each calendar card as an extra cue.
// Half day gets its OWN hue rather than a shade of teal: at calendar-card size
// a lighter teal reads as a rendering artefact, not as a different meaning.
export const ATT: Record<AttCat, string> = {
  present: "#0D9488", // Employee Attended (office / client) — teal
  wfh: "#7C3AED", //     Work from home — violet
  halfday: "#DB2777", // Half day worked / half day leave — rose
  leave: "#2563EB", //   Sick / paid PTO — blue (P)
  unpaid: "#EA580C", //  Unpaid PTO / LOP — red-orange (U)
  absent: "#475569", //  No show / no call / no record — slate (N)
  holiday: "#CA8A04", // Non-working / public holiday — amber (H)
};

// Stronger washes so the hue is obvious even in the small calendar cards.
export const ATT_BG: Record<AttCat, string> = {
  present: "rgba(13,148,136,0.22)",
  wfh: "rgba(124,58,237,0.22)",
  halfday: "rgba(219,39,119,0.22)",
  leave: "rgba(37,99,235,0.22)",
  unpaid: "rgba(234,88,12,0.24)",
  absent: "rgba(71,85,105,0.20)",
  holiday: "rgba(202,138,4,0.26)",
};

// One-letter badge shown on each calendar day card, for an unambiguous cue.
export const ATT_LETTER: Record<AttCat, string> = {
  present: "P", // Present (office)
  wfh: "W",
  halfday: "½", // Half day — worked part of it, off for the rest
  leave: "L", //   Paid leave
  unpaid: "U", //  Unpaid leave
  absent: "N", //  No record / no-show
  holiday: "H",
};

export interface AttColor {
  bg: string;
  fg: string;
  solid: string;
}

export const attColor = (cat: AttCat): AttColor => ({
  bg: ATT_BG[cat],
  fg: ATT[cat],
  solid: ATT[cat],
});
