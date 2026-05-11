import { apiCall } from "./http";
import { Department } from "../types";

export interface DepartmentPayload {
  name: string;
  description?: string;
  headUserId?: string | null;
}

export const listDepartments = (token: string): Promise<Department[]> =>
  apiCall("/departments", { token });

export const getDepartment = (
  token: string,
  id: string
): Promise<Department> => apiCall(`/hr/departments/${id}`, { token });

export const createDepartment = (
  token: string,
  payload: DepartmentPayload
): Promise<Department> =>
  apiCall("/hr/departments", { method: "POST", body: payload, token });

export const updateDepartment = (
  token: string,
  id: string,
  payload: Partial<DepartmentPayload>
): Promise<Department> =>
  apiCall(`/hr/departments/${id}`, {
    method: "PUT",
    body: payload,
    token,
  });

export const deleteDepartment = (
  token: string,
  id: string
): Promise<void> =>
  apiCall(`/hr/departments/${id}`, { method: "DELETE", token });
