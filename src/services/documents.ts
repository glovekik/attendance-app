import { apiCall } from "./http";
import { EmployeeDocument } from "../types";

export interface DocumentPayload {
  category: string;
  fileName: string;
  fileUrl: string;
  notes?: string;
  expiresOn?: string;
}

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
