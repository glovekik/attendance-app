import React, { useEffect, useState, useCallback, useMemo} from "react";

import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  listManagerGoals,
  createManagerGoal,
  updateManagerGoal } from "../src/services/goals";
import { listUsers } from "../src/services/users";
import {
  GOAL_STATUSES,
  Goal,
  GoalStatus,
  User } from "../src/types";
import { DatePickerField } from "../src/components/DatePickerField";

import { useTheme } from "../src/theme/ThemeProvider";
import { goalStatusColor } from "../src/theme/statusColors";

export default function ManagerGoals() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);
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
      Alert.alert(
        "Couldn't load goals",
        err?.message || "Pull down to retry."
      );
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
        weight: weight ? parseFloat(weight) : undefined };
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
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}>
          <Ionicons name="arrow-back" size={24} color={c.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Goals (Manager)</Text>
        <TouchableOpacity onPress={openCreate}>
          <Ionicons name="add-circle" size={28} color={c.accent} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={c.accent} />
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
              tintColor={c.accent}
              colors={[c.accent]}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="flag-outline" size={42} color={c.textFaint} />
              <Text style={styles.emptyText}>No goals yet</Text>
            </View>
          }
          renderItem={({ item }) => {
            const who = users.find((u) => u.id === item.userId)?.name;
            const sc = goalStatusColor(item.status, c);
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
                      { backgroundColor: sc.bg },
                    ]}
                  >
                    <Text style={[styles.pillText, { color: sc.fg }]}>{item.status}</Text>
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
                <Ionicons name="close" size={24} color={c.textMuted} />
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
                placeholderTextColor={c.textFaint}
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, { minHeight: 70 }]}
                value={description}
                onChangeText={setDescription}
                multiline
                textAlignVertical="top"
                placeholderTextColor={c.textFaint}
              />

              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Due date</Text>
                  <DatePickerField
                    value={dueDate}
                    onChange={setDueDate}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Weight (0-1)</Text>
                  <TextInput
                    style={styles.input}
                    value={weight}
                    onChangeText={setWeight}
                    placeholder="0.3"
                    placeholderTextColor={c.textFaint}
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
                    placeholderTextColor={c.textFaint}
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
                    placeholderTextColor={c.textFaint}
                  />
                </View>
              </View>

              {editingId && (
                <>
                  <Text style={styles.label}>Status</Text>
                  <View style={styles.chipRow}>
                    {GOAL_STATUSES.map((s) => {
                      const sc = goalStatusColor(s, c);
                      return (
                        <TouchableOpacity
                          key={s}
                          style={[
                            styles.chip,
                            status === s && {
                              backgroundColor: sc.bg,
                              borderColor: sc.solid },
                          ]}
                          onPress={() => setStatus(s)}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              status === s && { color: sc.fg },
                            ]}
                          >
                            {s}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
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
  card: {
    backgroundColor: c.surface,
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10 },
  cardTitle: { color: c.text, fontSize: 15, fontWeight: "700" },
  who: { color: "#0ea5e9", fontSize: 12, marginTop: 2 },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6 },
  pillText: { color: c.text, fontSize: 10, fontWeight: "800" },
  meta: { color: c.textMuted, fontSize: 12, marginTop: 6 },
  emptyWrap: { flex: 1, justifyContent: "center" },
  empty: { alignItems: "center", gap: 10 },
  emptyText: { color: c.textMuted, fontSize: 14 },
  modalWrap: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: c.overlay },
  modal: {
    backgroundColor: c.surfaceMuted,
    padding: 20,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    borderTopColor: c.surfaceBorder,
    maxHeight: "92%" },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10 },
  modalTitle: { color: c.text, fontSize: 17, fontWeight: "800" },
  label: {
    color: c.textMuted,
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: "700",
    marginTop: 14,
    marginBottom: 6 },
  input: {
    backgroundColor: c.surface,
    color: c.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    minHeight: 42 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  chipActive: { backgroundColor: c.accent, borderColor: c.accent },
  chipText: { color: c.textMuted, fontSize: 11, fontWeight: "700" },
  chipTextActive: { color: c.text },
  actions: { flexDirection: "row", gap: 10, marginTop: 14 },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center" },
  btnGhost: { backgroundColor: c.surfaceMuted },
  btnGhostText: { color: c.textMuted, fontWeight: "700" },
  btnPrimary: { backgroundColor: c.accent },
  btnPrimaryText: { color: "#fff", fontWeight: "800" } });

