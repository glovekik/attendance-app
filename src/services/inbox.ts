import { apiCall } from "./http";
import { NotificationItem } from "../types";

export const listNotifications = (
  token: string,
  opts: { onlyUnread?: boolean; limit?: number; before?: string } = {}
): Promise<NotificationItem[]> => {
  const params = new URLSearchParams();
  if (opts.onlyUnread) params.set("onlyUnread", "true");
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.before) params.set("before", opts.before);
  const qs = params.toString();
  return apiCall(`/notifications${qs ? `?${qs}` : ""}`, { token });
};

export const getUnreadCount = (
  token: string
): Promise<{ count: number }> =>
  apiCall("/notifications/unread-count", { token });

export const markRead = (token: string, id: string): Promise<void> =>
  apiCall(`/notifications/${id}/read`, { method: "POST", token });

export const markAllRead = (
  token: string
): Promise<{ updated: number }> =>
  apiCall("/notifications/read-all", { method: "POST", token });
