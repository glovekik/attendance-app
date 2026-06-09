import React, { useEffect, useMemo, useState, useCallback } from "react";

import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  Alert,
  Platform } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  listTodos,
  createTodo,
  updateTodo,
  completeTodo,
  reopenTodo,
  deleteTodo } from "../src/services/todos";
import { TODO_PRIORITIES, Todo, TodoPriority } from "../src/types";
import { confirmAction, notify } from "../src/utils/confirm";
import { DatePickerField } from "../src/components/DatePickerField";
import { useTheme } from "../src/theme/ThemeProvider";

const priorityColor = (p?: TodoPriority): string => {
  if (p === "HIGH") return "#ef4444";
  if (p === "MEDIUM") return "#f59e0b";
  return "#94a3b8";
};

// ISO timestamp → "Jun 9, 2026, 3:04 PM". Returns "" for empty values.
const fmtDateTime = (iso?: string | null): string => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit" });
  } catch {
    return iso;
  }
};

export default function TodosScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);
  const [items, setItems] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showDone, setShowDone] = useState(false);

  // Create / edit modal state. editingId === null → create; otherwise edit.
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newPriority, setNewPriority] = useState<TodoPriority>("MEDIUM");
  const [saving, setSaving] = useState(false);

  // Full-task detail modal (tap a row to open).
  const [detailTodo, setDetailTodo] = useState<Todo | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const data = await listTodos(token, {
        status: showDone ? "DONE" : "OPEN",
        limit: 100 });
      setItems(data || []);
    } catch (err: any) {
      Alert.alert(
        "Couldn't load to-dos",
        err?.message || "Pull down to retry."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router, showDone]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const onToggle = async (t: Todo) => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      if (t.status === "OPEN") {
        await completeTodo(token, t.id);
      } else {
        await reopenTodo(token, t.id);
      }
      load();
    } catch (err: any) {
      Alert.alert("Update failed", err?.message || "");
    }
  };

  const onDelete = async (t: Todo) => {
    const ok = await confirmAction({
      title: "Delete to-do?",
      message: t.title,
      confirmLabel: "Delete",
      destructive: true });
    if (!ok) return;
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await deleteTodo(token, t.id);
      setItems((prev) => prev.filter((x) => x.id !== t.id));
    } catch (err: any) {
      notify("Delete failed", err?.message || "");
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setNewTitle("");
    setNewDesc("");
    setNewDueDate("");
    setNewPriority("MEDIUM");
    setShowCreate(true);
  };

  const openEdit = (t: Todo) => {
    setEditingId(t.id);
    setNewTitle(t.title);
    setNewDesc(t.description || "");
    setNewDueDate(t.dueDate || "");
    setNewPriority(t.priority || "MEDIUM");
    setDetailTodo(null);
    setShowCreate(true);
  };

  const onSave = async () => {
    if (!newTitle.trim()) {
      Alert.alert("Title required");
      return;
    }
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const payload = {
        title: newTitle.trim(),
        description: newDesc.trim() || undefined,
        dueDate: newDueDate.trim() || undefined,
        priority: newPriority };
      if (editingId) {
        await updateTodo(token, editingId, payload);
      } else {
        await createTodo(token, payload);
      }
      setShowCreate(false);
      setEditingId(null);
      setNewTitle("");
      setNewDesc("");
      setNewDueDate("");
      setNewPriority("MEDIUM");
      load();
    } catch (err: any) {
      Alert.alert("Save failed", err?.message || "");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}>
          <Ionicons name="arrow-back" size={24} color={c.text} />
        </TouchableOpacity>
        <Text style={styles.title}>My To-Do</Text>
        <TouchableOpacity onPress={openCreate}>
          <Ionicons name="add-circle" size={28} color={c.accent} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, !showDone && styles.tabActive]}
          onPress={() => setShowDone(false)}
        >
          <Text
            style={[
              styles.tabText,
              !showDone && styles.tabTextActive,
            ]}
          >
            Open
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, showDone && styles.tabActive]}
          onPress={() => setShowDone(true)}
        >
          <Text
            style={[
              styles.tabText,
              showDone && styles.tabTextActive,
            ]}
          >
            Done
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(t) => t.id}
        contentContainerStyle={
          items.length === 0 ? styles.emptyWrap : { padding: 12 }
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={c.accent}
            colors={[c.accent]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="list-outline" size={42} color={c.textFaint} />
            <Text style={styles.emptyText}>
              {showDone ? "Nothing finished yet" : "All clear!"}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <TouchableOpacity
              onPress={() => onToggle(item)}
              style={styles.checkbox}
            >
              <Ionicons
                name={
                  item.status === "DONE"
                    ? "checkbox"
                    : "square-outline"
                }
                size={24}
                color={item.status === "DONE" ? c.successText : c.textMuted}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={{ flex: 1 }}
              onPress={() => setDetailTodo(item)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.rowTitle,
                  item.status === "DONE" && styles.strike,
                ]}
                numberOfLines={2}
              >
                {item.title}
              </Text>
              {!!item.description && (
                <Text style={styles.rowDesc} numberOfLines={2}>
                  {item.description}
                </Text>
              )}
              <View style={styles.rowMeta}>
                {item.priority && (
                  <View
                    style={[
                      styles.pill,
                      {
                        backgroundColor: priorityColor(item.priority) },
                    ]}
                  >
                    <Text style={styles.pillText}>{item.priority}</Text>
                  </View>
                )}
                {!!item.dueDate && (
                  <Text style={styles.due}>Due {item.dueDate}</Text>
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => openEdit(item)}
              style={styles.deleteBtn}
            >
              <Ionicons name="create-outline" size={18} color={c.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onDelete(item)}
              style={styles.deleteBtn}
            >
              <Ionicons name="trash-outline" size={18} color={c.textMuted} />
            </TouchableOpacity>
          </View>
        )}
      />

      <Modal
        visible={showCreate}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCreate(false)}
      >
        <KeyboardAvoidingView
          behavior="padding"
          style={styles.modalWrap}
        >
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>
              {editingId ? "Edit To-Do" : "New To-Do"}
            </Text>

            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="What needs doing?"
              placeholderTextColor={c.textFaint}
            />

            <Text style={styles.label}>Description (optional)</Text>
            <TextInput
              style={[styles.input, { height: 70 }]}
              value={newDesc}
              onChangeText={setNewDesc}
              placeholder="Notes..."
              placeholderTextColor={c.textFaint}
              multiline
            />

            <Text style={styles.label}>Due date</Text>
            <DatePickerField
              value={newDueDate}
              onChange={setNewDueDate}
              placeholder="Optional — tap to pick"
            />

            <Text style={styles.label}>Priority</Text>
            <View style={styles.priorityRow}>
              {TODO_PRIORITIES.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.priorityBtn,
                    newPriority === p && {
                      backgroundColor: priorityColor(p),
                      borderColor: priorityColor(p) },
                  ]}
                  onPress={() => setNewPriority(p)}
                >
                  <Text
                    style={[
                      styles.priorityText,
                      newPriority === p && { color: "#fff" },
                    ]}
                  >
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.btn, styles.btnGhost]}
                onPress={() => setShowCreate(false)}
                disabled={saving}
              >
                <Text style={styles.btnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary]}
                onPress={onSave}
                disabled={saving}
              >
                <Text style={styles.btnPrimaryText}>
                  {saving
                    ? "Saving..."
                    : editingId
                    ? "Update"
                    : "Save"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* FULL TASK DETAIL */}
      <Modal
        visible={!!detailTodo}
        animationType="slide"
        transparent
        onRequestClose={() => setDetailTodo(null)}
      >
        <View style={styles.modalWrap}>
          <View style={styles.modal}>
            {detailTodo && (
              <>
                <View style={styles.detailHeader}>
                  <Text style={styles.modalTitle}>Task details</Text>
                  <TouchableOpacity onPress={() => setDetailTodo(null)}>
                    <Ionicons name="close" size={24} color={c.textMuted} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.detailTitle}>{detailTodo.title}</Text>
                {!!detailTodo.description && (
                  <Text style={styles.detailDesc}>
                    {detailTodo.description}
                  </Text>
                )}

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Status</Text>
                  <Text style={styles.detailValue}>
                    {detailTodo.status === "DONE" ? "Completed" : "Open"}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Priority</Text>
                  <View
                    style={[
                      styles.pill,
                      { backgroundColor: priorityColor(detailTodo.priority) },
                    ]}
                  >
                    <Text style={styles.pillText}>
                      {detailTodo.priority || "MEDIUM"}
                    </Text>
                  </View>
                </View>
                {!!detailTodo.dueDate && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Due date</Text>
                    <Text style={styles.detailValue}>{detailTodo.dueDate}</Text>
                  </View>
                )}
                {!!detailTodo.reminderAt && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Reminder</Text>
                    <Text style={styles.detailValue}>
                      {fmtDateTime(detailTodo.reminderAt)}
                    </Text>
                  </View>
                )}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Created</Text>
                  <Text style={styles.detailValue}>
                    {fmtDateTime(detailTodo.createdAt)}
                  </Text>
                </View>
                {!!detailTodo.completedAt && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Completed</Text>
                    <Text style={styles.detailValue}>
                      {fmtDateTime(detailTodo.completedAt)}
                    </Text>
                  </View>
                )}

                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnGhost]}
                    onPress={() => {
                      const t = detailTodo;
                      setDetailTodo(null);
                      onToggle(t);
                    }}
                  >
                    <Text style={styles.btnGhostText}>
                      {detailTodo.status === "DONE" ? "Reopen" : "Complete"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnPrimary]}
                    onPress={() => openEdit(detailTodo)}
                  >
                    <Text style={styles.btnPrimaryText}>Edit</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (c: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  loader: {
    flex: 1,
    backgroundColor: c.bg,
    justifyContent: "center",
    alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: c.surfaceBorder,
    gap: 12 },
  title: { color: c.text, fontSize: 18, fontWeight: "800", flex: 1 },
  tabs: {
    flexDirection: "row",
    padding: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: c.surfaceBorder },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: c.surfaceMuted },
  tabActive: { backgroundColor: c.accent },
  tabText: { color: c.textMuted, fontSize: 12, fontWeight: "700" },
  tabTextActive: { color: c.text },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surface,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    gap: 10,
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  checkbox: { padding: 4 },
  rowTitle: { color: c.text, fontSize: 15, fontWeight: "600" },
  strike: { textDecorationLine: "line-through", color: c.textMuted },
  rowDesc: { color: c.textMuted, fontSize: 12, marginTop: 3 },
  rowMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6 },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6 },
  pillText: { color: c.text, fontSize: 10, fontWeight: "800" },
  due: { color: c.textMuted, fontSize: 11 },
  deleteBtn: { padding: 6 },
  emptyWrap: { flex: 1, justifyContent: "center" },
  empty: { alignItems: "center", gap: 10 },
  emptyText: { color: c.textMuted, fontSize: 14 },
  modalWrap: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: c.overlay },
  modal: {
    backgroundColor: c.surface,
    padding: 20,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    borderTopColor: c.surfaceBorder },
  modalTitle: {
    color: c.text,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 12 },
  label: {
    color: c.textMuted,
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 6 },
  input: {
    backgroundColor: c.surfaceMuted,
    color: c.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  detailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center" },
  detailTitle: {
    color: c.text,
    fontSize: 18,
    fontWeight: "700",
    marginTop: 6 },
  detailDesc: {
    color: c.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8 },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: c.surfaceBorder,
    paddingTop: 10 },
  detailLabel: {
    color: c.textMuted,
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: "700" },
  detailValue: { color: c.text, fontSize: 14, fontWeight: "600" },
  priorityRow: { flexDirection: "row", gap: 8 },
  priorityBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: c.surfaceMuted,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    alignItems: "center" },
  priorityText: { color: c.textMuted, fontSize: 12, fontWeight: "700" },
  actions: { flexDirection: "row", gap: 10, marginTop: 18 },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center" },
  btnGhost: { backgroundColor: c.surfaceMuted },
  btnGhostText: { color: c.text, fontWeight: "700" },
  btnPrimary: { backgroundColor: c.accent },
  btnPrimaryText: { color: "#fff", fontWeight: "800" } });

