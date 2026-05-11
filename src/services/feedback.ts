import { apiCall } from "./http";
import { FeedbackItem, FeedbackType } from "../types";

export interface FeedbackPayload {
  toUserId: string;
  type: FeedbackType;
  text: string;
  anonymous?: boolean;
}

export const sendFeedback = (
  token: string,
  payload: FeedbackPayload
): Promise<FeedbackItem> =>
  apiCall("/feedback", { method: "POST", body: payload, token });

export const listFeedbackAboutMe = (
  token: string,
  type?: FeedbackType
): Promise<FeedbackItem[]> => {
  const qs = type ? `?type=${type}` : "";
  return apiCall(`/feedback/about-me${qs}`, { token });
};

export const listFeedbackSent = (
  token: string
): Promise<FeedbackItem[]> => apiCall("/feedback/sent", { token });

export const listHrFeedback = (
  token: string,
  opts: { toUserId?: string; type?: FeedbackType } = {}
): Promise<FeedbackItem[]> => {
  const params = new URLSearchParams();
  if (opts.toUserId) params.set("toUserId", opts.toUserId);
  if (opts.type) params.set("type", opts.type);
  const qs = params.toString();
  return apiCall(`/hr/feedback${qs ? `?${qs}` : ""}`, { token });
};
