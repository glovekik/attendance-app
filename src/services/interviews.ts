import { apiCall } from "./http";
import {
  Interview,
  InterviewMode,
  InterviewRecommendation,
  InterviewStatus,
} from "../types";

export interface InterviewPayload {
  candidateId: string;
  scheduledAt: string;
  durationMinutes?: number;
  mode?: InterviewMode;
  location?: string;
  interviewerIds: string[];
  round?: string;
  notes?: string;
}

export interface FeedbackPayload {
  rating: number;
  recommendation: InterviewRecommendation;
  strengths?: string;
  concerns?: string;
  notes?: string;
}

export const listHrInterviews = (
  token: string,
  opts: { candidateId?: string; status?: InterviewStatus } = {}
): Promise<Interview[]> => {
  const params = new URLSearchParams();
  if (opts.candidateId) params.set("candidateId", opts.candidateId);
  if (opts.status) params.set("status", opts.status);
  const qs = params.toString();
  return apiCall(`/hr/interviews${qs ? `?${qs}` : ""}`, { token });
};

export const listMyInterviews = (
  token: string
): Promise<Interview[]> => apiCall("/interviews/mine", { token });

export const createInterview = (
  token: string,
  payload: InterviewPayload
): Promise<Interview> =>
  apiCall("/hr/interviews", { method: "POST", body: payload, token });

export const updateInterview = (
  token: string,
  id: string,
  payload: Partial<InterviewPayload>
): Promise<Interview> =>
  apiCall(`/hr/interviews/${id}`, {
    method: "PUT",
    body: payload,
    token,
  });

export const submitFeedback = (
  token: string,
  id: string,
  payload: FeedbackPayload
): Promise<{ message: string }> =>
  apiCall(`/hr/interviews/${id}/feedback`, {
    method: "POST",
    body: payload,
    token,
  });
