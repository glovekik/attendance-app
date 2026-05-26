import { apiCall } from "./http";
import {
  LeaveType,
  LeaveBalance,
  LeaveRequest,
  LeaveStatus,
  HalfDayPart,
} from "../types";

// ===== HR — Leave types =====
export interface LeaveTypePayload {
  code: string;
  name: string;
  daysPerMonth: number;
  daysPerYear: number;
  allowHalfDay: boolean;
  requiresAttachment: boolean;
  description?: string;
  isActive: boolean;
}

export const hrCreateLeaveType = (
  token: string,
  data: LeaveTypePayload
) =>
  apiCall<LeaveType>("/hr/leave-types", {
    method: "POST",
    body: data,
    token,
  });

export const hrListLeaveTypes = (token: string) =>
  apiCall<LeaveType[]>("/hr/leave-types", { token });

export const hrUpdateLeaveType = (
  token: string,
  id: string,
  data: Partial<LeaveTypePayload>
) =>
  apiCall<LeaveType>(`/hr/leave-types/${id}`, {
    method: "PUT",
    body: data,
    token,
  });

export const hrDeleteLeaveType = (
  token: string,
  id: string
) =>
  apiCall<{ message: string }>(`/hr/leave-types/${id}`, {
    method: "DELETE",
    token,
  });

// ===== HR — review =====
export const hrListLeaveRequests = (
  token: string,
  status?: LeaveStatus
) => {
  const qs = status ? `?status=${status}` : "";
  return apiCall<LeaveRequest[]>(`/hr/leave-requests${qs}`, {
    token,
  });
};

export const hrDecideLeaveRequest = (
  token: string,
  id: string,
  data: { action: "APPROVE" | "REJECT"; note?: string }
) =>
  apiCall<{ message: string }>(
    `/hr/leave-requests/${id}/decide`,
    { method: "POST", body: data, token }
  );

// ===== HR — per-user balance allocation =====
export interface LeaveBalanceUpsertPayload {
  leaveTypeCode: string;
  allocated: number;
  year?: number;
  used?: number;
  pending?: number;
  note?: string;
}

export const hrGetUserLeaveBalance = (
  token: string,
  userId: string,
  year?: number
) => {
  const qs = year ? `?year=${year}` : "";
  return apiCall<LeaveBalance[]>(
    `/hr/users/${userId}/leave-balance${qs}`,
    { token }
  );
};

export const hrSetUserLeaveBalance = (
  token: string,
  userId: string,
  data: LeaveBalanceUpsertPayload
) =>
  apiCall<LeaveBalance>(`/hr/users/${userId}/leave-balance`, {
    method: "PUT",
    body: data,
    token,
  });

// ===== USER =====
export const listLeaveTypes = (token: string) =>
  apiCall<LeaveType[]>("/leaves/types", { token });

export const getLeaveBalance = (token: string) =>
  apiCall<LeaveBalance[]>("/leaves/balance", { token });

export interface LeaveRequestPayload {
  leaveTypeCode: string;
  fromDate: string;
  toDate: string;
  reason: string;
  halfDay?: boolean;
  halfDayPart?: HalfDayPart;
  attachmentUrl?: string;
}

export const submitLeaveRequest = (
  token: string,
  data: LeaveRequestPayload
) =>
  apiCall<LeaveRequest>("/leaves/request", {
    method: "POST",
    body: data,
    token,
  });

export const listMyLeaves = (
  token: string,
  status?: LeaveStatus
) => {
  const qs = status ? `?status=${status}` : "";
  return apiCall<LeaveRequest[]>(`/leaves/mine${qs}`, { token });
};

export const cancelLeaveRequest = (
  token: string,
  id: string
) =>
  apiCall<{ message: string }>(`/leaves/${id}/cancel`, {
    method: "POST",
    token,
  });
