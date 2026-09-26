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
  Pressable,
  Platform,
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
  setProjectTechnologies,
  ProjectTasksResponse,
  ProjectAttendanceResponse,
} from "../../../src/services/projects";
import {
  Project,
  ProjectMember,
  ProjectMemberHistoryEntry,
  TaskPriority,
  TaskStatus,
  TASK_PRIORITIES,
  User,
} from "../../../src/types";
import { confirmAction, notify } from "../../../src/utils/confirm";
import { useTheme } from "../../../src/theme/ThemeProvider";
import { ProjectHero } from "../../../src/components/ProjectHero";
import { ProjectBoard } from "../../../src/components/ProjectBoard";
import { ProjectPhases } from "../../../src/components/ProjectPhases";
import { ProjectMeetings } from "../../../src/components/ProjectMeetings";
import {
  PhasesResponse,
  ProjectMeeting,
  createProjectMeeting,
  createProjectPhase,
  deleteProjectMeeting,
  deleteProjectPhase,
  getProjectMeetings,
  getProjectPhases,
  setProjectProgress,
  setTaskWeight,
  updateProjectMeeting,
  updateProjectPhase,
} from "../../../src/services/projectPlanning";
import {
  projectStatusColor,
  taskStatusColor,
} from "../../../src/theme/statusColors";
import { WebModal, ModalActions } from "../../../src/components/WebModal";
import { DatePickerField } from "../../../src/components/DatePickerField";
import { Avatar } from "../../../src/components/Avatar";
import { getMe } from "../../../src/services/api";
import {
  BottomTabBar,
  BOTTOM_BAR_RESERVED_HEIGHT,
} from "../../../src/components/BottomTabBar";

type ProjectTab =
  | "overview" | "phases" | "tasks" | "board"
  | "meetings" | "team" | "files";

/** Only the sections that exist today. Others join as they're built, so the
 *  bar never offers a tab that opens onto nothing. */
const TABS: { key: ProjectTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "overview", label: "Overview", icon: "grid-outline" },
  { key: "phases", label: "Phases", icon: "layers-outline" },
  { key: "tasks", label: "Tasks", icon: "checkbox-outline" },
  { key: "board", label: "Board", icon: "albums-outline" },
  { key: "meetings", label: "Meetings", icon: "document-text-outline" },
  { key: "team", label: "Team", icon: "people-outline" },
  { key: "files", label: "Files", icon: "folder-outline" },
];

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
  // Sections are tabs rather than one long scroll: the page already carried
  // members, tasks and attendance, and the concepts still to come (files,
  // timeline, meetings) would make a single column unusable on a phone.
  const [tab, setTab] = useState<ProjectTab>("overview");
  // Technologies edit in place: the chips are the editor, so there's no
  // separate form to open and no saved/unsaved ambiguity.
  const [techInput, setTechInput] = useState("");
  const [techSaving, setTechSaving] = useState(false);
  // Which card's "move to" menu is open on the board.
  const [moving, setMoving] = useState<string | null>(null);
  const [phases, setPhases] = useState<PhasesResponse | null>(null);
  const [meetings, setMeetings] = useState<ProjectMeeting[]>([]);
  const [planBusy, setPlanBusy] = useState(false);
  // For the mobile bottom bar, which every other screen has and
  // these three didn't — tapping into Projects lost the nav.
  const [me, setMe] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [cTitle, setCTitle] = useState("");
  const [cDesc, setCDesc] = useState("");
  const [cAssignee, setCAssignee] = useState<string | null>(null);
  const [cPriority, setCPriority] = useState<TaskPriority>("MEDIUM");
  const [cDue, setCDue] = useState("");
  // Which phase a new task lands in. Set when the form is opened from a
  // phase, so "add a task under this phase" does what it says.
  const [cPhase, setCPhase] = useState<string | null>(null);
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
      const [p, meRes, m, b, ph, mt] = await Promise.all([
        getProject(token, id),
        getMe(token).catch(() => null),
        getProjectMembers(token, id),
        getProjectTasks(token, id).catch(() => null),
        // Both degrade to nothing rather than failing the whole screen: a
        // project with no phases or meetings is the normal starting state.
        getProjectPhases(token, id).catch(() => null),
        getProjectMeetings(token, id).catch(() => null),
      ]);
      setProject(p);
      setMe(meRes);
      setMembers(m.members || []);
      setBoard(b);
      setPhases(ph);
      setMeetings(mt?.meetings || []);

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

  // Add / remove a stack tag. The server de-duplicates and trims, and we
  // take its response as the truth rather than guessing what it stored.
  const saveTech = async (next: string[]) => {
    if (!project || techSaving) return;
    setTechSaving(true);
    const previous = project.technologies || [];
    // Optimistic: chips are a label row, and waiting on a round-trip to see
    // your own tag appear feels broken. Rolled back if the save fails.
    setProject({ ...project, technologies: next });
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const res = await setProjectTechnologies(token, String(id), next);
      setProject((cur) => (cur ? { ...cur, technologies: res.technologies } : cur));
      setTechInput("");
    } catch (err: any) {
      setProject((cur) => (cur ? { ...cur, technologies: previous } : cur));
      notify("Couldn't save", err?.message || "");
    } finally {
      setTechSaving(false);
    }
  };

  // Move a task between board columns. Tap-to-move rather than drag: drag
  // across web and native, inside a scroll view, on both touch and mouse, is
  // a reliable source of bugs — and a menu works with a keyboard.
  const moveTask = async (taskId: string, status: TaskStatus) => {
    setMoving(null);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await updateProjectTask(token, String(id), taskId, { status });
      await load();
    } catch (err: any) {
      notify("Couldn't move the task", err?.message || "");
    }
  };

  // One helper for every planning write: they all end in "reload so the
  // numbers on screen match the server", and repeating that per action is
  // how one of them ends up forgotten.
  const planAction = async (fn: (token: string) => Promise<unknown>) => {
    if (planBusy) return;
    setPlanBusy(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await fn(token);
      await load();
    } catch (err: any) {
      notify("Couldn't save", err?.message || "");
    } finally {
      setPlanBusy(false);
    }
  };

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

  const openCreate = (phaseId: string | null = null) => {
    setCTitle("");
    setCDesc("");
    setCAssignee(null);
    setCPriority("MEDIUM");
    setCDue("");
    setCPhase(phaseId);
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
        phaseId: cPhase,
        // Claim whatever the phase has left, so a new task is counted
        // rather than silently contributing nothing.
        weight: cPhase
          ? phases?.phases.find((p) => p.id === cPhase)?.taskWeightRemaining ||
            0
          : undefined,
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
        <ProjectHero
          name={project.name}
          status={project.status}
          code={project.code}
          managerNames={managerNames}
          // One number for the page, from the same rollup the Phases tab
          // uses — this used to recompute from task counts and disagree.
          percent={phases?.progress.percent ?? 0}
          sourceNote={
            phases?.progress.source === "manual"
              ? `set by hand · tasks say ${phases.progress.derived}%`
              : phases?.progress.source === "phases"
              ? "weighted across phases"
              : null
          }
          startDate={project.startDate}
          endDate={project.endDate}
          onBack={() =>
            router.canGoBack() ? router.back() : router.replace("/projects")
          }
          onChat={() => router.push(`/chat/project/${id}` as any)}
          stats={[
            {
              icon: "checkbox-outline",
              label: "Tasks",
              value: `${board?.counts.COMPLETED ?? 0}/${board?.total ?? 0}`,
              onPress: () => setTab("board"),
            },
            {
              icon: "layers-outline",
              label: "Phases",
              value: String(phases?.phases.length ?? 0),
              onPress: () => setTab("phases"),
            },
            {
              icon: "people-outline",
              label: "Team",
              value: String(members.length),
              onPress: () => setTab("team"),
            },
            {
              icon: "document-text-outline",
              label: "Meetings",
              value: String(meetings.length),
              onPress: () => setTab("meetings"),
            },
          ]}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBar}
        >
          {TABS.map((t) => {
            const on = tab === t.key;
            return (
              <Pressable
                key={t.key}
                style={({ hovered, pressed }: any) => [
                  styles.tab,
                  // A tab you can't tell is clickable until you click it
                  // isn't a tab; hover is the affordance on web.
                  !on && hovered && styles.tabHover,
                  on && styles.tabOn,
                  pressed && styles.tabPressed,
                ]}
                onPress={() => setTab(t.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
              >
                <Ionicons
                  name={t.icon}
                  size={15}
                  color={on ? c.accentText : c.textMuted}
                />
                <Text style={[styles.tabText, on && styles.tabTextOn]}>
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {tab === "overview" && (
          <>
            {/* Description reads as prose; the facts read as a list with
                icons. The previous version gave both the same treatment, so
                a six-word status looked as important as the summary. */}
            {!!project.description?.trim() && (
              <View style={styles.aboutCard}>
                <Text style={styles.aboutText}>{project.description}</Text>
              </View>
            )}

            <Text style={styles.section}>DETAILS</Text>
            <View style={styles.detailCard}>
              {(
                [
                  ["calendar-outline", "Starts", fmtDate(project.startDate)],
                  ["flag-outline", "Target end", fmtDate(project.endDate)],
                  ["pricetag-outline", "Code", project.code || "—"],
                  ["person-outline", "Manager", managerNames || "—"],
                  ["business-outline", "Department", project.departmentName || "—"],
                ] as [keyof typeof Ionicons.glyphMap, string, string][]
              ).map(([icon, label, value], i, arr) => (
                <View
                  key={label}
                  style={[
                    styles.detailRow,
                    i === arr.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  <View style={styles.detailIcon}>
                    <Ionicons name={icon} size={14} color={c.textMuted} />
                  </View>
                  <Text style={styles.detailLabel}>{label}</Text>
                  <Text style={styles.detailValue} numberOfLines={1}>
                    {value}
                  </Text>
                </View>
              ))}
            </View>

            <View style={styles.techHead}>
              <Text style={[styles.section, styles.techHeadLabel]}>
                TECHNOLOGIES
              </Text>
              {!!(project.technologies || []).length && (
                <Text style={styles.techCount}>
                  {(project.technologies || []).length}
                </Text>
              )}
            </View>

            <View style={styles.techCard}>
              {!(project.technologies || []).length ? (
                <View style={styles.techEmpty}>
                  <Ionicons
                    name="code-slash-outline"
                    size={22}
                    color={c.textFaint}
                  />
                  <Text style={styles.techEmptyText}>
                    {isPM
                      ? "Tag the stack so anyone joining knows what they're walking into."
                      : "No technologies recorded yet."}
                  </Text>
                </View>
              ) : (
                <View style={styles.techWrap}>
                  {(project.technologies || []).map((t) => (
                    <View key={t} style={styles.techChip}>
                      <View style={styles.techDot} />
                      <Text style={styles.techText}>{t}</Text>
                      {isPM && (
                        <TouchableOpacity
                          onPress={() =>
                            saveTech(
                              (project.technologies || []).filter(
                                (x) => x !== t
                              )
                            )
                          }
                          disabled={techSaving}
                          hitSlop={10}
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${t}`}
                        >
                          <Ionicons
                            name="close-circle"
                            size={15}
                            color={c.accentText}
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
              )}

              {isPM && (
                <View style={styles.techAddRow}>
                  <Ionicons
                    name="add-circle-outline"
                    size={17}
                    color={c.textMuted}
                  />
                  <TextInput
                    style={styles.techInput}
                    value={techInput}
                    onChangeText={setTechInput}
                    placeholder="Add — FastAPI, React Native, MongoDB…"
                    placeholderTextColor={c.textFaint}
                    editable={!techSaving}
                    onSubmitEditing={() => {
                      const t = techInput.trim();
                      if (t) saveTech([...(project.technologies || []), t]);
                    }}
                    returnKeyType="done"
                    accessibilityLabel="Add a technology"
                  />
                  {!!techInput.trim() && (
                    <TouchableOpacity
                      style={styles.techAddBtn}
                      disabled={techSaving}
                      onPress={() =>
                        saveTech([
                          ...(project.technologies || []),
                          techInput.trim(),
                        ])
                      }
                    >
                      <Text style={styles.techAddText}>Add</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </>
        )}

        {tab === "phases" && (
          <ProjectPhases
            phases={phases?.phases || []}
            progress={
              phases?.progress || {
                percent: 0, derived: 0, source: "tasks",
                taskTotal: board?.total ?? 0,
                taskCompleted: board?.counts.COMPLETED ?? 0,
              }
            }
            budget={
              phases?.weight || {
                allocated: 0, remaining: 100, balanced: false,
              }
            }
            canManage={isPM}
            busy={planBusy}
            onAdd={(name, weight) =>
              planAction((t) =>
                createProjectPhase(t, String(id), { name, weight })
              )
            }
            onSetWeight={(phaseId, weight) =>
              planAction((t) =>
                updateProjectPhase(t, String(id), phaseId, { weight })
              )
            }
            onDelete={(ph) =>
              planAction((t) => deleteProjectPhase(t, String(id), ph.id))
            }
            onAddTask={(phaseId) => openCreate(phaseId)}
            onSetTaskWeight={(taskId, weight) =>
              planAction((t) => setTaskWeight(t, String(id), taskId, weight))
            }
            onOverride={(percent) =>
              planAction((t) => setProjectProgress(t, String(id), percent))
            }
          />
        )}

        {tab === "meetings" && (
          <ProjectMeetings
            meetings={meetings}
            busy={planBusy}
            onCreate={(body) =>
              planAction((t) => createProjectMeeting(t, String(id), body))
            }
            onUpdate={(mid, body) =>
              planAction((t) => updateProjectMeeting(t, String(id), mid, body))
            }
            onDelete={(m) =>
              planAction((t) => deleteProjectMeeting(t, String(id), m.id))
            }
          />
        )}

        {tab === "files" && (
          <View style={{ marginTop: 14, gap: 12 }}>
            <Text style={styles.emptyHint}>
              Files are the snippets, configs and credentials this project
              keeps — each one visible to the managers, to named people, or
              to the whole team.
            </Text>
            <TouchableOpacity
              style={styles.filesBtn}
              onPress={() => router.push(`/projects/${id}/variables` as any)}
            >
              <Ionicons name="folder-open-outline" size={17} color="#fff" />
              <Text style={styles.filesBtnText}>Open files</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* BOARD */}
        {tab === "board" && (
          <View style={{ marginTop: 14 }}>
            {!board ? (
              <Text style={styles.emptyHint}>
                The task board isn't available for this project.
              </Text>
            ) : (
              <ProjectBoard
                tasks={board.tasks}
                counts={board.counts}
                canManage={isPM}
                onMove={moveTask}
                onQuickAdd={() => openCreate()}
              />
            )}
          </View>
        )}

        {/* MEMBERS */}
        {tab === "team" && (
        <>
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
              {/* Workload, from the board already loaded — no extra request,
                  and it can't disagree with what the Board tab shows. */}
              {(() => {
                const open = (board?.tasks || []).filter(
                  (t) =>
                    t.assignee?.id === m.userId && t.status !== "COMPLETED"
                ).length;
                const done = (board?.tasks || []).filter(
                  (t) =>
                    t.assignee?.id === m.userId && t.status === "COMPLETED"
                ).length;
                if (!open && !done) return null;
                return (
                  <View style={styles.loadPill}>
                    <Text style={styles.loadOpen}>{open}</Text>
                    <Text style={styles.loadLabel}>open</Text>
                    {!!done && (
                      <Text style={styles.loadDone}>· {done} done</Text>
                    )}
                  </View>
                );
              })()}
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

        </>
        )}

        {/* TASKS */}
        {tab === "tasks" && (
        <>
        <View style={styles.tasksHeader}>
          <Text style={styles.section}>TASKS</Text>
          <View style={styles.headerActions}>
            {/* Sits beside Assign because both are "things this project keeps"
                — work to do, and the snippets needed to do it. Shown to every
                member: what they can actually open is decided per file on the
                server, so a member with no readable files still gets a
                meaningful empty state rather than a missing button. */}
            {isPM && (
              <TouchableOpacity style={styles.addTaskBtn} onPress={() => openCreate()}>
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.addTaskText}>Assign</Text>
              </TouchableOpacity>
            )}
          </View>
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
        </>
        )}
      </ScrollView>

      <BottomTabBar user={me} />

      {/* CREATE TASK */}
      <WebModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        title={
          cPhase
            ? `New task · ${
                phases?.phases.find((p) => p.id === cPhase)?.name ||
                project.name
              }`
            : `New task · ${project.name}`
        }
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
        <Text style={styles.label}>Phase</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingBottom: 10 }}
        >
          <TouchableOpacity
            style={[styles.phasePick, !cPhase && styles.phasePickOn]}
            onPress={() => setCPhase(null)}
          >
            <Text style={[styles.phasePickText, !cPhase && styles.phasePickTextOn]}>
              No phase
            </Text>
          </TouchableOpacity>
          {(phases?.phases || []).map((ph) => (
            <TouchableOpacity
              key={ph.id}
              style={[styles.phasePick, cPhase === ph.id && styles.phasePickOn]}
              onPress={() => setCPhase(ph.id)}
            >
              <Text
                style={[styles.phasePickText, cPhase === ph.id && styles.phasePickTextOn]}
              >
                {ph.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
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
    techHead: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 14,
      marginBottom: 10,
    },
    // `section` carries its own margins for standalone use; inside the row
    // they pushed the label out of line with the badge beside it.
    techHeadLabel: { marginBottom: 0, marginTop: 0 },
    techCount: {
      fontSize: 11,
      fontWeight: "800",
      color: c.textMuted,
      backgroundColor: c.surfaceMuted,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 999,
      overflow: "hidden",
    },
    techCard: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      borderRadius: 14,
      padding: 14,
      gap: 12,
    },
    techEmpty: { alignItems: "center", gap: 7, paddingVertical: 14 },
    techEmptyText: {
      fontSize: 12.5,
      color: c.textMuted,
      textAlign: "center",
      lineHeight: 18,
      maxWidth: 280,
    },
    techDot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: c.accentText,
      opacity: 0.55,
    },
    techWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    techChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: c.accentSoft,
      borderRadius: 999,
      paddingHorizontal: 11,
      paddingVertical: 6,
    },
    techText: { fontSize: 13, fontWeight: "700", color: c.accentText },
    techAddRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderTopWidth: 1,
      borderTopColor: c.surfaceBorder,
      paddingTop: 12,
    },
    techInput: {
      flex: 1,
      paddingVertical: 6,
      color: c.text,
      fontSize: 14,
    },
    techAddBtn: {
      paddingHorizontal: 13,
      paddingVertical: 7,
      borderRadius: 8,
      backgroundColor: c.accent,
    },
    techAddText: { color: "#fff", fontWeight: "800", fontSize: 12.5 },
    emptyHint: { fontSize: 13, color: c.textFaint, lineHeight: 19 },
    filesBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: c.accent,
      borderRadius: 11,
      paddingVertical: 12,
    },
    filesBtnText: { color: "#fff", fontWeight: "800", fontSize: 13.5 },
    loadPill: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 4,
      paddingHorizontal: 9,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: c.surfaceMuted,
    },
    loadOpen: { fontSize: 13, fontWeight: "800", color: c.text },
    loadLabel: { fontSize: 10.5, color: c.textMuted, fontWeight: "600" },
    loadDone: { fontSize: 10.5, color: c.textFaint },
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 11,
      borderBottomWidth: 1,
      borderBottomColor: c.surfaceBorder,
    },
    cardTitle: { fontSize: 14, color: c.text, fontWeight: "600" },
    cardMeta: { fontSize: 11, color: c.textMuted, marginTop: 2 },
    // Anchored to the card rather than a modal: the menu has two options and
    // a sheet would be heavier than the action it performs.
    moveMenu: {
      position: "absolute",
      right: 0,
      top: 34,
      zIndex: 10,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      borderRadius: 10,
      paddingVertical: 4,
      minWidth: 132,
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    moveItem: { paddingVertical: 10, paddingHorizontal: 12 },
    moveText: { fontSize: 13, color: c.text, fontWeight: "600" },
    tabBar: {
      flexDirection: "row",
      gap: 6,
      marginTop: 14,
      backgroundColor: c.surfaceMuted,
      borderRadius: 12,
      padding: 4,
    },
    tab: {
      // Sized to its label rather than an equal share: seven tabs at flex:1
      // leaves ~50px each on a phone, which clips every word.
      flexDirection: "row",
      paddingHorizontal: 14,
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      // 44px tall including padding — a real touch target, not a text link.
      paddingVertical: 10,
      borderRadius: 9,
    },
    tabHover: { backgroundColor: c.surface },
    tabPressed: { opacity: 0.7 },
    tabOn: {
      backgroundColor: c.surface,
      ...Platform.select({
        web: { boxShadow: "0 1px 3px rgba(16,16,24,0.10)" as any },
        default: {
          shadowColor: "#000",
          shadowOpacity: 0.08,
          shadowRadius: 3,
          shadowOffset: { width: 0, height: 1 },
        },
      }),
    },
    tabText: { fontSize: 13, fontWeight: "700", color: c.textMuted },
    tabTextOn: { color: c.accent },
    aboutCard: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      borderRadius: 14,
      padding: 15,
      marginTop: 14,
    },
    aboutText: { fontSize: 14.5, lineHeight: 22, color: c.text },
    detailCard: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      borderRadius: 14,
      paddingHorizontal: 14,
    },
    detailRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.surfaceBorder,
    },
    detailIcon: {
      width: 26,
      height: 26,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.surfaceMuted,
    },
    detailLabel: { flex: 1, fontSize: 13, color: c.textMuted },
    detailValue: {
      fontSize: 13.5,
      color: c.text,
      fontWeight: "700",
      maxWidth: "55%",
      textAlign: "right",
    },
    overviewDesc: {
      fontSize: 14,
      lineHeight: 21,
      color: c.text,
      marginBottom: 14,
    },
    factGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    // Two per row on a phone, more as the card widens.
    fact: { minWidth: 120, flexGrow: 1, flexBasis: "40%" },
    factKey: {
      fontSize: 10,
      fontWeight: "800",
      color: c.textMuted,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      marginBottom: 2,
    },
    factVal: { fontSize: 14, color: c.text, fontWeight: "600" },
    safe: { flex: 1, backgroundColor: c.bg },
    container: { flex: 1 },
    // Reserve the bar's height so the last row isn't under it.
    content: { padding: 20, paddingBottom: BOTTOM_BAR_RESERVED_HEIGHT + 20 },
    loader: {
      flex: 1,
      backgroundColor: c.bg,
      justifyContent: "center",
      alignItems: "center",
    },

    chatBtn: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: "#0ea5e9",
      justifyContent: "center",
      alignItems: "center",
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

    headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
    phasePick: {
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: c.surfaceMuted,
    },
    phasePickOn: { backgroundColor: c.accentSoft },
    phasePickText: { fontSize: 12.5, fontWeight: "700", color: c.textMuted },
    phasePickTextOn: { color: c.accentText },
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
