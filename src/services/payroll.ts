import { apiCall } from "./http";
import {
  SalaryStructure,
  PayrollRun,
  Payslip,
  TDSRegime,
} from "../types";
import { API_URL } from "../config";

// ===== HR salary structure =====
export interface SalaryStructurePayload {
  basic: number;
  hra: number;
  communicationAllowance: number;
  otherAllowance: number;
  employerInsurance: number;
  professionalTax: number;
  tds: number;
  employeeInsurance: number;
  employerPF?: number | null;
  employeePF?: number | null;
  panNumber?: string;
  uanNumber?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  bankName?: string;
  tdsRegime?: TDSRegime;
}

export const hrSetSalaryStructure = (
  token: string,
  userId: string,
  data: SalaryStructurePayload
) =>
  apiCall<SalaryStructure>(
    `/hr/users/${userId}/salary-structure`,
    { method: "POST", body: data, token }
  );

export const hrGetSalaryStructure = (
  token: string,
  userId: string
) =>
  apiCall<SalaryStructure | null>(
    `/hr/users/${userId}/salary-structure`,
    { token }
  );

export const hrGetSalaryHistory = (
  token: string,
  userId: string
) =>
  apiCall<SalaryStructure[]>(
    `/hr/users/${userId}/salary-history`,
    { token }
  );

// ===== HR payroll runs =====
export const hrCreatePayrollRun = (
  token: string,
  data: { year: number; month: number; workingDays?: number }
) =>
  apiCall<PayrollRun>("/hr/payroll/runs", {
    method: "POST",
    body: data,
    token,
  });

export const hrListPayrollRuns = (token: string) =>
  apiCall<PayrollRun[]>("/hr/payroll/runs", { token });

export const hrGetPayrollRun = (token: string, id: string) =>
  apiCall<PayrollRun>(`/hr/payroll/runs/${id}`, { token });

export const hrDeletePayrollRun = (token: string, id: string) =>
  apiCall<{ message: string }>(`/hr/payroll/runs/${id}`, {
    method: "DELETE",
    token,
  });

export const hrProcessPayrollRun = (
  token: string,
  id: string
) =>
  apiCall<{ generated: number; skipped: number }>(
    `/hr/payroll/runs/${id}/process`,
    { method: "POST", token }
  );

export const hrLockPayrollRun = (token: string, id: string) =>
  apiCall<{ message: string }>(
    `/hr/payroll/runs/${id}/lock`,
    { method: "POST", token }
  );

export const hrEmailAllPayslips = (
  token: string,
  id: string
) =>
  apiCall<{
    sentCount: number;
    failedCount: number;
    skippedCount: number;
  }>(`/hr/payroll/runs/${id}/email-all`, {
    method: "POST",
    token,
  });

// ===== HR payslips =====
export const hrListPayslipsForRun = (
  token: string,
  runId: string
) =>
  apiCall<Payslip[]>(
    `/hr/payroll/runs/${runId}/payslips`,
    { token }
  );

export const hrGetPayslip = (token: string, id: string) =>
  apiCall<Payslip>(`/hr/payslips/${id}`, { token });

export const hrUpdatePayslip = (
  token: string,
  id: string,
  data: Partial<Payslip>
) =>
  apiCall<Payslip>(`/hr/payslips/${id}`, {
    method: "PUT",
    body: data,
    token,
  });

export const hrEmailPayslip = (token: string, id: string) =>
  apiCall<{ message: string }>(`/hr/payslips/${id}/email`, {
    method: "POST",
    token,
  });

export const hrPayslipPdfUrl = (id: string) =>
  `${API_URL}/hr/payslips/${id}/pdf`;

// ===== USER =====
export const myPayslips = (token: string) =>
  apiCall<Payslip[]>("/payroll/payslips", { token });

export const myPayslip = (token: string, id: string) =>
  apiCall<Payslip>(`/payroll/payslips/${id}`, { token });

export const myPayslipPdfUrl = (id: string) =>
  `${API_URL}/payroll/payslips/${id}/pdf`;
