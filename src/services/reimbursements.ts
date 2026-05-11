import { apiCall } from "./http";
import {
  PaymentMode,
  Reimbursement,
  ReimbursementStatus,
} from "../types";

export interface ReimbursementPayload {
  title: string;
  category: string;
  expenseDate: string;
  amount: number;
  paymentMode?: PaymentMode | string;
  vendorName?: string;
  invoiceNumber?: string;
  taxAmount?: number;
  description?: string;
  attachments?: string[];
}

export const submitReimbursement = (
  token: string,
  payload: ReimbursementPayload
): Promise<Reimbursement> =>
  apiCall("/expenses/reimbursements", {
    method: "POST",
    body: payload,
    token,
  });

export const listMyReimbursements = (
  token: string,
  status?: ReimbursementStatus
): Promise<Reimbursement[]> => {
  const qs = status ? `?status=${status}` : "";
  return apiCall(`/expenses/reimbursements/mine${qs}`, { token });
};

export const listHrReimbursements = (
  token: string,
  status: ReimbursementStatus = "PENDING_HR"
): Promise<Reimbursement[]> =>
  apiCall(`/hr/reimbursements?status=${status}`, { token });

export const decideHrReimbursement = (
  token: string,
  id: string,
  payload: { action: "APPROVE" | "REJECT"; note?: string }
): Promise<{ message: string }> =>
  apiCall(`/hr/reimbursements/${id}/decide`, {
    method: "POST",
    body: payload,
    token,
  });
