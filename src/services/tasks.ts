import { apiCall } from "./http";
import { Task, TaskPriority, TaskStatus } from "../types";

export interface CreateTaskPayload {
  title: string;
  description?: string;
  assigneeId: string;
  priority?: TaskPriority;
  reminderIntervalMinutes?: number;
  dueDate?: string;
  attachments?: string[];
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string;
  assigneeId?: string;
  priority?: TaskPriority;
  reminderIntervalMinutes?: number;
  dueDate?: string;
  attachments?: string[];
}

// User endpoints
export const getMyTasks = (
  token: string,
  opts?: {
    status?: TaskStatus;
    before?: string;
    limit?: number;
    /** Filter to one project; "none" for tasks with no project. */
    projectId?: string;
  }
) => {
  const parts: string[] = [];
  if (opts?.status) parts.push(`status=${opts.status}`);
  if (opts?.before)
    parts.push(`before=${encodeURIComponent(opts.before)}`);
  if (opts?.limit) parts.push(`limit=${opts.limit}`);
  if (opts?.projectId) parts.push(`projectId=${opts.projectId}`);
  const qs = parts.length ? `?${parts.join("&")}` : "";
  return apiCall<Task[]>(`/tasks/my${qs}`, { token });
};

export const startTask = (
  token: string,
  id: string
) =>
  apiCall<{ message: string }>(
    `/tasks/${id}/start`,
    { method: "POST", token }
  );

export const completeTask = (
  token: string,
  id: string
) =>
  apiCall<{ message: string }>(
    `/tasks/${id}/complete`,
    { method: "POST", token }
  );

export const uncompleteTask = (
  token: string,
  id: string
) =>
  apiCall<{ message: string }>(
    `/tasks/${id}/uncomplete`,
    { method: "POST", token }
  );

export const getTask = (
  token: string,
  id: string
) =>
  apiCall<Task>(`/tasks/${id}`, { token });
