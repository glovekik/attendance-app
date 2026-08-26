import React, { useCallback, useEffect, useMemo, useState } from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  getProject,
  getProjectMembers,
  getProjectMemberHistory,
  getProjectTasks,
  getProjectAttendance,
  createProjectTask,
  deleteProjectTask,
  updateProjectTask,
  ProjectTasksResponse,
  ProjectAttendanceResponse,
} from "../../src/services/projects";
import {
  Project,
  ProjectMember,
  ProjectMemberHistoryEntry,
  TaskPriority,
  TASK_PRIORITIES,
} from "../../src/types";
import { confirmAction, notify } from "../../src/utils/confirm";
import { useTheme } from "../../src/theme/ThemeProvider";
import {
  projectStatusColor,
  taskStatusColor,
} from "../../src/theme/statusColors";
import { WebModal, ModalActions } from "../../src/components/WebModal";
import { DatePickerField } from "../../src/components/DatePickerField";
import { Avatar } from "../../src/components/Avatar";

const fmtDate = (s?: string | null) => {
  if (!s) return "—";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const fmtTime = (s?: string | null) => {
  if (!s) return "—";
  // Stored as IST wall-clock with no timezone suffix — read the clock time
  // as-is rather than letting the browser shift it.
  const m = /T(\d{2}):(\d{2})/.exec(s);
  return m ? `${m[1]}:${m[2]}` : "—";
};

export default function ProjectDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);

  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [history, setHistory] = useState<ProjectMemberHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [board, setBoard] = useState<ProjectTasksResponse | null>(null);
  const [attendance, setAttendance] =
    useState<ProjectAttendanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [cTitle, setCTitle] = useState("");
  const [cDesc, setCDesc] = useState("");
  const [cAssignee, setCAssignee] = useState<string | null>(null);
  const [cPriority, setCPriority] = useState<TaskPriority>("MEDIUM");
  const [cDue, setCDue] = useState("");
  const [cSaving, setCSaving] = useState(false);

  const isPM = !!project?.viewerIsManager;

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      // The board is members-only on the server, so it's fetched with its own
      // catch rather than inside the Promise.all — a 403 there would reject
      // the whole batch and blank a page the viewer is allowed to see.
      const [p, m, b] = await Promise.all([
        getProject(token, id),
        getProjectMembers(token, id),
        getProjectTasks(token, id).catch(() => null),
      ]);
      setProject(p);
      setMembers(m.members || []);
      setBoard(b);

      // Manager-only: asking as a plain member would 403 and blank the screen.
      if (p.viewerIsManager) {
        try {
          setAttendance(await getProjectAttendance(token, id));
        } catch {
          setAttendance(null);
        }
      }
    } catch (err: any) {
      notify("Couldn't load project", err?.message || "");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, router]);

  useEffect(() => {
    load();
  }, [load]);

  const loadHistory = useCallback(async () => {
    if (!id) return;
    const token = await AsyncStorage.getItem("token");
    if (!token) return;
    try {
      const h = await getProjectMemberHistory(token, id);
      setHistory(h.history || []);
      setShowHistory(true);
    } catch (err: any) {
      notify("Couldn't load history", err?.message || "");
    }
  }, [id]);

  const openCreate = () => {
    setCTitle("");
    setCDesc("");
    setCAssignee(null);
    setCPriority("MEDIUM");
    setCDue("");
    setCreateOpen(true);
  };

  const onCreate = async () => {
    if (cSaving || !id) return;
    if (!cAssignee) {
      notify("Pick a person", "Choose who to assign this task to.");
      return;
    }
    if (!cTitle.trim()) {
      notify("Title required", "Give the task a short title.");
      return;
    }
    try {
      setCSaving(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await createProjectTask(token, id, {
        title: cTitle.trim(),
        description: cDesc.trim() || undefined,
        assigneeId: cAssignee,
        priority: cPriority,
        dueDate: cDue.trim() || undefined,
      });
      setCreateOpen(false);
      load();
    } catch (err: any) {
      notify("Couldn't create task", err?.message || "");
    } finally {
      setCSaving(false);
    }
  };

  const onDeleteTask = async (taskId: string, title: string) => {
    const ok = await confirmAction({
      title: "Delete task?",
      message: `"${title}" will be removed from this project.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok || !id) return;
    const token = await AsyncStorage.getItem("token");
    if (!token) return;
    try {
      await deleteProjectTask(token, id, taskId);
      load();
    } catch (err: any) {
      notify("Couldn't delete", err?.message || "");
    }
  };

  const onCycleStatus = async (taskId: string, current?: string | null) => {
    if (!id || !isPM) return;
    const token = await AsyncStorage.getItem("token");
    if (!token) return;
    const next =
      current === "PENDING"
        ? "ONGOING"
        : current === "ONGOING"
        ? "COMPLETED"
        : "PENDING";
    try {
      await updateProjectTask(token, id, taskId, { status: next });
      load();
    } catch (err: any) {
      notify("Couldn't update", err?.message || "");
    }
  };

  const pending = (board?.tasks || []).filter((t) => t.status !== "COMPLETED");
  const done = (board?.tasks || []).filter((t) => t.status === "COMPLETED");

  // One row per member, so "absent" reads differently from "no data".
  const attendanceRows = useMemo(() => {
    if (!attendance) return [];
    const byUser: Record<string, (typeof attendance.records)[number]> = {};
    attendance.records.forEach((r) => {
      if (!byUser[r.userId]) byUser[r.userId] = r;
    });
    return attendance.members.map((m) => ({ member: m, record: byUser[m.id] }));
  }, [attendance]);

  if (loading) {
    return (
      <SafeAreaView style={styles.loader}>
        <ActivityIndicator color={c.accent} />
      </SafeAreaView>
    );
  }

  if (!project) {
    return (
      <SafeAreaView style={styles.loader}>
        <Text style={styles.emptySub}>Project not found</Text>
      </SafeAreaView>
    );
  }

  const sc = projectStatusColor(project.status, c);
  const managerNames = members
    .filter((m) => m.role === "manager")
    .map((m) => m.user?.name)
    .filter(Boolean)
    .join(", ");

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={c.accent}
            colors={[c.accent]}
          />
        }
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/projects")
            }
          >
            <Ionicons name="chevron-back" size={22} color={c.text} />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{project.name}</Text>
            <Text style={styles.subtitle}>
              Manager: {managerNames || "—"}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.chatBtn}
            onPress={() => router.push(`/chat/project/${id}` as any)}
          >
            <Ionicons name="chatbubbles-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.metaRow}>
          <View style={[styles.chip, { backgroundColor: sc.bg }]}>
            <Text style={[styles.chipText, { color: sc.fg }]}>
              {project.status}
            </Text>
          </View>
          {!!project.code && (
            <View style={styles.chip}>
              <Text style={[styles.chipText, { color: c.textMuted }]}>
                {project.code}
              </Text>
            </View>
          )}
          {!!board && (
            <View style={styles.chip}>
              <Text style={[styles.chipText, { color: c.textMuted }]}>
                {board.counts.COMPLETED}/{board.total} done
              </Text>
            </View>
          )}
        </View>

        {/* MEMBERS */}
        <Text style={styles.section}>MEMBERS</Text>

        <View style={styles.membersBox}>
          {members.length === 0 && (
            <Text style={styles.emptyText}>No members</Text>
          )}
          {members.map((m) => (
            <View key={`${m.userId}-${m.joinedAt}`} style={styles.memberRow}>
              <Avatar
                name={m.user?.name || "?"}
                uri={m.user?.profilePictureUrl || undefined}
                size={36}
                bg={c.accent}
                fg="#fff"
                fontSize={14}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>
                  {m.user?.name || m.userId}
                </Text>
                <Text style={styles.memberEmail}>
                  {m.user?.jobTitle || "—"}  ·  since {fmtDate(m.joinedAt)}
                </Text>
              </View>
              {m.role === "manager" && (
                <View style={styles.chip}>
                  <Text style={[styles.chipText, { color: c.accent }]}>
                    MANAGER
                  </Text>
                </View>
              )}
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.linkBtn}
          onPress={() => (showHistory ? setShowHistory(false) : loadHistory())}
        >
          <Ionicons
            name={showHistory ? "chevron-up" : "time-outline"}
            size={15}
            color={c.accent}
          />
          <Text style={styles.linkBtnText}>
            {showHistory ? "Hide member history" : "Member history"}
          </Text>
        </TouchableOpacity>

        {showHistory && (
          <View style={styles.membersBox}>
            {history.length === 0 && (
              <Text style={styles.emptyText}>No membership changes yet.</Text>
            )}
            {history.map((h, i) => (
              <View
                key={`${h.userId}-${h.joinedAt}-${i}`}
                style={styles.histRow}
              >
                <View
                  style={[
                    styles.histDot,
                    { backgroundColor: h.leftAt ? c.textMuted : c.accent },
                  ]}
                />
                <Text style={styles.histText}>
                  <Text style={styles.memberName}>
                    {h.user?.name || h.userId}
                  </Text>
                  {"  "}
                  {h.role === "manager" ? "managed" : "was a member"} from{" "}
                  {fmtDate(h.joinedAt)}{" "}
                  {h.leftAt ? `to ${fmtDate(h.leftAt)}` : "— still on it"}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* TASKS */}
        <View style={styles.tasksHeader}>
          <Text style={styles.section}>TASKS</Text>
          {isPM && (
            <TouchableOpacity style={styles.addTaskBtn} onPress={openCreate}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.addTaskText}>Assign</Text>
            </TouchableOpacity>
          )}
        </View>

        {pending.length > 0 && (
          <Text style={styles.subSection}>PENDING</Text>
        )}
        {pending.map((t) => (
          <TaskRow
            key={t.id}
            task={t}
            isPM={isPM}
            styles={styles}
            c={c}
            onOpen={() => router.push(`/tasks/${t.id}` as any)}
            onCycle={() => onCycleStatus(t.id, t.status)}
            onDelete={() => onDeleteTask(t.id, t.title)}
          />
        ))}

        {done.length > 0 && (
          <Text style={[styles.subSection, { marginTop: 16 }]}>COMPLETED</Text>
        )}
        {done.map((t) => (
          <TaskRow
            key={t.id}
            task={t}
            isPM={isPM}
            styles={styles}
            c={c}
            onOpen={() => router.push(`/tasks/${t.id}` as any)}
            onCycle={() => onCycleStatus(t.id, t.status)}
            onDelete={() => onDeleteTask(t.id, t.title)}
          />
        ))}

        {(board?.tasks.length || 0) === 0 && (
          <View style={styles.emptyBox}>
            {/* `board === null` means the server withheld the board, which is
                a different thing from the project having no work on it. */}
            <Text style={styles.emptyTitle}>
              {board ? "No tasks yet" : "Tasks are private"}
            </Text>
            <Text style={styles.emptySub}>
              {!board
                ? "Only people on this project can see its tasks."
                : isPM
                ? "Tap Assign to create one."
                : "Your project manager assigns work here."}
            </Text>
          </View>
        )}

        {/* ATTENDANCE — manager only */}
        {isPM && (
          <>
            <Text style={styles.section}>TODAY&apos;S ATTENDANCE</Text>
            <View style={styles.membersBox}>
              {attendanceRows.length === 0 && (
                <Text style={styles.emptyText}>No members to show</Text>
              )}
              {attendanceRows.map(({ member, record }) => {
                const asc = taskStatusColor(
                  record ? "COMPLETED" : "PENDING",
                  c
                );
                return (
                  <View key={member.id} style={styles.memberRow}>
                    <Avatar
                      name={member.name || "?"}
                      uri={member.profilePictureUrl || undefined}
                      size={36}
                      bg={c.accent}
                      fg="#fff"
                      fontSize={14}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberName}>{member.name}</Text>
                      <Text style={styles.memberEmail}>
                        {record
                          ? `${fmtTime(record.checkIn)} – ${fmtTime(
                              record.checkOut
                            )}${record.isLate ? "  ·  late" : ""}`
                          : "No record today"}
                      </Text>
                    </View>
                    <View style={[styles.chip, { backgroundColor: asc.bg }]}>
                      <Text style={[styles.chipText, { color: asc.fg }]}>
                        {record?.status || "ABSENT"}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      {/* CREATE TASK */}
      <WebModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        title={`New task · ${project.name}`}
        size="md"
        footer={
          <ModalActions align="spread">
            <TouchableOpacity
              style={[styles.mBtn, styles.mBtnGhost]}
              onPress={() => setCreateOpen(false)}
            >
              <Text style={styles.mBtnGhostText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.mBtn, styles.mBtnPrimary]}
              onPress={onCreate}
              disabled={cSaving}
            >
              <Text style={styles.mBtnPrimaryText}>
                {cSaving ? "…" : "Assign"}
              </Text>
            </TouchableOpacity>
          </ModalActions>
        }
      >
        <Text style={styles.label}>Assign to</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
        >
          {members.map((m) => {
            const active = cAssignee === m.userId;
            return (
              <TouchableOpacity
                key={m.userId}
                style={[styles.pick, active && styles.pickActive]}
                onPress={() => setCAssignee(m.userId)}
              >
                <Text
                  style={[styles.pickText, active && styles.pickTextActive]}
                >
                  {(m.user?.name || "?").split(" ")[0]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={styles.label}>Title *</Text>
        <TextInput
          style={styles.input}
          value={cTitle}
          onChangeText={setCTitle}
          placeholder="Short, action-oriented title"
          placeholderTextColor={c.textFaint}
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, { minHeight: 72 }]}
          value={cDesc}
          onChangeText={setCDesc}
          placeholder="Context, links, expected output…"
          placeholderTextColor={c.textFaint}
          multiline
          textAlignVertical="top"
        />

        <Text style={styles.label}>Priority</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {TASK_PRIORITIES.map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.pick, cPriority === p && styles.pickActive]}
              onPress={() => setCPriority(p)}
            >
              <Text
                style={[
                  styles.pickText,
                  cPriority === p && styles.pickTextActive,
                ]}
              >
                {p}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Due date</Text>
        <DatePickerField
          value={cDue}
          onChange={setCDue}
          placeholder="Optional — tap to pick"
        />
      </WebModal>
    </SafeAreaView>
  );
}

interface TaskRowProps {
  task: any;
  isPM: boolean;
  styles: any;
  c: any;
  onOpen: () => void;
  onCycle: () => void;
  onDelete: () => void;
}

const TaskRow = ({
  task,
  isPM,
  styles,
  c,
  onOpen,
  onCycle,
  onDelete,
}: TaskRowProps) => {
  const done = task.status === "COMPLETED";
  const sc = taskStatusColor(task.status, c);

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
          Assigned to {task.assignee?.name || "—"}
        </Text>
        <View style={{ flexDirection: "row", gap: 6 }}>
          <TouchableOpacity
            disabled={!isPM}
            onPress={onCycle}
            style={[styles.taskChip, { backgroundColor: sc.bg }]}
          >
            <Text style={[styles.taskChipText, { color: sc.fg }]}>
              {task.status}
            </Text>
          </TouchableOpacity>
          {task.dueDate ? (
            <View style={styles.taskChip}>
              <Ionicons name="calendar-outline" size={11} color={c.textMuted} />
              <Text style={[styles.taskChipText, { color: c.textMuted }]}>
                {task.dueDate}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {isPM && (
        <TouchableOpacity style={styles.deleteBtn} onPress={onDelete}>
          <Ionicons name="trash-outline" size={16} color="#fff" />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

const makeStyles = (c: any) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    container: { flex: 1 },
    content: { padding: 20, paddingBottom: 60 },
    loader: {
      flex: 1,
      backgroundColor: c.bg,
      justifyContent: "center",
      alignItems: "center",
    },

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

    metaRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },

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
    memberName: { color: c.text, fontSize: 14, fontWeight: "700" },
    memberEmail: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    emptyText: { color: c.textMuted, fontSize: 13, padding: 8 },

    histRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      paddingVertical: 7,
    },
    histDot: { width: 7, height: 7, borderRadius: 4, marginTop: 6 },
    histText: { color: c.textMuted, fontSize: 12, flex: 1, lineHeight: 18 },

    linkBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 10,
    },
    linkBtnText: { color: c.accent, fontSize: 13, fontWeight: "700" },

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
    addTaskText: { color: "#fff", fontWeight: "700", fontSize: 13 },

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
    taskChipText: { fontSize: 11, fontWeight: "600" },
    deleteBtn: {
      width: 30,
      height: 30,
      borderRadius: 8,
      backgroundColor: "#dc2626",
      justifyContent: "center",
      alignItems: "center",
    },

    chip: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: c.surfaceMuted,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      gap: 4,
      alignSelf: "flex-start",
    },
    chipText: { fontSize: 11, fontWeight: "600" },

    emptyBox: {
      alignItems: "center",
      padding: 30,
      backgroundColor: c.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
    },
    emptyTitle: { color: c.text, fontSize: 16, fontWeight: "700" },
    emptySub: {
      color: c.textMuted,
      fontSize: 13,
      marginTop: 6,
      textAlign: "center",
    },

    label: {
      color: c.textMuted,
      fontSize: 12,
      fontWeight: "700",
      marginTop: 12,
      marginBottom: 6,
    },
    input: {
      backgroundColor: c.surfaceMuted,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: c.text,
      fontSize: 14,
    },
    pick: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      backgroundColor: c.surfaceMuted,
    },
    pickActive: { backgroundColor: c.accent, borderColor: c.accent },
    pickText: { color: c.textMuted, fontSize: 12, fontWeight: "700" },
    pickTextActive: { color: "#fff" },

    mBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
    mBtnGhost: { borderWidth: 1, borderColor: c.surfaceBorder },
    mBtnGhostText: { color: c.textMuted, fontWeight: "700", fontSize: 13 },
    mBtnPrimary: { backgroundColor: c.accent },
    mBtnPrimaryText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  });
