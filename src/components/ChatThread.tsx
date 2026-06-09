import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

import { Ionicons } from "@expo/vector-icons";

import { ChatMessage, User } from "../types";
import { useTheme } from "../theme/ThemeProvider";

export interface MentionUser {
  id: string;
  name: string;
  email?: string;
}

interface Props {
  me: User | null;
  fetchMessages: (
    before?: string
  ) => Promise<ChatMessage[]>;
  sendMessage: (text: string) => Promise<ChatMessage>;
  deleteMessage?: (id: string) => Promise<unknown>;
  pollIntervalMs?: number;
  emptyText?: string;
  // When provided, typing "@" pops a picker that inserts "@<name> ".
  mentionUsers?: MentionUser[];
}

const POLL_MS = 3000;

export const ChatThread = (props: Props) => {
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);
  return <ChatThreadInner {...props} styles={styles} c={c} />;
};

interface InnerProps extends Props {
  styles: any;
  c: any;
}

const ChatThreadInner = ({
  me,
  fetchMessages,
  sendMessage,
  deleteMessage,
  styles,
  c,
  pollIntervalMs = POLL_MS,
  emptyText = "No messages yet. Say hi 👋",
  mentionUsers,
}: InnerProps) => {

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mention picker — opens whenever the draft has a trailing "@<query>".
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const mentionMatches = (() => {
    if (mentionQuery === null || !mentionUsers) return [];
    const q = mentionQuery.toLowerCase();
    return mentionUsers
      .filter((u) =>
        !q ? true : u.name?.toLowerCase().includes(q)
      )
      .slice(0, 6);
  })();

  const scrollRef = useRef<ScrollView | null>(null);
  const seenIds = useRef<Set<string>>(new Set());
  const pollTimer = useRef<any>(null);
  const lastIdsLength = useRef(0);

  // ===== INITIAL LOAD =====
  const loadInitial = useCallback(async () => {
    try {
      const list = await fetchMessages();
      seenIds.current = new Set(list.map((m) => m.id));
      setMessages(list);
      setHasMore(list.length >= 50);
      setError(null);
    } catch (err: any) {
      setError(err?.message || "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, [fetchMessages]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  // ===== POLLING =====
  const pollNew = useCallback(async () => {
    try {
      const fresh = await fetchMessages();
      let appended = 0;
      for (const m of fresh) {
        if (!seenIds.current.has(m.id)) {
          seenIds.current.add(m.id);
          appended++;
        }
      }
      if (appended > 0) {
        setMessages((prev) => {
          const map = new Map(prev.map((m) => [m.id, m]));
          for (const m of fresh) map.set(m.id, m);
          return Array.from(map.values()).sort((a, b) =>
            a.createdAt.localeCompare(b.createdAt)
          );
        });
      }
    } catch {
      // silent — let the next tick try again
    }
  }, [fetchMessages]);

  useEffect(() => {
    if (loading) return;
    pollTimer.current = setInterval(pollNew, pollIntervalMs);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [loading, pollNew, pollIntervalMs]);

  // ===== AUTO-SCROLL ON NEW =====
  useEffect(() => {
    if (messages.length > lastIdsLength.current) {
      lastIdsLength.current = messages.length;
      requestAnimationFrame(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      });
    }
  }, [messages.length]);

  // ===== LOAD OLDER =====
  const loadOlder = async () => {
    if (loadingOlder || !hasMore || messages.length === 0) return;
    try {
      setLoadingOlder(true);
      const oldest = messages[0];
      const older = await fetchMessages(oldest.createdAt);
      if (older.length === 0) {
        setHasMore(false);
      } else {
        for (const m of older) seenIds.current.add(m.id);
        setMessages((prev) => {
          const map = new Map(older.map((m) => [m.id, m]));
          for (const m of prev) map.set(m.id, m);
          return Array.from(map.values()).sort((a, b) =>
            a.createdAt.localeCompare(b.createdAt)
          );
        });
        if (older.length < 50) setHasMore(false);
      }
    } catch {
      // ignore
    } finally {
      setLoadingOlder(false);
    }
  };

  // ===== SEND =====
  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;

    const tempId = `temp-${Date.now()}`;
    const optimistic: ChatMessage = {
      id: tempId,
      userId: me?.id || "",
      user: me
        ? { id: me.id, name: me.name, email: me.email }
        : undefined,
      text,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimistic]);
    setDraft("");

    try {
      setSending(true);
      const real = await sendMessage(text);
      seenIds.current.add(real.id);
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? real : m))
      );
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setDraft(text);
      setError(err?.message || "Failed to send");
      setTimeout(() => setError(null), 2500);
    } finally {
      setSending(false);
    }
  };

  // ===== DELETE =====
  const askDelete = (m: ChatMessage) => {
    if (!deleteMessage) return;
    if (m.userId !== me?.id) return;
    // Skip while message is still in optimistic state (server hasn't returned yet)
    if (m.id.startsWith("temp-")) return;

    const doDelete = async () => {
      try {
        await deleteMessage(m.id);
        setMessages((prev) => prev.filter((x) => x.id !== m.id));
        seenIds.current.delete(m.id);
      } catch (err: any) {
        setError(err?.message || "Failed to delete");
        setTimeout(() => setError(null), 2500);
      }
    };

    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm("Delete this message?")) {
        doDelete();
      }
      return;
    }

    Alert.alert(
      "Delete message?",
      "",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: doDelete },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior="padding"
    >

      {error && (
        <View style={styles.errBar}>
          <Text style={styles.errText}>{error}</Text>
        </View>
      )}

      <ScrollView
        ref={scrollRef}
        style={styles.list}
        contentContainerStyle={styles.listContent}
      >
        {hasMore && messages.length > 0 && (
          <TouchableOpacity
            style={styles.loadOlder}
            onPress={loadOlder}
            disabled={loadingOlder}
          >
            {loadingOlder ? (
              <ActivityIndicator size="small" color={c.textMuted} />
            ) : (
              <Text style={styles.loadOlderText}>
                Load earlier messages
              </Text>
            )}
          </TouchableOpacity>
        )}

        {messages.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{emptyText}</Text>
          </View>
        )}

        {messages.map((m, i) => {
          const mine = m.userId === me?.id;
          const prev = messages[i - 1];
          const sameAuthorAsPrev =
            !!prev && prev.userId === m.userId;
          const showHead = !sameAuthorAsPrev;

          return (
            <View
              key={m.id}
              style={[
                styles.bubbleRow,
                mine
                  ? { alignItems: "flex-end" }
                  : { alignItems: "flex-start" },
              ]}
            >
              {showHead && !mine && (
                <Text style={styles.author}>
                  {m.user?.name || "User"}
                </Text>
              )}

              <TouchableOpacity
                activeOpacity={mine ? 0.6 : 1}
                onLongPress={() => askDelete(m)}
                style={[
                  styles.bubble,
                  mine ? styles.mine : styles.theirs,
                ]}
              >
                <Text
                  style={[
                    styles.bubbleText,
                    mine && { color: "#fff" },
                  ]}
                >
                  {m.text}
                </Text>
                <Text style={styles.time}>
                  {new Date(m.createdAt).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  })}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>

      {mentionUsers && mentionQuery !== null && mentionMatches.length > 0 && (
        <View style={styles.mentionBox}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: 200 }}
          >
            {mentionMatches.map((u) => (
              <TouchableOpacity
                key={u.id}
                style={styles.mentionRow}
                onPress={() => {
                  // Replace the in-progress "@query" with "@FullName "
                  const idx = draft.lastIndexOf("@");
                  if (idx === -1) return;
                  const before = draft.slice(0, idx);
                  setDraft(`${before}@${u.name} `);
                  setMentionQuery(null);
                }}
              >
                <View style={styles.mentionAvatar}>
                  <Text style={styles.mentionAvatarText}>
                    {(u.name || "?").charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.mentionName}>{u.name}</Text>
                  {!!u.email && (
                    <Text style={styles.mentionEmail}>{u.email}</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={(t) => {
            setDraft(t);
            if (!mentionUsers) return;
            // Look at the active word — show picker iff it starts with "@".
            const match = t.match(/(?:^|\s)@([\w-]*)$/);
            setMentionQuery(match ? match[1] : null);
          }}
          placeholder="Type a message…"
          placeholderTextColor={c.textFaint}
          multiline
          onSubmitEditing={send}
        />
        <TouchableOpacity
          style={[
            styles.sendBtn,
            (!draft.trim() || sending) && { opacity: 0.4 },
          ]}
          onPress={send}
          disabled={!draft.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={18} color="#fff" />
          )}
        </TouchableOpacity>
      </View>

    </KeyboardAvoidingView>
  );
};

const makeStyles = (c: any) => StyleSheet.create({

  loader: {
    flex: 1,
    backgroundColor: c.bg,
    justifyContent: "center",
    alignItems: "center",
  },

  errBar: {
    backgroundColor: "#dc2626",
    padding: 10,
  },
  errText: {
    color: c.text,
    fontWeight: "700",
    textAlign: "center",
    fontSize: 13,
  },

  list: { flex: 1, backgroundColor: c.bg },
  listContent: {
    padding: 14,
    paddingBottom: 14,
  },

  loadOlder: {
    paddingVertical: 12,
    alignItems: "center",
  },
  loadOlderText: {
    color: c.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },

  empty: {
    paddingVertical: 50,
    alignItems: "center",
  },
  emptyText: {
    color: c.textMuted,
    fontSize: 14,
  },

  bubbleRow: {
    marginBottom: 6,
  },

  author: {
    color: c.textMuted,
    fontSize: 11,
    fontWeight: "600",
    marginLeft: 12,
    marginBottom: 3,
  },

  bubble: {
    maxWidth: "78%",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  mine: {
    backgroundColor: c.accent,
    borderBottomRightRadius: 4,
  },
  theirs: {
    backgroundColor: c.surfaceMuted,
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    color: c.text,
    fontSize: 14,
    lineHeight: 19,
  },
  time: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 10,
    marginTop: 3,
    alignSelf: "flex-end",
  },

  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 10,
    backgroundColor: c.surfaceMuted,
    borderTopWidth: 1,
    borderTopColor: c.surfaceBorder,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: c.surfaceMuted,
    color: c.text,
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minHeight: 40,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    fontSize: 14,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.accent,
    justifyContent: "center",
    alignItems: "center",
  },

  mentionBox: {
    backgroundColor: c.surfaceMuted,
    borderTopWidth: 1,
    borderColor: c.surfaceBorder,
  },
  mentionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: c.surfaceBorder,
  },
  mentionAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: c.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  mentionAvatarText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  mentionName: {
    color: c.text,
    fontSize: 13,
    fontWeight: "700",
  },
  mentionEmail: {
    color: c.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
});
