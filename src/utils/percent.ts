/**
 * Percentages, written once.
 *
 * This lived as a private copy in two dashboards. Duplicated formatters drift:
 * the hours formatter had three implementations, and the screens using the
 * stale ones reported different numbers for the same day.
 *
 * Returns an em dash rather than "NaN%" or "null%" when there is nothing to
 * report — a rate over zero records is absent, not zero.
 */
export const formatPercent = (v?: number | null): string => {
  if (v === null || v === undefined || !Number.isFinite(v)) return "\u2014";
  return `${Math.round(v)}%`;
};
