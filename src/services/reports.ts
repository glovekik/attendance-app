import { API_URL } from "../config";
import { ApiError } from "./http";
import { apiCall } from "./http";
import {
  AttendanceReportRow,
  AttritionRow,
  DeptHeadcountRow,
  LeaveReportRow,
  TeamProductivityRow,
} from "../types";

// ===== JSON REPORTS =====

export const attendanceReport = (
  token: string,
  fromDate: string,
  toDate: string,
  departmentId?: string
): Promise<AttendanceReportRow[]> => {
  const params = new URLSearchParams({ fromDate, toDate });
  if (departmentId) params.set("departmentId", departmentId);
  return apiCall(`/hr/reports/attendance?${params.toString()}`, { token });
};

export const leaveReport = (
  token: string,
  year: number
): Promise<LeaveReportRow[]> =>
  apiCall(`/hr/reports/leave?year=${year}`, { token });

export const payrollReport = (
  token: string,
  year: number,
  month: number
): Promise<any[]> =>
  apiCall(`/hr/reports/payroll?year=${year}&month=${month}`, { token });

export const departmentsReport = (
  token: string
): Promise<DeptHeadcountRow[]> =>
  apiCall("/hr/reports/departments", { token });

export const attritionReport = (
  token: string,
  fromDate: string,
  toDate: string
): Promise<AttritionRow[]> =>
  apiCall(`/hr/reports/attrition?fromDate=${fromDate}&toDate=${toDate}`, {
    token,
  });

export const teamProductivityReport = (
  token: string
): Promise<TeamProductivityRow[]> =>
  apiCall("/manager/reports/team-productivity", { token });

// ===== XLSX DOWNLOADS =====
// Returns a blob and suggested filename. On RN we can't trigger a save
// dialog, but we can return the blob URL for further handling (sharing,
// FileSystem write, etc.). Web gets a proper download.

export interface DownloadResult {
  blob: Blob;
  fileName: string;
}

const downloadXlsx = async (
  token: string,
  path: string,
  defaultName: string
): Promise<DownloadResult> => {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      /* ignore */
    }
    throw new ApiError(
      data?.detail || `Download failed (${res.status})`,
      res.status,
      data
    );
  }
  const blob = await res.blob();
  // Try to read filename from Content-Disposition; fall back to default.
  const cd = res.headers.get("Content-Disposition") || "";
  const match = /filename="?([^";]+)"?/i.exec(cd);
  const fileName = match ? match[1] : defaultName;
  return { blob, fileName };
};

export const downloadUsersXlsx = (token: string) =>
  downloadXlsx(token, "/hr/export/users.xlsx", "users.xlsx");

export const downloadAttendanceXlsx = (
  token: string,
  fromDate: string,
  toDate: string
) => {
  const params = new URLSearchParams({ fromDate, toDate });
  return downloadXlsx(
    token,
    `/hr/export/attendance.xlsx?${params.toString()}`,
    `attendance-${fromDate}_${toDate}.xlsx`
  );
};

export const downloadLeaveRequestsXlsx = (
  token: string,
  status?: string
) => {
  const qs = status ? `?status=${status}` : "";
  return downloadXlsx(
    token,
    `/hr/export/leave-requests.xlsx${qs}`,
    `leave-requests${status ? "-" + status : ""}.xlsx`
  );
};

export const downloadPayrollXlsx = (
  token: string,
  year: number,
  month: number
) =>
  downloadXlsx(
    token,
    `/hr/export/payroll/${year}/${month}.xlsx`,
    `payroll-${year}-${String(month).padStart(2, "0")}.xlsx`
  );
