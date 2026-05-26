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
  listOffers,
  createOffer,
  sendOffer,
  recordOfferDecision,
  revokeOffer } from "../src/services/offers";
import { listCandidates } from "../src/services/candidates";
import { Candidate, Offer } from "../src/types";
import { DatePickerField } from "../src/components/DatePickerField";

import { useTheme } from "../src/theme/ThemeProvider";
import { offerStatusColor } from "../src/theme/statusColors";

const fmtMoney = (n?: number) =>
  n != null
    ? n.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2 })
    : "—";

export default function HrOffers() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);
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
      Alert.alert(
        "Couldn't load offers",
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
        notes: notes.trim() || undefined });
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
          } },
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
        } },
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
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}>
          <Ionicons name="arrow-back" size={24} color={c.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Offers</Text>
        <TouchableOpacity onPress={() => setShowForm(true)}>
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
          keyExtractor={(o) => o.id}
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
                name="document-text-outline"
                size={42}
                color={c.textFaint}
              />
              <Text style={styles.emptyText}>No offers yet</Text>
            </View>
          }
          renderItem={({ item }) => {
            const cand =
              candidates.find((x) => x.id === item.candidateId)?.name ||
              item.candidate?.name ||
              "Unknown";
            const sc = offerStatusColor(item.status, c);
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
                      { backgroundColor: sc.bg },
                    ]}
                  >
                    <Text style={[styles.pillText, { color: sc.fg }]}>{item.status}</Text>
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
                <Ionicons name="close" size={24} color={c.textMuted} />
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
                placeholderTextColor={c.textFaint}
              />

              <Text style={styles.label}>Annual CTC (₹)</Text>
              <TextInput
                style={styles.input}
                value={annualCtc}
                onChangeText={setAnnualCtc}
                placeholder="1800000"
                placeholderTextColor={c.textFaint}
                keyboardType="decimal-pad"
              />

              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Joining date</Text>
                  <DatePickerField
                    value={joiningDate}
                    onChange={setJoiningDate}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Valid until</Text>
                  <DatePickerField
                    value={validUntil}
                    onChange={setValidUntil}
                  />
                </View>
              </View>

              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, { minHeight: 70 }]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Anything you want included"
                placeholderTextColor={c.textFaint}
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
                <Ionicons name="close" size={24} color={c.textMuted} />
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
                  placeholderTextColor={c.textFaint}
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
  cardSub: { color: c.text, fontSize: 12, marginTop: 2 },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6 },
  pillText: { color: c.text, fontSize: 10, fontWeight: "800" },
  row: { color: c.textMuted, fontSize: 12, marginTop: 6 },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4 },
  btnPrimary: { backgroundColor: c.accent },
  btnAccept: { backgroundColor: "#16a34a" },
  btnReject: { backgroundColor: "#dc2626" },
  btnGhost: {
    backgroundColor: c.surfaceMuted,
    borderWidth: 1,
    borderColor: "#334155" },
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
  hint: { color: c.textMuted, fontSize: 11, fontStyle: "italic" },
  btnGhostText: { color: c.textMuted, fontWeight: "700" },
  btnPrimaryText: { color: "#fff", fontWeight: "800" },
  actionsFooter: { flexDirection: "row", gap: 10, marginTop: 14 },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center" },
  btnGhostFull: { backgroundColor: c.surfaceMuted },
  btnPrimaryFull: { backgroundColor: c.accent },
  btnRejectFull: { backgroundColor: "#dc2626" } });

