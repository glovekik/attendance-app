/**
 * Formatting for worked-time durations.
 *
 * The backend stores hours as a decimal — 9 hours 48 minutes is 9.8 — which
 * is right for arithmetic and wrong for reading. Shown as "9.80h" people
 * read it as nine hours and eighty minutes, and report the number as a bug.
 * The attendance calendar already rendered "9h 48m"; every other screen
 * printed the raw decimal, so the same day read two different ways depending
 * on where you looked.
 *
 * One formatter, used wherever a computed duration is shown.
 */

/**
 * "9h 48m" — a duration in decimal hours, written the way a person says it.
 *
 * Rounds to the nearest minute, and carries 60 minutes up to the next hour
 * so 1.999 reads "2h 00m" rather than "1h 60m".
 */
export const formatHours = (hours?: number | null): string => {
  if (typeof hours !== "number" || !isFinite(hours) || hours <= 0) return "—";
  let h = Math.floor(hours);
  let m = Math.round((hours - h) * 60);
  if (m === 60) {
    h += 1;
    m = 0;
  }
  return `${h}h ${String(m).padStart(2, "0")}m`;
};

/**
 * "9h 48m" for a single day, "41h 20m" for a week — same thing, but tolerant
 * of a zero total, which is a real answer for a week nobody worked rather
 * than missing data.
 */
export const formatTotalHours = (hours?: number | null): string => {
  if (typeof hours !== "number" || !isFinite(hours)) return "—";
  if (hours === 0) return "0h 00m";
  return formatHours(hours);
};
