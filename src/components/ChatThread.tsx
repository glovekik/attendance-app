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
  Modal,
  Linking,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { Image } from "expo-image";
import * as DocumentPicker from "expo-document-picker";
import { mediaUrl } from "../utils/media";
import { Avatar } from "./Avatar";

import { Ionicons } from "@expo/vector-icons";

import { ChatMessage, ChatAttachment, User } from "../types";
import { useTheme } from "../theme/ThemeProvider";

export interface MentionUser {
  id: string;
  name: string;
  email?: string;
}

export interface AttachInput {
  uri: string;
  name: string;
  mimeType?: string;
  webFile?: Blob | File;
}

type DeleteScope = "me" | "everyone";

interface Props {
  me: User | null;
  fetchMessages: (before?: string) => Promise<ChatMessage[]>;
  sendMessage: (
    text: string,
    attachments?: ChatAttachment[]
  ) => Promise<ChatMessage>;
  editMessage?: (id: string, text: string) => Promise<ChatMessage>;
  deleteMessage?: (id: string, scope: DeleteScope) => Promise<unknown>;
  markRead?: () => void;
  uploadAttachment?: (file: AttachInput) => Promise<ChatAttachment>;
  pollIntervalMs?: number;
  emptyText?: string;
  mentionUsers?: MentionUser[];
}

const POLL_MS = 3000;
const EMOJIS = [
  "😀", "😂", "😍", "👍", "🙏", "🎉", "🔥", "❤️", "😎", "😢",
  "😅", "🤝", "👏", "💯", "🚀", "✅", "👀", "🤔", "😴", "🥳",
];

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
  editMessage,
  deleteMessage,
  markRead,
  uploadAttachment,
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
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [actionMsg, setActionMsg] = useState<ChatMessage | null>(null);
  // Fullscreen image viewer (lightbox) for tapped image attachments.
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [inputHeight, setInputHeight] = useState(0);
  const [audioSupported, setAudioSupported] = useState(false);

  // Probe whether the native audio module is present (only true on builds
  // that bundled expo-audio). Guards the recorder so older builds don't crash.
  useEffect(() => {
    (async () => {
      try {
        const A = require("expo-audio");
        await A.getRecordingPermissionsAsync();
        setAudioSupported(true);
      } catch {
        setAudioSupported(false);
      }
    })();
  }, []);

  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const mentionMatches = (() => {
    if (mentionQuery === null || !mentionUsers) return [];
    const q = mentionQuery.toLowerCase();
    return mentionUsers
      .filter((u) => (!q ? true : u.name?.toLowerCase().includes(q)))
      .slice(0, 6);
  })();

  const scrollRef = useRef<ScrollView | null>(null);
  const seenIds = useRef<Set<string>>(new Set());
  const pollTimer = useRef<any>(null);
  const lastIdsLength = useRef(0);

  const flash = (msg: string) => {
    setError(msg);
    setTimeout(() => setError(null), 2500);
  };

  const merge = (incoming: ChatMessage[], base: ChatMessage[]) => {
    const map = new Map(base.map((m) => [m.id, m]));
    for (const m of incoming) map.set(m.id, m);
    return Array.from(map.values()).sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt)
    );
  };

  // ===== INITIAL LOAD =====
  const loadInitial = useCallback(async () => {
    try {
      const list = await fetchMessages();
      seenIds.current = new Set(list.map((m) => m.id));
      setMessages(list);
      setHasMore(list.length >= 50);
      setError(null);
      markRead?.();
    } catch (err: any) {
      setError(err?.message || "Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, [fetchMessages, markRead]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  // ===== POLLING ===== (also refreshes edited/deleted/read state)
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
      // Always merge so edits/deletes/read-ticks refresh, not just new msgs.
      setMessages((prev) => merge(fresh, prev));
      if (appended > 0) markRead?.();
    } catch {
      // silent
    }
  }, [fetchMessages, markRead]);

  useEffect(() => {
    if (loading) return;
    pollTimer.current = setInterval(pollNew, pollIntervalMs);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [loading, pollNew, pollIntervalMs]);

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
        setMessages((prev) => merge(prev, older));
        if (older.length < 50) setHasMore(false);
      }
    } catch {
      // ignore
    } finally {
      setLoadingOlder(false);
    }
  };

  // ===== SEND =====
  const send = async (attachments?: ChatAttachment[]) => {
    const text = draft.trim();
    if ((!text && !attachments?.length) || sending) return;

    // If we're editing, route to edit instead.
    if (editing && editMessage) {
      const target = editing;
      setEditing(null);
      setDraft("");
      try {
        setSending(true);
        const updated = await editMessage(target.id, text);
        setMessages((prev) => prev.map((m) => (m.id === target.id ? updated : m)));
      } catch (err: any) {
        setDraft(text);
        setEditing(target);
        flash(err?.message || "Failed to edit");
      } finally {
        setSending(false);
      }
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const optimistic: ChatMessage = {
      id: tempId,
      userId: me?.id || "",
      user: me ? { id: me.id, name: me.name, email: me.email } : undefined,
      text,
      attachments,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setDraft("");

    try {
      setSending(true);
      const real = await sendMessage(text, attachments);
      seenIds.current.add(real.id);
      setMessages((prev) => prev.map((m) => (m.id === tempId ? real : m)));
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      if (!attachments?.length) setDraft(text);
      flash(err?.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  // ===== ATTACH (image / file via document picker) =====
  const onAttach = async () => {
    if (!uploadAttachment || attaching) return;
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled || !res.assets?.length) return;
      const a = res.assets[0];
      setAttaching(true);
      const uploaded = await uploadAttachment({
        uri: a.uri,
        name: a.name || "file",
        mimeType: a.mimeType,
        webFile: (a as any).file,
      });
      await send([uploaded]);
    } catch (err: any) {
      flash(err?.message || "Upload failed");
    } finally {
      setAttaching(false);
    }
  };

  // ===== IMAGE (gallery) =====
  const pickImage = async () => {
    if (!uploadAttachment || attaching) return;
    try {
      const ImagePicker = require("expo-image-picker");
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        flash("Permission denied");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
      if (res.canceled || !res.assets?.length) return;
      const a = res.assets[0];
      setAttaching(true);
      const uploaded = await uploadAttachment({
        uri: a.uri,
        name: a.fileName || `photo-${Date.now()}.jpg`,
        mimeType: a.mimeType || "image/jpeg",
        webFile: (a as any).file,
      });
      await send([{ ...uploaded, type: "image" }]);
    } catch (err: any) {
      flash(err?.message || "Couldn't add photo (needs a build with expo-image-picker)");
    } finally {
      setAttaching(false);
    }
  };

  // ===== VOICE =====
  const sendVoice = async (uri: string, durationMs: number) => {
    if (!uploadAttachment) return;
    try {
      setAttaching(true);
      const uploaded = await uploadAttachment({
        uri,
        name: `voice-${Date.now()}.m4a`,
        mimeType: "audio/m4a",
      });
      await send([{ ...uploaded, type: "voice", durationMs }]);
    } catch (err: any) {
      flash("Couldn't send voice message");
    } finally {
      setAttaching(false);
    }
  };

  // ===== MESSAGE ACTIONS =====
  const openActions = (m: ChatMessage) => {
    if (m.id.startsWith("temp-") || m.deleted) return;
    setActionMsg(m);
  };

  const startEdit = (m: ChatMessage) => {
    setActionMsg(null);
    setEditing(m);
    setDraft(m.text);
  };

  const doDelete = async (m: ChatMessage, scope: DeleteScope) => {
    setActionMsg(null);
    if (!deleteMessage) return;
    try {
      await deleteMessage(m.id, scope);
      if (scope === "me") {
        setMessages((prev) => prev.filter((x) => x.id !== m.id));
        seenIds.current.delete(m.id);
      } else {
        setMessages((prev) =>
          prev.map((x) =>
            x.id === m.id ? { ...x, deleted: true, text: "", attachments: [] } : x
          )
        );
      }
    } catch (err: any) {
      flash(err?.message || "Failed to delete");
    }
  };

  const insertEmoji = (e: string) => {
    setDraft((d) => d + e);
    setEmojiOpen(false);
  };

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  const mineAction = actionMsg && actionMsg.userId === me?.id;
  // Authors can edit / delete-for-everyone their own messages even after
  // others have read them (still bounded server-side by the edit/delete window).
  const canModify = mineAction;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      {error && (
        <View style={styles.errBar}>
          <Text style={styles.errText}>{error}</Text>
        </View>
      )}

      <ScrollView ref={scrollRef} style={styles.list} contentContainerStyle={styles.listContent}>
        {hasMore && messages.length > 0 && (
          <TouchableOpacity style={styles.loadOlder} onPress={loadOlder} disabled={loadingOlder}>
            {loadingOlder ? (
              <ActivityIndicator size="small" color={c.textMuted} />
            ) : (
              <Text style={styles.loadOlderText}>Load earlier messages</Text>
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
          const showHead = !(prev && prev.userId === m.userId);
          return (
            <View
              key={m.id}
              style={[
                styles.bubbleRow,
                { flexDirection: "row", justifyContent: mine ? "flex-end" : "flex-start" },
              ]}
            >
              {!mine &&
                (showHead ? (
                  <Avatar
                    name={m.user?.name}
                    uri={m.user?.profilePictureUrl}
                    size={28}
                    style={styles.msgAvatar}
                  />
                ) : (
                  <View style={styles.msgAvatarSpacer} />
                ))}

              <View style={[styles.bubbleCol, { alignItems: mine ? "flex-end" : "flex-start" }]}>
                {showHead && !mine && <Text style={styles.author}>{m.user?.name || "User"}</Text>}

                <TouchableOpacity
                  activeOpacity={0.7}
                  onLongPress={() => openActions(m)}
                  style={[styles.bubble, mine ? styles.mine : styles.theirs]}
                >
                {m.deleted ? (
                  <Text style={[styles.deletedText, mine && { color: "rgba(255,255,255,0.7)" }]}>
                    🚫 This message was deleted
                  </Text>
                ) : (
                  <>
                    {(m.attachments || []).map((att, idx) => (
                      <Attachment
                        key={idx}
                        att={att}
                        c={c}
                        styles={styles}
                        onImagePress={setViewerUri}
                      />
                    ))}
                    {!!m.text && (
                      <Text style={[styles.bubbleText, mine && { color: "#fff" }]}>{m.text}</Text>
                    )}
                  </>
                )}

                <View style={styles.metaRow}>
                  {!!m.editedAt && !m.deleted && (
                    <Text style={[styles.edited, mine && { color: "rgba(255,255,255,0.7)" }]}>
                      edited
                    </Text>
                  )}
                  <Text style={[styles.time, mine && { color: "rgba(255,255,255,0.75)" }]}>
                    {fmtTime(m.createdAt)}
                  </Text>
                  {mine && !m.deleted && !m.id.startsWith("temp-") && (
                    <Ionicons
                      name={m.readByOthers ? "checkmark-done" : "checkmark"}
                      size={14}
                      color={m.readByOthers ? "#7dd3fc" : "rgba(255,255,255,0.75)"}
                    />
                  )}
                  {/* Visible actions affordance (delete / edit) — long-press
                      also works, but this makes it discoverable, esp. on web. */}
                  {!m.deleted && !m.id.startsWith("temp-") && (
                    <TouchableOpacity
                      onPress={() => openActions(m)}
                      hitSlop={8}
                      style={styles.moreBtn}
                    >
                      <Ionicons
                        name="ellipsis-horizontal"
                        size={15}
                        color={mine ? "rgba(255,255,255,0.75)" : c.textFaint}
                      />
                    </TouchableOpacity>
                  )}
                </View>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {mentionUsers && mentionQuery !== null && mentionMatches.length > 0 && (
        <View style={styles.mentionBox}>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 200 }}>
            {mentionMatches.map((u) => (
              <TouchableOpacity
                key={u.id}
                style={styles.mentionRow}
                onPress={() => {
                  const idx = draft.lastIndexOf("@");
                  if (idx === -1) return;
                  setDraft(`${draft.slice(0, idx)}@${u.name} `);
                  setMentionQuery(null);
                }}
              >
                <Avatar name={u.name} uri={undefined} size={34} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.mentionName}>{u.name}</Text>
                  {!!u.email && <Text style={styles.mentionEmail}>{u.email}</Text>}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {editing && (
        <View style={styles.editingBar}>
          <Ionicons name="pencil" size={14} color={c.accent} />
          <Text style={styles.editingText} numberOfLines={1}>
            Editing message
          </Text>
          <TouchableOpacity onPress={() => { setEditing(null); setDraft(""); }}>
            <Ionicons name="close" size={16} color={c.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {emojiOpen && (
        <View style={styles.emojiBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {EMOJIS.map((e) => (
              <TouchableOpacity key={e} onPress={() => insertEmoji(e)} style={styles.emojiBtn}>
                <Text style={{ fontSize: 26 }}>{e}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.composer}>
        <View style={styles.inputWrap}>
          <TouchableOpacity style={styles.inBtn} onPress={() => setEmojiOpen((v) => !v)}>
            <Ionicons name="happy-outline" size={22} color={emojiOpen ? c.accent : c.textMuted} />
          </TouchableOpacity>
          <TextInput
            style={[
              styles.input,
              { height: Math.min(120, Math.max(24, inputHeight)) },
            ]}
            value={draft}
            onChangeText={(t) => {
              setDraft(t);
              if (!mentionUsers) return;
              const match = t.match(/(?:^|\s)@([\w-]*)$/);
              setMentionQuery(match ? match[1] : null);
            }}
            onContentSizeChange={(e) =>
              setInputHeight(e.nativeEvent.contentSize.height)
            }
            placeholder={editing ? "Edit message…" : "Message"}
            placeholderTextColor={c.textFaint}
            multiline
          />
          {!editing && (
            <>
              {uploadAttachment && (
                <TouchableOpacity style={styles.inBtn} onPress={() => pickImage()} disabled={attaching}>
                  <Ionicons name="image-outline" size={22} color={c.textMuted} />
                </TouchableOpacity>
              )}
              {uploadAttachment && (
                <TouchableOpacity style={styles.inBtn} onPress={onAttach} disabled={attaching}>
                  {attaching ? (
                    <ActivityIndicator size="small" color={c.textMuted} />
                  ) : (
                    <Ionicons name="attach-outline" size={22} color={c.textMuted} />
                  )}
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        {!editing && audioSupported && uploadAttachment && !draft.trim() ? (
          <VoiceButton c={c} styles={styles} onRecorded={sendVoice} onError={flash} />
        ) : (
          <TouchableOpacity
            style={[styles.sendBtn, (!draft.trim() || sending) && { opacity: 0.4 }]}
            onPress={() => send()}
            disabled={!draft.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name={editing ? "checkmark" : "send"} size={18} color="#fff" />
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Action sheet */}
      <Modal visible={!!actionMsg} transparent animationType="fade" onRequestClose={() => setActionMsg(null)}>
        <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={() => setActionMsg(null)}>
          <View style={styles.sheet}>
            {canModify && editMessage && actionMsg?.text ? (
              <SheetItem icon="pencil-outline" label="Edit" c={c} styles={styles} onPress={() => actionMsg && startEdit(actionMsg)} />
            ) : null}
            {canModify && deleteMessage ? (
              <SheetItem icon="trash-outline" label="Delete for everyone" danger c={c} styles={styles}
                onPress={() => actionMsg && doDelete(actionMsg, "everyone")} />
            ) : null}
            {deleteMessage ? (
              <SheetItem icon="eye-off-outline" label="Delete for me" c={c} styles={styles}
                onPress={() => actionMsg && doDelete(actionMsg, "me")} />
            ) : null}
            {mineAction && actionMsg?.readByOthers && (
              <Text style={styles.sheetNote}>Read by others — can no longer edit or unsend.</Text>
            )}
            <SheetItem icon="close-outline" label="Cancel" c={c} styles={styles} onPress={() => setActionMsg(null)} />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Fullscreen image viewer (lightbox) */}
      <Modal
        visible={!!viewerUri}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerUri(null)}
      >
        <TouchableOpacity
          style={styles.viewerBackdrop}
          activeOpacity={1}
          onPress={() => setViewerUri(null)}
        >
          {!!viewerUri && (
            <Image source={{ uri: viewerUri }} style={styles.viewerImage} contentFit="contain" />
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.viewerClose} onPress={() => setViewerUri(null)} hitSlop={12}>
          <Ionicons name="close" size={28} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.viewerOpen} onPress={() => openExternal(viewerUri || undefined)} hitSlop={12}>
          <Ionicons name="open-outline" size={22} color="#fff" />
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
};

// Open a URL externally without going through expo-router. On web,
// Linking.openURL gets intercepted by the router and lands on the "unmatched
// route" screen, so use window.open there and Linking only on native.
const openExternal = (uri?: string) => {
  if (!uri) return;
  if (Platform.OS === "web") {
    try {
      window.open(uri, "_blank", "noopener");
      return;
    } catch {
      /* fall through to Linking */
    }
  }
  Linking.openURL(uri).catch(() => {});
};

function Attachment({
  att,
  c,
  styles,
  onImagePress,
}: {
  att: ChatAttachment;
  c: any;
  styles: any;
  onImagePress: (uri: string) => void;
}) {
  const uri = mediaUrl(att.url);
  if (att.type === "image") {
    // Tap opens an in-app fullscreen viewer (lightbox) rather than navigating —
    // routing an image URL through the app produced an "unmatched route".
    return (
      <TouchableOpacity onPress={() => uri && onImagePress(uri)} activeOpacity={0.9}>
        <Image source={{ uri }} style={styles.imageAtt} contentFit="cover" />
      </TouchableOpacity>
    );
  }
  if (att.type === "sticker") {
    return <Text style={{ fontSize: 56 }}>{att.name || "🎟️"}</Text>;
  }
  const icon = att.type === "voice" ? "mic-outline" : "document-outline";
  return (
    <TouchableOpacity onPress={() => openExternal(uri)} style={styles.fileAtt} activeOpacity={0.8}>
      <Ionicons name={icon as any} size={20} color={c.accent} />
      <Text style={styles.fileName} numberOfLines={1}>
        {att.type === "voice" ? "Voice message" : att.name || "Attachment"}
      </Text>
      <Ionicons name="download-outline" size={16} color={c.textMuted} />
    </TouchableOpacity>
  );
}

function VoiceButton({ c, styles, onRecorded, onError }: any) {
  // Only mounted when the native audio module is available, so the hook is safe.
  const {
    useAudioRecorder,
    RecordingPresets,
    requestRecordingPermissionsAsync,
    setAudioModeAsync,
  } = require("expo-audio");
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const startedAt = useRef(0);

  const start = async () => {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        onError("Microphone permission denied");
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      startedAt.current = Date.now();
      setRecording(true);
    } catch {
      onError("Couldn't start recording");
    }
  };

  const stop = async () => {
    if (!recording) return;
    try {
      await recorder.stop();
      setRecording(false);
      const dur = Date.now() - startedAt.current;
      if (recorder.uri && dur > 600) onRecorded(recorder.uri, dur);
    } catch {
      setRecording(false);
      onError("Recording failed");
    }
  };

  return (
    <TouchableOpacity
      style={[styles.sendBtn, recording && { backgroundColor: c.dangerText, transform: [{ scale: 1.15 }] }]}
      onPressIn={start}
      onPressOut={stop}
      activeOpacity={0.8}
    >
      <Ionicons name={recording ? "stop" : "mic"} size={18} color="#fff" />
    </TouchableOpacity>
  );
}

function SheetItem({ icon, label, onPress, danger, c, styles }: any) {
  return (
    <TouchableOpacity style={styles.sheetItem} onPress={onPress} activeOpacity={0.7}>
      <Ionicons name={icon} size={20} color={danger ? c.dangerText : c.text} />
      <Text style={[styles.sheetLabel, danger && { color: c.dangerText }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const makeStyles = (c: any) =>
  StyleSheet.create({
    loader: { flex: 1, backgroundColor: c.bg, justifyContent: "center", alignItems: "center" },
    errBar: { backgroundColor: "#dc2626", padding: 10 },
    errText: { color: "#fff", fontWeight: "700", textAlign: "center", fontSize: 13 },

    list: { flex: 1, backgroundColor: c.bg },
    listContent: { padding: 14, paddingBottom: 14 },

    loadOlder: { paddingVertical: 12, alignItems: "center" },
    loadOlderText: { color: c.textMuted, fontSize: 12, fontWeight: "600" },

    empty: { paddingVertical: 50, alignItems: "center" },
    emptyText: { color: c.textMuted, fontSize: 14 },

    bubbleRow: { marginBottom: 6 },
    bubbleCol: { flexShrink: 1, maxWidth: "80%" },
    // Author avatar sits at the bottom of the group, WhatsApp-style; grouped
    // follow-up messages get a same-width spacer so bubbles stay aligned.
    msgAvatar: { marginRight: 8, alignSelf: "flex-end" },
    msgAvatarSpacer: { width: 28, marginRight: 8 },
    author: { color: c.textMuted, fontSize: 11, fontWeight: "600", marginLeft: 4, marginBottom: 3 },

    bubble: { maxWidth: "100%", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
    mine: { backgroundColor: c.accent, borderBottomRightRadius: 4 },
    theirs: { backgroundColor: c.surfaceMuted, borderBottomLeftRadius: 4 },
    bubbleText: { color: c.text, fontSize: 15, lineHeight: 20 },
    deletedText: { color: c.textMuted, fontSize: 14, fontStyle: "italic" },

    metaRow: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-end", marginTop: 3 },
    time: { color: c.textMuted, fontSize: 10 },
    edited: { color: c.textMuted, fontSize: 10, fontStyle: "italic" },
    moreBtn: { paddingHorizontal: 2, marginLeft: 2, ...(Platform.OS === "web" ? { cursor: "pointer" } as any : {}) },

    // Fullscreen image viewer (lightbox)
    viewerBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.92)",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
    },
    viewerImage: { width: "100%", height: "100%" },
    viewerClose: {
      position: "absolute",
      top: 40,
      right: 20,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "rgba(255,255,255,0.15)",
      alignItems: "center",
      justifyContent: "center",
    },
    viewerOpen: {
      position: "absolute",
      top: 40,
      left: 20,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "rgba(255,255,255,0.15)",
      alignItems: "center",
      justifyContent: "center",
    },

    imageAtt: { width: 210, height: 210, borderRadius: 12, marginBottom: 4, backgroundColor: c.surfaceBorder },
    fileAtt: {
      flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: c.surface,
      borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 4,
      borderWidth: 1, borderColor: c.surfaceBorder, minWidth: 160,
    },
    fileName: { flex: 1, color: c.text, fontSize: 13, fontWeight: "600" },

    mentionBox: {
      backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.surfaceBorder,
    },
    mentionRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10 },
    mentionName: { color: c.text, fontSize: 14, fontWeight: "600" },
    mentionEmail: { color: c.textMuted, fontSize: 11 },

    editingBar: {
      flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14,
      paddingVertical: 8, backgroundColor: c.surfaceMuted,
      borderTopWidth: 1, borderTopColor: c.surfaceBorder,
    },
    editingText: { flex: 1, color: c.text, fontSize: 12, fontWeight: "600" },

    emojiBar: {
      backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.surfaceBorder,
      paddingVertical: 6, paddingHorizontal: 6,
    },
    emojiBtn: { paddingHorizontal: 8, paddingVertical: 4 },

    composer: {
      flexDirection: "row", alignItems: "flex-end", gap: 8, padding: 10,
      borderTopWidth: 1, borderTopColor: c.surfaceBorder, backgroundColor: c.bg,
    },
    inputWrap: {
      flex: 1, flexDirection: "row", alignItems: "flex-end", gap: 2,
      backgroundColor: c.surfaceMuted, borderRadius: 22,
      borderWidth: 1, borderColor: c.surfaceBorder,
      paddingHorizontal: 6, paddingVertical: 4,
    },
    inBtn: { padding: 6 },
    input: {
      flex: 1, color: c.text, fontSize: 15, paddingHorizontal: 4,
      paddingVertical: Platform.OS === "ios" ? 8 : 4, paddingTop: 8,
    },
    sendBtn: {
      width: 44, height: 44, borderRadius: 22, backgroundColor: c.accent,
      alignItems: "center", justifyContent: "center",
    },

    sheetBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
    sheet: {
      backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20,
      padding: 8, paddingBottom: 24,
    },
    sheetItem: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
    sheetLabel: { color: c.text, fontSize: 15, fontWeight: "600" },
    sheetNote: { color: c.textMuted, fontSize: 12, paddingHorizontal: 16, paddingVertical: 6, fontStyle: "italic" },
  });
