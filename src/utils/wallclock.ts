/**
 * Encoding for times a person TYPED, as opposed to instants a device captured.
 *
 * `new Date(...).toISOString()` is right for "what time is it now" — it pins a
 * real instant. It is wrong for "I left at 8:15 PM", because it first reads the
 * typed hours in the *device's* timezone and then converts. On a phone set to
 * IST that round-trips by luck. On a desktop left on UTC, an emulator (UTC by
 * default), or a laptop carried abroad, 8:15 PM was sent as an instant the
 * server turned into 1:45 AM the next morning — the correction was approved and
 * the day was recorded as sixteen hours long.
 *
 * A typed office time has no timezone to convert; it *is* the office's clock.
 * So send it unconverted, with no offset and no trailing Z, and let the server
 * store it as the IST wall-clock it already means. The matching server contract
 * is `parse_wallclock_to_ist_naive` in utils/ist.py.
 */

const two = (n: number) => String(n).padStart(2, "0");

/** "2026-09-04" + a Date whose h:m the user picked -> "2026-09-04T20:15:00". */
export const wallClockIso = (dateStr: string, time: Date): string =>
  `${dateStr}T${two(time.getHours())}:${two(time.getMinutes())}:00`;

/** A Date for the day + a Date for the time -> the same wall-clock string. */
export const wallClockIsoFromDates = (day: Date, time: Date): string =>
  wallClockIso(
    `${day.getFullYear()}-${two(day.getMonth() + 1)}-${two(day.getDate())}`,
    time
  );

/** Numeric h:m (from a "HH:MM" field) against a YYYY-MM-DD day. */
export const wallClockIsoFromHM = (
  dateStr: string,
  hours: number,
  minutes: number
): string => `${dateStr}T${two(hours)}:${two(minutes)}:00`;
