import React, { useCallback, useMemo, useState } from "react";

import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  listTodos,
  createTodo,
  updateTodo,
  deleteTodo,
  getTodosOf,
} from "../src/services/todos";
import { getMe } from "../src/services/api";
import { listMyTeam } from "../src/services/managerTeam";
import { ProjectBoard } from "../src/components/ProjectBoard";
import { WebModal, ModalActions } from "../src/components/WebModal";
import {
  BottomTabBar,
  BOTTOM_BAR_RESERVED_HEIGHT,
} from "../src/components/BottomTabBar";
import { PageHeader } from "../src/components/PageHeader";
import { useTheme } from "../src/theme/ThemeProvider";
import { notify, confirmAction } from "../src/utils/confirm";
import { isPeopleManager, Todo, TodoStatus, User } from "../src/types";

/**
 * A personal work board, replacing the flat to-do list.
 *
 * The list only had open and done, which meant "started but not finished"
 * had nowhere to live — the state people are in most of the day. Three
 * columns fix that, and reuse the project board so a card looks and behaves
 * the same wherever you meet one.
 *
 * A manager can open a report's board, because a list of what someone is
 * working on is the useful half of a status meeting. Anything the owner
 * marks private is filtered out by the server, and the manager is told how
 * many items they aren't seeing rather than being quietly shown a partial
 * board.
 */

// The board component speaks the task vocabulary; todos keep their own
// status names because other screens query them. Mapped at the edge.
const TO_BOARD: Record<TodoStatus, "PENDING" | "ONGOING" | "COMPLETED"> = {
  OPEN: "PENDING",
  ONGOING: "ONGOING",
  DONE: "COMPLETED",
};
const FROM_BOARD: Record<string, TodoStatus> = {
  PENDING: "OPEN",
  ONGOING: "ONGOING",
  COMPLETED: "DONE",
};

export default function Todos() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);

  const [me, setMe] = useState<User | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  // Whose board is on screen. null = my own.
  const [viewing, setViewing] = useState<{ id: string; name: string } | null>(
    null
  );
  const [team, setTeam] = useState<{ id: string; name: string }[]>([]);
  const [hiddenCount, setHiddenCount] = useState(0);

  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");
  const [isPrivate, setIsPrivate] = useState(false);
  const [startIn, setStartIn] = useState<TodoStatus>("OPEN");

  const own = !viewing;

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const meRes = await getMe(token).catch(() => null);
      setMe(meRes);

      if (viewing) {
        const res = await getTodosOf(token, viewing.id);
        setTodos(res.todos || []);
        setHiddenCount(res.hiddenCount || 0);
      } else {
        setTodos((await listTodos(token, { limit: 200 })) || []);
        setHiddenCount(0);
      }

      // Only a manager gets the people switcher, and only for their reports.
      if (isPeopleManager(meRes)) {
        const rows = await listMyTeam(token).catch(() => []);
        setTeam(
          (rows || [])
            .filter((m) => !!m.id)
            .map((m) => ({ id: m.id, name: m.name || "Unknown" }))
        );
      }
    } catch (err: any) {
      notify("Couldn't load the board", err?.message || "");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router, viewing]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const act = async (fn: (token: string) => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await fn(token);
      await load();
    } catch (err: any) {
      notify("Couldn't save", err?.message || "");
    } finally {
      setBusy(false);
    }
  };

  const onCreate = () => {
    if (!title.trim()) return;
    act(async (token) => {
      const created = await createTodo(token, {
        title: title.trim(),
        description: desc.trim() || undefined,
        dueDate: due.trim() || undefined,
        priority,
        isPrivate,
      });
      // Created OPEN; move it if they asked for another column, so "add to
      // In progress" puts it where they pointed.
      if (startIn !== "OPEN" && (created as any)?.id) {
        await updateTodo(token, (created as any).id, { status: startIn });
      }
    });
    setCreateOpen(false);
    setTitle("");
    setDesc("");
    setDue("");
    setPriority("MEDIUM");
    setIsPrivate(false);
    setStartIn("OPEN");
  };

  const cards = useMemo(
    () =>
      todos.map((t) => ({
        id: t.id,
        title: t.title,
        status: TO_BOARD[t.status] || "PENDING",
        priority: t.priority,
        dueDate: t.dueDate,
        // Reuses the board's weight chip to flag a private card.
        weight: undefined as unknown as number,
        assignee: t.ownerName ? { id: t.userId || "", name: t.ownerName } : null,
        isPrivate: t.isPrivate,
      })),
    [todos]
  );

  const counts = useMemo(
    () => ({
      PENDING: todos.filter((t) => t.status === "OPEN").length,
      ONGOING: todos.filter((t) => t.status === "ONGOING").length,
      COMPLETED: todos.filter((t) => t.status === "DONE").length,
    }),
    [todos]
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.loader}>
        <ActivityIndicator size="large" color={c.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <PageHeader title={own ? "My board" : `${viewing?.name}'s board`} />

      <ScrollView
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
        {/* Whose board — only for a manager with reports. */}
        {!!team.length && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.people}
          >
            <TouchableOpacity
              style={[styles.person, own && styles.personOn]}
              onPress={() => setViewing(null)}
            >
              <Text style={[styles.personText, own && styles.personTextOn]}>
                Me
              </Text>
            </TouchableOpacity>
            {team.map((m) => {
              const on = viewing?.id === m.id;
              return (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.person, on && styles.personOn]}
                  onPress={() => setViewing({ id: m.id, name: m.name })}
                >
                  <Text style={[styles.personText, on && styles.personTextOn]}>
                    {m.name.split(" ")[0]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {!own && hiddenCount > 0 && (
          <View style={styles.hiddenNote}>
            <Ionicons name="eye-off-outline" size={14} color={c.textMuted} />
            <Text style={styles.hiddenText}>
              {hiddenCount} private {hiddenCount === 1 ? "item" : "items"} not
              shown
            </Text>
          </View>
        )}

        <ProjectBoard
          tasks={cards as any}
          counts={counts}
          // You can move and add on your own board; a report's is read-only.
          canManage={own}
          onMove={(id, status) =>
            act((token) =>
              updateTodo(token, id, { status: FROM_BOARD[status] })
            )
          }
          onQuickAdd={(status) => {
            setStartIn(FROM_BOARD[status]);
            setCreateOpen(true);
          }}
        />

        {own && (
          <View style={styles.privacyList}>
            <Text style={styles.privacyHead}>PRIVATE ITEMS</Text>
            {todos.filter((t) => t.isPrivate).length === 0 ? (
              <Text style={styles.privacyEmpty}>
                Nothing hidden — your manager can see this board.
              </Text>
            ) : (
              todos
                .filter((t) => t.isPrivate)
                .map((t) => (
                  <View key={t.id} style={styles.privacyRow}>
                    <Ionicons name="eye-off" size={14} color={c.textMuted} />
                    <Text style={styles.privacyTitle} numberOfLines={1}>
                      {t.title}
                    </Text>
                    <TouchableOpacity
                      onPress={() =>
                        act((token) =>
                          updateTodo(token, t.id, { isPrivate: false })
                        )
                      }
                    >
                      <Text style={styles.privacyAction}>Unhide</Text>
                    </TouchableOpacity>
                  </View>
                ))
            )}
          </View>
        )}

        {own && (
          <View style={styles.manageList}>
            <Text style={styles.privacyHead}>ALL ITEMS</Text>
            {todos.map((t) => (
              <View key={t.id} style={styles.manageRow}>
                <Text style={styles.manageTitle} numberOfLines={1}>
                  {t.title}
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    act((token) =>
                      updateTodo(token, t.id, { isPrivate: !t.isPrivate })
                    )
                  }
                  hitSlop={8}
                  accessibilityLabel={
                    t.isPrivate ? `Unhide ${t.title}` : `Hide ${t.title}`
                  }
                >
                  <Ionicons
                    name={t.isPrivate ? "eye-off" : "eye-outline"}
                    size={17}
                    color={t.isPrivate ? c.accent : c.textMuted}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={async () => {
                    const ok = await confirmAction({
                      title: "Delete this item?",
                      message: t.title,
                      confirmLabel: "Delete",
                      destructive: true,
                    });
                    if (ok) act((token) => deleteTodo(token, t.id));
                  }}
                  hitSlop={8}
                  accessibilityLabel={`Delete ${t.title}`}
                >
                  <Ionicons name="trash-outline" size={16} color="#dc2626" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <BottomTabBar user={me} />

      <WebModal
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New item"
        size="md"
        footer={
          <ModalActions align="spread">
            <TouchableOpacity
              style={[styles.btn, styles.btnGhost]}
              onPress={() => setCreateOpen(false)}
            >
              <Text style={styles.btnGhostText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary, !title.trim() && { opacity: 0.45 }]}
              disabled={!title.trim() || busy}
              onPress={onCreate}
            >
              <Text style={styles.btnPrimaryText}>Add to board</Text>
            </TouchableOpacity>
          </ModalActions>
        }
      >
        <Text style={styles.label}>Title *</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="What needs doing"
          placeholderTextColor={c.textFaint}
          autoFocus
        />

        <Text style={styles.label}>Column</Text>
        <View style={styles.row}>
          {(
            [
              ["OPEN", "To do"],
              ["ONGOING", "In progress"],
              ["DONE", "Done"],
            ] as [TodoStatus, string][]
          ).map(([v, l]) => (
            <TouchableOpacity
              key={v}
              style={[styles.pick, startIn === v && styles.pickOn]}
              onPress={() => setStartIn(v)}
            >
              <Text
                style={[styles.pickText, startIn === v && styles.pickTextOn]}
              >
                {l}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Priority</Text>
        <View style={styles.row}>
          {(["LOW", "MEDIUM", "HIGH"] as const).map((v) => (
            <TouchableOpacity
              key={v}
              style={[styles.pick, priority === v && styles.pickOn]}
              onPress={() => setPriority(v)}
            >
              <Text
                style={[styles.pickText, priority === v && styles.pickTextOn]}
              >
                {v}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Due date</Text>
        <TextInput
          style={styles.input}
          value={due}
          onChangeText={setDue}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={c.textFaint}
        />

        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, { minHeight: 66 }]}
          value={desc}
          onChangeText={setDesc}
          placeholder="Optional"
          placeholderTextColor={c.textFaint}
          multiline
          textAlignVertical="top"
        />

        <TouchableOpacity
          style={styles.privateToggle}
          onPress={() => setIsPrivate((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isPrivate }}
        >
          <Ionicons
            name={isPrivate ? "checkbox" : "square-outline"}
            size={19}
            color={isPrivate ? c.accent : c.textMuted}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.privateLabel}>Keep this private</Text>
            <Text style={styles.privateHint}>
              Your manager won't see it — they're told only that something is
              hidden.
            </Text>
          </View>
        </TouchableOpacity>
      </WebModal>
    </SafeAreaView>
  );
}

const makeStyles = (c: any) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    loader: {
      flex: 1,
      backgroundColor: c.bg,
      justifyContent: "center",
      alignItems: "center",
    },
    content: {
      padding: 16,
      paddingBottom: BOTTOM_BAR_RESERVED_HEIGHT + 20,
      gap: 14,
    },
    people: { gap: 6, paddingBottom: 2 },
    person: {
      paddingHorizontal: 13,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: c.surfaceMuted,
    },
    personOn: { backgroundColor: c.accentSoft },
    personText: { fontSize: 12.5, fontWeight: "700", color: c.textMuted },
    personTextOn: { color: c.accentText },
    hiddenNote: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 11,
      paddingVertical: 8,
      borderRadius: 9,
      backgroundColor: c.surfaceMuted,
    },
    hiddenText: { fontSize: 12, color: c.textMuted, fontWeight: "600" },
    privacyList: { gap: 7 },
    privacyHead: {
      fontSize: 10.5,
      fontWeight: "800",
      color: c.textMuted,
      letterSpacing: 0.6,
    },
    privacyEmpty: { fontSize: 12.5, color: c.textFaint },
    privacyRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 8,
    },
    privacyTitle: { flex: 1, fontSize: 13, color: c.text },
    privacyAction: { fontSize: 12.5, fontWeight: "700", color: c.accent },
    manageList: { gap: 2 },
    manageRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: c.surfaceBorder,
    },
    manageTitle: { flex: 1, fontSize: 13.5, color: c.text },
    label: {
      fontSize: 10.5,
      fontWeight: "800",
      color: c.textMuted,
      letterSpacing: 0.4,
      marginTop: 12,
      marginBottom: 5,
    },
    input: {
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: c.surfaceMuted,
      color: c.text,
      fontSize: 14,
    },
    row: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
    pick: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: c.surfaceMuted,
    },
    pickOn: { backgroundColor: c.accentSoft },
    pickText: { fontSize: 12.5, fontWeight: "700", color: c.textMuted },
    pickTextOn: { color: c.accentText },
    privateToggle: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      marginTop: 16,
      padding: 11,
      borderRadius: 10,
      backgroundColor: c.surfaceMuted,
    },
    privateLabel: { fontSize: 13.5, fontWeight: "700", color: c.text },
    privateHint: {
      fontSize: 11.5,
      color: c.textMuted,
      marginTop: 2,
      lineHeight: 16,
    },
    btn: { paddingVertical: 11, paddingHorizontal: 18, borderRadius: 10 },
    btnGhost: { backgroundColor: c.surfaceMuted },
    btnGhostText: { color: c.text, fontWeight: "700", fontSize: 13 },
    btnPrimary: { backgroundColor: c.accent },
    btnPrimaryText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  });
