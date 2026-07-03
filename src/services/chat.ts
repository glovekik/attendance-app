import { apiCall } from "./http";
import { ChatMessage, ChatAttachment } from "../types";

export type DeleteScope = "me" | "everyone";

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
  text: string,
  mentions?: string[],
  attachments?: ChatAttachment[]
) =>
  apiCall<ChatMessage>(`/teams/${teamId}/messages`, {
    method: "POST",
    body: {
      text,
      ...(mentions && mentions.length ? { mentions } : {}),
      ...(attachments && attachments.length ? { attachments } : {}),
    },
    token,
  });

export const editTeamMessage = (
  token: string,
  teamId: string,
  messageId: string,
  text: string,
  mentions?: string[]
) =>
  apiCall<ChatMessage>(`/teams/${teamId}/messages/${messageId}`, {
    method: "PUT",
    body: { text, ...(mentions && mentions.length ? { mentions } : {}) },
    token,
  });

export const deleteTeamMessage = (
  token: string,
  teamId: string,
  messageId: string,
  scope: DeleteScope = "everyone"
) =>
  apiCall<{ message: string }>(
    `/teams/${teamId}/messages/${messageId}?scope=${scope}`,
    { method: "DELETE", token }
  );

export const markTeamReadReceipt = (token: string, teamId: string) =>
  apiCall<{ message: string }>(`/teams/${teamId}/messages/read`, {
    method: "POST",
    token,
  });

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
  text: string,
  mentions?: string[],
  attachments?: ChatAttachment[]
) =>
  apiCall<ChatMessage>(`/office/messages`, {
    method: "POST",
    body: {
      text,
      ...(mentions && mentions.length ? { mentions } : {}),
      ...(attachments && attachments.length ? { attachments } : {}),
    },
    token,
  });

export const editOfficeMessage = (
  token: string,
  messageId: string,
  text: string,
  mentions?: string[]
) =>
  apiCall<ChatMessage>(`/office/messages/${messageId}`, {
    method: "PUT",
    body: { text, ...(mentions && mentions.length ? { mentions } : {}) },
    token,
  });

export const deleteOfficeMessage = (
  token: string,
  messageId: string,
  scope: DeleteScope = "everyone"
) =>
  apiCall<{ message: string }>(
    `/office/messages/${messageId}?scope=${scope}`,
    { method: "DELETE", token }
  );

export const markOfficeReadReceipt = (token: string) =>
  apiCall<{ message: string }>(`/office/messages/read`, {
    method: "POST",
    token,
  });

// ===== UNREAD (team chat) =====
// Count of team-chat messages posted since the user last opened a team
// chat — drives the badge on the dashboard Chat tile.
export const getChatUnreadCount = (
  token: string
): Promise<{ count: number }> =>
  apiCall(`/me/chat-unread`, { token });

// Clears the unread badge — called when a team chat is opened.
export const markChatRead = (
  token: string
): Promise<{ ok: boolean }> =>
  apiCall(`/me/chat-read`, { method: "POST", token });
