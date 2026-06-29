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

// Correction request for a day that has NO attendance record yet (a missed
// day). The backend creates a placeholder ABSENT attendance row for `date`
// and attaches this correction to it, so the normal approve flow can stamp
// it. Replaces the old "manual attendance request" path.
export interface CorrectionForDateBody extends CorrectionRequestBody {
  date: string; // YYYY-MM-DD — the missed day with no existing record
}

export const requestCorrectionForDate = (
  token: string,
  data: CorrectionForDateBody
) =>
  apiCall<AttendanceCorrection>(
    `/attendance/correction-requests/for-date`,
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

export interface BulkDecideResult {
  message: string;
  total: number;
  succeeded: number;
  failed: number;
  results: { id: string; ok: boolean; error?: string }[];
}

// Approve/reject many corrections in ONE atomic-per-item request.
// Used for "Approve all" / "Approve selected".
export const bulkDecideCorrections = (
  token: string,
  ids: string[],
  action: "APPROVE" | "REJECT" = "APPROVE",
  note?: string
) =>
  apiCall<BulkDecideResult>(
    `/hr/correction-requests/bulk-decide`,
    { method: "POST", body: { ids, action, note }, token }
  );
