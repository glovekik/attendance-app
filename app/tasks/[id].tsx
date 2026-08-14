import React, {
  useState,
  useCallback, useMemo} from "react";

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

import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  useRouter,
  useLocalSearchParams,
  useFocusEffect,
} from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import {
  getTask,
  completeTask,
  uncompleteTask,
} from "../../src/services/tasks";

import {
  listComments,
  addComment,
  deleteComment,
} from "../../src/services/comments";

import { getMe } from "../../src/services/api";

import { useTheme } from "../../src/theme/ThemeProvider";
import { notify, notifySuccess } from "../../src/utils/confirm";
import {
  scheduleTaskReminder,
  cancelTaskReminder,
  reminderLabel,
} from "../../src/services/reminders";

import {
  Task,
  Comment,
  User,
} from "../../src/types";

export default function TaskDetail() {

  const router = useRouter();

  const { theme } = useTheme();

  const c = theme.colors;

  const styles = useMemo(() => makeStyles(c), [c]);

  const params = useLocalSearchParams();
  const taskId = params.id as string;

  const [me, setMe] = useState<User | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);

  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [posting, setPosting] = useState(false);

  const [draft, setDraft] = useState("");


  // Routed through the shared toast host rather than an in-screen View:
  // a screen-level popup renders BEHIND any open modal, so errors raised
  // from inside a dialog were invisible. See components/ModalToastHost.
  const showPopup = (
    msg: string,
    kind: "success" | "error" = "success"
  ) => {
    if (kind === "error") notify(msg);
    else notifySuccess(msg);
  };

  // ================= LOAD =================
  const load = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }

      const [meRes, taskRes, commentsRes] = await Promise.all([
        getMe(token),
        getTask(token, taskId),
        listComments(token, taskId).catch(() => []),
      ]);

      setMe(meRes);
      setTask(taskRes);
      setComments(commentsRes || []);

    } catch (err: any) {
      showPopup(err?.message || "Failed to load task", "error");
    }
    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [taskId])
  );

  // ================= TOGGLE =================
  const confirmToggle = (reopening: boolean): Promise<boolean> => {
    const title = reopening ? "Reopen task?" : "Mark as done?";
    const body = reopening
      ? "This will move the task back to pending. The task line will be removed from today's work notes."
      : "The task title will be appended to today's work notes.";

    if (Platform.OS === "web") {
      const ok =
        typeof window !== "undefined" &&
        window.confirm(`${title}\n\n${body}`);
      return Promise.resolve(!!ok);
    }
    return new Promise((resolve) => {
      Alert.alert(
        title,
        body,
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => resolve(false),
          },
          {
            text: reopening ? "Reopen" : "Mark done",
            onPress: () => resolve(true),
          },
        ],
        { cancelable: true, onDismiss: () => resolve(false) }
      );
    });
  };

  const toggle = async () => {

    if (!task || toggling) return;

    const reopening = task.status === "COMPLETED";

    const ok = await confirmToggle(reopening);
    if (!ok) return;

    try {

      setToggling(true);

      const token = await AsyncStorage.getItem("token");
      if (!token) return;

      if (reopening) {
        await uncompleteTask(token, task.id);
        const reopened: Task = {
          ...task,
          status: "PENDING",
          completedAt: null,
        };
        setTask(reopened);
        await scheduleTaskReminder(reopened);
        showPopup("Task reopened");
      } else {
        await completeTask(token, task.id);
        await cancelTaskReminder(task.id);
        setTask({
          ...task,
          status: "COMPLETED",
          completedAt: new Date().toISOString(),
        });
        showPopup("Task completed");
      }

    } catch (err: any) {
      showPopup(err?.message || "Failed to update task", "error");
    } finally {
      setToggling(false);
    }
  };

  // ================= POST COMMENT =================
  const submit = async () => {

    const text = draft.trim();
    if (!text || posting || !task) return;

    try {
      setPosting(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;

      const newComment = await addComment(token, task.id, text);
      setComments((prev) => [...prev, newComment]);
      setDraft("");

    } catch (err: any) {
      showPopup(err?.message || "Failed to post comment", "error");
    } finally {
      setPosting(false);
    }
  };

  const removeComment = async (c: Comment) => {

    if (!task) return;

    const ok =
      Platform.OS === "web"
        ? typeof window !== "undefined" &&
          window.confirm("Delete this comment?")
        : await new Promise<boolean>((resolve) => {
            Alert.alert(
              "Delete comment?",
              "",
              [
                {
                  text: "Cancel",
                  style: "cancel",
                  onPress: () => resolve(false),
                },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () => resolve(true),
                },
              ],
              { cancelable: true, onDismiss: () => resolve(false) }
            );
          });

    if (!ok) return;

    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await deleteComment(token, task.id, c.id);
      setComments((prev) => prev.filter((x) => x.id !== c.id));
      showPopup("Comment deleted");
    } catch (err: any) {
      showPopup(err?.message || "Failed to delete", "error");
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  if (!task) {
    return (
      <View style={styles.loader}>
        <Text style={{ color: c.text }}>Task not found</Text>
      </View>
    );
  }

  const done = task.status === "COMPLETED";
  const isAssignee = me?.id === task.assigneeId;

  return (
    <SafeAreaView style={styles.safe}>

      

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
      >

        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >

          {/* HEADER */}
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
            >
              <Ionicons name="chevron-back" size={22} color={c.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Task</Text>
            <View style={{ width: 42 }} />
          </View>

          {/* TITLE & STATUS */}
          <View style={styles.titleCard}>

            <View style={styles.titleRow}>
              <Text
                style={[
                  styles.title,
                  done && {
                    textDecorationLine: "line-through",
                    color: c.textMuted,
                  },
                ]}
              >
                {task.title}
              </Text>

              <View
                style={[
                  styles.statusChip,
                  done
                    ? { backgroundColor: "#16a34a" }
                    : { backgroundColor: c.accent },
                ]}
              >
                <Text style={styles.statusChipText}>
                  {task.status}
                </Text>
              </View>
            </View>

            {task.description ? (
              <Text style={styles.description}>
                {task.description}
              </Text>
            ) : null}

            <View style={styles.metaRow}>
              {task.createdByUser?.name ? (
                <View style={styles.metaChip}>
                  <Ionicons
                    name="person-outline"
                    size={11}
                    color={c.textMuted}
                  />
                  <Text style={styles.metaText}>
                    By {task.createdByUser.name}
                  </Text>
                </View>
              ) : null}

              {task.dueDate ? (
                <View style={styles.metaChip}>
                  <Ionicons
                    name="calendar-outline"
                    size={11}
                    color={c.textMuted}
                  />
                  <Text style={styles.metaText}>
                    Due {task.dueDate}
                  </Text>
                </View>
              ) : null}

              {task.reminderIntervalMinutes && !done ? (
                <View style={styles.metaChip}>
                  <Ionicons
                    name="notifications-outline"
                    size={11}
                    color="#fbbf24"
                  />
                  <Text
                    style={[
                      styles.metaText,
                      { color: "#fbbf24" },
                    ]}
                  >
                    {reminderLabel(task.reminderIntervalMinutes)}
                  </Text>
                </View>
              ) : null}
            </View>

            {isAssignee ? (
              <TouchableOpacity
                style={[
                  styles.toggleBtn,
                  done
                    ? { backgroundColor: c.surfaceMuted }
                    : { backgroundColor: "#16a34a" },
                  toggling && { opacity: 0.7 },
                ]}
                onPress={toggle}
                disabled={toggling}
                activeOpacity={0.85}
              >
                {toggling ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons
                      name={
                        done
                          ? "arrow-undo-outline"
                          : "checkmark-circle-outline"
                      }
                      size={20}
                      color="#fff"
                    />
                    <Text style={styles.toggleText}>
                      {done ? "Reopen" : "Mark done"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <View style={styles.viewerHint}>
                <Ionicons
                  name="eye-outline"
                  size={14}
                  color={c.textMuted}
                />
                <Text style={styles.viewerHintText}>
                  Only the assignee can change this task&apos;s status.
                </Text>
              </View>
            )}

          </View>

          {/* COMMENTS */}
          <Text style={styles.section}>
            COMMENTS · {comments.length}
          </Text>

          {comments.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>
                No comments yet. Start the conversation below.
              </Text>
            </View>
          ) : (
            comments.map((cm) => {
              const mine = cm.userId === me?.id;
              return (
                <View
                  key={cm.id}
                  style={[styles.cRow, mine ? { alignItems: "flex-end" } : { alignItems: "flex-start" }]}
                >
                  {!mine && (
                    <Text style={styles.cAuthor}>{cm.user?.name || "User"}</Text>
                  )}
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onLongPress={() => mine && removeComment(cm)}
                    style={[styles.cBubble, mine ? styles.cMine : styles.cTheirs]}
                  >
                    <Text style={[styles.cText, mine && { color: "#fff" }]}>{cm.text}</Text>
                    <Text style={[styles.cTime, mine && { color: "rgba(255,255,255,0.75)" }]}>
                      {new Date(cm.createdAt).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                      })}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}

        </ScrollView>

        {/* COMPOSER */}
        <View style={styles.composer}>
          <TextInput
            style={styles.composerInput}
            placeholder="Write a comment…"
            placeholderTextColor={c.textFaint}
            value={draft}
            onChangeText={setDraft}
            multiline
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!draft.trim() || posting) && { opacity: 0.4 },
            ]}
            onPress={submit}
            disabled={!draft.trim() || posting}
          >
            {posting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>

    </SafeAreaView>
  );
}

const makeStyles = (c: any) => StyleSheet.create({

  safe: { flex: 1, backgroundColor: c.bg },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 30 },

  loader: {
    flex: 1,
    backgroundColor: c.bg,
    justifyContent: "center",
    alignItems: "center",
  },

  popup: {
    position: "absolute",
    top: 60,
    left: 20,
    right: 20,
    padding: 14,
    borderRadius: 14,
    zIndex: 999,
  },
  successPopup: { backgroundColor: "#16a34a" },
  errorPopup: { backgroundColor: "#dc2626" },
  popupText: {
    color: c.text,
    fontWeight: "700",
    textAlign: "center",
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    marginBottom: 14,
  },
  headerTitle: {
    color: c.text,
    fontSize: 18,
    fontWeight: "700",
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: c.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: c.surfaceBorder,
  },

  titleCard: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  title: {
    color: c.text,
    fontSize: 18,
    fontWeight: "800",
    flex: 1,
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusChipText: {
    color: c.text,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  description: {
    color: c.text,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },

  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 12,
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 4,
  },
  metaText: {
    color: c.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },

  toggleBtn: {
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  toggleText: {
    color: c.text,
    fontWeight: "700",
    fontSize: 15,
  },

  viewerHint: {
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: c.surfaceMuted,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  viewerHintText: {
    color: c.textMuted,
    fontSize: 12,
    flex: 1,
  },

  section: {
    color: c.textMuted,
    fontSize: 12,
    letterSpacing: 1.5,
    fontWeight: "700",
    marginTop: 22,
    marginBottom: 10,
  },

  emptyBox: {
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    alignItems: "center",
  },
  emptyText: {
    color: c.textMuted,
    fontSize: 13,
    textAlign: "center",
  },

  commentBox: {
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
  },
  commentMine: {
    backgroundColor: "#172554",
    borderColor: "#1e3a8a",
  },
  commentHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  commentAuthor: {
    color: c.text,
    fontWeight: "700",
    fontSize: 13,
  },
  commentTime: {
    color: c.textMuted,
    fontSize: 11,
  },
  commentText: {
    color: c.text,
    fontSize: 14,
    lineHeight: 20,
  },
  commentDelete: {
    position: "absolute",
    top: 10,
    right: 10,
    padding: 4,
  },

  // Modern chat bubbles
  cRow: { marginBottom: 8 },
  cAuthor: { color: c.textMuted, fontSize: 11, fontWeight: "600", marginLeft: 12, marginBottom: 3 },
  cBubble: { maxWidth: "80%", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
  cMine: { backgroundColor: c.accent, borderBottomRightRadius: 4 },
  cTheirs: { backgroundColor: c.surfaceMuted, borderBottomLeftRadius: 4 },
  cText: { color: c.text, fontSize: 15, lineHeight: 20 },
  cTime: { color: c.textMuted, fontSize: 10, alignSelf: "flex-end", marginTop: 3 },

  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 10,
    backgroundColor: c.bg,
    borderTopWidth: 1,
    borderTopColor: c.surfaceBorder,
    gap: 8,
  },
  composerInput: {
    flex: 1,
    backgroundColor: c.surfaceMuted,
    color: c.text,
    borderRadius: 22,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    fontSize: 15,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: c.accent,
    justifyContent: "center",
    alignItems: "center",
  },

});
