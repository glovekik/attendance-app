import { apiCall } from "./http";

export interface CompanyDocument {
  id: string;
  title: string;
  category: string;
  fileName: string;
  fileUrl: string;
  description?: string;
  effectiveFrom?: string;
  expiresOn?: string;
  uploadedBy?: string;
  uploadedAt?: string;
  updatedAt?: string;
}

export interface CompanyDocumentPayload {
  title: string;
  category: string;
  fileName: string;
  fileUrl: string;
  description?: string;
  effectiveFrom?: string;
  expiresOn?: string;
}

// Canonical category list. HR can still type anything in if needed.
export const COMPANY_DOC_CATEGORIES = [
  "Policy",
  "Handbook",
  "Form",
  "Notice",
  "Procedure",
  "Other",
] as const;

export const listCompanyDocuments = (token: string) =>
  apiCall<CompanyDocument[]>("/company-docs", { token });

export const hrCreateCompanyDocument = (
  token: string,
  data: CompanyDocumentPayload
) =>
  apiCall<CompanyDocument>("/hr/company-docs", {
    method: "POST",
    body: data,
    token,
  });

export const hrUpdateCompanyDocument = (
  token: string,
  id: string,
  data: Partial<CompanyDocumentPayload>
) =>
  apiCall<{ message: string }>(`/hr/company-docs/${id}`, {
    method: "PUT",
    body: data,
    token,
  });

export const hrDeleteCompanyDocument = (token: string, id: string) =>
  apiCall<{ message: string }>(`/hr/company-docs/${id}`, {
    method: "DELETE",
    token,
  });
