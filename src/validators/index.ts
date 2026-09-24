/**
 * Field validation, defined once.
 *
 * Before this, nothing validated: a phone field was a text input with a
 * phone-pad keyboard, which suggests digits on a mobile keyboard and stops
 * nothing on a desktop browser. Production shows the result — a stored
 * 11-digit number, two with +91 prefixes, and the rest bare.
 *
 * Every validator returns `null` when the value is acceptable, or a message
 * written for the person reading it. That shape composes: a form collects
 * the non-null results and refuses to submit while any remain.
 */

export type Validator = (value: string) => string | null;

/** Digits only — what a phone number reduces to once formatting is gone. */
const digitsOf = (v: string): string => v.replace(/\D/g, "");

/**
 * An Indian mobile number: ten digits starting 6, 7, 8 or 9.
 *
 * Accepts the shapes people genuinely type — "+91 98765 43210",
 * "098765-43210", "9876543210" — because rejecting a correct number over a
 * space is the kind of validation that makes people give up. What it does
 * not do is silently rewrite the value; use normalizePhone for that, at the
 * point of saving, so the person can still see what they typed.
 */
export const validatePhone: Validator = (value) => {
  const raw = (value || "").trim();
  if (!raw) return null; // emptiness is `required`'s job, not this one's

  if (/[a-zA-Z]/.test(raw)) return "Phone numbers can't contain letters.";
  if (/[^\d\s+()\-]/.test(raw)) {
    return "Use only digits — spaces, +, - and brackets are fine.";
  }

  let digits = digitsOf(raw);
  // Strip the country code or a trunk 0 before measuring length.
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);

  if (digits.length !== 10) {
    return `Enter a 10-digit mobile number (you've entered ${digits.length}).`;
  }
  if (!/^[6-9]/.test(digits)) {
    return "An Indian mobile number starts with 6, 7, 8 or 9.";
  }
  return null;
};

/**
 * The ten digits to store, from whatever was typed. Returns the input
 * unchanged when it isn't a valid number — validation refuses it first, and
 * a half-understood number is worse than the original.
 */
export const normalizePhone = (value: string): string => {
  if (validatePhone(value)) return value;
  let digits = digitsOf(value);
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits;
};

/**
 * Email structure. Deliberately not the RFC 5322 grammar — that accepts
 * addresses no mail server here will ever see, and the failure people
 * actually make is a missing @ or a trailing comma.
 */
export const validateEmail: Validator = (value) => {
  const raw = (value || "").trim();
  if (!raw) return null;
  if (/\s/.test(raw)) return "An email address can't contain spaces.";
  if (!/^[^@]+@[^@]+$/.test(raw)) {
    return "Enter a valid email address, like name@company.com.";
  }
  const [, domain] = raw.split("@");
  if (!domain.includes(".") || domain.startsWith(".") || domain.endsWith(".")) {
    return "Enter a valid email address, like name@company.com.";
  }
  if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(raw)) {
    return "Enter a valid email address, like name@company.com.";
  }
  return null;
};

/** Present and not just whitespace. `label` makes the message specific. */
export const required = (label: string): Validator => (value) =>
  (value || "").trim() ? null : `${label} is required.`;

/** A whole number within bounds — PIN codes, counts, quantities. */
export const validateDigits = (
  label: string,
  length: number
): Validator => (value) => {
  const raw = (value || "").trim();
  if (!raw) return null;
  if (!/^\d+$/.test(raw)) return `${label} must be digits only.`;
  if (raw.length !== length) {
    return `${label} must be ${length} digits (you've entered ${raw.length}).`;
  }
  return null;
};

/** ISO date (YYYY-MM-DD) that is a real calendar day, optionally in the past. */
export const validateDate = (
  label: string,
  opts: { pastOnly?: boolean } = {}
): Validator => (value) => {
  const raw = (value || "").trim();
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${label} must be YYYY-MM-DD.`;
  const [y, m, day] = raw.split("-").map(Number);
  // Built and compared in UTC throughout. Parsing "2005-05-05T00:00:00" gives
  // local midnight, and toISOString() then shifts it back a day east of
  // Greenwich — in IST every date would fail this check by one day.
  const d = new Date(Date.UTC(y, m - 1, day));
  if (isNaN(d.getTime())) return `${label} isn't a real date.`;
  // Round-trip catches 2026-02-31, which Date happily rolls into March.
  if (
    d.getUTCFullYear() !== y ||
    d.getUTCMonth() !== m - 1 ||
    d.getUTCDate() !== day
  ) {
    return `${label} isn't a real date.`;
  }
  if (opts.pastOnly && d.getTime() > Date.now()) {
    return `${label} can't be in the future.`;
  }
  return null;
};

/** Run several validators, returning the first complaint. */
export const all = (...validators: Validator[]): Validator => (value) => {
  for (const v of validators) {
    const err = v(value);
    if (err) return err;
  }
  return null;
};
