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
  Modal,
  TextInput,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  listManagerGoals,
  createManagerGoal,
  updateManagerGoal,
} from "../src/services/goals";
import { listUsers } from "../src/services/users";
import {
  GOAL_STATUSES,
  Goal,
  GoalStatus,
  User,
} from "../src/types";

const STATUS_COLOR: Record<GoalStatus, string> = {
  DRAFT: "#64748b",
  ACTIVE: "#3b82f6",
  COMPLETED: "#16a34a",
  CANCELLED: "#64748b",
};

export default function ManagerGoals() {
  const router = useRouter();
  const [items, setItems] = useState<Goal[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form
  const [userId, setUserId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [unit, setUnit] = useState("");
  const [weight, setWeight] = useState("");
  const [status, setStatus] = useState<GoalStatus>("ACTIVE");

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const [goals, allUsers] = await Promise.all([
        listManagerGoals(token),
        listUsers(token).catch(() => [] as User[]),
      ]);
      setItems(goals || []);
      setUsers(allUsers || []);
    } catch (err: any) {
      console.log("manager-goals load error", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const reset = () => {
    setEditingId(null);
    setUserId(null);
    setTitle("");
    setDescription("");
    setDueDate("");
    setTargetValue("");
    setUnit("");
    setWeight("");
    setStatus("ACTIVE");
  };

  const openCreate = () => {
    reset();
    setShowForm(true);
  };

  const openEdit = (g: Goal) => {
    setEditingId(g.id);
    setUserId(g.userId);
    setTitle(g.title);
    setDescription(g.description || "");
    setDueDate(g.dueDate || "");
    setTargetValue(g.targetValue != null ? String(g.targetValue) : "");
    setUnit(g.unit || "");
    setWeight(g.weight != null ? String(g.weight) : "");
    setStatus(g.status);
    setShowForm(true);
  };

  const onSave = async () => {
    if (!userId) return Alert.alert("Pick an employee");
    if (!title.trim()) return Alert.alert("Title required");
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const payload = {
        userId,
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate: dueDate.trim() || undefined,
        targetValue: targetValue ? parseFloat(targetValue) : undefined,
        unit: unit.trim() || undefined,
        weight: weight ? parseFloat(weight) : undefined,
      };
      if (editingId) {
        await updateManagerGoal(token, editingId, { ...payload, status });
      } else {
        await createManagerGoal(token, payload);
      }
      setShowForm(false);
      reset();
      load();
    } catch (err: any) {
      Alert.alert("Save failed", err?.message || "");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Goals (Manager)</Text>
        <TouchableOpacity onPress={openCreate}>
          <Ionicons name="add-circle" size={28} color="#3b82f6" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(g) => g.id}
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
              <Ionicons name="flag-outline" size={42} color="#475569" />
              <Text style={styles.emptyText}>No goals yet</Text>
            </View>
          }
          renderItem={({ item }) => {
            const who = users.find((u) => u.id === item.userId)?.name;
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => openEdit(item)}
                activeOpacity={0.85}
              >
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.who}>{who || item.userId}</Text>
                  </View>
                  <View
                    style={[
                      styles.pill,
                      { backgroundColor: STATUS_COLOR[item.status] },
                    ]}
                  >
                    <Text style={styles.pillText}>{item.status}</Text>
                  </View>
                </View>
                <Text style={styles.meta}>
                  {item.dueDate ? `Due ${item.dueDate}` : "No due date"}
                  {item.targetValue != null
                    ? `  ·  ${item.achievedValue || 0}/${item.targetValue}${
                        item.unit ? ` ${item.unit}` : ""
                      }`
                    : ""}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <Modal
        visible={showForm}
        animationType="slide"
        transparent
        onRequestClose={() => setShowForm(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalWrap}
        >
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingId ? "Edit goal" : "New goal"}
              </Text>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <Ionicons name="close" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 520 }}>
              <Text style={styles.label}>Employee *</Text>
              <View style={styles.chipRow}>
                {users.map((u) => (
                  <TouchableOpacity
                    key={u.id}
                    style={[
                      styles.chip,
                      userId === u.id && styles.chipActive,
                    ]}
                    onPress={() => setUserId(u.id)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        userId === u.id && styles.chipTextActive,
                      ]}
                    >
                      {u.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Title *</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Lead the migration to v2 API"
                placeholderTextColor="#475569"
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, { minHeight: 70 }]}
                value={description}
                onChangeText={setDescription}
                multiline
                textAlignVertical="top"
                placeholderTextColor="#475569"
              />

              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Due date</Text>
                  <TextInput
                    style={styles.input}
                    value={dueDate}
                    onChangeText={setDueDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#475569"
                    autoCapitalize="none"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Weight (0-1)</Text>
                  <TextInput
                    style={styles.input}
                    value={weight}
                    onChangeText={setWeight}
                    placeholder="0.3"
                    placeholderTextColor="#475569"
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Target value</Text>
                  <TextInput
                    style={styles.input}
                    value={targetValue}
                    onChangeText={setTargetValue}
                    placeholder="100"
                    placeholderTextColor="#475569"
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Unit</Text>
                  <TextInput
                    style={styles.input}
                    value={unit}
                    onChangeText={setUnit}
                    placeholder="%"
                    placeholderTextColor="#475569"
                  />
                </View>
              </View>

              {editingId && (
                <>
                  <Text style={styles.label}>Status</Text>
                  <View style={styles.chipRow}>
                    {GOAL_STATUSES.map((s) => (
                      <TouchableOpacity
                        key={s}
                        style={[
                          styles.chip,
                          status === s && {
                            backgroundColor: STATUS_COLOR[s],
                            borderColor: STATUS_COLOR[s],
                          },
                        ]}
                        onPress={() => setStatus(s)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            status === s && styles.chipTextActive,
                          ]}
                        >
                          {s}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
              <View style={{ height: 14 }} />
            </ScrollView>

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.btn, styles.btnGhost]}
                onPress={() => setShowForm(false)}
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
                  {saving ? "..." : editingId ? "Update" : "Create"}
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
  card: {
    backgroundColor: "#111827",
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cardTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  who: { color: "#0ea5e9", fontSize: 12, marginTop: 2 },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pillText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  meta: { color: "#94a3b8", fontSize: 12, marginTop: 6 },
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
    maxHeight: "92%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  modalTitle: { color: "#fff", fontSize: 17, fontWeight: "800" },
  label: {
    color: "#94a3b8",
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: "700",
    marginTop: 14,
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
    minHeight: 42,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  chipActive: { backgroundColor: "#3b82f6", borderColor: "#3b82f6" },
  chipText: { color: "#94a3b8", fontSize: 11, fontWeight: "700" },
  chipTextActive: { color: "#fff" },
  actions: { flexDirection: "row", gap: 10, marginTop: 14 },
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
