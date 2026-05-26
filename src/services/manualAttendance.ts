import { apiCall } from "./http";

export type ManualRequestStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export interface ManualAttendanceRequest {
  id: string;
  userId: string;
  user?: { id: string; name: string; email: string };
  date: string;
  checkIn?: string | null;
  checkOut?: string | null;
  attendanceType?: string;
  reason: string;
  status: ManualRequestStatus;
  decisionNote?: string;
  decidedBy?: string;
  decidedByRole?: "HR" | "MANAGER";
  decidedAt?: string;
  createdAt: string;
}

export interface ManualRequestPayload {
  date: string;
  checkIn?: string | null;
  checkOut?: string | null;
  attendanceType?: string;
  reason: string;
}

// ===== EMPLOYEE =====
export const submitManualRequest = (
  token: string,
  data: ManualRequestPayload
): Promise<ManualAttendanceRequest> =>
  apiCall("/attendance/manual-request", {
    method: "POST",
    body: data,
    token,
  });

export const listMyManualRequests = (
  token: string
): Promise<ManualAttendanceRequest[]> =>
  apiCall("/attendance/manual-request/mine", { token });

export const cancelManualRequest = (
  token: string,
  id: string
): Promise<{ message: string }> =>
  apiCall(`/attendance/manual-request/${id}/cancel`, {
    method: "POST",
    token,
  });

// ===== MANAGER =====
export const listManagerManualRequests = (
  token: string,
  status?: ManualRequestStatus
): Promise<ManualAttendanceRequest[]> => {
  const qs = status ? `?status=${status}` : "";
  return apiCall(`/manager/manual-requests${qs}`, { token });
};

export const decideManagerManualRequest = (
  token: string,
  id: string,
  data: { action: "APPROVE" | "REJECT"; note?: string }
): Promise<{ message: string }> =>
  apiCall(`/manager/manual-requests/${id}/decide`, {
    method: "POST",
    body: data,
    token,
  });

// ===== HR =====
export const listHrManualRequests = (
  token: string,
  status?: ManualRequestStatus
): Promise<ManualAttendanceRequest[]> => {
  const qs = status ? `?status=${status}` : "";
  return apiCall(`/hr/manual-requests${qs}`, { token });
};

export const decideHrManualRequest = (
  token: string,
  id: string,
  data: { action: "APPROVE" | "REJECT"; note?: string }
): Promise<{ message: string }> =>
  apiCall(`/hr/manual-requests/${id}/decide`, {
    method: "POST",
    body: data,
    token,
  });
