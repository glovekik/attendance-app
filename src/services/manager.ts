import { apiCall } from "./http";
import {
  LeaveRequest,
  AttendanceCorrection,
  Reimbursement,
  Timesheet,
} from "../types";

export type DecideAction = "APPROVE" | "REJECT";

export interface DecidePayload {
  action: DecideAction;
  note?: string;
}

export interface CorrectionDecidePayload extends DecidePayload {
  overrideCheckOut?: string;
}

// ===== LEAVE =====
export const listManagerLeaves = (
  token: string,
  status: string = "PENDING"
): Promise<LeaveRequest[]> =>
  apiCall(`/manager/leave-requests?status=${status}`, { token });

export const decideManagerLeave = (
  token: string,
  id: string,
  payload: DecidePayload
): Promise<{ message: string }> =>
  apiCall(`/manager/leave-requests/${id}/decide`, {
    method: "POST",
    body: payload,
    token,
  });

// ===== CORRECTIONS =====
export const listManagerCorrections = (
  token: string,
  status: string = "PENDING"
): Promise<AttendanceCorrection[]> =>
  apiCall(`/manager/correction-requests?status=${status}`, { token });

export const decideManagerCorrection = (
  token: string,
  id: string,
  payload: CorrectionDecidePayload
): Promise<{ message: string }> =>
  apiCall(`/manager/correction-requests/${id}/decide`, {
    method: "POST",
    body: payload,
    token,
  });

// ===== REIMBURSEMENTS =====
export const listManagerReimbursements = (
  token: string,
  status: string = "PENDING_MANAGER"
): Promise<Reimbursement[]> =>
  apiCall(`/manager/reimbursements?status=${status}`, { token });

export const decideManagerReimbursement = (
  token: string,
  id: string,
  payload: DecidePayload
): Promise<{ message: string }> =>
  apiCall(`/manager/reimbursements/${id}/decide`, {
    method: "POST",
    body: payload,
    token,
  });

// ===== TIMESHEETS =====
export const listManagerTimesheets = (
  token: string,
  status: string = "PENDING"
): Promise<Timesheet[]> =>
  apiCall(`/manager/timesheets?status=${status}`, { token });

export const decideManagerTimesheet = (
  token: string,
  id: string,
  payload: DecidePayload
): Promise<{ message: string }> =>
  apiCall(`/manager/timesheets/${id}/decide`, {
    method: "POST",
    body: payload,
    token,
  });
