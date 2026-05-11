import React, {
  useEffect,
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
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";

import { ChatMessage, User } from "../types";

interface Props {
  me: User | null;
  fetchMessages: (
    before?: string
  ) => Promise<ChatMessage[]>;
  sendMessage: (text: string) => Promise<ChatMessage>;
  deleteMessage?: (id: string) => Promise<unknown>;
  pollIntervalMs?: number;
  emptyText?: string;
}

const POLL_MS = 3000;

export const ChatThread = ({
  me,
  fetchMessages,
  sendMessage,
  deleteMessage,
  pollIntervalMs = POLL_MS,
  emptyText = "No messages yet. Say hi 👋",
}: Props) => {

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
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
              <ActivityIndicator size="small" color="#94a3b8" />
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

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Type a message…"
          placeholderTextColor="#64748b"
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

const styles = StyleSheet.create({

  loader: {
    flex: 1,
    backgroundColor: "#0b1220",
    justifyContent: "center",
    alignItems: "center",
  },

  errBar: {
    backgroundColor: "#dc2626",
    padding: 10,
  },
  errText: {
    color: "#fff",
    fontWeight: "700",
    textAlign: "center",
    fontSize: 13,
  },

  list: { flex: 1, backgroundColor: "#0b1220" },
  listContent: {
    padding: 14,
    paddingBottom: 14,
  },

  loadOlder: {
    paddingVertical: 12,
    alignItems: "center",
  },
  loadOlderText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "600",
  },

  empty: {
    paddingVertical: 50,
    alignItems: "center",
  },
  emptyText: {
    color: "#64748b",
    fontSize: 14,
  },

  bubbleRow: {
    marginBottom: 6,
  },

  author: {
    color: "#94a3b8",
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
    backgroundColor: "#2563eb",
    borderBottomRightRadius: 4,
  },
  theirs: {
    backgroundColor: "#1e293b",
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    color: "#e2e8f0",
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
    backgroundColor: "#0f172a",
    borderTopWidth: 1,
    borderTopColor: "#1f2937",
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: "#111827",
    color: "#fff",
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minHeight: 40,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: "#1f2937",
    fontSize: 14,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2563eb",
    justifyContent: "center",
    alignItems: "center",
  },
});
