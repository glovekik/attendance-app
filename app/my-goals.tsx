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
  KeyboardAvoidingView,
  Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { listMyGoals, addGoalProgress } from "../src/services/goals";
import { Goal } from "../src/types";

import { useTheme } from "../src/theme/ThemeProvider";
import { goalStatusColor } from "../src/theme/statusColors";

export default function MyGoals() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);
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
            tintColor={c.accent}
            colors={[c.accent]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="flag-outline" size={42} color={c.textFaint} />
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
          const sc = goalStatusColor(item.status, c);
          return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <View
                  style={[
                    styles.pill,
                    { backgroundColor: sc.bg },
                  ]}
                >
                  <Text style={[styles.pillText, { color: sc.fg }]}>{item.status}</Text>
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
                <Ionicons name="close" size={24} color={c.textMuted} />
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
                  placeholderTextColor={c.textFaint}
                />

                <Text style={styles.label}>Note (optional)</Text>
                <TextInput
                  style={[styles.input, { minHeight: 70 }]}
                  value={note}
                  onChangeText={setNote}
                  multiline
                  textAlignVertical="top"
                  placeholder="Anything to add..."
                  placeholderTextColor={c.textFaint}
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
    justifyContent: "space-between",
    gap: 10 },
  cardTitle: {
    color: c.text,
    fontSize: 15,
    fontWeight: "700",
    flex: 1 },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6 },
  pillText: { color: c.text, fontSize: 10, fontWeight: "800" },
  desc: { color: c.text, fontSize: 12, marginTop: 6 },
  meta: { color: c.textMuted, fontSize: 11, marginTop: 4 },
  progressWrap: { marginTop: 10 },
  progressBg: {
    height: 8,
    backgroundColor: c.surfaceMuted,
    borderRadius: 4,
    overflow: "hidden" },
  progressFill: {
    height: "100%",
    backgroundColor: "#16a34a" },
  progressText: {
    color: c.textMuted,
    fontSize: 11,
    marginTop: 4,
    textAlign: "right" },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.accent,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    marginTop: 10,
    gap: 6 },
  actionText: { color: c.text, fontSize: 11, fontWeight: "800" },
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
    borderTopColor: c.surfaceBorder },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10 },
  modalTitle: { color: c.text, fontSize: 17, fontWeight: "800" },
  goalTitle: { color: c.text, fontSize: 16, fontWeight: "700" },
  hint: { color: c.textMuted, fontSize: 11, marginTop: 4 },
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
  actions: { flexDirection: "row", gap: 10, marginTop: 18 },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center" },
  btnGhost: { backgroundColor: c.surfaceMuted },
  btnGhostText: { color: c.textMuted, fontWeight: "700" },
  btnPrimary: { backgroundColor: c.accent },
  btnPrimaryText: { color: "#fff", fontWeight: "800" } });

