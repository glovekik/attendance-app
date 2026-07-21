import { apiCall } from "./http";
import {
  AttendanceStatus,
  LeaveBalance,
  LeaveRequest,
  Task,
  TaskStatus,
  TaskPriority,
} from "../types";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  employeeCode?: string;
  role: string;
  tag?: string;
  status?: string;
  departmentId?: string;
  profilePictureUrl?: string;
}

// Same shape as the HR attendance row — manager-scoped to direct reports.
export interface TeamAttendanceRow {
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
}

export interface TeamLeaveBalanceRow {
  user: { id: string; name: string; email: string; employeeCode?: string; profilePictureUrl?: string };
  balances: LeaveBalance[];
}

export interface ManagerTask extends Task {
  assignee?: { id: string; name: string; email: string };
}

export interface CreateManagerTaskPayload {
  title: string;
  description?: string;
  assigneeId: string;
  priority?: TaskPriority;
  reminderIntervalMinutes?: number;
  dueDate?: string;
  attachments?: string[];
}

export const listMyTeam = (token: string) =>
  apiCall<TeamMember[]>("/manager/team", { token });

export const listManagerTasks = (
  token: string,
  opts?: { status?: TaskStatus; assigneeId?: string }
) => {
  const parts: string[] = [];
  if (opts?.status) parts.push(`status=${opts.status}`);
  if (opts?.assigneeId) parts.push(`assigneeId=${opts.assigneeId}`);
  const qs = parts.length ? `?${parts.join("&")}` : "";
  return apiCall<ManagerTask[]>(`/manager/tasks${qs}`, { token });
};

export const createManagerTask = (
  token: string,
  data: CreateManagerTaskPayload
) =>
  apiCall<{ id: string; message: string }>("/manager/tasks", {
    method: "POST",
    body: data,
    token,
  });

export const updateManagerTask = (
  token: string,
  id: string,
  data: Partial<CreateManagerTaskPayload>
) =>
  apiCall<{ message: string }>(`/manager/tasks/${id}`, {
    method: "PUT",
    body: data,
    token,
  });

export const deleteManagerTask = (token: string, id: string) =>
  apiCall<{ message: string }>(`/manager/tasks/${id}`, {
    method: "DELETE",
    token,
  });

export const listTeamAttendance = (
  token: string,
  filters?: { date?: string; month?: string; userId?: string }
) => {
  const parts: string[] = [];
  if (filters?.date) parts.push(`date=${filters.date}`);
  if (filters?.month) parts.push(`month=${filters.month}`);
  if (filters?.userId) parts.push(`userId=${filters.userId}`);
  const qs = parts.length ? `?${parts.join("&")}` : "";
  return apiCall<TeamAttendanceRow[]>(`/manager/attendance${qs}`, { token });
};

export const listTeamLeaveBalances = (token: string, userId?: string) =>
  apiCall<TeamLeaveBalanceRow[]>(
    `/manager/leave-balances${userId ? `?userId=${userId}` : ""}`,
    { token }
  );

// Leave requests raised by the manager's direct reports. Pass a status to
// filter (e.g. "APPROVED"); omit it to fetch every status (the backend
// treats an empty status as "all"). Filter to one member client-side.
export const listManagerLeaveRequests = (
  token: string,
  status?: LeaveRequest["status"]
) =>
  apiCall<LeaveRequest[]>(
    `/manager/leave-requests?status=${status ?? ""}`,
    { token }
  );
