import { apiCall } from "./http";
import { ChatMessage } from "../types";

interface ListOpts {
  before?: string;
  limit?: number;
}

const buildQs = (opts?: ListOpts) => {
  if (!opts) return "";
  const parts: string[] = [];
  if (opts.before) parts.push(`before=${encodeURIComponent(opts.before)}`);
  if (opts.limit) parts.push(`limit=${opts.limit}`);
  return parts.length ? `?${parts.join("&")}` : "";
};

// ===== TEAM CHAT =====
export const listTeamMessages = (
  token: string,
  teamId: string,
  opts?: ListOpts
) =>
  apiCall<ChatMessage[]>(
    `/teams/${teamId}/messages${buildQs(opts)}`,
    { token }
  );

export const sendTeamMessage = (
  token: string,
  teamId: string,
  text: string
) =>
  apiCall<ChatMessage>(`/teams/${teamId}/messages`, {
    method: "POST",
    body: { text },
    token,
  });

export const deleteTeamMessage = (
  token: string,
  teamId: string,
  messageId: string
) =>
  apiCall<{ message: string }>(
    `/teams/${teamId}/messages/${messageId}`,
    { method: "DELETE", token }
  );

// ===== OFFICE CHAT =====
export const listOfficeMessages = (
  token: string,
  opts?: ListOpts
) =>
  apiCall<ChatMessage[]>(
    `/office/messages${buildQs(opts)}`,
    { token }
  );

export const sendOfficeMessage = (
  token: string,
  text: string
) =>
  apiCall<ChatMessage>(`/office/messages`, {
    method: "POST",
    body: { text },
    token,
  });

export const deleteOfficeMessage = (
  token: string,
  messageId: string
) =>
  apiCall<{ message: string }>(
    `/office/messages/${messageId}`,
    { method: "DELETE", token }
  );
