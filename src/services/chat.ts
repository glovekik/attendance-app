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
export const listProjectMessages = (
  token: string,
  projectId: string,
  opts?: ListOpts
) =>
  apiCall<ChatMessage[]>(
    `/projects/${projectId}/messages${buildQs(opts)}`,
    { token }
  );

export const sendProjectMessage = (
  token: string,
  projectId: string,
  text: string,
  mentions?: string[],
  attachments?: ChatAttachment[]
) =>
  apiCall<ChatMessage>(`/projects/${projectId}/messages`, {
    method: "POST",
    body: {
      text,
      ...(mentions && mentions.length ? { mentions } : {}),
      ...(attachments && attachments.length ? { attachments } : {}),
    },
    token,
  });

export const editProjectMessage = (
  token: string,
  projectId: string,
  messageId: string,
  text: string,
  mentions?: string[]
) =>
  apiCall<ChatMessage>(`/projects/${projectId}/messages/${messageId}`, {
    method: "PUT",
    body: { text, ...(mentions && mentions.length ? { mentions } : {}) },
    token,
  });

export const deleteProjectMessage = (
  token: string,
  projectId: string,
  messageId: string,
  scope: DeleteScope = "everyone"
) =>
  apiCall<{ message: string }>(
    `/projects/${projectId}/messages/${messageId}?scope=${scope}`,
    { method: "DELETE", token }
  );

export const markProjectReadReceipt = (token: string, projectId: string) =>
  apiCall<{ message: string }>(`/projects/${projectId}/messages/read`, {
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

// `markChatRead()` used to POST /me/chat-read here. Unread is per-channel
// now, so each surface marks only its own channel read via
// markOfficeReadReceipt / markProjectReadReceipt / markGroupReadReceipt.
// A blanket clear would hide unread messages in the other conversations.

// ===== CONVERSATION LIST (chat home) =====

export interface ChatConversation {
  channelType: "office" | "project" | "group";
  /** null for office chat. */
  channelId: string | null;
  name: string;
  unread: number;
  lastMessage: {
    text: string;
    authorName?: string | null;
    authorId?: string | null;
    createdAt: string | null;
    hasAttachments: boolean;
  } | null;
}

/**
 * Every chat the user can open — office plus their current project chats —
 * with a per-channel unread count.
 */
export const listConversations = (
  token: string
): Promise<{ conversations: ChatConversation[]; totalUnread: number }> =>
  apiCall("/chat/conversations", { token });

// ===== AD-HOC CHAT GROUPS =====
// Anyone in a group can read and post; only HR can create or manage them.

export interface ChatGroup {
  id: string;
  name: string;
  description?: string;
  memberIds: string[];
  createdBy?: string;
  createdAt?: string | null;
  /** True only for the HR user who created it. */
  viewerCanDelete?: boolean;
}

export const listChatGroups = (
  token: string,
  all = false
): Promise<ChatGroup[]> =>
  apiCall(`/chat/groups${all ? "?all=true" : ""}`, { token });

export const getChatGroup = (token: string, id: string): Promise<ChatGroup> =>
  apiCall(`/chat/groups/${id}`, { token });

/** HR only. */
export const createChatGroup = (
  token: string,
  payload: { name: string; description?: string; memberIds?: string[] }
): Promise<{ id: string; message: string }> =>
  apiCall("/chat/groups", { method: "POST", body: payload, token });

/** HR only. */
export const updateChatGroup = (
  token: string,
  id: string,
  payload: { name?: string; description?: string; memberIds?: string[] }
): Promise<{ message: string }> =>
  apiCall(`/chat/groups/${id}`, { method: "PUT", body: payload, token });

/** HR only. Deletes the conversation along with the group. */
export const deleteChatGroup = (
  token: string,
  id: string
): Promise<{ message: string }> =>
  apiCall(`/chat/groups/${id}`, { method: "DELETE", token });

export const listGroupMessages = (
  token: string,
  groupId: string,
  opts?: { before?: string; limit?: number }
) =>
  apiCall<ChatMessage[]>(
    `/chat/groups/${groupId}/messages${buildQs(opts)}`,
    { token }
  );

export const sendGroupMessage = (
  token: string,
  groupId: string,
  text: string,
  mentions?: string[],
  attachments?: ChatAttachment[]
) =>
  apiCall<ChatMessage>(`/chat/groups/${groupId}/messages`, {
    method: "POST",
    body: {
      text,
      ...(mentions && mentions.length ? { mentions } : {}),
      ...(attachments && attachments.length ? { attachments } : {}),
    },
    token,
  });

export const editGroupMessage = (
  token: string,
  groupId: string,
  messageId: string,
  text: string,
  mentions?: string[]
) =>
  apiCall<ChatMessage>(`/chat/groups/${groupId}/messages/${messageId}`, {
    method: "PUT",
    body: { text, ...(mentions && mentions.length ? { mentions } : {}) },
    token,
  });

export const deleteGroupMessage = (
  token: string,
  groupId: string,
  messageId: string,
  scope: DeleteScope = "everyone"
) =>
  apiCall<{ message: string }>(
    `/chat/groups/${groupId}/messages/${messageId}?scope=${scope}`,
    { method: "DELETE", token }
  );

export const markGroupReadReceipt = (token: string, groupId: string) =>
  apiCall<{ message: string }>(`/chat/groups/${groupId}/messages/read`, {
    method: "POST",
    token,
  });
