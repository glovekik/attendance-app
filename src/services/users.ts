import { apiCall } from "./http";
import {
  BankAccount,
  ContractInfo,
  EmergencyContact,
  PersonalInfo,
  ProfileDocuments,
  Role,
  Statutory,
  User,
  UserStatus,
  UserTag,
  WorkInfo,
} from "../types";

// Nested-object payload accepted by POST/PUT /hr/users.
// All sub-objects optional; every field within is optional too.
export interface ExpandedProfilePayload {
  // Basic
  tag?: UserTag;
  employeeCode?: string;
  workPhone?: string;
  joiningDate?: string;
  status?: UserStatus;
  profilePictureUrl?: string;
  // Org
  departmentId?: string | null;
  reportingManagerId?: string | null;
  projectManagerIds?: string[];
  // Nested
  work?: WorkInfo;
  personal?: PersonalInfo;
  bankAccounts?: BankAccount[];
  emergencyContact?: EmergencyContact;
  documents?: ProfileDocuments;
  statutory?: Statutory;
  contract?: ContractInfo;
}

export interface CreateUserPayload extends ExpandedProfilePayload {
  name: string;
  email: string;
  password: string;
  role?: Role;
}

export interface UpdateUserPayload extends ExpandedProfilePayload {
  name?: string;
  role?: Role;
}

export const createUser = (
  token: string,
  data: CreateUserPayload
) =>
  apiCall<{ id: string; message: string }>("/hr/users", {
    method: "POST",
    body: data,
    token,
  });

export const listUsers = (
  token: string,
  search?: string
) => {
  const qs = search
    ? `?search=${encodeURIComponent(search)}`
    : "";
  return apiCall<User[]>(`/hr/users${qs}`, { token });
};

export const getUser = (token: string, id: string) =>
  apiCall<User>(`/hr/users/${id}`, { token });

export const updateUser = (
  token: string,
  id: string,
  data: UpdateUserPayload
) =>
  apiCall<{ message: string }>(`/hr/users/${id}`, {
    method: "PUT",
    body: data,
    token,
  });
