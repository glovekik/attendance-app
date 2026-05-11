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
  listOffers,
  createOffer,
  sendOffer,
  recordOfferDecision,
  revokeOffer,
} from "../src/services/offers";
import { listCandidates } from "../src/services/candidates";
import { Candidate, Offer, OfferStatus } from "../src/types";

const STATUS_COLOR: Record<OfferStatus, string> = {
  DRAFT: "#64748b",
  SENT: "#3b82f6",
  ACCEPTED: "#16a34a",
  REJECTED: "#dc2626",
  EXPIRED: "#f59e0b",
  REVOKED: "#dc2626",
};

const fmtMoney = (n?: number) =>
  n != null
    ? n.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })
    : "—";

export default function HrOffers() {
  const router = useRouter();
  const [items, setItems] = useState<Offer[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Create modal
  const [showForm, setShowForm] = useState(false);
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [position, setPosition] = useState("");
  const [annualCtc, setAnnualCtc] = useState("");
  const [joiningDate, setJoiningDate] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Decision modal
  const [decisionTarget, setDecisionTarget] = useState<Offer | null>(
    null
  );
  const [decisionNote, setDecisionNote] = useState("");
  const [decisionAction, setDecisionAction] = useState<
    "ACCEPTED" | "REJECTED"
  >("ACCEPTED");
  const [deciding, setDeciding] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const [offers, cands] = await Promise.all([
        listOffers(token),
        listCandidates(token).catch(() => [] as Candidate[]),
      ]);
      setItems(offers || []);
      setCandidates(cands || []);
    } catch (err: any) {
      console.log("offers load error", err);
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
    setPosition("");
    setAnnualCtc("");
    setJoiningDate("");
    setValidUntil("");
    setNotes("");
  };

  const onSave = async () => {
    if (!candidateId) return Alert.alert("Pick a candidate");
    if (!position.trim()) return Alert.alert("Position is required");
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await createOffer(token, {
        candidateId,
        position: position.trim(),
        annualCtc: annualCtc ? parseFloat(annualCtc) : undefined,
        joiningDate: joiningDate.trim() || undefined,
        validUntil: validUntil.trim() || undefined,
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

  const onSend = async (o: Offer) => {
    Alert.alert(
      "Send offer?",
      "This emails the candidate the offer link.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send",
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem("token");
              if (!token) return;
              await sendOffer(token, o.id);
              load();
            } catch (err: any) {
              Alert.alert("Send failed", err?.message || "");
            }
          },
        },
      ]
    );
  };

  const onRevoke = (o: Offer) => {
    Alert.alert("Revoke offer?", "This cancels the outstanding offer.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Revoke",
        style: "destructive",
        onPress: async () => {
          try {
            const token = await AsyncStorage.getItem("token");
            if (!token) return;
            await revokeOffer(token, o.id);
            load();
          } catch (err: any) {
            Alert.alert("Revoke failed", err?.message || "");
          }
        },
      },
    ]);
  };

  const openDecision = (o: Offer, action: "ACCEPTED" | "REJECTED") => {
    setDecisionTarget(o);
    setDecisionAction(action);
    setDecisionNote("");
  };

  const onSubmitDecision = async () => {
    if (!decisionTarget) return;
    setDeciding(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await recordOfferDecision(
        token,
        decisionTarget.id,
        decisionAction,
        decisionNote.trim() || undefined
      );
      setDecisionTarget(null);
      load();
    } catch (err: any) {
      Alert.alert("Record failed", err?.message || "");
    } finally {
      setDeciding(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Offers</Text>
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
          keyExtractor={(o) => o.id}
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
                name="document-text-outline"
                size={42}
                color="#475569"
              />
              <Text style={styles.emptyText}>No offers yet</Text>
            </View>
          }
          renderItem={({ item }) => {
            const cand =
              candidates.find((c) => c.id === item.candidateId)?.name ||
              item.candidate?.name ||
              "Unknown";
            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{cand}</Text>
                    <Text style={styles.cardSub}>{item.position}</Text>
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
                <Text style={styles.row}>
                  ₹ {fmtMoney(item.annualCtc)} CTC
                  {item.joiningDate ? ` · Join ${item.joiningDate}` : ""}
                  {item.validUntil
                    ? ` · Valid until ${item.validUntil}`
                    : ""}
                </Text>

                <View style={styles.actions}>
                  {item.status === "DRAFT" && (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.btnPrimary]}
                      onPress={() => onSend(item)}
                    >
                      <Ionicons
                        name="send-outline"
                        size={14}
                        color="#fff"
                      />
                      <Text style={styles.actionText}>Send</Text>
                    </TouchableOpacity>
                  )}
                  {item.status === "SENT" && (
                    <>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.btnAccept]}
                        onPress={() => openDecision(item, "ACCEPTED")}
                      >
                        <Text style={styles.actionText}>Accepted</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.btnReject]}
                        onPress={() => openDecision(item, "REJECTED")}
                      >
                        <Text style={styles.actionText}>Rejected</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.btnGhost]}
                        onPress={() => onRevoke(item)}
                      >
                        <Text style={styles.btnGhostText}>Revoke</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
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
              <Text style={styles.modalTitle}>New offer</Text>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <Ionicons name="close" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 520 }}>
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

              <Text style={styles.label}>Position *</Text>
              <TextInput
                style={styles.input}
                value={position}
                onChangeText={setPosition}
                placeholder="Senior Backend Engineer"
                placeholderTextColor="#475569"
              />

              <Text style={styles.label}>Annual CTC (₹)</Text>
              <TextInput
                style={styles.input}
                value={annualCtc}
                onChangeText={setAnnualCtc}
                placeholder="1800000"
                placeholderTextColor="#475569"
                keyboardType="decimal-pad"
              />

              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Joining date</Text>
                  <TextInput
                    style={styles.input}
                    value={joiningDate}
                    onChangeText={setJoiningDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#475569"
                    autoCapitalize="none"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Valid until</Text>
                  <TextInput
                    style={styles.input}
                    value={validUntil}
                    onChangeText={setValidUntil}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#475569"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, { minHeight: 70 }]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Anything you want included"
                placeholderTextColor="#475569"
                multiline
                textAlignVertical="top"
              />
              <View style={{ height: 12 }} />
            </ScrollView>

            <View style={styles.actionsFooter}>
              <TouchableOpacity
                style={[styles.btn, styles.btnGhostFull]}
                onPress={() => setShowForm(false)}
                disabled={saving}
              >
                <Text style={styles.btnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimaryFull]}
                onPress={onSave}
                disabled={saving}
              >
                <Text style={styles.btnPrimaryText}>
                  {saving ? "..." : "Create draft"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* DECISION */}
      <Modal
        visible={!!decisionTarget}
        animationType="slide"
        transparent
        onRequestClose={() => setDecisionTarget(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalWrap}
        >
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Record {decisionAction.toLowerCase()}
              </Text>
              <TouchableOpacity onPress={() => setDecisionTarget(null)}>
                <Ionicons name="close" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {decisionTarget && (
              <>
                <Text style={styles.hint}>
                  {decisionTarget.position}
                </Text>
                <Text style={styles.label}>Note (optional)</Text>
                <TextInput
                  style={[styles.input, { minHeight: 70 }]}
                  value={decisionNote}
                  onChangeText={setDecisionNote}
                  multiline
                  textAlignVertical="top"
                  placeholderTextColor="#475569"
                />

                <View style={styles.actionsFooter}>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnGhostFull]}
                    onPress={() => setDecisionTarget(null)}
                    disabled={deciding}
                  >
                    <Text style={styles.btnGhostText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.btn,
                      decisionAction === "ACCEPTED"
                        ? styles.btnPrimaryFull
                        : styles.btnRejectFull,
                    ]}
                    onPress={onSubmitDecision}
                    disabled={deciding}
                  >
                    <Text style={styles.btnPrimaryText}>
                      {deciding ? "..." : `Mark ${decisionAction}`}
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
    gap: 10,
  },
  cardTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  cardSub: { color: "#cbd5e1", fontSize: 12, marginTop: 2 },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pillText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  row: { color: "#94a3b8", fontSize: 12, marginTop: 6 },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
  },
  btnPrimary: { backgroundColor: "#3b82f6" },
  btnAccept: { backgroundColor: "#16a34a" },
  btnReject: { backgroundColor: "#dc2626" },
  btnGhost: {
    backgroundColor: "#1e293b",
    borderWidth: 1,
    borderColor: "#334155",
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
  hint: { color: "#64748b", fontSize: 11, fontStyle: "italic" },
  btnGhostText: { color: "#94a3b8", fontWeight: "700" },
  btnPrimaryText: { color: "#fff", fontWeight: "800" },
  actionsFooter: { flexDirection: "row", gap: 10, marginTop: 14 },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  btnGhostFull: { backgroundColor: "#1e293b" },
  btnPrimaryFull: { backgroundColor: "#3b82f6" },
  btnRejectFull: { backgroundColor: "#dc2626" },
});
