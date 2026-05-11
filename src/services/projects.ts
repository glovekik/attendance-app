import { apiCall } from "./http";
import { Project, ProjectStatus } from "../types";

export interface ProjectPayload {
  name: string;
  code: string;
  description?: string;
  departmentId?: string | null;
  projectManagerIds?: string[];
  memberIds?: string[];
  status?: ProjectStatus;
  startDate?: string;
  endDate?: string | null;
  billable?: boolean;
}

export const listProjects = (token: string): Promise<Project[]> =>
  apiCall("/projects", { token });

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
