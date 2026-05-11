import { apiCall } from "./http";
import { Candidate, CandidateSource, CandidateStage } from "../types";

export interface CandidatePayload {
  name: string;
  email: string;
  phone?: string;
  jobOpeningId?: string;
  resumeUrl?: string;
  source?: CandidateSource;
  referredByUserId?: string;
  currentCompany?: string;
  currentSalary?: number;
  expectedSalary?: number;
  noticePeriodDays?: number;
  notes?: string;
}

export const listCandidates = (
  token: string,
  opts: {
    stage?: CandidateStage;
    jobOpeningId?: string;
    search?: string;
  } = {}
): Promise<Candidate[]> => {
  const params = new URLSearchParams();
  if (opts.stage) params.set("stage", opts.stage);
  if (opts.jobOpeningId) params.set("jobOpeningId", opts.jobOpeningId);
  if (opts.search) params.set("search", opts.search);
  const qs = params.toString();
  return apiCall(`/hr/candidates${qs ? `?${qs}` : ""}`, { token });
};

export const getCandidate = (
  token: string,
  id: string
): Promise<Candidate> => apiCall(`/hr/candidates/${id}`, { token });

export const createCandidate = (
  token: string,
  payload: CandidatePayload
): Promise<Candidate> =>
  apiCall("/hr/candidates", { method: "POST", body: payload, token });

export const updateCandidate = (
  token: string,
  id: string,
  payload: Partial<CandidatePayload>
): Promise<Candidate> =>
  apiCall(`/hr/candidates/${id}`, {
    method: "PUT",
    body: payload,
    token,
  });

export const deleteCandidate = (
  token: string,
  id: string
): Promise<void> =>
  apiCall(`/hr/candidates/${id}`, { method: "DELETE", token });

export const moveCandidate = (
  token: string,
  id: string,
  stage: CandidateStage,
  note?: string
): Promise<Candidate> =>
  apiCall(`/hr/candidates/${id}/move`, {
    method: "POST",
    body: { stage, note },
    token,
  });
