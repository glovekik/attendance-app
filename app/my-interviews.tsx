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
  Platform } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../src/theme/ThemeProvider";
import {
  interviewStatusColor,
  recommendationColor } from "../src/theme/statusColors";
import {
  listMyInterviews,
  submitFeedback } from "../src/services/interviews";
import {
  INTERVIEW_RECS,
  Interview,
  InterviewRecommendation } from "../src/types";

const fmtTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

export default function MyInterviews() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);
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
      Alert.alert(
        "Couldn't load interviews",
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
        notes: notes.trim() || undefined });
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
            tintColor={c.accent}
            colors={[c.accent]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons
              name="chatbubbles-outline"
              size={42}
              color={c.textFaint}
            />
            <Text style={styles.emptyText}>
              No interviews assigned to you
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const canFeedback = item.status === "SCHEDULED";
          const sc = interviewStatusColor(item.status, c);
          return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.who}>
                  {item.candidate?.name || item.candidateId}
                </Text>
                <View
                  style={[
                    styles.pill,
                    { backgroundColor: sc.bg },
                  ]}
                >
                  <Text style={[styles.pillText, { color: sc.fg }]}>{item.status}</Text>
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
          behavior="padding"
          style={styles.modalWrap}
        >
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Interview feedback</Text>
              <TouchableOpacity onPress={() => setTarget(null)}>
                <Ionicons name="close" size={24} color={c.textMuted} />
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
                  {INTERVIEW_RECS.map((r) => {
                    const sc = recommendationColor(r, c);
                    return (
                      <TouchableOpacity
                        key={r}
                        style={[
                          styles.chip,
                          recommendation === r && {
                            backgroundColor: sc.bg,
                            borderColor: sc.solid },
                        ]}
                        onPress={() => setRecommendation(r)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            recommendation === r && { color: sc.fg },
                          ]}
                        >
                          {r.replace("_", " ")}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.label}>Strengths</Text>
                <TextInput
                  style={[styles.input, { minHeight: 60 }]}
                  value={strengths}
                  onChangeText={setStrengths}
                  placeholder="What went well..."
                  placeholderTextColor={c.textFaint}
                  multiline
                  textAlignVertical="top"
                />
                <Text style={styles.label}>Concerns</Text>
                <TextInput
                  style={[styles.input, { minHeight: 60 }]}
                  value={concerns}
                  onChangeText={setConcerns}
                  placeholder="Any red flags..."
                  placeholderTextColor={c.textFaint}
                  multiline
                  textAlignVertical="top"
                />
                <Text style={styles.label}>Notes</Text>
                <TextInput
                  style={[styles.input, { minHeight: 60 }]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Additional context"
                  placeholderTextColor={c.textFaint}
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
    justifyContent: "space-between" },
  who: { color: c.text, fontSize: 15, fontWeight: "700" },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6 },
  pillText: { color: c.text, fontSize: 10, fontWeight: "800" },
  row: { color: c.textMuted, fontSize: 12, marginTop: 6 },
  round: { color: "#8b5cf6", fontSize: 11, marginTop: 4 },
  feedbackBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.accent,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    marginTop: 10,
    gap: 6 },
  feedbackBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800" },
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
  candidate: { color: c.text, fontSize: 16, fontWeight: "800" },
  hint: { color: c.textMuted, fontSize: 12, marginTop: 2 },
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
    borderColor: c.surfaceBorder },
  starsRow: { flexDirection: "row", gap: 10, marginTop: 6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  chipText: { color: c.textMuted, fontSize: 11, fontWeight: "700" },
  chipTextActive: { color: c.text },
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

