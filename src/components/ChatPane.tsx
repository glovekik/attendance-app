import React, { useCallback, useEffect, useMemo, useState } from "react";

import { View, Text, StyleSheet, TouchableOpacity } from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";

import { ChatThread, MentionUser, AttachInput } from "./ChatThread";
import {
  listOfficeMessages,
  sendOfficeMessage,
  editOfficeMessage,
  deleteOfficeMessage,
  markOfficeReadReceipt,
  listProjectMessages,
  sendProjectMessage,
  editProjectMessage,
  deleteProjectMessage,
  markProjectReadReceipt,
  listGroupMessages,
  sendGroupMessage,
  editGroupMessage,
  deleteGroupMessage,
  markGroupReadReceipt,
  getChatGroup,
  DeleteScope,
} from "../services/chat";
import { chatUnreadStore } from "../services/chatUnread";
import { clearChatNotifications } from "../services/chatNotifications";
import { uploadFile } from "../services/uploads";
import { getProject } from "../services/projects";
import { getMe } from "../services/api";
import { listUserDirectory } from "../services/users";
import { User, ChatAttachment } from "../types";
import { useTheme } from "../theme/ThemeProvider";

/**
 * One chat surface, used three ways: the office chat route, the project chat
 * route, and the right-hand pane of the desktop two-pane Chats screen.
 *
 * Keeping it in one place means read-marking, notification clearing and
 * mention resolution can't drift between office and project chat — they
 * already had, which is how project chat ended up marking every channel read.
 */

// Pull `@First Last` tokens from the text and map each to a directory user id.
// Longest names matched first so "@Alex Smith" wins over "@Alex".
function resolveMentions(text: string, people: MentionUser[]): string[] {
  if (!text || !people.length) return [];
  const sorted = [...people].sort(
    (a, b) => (b.name?.length || 0) - (a.name?.length || 0)
  );
  const hits = new Set<string>();
  for (const p of sorted) {
    if (!p.name) continue;
    const escaped = p.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`@${escaped}\\b`, "i").test(text)) hits.add(p.id);
  }
  return Array.from(hits);
}

export interface ChatPaneProps {
  channelType: "office" | "project" | "group";
  /** Required for project chat; ignored for office. */
  channelId?: string;
  /** Hidden in the desktop two-pane layout, where the list is always visible. */
  onBack?: () => void;
  /** Drops the outer border in embedded (two-pane) use. */
  embedded?: boolean;
  /** Optional control rendered at the right of the header. */
  headerRight?: React.ReactNode;
  /** Called once the channel's own metadata has loaded. */
  onLoaded?: (info: { canDelete?: boolean }) => void;
}

export const ChatPane = ({
  channelType,
  channelId,
  onBack,
  embedded = false,
  headerRight,
  onLoaded,
}: ChatPaneProps) => {
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);

  const isOffice = channelType === "office";
  const isGroup = channelType === "group";

  const [me, setMe] = useState<User | null>(null);
  const [mentionPeople, setMentionPeople] = useState<MentionUser[]>([]);
  const [title, setTitle] = useState(isOffice ? "Office Chat" : "");
  const [subtitle, setSubtitle] = useState(
    isOffice ? "Everyone in the company" : ""
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;

      // Mark only THIS channel read. Unread is per-channel now, so a blanket
      // clear would hide unread messages in other conversations.
      const markThis = isOffice
        ? markOfficeReadReceipt(token)
        : channelId
        ? isGroup
          ? markGroupReadReceipt(token, channelId)
          : markProjectReadReceipt(token, channelId)
        : Promise.resolve(null as any);
      markThis.then(() => chatUnreadStore.refresh()).catch(() => {});

      // Drop the grouped notification card and its stored history, so already
      // read messages don't reappear in the next notification.
      clearChatNotifications(channelType, channelId).catch(() => {});

      try {
        const user = await getMe(token);
        if (!cancelled) setMe(user);
      } catch {
        /* chat still works without it */
      }

      if (isOffice) {
        try {
          const dir = await listUserDirectory(token);
          if (!cancelled) {
            setMentionPeople(
              (dir.items || []).map((u) => ({
                id: u.id,
                name: u.name,
                email: u.email,
              }))
            );
          }
        } catch {
          /* mentions degrade to plain text */
        }
      } else if (isGroup && channelId) {
        try {
          const g = await getChatGroup(token, channelId);
          if (!cancelled) {
            setTitle(g.name || "Group Chat");
            const n = g.memberIds?.length || 0;
            setSubtitle(`${n} ${n === 1 ? "member" : "members"}`);
            onLoaded?.({ canDelete: g.viewerCanDelete });
          }
        } catch {
          if (!cancelled) setTitle("Group Chat");
        }
      } else if (channelId) {
        try {
          // Any member can read the project — no HR gate. An earlier version
          // gated this on HR, which is why everyone else saw "Project Chat".
          const p = await getProject(token, channelId);
          if (!cancelled) {
            setTitle(p.name || "Project Chat");
            const n =
              (p.managerIds?.length || 0) + (p.memberIds?.length || 0);
            setSubtitle(`${n} ${n === 1 ? "member" : "members"}`);
          }
        } catch {
          if (!cancelled) setTitle("Project Chat");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // onLoaded intentionally omitted: callers pass an inline function and
    // including it would refetch on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelType, channelId, isOffice, isGroup]);

  const fetchMessages = useCallback(
    async (before?: string) => {
      const token = await AsyncStorage.getItem("token");
      if (!token) return [];
      return isOffice
        ? listOfficeMessages(token, { before, limit: 50 })
        : isGroup
        ? listGroupMessages(token, channelId!, { before, limit: 50 })
        : listProjectMessages(token, channelId!, { before, limit: 50 });
    },
    [isOffice, isGroup, channelId]
  );

  const sendMessage = useCallback(
    async (text: string, attachments?: ChatAttachment[]) => {
      const token = await AsyncStorage.getItem("token");
      if (!token) throw new Error("Not authenticated");
      const mentions = resolveMentions(text, mentionPeople);
      return isOffice
        ? sendOfficeMessage(token, text, mentions, attachments)
        : isGroup
        ? sendGroupMessage(token, channelId!, text, mentions, attachments)
        : sendProjectMessage(token, channelId!, text, mentions, attachments);
    },
    [isOffice, isGroup, channelId, mentionPeople]
  );

  const editMessage = useCallback(
    async (id: string, text: string) => {
      const token = await AsyncStorage.getItem("token");
      if (!token) throw new Error("Not authenticated");
      const mentions = resolveMentions(text, mentionPeople);
      return isOffice
        ? editOfficeMessage(token, id, text, mentions)
        : isGroup
        ? editGroupMessage(token, channelId!, id, text, mentions)
        : editProjectMessage(token, channelId!, id, text, mentions);
    },
    [isOffice, isGroup, channelId, mentionPeople]
  );

  const removeMessage = useCallback(
    async (id: string, scope: DeleteScope) => {
      const token = await AsyncStorage.getItem("token");
      if (!token) throw new Error("Not authenticated");
      return isOffice
        ? deleteOfficeMessage(token, id, scope)
        : isGroup
        ? deleteGroupMessage(token, channelId!, id, scope)
        : deleteProjectMessage(token, channelId!, id, scope);
    },
    [isOffice, isGroup, channelId]
  );

  const markRead = useCallback(() => {
    AsyncStorage.getItem("token").then((t) => {
      if (!t) return;
      const p = isOffice
        ? markOfficeReadReceipt(t)
        : channelId
        ? isGroup
          ? markGroupReadReceipt(t, channelId)
          : markProjectReadReceipt(t, channelId)
        : null;
      p?.then(() => chatUnreadStore.refresh()).catch(() => {});
    });
  }, [isOffice, isGroup, channelId]);

  const uploadAttachment = useCallback(
    async (file: AttachInput): Promise<ChatAttachment> => {
      const token = await AsyncStorage.getItem("token");
      if (!token) throw new Error("Not authenticated");
      const r = await uploadFile(token, file);
      return {
        url: r.url,
        type: (r.mimeType || file.mimeType || "").startsWith("image/")
          ? "image"
          : "file",
        name: r.fileName || file.name,
        mimeType: r.mimeType || file.mimeType,
      };
    },
    []
  );

  return (
    <View style={[styles.pane, embedded && styles.paneEmbedded]}>
      <View style={styles.header}>
        {!!onBack && (
          <TouchableOpacity style={styles.backBtn} onPress={onBack}>
            <Ionicons name="chevron-back" size={22} color={c.text} />
          </TouchableOpacity>
        )}
        <View
          style={[
            styles.iconBox,
            {
              backgroundColor: isOffice
                ? "#0ea5e9"
                : isGroup
                ? "#0f9d8f"
                : "#7c3aed",
            },
          ]}
        >
          <Ionicons
            name={
              isOffice
                ? "business-outline"
                : isGroup
                ? "people-outline"
                : "folder-outline"
            }
            size={18}
            color="#fff"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {title || "…"}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        {headerRight}
      </View>

      <ChatThread
        // Remount on channel change so the desktop pane doesn't briefly show
        // the previous conversation's messages.
        key={`${channelType}:${channelId ?? "office"}`}
        me={me}
        fetchMessages={fetchMessages}
        sendMessage={sendMessage}
        editMessage={editMessage}
        deleteMessage={removeMessage}
        markRead={markRead}
        uploadAttachment={uploadAttachment}
        emptyText="No messages yet. Start the conversation 👋"
        mentionUsers={mentionPeople}
      />
    </View>
  );
};

const makeStyles = (c: any) =>
  StyleSheet.create({
    pane: { flex: 1, backgroundColor: c.bg },
    paneEmbedded: { borderLeftWidth: 1, borderLeftColor: c.surfaceBorder },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 12,
      gap: 10,
      borderBottomWidth: 1,
      borderBottomColor: c.surfaceBorder,
    },
    backBtn: {
      width: 38,
      height: 38,
      borderRadius: 10,
      backgroundColor: c.surface,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: c.surfaceBorder,
    },
    iconBox: {
      width: 38,
      height: 38,
      borderRadius: 10,
      justifyContent: "center",
      alignItems: "center",
    },
    title: { color: c.text, fontSize: 18, fontWeight: "800" },
    subtitle: { color: c.textMuted, fontSize: 12, marginTop: 2 },
  });
