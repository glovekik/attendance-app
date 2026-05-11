import { apiCall } from "./http";
import { ExitRequest, ExitStatus } from "../types";
import { API_URL } from "../config";

// USER
export const userResign = (
  token: string,
  data: { requestedLastWorkingDay: string; reason: string }
) =>
  apiCall<ExitRequest>("/exit/resign", {
    method: "POST",
    body: data,
    token,
  });

export const getMyExit = (token: string) =>
  apiCall<ExitRequest | null>("/exit/mine", { token });

export const setMyExitTaskStatus = (
  token: string,
  data: { taskId: string; status: string; note?: string }
) =>
  apiCall<ExitRequest>("/exit/employee-task-status", {
    method: "PUT",
    body: data,
    token,
  });

export const downloadExperienceLetterUrl = () =>
  `${API_URL}/exit/experience-letter`;

// HR
export const hrListExits = (
  token: string,
  status?: ExitStatus
) => {
  const qs = status ? `?status=${status}` : "";
  return apiCall<ExitRequest[]>(`/hr/exits${qs}`, { token });
};

export const hrGetExit = (token: string, id: string) =>
  apiCall<ExitRequest>(`/hr/exits/${id}`, { token });

export const hrDecideExit = (
  token: string,
  id: string,
  data: {
    action: "APPROVE" | "REJECT";
    approvedLastWorkingDay?: string;
    note?: string;
  }
) =>
  apiCall<{ message: string }>(`/hr/exits/${id}/decide`, {
    method: "POST",
    body: data,
    token,
  });

export const hrSetExitHRTaskStatus = (
  token: string,
  id: string,
  data: { taskId: string; status: string; note?: string }
) =>
  apiCall<ExitRequest>(`/hr/exits/${id}/hr-task-status`, {
    method: "PUT",
    body: data,
    token,
  });

export interface FFSPayload {
  pendingSalary?: number;
  leaveEncashment?: number;
  bonus?: number;
  deductions?: number;
  notes?: string;
}

export const hrUpdateFFS = (
  token: string,
  id: string,
  data: FFSPayload
) =>
  apiCall<ExitRequest>(`/hr/exits/${id}/ffs`, {
    method: "PUT",
    body: data,
    token,
  });

export const hrFinalizeFFS = (token: string, id: string) =>
  apiCall<{ message: string }>(
    `/hr/exits/${id}/ffs/finalize`,
    { method: "POST", token }
  );

export const hrMarkFFSPaid = (token: string, id: string) =>
  apiCall<{ message: string }>(
    `/hr/exits/${id}/ffs/mark-paid`,
    { method: "POST", token }
  );

export const hrIssueExperienceLetter = (
  token: string,
  id: string
) =>
  apiCall<{ message: string }>(
    `/hr/exits/${id}/experience-letter`,
    { method: "POST", token }
  );

export const hrCompleteExit = (token: string, id: string) =>
  apiCall<{ message: string }>(`/hr/exits/${id}/complete`, {
    method: "POST",
    token,
  });
