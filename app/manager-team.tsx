import React, { useCallback, useEffect, useMemo, useState } from "react";

import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
  Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  listMyTeam,
  createManagerTask,
  TeamMember } from "../src/services/managerTeam";
import { TASK_PRIORITIES, TaskPriority } from "../src/types";
import { DatePickerField } from "../src/components/DatePickerField";
import { useTheme } from "../src/theme/ThemeProvider";
import { WebModal, ModalActions } from "../src/components/WebModal";

export default function ManagerTeam() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Assign-task modal
  const [assignTo, setAssignTo] = useState<TeamMember | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const team = await listMyTeam(token);
      setMembers(team || []);
    } catch (err: any) {
      Alert.alert("Failed to load team", err?.message || "");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const openAssign = (member: TeamMember) => {
    setAssignTo(member);
    setTitle("");
    setDescription("");
    setPriority("MEDIUM");
    setDueDate("");
  };

  const closeAssign = () => {
    setAssignTo(null);
    setSaving(false);
  };

  const onAssign = async () => {
    if (saving || !assignTo) return;
    if (!title.trim()) {
      Alert.alert("Title is required");
      return;
    }
    try {
      setSaving(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await createManagerTask(token, {
        title: title.trim(),
        description: description.trim() || undefined,
        assigneeId: assignTo.id,
        priority,
        dueDate: dueDate.trim() || undefined });
      Alert.alert("Task assigned", `Sent to ${assignTo.name}`);
      closeAssign();
    } catch (err: any) {
      Alert.alert("Assign failed", err?.message || "");
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
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>My Team</Text>
          <Text style={styles.subtitle}>
            {members.length} direct report{members.length === 1 ? "" : "s"}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push("/manager-tasks" as any)}
        >
          <Ionicons name="list-outline" size={24} color={c.accent} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={members}
        keyExtractor={(m) => m.id}
        contentContainerStyle={
          members.length === 0 ? styles.emptyWrap : { padding: 12 }
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
            <Ionicons name="people-outline" size={42} color={c.textFaint} />
            <Text style={styles.emptyText}>
              No employees report to you yet.
            </Text>
            <Text style={styles.emptyHint}>
              Ask HR to set you as the reporting manager for your team.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {item.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardName}>{item.name}</Text>
              <Text style={styles.cardSub}>
                {item.email}
                {item.employeeCode ? ` · ${item.employeeCode}` : ""}
              </Text>
              {!!item.tag && (
                <Text style={styles.cardTag}>{item.tag}</Text>
              )}
            </View>
            <TouchableOpacity
              style={styles.assignBtn}
              onPress={() => openAssign(item)}
            >
              <Ionicons name="add" size={14} color="#fff" />
              <Text style={styles.assignText}>Task</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      <WebModal
        visible={!!assignTo}
        onClose={closeAssign}
        title={`Assign task to ${assignTo?.name ?? ""}`}
        size="md"
        footer={
          <ModalActions align="spread">
            <TouchableOpacity
              style={[styles.btn, styles.btnGhost]}
              onPress={closeAssign}
              disabled={saving}
            >
              <Text style={styles.btnGhostText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary]}
              onPress={onAssign}
              disabled={saving}
            >
              <Text style={styles.btnPrimaryText}>
                {saving ? "…" : "Assign"}
              </Text>
            </TouchableOpacity>
          </ModalActions>
        }
      >
              <Text style={styles.label}>Title *</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Short, action-oriented title"
                placeholderTextColor={c.textFaint}
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, { minHeight: 80 }]}
                value={description}
                onChangeText={setDescription}
                placeholder="Context, links, expected output…"
                placeholderTextColor={c.textFaint}
                multiline
                textAlignVertical="top"
              />

              <Text style={styles.label}>Priority</Text>
              <View style={styles.chipRow}>
                {TASK_PRIORITIES.map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.chip,
                      priority === p && styles.chipActive,
                    ]}
                    onPress={() => setPriority(p)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        priority === p && styles.chipTextActive,
                      ]}
                    >
                      {p}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Due date</Text>
              <DatePickerField
                value={dueDate}
                onChange={setDueDate}
                placeholder="Optional — tap to pick"
              />
      </WebModal>
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
  title: { color: c.text, fontSize: 18, fontWeight: "800" },
  subtitle: { color: c.textMuted, fontSize: 12, marginTop: 2 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surface,
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    gap: 12 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: c.accent,
    alignItems: "center",
    justifyContent: "center" },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  cardName: { color: c.text, fontSize: 15, fontWeight: "700" },
  cardSub: { color: c.textMuted, fontSize: 12, marginTop: 2 },
  cardTag: {
    color: c.accentText,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 4 },
  assignBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.accent,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 4 },
  assignText: { color: c.text, fontWeight: "800", fontSize: 12 },

  emptyWrap: { flex: 1, justifyContent: "center" },
  empty: { alignItems: "center", gap: 10, padding: 30 },
  emptyText: { color: c.text, fontSize: 14, fontWeight: "700" },
  emptyHint: {
    color: c.textMuted,
    fontSize: 12,
    textAlign: "center",
    paddingHorizontal: 30 },

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
    borderTopColor: c.surfaceBorder,
    maxHeight: "92%" },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10 },
  modalTitle: { color: c.text, fontSize: 16, fontWeight: "800", flex: 1 },
  label: {
    color: c.textMuted,
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: "700",
    marginTop: 14,
    marginBottom: 6 },
  input: {
    backgroundColor: c.surfaceMuted,
    color: c.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    minHeight: 42 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: c.surfaceMuted,
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  chipActive: { backgroundColor: c.accent, borderColor: c.accent },
  chipText: { color: c.textMuted, fontSize: 11, fontWeight: "700" },
  chipTextActive: { color: c.text },

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

