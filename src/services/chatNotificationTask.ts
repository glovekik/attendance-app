/**
 * Background receiver for data-only chat pushes (Android).
 *
 * Chat messages are sent WITHOUT an FCM `notification` block so the card can
 * be built on-device as a single grouped MessagingStyle entry per conversation
 * (see chatNotifications.ts). The trade-off is that nothing displays unless
 * this task runs — so it is registered at module load, before any screen
 * mounts, and must stay side-effect-free at import time beyond that.
 *
 * Non-chat pushes still carry a `notification` block and are drawn by the OS;
 * this task ignores them.
 */

import * as TaskManager from "expo-task-manager";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { showChatMessage, isChatPush } from "./chatNotifications";

export const CHAT_BACKGROUND_TASK = "CHAT_MESSAGE_BACKGROUND_TASK";

// Data-only delivery + notifee MessagingStyle are both Android-only paths.
// iOS keeps the server-drawn notification and its own per-app grouping.
const enabled = Platform.OS === "android";

if (enabled && !TaskManager.isTaskDefined(CHAT_BACKGROUND_TASK)) {
  TaskManager.defineTask<any>(
    CHAT_BACKGROUND_TASK,
    async ({ data, error }) => {
      if (error) return;
      try {
        // Shape differs by delivery path: a remote data message arrives as
        // { data: {...} }, while some routes hand over the full notification.
        const payload =
          data?.notification?.data ??
          data?.data ??
          data ??
          {};
        if (!isChatPush(payload)) return;
        await showChatMessage({
          channelType: payload.channelType,
          channelId: payload.channelId,
          authorName: payload.authorName,
          authorId: payload.authorId,
          body: payload.body,
          channelName: payload.channelName,
        });
      } catch {
        /* a thrown background task is killed silently by the OS anyway */
      }
    }
  );
}

/** Idempotent — safe to call on every launch. */
export const registerChatBackgroundTask = async (): Promise<void> => {
  if (!enabled) return;
  try {
    await Notifications.registerTaskAsync(CHAT_BACKGROUND_TASK);
  } catch (err) {
    console.log("Chat background task registration failed:", err);
  }
};
