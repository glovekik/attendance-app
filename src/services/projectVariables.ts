import { apiCall } from "./http";

/**
 * Project Variables — reusable snippets stored against a project.
 *
 * Permissions are enforced per file on the server; these types mirror what it
 * returns. `content` is deliberately absent from the list response — it is
 * fetched when a file is opened, so a restricted snippet never travels to a
 * client that isn't allowed to read it.
 */
export type VariableVisibility = "managers" | "selected" | "team";

export interface ProjectVariableSummary {
  id: string;
  projectId: string;
  fileName: string;
  language?: string | null;
  description?: string;
  visibility: VariableVisibility;
  createdBy?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  lineCount: number;
  viewerCanManage: boolean;
  /** Only returned to someone who can manage the file. */
  allowedUserIds?: string[];
}

export interface ProjectVariable extends ProjectVariableSummary {
  content: string;
}

export interface ProjectVariablePayload {
  fileName?: string;
  content?: string;
  language?: string | null;
  description?: string | null;
  visibility?: VariableVisibility;
  allowedUserIds?: string[];
}

export const listProjectVariables = (
  token: string,
  projectId: string
): Promise<{
  variables: ProjectVariableSummary[];
  viewerCanManage: boolean;
}> => apiCall(`/projects/${projectId}/variables`, { token });

export const getProjectVariable = (
  token: string,
  projectId: string,
  variableId: string
): Promise<ProjectVariable> =>
  apiCall(`/projects/${projectId}/variables/${variableId}`, { token });

export const createProjectVariable = (
  token: string,
  projectId: string,
  body: ProjectVariablePayload
): Promise<{ id: string; message: string }> =>
  apiCall(`/projects/${projectId}/variables`, {
    method: "POST",
    body,
    token,
  });

export const updateProjectVariable = (
  token: string,
  projectId: string,
  variableId: string,
  body: ProjectVariablePayload
): Promise<{ message: string }> =>
  apiCall(`/projects/${projectId}/variables/${variableId}`, {
    method: "PUT",
    body,
    token,
  });

export const deleteProjectVariable = (
  token: string,
  projectId: string,
  variableId: string
): Promise<{ message: string }> =>
  apiCall(`/projects/${projectId}/variables/${variableId}`, {
    method: "DELETE",
    token,
  });
