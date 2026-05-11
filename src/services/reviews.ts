import { apiCall } from "./http";
import {
  Review,
  ReviewManagerEval,
  ReviewSelfEval,
  ReviewStatus,
  ReviewType,
} from "../types";

export interface ReviewCreatePayload {
  employeeId: string;
  type: ReviewType;
  periodStart: string;
  periodEnd: string;
  dimensions?: string[];
}

export const createManagerReview = (
  token: string,
  payload: ReviewCreatePayload
): Promise<Review> =>
  apiCall("/manager/reviews", {
    method: "POST",
    body: payload,
    token,
  });

export const submitSelfEval = (
  token: string,
  id: string,
  payload: ReviewSelfEval
): Promise<Review> =>
  apiCall(`/reviews/${id}/self-eval`, {
    method: "POST",
    body: payload,
    token,
  });

export const submitManagerEval = (
  token: string,
  id: string,
  payload: ReviewManagerEval
): Promise<Review> =>
  apiCall(`/manager/reviews/${id}/manager-eval`, {
    method: "POST",
    body: payload,
    token,
  });

export const submitReview = (
  token: string,
  id: string
): Promise<Review> =>
  apiCall(`/manager/reviews/${id}/submit`, {
    method: "POST",
    token,
  });

export const acknowledgeReview = (
  token: string,
  id: string
): Promise<Review> =>
  apiCall(`/reviews/${id}/acknowledge`, {
    method: "POST",
    token,
  });

export const listMyReviews = (token: string): Promise<Review[]> =>
  apiCall("/reviews/mine", { token });

export const listHrReviews = (
  token: string,
  opts: { employeeId?: string; status?: ReviewStatus } = {}
): Promise<Review[]> => {
  const params = new URLSearchParams();
  if (opts.employeeId) params.set("employeeId", opts.employeeId);
  if (opts.status) params.set("status", opts.status);
  const qs = params.toString();
  return apiCall(`/hr/reviews${qs ? `?${qs}` : ""}`, { token });
};
