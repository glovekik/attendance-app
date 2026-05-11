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

import { FilePickButton } from "../src/components/FilePickButton";
import {
  listCandidates,
  createCandidate,
  moveCandidate,
} from "../src/services/candidates";
import { listJobOpenings } from "../src/services/jobOpenings";
import {
  CANDIDATE_SOURCES,
  CANDIDATE_STAGES,
  Candidate,
  CandidateSource,
  CandidateStage,
  JobOpening,
} from "../src/types";

const STAGE_COLOR: Record<CandidateStage, string> = {
  APPLIED: "#3b82f6",
  SCREENING: "#f59e0b",
  INTERVIEW: "#8b5cf6",
  OFFER: "#ec4899",
  HIRED: "#16a34a",
  REJECTED: "#dc2626",
  WITHDRAWN: "#64748b",
};

const STAGE_TABS: { key: "ALL" | CandidateStage; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "APPLIED", label: "Applied" },
  { key: "SCREENING", label: "Screening" },
  { key: "INTERVIEW", label: "Interview" },
  { key: "OFFER", label: "Offer" },
  { key: "HIRED", label: "Hired" },
  { key: "REJECTED", label: "Rejected" },
];

export default function HrCandidates() {
  const router = useRouter();
  const [items, setItems] = useState<Candidate[]>([]);
  const [openings, setOpenings] = useState<JobOpening[]>([]);
  const [tab, setTab] = useState<"ALL" | CandidateStage>("ALL");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // New candidate form
  const [cName, setCName] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cPhone, setCPhone] = useState("");
  const [cJobId, setCJobId] = useState<string | null>(null);
  const [cResume, setCResume] = useState("");
  const [cSource, setCSource] = useState<CandidateSource>("Referral");
  const [cCurrentCo, setCCurrentCo] = useState("");
  const [cCurrentSal, setCCurrentSal] = useState("");
  const [cExpectedSal, setCExpectedSal] = useState("");
  const [cNotice, setCNotice] = useState("");
  const [cNotes, setCNotes] = useState("");

  // Move modal
  const [moveTarget, setMoveTarget] = useState<Candidate | null>(null);
  const [moveStage, setMoveStage] =
    useState<CandidateStage>("SCREENING");
  const [moveNote, setMoveNote] = useState("");
  const [moving, setMoving] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const [cands, jobs] = await Promise.all([
        listCandidates(token, {
          stage: tab === "ALL" ? undefined : tab,
        }),
        listJobOpenings(token).catch(() => [] as JobOpening[]),
      ]);
      setItems(cands || []);
      setOpenings(jobs || []);
    } catch (err: any) {
      console.log("candidates load error", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router, tab]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const resetForm = () => {
    setCName("");
    setCEmail("");
    setCPhone("");
    setCJobId(null);
    setCResume("");
    setCSource("Referral");
    setCCurrentCo("");
    setCCurrentSal("");
    setCExpectedSal("");
    setCNotice("");
    setCNotes("");
  };

  const onSave = async () => {
    if (!cName.trim() || !cEmail.trim()) {
      Alert.alert("Name and email are required");
      return;
    }
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await createCandidate(token, {
        name: cName.trim(),
        email: cEmail.trim(),
        phone: cPhone.trim() || undefined,
        jobOpeningId: cJobId || undefined,
        resumeUrl: cResume.trim() || undefined,
        source: cSource,
        currentCompany: cCurrentCo.trim() || undefined,
        currentSalary: cCurrentSal
          ? parseFloat(cCurrentSal)
          : undefined,
        expectedSalary: cExpectedSal
          ? parseFloat(cExpectedSal)
          : undefined,
        noticePeriodDays: cNotice ? parseInt(cNotice, 10) : undefined,
        notes: cNotes.trim() || undefined,
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

  const openMove = (c: Candidate) => {
    setMoveTarget(c);
    // Default to next stage in pipeline order
    const order = CANDIDATE_STAGES;
    const idx = order.indexOf(c.stage);
    setMoveStage(order[Math.min(idx + 1, 3)] || "SCREENING");
    setMoveNote("");
  };

  const onMove = async () => {
    if (!moveTarget) return;
    setMoving(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await moveCandidate(
        token,
        moveTarget.id,
        moveStage,
        moveNote.trim() || undefined
      );
      setMoveTarget(null);
      load();
    } catch (err: any) {
      Alert.alert("Move failed", err?.message || "");
    } finally {
      setMoving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Candidates</Text>
        <TouchableOpacity onPress={() => setShowForm(true)}>
          <Ionicons name="add-circle" size={28} color="#3b82f6" />
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 12,
          paddingVertical: 8,
          gap: 6,
        }}
      >
        {STAGE_TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[
              styles.tab,
              tab === t.key && styles.tabActive,
              tab === t.key &&
                t.key !== "ALL" && {
                  backgroundColor: STAGE_COLOR[t.key as CandidateStage],
                },
            ]}
            onPress={() => {
              setTab(t.key);
              setLoading(true);
            }}
          >
            <Text
              style={[
                styles.tabText,
                tab === t.key && styles.tabTextActive,
              ]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(c) => c.id}
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
                name="people-outline"
                size={42}
                color="#475569"
              />
              <Text style={styles.emptyText}>No candidates</Text>
            </View>
          }
          renderItem={({ item }) => {
            const job =
              openings.find((j) => j.id === item.jobOpeningId)?.title;
            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {item.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardName}>{item.name}</Text>
                    <Text style={styles.cardSub}>{item.email}</Text>
                    {!!job && (
                      <Text style={styles.cardJob}>{job}</Text>
                    )}
                  </View>
                  <View
                    style={[
                      styles.stagePill,
                      { backgroundColor: STAGE_COLOR[item.stage] },
                    ]}
                  >
                    <Text style={styles.stageText}>{item.stage}</Text>
                  </View>
                </View>
                <View style={styles.cardActions}>
                  {!!item.resumeUrl && (
                    <Text style={styles.linkText} numberOfLines={1}>
                      📎 {item.resumeUrl}
                    </Text>
                  )}
                  <TouchableOpacity
                    style={styles.moveBtn}
                    onPress={() => openMove(item)}
                  >
                    <Ionicons
                      name="arrow-forward-circle"
                      size={14}
                      color="#fff"
                    />
                    <Text style={styles.moveText}>Move stage</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* CREATE CANDIDATE MODAL */}
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
              <Text style={styles.modalTitle}>New candidate</Text>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <Ionicons name="close" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 520 }}>
              <Text style={styles.label}>Name *</Text>
              <TextInput
                style={styles.input}
                value={cName}
                onChangeText={setCName}
                placeholder="..."
                placeholderTextColor="#475569"
              />
              <Text style={styles.label}>Email *</Text>
              <TextInput
                style={styles.input}
                value={cEmail}
                onChangeText={setCEmail}
                placeholder="..."
                placeholderTextColor="#475569"
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Text style={styles.label}>Phone</Text>
              <TextInput
                style={styles.input}
                value={cPhone}
                onChangeText={setCPhone}
                placeholder="+91..."
                placeholderTextColor="#475569"
                keyboardType="phone-pad"
              />

              <Text style={styles.label}>Job Opening</Text>
              <View style={styles.chipRow}>
                {openings.length === 0 ? (
                  <Text style={styles.hint}>No openings yet</Text>
                ) : (
                  openings.map((j) => (
                    <TouchableOpacity
                      key={j.id}
                      style={[
                        styles.chip,
                        cJobId === j.id && styles.chipActive,
                      ]}
                      onPress={() =>
                        setCJobId(cJobId === j.id ? null : j.id)
                      }
                    >
                      <Text
                        style={[
                          styles.chipText,
                          cJobId === j.id && styles.chipTextActive,
                        ]}
                      >
                        {j.title}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>

              <Text style={styles.label}>Source</Text>
              <View style={styles.chipRow}>
                {CANDIDATE_SOURCES.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[
                      styles.chip,
                      cSource === s && styles.chipActive,
                    ]}
                    onPress={() => setCSource(s)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        cSource === s && styles.chipTextActive,
                      ]}
                    >
                      {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Resume</Text>
              <View
                style={{
                  flexDirection: "row",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <FilePickButton
                  label="Pick resume"
                  onUploaded={(url) => setCResume(url)}
                />
                {!!cResume && (
                  <Text style={styles.attachedText} numberOfLines={1}>
                    Attached
                  </Text>
                )}
              </View>
              <TextInput
                style={[styles.input, { marginTop: 8 }]}
                value={cResume}
                onChangeText={setCResume}
                placeholder="or paste URL"
                placeholderTextColor="#475569"
                autoCapitalize="none"
              />

              <Text style={styles.label}>Current company</Text>
              <TextInput
                style={styles.input}
                value={cCurrentCo}
                onChangeText={setCCurrentCo}
                placeholderTextColor="#475569"
              />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Current salary</Text>
                  <TextInput
                    style={styles.input}
                    value={cCurrentSal}
                    onChangeText={setCCurrentSal}
                    keyboardType="decimal-pad"
                    placeholderTextColor="#475569"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Expected salary</Text>
                  <TextInput
                    style={styles.input}
                    value={cExpectedSal}
                    onChangeText={setCExpectedSal}
                    keyboardType="decimal-pad"
                    placeholderTextColor="#475569"
                  />
                </View>
                <View style={{ width: 110 }}>
                  <Text style={styles.label}>Notice (days)</Text>
                  <TextInput
                    style={styles.input}
                    value={cNotice}
                    onChangeText={setCNotice}
                    keyboardType="number-pad"
                    placeholderTextColor="#475569"
                  />
                </View>
              </View>

              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, { minHeight: 70 }]}
                value={cNotes}
                onChangeText={setCNotes}
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
                  {saving ? "..." : "Create"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MOVE STAGE MODAL */}
      <Modal
        visible={!!moveTarget}
        animationType="slide"
        transparent
        onRequestClose={() => setMoveTarget(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalWrap}
        >
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Move candidate</Text>
              <TouchableOpacity onPress={() => setMoveTarget(null)}>
                <Ionicons name="close" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {moveTarget && (
              <>
                <Text style={styles.candidateName}>
                  {moveTarget.name}
                </Text>
                <Text style={styles.hint}>
                  Currently {moveTarget.stage}
                </Text>

                <Text style={styles.label}>Move to</Text>
                <View style={styles.chipRow}>
                  {CANDIDATE_STAGES.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[
                        styles.chip,
                        moveStage === s && {
                          backgroundColor: STAGE_COLOR[s],
                          borderColor: STAGE_COLOR[s],
                        },
                      ]}
                      onPress={() => setMoveStage(s)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          moveStage === s && styles.chipTextActive,
                        ]}
                      >
                        {s}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>Note (optional)</Text>
                <TextInput
                  style={[styles.input, { minHeight: 70 }]}
                  value={moveNote}
                  onChangeText={setMoveNote}
                  placeholder="Cleared technical round, moving to..."
                  placeholderTextColor="#475569"
                  multiline
                  textAlignVertical="top"
                />

                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnGhost]}
                    onPress={() => setMoveTarget(null)}
                    disabled={moving}
                  >
                    <Text style={styles.btnGhostText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnPrimary]}
                    onPress={onMove}
                    disabled={moving}
                  >
                    <Text style={styles.btnPrimaryText}>
                      {moving ? "..." : "Confirm"}
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
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  tabActive: { backgroundColor: "#3b82f6", borderColor: "#3b82f6" },
  tabText: { color: "#94a3b8", fontSize: 11, fontWeight: "700" },
  tabTextActive: { color: "#fff" },
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
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  cardName: { color: "#fff", fontSize: 15, fontWeight: "700" },
  cardSub: { color: "#94a3b8", fontSize: 12, marginTop: 2 },
  cardJob: { color: "#0ea5e9", fontSize: 11, marginTop: 2 },
  stagePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  stageText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    gap: 8,
  },
  linkText: { color: "#3b82f6", fontSize: 11, flex: 1 },
  moveBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3b82f6",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  moveText: { color: "#fff", fontSize: 11, fontWeight: "800" },
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
  candidateName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 2,
  },
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
  attachedText: { color: "#16a34a", fontSize: 12, fontWeight: "700" },
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
