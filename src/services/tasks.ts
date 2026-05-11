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

// TL endpoints
export const createTask = (
  token: string,
  teamId: string,
  data: CreateTaskPayload
) =>
  apiCall<{ id: string; message: string }>(
    `/tl/teams/${teamId}/tasks`,
    { method: "POST", body: data, token }
  );

export const getTeamTasks = (
  token: string,
  teamId: string
) =>
  apiCall<Task[]>(`/tl/teams/${teamId}/tasks`, { token });

export const updateTask = (
  token: string,
  id: string,
  data: UpdateTaskPayload
) =>
  apiCall<{ message: string }>(`/tl/tasks/${id}`, {
    method: "PUT",
    body: data,
    token,
  });

export const deleteTask = (
  token: string,
  id: string
) =>
  apiCall<{ message: string }>(`/tl/tasks/${id}`, {
    method: "DELETE",
    token,
  });

// User endpoints
export const getMyTasks = (
  token: string,
  opts?: {
    status?: TaskStatus;
    before?: string;
    limit?: number;
  }
) => {
  const parts: string[] = [];
  if (opts?.status) parts.push(`status=${opts.status}`);
  if (opts?.before)
    parts.push(`before=${encodeURIComponent(opts.before)}`);
  if (opts?.limit) parts.push(`limit=${opts.limit}`);
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
