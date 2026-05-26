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
  // Basic — `tag` is now free text (Designation field). The UserTag
  // union is kept as a type hint but the wire format accepts any string.
  tag?: UserTag | string;
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
  // Captured when HR terminates a user — server stamps terminatedAt/By.
  terminationReason?: string;
}

export interface CreateUserPayload extends ExpandedProfilePayload {
  name: string;
  email: string;
  password: string;
  role?: Role;
  // Optional list of AVAILABLE asset IDs to assign to the new employee
  // at create time. Backend returns `assignedAssetIds` + `assetErrors`.
  initialAssetIds?: string[];
}

export interface CreateUserResponse {
  id: string;
  message: string;
  employeeCode?: string;
  assignedAssetIds?: string[];
  assetErrors?: { assetId: string; reason: string }[];
}

export interface UpdateUserPayload extends ExpandedProfilePayload {
  name?: string;
  role?: Role;
}

export const createUser = (
  token: string,
  data: CreateUserPayload
) =>
  apiCall<CreateUserResponse>("/hr/users", {
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

// ===== Employee self-service profile =====
// The employee can read their own profile and fill in personal details
// HR left blank. The backend ignores writes to already-filled fields.
export interface MyProfile {
  id: string;
  name: string;
  email: string;
  role: Role;
  employeeCode?: string;
  workPhone?: string;
  joiningDate?: string;
  status?: UserStatus;
  profilePictureUrl?: string;
  personal?: PersonalInfo;
  emergencyContact?: EmergencyContact;
  bankAccounts?: BankAccount[];
  statutory?: Statutory;
}

// Only the editable sub-objects are accepted by PUT /me/profile.
export interface MyProfileUpdate {
  personal?: PersonalInfo;
  emergencyContact?: EmergencyContact;
}

export const getMyProfile = (token: string) =>
  apiCall<MyProfile>("/me/profile", { token });

export const updateMyProfile = (token: string, data: MyProfileUpdate) =>
  apiCall<MyProfile & { updatedFields: string[] }>("/me/profile", {
    method: "PUT",
    body: data,
    token,
  });

// Every authenticated user can replace or clear their own profile
// picture. Pass null to remove. Separate from updateMyProfile so the
// "fill-blanks only" rule there doesn't lock the picture.
export const updateMyProfilePicture = (
  token: string,
  url: string | null
) =>
  apiCall<MyProfile>("/me/profile-picture", {
    method: "PUT",
    body: { url },
    token,
  });

// Lightweight directory available to all authenticated users — used for
// @-mention pickers and other people-search UIs. Does not require HR.
export interface DirectoryUser {
  id: string;
  name: string;
  email: string;
  tag?: string;
}

export interface DirectoryPage {
  items: DirectoryUser[];
  nextCursor: string | null;
}

export const listUserDirectory = (
  token: string,
  search?: string,
  opts?: { cursor?: string; limit?: number }
) => {
  const parts: string[] = [];
  if (search) parts.push(`search=${encodeURIComponent(search)}`);
  if (opts?.cursor) parts.push(`cursor=${encodeURIComponent(opts.cursor)}`);
  if (opts?.limit) parts.push(`limit=${opts.limit}`);
  const qs = parts.length ? `?${parts.join("&")}` : "";
  return apiCall<DirectoryPage>(`/users/directory${qs}`, { token });
};
