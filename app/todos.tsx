import React, { useEffect, useState, useCallback } from "react";

import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  listTodos,
  createTodo,
  completeTodo,
  reopenTodo,
  deleteTodo,
} from "../src/services/todos";
import { TODO_PRIORITIES, Todo, TodoPriority } from "../src/types";

const priorityColor = (p?: TodoPriority): string => {
  if (p === "HIGH") return "#ef4444";
  if (p === "MEDIUM") return "#f59e0b";
  return "#94a3b8";
};

export default function TodosScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showDone, setShowDone] = useState(false);

  // Create modal state
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newPriority, setNewPriority] = useState<TodoPriority>("MEDIUM");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const data = await listTodos(token, {
        status: showDone ? "DONE" : "OPEN",
        limit: 100,
      });
      setItems(data || []);
    } catch (err) {
      console.log("todos load error", err);
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
    Alert.alert("Delete to-do?", t.title, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const token = await AsyncStorage.getItem("token");
            if (!token) return;
            await deleteTodo(token, t.id);
            setItems((prev) => prev.filter((x) => x.id !== t.id));
          } catch (err: any) {
            Alert.alert("Delete failed", err?.message || "");
          }
        },
      },
    ]);
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
      await createTodo(token, {
        title: newTitle.trim(),
        description: newDesc.trim() || undefined,
        dueDate: newDueDate.trim() || undefined,
        priority: newPriority,
      });
      setShowCreate(false);
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
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>My To-Do</Text>
        <TouchableOpacity onPress={() => setShowCreate(true)}>
          <Ionicons name="add-circle" size={28} color="#3b82f6" />
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
            tintColor="#3b82f6"
            colors={["#3b82f6"]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="list-outline" size={42} color="#475569" />
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
                color={item.status === "DONE" ? "#16a34a" : "#64748b"}
              />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
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
                        backgroundColor: priorityColor(item.priority),
                      },
                    ]}
                  >
                    <Text style={styles.pillText}>{item.priority}</Text>
                  </View>
                )}
                {!!item.dueDate && (
                  <Text style={styles.due}>Due {item.dueDate}</Text>
                )}
              </View>
            </View>
            <TouchableOpacity
              onPress={() => onDelete(item)}
              style={styles.deleteBtn}
            >
              <Ionicons name="trash-outline" size={18} color="#94a3b8" />
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
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalWrap}
        >
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>New To-Do</Text>

            <Text style={styles.label}>Title</Text>
            <TextInput
              style={styles.input}
              value={newTitle}
              onChangeText={setNewTitle}
              placeholder="What needs doing?"
              placeholderTextColor="#475569"
            />

            <Text style={styles.label}>Description (optional)</Text>
            <TextInput
              style={[styles.input, { height: 70 }]}
              value={newDesc}
              onChangeText={setNewDesc}
              placeholder="Notes..."
              placeholderTextColor="#475569"
              multiline
            />

            <Text style={styles.label}>Due date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={newDueDate}
              onChangeText={setNewDueDate}
              placeholder="2026-05-20"
              placeholderTextColor="#475569"
              autoCapitalize="none"
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
                      borderColor: priorityColor(p),
                    },
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
                  {saving ? "Saving..." : "Save"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b1220" },
  loader: {
    flex: 1,
    backgroundColor: "#0b1220",
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
    gap: 12,
  },
  title: { color: "#fff", fontSize: 18, fontWeight: "800", flex: 1 },
  tabs: {
    flexDirection: "row",
    padding: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#111827",
  },
  tabActive: { backgroundColor: "#3b82f6" },
  tabText: { color: "#94a3b8", fontSize: 12, fontWeight: "700" },
  tabTextActive: { color: "#fff" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    gap: 10,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  checkbox: { padding: 4 },
  rowTitle: { color: "#fff", fontSize: 15, fontWeight: "600" },
  strike: { textDecorationLine: "line-through", color: "#64748b" },
  rowDesc: { color: "#94a3b8", fontSize: 12, marginTop: 3 },
  rowMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pillText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  due: { color: "#94a3b8", fontSize: 11 },
  deleteBtn: { padding: 6 },
  emptyWrap: { flex: 1, justifyContent: "center" },
  empty: { alignItems: "center", gap: 10 },
  emptyText: { color: "#475569", fontSize: 14 },
  modalWrap: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modal: {
    backgroundColor: "#0f172a",
    padding: 20,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
  },
  modalTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 12,
  },
  label: {
    color: "#94a3b8",
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#111827",
    color: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  priorityRow: { flexDirection: "row", gap: 8 },
  priorityBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1f2937",
    alignItems: "center",
  },
  priorityText: { color: "#94a3b8", fontSize: 12, fontWeight: "700" },
  actions: { flexDirection: "row", gap: 10, marginTop: 18 },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  btnGhost: { backgroundColor: "#1e293b" },
  btnGhostText: { color: "#94a3b8", fontWeight: "700" },
  btnPrimary: { backgroundColor: "#3b82f6" },
  btnPrimaryText: { color: "#fff", fontWeight: "800" },
});
