/**
 * Centralised status / priority / stage color helpers.
 *
 * Every screen that renders a status pill, priority chip, or stage marker
 * imports from here. Colors are *semantic* — they resolve to the running
 * theme so light/dark mode is automatic and there's a single place to
 * tweak the palette.
 *
 * The factory signature is always `(status, c) => StatusColor`, where `c`
 * is the active `theme.colors` object. Each StatusColor has:
 *   - bg     – soft tinted background (for chip / banner background)
 *   - fg     – contrast text/icon color on top of `bg`
 *   - solid  – fully-saturated color, useful for borders or filled pills
 *
 * If a status key is unknown the helper returns the neutral grey tone,
 * so an unrecognised value never crashes the UI.
 */

import type { ColorTokens } from "./tokens";

export interface StatusColor {
  bg: string;
  fg: string;
  solid: string;
}

const success = (c: ColorTokens): StatusColor => ({
  bg: c.successBg,
  fg: c.successText,
  solid: c.successText,
});

const warning = (c: ColorTokens): StatusColor => ({
  bg: c.warningBg,
  fg: c.warningText,
  solid: c.warningText,
});

const danger = (c: ColorTokens): StatusColor => ({
  bg: c.dangerBg,
  fg: c.dangerText,
  solid: c.dangerText,
});

const info = (c: ColorTokens): StatusColor => ({
  bg: c.infoBg,
  fg: c.infoText,
  solid: c.infoText,
});

const accent = (c: ColorTokens): StatusColor => ({
  bg: c.accentSoft,
  fg: c.accentText,
  solid: c.accent,
});

const neutral = (c: ColorTokens): StatusColor => ({
  bg: c.surfaceMuted,
  fg: c.textMuted,
  solid: c.textMuted,
});

// Used when a status maps to a unique color outside the normal status
// palette (e.g. pink for "OFFER", purple for "INTERVIEW"). Background
// is the matching pastel wash so the chip stays calm in light mode.
const role = (
  bg: string,
  fg: string,
  solid: string
): StatusColor => ({ bg, fg, solid });

// =============================================================================
// Task / priority
// =============================================================================

export const taskPriorityColor = (
  priority: string | null | undefined,
  c: ColorTokens
): StatusColor => {
  switch (priority) {
    case "CRITICAL":
      return danger(c);
    case "HIGH":
      return warning(c);
    case "MEDIUM":
      return info(c);
    case "LOW":
      return neutral(c);
    default:
      return neutral(c);
  }
};

// Task lifecycle status — PENDING / ONGOING / COMPLETED (and friends).
export const taskStatusColor = (
  status: string | null | undefined,
  c: ColorTokens
): StatusColor => {
  switch (status) {
    case "COMPLETED":
      return success(c);
    case "ONGOING":
    case "IN_PROGRESS":
      return info(c);
    case "PENDING":
      return warning(c);
    case "CANCELLED":
      return neutral(c);
    default:
      return neutral(c);
  }
};

// =============================================================================
// Review status — { SELF_EVAL, MANAGER_EVAL, SUBMITTED, ACKNOWLEDGED }
// =============================================================================

export const reviewStatusColor = (
  status: string | null | undefined,
  c: ColorTokens
): StatusColor => {
  switch (status) {
    case "SELF_EVAL":
      return warning(c);
    case "MANAGER_EVAL":
      return info(c);
    case "SUBMITTED":
      return role(c.roleHrBg, c.roleHrText, c.roleHrText);
    case "ACKNOWLEDGED":
      return success(c);
    default:
      return neutral(c);
  }
};

export const reviewStatusLabel = (status: string): string => {
  switch (status) {
    case "SELF_EVAL":
      return "Self-eval needed";
    case "MANAGER_EVAL":
      return "Manager evaluating";
    case "SUBMITTED":
      return "Awaiting your acknowledgement";
    case "ACKNOWLEDGED":
      return "Acknowledged";
    default:
      return status;
  }
};

// =============================================================================
// Goal status — { DRAFT, ACTIVE, COMPLETED, CANCELLED }
// =============================================================================

export const goalStatusColor = (
  status: string | null | undefined,
  c: ColorTokens
): StatusColor => {
  switch (status) {
    case "DRAFT":
      return neutral(c);
    case "ACTIVE":
      return info(c);
    case "COMPLETED":
      return success(c);
    case "CANCELLED":
      return neutral(c);
    default:
      return neutral(c);
  }
};

// =============================================================================
// Recruitment — candidate stage, interview status, recommendation, offer
// =============================================================================

export const candidateStageColor = (
  stage: string | null | undefined,
  c: ColorTokens
): StatusColor => {
  switch (stage) {
    case "APPLIED":
      return info(c);
    case "SCREENING":
      return warning(c);
    case "INTERVIEW":
      return role(c.roleHrBg, c.roleHrText, c.roleHrText);
    case "OFFER":
      return role(c.pastelPink, "#be185d", "#be185d");
    case "HIRED":
      return success(c);
    case "REJECTED":
      return danger(c);
    case "WITHDRAWN":
      return neutral(c);
    default:
      return neutral(c);
  }
};

export const interviewStatusColor = (
  status: string | null | undefined,
  c: ColorTokens
): StatusColor => {
  switch (status) {
    case "SCHEDULED":
      return info(c);
    case "COMPLETED":
      return success(c);
    case "CANCELLED":
      return neutral(c);
    default:
      return neutral(c);
  }
};

export const recommendationColor = (
  rec: string | null | undefined,
  c: ColorTokens
): StatusColor => {
  switch (rec) {
    case "STRONG_HIRE":
      return success(c);
    case "HIRE":
      return info(c);
    case "NO_HIRE":
      return warning(c);
    case "STRONG_NO_HIRE":
      return danger(c);
    default:
      return neutral(c);
  }
};

export const offerStatusColor = (
  status: string | null | undefined,
  c: ColorTokens
): StatusColor => {
  switch (status) {
    case "DRAFT":
      return neutral(c);
    case "SENT":
      return info(c);
    case "ACCEPTED":
      return success(c);
    case "REJECTED":
      return danger(c);
    case "EXPIRED":
      return warning(c);
    case "REVOKED":
      return danger(c);
    default:
      return neutral(c);
  }
};

export const jobOpeningStatusColor = (
  status: string | null | undefined,
  c: ColorTokens
): StatusColor => {
  switch (status) {
    case "Open":
      return success(c);
    case "OnHold":
      return warning(c);
    case "Closed":
      return neutral(c);
    default:
      return neutral(c);
  }
};

// =============================================================================
// Operational — projects, reimbursements, timesheets, feedback
// =============================================================================

export const projectStatusColor = (
  status: string | null | undefined,
  c: ColorTokens
): StatusColor => {
  switch (status) {
    case "Active":
      return success(c);
    case "OnHold":
      return warning(c);
    case "Completed":
      return neutral(c);
    default:
      return neutral(c);
  }
};

export const reimbursementStatusColor = (
  status: string | null | undefined,
  c: ColorTokens
): StatusColor => {
  switch (status) {
    case "PENDING_MANAGER":
      return warning(c);
    case "PENDING_HR":
      return info(c);
    case "APPROVED":
      return success(c);
    case "REJECTED":
      return danger(c);
    default:
      return neutral(c);
  }
};

export const reimbursementStatusLabel = (status: string): string => {
  switch (status) {
    case "PENDING_MANAGER":
      return "Awaiting manager";
    case "PENDING_HR":
      return "Awaiting HR";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected";
    default:
      return status;
  }
};

export const timesheetStatusColor = (
  status: string | null | undefined,
  c: ColorTokens
): StatusColor => {
  switch (status) {
    case "DRAFT":
      return neutral(c);
    case "PENDING":
      return warning(c);
    case "APPROVED":
      return success(c);
    case "REJECTED":
      return danger(c);
    default:
      return neutral(c);
  }
};

export const timesheetStatusLabel = (status: string): string => {
  switch (status) {
    case "DRAFT":
      return "Draft (not submitted)";
    case "PENDING":
      return "Awaiting manager";
    case "APPROVED":
      return "Approved";
    case "REJECTED":
      return "Rejected — fix & resubmit";
    default:
      return status;
  }
};

// Attendance status — used in hr-attendance / manager-attendance lists.
export const attendanceStatusColor = (
  status: string | null | undefined,
  c: ColorTokens
): StatusColor => {
  switch (status) {
    case "COMPLETED":
    case "PRESENT":
      return success(c);
    case "CHECKED_IN":
      return info(c);
    case "HALF_DAY":
      return warning(c);
    case "ABSENT":
      return danger(c);
    default:
      return neutral(c);
  }
};

export const feedbackTypeColor = (
  type: string | null | undefined,
  c: ColorTokens
): StatusColor => {
  switch (type) {
    case "POSITIVE":
      return success(c);
    case "CONSTRUCTIVE":
      return warning(c);
    case "PEER":
      return info(c);
    case "MANAGER_TO_REPORT":
      return role(c.roleHrBg, c.roleHrText, c.roleHrText);
    case "REPORT_TO_MANAGER":
      return accent(c);
    default:
      return neutral(c);
  }
};
