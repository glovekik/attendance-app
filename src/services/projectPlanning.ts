import { apiCall } from "./http";

/** A stage of a project. Progress is read off its tasks, never typed in. */
export interface ProjectPhase {
  id: string;
  projectId: string;
  name: string;
  description: string;
  order: number;
  status: "PENDING" | "ONGOING" | "COMPLETED";
  startDate?: string | null;
  endDate?: string | null;
  /** How much of the project this phase represents. */
  weight: number;
  taskCount: number;
  completedCount: number;
  /** Share of the phase's *work* done, weighted by each task's weight. */
  percent: number;
  tasks: PhaseTask[];
  /** How much of this phase's 100% its tasks have claimed. */
  taskWeightAllocated: number;
  taskWeightRemaining: number;
  taskWeightBalanced: boolean;
}

/** A task as it appears inside its phase, with the weight you can edit. */
export interface PhaseTask {
  id: string;
  title: string;
  status: "PENDING" | "ONGOING" | "COMPLETED";
  weight: number;
  priority?: string | null;
  dueDate?: string | null;
}

/**
 * Where the headline percentage came from. `derived` is always what the
 * tasks say, so a manual figure can be shown beside the real one rather
 * than quietly replacing it.
 */
export interface ProjectProgressInfo {
  percent: number;
  derived: number;
  source: "tasks" | "phases" | "manual";
  taskTotal: number;
  taskCompleted: number;
}

export interface PhasesResponse {
  phases: ProjectPhase[];
  viewerCanManage: boolean;
  progress: ProjectProgressInfo;
  /** The project's 100% budget across its phases. */
  weight: { allocated: number; remaining: number; balanced: boolean };
}

export const getProjectPhases = (token: string, projectId: string) =>
  apiCall<PhasesResponse>(`/projects/${projectId}/phases`, { token });

export const createProjectPhase = (
  token: string,
  projectId: string,
  body: { name: string; description?: string; weight?: number;
          startDate?: string | null; endDate?: string | null }
) => apiCall<{ id: string }>(`/projects/${projectId}/phases`, {
  method: "POST", body, token });

export const updateProjectPhase = (
  token: string, projectId: string, phaseId: string,
  body: Partial<{ name: string; description: string; weight: number;
                  status: ProjectPhase["status"];
                  startDate: string | null; endDate: string | null }>
) => apiCall(`/projects/${projectId}/phases/${phaseId}`, {
  method: "PUT", body, token });

export const deleteProjectPhase = (
  token: string, projectId: string, phaseId: string
) => apiCall<{ tasksUnassigned: number }>(
  `/projects/${projectId}/phases/${phaseId}`, { method: "DELETE", token });

/** Pin the project's progress, or pass null to hand it back to the tasks. */
export const setProjectProgress = (
  token: string, projectId: string, percent: number | null
) => apiCall<{ percent: number | null }>(`/projects/${projectId}/progress`, {
  method: "PUT", body: { percent }, token });

/** Change one task's weight within its phase. */
export const setTaskWeight = (
  token: string, projectId: string, taskId: string, weight: number
) => apiCall(`/projects/${projectId}/tasks/${taskId}`, {
  method: "PUT", body: { weight }, token });

// ---------------------------------------------------------------- meetings
export interface ProjectMeeting {
  id: string;
  title: string;
  date: string;
  time?: string | null;
  attendees: { id: string; name: string }[];
  attendeeIds: string[];
  externalAttendees: string;
  notes: string;
  decisions: string;
  actionItems: string;
  phaseId?: string | null;
  createdBy: string;
  createdByName: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  viewerCanEdit: boolean;
}

export const getProjectMeetings = (token: string, projectId: string) =>
  apiCall<{ meetings: ProjectMeeting[]; viewerCanManage: boolean }>(
    `/projects/${projectId}/meetings`, { token });

export type MeetingPayload = Partial<{
  title: string; date: string; time: string | null;
  attendeeIds: string[]; externalAttendees: string;
  notes: string; decisions: string; actionItems: string;
  phaseId: string | null;
}>;

export const createProjectMeeting = (
  token: string, projectId: string, body: MeetingPayload
) => apiCall<{ id: string }>(`/projects/${projectId}/meetings`, {
  method: "POST", body, token });

export const updateProjectMeeting = (
  token: string, projectId: string, meetingId: string, body: MeetingPayload
) => apiCall(`/projects/${projectId}/meetings/${meetingId}`, {
  method: "PUT", body, token });

export const deleteProjectMeeting = (
  token: string, projectId: string, meetingId: string
) => apiCall(`/projects/${projectId}/meetings/${meetingId}`, {
  method: "DELETE", token });
