import { apiCall } from "./http";
import { AttendanceStatus } from "../types";

export interface HrAttendanceRow {
  id: string;
  userId: string;
  user?: {
    id: string;
    name: string;
    email: string;
    employeeCode?: string;
  };
  date: string;
  attendanceType?: "OFFICE" | "WFH" | "LEAVE" | "HOLIDAY";
  status: AttendanceStatus;
  isLate?: boolean;
  hoursWorked?: number;
  overtimeHours?: number;
  checkIn?: string | null;
  checkOut?: string | null;
  workNotes?: string;
}

export interface HrAttendanceFilters {
  date?: string;   // YYYY-MM-DD
  month?: string;  // YYYY-MM
  userId?: string;
}

export const hrListAttendance = (
  token: string,
  filters?: HrAttendanceFilters
) => {
  const parts: string[] = [];
  if (filters?.date) parts.push(`date=${filters.date}`);
  if (filters?.month) parts.push(`month=${filters.month}`);
  if (filters?.userId) parts.push(`userId=${filters.userId}`);
  const qs = parts.length ? `?${parts.join("&")}` : "";
  return apiCall<HrAttendanceRow[]>(`/hr/attendance${qs}`, { token });
};
