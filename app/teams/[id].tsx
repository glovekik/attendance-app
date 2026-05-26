import React, {
  useState,
  useCallback, useMemo} from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  Platform,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  useRouter,
  useLocalSearchParams,
  useFocusEffect,
} from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import {
  getTeam,
  listMyLedTeams,
} from "../../src/services/teams";

import {
  getTeamTasks,
  deleteTask,
} from "../../src/services/tasks";

import { listUsers } from "../../src/services/users";
import { getMe } from "../../src/services/api";

import { cancelTaskReminder } from "../../src/services/reminders";

import { useTheme } from "../../src/theme/ThemeProvider";
import {
  Team,
  Task,
  User,
  hasRole,
} from "../../src/types";

export default function TeamDetail() {

  const router = useRouter();

  const { theme } = useTheme();

  const c = theme.colors;

  const styles = useMemo(() => makeStyles(c), [c]);

  const params = useLocalSearchParams();
  const teamId = params.id as string;

  const [me, setMe] = useState<User | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const [popup, setPopup] = useState({
    visible: false,
    type: "success" as "success" | "error",
    message: "",
  });

  const showPopup = (
    msg: string,
    kind: "success" | "error" = "success"
  ) => {
    setPopup({ visible: true, type: kind, message: msg });
    setTimeout(() => {
      setPopup((p) => ({ ...p, visible: false }));
    }, 2500);
  };

  const load = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }

      const meRes = await getMe(token);
      setMe(meRes);

      const isHR = hasRole(meRes, "HR");

      let t: Team;

      if (isHR) {
        const [hrTeam, hrUsers] = await Promise.all([
          getTeam(token, teamId),
          listUsers(token),
        ]);
        t = hrTeam;
        // Filter terminated users from the member-picker pool.
        setUsers(
          (hrUsers || []).filter((u) => u.status !== "Terminated")
        );
      } else {
        const myTeams = await listMyLedTeams(token);
        const found = myTeams.find((x) => x.id === teamId);
        if (!found) {
          throw new Error("Team not found");
        }
        t = found;
      }

      setTeam(t);

      const isLead = meRes?.id === t.teamLeadId;

      if (isLead) {
        const taskList = await getTeamTasks(token, teamId);
        setTasks(taskList || []);
      } else {
        setTasks([]);
      }

    } catch (err: any) {
      showPopup(err?.message || "Failed to load team", "error");
    }
    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [teamId])
  );

  const isHR = hasRole(me, "HR");
  const isLead = !!me && !!team && me.id === team.teamLeadId;

  const userName = (id: string) => {
    // The team lead is returned as `team.teamLead` separately from the
    // members list — check that first so the header shows the real name
    // instead of a truncated id slice.
    if (team?.teamLead && team.teamLead.id === id) {
      return team.teamLead.name;
    }
    if (team?.leadName && team.teamLeadId === id) {
      return team.leadName;
    }
    if (isHR) {
      const u = users.find((x) => x.id === id);
      return u?.name || id.slice(-6);
    }
    if (team?.members) {
      const m = team.members.find((x) => x.id === id);
      if (m) return m.name;
    }
    return id.slice(-6);
  };

  const userEmail = (id: string) => {
    if (team?.teamLead && team.teamLead.id === id) {
      return team.teamLead.email || "";
    }
    if (isHR) {
      return users.find((x) => x.id === id)?.email || "";
    }
    return team?.members?.find((x) => x.id === id)?.email || "";
  };

  const confirmDelete = (title: string): Promise<boolean> => {
    if (Platform.OS === "web") {
      const ok = typeof window !== "undefined" &&
        window.confirm(`Delete "${title}"?`);
      return Promise.resolve(!!ok);
    }
    return new Promise((resolve) => {
      Alert.alert(
        "Delete task?",
        title,
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
  };

  const removeTask = async (task: Task) => {

    const ok = await confirmDelete(task.title);
    if (!ok) return;

    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await deleteTask(token, task.id);
      await cancelTaskReminder(task.id);
      showPopup("Task deleted");
      await load();
    } catch (err: any) {
      showPopup(err?.message || "Delete failed", "error");
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  if (!team) {
    return (
      <View style={styles.loader}>
        <Text style={{ color: c.text }}>Team not found</Text>
      </View>
    );
  }

  const pending = tasks.filter((t) => t.status === "PENDING");
  const done = tasks.filter((t) => t.status === "COMPLETED");

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
          <Text style={styles.popupText}>{popup.message}</Text>
        </View>
      )}

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >

        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          >
            <Ionicons name="chevron-back" size={22} color={c.text} />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{team.name}</Text>
            <Text style={styles.subtitle}>
              Lead: {userName(team.teamLeadId)}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.chatBtn}
            onPress={() =>
              router.push(`/chat/team/${teamId}`)
            }
          >
            <Ionicons
              name="chatbubbles-outline"
              size={20}
              color="#fff"
            />
          </TouchableOpacity>
        </View>

        {/* MEMBERS */}
        <Text style={styles.section}>MEMBERS</Text>

        <View style={styles.membersBox}>
          {team.memberIds.length === 0 && (
            <Text style={styles.emptyText}>No members</Text>
          )}
          {team.memberIds.map((mid) => {
            const n = userName(mid);
            const e = userEmail(mid);
            return (
              <View key={mid} style={styles.memberRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {n.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberName}>{n}</Text>
                  {!!e && (
                    <Text style={styles.memberEmail}>{e}</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* TASKS — only if I am the lead */}
        {isLead && (
          <>
            <View style={styles.tasksHeader}>
              <Text style={styles.section}>TASKS</Text>
              <TouchableOpacity
                style={styles.addTaskBtn}
                onPress={() =>
                  router.push({
                    pathname: "/tasks/new",
                    params: { teamId },
                  })
                }
              >
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.addTaskText}>Assign</Text>
              </TouchableOpacity>
            </View>

            {pending.length > 0 && (
              <Text style={styles.subSection}>PENDING</Text>
            )}

            {pending.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                assigneeName={userName(t.assigneeId)}
                onDelete={() => removeTask(t)}
                onOpen={() => router.push(`/tasks/${t.id}`)}
                styles={styles}
                c={c}
              />
            ))}

            {done.length > 0 && (
              <Text
                style={[styles.subSection, { marginTop: 16 }]}
              >
                COMPLETED
              </Text>
            )}

            {done.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                assigneeName={userName(t.assigneeId)}
                onDelete={() => removeTask(t)}
                onOpen={() => router.push(`/tasks/${t.id}`)}
                styles={styles}
                c={c}
              />
            ))}

            {tasks.length === 0 && (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>No tasks yet</Text>
                <Text style={styles.emptySub}>
                  Tap Assign to create one.
                </Text>
              </View>
            )}
          </>
        )}

        {!isLead && isHR && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptySub}>
              Only the team lead can view and manage this team&apos;s tasks.
            </Text>
          </View>
        )}

      </ScrollView>

    </SafeAreaView>
  );
}

interface TaskCardProps {
  task: Task;
  assigneeName: string;
  onDelete: () => void;
  onOpen: () => void;
  styles: any;
  c: any;
}

const TaskCard = ({
  task,
  assigneeName,
  onDelete,
  onOpen,
  styles,
  c,
}: TaskCardProps) => {

  const done = task.status === "COMPLETED";

  return (
    <TouchableOpacity
      style={[styles.taskCard, done && { opacity: 0.6 }]}
      onPress={onOpen}
      activeOpacity={0.85}
    >
      <View style={{ flex: 1 }}>
        <Text
          style={[
            styles.taskTitle,
            done && {
              textDecorationLine: "line-through",
              color: c.textMuted,
            },
          ]}
        >
          {task.title}
        </Text>
        <Text style={styles.taskMeta}>
          Assigned to {assigneeName}
        </Text>
        {task.reminderIntervalMinutes ? (
          <View style={styles.taskChip}>
            <Ionicons
              name="notifications-outline"
              size={11}
              color="#fbbf24"
            />
            <Text style={styles.taskChipText}>
              every {task.reminderIntervalMinutes}m
            </Text>
          </View>
        ) : null}
        {task.dueDate ? (
          <View style={styles.taskChip}>
            <Ionicons
              name="calendar-outline"
              size={11}
              color={c.textMuted}
            />
            <Text
              style={[
                styles.taskChipText,
                { color: c.textMuted },
              ]}
            >
              {task.dueDate}
            </Text>
          </View>
        ) : null}
      </View>
      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={onDelete}
        hitSlop={6}
      >
        <Ionicons name="trash-outline" size={16} color="#fff" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

const makeStyles = (c: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
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
  popupText: { color: c.text, fontWeight: "700", textAlign: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
    marginTop: 10,
    gap: 12,
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
  chatBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#0ea5e9",
    justifyContent: "center",
    alignItems: "center",
  },
  title: { color: c.text, fontSize: 24, fontWeight: "800" },
  subtitle: { color: c.textMuted, fontSize: 13, marginTop: 3 },

  section: {
    color: c.textMuted,
    fontSize: 12,
    letterSpacing: 1.5,
    fontWeight: "700",
    marginBottom: 10,
    marginTop: 14,
  },
  subSection: {
    color: c.textMuted,
    fontSize: 11,
    letterSpacing: 1,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 8,
  },

  membersBox: {
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    marginBottom: 6,
  },

  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 12,
  },

  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  memberName: { color: c.text, fontSize: 14, fontWeight: "700" },
  memberEmail: { color: c.textMuted, fontSize: 12, marginTop: 2 },

  emptyText: { color: c.textMuted, fontSize: 13, padding: 8 },

  tasksHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  addTaskBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.accent,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    gap: 4,
  },
  addTaskText: { color: c.text, fontWeight: "700", fontSize: 13 },

  taskCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: c.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    gap: 10,
  },
  taskTitle: { color: c.text, fontSize: 14, fontWeight: "700" },
  taskMeta: { color: c.textMuted, fontSize: 12, marginTop: 4 },

  taskChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surfaceMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 4,
    alignSelf: "flex-start",
    marginTop: 6,
  },
  taskChipText: {
    color: "#fbbf24",
    fontSize: 11,
    fontWeight: "600",
  },

  deleteBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#dc2626",
    justifyContent: "center",
    alignItems: "center",
  },

  emptyBox: {
    alignItems: "center",
    padding: 30,
    backgroundColor: c.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    marginTop: 8,
  },
  emptyTitle: { color: c.text, fontSize: 15, fontWeight: "700" },
  emptySub: {
    color: c.textMuted,
    fontSize: 12,
    marginTop: 4,
    textAlign: "center",
  },
});
