import React, { useCallback, useEffect, useMemo, useState } from "react";

import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  listManagerTasks,
  deleteManagerTask,
  createManagerTask,
  listMyTeam,
  ManagerTask,
  TeamMember } from "../src/services/managerTeam";
import { getMyTasks } from "../src/services/tasks";
import { TaskStatus, TaskPriority, TASK_PRIORITIES } from "../src/types";
import { confirmAction, notify } from "../src/utils/confirm";
import { useTheme } from "../src/theme/ThemeProvider";
import { taskPriorityColor, taskStatusColor } from "../src/theme/statusColors";
import { WebModal, ModalActions } from "../src/components/WebModal";
import { DatePickerField } from "../src/components/DatePickerField";
import { Avatar } from "../src/components/Avatar";

type Tab = "mine" | "team";

const STATUS_FILTERS: (TaskStatus | "ALL")[] = ["ALL", "PENDING", "ONGOING", "COMPLETED"];

const fmtDate = (s?: string) => {
  if (!s) return "";
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

export default function ManagerTasks() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);

  const [tab, setTab] = useState<Tab>("mine");
  const [tasks, setTasks] = useState<ManagerTask[]>([]);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | "ALL">("ALL");
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftIds, setDraftIds] = useState<string[]>([]);
  const [detailTask, setDetailTask] = useState<ManagerTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Create-task modal
  const [createOpen, setCreateOpen] = useState(false);
  const [cAssignee, setCAssignee] = useState<string | null>(null);
  const [cTitle, setCTitle] = useState("");
  const [cDesc, setCDesc] = useState("");
  const [cPriority, setCPriority] = useState<TaskPriority>("MEDIUM");
  const [cDue, setCDue] = useState("");
  const [cSaving, setCSaving] = useState(false);

  const openCreate = () => {
    setCAssignee(null);
    setCTitle("");
    setCDesc("");
    setCPriority("MEDIUM");
    setCDue("");
    setCreateOpen(true);
  };

  const onCreate = async () => {
    if (cSaving) return;
    if (!cAssignee) { notify("Pick a person", "Choose who to assign this task to."); return; }
    if (!cTitle.trim()) { notify("Title required", "Give the task a short title."); return; }
    try {
      setCSaving(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await createManagerTask(token, {
        title: cTitle.trim(),
        description: cDesc.trim() || undefined,
        assigneeId: cAssignee,
        priority: cPriority,
        dueDate: cDue.trim() || undefined,
      });
      setCreateOpen(false);
      setCSaving(false);
      setTab("team");
      load();
    } catch (err: any) {
      notify("Couldn't assign task", err?.message || "");
      setCSaving(false);
    }
  };

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const status = statusFilter === "ALL" ? undefined : statusFilter;
      const data =
        tab === "mine"
          ? await getMyTasks(token, { status })
          : await listManagerTasks(token, { status });
      setTasks((data as ManagerTask[]) || []);
    } catch (err: any) {
      Alert.alert("Couldn't load tasks", err?.message || "Pull down to retry.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab, statusFilter, router]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      try {
        setMembers((await listMyTeam(token)) || []);
      } catch {
        // non-fatal
      }
    })();
  }, []);

  const switchTab = (t: Tab) => {
    if (t === tab) return;
    setLoading(true);
    setSelectedIds([]);
    setQuery("");
    setTab(t);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      if (q && !`${t.title} ${t.description || ""}`.toLowerCase().includes(q)) return false;
      if (tab === "team" && selectedIds.length > 0 && !selectedIds.includes(t.assigneeId))
        return false;
      return true;
    });
  }, [tasks, query, selectedIds, tab]);

  const onDelete = async (t: ManagerTask) => {
    const ok = await confirmAction({
      title: "Delete task?",
      message: `"${t.title}" — this can't be undone.`,
      confirmLabel: "Delete",
      destructive: true });
    if (!ok) return;
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await deleteManagerTask(token, t.id);
      setTasks((prev) => prev.filter((x) => x.id !== t.id));
    } catch (err: any) {
      notify("Delete failed", err?.message || "");
    }
  };

  const openFilter = () => {
    setDraftIds(selectedIds);
    setFilterOpen(true);
  };
  const toggleDraft = (id: string) =>
    setDraftIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity hitSlop={10} onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}>
          <Ionicons name="chevron-back" size={24} color={c.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Tasks</Text>
        <TouchableOpacity hitSlop={10} onPress={() => router.push("/manager-team" as any)}>
          <Ionicons name="people-outline" size={22} color={c.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Segmented tabs */}
      <View style={styles.segmentWrap}>
        <View style={styles.segment}>
          {(["mine", "team"] as Tab[]).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.segBtn, tab === t && styles.segBtnActive]}
              onPress={() => switchTab(t)}
              activeOpacity={0.85}
            >
              <Ionicons
                name={t === "mine" ? "person" : "people"}
                size={15}
                color={tab === t ? "#fff" : c.textMuted}
              />
              <Text style={[styles.segText, tab === t && styles.segTextActive]}>
                {t === "mine" ? "My Tasks" : "My Team Tasks"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Search + filter */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={17} color={c.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search tasks…"
            placeholderTextColor={c.textFaint}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity hitSlop={8} onPress={() => setQuery("")}>
              <Ionicons name="close-circle" size={17} color={c.textFaint} />
            </TouchableOpacity>
          )}
        </View>
        {tab === "team" && members.length > 0 && (
          <TouchableOpacity
            style={[styles.filterBtn, selectedIds.length > 0 && styles.filterBtnActive]}
            onPress={openFilter}
            activeOpacity={0.8}
          >
            <Ionicons
              name="funnel"
              size={16}
              color={selectedIds.length > 0 ? "#fff" : c.textMuted}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Status filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipRow}
      >
        {STATUS_FILTERS.map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.chip, statusFilter === s && styles.chipActive]}
            onPress={() => setStatusFilter(s)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, statusFilter === s && styles.chipTextActive]}>
              {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={c.accent} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(t) => t.id}
          contentContainerStyle={
            filtered.length === 0 ? styles.emptyWrap : { padding: 16, paddingTop: 12 }
          }
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
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="checkmark-done-outline" size={40} color={c.textFaint} />
              <Text style={styles.emptyText}>
                {query || selectedIds.length
                  ? "No tasks match your filters"
                  : tab === "mine"
                  ? "No tasks assigned to you"
                  : "No team tasks"}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const sc = taskStatusColor(item.status, c);
            const pc = taskPriorityColor(item.priority || "MEDIUM", c);
            const who =
              tab === "team" ? item.assignee?.name || item.assigneeName || "Unassigned" : null;
            const sub = [who, item.dueDate ? fmtDate(item.dueDate) : null]
              .filter(Boolean)
              .join("   ·   ");
            const onPress =
              tab === "mine"
                ? () => router.push(`/tasks/${item.id}` as any)
                : () => setDetailTask(item);
            return (
              <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={onPress}>
                <View style={styles.cardTop}>
                  <View style={[styles.dot, { backgroundColor: pc.solid }]} />
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <View style={[styles.statusPill, { backgroundColor: sc.bg }]}>
                    <Text style={[styles.statusText, { color: sc.fg }]}>{item.status}</Text>
                  </View>
                </View>
                <View style={styles.cardBottom}>
                  <Text style={styles.cardSub} numberOfLines={1}>
                    {sub || "No due date"}
                  </Text>
                  {tab === "team" && (
                    <Ionicons name="chevron-forward" size={16} color={c.textFaint} />
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* People filter modal (multi-select) */}
      <WebModal
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Filter by people"
        size="md"
        footer={
          <ModalActions align="spread">
            <TouchableOpacity
              style={[styles.mBtn, styles.mBtnGhost]}
              onPress={() => setDraftIds([])}
            >
              <Text style={styles.mBtnGhostText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.mBtn, styles.mBtnPrimary]}
              onPress={() => {
                setSelectedIds(draftIds);
                setFilterOpen(false);
              }}
            >
              <Text style={styles.mBtnPrimaryText}>
                Apply{draftIds.length ? ` (${draftIds.length})` : ""}
              </Text>
            </TouchableOpacity>
          </ModalActions>
        }
      >
        {members.map((m) => {
          const checked = draftIds.includes(m.id);
          return (
            <TouchableOpacity
              key={m.id}
              style={styles.pplRow}
              onPress={() => toggleDraft(m.id)}
              activeOpacity={0.7}
            >
              <Avatar
                name={m.name}
                uri={m.profilePictureUrl}
                size={36}
                bg={c.accent}
                fg="#fff"
                fontSize={15}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.pplName}>{m.name}</Text>
                {!!m.email && <Text style={styles.pplEmail} numberOfLines={1}>{m.email}</Text>}
              </View>
              <Ionicons
                name={checked ? "checkbox" : "square-outline"}
                size={22}
                color={checked ? c.accent : c.textFaint}
              />
            </TouchableOpacity>
          );
        })}
      </WebModal>

      {/* Task detail (team tasks — view + delete without leaving the screen) */}
      <WebModal
        visible={!!detailTask}
        onClose={() => setDetailTask(null)}
        title="Task details"
        size="md"
        showCloseButton={false}
        footer={
          <ModalActions align="spread">
            <TouchableOpacity
              style={[styles.mBtn, styles.mBtnGhost]}
              onPress={() => setDetailTask(null)}
            >
              <Text style={styles.mBtnGhostText}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.mBtn, styles.mBtnDanger]}
              onPress={() => {
                const t = detailTask;
                setDetailTask(null);
                if (t) onDelete(t);
              }}
            >
              <Text style={styles.mBtnDangerText}>Delete</Text>
            </TouchableOpacity>
          </ModalActions>
        }
      >
        {detailTask && (
          <View>
            <Text style={styles.dTitle}>{detailTask.title}</Text>
            <View style={styles.dPills}>
              <View
                style={[
                  styles.dPill,
                  { backgroundColor: taskStatusColor(detailTask.status, c).bg },
                ]}
              >
                <Text style={[styles.dPillText, { color: taskStatusColor(detailTask.status, c).fg }]}>
                  {detailTask.status}
                </Text>
              </View>
              <View
                style={[
                  styles.dPill,
                  { backgroundColor: taskPriorityColor(detailTask.priority || "MEDIUM", c).bg },
                ]}
              >
                <Text
                  style={[
                    styles.dPillText,
                    { color: taskPriorityColor(detailTask.priority || "MEDIUM", c).fg },
                  ]}
                >
                  {detailTask.priority || "MEDIUM"}
                </Text>
              </View>
            </View>

            <View style={styles.dInfoRow}>
              <Ionicons name="person-outline" size={16} color={c.textMuted} />
              <Text style={styles.dInfoText}>
                {detailTask.assignee?.name || detailTask.assigneeName || "Unassigned"}
              </Text>
            </View>
            {!!detailTask.dueDate && (
              <View style={styles.dInfoRow}>
                <Ionicons name="calendar-outline" size={16} color={c.textMuted} />
                <Text style={styles.dInfoText}>Due {fmtDate(detailTask.dueDate)}</Text>
              </View>
            )}

            {!!detailTask.description && (
              <>
                <Text style={styles.dLabel}>Description</Text>
                <Text style={styles.dDesc}>{detailTask.description}</Text>
              </>
            )}
          </View>
        )}
      </WebModal>

      {/* Assign-task FAB */}
      <TouchableOpacity style={styles.fab} onPress={openCreate} activeOpacity={0.85}>
        <Ionicons name="add" size={26} color="#fff" />
      </TouchableOpacity>

      {/* Create / assign task modal */}
      <WebModal
        visible={createOpen}
        onClose={() => !cSaving && setCreateOpen(false)}
        title="Assign a task"
        size="md"
        footer={
          <ModalActions align="spread">
            <TouchableOpacity style={[styles.mBtn, styles.mBtnGhost]} onPress={() => !cSaving && setCreateOpen(false)}>
              <Text style={styles.mBtnGhostText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.mBtn, styles.mBtnPrimary]} onPress={onCreate} disabled={cSaving}>
              <Text style={styles.mBtnPrimaryText}>{cSaving ? "…" : "Assign"}</Text>
            </TouchableOpacity>
          </ModalActions>
        }
      >
        <Text style={styles.fLabel}>Assign to</Text>
        {members.length === 0 ? (
          <Text style={styles.fHint}>No direct reports to assign to.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
            {members.map((m) => {
              const active = cAssignee === m.id;
              return (
                <TouchableOpacity key={m.id} style={[styles.chip, active && styles.chipActive]} onPress={() => setCAssignee(m.id)}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{m.name.split(" ")[0]}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        <Text style={styles.fLabel}>Title *</Text>
        <TextInput
          style={styles.fInput}
          value={cTitle}
          onChangeText={setCTitle}
          placeholder="Short, action-oriented title"
          placeholderTextColor={c.textFaint}
        />

        <Text style={styles.fLabel}>Description</Text>
        <TextInput
          style={[styles.fInput, { minHeight: 76 }]}
          value={cDesc}
          onChangeText={setCDesc}
          placeholder="Context, links, expected output…"
          placeholderTextColor={c.textFaint}
          multiline
          textAlignVertical="top"
        />

        <Text style={styles.fLabel}>Priority</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {TASK_PRIORITIES.map((p) => (
            <TouchableOpacity key={p} style={[styles.chip, cPriority === p && styles.chipActive]} onPress={() => setCPriority(p)}>
              <Text style={[styles.chipText, cPriority === p && styles.chipTextActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.fLabel}>Due date</Text>
        <DatePickerField value={cDue} onChange={setCDue} placeholder="Optional — tap to pick" />
      </WebModal>
    </SafeAreaView>
  );
}

const makeStyles = (c: any) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    loader: { flex: 1, justifyContent: "center", alignItems: "center" },

    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      height: 52,
    },
    title: { color: c.text, fontSize: 18, fontWeight: "700" },

    // segmented tabs
    segmentWrap: { paddingHorizontal: 16, paddingTop: 2 },
    segment: {
      flexDirection: "row",
      backgroundColor: c.surfaceMuted,
      borderRadius: 12,
      padding: 4,
      gap: 4,
    },
    segBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 9,
      borderRadius: 9,
    },
    segBtnActive: { backgroundColor: c.accent },
    segText: { color: c.textMuted, fontSize: 13, fontWeight: "700" },
    segTextActive: { color: "#fff" },

    // search + filter
    searchRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingTop: 12 },
    searchBox: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: c.surfaceMuted,
      borderRadius: 12,
      paddingHorizontal: 12,
      height: 42,
    },
    searchInput: { flex: 1, color: c.text, fontSize: 14, padding: 0 },
    filterBtn: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: c.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    filterBtnActive: { backgroundColor: c.accent },

    // status chips
    chipScroll: { flexGrow: 0 },
    chipRow: { flexDirection: "row", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 2, gap: 8 },
    chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, backgroundColor: c.surfaceMuted },
    chipActive: { backgroundColor: c.accent },
    chipText: { color: c.textMuted, fontSize: 12, fontWeight: "700" },
    chipTextActive: { color: "#fff" },

    // task cards (small rectangles)
    card: {
      backgroundColor: c.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      paddingHorizontal: 12,
      paddingVertical: 11,
      marginBottom: 8,
    },
    cardTop: { flexDirection: "row", alignItems: "center", gap: 9 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    cardTitle: { flex: 1, color: c.text, fontSize: 14, fontWeight: "700" },
    statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    statusText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.4 },
    cardBottom: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 7,
      marginLeft: 17,
    },
    cardSub: { flex: 1, color: c.textMuted, fontSize: 12 },

    // people modal
    pplRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
    pplName: { color: c.text, fontSize: 14, fontWeight: "700" },
    pplEmail: { color: c.textMuted, fontSize: 12, marginTop: 1 },
    mBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: "center" },
    mBtnGhost: { backgroundColor: c.surfaceMuted },
    mBtnGhostText: { color: c.text, fontWeight: "700" },
    mBtnPrimary: { backgroundColor: c.accent },
    mBtnPrimaryText: { color: "#fff", fontWeight: "800" },
    mBtnDanger: { backgroundColor: c.dangerBg },
    mBtnDangerText: { color: c.dangerText, fontWeight: "800" },

    // task detail modal
    dTitle: { color: c.text, fontSize: 18, fontWeight: "800", lineHeight: 24 },
    dPills: { flexDirection: "row", gap: 8, marginTop: 12 },
    dPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    dPillText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.4 },
    dInfoRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14 },
    dInfoText: { color: c.text, fontSize: 14, fontWeight: "600" },
    dLabel: {
      color: c.textMuted,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1,
      marginTop: 18,
      marginBottom: 6,
      textTransform: "uppercase",
    },
    dDesc: { color: c.text, fontSize: 14, lineHeight: 20 },

    emptyWrap: { flex: 1, justifyContent: "center" },
    empty: { alignItems: "center", gap: 12, padding: 40 },
    emptyText: { color: c.textMuted, fontSize: 14, fontWeight: "600", textAlign: "center" },

    fab: {
      position: "absolute",
      right: 20,
      bottom: 24,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: c.accent,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: c.accent,
      shadowOpacity: 0.4,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    fLabel: {
      color: c.textMuted, fontSize: 11, letterSpacing: 1, fontWeight: "700",
      textTransform: "uppercase", marginTop: 16, marginBottom: 8,
    },
    fHint: { color: c.textMuted, fontSize: 13 },
    fInput: {
      backgroundColor: c.surfaceMuted, color: c.text, borderRadius: 10,
      paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: c.surfaceBorder,
      minHeight: 42, fontSize: 14,
    },
  });
