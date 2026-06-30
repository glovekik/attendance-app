import React, {
  useEffect,
  useMemo,
  useState,
  useCallback } from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useRouter, useFocusEffect } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import {
  getMyTasks,
  completeTask,
  startTask } from "../../src/services/tasks";

import {
  syncRemindersToTasks,
  cancelTaskReminder,
  reminderLabel } from "../../src/services/reminders";

import { requestNotificationPermission } from "../../src/services/notifications";

import { Task } from "../../src/types";
import { useTheme } from "../../src/theme/ThemeProvider";
import { taskPriorityColor } from "../../src/theme/statusColors";

const isToday = (iso?: string | null) => {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
};

export default function Tasks() {

  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [popup, setPopup] = useState({
    visible: false,
    type: "success" as "success" | "error",
    message: "" });

  const showPopup = (
    msg: string,
    kind: "success" | "error" = "success"
  ) => {
    setPopup({ visible: true, type: kind, message: msg });
    setTimeout(() => {
      setPopup((p) => ({ ...p, visible: false }));
    }, 2500);
  };

  // ================= LOAD =================
  const load = async () => {

    try {

      const token = await AsyncStorage.getItem("token");

      if (!token) {
        router.replace("/login");
        return;
      }

      const res = await getMyTasks(token);

      const list = res || [];
      setTasks(list);

      await syncRemindersToTasks(list);

    } catch (err: any) {
      showPopup(err?.message || "Failed to load tasks", "error");
    }

    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    requestNotificationPermission();
    load();
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  // ================= COMPLETE =================
  const confirmDone = (title: string): Promise<boolean> => {
    const msg = `"${title}" will be added to today's work notes. This can't be undone.`;

    if (Platform.OS === "web") {
      const ok = typeof window !== "undefined" &&
        window.confirm(`Mark as done?\n\n${msg}`);
      return Promise.resolve(!!ok);
    }

    return new Promise((resolve) => {
      Alert.alert(
        "Mark as done?",
        msg,
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => resolve(false) },
          {
            text: "Mark done",
            onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) }
      );
    });
  };

  const askComplete = async (task: Task) => {

    if (busyId) return;
    if (task.status === "COMPLETED") return;

    const ok = await confirmDone(task.title);
    if (!ok) return;

    doComplete(task);
  };

  const doComplete = async (task: Task) => {

    try {

      setBusyId(task.id);

      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }

      await completeTask(token, task.id);
      await cancelTaskReminder(task.id);

      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? {
                ...t,
                status: "COMPLETED",
                completedAt: new Date().toISOString() }
            : t
        )
      );

      showPopup("Task completed");

    } catch (err: any) {
      showPopup(err?.message || "Failed to update task", "error");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  // Open = PENDING or ONGOING. Sorted: ONGOING first (in-progress on top),
  // then by priority desc, then by createdAt.
  const PRIORITY_RANK: Record<string, number> = {
    CRITICAL: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1 };
  const open = tasks
    .filter((t) => t.status === "PENDING" || t.status === "ONGOING")
    .sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === "ONGOING" ? -1 : 1;
      }
      const ar = PRIORITY_RANK[a.priority || "MEDIUM"] || 2;
      const br = PRIORITY_RANK[b.priority || "MEDIUM"] || 2;
      return br - ar;
    });
  const doneToday = tasks.filter(
    (t) => t.status === "COMPLETED" && isToday(t.completedAt)
  );

  const doStart = async (task: Task) => {
    if (busyId) return;
    try {
      setBusyId(task.id);
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      await startTask(token, task.id);
      // Cancel reminder — once the task is in-progress, no need to keep
      // pinging the assignee.
      await cancelTaskReminder(task.id);
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id
            ? {
                ...t,
                status: "ONGOING",
                startedAt: new Date().toISOString() }
            : t
        )
      );
    } catch (err: any) {
      showPopup(err?.message || "Failed to start task", "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>

      {popup.visible && (
        <View
          style={[
            styles.popup,
            popup.type === "success"
              ? styles.successPopup
              : styles.errorPopup,
          ]}
        >
          <Text style={styles.popupText}>
            {popup.message}
          </Text>
        </View>
      )}

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={c.accent}
          />
        }
      >

        <View style={styles.header}>

          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          >
            <Ionicons
              name="chevron-back"
              size={22}
              color={c.text}
            />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Assigned Tasks</Text>
            <Text style={styles.subtitle}>
              {open.length} open
              {doneToday.length > 0
                ? `  ·  ${doneToday.length} done today`
                : ""}
            </Text>
          </View>

        </View>

        {open.length === 0 && doneToday.length === 0 && (
          <View style={styles.emptyBox}>
            <Ionicons
              name="checkmark-done-outline"
              size={48}
              color={c.textFaint}
            />
            <Text style={styles.emptyTitle}>
              All caught up
            </Text>
            <Text style={styles.emptySub}>
              No tasks waiting on you.
            </Text>
          </View>
        )}

        {open.length > 0 && (
          <Text style={styles.section}>OPEN</Text>
        )}

        {open.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            busy={busyId === task.id}
            onCheck={() => askComplete(task)}
            onStart={() => doStart(task)}
            onOpen={() => router.push(`/tasks/${task.id}`)}
            styles={styles}
            c={c}
          />
        ))}

        {doneToday.length > 0 && (
          <Text
            style={[styles.section, { marginTop: 24 }]}
          >
            DONE TODAY
          </Text>
        )}

        {doneToday.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            busy={false}
            onCheck={() => {}}
            onStart={() => {}}
            onOpen={() => router.push(`/tasks/${task.id}`)}
            styles={styles}
            c={c}
          />
        ))}

      </ScrollView>

    </SafeAreaView>
  );
}

interface RowProps {
  task: Task;
  busy: boolean;
  onCheck: () => void;
  onStart: () => void;
  onOpen: () => void;
  styles: any;
  c: any;
}

const TaskRow = ({ task, busy, onCheck, onStart, onOpen, styles, c }: RowProps) => {

  const done = task.status === "COMPLETED";
  const ongoing = task.status === "ONGOING";
  const priority = task.priority || "MEDIUM";

  return (
    <TouchableOpacity
      style={[
        styles.row,
        done && styles.rowDone,
        ongoing && styles.rowOngoing,
      ]}
      onPress={onOpen}
      activeOpacity={0.85}
    >

      <TouchableOpacity
        style={styles.checkBox}
        onPress={onCheck}
        disabled={busy || done}
        hitSlop={8}
      >
        {busy ? (
          <ActivityIndicator size="small" color={c.accent} />
        ) : (
          <Ionicons
            name={
              done
                ? "checkmark-circle"
                : ongoing
                ? "play-circle"
                : "ellipse-outline"
            }
            size={28}
            color={
              done ? c.successText : ongoing ? c.accent : c.textFaint
            }
          />
        )}
      </TouchableOpacity>

      <View style={{ flex: 1 }}>

        <View style={styles.titleRow}>
          <Text
            style={[
              styles.rowTitle,
              { flex: 1 },
              done && styles.rowTitleDone,
            ]}
            numberOfLines={2}
          >
            {task.title}
          </Text>
          {!done && (() => {
            const pri = taskPriorityColor(priority, c);
            return (
              <View
                style={[
                  styles.priorityPill,
                  { backgroundColor: pri.bg, borderColor: pri.solid, borderWidth: 1 },
                ]}
              >
                <Text style={[styles.priorityText, { color: pri.fg }]}>{priority}</Text>
              </View>
            );
          })()}
        </View>

        {task.description ? (
          <Text
            style={styles.rowDesc}
            numberOfLines={2}
          >
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

          {task.teamName ? (
            <View style={styles.metaChip}>
              <Ionicons
                name="people-outline"
                size={11}
                color={c.textMuted}
              />
              <Text style={styles.metaText}>
                {task.teamName}
              </Text>
            </View>
          ) : null}

          {task.reminderIntervalMinutes && !done ? (
            <View
              style={[
                styles.metaChip,
                { backgroundColor: "#1e293b" },
              ]}
            >
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

          {task.dueDate ? (
            <View style={styles.metaChip}>
              <Ionicons
                name="calendar-outline"
                size={11}
                color={c.textMuted}
              />
              <Text style={styles.metaText}>
                {task.dueDate}
              </Text>
            </View>
          ) : null}

          {ongoing && (
            <View style={[styles.metaChip, { backgroundColor: "#1e3a8a" }]}>
              <Ionicons
                name="time-outline"
                size={11}
                color="#93c5fd"
              />
              <Text style={[styles.metaText, { color: "#93c5fd" }]}>
                in progress
              </Text>
            </View>
          )}

          {task.attachments && task.attachments.length > 0 && (
            <View style={styles.metaChip}>
              <Ionicons
                name="attach"
                size={11}
                color={c.textMuted}
              />
              <Text style={styles.metaText}>
                {task.attachments.length}
              </Text>
            </View>
          )}

        </View>

      </View>

      {task.status === "PENDING" && (
        <TouchableOpacity
          style={styles.startBtn}
          onPress={onStart}
          disabled={busy}
          hitSlop={4}
        >
          <Ionicons name="play" size={14} color="#fff" />
          <Text style={styles.startBtnText}>Start</Text>
        </TouchableOpacity>
      )}

      <Ionicons
        name="chevron-forward"
        size={18}
        color={c.textFaint}
      />

    </TouchableOpacity>
  );
};

const makeStyles = (c: any) => StyleSheet.create({

  safe: {
    flex: 1,
    backgroundColor: c.bg },

  container: {
    flex: 1 },

  content: {
    padding: 20,
    paddingBottom: 60 },

  loader: {
    flex: 1,
    backgroundColor: c.bg,
    justifyContent: "center",
    alignItems: "center" },

  popup: {
    position: "absolute",
    top: 60,
    left: 20,
    right: 20,
    padding: 14,
    borderRadius: 14,
    zIndex: 999 },

  successPopup: { backgroundColor: "#16a34a" },
  errorPopup: { backgroundColor: "#dc2626" },

  popupText: {
    color: c.text,
    fontWeight: "700",
    textAlign: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
    marginTop: 10,
    gap: 12 },

  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: c.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: c.surfaceBorder },

  title: {
    color: c.text,
    fontSize: 24,
    fontWeight: "800" },

  subtitle: {
    color: c.textMuted,
    fontSize: 13,
    marginTop: 3 },

  section: {
    color: c.textMuted,
    fontSize: 12,
    letterSpacing: 1.5,
    marginBottom: 10,
    fontWeight: "700" },

  emptyBox: {
    alignItems: "center",
    padding: 40,
    backgroundColor: c.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    marginTop: 20 },

  emptyTitle: {
    color: c.text,
    fontSize: 17,
    fontWeight: "700",
    marginTop: 14 },

  emptySub: {
    color: c.textMuted,
    fontSize: 13,
    marginTop: 6,
    textAlign: "center" },

  row: {
    flexDirection: "row",
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    alignItems: "flex-start" },

  rowDone: {
    opacity: 0.55 },

  rowOngoing: {
    borderColor: c.accent,
    backgroundColor: c.accentSoft },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8 },

  priorityPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4 },

  priorityText: {
    color: c.text,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.5 },

  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.accent,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
    marginRight: 6 },

  startBtnText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800" },

  checkBox: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    marginTop: 1 },

  rowTitle: {
    color: c.text,
    fontSize: 15,
    fontWeight: "700" },

  rowTitleDone: {
    textDecorationLine: "line-through",
    color: c.textMuted },

  rowDesc: {
    color: c.textMuted,
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18 },

  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8 },

  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 4 },

  metaText: {
    color: c.textMuted,
    fontSize: 11,
    fontWeight: "600" } });
