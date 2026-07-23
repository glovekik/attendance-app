import { apiCall } from "./http";
import { API_URL } from "../config";
import { downloadXlsxWithAuth } from "../utils/download";
import { Timesheet, TimesheetEntry } from "../types";

/** Who's asking — decides scope: HR sees everyone, a manager sees reports. */
export type TimesheetScope = "hr" | "manager";

export interface TimesheetFilters {
  status?: string;
  userId?: string;
  weekStart?: string;
}

export interface TimesheetSummary {
  count: number;
  employees: number;
  totalHours: number;
  /** Hours a manager has actually signed off — the number that counts. */
  approvedHours: number;
  byStatus: Record<string, number>;
}

const filterQs = (f: TimesheetFilters = {}): string => {
  const p = new URLSearchParams();
  if (f.status) p.set("status", f.status);
  if (f.userId) p.set("userId", f.userId);
  if (f.weekStart) p.set("weekStart", f.weekStart);
  const qs = p.toString();
  return qs ? `?${qs}` : "";
};

const base = (scope: TimesheetScope) =>
  scope === "hr" ? "/hr/timesheets" : "/manager/timesheets";

export interface TimesheetSubmitPayload {
  weekStart: string;
  note?: string;
  entries?: TimesheetEntry[];
}

export const getMyTimesheet = (
  token: string,
  weekStart: string
): Promise<Timesheet> =>
  apiCall(`/timesheets/my?weekStart=${weekStart}`, { token });

export const submitTimesheet = (
  token: string,
  payload: TimesheetSubmitPayload
): Promise<Timesheet> =>
  apiCall("/timesheets/submit", {
    method: "POST",
    body: payload,
    token,
  });

export const getTimesheetSummary = (
  token: string,
  scope: TimesheetScope,
  filters: TimesheetFilters = {}
): Promise<TimesheetSummary> =>
  apiCall(`${base(scope)}/summary${filterQs(filters)}`, { token });

/** Streams the .xlsx and hands it to the browser / native share sheet. */
export const downloadTimesheetsXlsx = (
  token: string,
  scope: TimesheetScope,
  filters: TimesheetFilters = {}
): Promise<void> =>
  downloadXlsxWithAuth(
    `${API_URL}${base(scope)}/export.xlsx${filterQs(filters)}`,
    token,
    `timesheets${filters.weekStart ? `-${filters.weekStart}` : ""}.xlsx`
  );

export const listHrTimesheets = (
  token: string,
  opts: {
    status?: string;
    userId?: string;
    weekStart?: string;
    limit?: number;
  } = {}
): Promise<Timesheet[]> => {
  const params = new URLSearchParams();
  if (opts.status) params.set("status", opts.status);
  if (opts.userId) params.set("userId", opts.userId);
  if (opts.weekStart) params.set("weekStart", opts.weekStart);
  if (opts.limit) params.set("limit", String(opts.limit));
  const qs = params.toString();
  return apiCall(`/hr/timesheets${qs ? `?${qs}` : ""}`, { token });
};

// ===== ONE PERSON, ONE WEEK: XLSX ROUND-TRIP =====
// The file the download produces is the file the upload accepts, so
// "download it, fill it in, send it back" needs no explanation.

export const downloadMyTimesheetXlsx = (
  token: string,
  weekStart: string
): Promise<void> =>
  downloadXlsxWithAuth(
    `${API_URL}/timesheets/my/export.xlsx?weekStart=${weekStart}`,
    token,
    `timesheet-${weekStart}.xlsx`
  );

export interface TimesheetImportResult {
  weekStart: string;
  entries: TimesheetEntry[];
  totalHours: number;
  incompleteDates: string[];
  /** Rows for days that haven't happened — read, but refused on submit. */
  futureDates: string[];
  /** Rows where the out-time isn't after the in-time. */
  reversedDates: string[];
  fileName: string;
}

/**
 * Parse a filled-in sheet. Saves nothing — the entries come back for the
 * employee to review and submit themselves.
 */
export const importMyTimesheet = async (
  token: string,
  weekStart: string,
  file: { uri: string; name: string; mimeType?: string } | Blob
): Promise<TimesheetImportResult> => {
  const form = new FormData();
  if (file instanceof Blob) {
    form.append("file", file, "timesheet.xlsx");
  } else {
    form.append("file", {
      uri: file.uri,
      name: file.name || "timesheet.xlsx",
      type:
        file.mimeType ||
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    } as any);
  }

  const res = await fetch(
    `${API_URL}/timesheets/my/import?weekStart=${weekStart}`,
    {
      method: "POST",
      // Content-Type is deliberately unset: the runtime must add the
      // multipart boundary itself.
      headers: { Authorization: `Bearer ${token}` },
      body: form as any,
    }
  );

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.detail || `Upload failed (${res.status})`);
  }
  return data as TimesheetImportResult;
};

/** Pull a PENDING week back to DRAFT so it can be corrected. */
export const recallMyTimesheet = (
  token: string,
  weekStart: string
): Promise<Timesheet> =>
  apiCall(`/timesheets/my/recall?weekStart=${weekStart}`, {
    method: "POST",
    token,
  });

export interface TimesheetOverviewRow {
  userId: string;
  user?: {
    id: string;
    name?: string;
    email?: string;
    employeeCode?: string;
  } | null;
  sheets: number;
  totalHours: number;
  approvedHours: number;
  pending: number;
  approved: number;
  rejected: number;
  lastWeek?: string | null;
  lastStatus?: string | null;
}

/** One row per employee — who's behind, who's waiting on you. */
export const getTimesheetOverview = (
  token: string,
  scope: TimesheetScope,
  filters: TimesheetFilters = {}
): Promise<TimesheetOverviewRow[]> =>
  apiCall(
    `${base(scope)}/overview${filterQs({
      status: filters.status,
      weekStart: filters.weekStart,
    })}`,
    { token }
  );

/** Everything for ONE employee, as the same .xlsx the totals use. */
export const downloadEmployeeTimesheetsXlsx = (
  token: string,
  scope: TimesheetScope,
  userId: string,
  name?: string,
  filters: TimesheetFilters = {}
): Promise<void> =>
  downloadXlsxWithAuth(
    `${API_URL}${base(scope)}/export.xlsx${filterQs({ ...filters, userId })}`,
    token,
    `timesheets-${(name || userId).replace(/[^\w.-]+/g, "_")}.xlsx`
  );
