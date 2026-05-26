import { apiCall } from "./http";
import {
  AttendanceCorrection,
  CorrectionStatus,
} from "../types";

export type AttendanceTypeLiteral = "OFFICE" | "WFH" | "LEAVE" | "HOLIDAY";

export interface CorrectionRequestBody {
  reason: string;
  // All optional — send any subset the employee wants to change.
  requestedDate?: string;            // YYYY-MM-DD
  requestedCheckIn?: string;         // ISO 8601
  requestedCheckOut?: string;        // ISO 8601
  requestedAttendanceType?: AttendanceTypeLiteral;
  requestedWorkNotes?: string;
}

export interface CorrectionDecisionBody {
  action: "APPROVE" | "REJECT";
  note?: string;
  // HR/Manager can override any requested field before stamping.
  overrideDate?: string;
  overrideCheckIn?: string;
  overrideCheckOut?: string;
  overrideAttendanceType?: AttendanceTypeLiteral;
  overrideWorkNotes?: string;
}

// ===== USER =====
export const requestCorrection = (
  token: string,
  attendanceId: string,
  data: CorrectionRequestBody
) =>
  apiCall<AttendanceCorrection>(
    `/attendance/${attendanceId}/correction-request`,
    { method: "POST", body: data, token }
  );

export const listMyCorrections = (
  token: string,
  status?: CorrectionStatus
) => {
  const qs = status ? `?status=${status}` : "";
  return apiCall<AttendanceCorrection[]>(
    `/attendance/correction-requests/mine${qs}`,
    { token }
  );
};

// ===== HR =====
export const listPendingCorrections = (token: string) =>
  apiCall<AttendanceCorrection[]>(
    `/hr/correction-requests?status=PENDING`,
    { token }
  );

export const listAllCorrections = (
  token: string,
  status?: CorrectionStatus
) => {
  const qs = status ? `?status=${status}` : "";
  return apiCall<AttendanceCorrection[]>(
    `/hr/correction-requests${qs}`,
    { token }
  );
};

export const decideCorrection = (
  token: string,
  id: string,
  data: CorrectionDecisionBody
) =>
  apiCall<{ message: string }>(
    `/hr/correction-requests/${id}/decide`,
    { method: "POST", body: data, token }
  );
