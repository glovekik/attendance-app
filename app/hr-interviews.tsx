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
  listHrInterviews,
  createInterview,
} from "../src/services/interviews";
import { listCandidates } from "../src/services/candidates";
import { listUsers } from "../src/services/users";
import {
  Candidate,
  INTERVIEW_MODES,
  Interview,
  InterviewMode,
  User,
} from "../src/types";

const STATUS_COLOR: Record<string, string> = {
  SCHEDULED: "#3b82f6",
  COMPLETED: "#16a34a",
  CANCELLED: "#64748b",
};

const fmtTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

export default function HrInterviews() {
  const router = useRouter();
  const [items, setItems] = useState<Interview[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("45");
  const [mode, setMode] = useState<InterviewMode>("Video");
  const [location, setLocation] = useState("");
  const [interviewerIds, setInterviewerIds] = useState<string[]>([]);
  const [round, setRound] = useState("");
  const [notes, setNotes] = useState("");

  // Interviewer picker
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");

  // Detail
  const [selected, setSelected] = useState<Interview | null>(null);

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const [ints, cands, allUsers] = await Promise.all([
        listHrInterviews(token),
        listCandidates(token).catch(() => [] as Candidate[]),
        listUsers(token).catch(() => [] as User[]),
      ]);
      setItems(ints || []);
      setCandidates(cands || []);
      setUsers(allUsers || []);
    } catch (err: any) {
      console.log("interviews load error", err);
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

  const resetForm = () => {
    setCandidateId(null);
    setScheduledAt("");
    setDurationMinutes("45");
    setMode("Video");
    setLocation("");
    setInterviewerIds([]);
    setRound("");
    setNotes("");
  };

  const onSave = async () => {
    if (!candidateId) return Alert.alert("Pick a candidate");
    if (!scheduledAt.trim())
      return Alert.alert("Scheduled time is required (ISO 8601)");
    if (interviewerIds.length === 0)
      return Alert.alert("Add at least one interviewer");
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await createInterview(token, {
        candidateId,
        scheduledAt: scheduledAt.trim(),
        durationMinutes: durationMinutes
          ? parseInt(durationMinutes, 10)
          : undefined,
        mode,
        location: location.trim() || undefined,
        interviewerIds,
        round: round.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setShowForm(false);
      resetForm();
      load();
    } catch (err: any) {
      Alert.alert("Save failed", err?.message || "");
    } finally {
      setSaving(false);
    }
  };

  const toggleInterviewer = (id: string) => {
    setInterviewerIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const filteredUsers = users.filter((u) => {
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Interviews</Text>
        <TouchableOpacity onPress={() => setShowForm(true)}>
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
              <Text style={styles.emptyText}>No interviews</Text>
            </View>
          }
          renderItem={({ item }) => {
            const cand =
              candidates.find((c) => c.id === item.candidateId)?.name ||
              item.candidate?.name ||
              "Unknown";
            const interviewerNames = item.interviewerIds
              .map(
                (id) =>
                  users.find((u) => u.id === id)?.name || "?"
              )
              .join(", ");
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => setSelected(item)}
                activeOpacity={0.85}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.who}>{cand}</Text>
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
                {!!interviewerNames && (
                  <Text style={styles.row}>
                    Interviewers: {interviewerNames}
                  </Text>
                )}
                {!!item.round && (
                  <Text style={styles.round}>Round: {item.round}</Text>
                )}
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* CREATE */}
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
              <Text style={styles.modalTitle}>Schedule interview</Text>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <Ionicons name="close" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 540 }}>
              <Text style={styles.label}>Candidate *</Text>
              <View style={styles.chipRow}>
                {candidates.length === 0 ? (
                  <Text style={styles.hint}>No candidates yet</Text>
                ) : (
                  candidates.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      style={[
                        styles.chip,
                        candidateId === c.id && styles.chipActive,
                      ]}
                      onPress={() => setCandidateId(c.id)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          candidateId === c.id && styles.chipTextActive,
                        ]}
                      >
                        {c.name}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>

              <Text style={styles.label}>Scheduled at (ISO 8601) *</Text>
              <TextInput
                style={styles.input}
                value={scheduledAt}
                onChangeText={setScheduledAt}
                placeholder="2026-05-12T15:00:00+00:00"
                placeholderTextColor="#475569"
                autoCapitalize="none"
              />

              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Duration (min)</Text>
                  <TextInput
                    style={styles.input}
                    value={durationMinutes}
                    onChangeText={setDurationMinutes}
                    keyboardType="number-pad"
                    placeholderTextColor="#475569"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Round</Text>
                  <TextInput
                    style={styles.input}
                    value={round}
                    onChangeText={setRound}
                    placeholder="Technical 1"
                    placeholderTextColor="#475569"
                  />
                </View>
              </View>

              <Text style={styles.label}>Mode</Text>
              <View style={styles.chipRow}>
                {INTERVIEW_MODES.map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.chip,
                      mode === m && styles.chipActive,
                    ]}
                    onPress={() => setMode(m)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        mode === m && styles.chipTextActive,
                      ]}
                    >
                      {m}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Location / Link</Text>
              <TextInput
                style={styles.input}
                value={location}
                onChangeText={setLocation}
                placeholder="Meeting room 2 / Zoom link"
                placeholderTextColor="#475569"
                autoCapitalize="none"
              />

              <Text style={styles.label}>
                Interviewers ({interviewerIds.length}) *
              </Text>
              <TouchableOpacity
                style={styles.input}
                onPress={() => setShowPicker(true)}
              >
                <Text style={{ color: "#cbd5e1" }}>
                  {interviewerIds.length === 0
                    ? "Tap to add..."
                    : interviewerIds
                        .map(
                          (id) =>
                            users.find((u) => u.id === id)?.name ||
                            "?"
                        )
                        .join(", ")}
                </Text>
              </TouchableOpacity>

              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, { minHeight: 60 }]}
                value={notes}
                onChangeText={setNotes}
                multiline
                textAlignVertical="top"
                placeholderTextColor="#475569"
              />
              <View style={{ height: 12 }} />
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
                  {saving ? "..." : "Schedule"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* INTERVIEWER PICKER */}
      <Modal
        visible={showPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowPicker(false)}
      >
        <View style={styles.modalWrap}>
          <View style={styles.pickerModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose interviewers</Text>
              <TouchableOpacity onPress={() => setShowPicker(false)}>
                <Ionicons
                  name="checkmark-done"
                  size={24}
                  color="#3b82f6"
                />
              </TouchableOpacity>
            </View>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={16} color="#64748b" />
              <TextInput
                style={styles.searchInput}
                value={pickerSearch}
                onChangeText={setPickerSearch}
                placeholder="Search..."
                placeholderTextColor="#475569"
                autoCapitalize="none"
              />
            </View>
            <FlatList
              data={filteredUsers}
              keyExtractor={(u) => u.id}
              style={{ maxHeight: 420 }}
              renderItem={({ item }) => {
                const selectedI = interviewerIds.includes(item.id);
                return (
                  <TouchableOpacity
                    style={styles.pickerRow}
                    onPress={() => toggleInterviewer(item.id)}
                  >
                    <Ionicons
                      name={selectedI ? "checkbox" : "square-outline"}
                      size={22}
                      color={selectedI ? "#3b82f6" : "#64748b"}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickerName}>{item.name}</Text>
                      <Text style={styles.pickerSub}>{item.email}</Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      {/* DETAIL */}
      <Modal
        visible={!!selected}
        animationType="slide"
        transparent
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.modalWrap}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Interview detail</Text>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Ionicons name="close" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>
            {selected && (
              <ScrollView style={{ maxHeight: 520 }}>
                <Text style={styles.detailLabel}>Candidate</Text>
                <Text style={styles.detailBody}>
                  {candidates.find(
                    (c) => c.id === selected.candidateId
                  )?.name ||
                    selected.candidate?.name ||
                    selected.candidateId}
                </Text>
                <Text style={styles.detailLabel}>When</Text>
                <Text style={styles.detailBody}>
                  {fmtTime(selected.scheduledAt)}
                </Text>
                {!!selected.location && (
                  <>
                    <Text style={styles.detailLabel}>Location</Text>
                    <Text style={styles.detailBody}>
                      {selected.location}
                    </Text>
                  </>
                )}
                <Text style={styles.detailLabel}>Status</Text>
                <View
                  style={[
                    styles.pill,
                    {
                      backgroundColor:
                        STATUS_COLOR[selected.status] || "#64748b",
                      alignSelf: "flex-start",
                    },
                  ]}
                >
                  <Text style={styles.pillText}>{selected.status}</Text>
                </View>

                <Text style={styles.detailLabel}>Feedback</Text>
                {!selected.feedback || selected.feedback.length === 0 ? (
                  <Text style={styles.hint}>No feedback yet</Text>
                ) : (
                  selected.feedback.map((f, i) => (
                    <View key={i} style={styles.feedbackCard}>
                      <Text style={styles.feedbackBy}>
                        {users.find((u) => u.id === f.byUserId)
                          ?.name || f.byUserId}
                      </Text>
                      <Text style={styles.feedbackRec}>
                        {f.recommendation}  ·  Rating {f.rating}/5
                      </Text>
                      {!!f.strengths && (
                        <Text style={styles.feedbackLine}>
                          + {f.strengths}
                        </Text>
                      )}
                      {!!f.concerns && (
                        <Text style={styles.feedbackLine}>
                          − {f.concerns}
                        </Text>
                      )}
                      {!!f.notes && (
                        <Text style={styles.feedbackLine}>
                          {f.notes}
                        </Text>
                      )}
                    </View>
                  ))
                )}
              </ScrollView>
            )}
          </View>
        </View>
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
  pickerModal: {
    backgroundColor: "#0f172a",
    padding: 16,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
    maxHeight: "85%",
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
  hint: { color: "#64748b", fontSize: 11, fontStyle: "italic" },
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
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 10,
    paddingHorizontal: 10,
    gap: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  searchInput: {
    flex: 1,
    color: "#fff",
    paddingVertical: 8,
    fontSize: 13,
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#111827",
  },
  pickerName: { color: "#fff", fontSize: 14, fontWeight: "700" },
  pickerSub: { color: "#94a3b8", fontSize: 11, marginTop: 2 },
  detailLabel: {
    color: "#64748b",
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: "800",
    marginTop: 12,
    marginBottom: 4,
  },
  detailBody: { color: "#fff", fontSize: 14, fontWeight: "600" },
  feedbackCard: {
    backgroundColor: "#111827",
    padding: 10,
    borderRadius: 10,
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  feedbackBy: { color: "#fff", fontSize: 13, fontWeight: "700" },
  feedbackRec: {
    color: "#8b5cf6",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 3,
  },
  feedbackLine: { color: "#cbd5e1", fontSize: 12, marginTop: 4 },
});
