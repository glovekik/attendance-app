import { apiCall } from "./http";
import {
  EmploymentType,
  JobOpening,
  JobOpeningStatus,
} from "../types";

export interface JobOpeningPayload {
  title: string;
  departmentId?: string | null;
  location?: string;
  employmentType?: EmploymentType;
  description?: string;
  requirements?: string;
  salaryMin?: number;
  salaryMax?: number;
  openings?: number;
  status?: JobOpeningStatus;
}

export const listJobOpenings = (
  token: string,
  status?: JobOpeningStatus
): Promise<JobOpening[]> => {
  const qs = status ? `?status=${status}` : "";
  return apiCall(`/hr/job-openings${qs}`, { token });
};

export const getJobOpening = (
  token: string,
  id: string
): Promise<JobOpening> => apiCall(`/hr/job-openings/${id}`, { token });

export const createJobOpening = (
  token: string,
  payload: JobOpeningPayload
): Promise<JobOpening> =>
  apiCall("/hr/job-openings", {
    method: "POST",
    body: payload,
    token,
  });

export const updateJobOpening = (
  token: string,
  id: string,
  payload: Partial<JobOpeningPayload>
): Promise<JobOpening> =>
  apiCall(`/hr/job-openings/${id}`, {
    method: "PUT",
    body: payload,
    token,
  });

export const deleteJobOpening = (
  token: string,
  id: string
): Promise<void> =>
  apiCall(`/hr/job-openings/${id}`, { method: "DELETE", token });
