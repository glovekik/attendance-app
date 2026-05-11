import { apiCall } from "./http";
import { Holiday } from "../types";

export interface HolidayPayload {
  date: string;
  name: string;
  description?: string;
}

export const listHolidays = (
  token: string,
  opts?: { year?: number; from?: string; to?: string }
) => {
  const parts: string[] = [];
  if (opts?.year) parts.push(`year=${opts.year}`);
  if (opts?.from) parts.push(`from=${opts.from}`);
  if (opts?.to) parts.push(`to=${opts.to}`);
  const qs = parts.length ? `?${parts.join("&")}` : "";
  return apiCall<Holiday[]>(`/holidays${qs}`, { token });
};

export const hrCreateHoliday = (
  token: string,
  data: HolidayPayload
) =>
  apiCall<Holiday>("/hr/holidays", {
    method: "POST",
    body: data,
    token,
  });

export const hrUpdateHoliday = (
  token: string,
  id: string,
  data: Partial<HolidayPayload>
) =>
  apiCall<Holiday>(`/hr/holidays/${id}`, {
    method: "PUT",
    body: data,
    token,
  });

export const hrDeleteHoliday = (
  token: string,
  id: string
) =>
  apiCall<{ message: string }>(`/hr/holidays/${id}`, {
    method: "DELETE",
    token,
  });
