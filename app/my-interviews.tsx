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
  listMyInterviews,
  submitFeedback,
} from "../src/services/interviews";
import {
  INTERVIEW_RECS,
  Interview,
  InterviewRecommendation,
} from "../src/types";

const STATUS_COLOR: Record<string, string> = {
  SCHEDULED: "#3b82f6",
  COMPLETED: "#16a34a",
  CANCELLED: "#64748b",
};

const REC_COLOR: Record<InterviewRecommendation, string> = {
  STRONG_HIRE: "#16a34a",
  HIRE: "#3b82f6",
  NO_HIRE: "#f59e0b",
  STRONG_NO_HIRE: "#dc2626",
};

const fmtTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

export default function MyInterviews() {
  const router = useRouter();
  const [items, setItems] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Feedback modal
  const [target, setTarget] = useState<Interview | null>(null);
  const [rating, setRating] = useState(4);
  const [recommendation, setRecommendation] =
    useState<InterviewRecommendation>("HIRE");
  const [strengths, setStrengths] = useState("");
  const [concerns, setConcerns] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const data = await listMyInterviews(token);
      setItems(data || []);
    } catch (err: any) {
      console.log("my-interviews load error", err);
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

  const openFeedback = (i: Interview) => {
    setTarget(i);
    setRating(4);
    setRecommendation("HIRE");
    setStrengths("");
    setConcerns("");
    setNotes("");
  };

  const onSubmit = async () => {
    if (!target) return;
    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await submitFeedback(token, target.id, {
        rating,
        recommendation,
        strengths: strengths.trim() || undefined,
        concerns: concerns.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setTarget(null);
      load();
    } catch (err: any) {
      Alert.alert("Submit failed", err?.message || "");
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
        <Text style={styles.title}>My Interviews</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
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
            <Ionicons
              name="chatbubbles-outline"
              size={42}
              color="#475569"
            />
            <Text style={styles.emptyText}>
              No interviews assigned to you
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const canFeedback = item.status === "SCHEDULED";
          return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.who}>
                  {item.candidate?.name || item.candidateId}
                </Text>
                <View
                  style={[
                    styles.pill,
                    {
                      backgroundColor:
                        STATUS_COLOR[item.status] || "#64748b",
                    },
                  ]}
                >
                  <Text style={styles.pillText}>{item.status}</Text>
                </View>
              </View>
              <Text style={styles.row}>
                {fmtTime(item.scheduledAt)}
                {item.durationMinutes
                  ? ` · ${item.durationMinutes}m`
                  : ""}
                {item.mode ? ` · ${item.mode}` : ""}
              </Text>
              {!!item.round && (
                <Text style={styles.round}>Round: {item.round}</Text>
              )}
              {!!item.location && (
                <Text style={styles.row}>📍 {item.location}</Text>
              )}
              {canFeedback && (
                <TouchableOpacity
                  style={styles.feedbackBtn}
                  onPress={() => openFeedback(item)}
                >
                  <Ionicons
                    name="create-outline"
                    size={14}
                    color="#fff"
                  />
                  <Text style={styles.feedbackBtnText}>
                    Submit feedback
                  </Text>
                </TouchableOpacity>
              )}
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
              <Text style={styles.modalTitle}>Interview feedback</Text>
              <TouchableOpacity onPress={() => setTarget(null)}>
                <Ionicons name="close" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {target && (
              <>
                <Text style={styles.candidate}>
                  {target.candidate?.name || target.candidateId}
                </Text>
                <Text style={styles.hint}>
                  {fmtTime(target.scheduledAt)}
                  {target.round ? ` · ${target.round}` : ""}
                </Text>

                <Text style={styles.label}>Rating</Text>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((r) => (
                    <TouchableOpacity
                      key={r}
                      onPress={() => setRating(r)}
                    >
                      <Ionicons
                        name={r <= rating ? "star" : "star-outline"}
                        size={30}
                        color="#f59e0b"
                      />
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>Recommendation</Text>
                <View style={styles.chipRow}>
                  {INTERVIEW_RECS.map((r) => (
                    <TouchableOpacity
                      key={r}
                      style={[
                        styles.chip,
                        recommendation === r && {
                          backgroundColor: REC_COLOR[r],
                          borderColor: REC_COLOR[r],
                        },
                      ]}
                      onPress={() => setRecommendation(r)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          recommendation === r && styles.chipTextActive,
                        ]}
                      >
                        {r.replace("_", " ")}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>Strengths</Text>
                <TextInput
                  style={[styles.input, { minHeight: 60 }]}
                  value={strengths}
                  onChangeText={setStrengths}
                  placeholder="What went well..."
                  placeholderTextColor="#475569"
                  multiline
                  textAlignVertical="top"
                />
                <Text style={styles.label}>Concerns</Text>
                <TextInput
                  style={[styles.input, { minHeight: 60 }]}
                  value={concerns}
                  onChangeText={setConcerns}
                  placeholder="Any red flags..."
                  placeholderTextColor="#475569"
                  multiline
                  textAlignVertical="top"
                />
                <Text style={styles.label}>Notes</Text>
                <TextInput
                  style={[styles.input, { minHeight: 60 }]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Additional context"
                  placeholderTextColor="#475569"
                  multiline
                  textAlignVertical="top"
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
                      {submitting ? "..." : "Submit"}
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
  },
  who: { color: "#fff", fontSize: 15, fontWeight: "700" },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pillText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  row: { color: "#94a3b8", fontSize: 12, marginTop: 6 },
  round: { color: "#8b5cf6", fontSize: 11, marginTop: 4 },
  feedbackBtn: {
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
  feedbackBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },
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
  candidate: { color: "#fff", fontSize: 16, fontWeight: "800" },
  hint: { color: "#64748b", fontSize: 12, marginTop: 2 },
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
  },
  starsRow: { flexDirection: "row", gap: 10, marginTop: 6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  chipText: { color: "#94a3b8", fontSize: 11, fontWeight: "700" },
  chipTextActive: { color: "#fff" },
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
