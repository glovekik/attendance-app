import React, {
  useEffect,
  useState,
  useCallback, useMemo} from "react";

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useRouter } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import { ChatThread, MentionUser } from "../../src/components/ChatThread";

import {
  listOfficeMessages,
  sendOfficeMessage,
  deleteOfficeMessage,
  markChatRead } from "../../src/services/chat";
import { chatUnreadStore } from "../../src/services/chatUnread";

import { getMe } from "../../src/services/api";

import { listUserDirectory } from "../../src/services/users";

import { User } from "../../src/types";

import { useTheme } from "../../src/theme/ThemeProvider";
// Pull `@First Last` tokens from the message text and map each to a known
// directory user id. Longest names matched first so "@Alex Smith" wins over
// "@Alex" when both exist. Returns unique IDs only.
function resolveMentions(
  text: string,
  people: MentionUser[]
): string[] {
  if (!text || !people.length) return [];
  const sorted = [...people].sort(
    (a, b) => (b.name?.length || 0) - (a.name?.length || 0)
  );
  const hits = new Set<string>();
  for (const p of sorted) {
    if (!p.name) continue;
    const escaped = p.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`@${escaped}\\b`, "i");
    if (re.test(text)) hits.add(p.id);
  }
  return Array.from(hits);
}

export default function OfficeChat() {

  const router = useRouter();

  const { theme } = useTheme();

  const c = theme.colors;

  const styles = useMemo(() => makeStyles(c), [c]);

  const [me, setMe] = useState<User | null>(null);
  const [mentionPeople, setMentionPeople] = useState<MentionUser[]>([]);

  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      // Stamp chatLastReadAt so the dashboard Chat-tile badge clears
      // when the user lands here. Same treatment team chat already gets.
      markChatRead(token).catch(() => {});
      // Clear the badge everywhere immediately — viewing the chat reads it.
      chatUnreadStore.set(0);
      try {
        const [user, directory] = await Promise.all([
          getMe(token),
          listUserDirectory(token).catch(() => ({
            items: [],
            nextCursor: null })),
        ]);
        setMe(user);
        setMentionPeople(
          (directory.items || []).map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email }))
        );
      } catch {
        // ignore
      }
    })();
  }, []);

  const fetchMessages = useCallback(async (before?: string) => {
    const token = await AsyncStorage.getItem("token");
    if (!token) return [];
    return listOfficeMessages(token, { before, limit: 50 });
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const token = await AsyncStorage.getItem("token");
      if (!token) throw new Error("Not authenticated");
      const mentions = resolveMentions(text, mentionPeople);
      return sendOfficeMessage(token, text, mentions);
    },
    [mentionPeople]
  );

  const removeMessage = useCallback(async (id: string) => {
    const token = await AsyncStorage.getItem("token");
    if (!token) throw new Error("Not authenticated");
    return deleteOfficeMessage(token, id);
  }, []);

  return (
    <SafeAreaView style={styles.safe}>

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        >
          <Ionicons name="chevron-back" size={22} color={c.text} />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Office Chat</Text>
          <Text style={styles.subtitle}>Everyone in the company</Text>
        </View>
      </View>

      <ChatThread
        me={me}
        fetchMessages={fetchMessages}
        sendMessage={sendMessage}
        deleteMessage={removeMessage}
        emptyText="No messages yet. Start the conversation 👋"
        mentionUsers={mentionPeople}
      />

    </SafeAreaView>
  );
}

const makeStyles = (c: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: c.surfaceBorder },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: c.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  title: {
    color: c.text,
    fontSize: 18,
    fontWeight: "800" },
  subtitle: {
    color: c.textMuted,
    fontSize: 12,
    marginTop: 2 } });

