import { apiCall } from "./http";
import { Timesheet, TimesheetEntry } from "../types";

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
