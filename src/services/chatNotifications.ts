/**
 * WhatsApp-style grouped chat notifications (Android).
 *
 * The problem this solves: ten messages in Office Chat used to post ten
 * separate notification cards. Collapsing them with an FCM `tag` produced one
 * card but threw nine messages away — you only ever saw the newest.
 *
 * What we do instead is build the notification on the DEVICE with notifee,
 * using Android's MessagingStyle: one card per conversation, holding the last
 * N messages with their senders, expandable in the shade, plus a group summary
 * when more than one conversation is active. That is the shape WhatsApp uses,
 * and it is not expressible in an FCM `notification` payload — the server can
 * only send a title and a body, so the grouping has to happen client-side.
 *
 * Consequence: chat pushes are sent DATA-ONLY (see routes/chat.py). A data-only
 * message never auto-displays, so if this handler doesn't run the user sees
 * nothing at all. Every path that can receive one must call `showChatMessage`.
 *
 * iOS is untouched: it already groups per-app, and `threadIdentifier` handles
 * per-conversation threading there. notifee's MessagingStyle is Android-only.
 */

import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import notifee, {
  AndroidImportance,
  AndroidStyle,
} from "@notifee/react-native";

const isAndroid = Platform.OS === "android";

/** Android caps MessagingStyle at ~25 lines; well under that stays readable. */
const MAX_MESSAGES_PER_CHAT = 10;

/** All chat notifications share this group so Android can post one summary. */
const CHAT_GROUP_ID = "chat_messages";

const CHAT_CHANNEL_ID = "chat";

/** Persisted per conversation so the card survives an app restart. */
const historyKey = (conversationId: string) => `chatnotif:${conversationId}`;

export interface ChatPushData {
  /** "office" or a team id — one notification card per distinct value. */
  channelType?: string;
  channelId?: string;
  /** Display name of whoever sent it. */
  authorName?: string;
  authorId?: string;
  /** The message text. */
  body?: string;
  /** Human-readable conversation name, e.g. "Office chat". */
  channelName?: string;
}

interface StoredMessage {
  text: string;
  author: string;
  at: number;
}

/** Stable id for a conversation — the unit we group by. */
const conversationIdOf = (d: ChatPushData): string =>
  d.channelType === "office"
    ? "office"
    : `team:${d.channelId || "unknown"}`;

const titleOf = (d: ChatPushData): string =>
  d.channelName ||
  (d.channelType === "office" ? "Office chat" : "Team chat");

const readHistory = async (
  conversationId: string
): Promise<StoredMessage[]> => {
  try {
    const raw = await AsyncStorage.getItem(historyKey(conversationId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeHistory = async (
  conversationId: string,
  messages: StoredMessage[]
): Promise<void> => {
  try {
    await AsyncStorage.setItem(
      historyKey(conversationId),
      JSON.stringify(messages.slice(-MAX_MESSAGES_PER_CHAT))
    );
  } catch {
    /* history is a nicety — never block the notification on it */
  }
};

export const ensureChatChannel = async (): Promise<void> => {
  if (!isAndroid) return;
  await notifee.createChannel({
    id: CHAT_CHANNEL_ID,
    name: "Chat messages",
    importance: AndroidImportance.HIGH,
    vibration: true,
  });
};

/**
 * Add one incoming message to its conversation's card and re-display it.
 *
 * Re-displaying with the same notification id REPLACES the card rather than
 * adding another, which is what keeps ten messages in one entry — but because
 * we carry the accumulated history into MessagingStyle, expanding it still
 * shows all ten rather than only the latest.
 */
export const showChatMessage = async (data: ChatPushData): Promise<void> => {
  if (!isAndroid) return; // iOS groups natively; nothing to build here.

  const conversationId = conversationIdOf(data);
  const text = (data.body || "").trim();
  if (!text) return;

  const history = await readHistory(conversationId);
  history.push({
    text,
    author: data.authorName || "Someone",
    at: Date.now(),
  });
  const recent = history.slice(-MAX_MESSAGES_PER_CHAT);
  await writeHistory(conversationId, recent);

  await ensureChatChannel();

  await notifee.displayNotification({
    // Same id per conversation → replaces that conversation's card only.
    id: conversationId,
    title: titleOf(data),
    body: `${recent[recent.length - 1].author}: ${
      recent[recent.length - 1].text
    }`,
    android: {
      channelId: CHAT_CHANNEL_ID,
      groupId: CHAT_GROUP_ID,
      smallIcon: "notification_icon",
      pressAction: { id: "default", launchActivity: "default" },
      style: {
        type: AndroidStyle.MESSAGING,
        // The "person" a MessagingStyle card is *about*. Using the
        // conversation name here makes the card read as the group chat,
        // matching how WhatsApp titles a group thread.
        person: { name: titleOf(data) },
        group: true,
        messages: recent.map((msMsg) => ({
          text: msMsg.text,
          timestamp: msMsg.at,
          person: { name: msMsg.author },
        })),
      },
    },
    data: {
      type: "chat",
      channelType: data.channelType || "",
      channelId: data.channelId || "",
    },
  });

  await showGroupSummary();
};

/**
 * Android only collapses grouped notifications once a summary exists, so post
 * one whenever more than one conversation is showing. With a single active
 * conversation the summary would just duplicate it.
 */
const showGroupSummary = async (): Promise<void> => {
  if (!isAndroid) return;
  try {
    const displayed = await notifee.getDisplayedNotifications();
    const chats = displayed.filter(
      (n) => n.notification?.android?.groupId === CHAT_GROUP_ID && !!n.id
    );
    if (chats.length < 2) return;

    await notifee.displayNotification({
      id: `${CHAT_GROUP_ID}_summary`,
      title: "New messages",
      subtitle: `${chats.length} conversations`,
      android: {
        channelId: CHAT_CHANNEL_ID,
        groupId: CHAT_GROUP_ID,
        groupSummary: true,
        smallIcon: "notification_icon",
        pressAction: { id: "default", launchActivity: "default" },
      },
    });
  } catch {
    /* the per-chat cards already showed; a missing summary is cosmetic */
  }
};

/**
 * Clear a conversation's card and its accumulated history.
 *
 * Called when the user opens that chat — otherwise the next message would
 * re-display messages they have already read.
 */
export const clearChatNotifications = async (
  channelType: string,
  channelId?: string
): Promise<void> => {
  if (!isAndroid) return;
  const conversationId = conversationIdOf({ channelType, channelId });
  try {
    await AsyncStorage.removeItem(historyKey(conversationId));
    await notifee.cancelNotification(conversationId);
    const displayed = await notifee.getDisplayedNotifications();
    const remaining = displayed.filter(
      (n) =>
        n.notification?.android?.groupId === CHAT_GROUP_ID &&
        n.id !== `${CHAT_GROUP_ID}_summary`
    );
    // A summary left hanging over zero children shows as an empty group.
    if (remaining.length === 0) {
      await notifee.cancelNotification(`${CHAT_GROUP_ID}_summary`);
    }
  } catch {
    /* best-effort */
  }
};

/** True when a push payload is a chat message this module should render. */
export const isChatPush = (data: any): boolean =>
  !!data && data.type === "chat_message";
