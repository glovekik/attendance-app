import { apiCall } from "./http";
import { EmployeeDocument } from "../types";

export interface DocumentPayload {
  category: string;
  fileName: string;
  fileUrl: string;
  notes?: string;
  expiresOn?: string;
}

// Canonical doc category list shared by HR and employee views.
export const DOC_CATEGORIES = [
  "Aadhaar",
  "PAN",
  "Resume",
  "Offer Letter",
  "Experience Letter",
  "10th",
  "Inter",
  "UG",
  "PG",
  "PhD",
  "Passport",
  "Salary Slip",
  "Certification",
] as const;

export const listMyDocuments = (
  token: string,
  category?: string
): Promise<EmployeeDocument[]> => {
  const qs = category ? `?category=${encodeURIComponent(category)}` : "";
  return apiCall(`/me/documents${qs}`, { token });
};

export const addMyDocument = (
  token: string,
  payload: DocumentPayload
): Promise<EmployeeDocument> =>
  apiCall("/me/documents", { method: "POST", body: payload, token });

export const deleteMyDocument = (
  token: string,
  id: string
): Promise<void> =>
  apiCall(`/me/documents/${id}`, { method: "DELETE", token });

export const listUserDocuments = (
  token: string,
  userId: string,
  category?: string
): Promise<EmployeeDocument[]> => {
  const qs = category ? `?category=${encodeURIComponent(category)}` : "";
  return apiCall(`/hr/users/${userId}/documents${qs}`, { token });
};

export const addUserDocument = (
  token: string,
  userId: string,
  payload: DocumentPayload
): Promise<EmployeeDocument> =>
  apiCall(`/hr/users/${userId}/documents`, {
    method: "POST",
    body: payload,
    token,
  });

export const deleteUserDocument = (
  token: string,
  userId: string,
  id: string
): Promise<void> =>
  apiCall(`/hr/users/${userId}/documents/${id}`, {
    method: "DELETE",
    token,
  });

// Required-documents flow (HR sets a checklist, employee uploads against
// each row, HR verifies). Mounted under the same /me/documents prefix.
export type RequiredDocStatus = "PENDING" | "UPLOADED" | "VERIFIED";

export interface RequiredDocument {
  category: string;
  status: RequiredDocStatus;
  note?: string;
  documentId?: string;
  uploadedAt?: string;
  verifiedAt?: string;
  verifiedBy?: string;
}

export const listMyRequiredDocuments = (
  token: string
): Promise<RequiredDocument[]> =>
  apiCall(`/me/documents/required`, { token });

export const listUserRequiredDocuments = (
  token: string,
  userId: string
): Promise<RequiredDocument[]> =>
  apiCall(`/hr/users/${userId}/required-documents`, { token });

export const setUserRequiredDocuments = (
  token: string,
  userId: string,
  categories: string[]
): Promise<RequiredDocument[]> =>
  // Backend expects items: [{category, note?}] not a bare string array.
  apiCall(`/hr/users/${userId}/required-documents`, {
    method: "PUT",
    body: { items: categories.map((c) => ({ category: c })) },
    token,
  });

export const verifyUserRequiredDocument = (
  token: string,
  userId: string,
  category: string
): Promise<RequiredDocument> =>
  apiCall(
    `/hr/users/${userId}/required-documents/${encodeURIComponent(category)}/verify`,
    { method: "POST", token }
  );
