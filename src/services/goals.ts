import { apiCall } from "./http";
import { Goal, GoalStatus } from "../types";

export interface GoalPayload {
  userId: string;
  title: string;
  description?: string;
  dueDate?: string;
  targetValue?: number;
  unit?: string;
  weight?: number;
}

export const createManagerGoal = (
  token: string,
  payload: GoalPayload
): Promise<Goal> =>
  apiCall("/manager/goals", {
    method: "POST",
    body: payload,
    token,
  });

export const listManagerGoals = (
  token: string,
  opts: { userId?: string; status?: GoalStatus } = {}
): Promise<Goal[]> => {
  const params = new URLSearchParams();
  if (opts.userId) params.set("userId", opts.userId);
  if (opts.status) params.set("status", opts.status);
  const qs = params.toString();
  return apiCall(`/manager/goals${qs ? `?${qs}` : ""}`, { token });
};

export const updateManagerGoal = (
  token: string,
  id: string,
  payload: Partial<GoalPayload> & { status?: GoalStatus }
): Promise<Goal> =>
  apiCall(`/manager/goals/${id}`, {
    method: "PUT",
    body: payload,
    token,
  });

export const listMyGoals = (
  token: string,
  status?: GoalStatus
): Promise<Goal[]> => {
  const qs = status ? `?status=${status}` : "";
  return apiCall(`/goals/mine${qs}`, { token });
};

export const addGoalProgress = (
  token: string,
  id: string,
  achievedValue: number,
  note?: string
): Promise<Goal> =>
  apiCall(`/goals/${id}/progress`, {
    method: "POST",
    body: { achievedValue, note },
    token,
  });

export const listHrGoals = (
  token: string,
  opts: { userId?: string; status?: GoalStatus } = {}
): Promise<Goal[]> => {
  const params = new URLSearchParams();
  if (opts.userId) params.set("userId", opts.userId);
  if (opts.status) params.set("status", opts.status);
  const qs = params.toString();
  return apiCall(`/hr/goals${qs ? `?${qs}` : ""}`, { token });
};
