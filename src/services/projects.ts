import { apiCall } from "./http";
import {
  Project,
  ProjectMember,
  ProjectMemberHistoryEntry,
  ProjectStatus,
  Task,
  TaskPriority,
  TaskStatus,
} from "../types";

export interface ProjectPayload {
  name: string;
  code: string;
  description?: string;
  departmentId?: string | null;
  managerIds?: string[];
  memberIds?: string[];
  status?: ProjectStatus;
  startDate?: string;
  endDate?: string | null;
}

export const listProjects = (token: string): Promise<Project[]> =>
  apiCall("/projects", { token });

/** Projects the signed-in user is currently on. */
export const listMyProjects = (
  token: string,
  includePast = false
): Promise<Project[]> =>
  apiCall(`/projects/mine${includePast ? "?include_past=true" : ""}`, {
    token,
  });

export const getProject = (
  token: string,
  id: string
): Promise<Project> => apiCall(`/projects/${id}`, { token });

export const getHrProject = (
  token: string,
  id: string
): Promise<Project> => apiCall(`/hr/projects/${id}`, { token });

export const createProject = (
  token: string,
  payload: ProjectPayload
): Promise<Project> =>
  apiCall("/hr/projects", { method: "POST", body: payload, token });

export const updateProject = (
  token: string,
  id: string,
  payload: Partial<ProjectPayload>
): Promise<Project> =>
  apiCall(`/hr/projects/${id}`, {
    method: "PUT",
    body: payload,
    token,
  });

export const deleteProject = (
  token: string,
  id: string
): Promise<void> =>
  apiCall(`/hr/projects/${id}`, { method: "DELETE", token });

/**
 * Current roster, or the roster as it stood on `asOf` (YYYY-MM-DD).
 * Membership is date-ranged, so past dates return who was actually on the
 * project then — not today's list.
 */
export const getProjectMembers = (
  token: string,
  id: string,
  asOf?: string
): Promise<{ asOf: string | null; members: ProjectMember[] }> =>
  apiCall(`/projects/${id}/members${asOf ? `?asOf=${asOf}` : ""}`, { token });

/** Every stay ever recorded on the project, newest first. */
export const getProjectMemberHistory = (
  token: string,
  id: string
): Promise<{ history: ProjectMemberHistoryEntry[] }> =>
  apiCall(`/projects/${id}/members/history`, { token });

export interface ProjectTasksResponse {
  tasks: (Task & {
    assignee?: { id: string; name?: string | null } | null;
    createdByUser?: { id: string; name?: string | null } | null;
  })[];
  /** Counts span the whole project, not the filtered slice. */
  counts: Record<"PENDING" | "ONGOING" | "COMPLETED", number>;
  total: number;
}

/** Every task on a project, plus a status breakdown for the board. */
export const getProjectTasks = (
  token: string,
  id: string,
  opts?: { status?: TaskStatus; assigneeId?: string }
): Promise<ProjectTasksResponse> => {
  const parts: string[] = [];
  if (opts?.status) parts.push(`status=${opts.status}`);
  if (opts?.assigneeId) parts.push(`assigneeId=${opts.assigneeId}`);
  const qs = parts.length ? `?${parts.join("&")}` : "";
  return apiCall(`/projects/${id}/tasks${qs}`, { token });
};

// ===== PROJECT-MANAGER WRITES =====
// These are scoped to one project: the caller must be a current manager of
// it (HR always is). A plain USER who manages a project gets these; a
// MANAGER who doesn't manage it does not.

export interface ProjectTaskPayload {
  title: string;
  description?: string;
  assigneeId: string;
  /** PM can move a task through the board directly. */
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
  reminderIntervalMinutes?: number;
  attachments?: string[];
}

export const createProjectTask = (
  token: string,
  projectId: string,
  payload: ProjectTaskPayload
): Promise<{ id: string; message: string }> =>
  apiCall(`/projects/${projectId}/tasks`, {
    method: "POST",
    body: payload,
    token,
  });

export const updateProjectTask = (
  token: string,
  projectId: string,
  taskId: string,
  payload: Partial<ProjectTaskPayload>
): Promise<{ message: string }> =>
  apiCall(`/projects/${projectId}/tasks/${taskId}`, {
    method: "PUT",
    body: payload,
    token,
  });

export const deleteProjectTask = (
  token: string,
  projectId: string,
  taskId: string
): Promise<{ message: string }> =>
  apiCall(`/projects/${projectId}/tasks/${taskId}`, {
    method: "DELETE",
    token,
  });

export interface ProjectAttendanceRow {
  id: string;
  userId: string;
  user?: { id: string; name?: string | null; profilePictureUrl?: string | null } | null;
  date: string;
  attendanceType?: string | null;
  status?: string | null;
  isLate?: boolean;
  hoursWorked?: number;
  overtimeHours?: number;
  halfDay?: boolean;
  checkIn?: string | null;
  checkOut?: string | null;
  workNotes?: string;
}

export interface ProjectAttendanceResponse {
  /** Every current member, so "absent" can be told apart from "not loaded". */
  members: { id: string; name?: string | null; profilePictureUrl?: string | null }[];
  records: ProjectAttendanceRow[];
}

/** Attendance for the project's current members. Manager-only. */
export const getProjectAttendance = (
  token: string,
  projectId: string,
  opts?: { date?: string; month?: string; userId?: string }
): Promise<ProjectAttendanceResponse> => {
  const parts: string[] = [];
  if (opts?.date) parts.push(`date=${opts.date}`);
  if (opts?.month) parts.push(`month=${opts.month}`);
  if (opts?.userId) parts.push(`userId=${opts.userId}`);
  const qs = parts.length ? `?${parts.join("&")}` : "";
  return apiCall(`/projects/${projectId}/attendance${qs}`, { token });
};
