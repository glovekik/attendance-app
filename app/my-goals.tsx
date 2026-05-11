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
  KeyboardAvoidingView,
  Platform,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { listMyGoals, addGoalProgress } from "../src/services/goals";
import { Goal, GoalStatus } from "../src/types";

const STATUS_COLOR: Record<GoalStatus, string> = {
  DRAFT: "#64748b",
  ACTIVE: "#3b82f6",
  COMPLETED: "#16a34a",
  CANCELLED: "#64748b",
};

export default function MyGoals() {
  const router = useRouter();
  const [items, setItems] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Progress modal
  const [target, setTarget] = useState<Goal | null>(null);
  const [achieved, setAchieved] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const data = await listMyGoals(token);
      setItems(data || []);
    } catch (err: any) {
      console.log("my-goals load error", err);
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

  const openProgress = (g: Goal) => {
    setTarget(g);
    setAchieved(
      g.achievedValue != null ? String(g.achievedValue) : ""
    );
    setNote("");
  };

  const onSubmit = async () => {
    if (!target) return;
    const v = parseFloat(achieved);
    if (isNaN(v)) {
      Alert.alert("Enter a numeric value");
      return;
    }
    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await addGoalProgress(token, target.id, v, note.trim() || undefined);
      setTarget(null);
      load();
    } catch (err: any) {
      Alert.alert("Update failed", err?.message || "");
    } finally {
      setSubmitting(false);
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
        <Text style={styles.title}>My Goals</Text>
        <View style={{ width: 24 }} />
      </View>

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
            <Text style={styles.emptyText}>
              No goals assigned yet
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const pct =
            item.targetValue && item.targetValue > 0
              ? Math.min(
                  100,
                  ((item.achievedValue || 0) / item.targetValue) * 100
                )
              : null;
          return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <View
                  style={[
                    styles.pill,
                    { backgroundColor: STATUS_COLOR[item.status] },
                  ]}
                >
                  <Text style={styles.pillText}>{item.status}</Text>
                </View>
              </View>
              {!!item.description && (
                <Text style={styles.desc}>{item.description}</Text>
              )}
              <Text style={styles.meta}>
                {item.dueDate ? `Due ${item.dueDate}` : "No due date"}
                {item.weight ? ` · weight ${item.weight}` : ""}
              </Text>

              {item.targetValue != null && (
                <View style={styles.progressWrap}>
                  <View style={styles.progressBg}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${pct || 0}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressText}>
                    {item.achievedValue || 0} / {item.targetValue}
                    {item.unit ? ` ${item.unit}` : ""}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => openProgress(item)}
                disabled={
                  item.status === "COMPLETED" ||
                  item.status === "CANCELLED"
                }
              >
                <Ionicons
                  name="trending-up"
                  size={14}
                  color="#fff"
                />
                <Text style={styles.actionText}>Update progress</Text>
              </TouchableOpacity>
            </View>
          );
        }}
      />

      <Modal
        visible={!!target}
        animationType="slide"
        transparent
        onRequestClose={() => setTarget(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalWrap}
        >
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update progress</Text>
              <TouchableOpacity onPress={() => setTarget(null)}>
                <Ionicons name="close" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {target && (
              <>
                <Text style={styles.goalTitle}>{target.title}</Text>
                {target.targetValue != null && (
                  <Text style={styles.hint}>
                    Target: {target.targetValue}
                    {target.unit ? ` ${target.unit}` : ""}
                  </Text>
                )}

                <Text style={styles.label}>Achieved value</Text>
                <TextInput
                  style={styles.input}
                  value={achieved}
                  onChangeText={setAchieved}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor="#475569"
                />

                <Text style={styles.label}>Note (optional)</Text>
                <TextInput
                  style={[styles.input, { minHeight: 70 }]}
                  value={note}
                  onChangeText={setNote}
                  multiline
                  textAlignVertical="top"
                  placeholder="Anything to add..."
                  placeholderTextColor="#475569"
                />

                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnGhost]}
                    onPress={() => setTarget(null)}
                    disabled={submitting}
                  >
                    <Text style={styles.btnGhostText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnPrimary]}
                    onPress={onSubmit}
                    disabled={submitting}
                  >
                    <Text style={styles.btnPrimaryText}>
                      {submitting ? "..." : "Save"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
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
    justifyContent: "space-between",
    gap: 10,
  },
  cardTitle: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pillText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  desc: { color: "#cbd5e1", fontSize: 12, marginTop: 6 },
  meta: { color: "#94a3b8", fontSize: 11, marginTop: 4 },
  progressWrap: { marginTop: 10 },
  progressBg: {
    height: 8,
    backgroundColor: "#1e293b",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#16a34a",
  },
  progressText: {
    color: "#94a3b8",
    fontSize: 11,
    marginTop: 4,
    textAlign: "right",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3b82f6",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    marginTop: 10,
    gap: 6,
  },
  actionText: { color: "#fff", fontSize: 11, fontWeight: "800" },
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
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  modalTitle: { color: "#fff", fontSize: 17, fontWeight: "800" },
  goalTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  hint: { color: "#64748b", fontSize: 11, marginTop: 4 },
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
