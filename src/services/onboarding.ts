import { apiCall } from "./http";
import { Onboarding, OnboardingStatus } from "../types";

// HR
export const hrCreateOnboarding = (
  token: string,
  userId: string
) =>
  apiCall<Onboarding>("/hr/onboardings", {
    method: "POST",
    body: { userId },
    token,
  });

export const hrListOnboardings = (
  token: string,
  status?: OnboardingStatus
) => {
  const qs = status ? `?status=${status}` : "";
  return apiCall<Onboarding[]>(`/hr/onboardings${qs}`, { token });
};

export const hrGetOnboarding = (token: string, id: string) =>
  apiCall<Onboarding>(`/hr/onboardings/${id}`, { token });

export const hrSendWelcomeEmail = (
  token: string,
  id: string
) =>
  apiCall<{ message: string }>(
    `/hr/onboardings/${id}/welcome-email`,
    { method: "POST", token }
  );

export const hrSetDocumentStatus = (
  token: string,
  id: string,
  data: { documentId: string; status: string; note?: string }
) =>
  apiCall<Onboarding>(
    `/hr/onboardings/${id}/document-status`,
    { method: "PUT", body: data, token }
  );

export const hrSetHRTaskStatus = (
  token: string,
  id: string,
  data: { taskId: string; status: string; note?: string }
) =>
  apiCall<Onboarding>(`/hr/onboardings/${id}/hr-task-status`, {
    method: "PUT",
    body: data,
    token,
  });

export const hrCompleteOnboarding = (
  token: string,
  id: string
) =>
  apiCall<{ message: string }>(
    `/hr/onboardings/${id}/complete`,
    { method: "POST", token }
  );

export const hrDeleteOnboarding = (
  token: string,
  id: string
) =>
  apiCall<{ message: string }>(`/hr/onboardings/${id}`, {
    method: "DELETE",
    token,
  });

// USER
export const getMyOnboarding = (token: string) =>
  apiCall<Onboarding | null>("/onboarding/mine", { token });

// Both of these mutation endpoints reply with just { message } — they do
// NOT echo back the updated Onboarding. Callers must re-fetch via
// getMyOnboarding() to refresh the screen.
export const uploadOnboardingDocument = (
  token: string,
  data: { documentId: string; fileUrl: string }
) =>
  apiCall<{ message: string }>("/onboarding/document-upload", {
    method: "POST",
    body: data,
    token,
  });

export const setMyTaskStatus = (
  token: string,
  data: { taskId: string; status: string; note?: string }
) =>
  apiCall<{ message: string }>("/onboarding/employee-task-status", {
    method: "PUT",
    body: data,
    token,
  });
