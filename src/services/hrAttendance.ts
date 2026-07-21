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
    profilePictureUrl?: string;
  };
  date: string;
  attendanceType?: "OFFICE" | "WFH" | "CLIENT" | "LEAVE" | "HOLIDAY";
  clientAddress?: string | null;
  status: AttendanceStatus;
  isLate?: boolean;
  hoursWorked?: number;
  overtimeHours?: number;
  checkIn?: string | null;
  checkOut?: string | null;
  workNotes?: string;
  /** HR-marked unpaid (LOP) leave day — excluded from paid days in payroll. */
  unpaid?: boolean;
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

// HR marks (unpaid=true) or clears (unpaid=false) an employee's day as an
// UNPAID leave (LOP). Unpaid days are excluded from paid days in payroll.
export const hrMarkUnpaidLeave = (
  token: string,
  userId: string,
  date: string,
  unpaid: boolean
) =>
  apiCall<{ message: string; unpaid: boolean }>(
    "/hr/attendance/unpaid-leave",
    { method: "POST", body: { userId, date, unpaid }, token }
  );
