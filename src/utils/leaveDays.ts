/**
 * Leave day counts are fractional — a half-day leave is 0.5 (see
 * _calc_total_days in the backend's routes/leave.py).
 *
 * Two things go wrong when these are rendered raw:
 *  - repeated float arithmetic on balances leaks noise, so a remaining
 *    balance shows as "11.499999999999998" instead of "11.5";
 *  - rounding to an integer to hide that noise silently drops the ".5",
 *    making a half-day leave look like it cost nothing (or a whole day).
 *
 * Round to one decimal, then render integers without a trailing ".0".
 */
export const formatDays = (n: number | null | undefined): string => {
  const v = Math.round((Number(n) || 0) * 10) / 10;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
};

/** "1 day" / "0.5 days" / "2 days" — pluralises off the rounded value. */
export const formatDayCount = (n: number | null | undefined): string => {
  const v = Math.round((Number(n) || 0) * 10) / 10;
  return `${formatDays(v)} ${v === 1 ? "day" : "days"}`;
};
