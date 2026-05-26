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
  Switch,
  KeyboardAvoidingView,
  Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  listHrReviews,
  createManagerReview,
  submitManagerEval,
  submitReview } from "../src/services/reviews";
import { listUsers } from "../src/services/users";
import { useTheme } from "../src/theme/ThemeProvider";
import { reviewStatusColor } from "../src/theme/statusColors";
import {
  DimensionRating,
  REVIEW_TYPES,
  Review,
  ReviewType,
  User } from "../src/types";

const DEFAULT_DIMS = ["Quality", "Ownership", "Collaboration"];

export default function ManagerReviews() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);
  const [items, setItems] = useState<Review[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [type, setType] = useState<ReviewType>("QUARTERLY");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [dimensionsText, setDimensionsText] = useState(
    DEFAULT_DIMS.join(", ")
  );

  // Eval modal
  const [selected, setSelected] = useState<Review | null>(null);
  const [strengths, setStrengths] = useState("");
  const [areasToImprove, setAreas] = useState("");
  const [overallRating, setOverallRating] = useState(3);
  const [promotion, setPromotion] = useState(false);
  const [nextSteps, setNextSteps] = useState("");
  const [dimRatings, setDimRatings] = useState<DimensionRating[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const [revs, allUsers] = await Promise.all([
        listHrReviews(token),
        listUsers(token).catch(() => [] as User[]),
      ]);
      setItems(revs || []);
      setUsers(allUsers || []);
    } catch (err: any) {
      Alert.alert(
        "Couldn't load reviews",
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
    setEmployeeId(null);
    setType("QUARTERLY");
    setPeriodStart("");
    setPeriodEnd("");
    setDimensionsText(DEFAULT_DIMS.join(", "));
  };

  const onCreate = async () => {
    if (!employeeId) return Alert.alert("Pick an employee");
    if (!periodStart.trim() || !periodEnd.trim())
      return Alert.alert("Set the period start and end");
    const dims = dimensionsText
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean);
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await createManagerReview(token, {
        employeeId,
        type,
        periodStart: periodStart.trim(),
        periodEnd: periodEnd.trim(),
        dimensions: dims.length ? dims : undefined });
      setShowForm(false);
      reset();
      load();
    } catch (err: any) {
      Alert.alert("Save failed", err?.message || "");
    } finally {
      setSaving(false);
    }
  };

  const openEval = (r: Review) => {
    setSelected(r);
    setStrengths(r.managerEval?.strengths || "");
    setAreas(r.managerEval?.areasToImprove || "");
    setOverallRating(r.managerEval?.overallRating || 3);
    setPromotion(!!r.managerEval?.promotionRecommendation);
    setNextSteps(r.managerEval?.nextSteps || "");
    const prior = r.managerEval?.ratings || [];
    const seeded = (r.dimensions || []).map((d) => {
      const found = prior.find((p) => p.dimension === d);
      return found || { dimension: d, rating: 3, comment: "" };
    });
    setDimRatings(seeded);
  };

  const onSaveEval = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await submitManagerEval(token, selected.id, {
        strengths: strengths.trim() || undefined,
        areasToImprove: areasToImprove.trim() || undefined,
        ratings: dimRatings.length ? dimRatings : undefined,
        overallRating,
        promotionRecommendation: promotion || undefined,
        nextSteps: nextSteps.trim() || undefined });
      Alert.alert("Saved", "Manager eval saved as draft");
      setSelected(null);
      load();
    } catch (err: any) {
      Alert.alert("Save failed", err?.message || "");
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmitFinal = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      // Save eval first, then submit
      await submitManagerEval(token, selected.id, {
        strengths: strengths.trim() || undefined,
        areasToImprove: areasToImprove.trim() || undefined,
        ratings: dimRatings.length ? dimRatings : undefined,
        overallRating,
        promotionRecommendation: promotion || undefined,
        nextSteps: nextSteps.trim() || undefined });
      await submitReview(token, selected.id);
      setSelected(null);
      load();
    } catch (err: any) {
      Alert.alert("Submit failed", err?.message || "");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}>
          <Ionicons name="arrow-back" size={24} color={c.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Reviews (Manager)</Text>
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
          keyExtractor={(r) => r.id}
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
              <Ionicons name="star-outline" size={42} color={c.textFaint} />
              <Text style={styles.emptyText}>No reviews</Text>
            </View>
          }
          renderItem={({ item }) => {
            const emp = users.find((u) => u.id === item.employeeId)?.name;
            const sc = reviewStatusColor(item.status, c);
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => openEval(item)}
                activeOpacity={0.85}
              >
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>
                      {emp || item.employeeId}
                    </Text>
                    <Text style={styles.cardSub}>
                      {item.type} · {item.periodStart} → {item.periodEnd}
                    </Text>
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
              <Text style={styles.modalTitle}>New review</Text>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <Ionicons name="close" size={24} color={c.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 540 }}>
              <Text style={styles.label}>Employee *</Text>
              <View style={styles.chipRow}>
                {users.map((u) => (
                  <TouchableOpacity
                    key={u.id}
                    style={[
                      styles.chip,
                      employeeId === u.id && styles.chipActive,
                    ]}
                    onPress={() => setEmployeeId(u.id)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        employeeId === u.id && styles.chipTextActive,
                      ]}
                    >
                      {u.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Type</Text>
              <View style={styles.chipRow}>
                {REVIEW_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.chip,
                      type === t && styles.chipActive,
                    ]}
                    onPress={() => setType(t)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        type === t && styles.chipTextActive,
                      ]}
                    >
                      {t.replace("_", " ")}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Period start *</Text>
                  <TextInput
                    style={styles.input}
                    value={periodStart}
                    onChangeText={setPeriodStart}
                    placeholder="2026-01-01"
                    placeholderTextColor={c.textFaint}
                    autoCapitalize="none"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Period end *</Text>
                  <TextInput
                    style={styles.input}
                    value={periodEnd}
                    onChangeText={setPeriodEnd}
                    placeholder="2026-03-31"
                    placeholderTextColor={c.textFaint}
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <Text style={styles.label}>Dimensions (comma-separated)</Text>
              <TextInput
                style={styles.input}
                value={dimensionsText}
                onChangeText={setDimensionsText}
                placeholder="Quality, Ownership, Collaboration"
                placeholderTextColor={c.textFaint}
              />
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
                onPress={onCreate}
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

      {/* EVAL */}
      <Modal
        visible={!!selected}
        animationType="slide"
        transparent
        onRequestClose={() => setSelected(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalWrap}
        >
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Manager evaluation</Text>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Ionicons name="close" size={24} color={c.textMuted} />
              </TouchableOpacity>
            </View>

            {selected && (
              <ScrollView style={{ maxHeight: 540 }}>
                <Text style={styles.hint}>
                  {users.find((u) => u.id === selected.employeeId)
                    ?.name || selected.employeeId}{" "}
                  · {selected.periodStart} → {selected.periodEnd}
                </Text>

                {selected.status === "SELF_EVAL" && (
                  <Text style={[styles.hint, { color: "#f59e0b" }]}>
                    Waiting for employee self-eval
                  </Text>
                )}

                {selected.selfEval && (
                  <View style={styles.section}>
                    <Text style={styles.sectionHeader}>SELF-EVAL</Text>
                    {!!selected.selfEval.accomplishments && (
                      <>
                        <Text style={styles.label}>Accomplishments</Text>
                        <Text style={styles.body}>
                          {selected.selfEval.accomplishments}
                        </Text>
                      </>
                    )}
                    {!!selected.selfEval.challenges && (
                      <>
                        <Text style={styles.label}>Challenges</Text>
                        <Text style={styles.body}>
                          {selected.selfEval.challenges}
                        </Text>
                      </>
                    )}
                    {!!selected.selfEval.overallSelfRating && (
                      <Text style={styles.body}>
                        Self rating:{" "}
                        {selected.selfEval.overallSelfRating}/5
                      </Text>
                    )}
                  </View>
                )}

                <Text style={styles.sectionHeader}>YOUR EVALUATION</Text>

                <Text style={styles.label}>Strengths</Text>
                <TextInput
                  style={[styles.input, { minHeight: 60 }]}
                  value={strengths}
                  onChangeText={setStrengths}
                  multiline
                  textAlignVertical="top"
                  placeholderTextColor={c.textFaint}
                />

                <Text style={styles.label}>Areas to improve</Text>
                <TextInput
                  style={[styles.input, { minHeight: 60 }]}
                  value={areasToImprove}
                  onChangeText={setAreas}
                  multiline
                  textAlignVertical="top"
                  placeholderTextColor={c.textFaint}
                />

                {dimRatings.map((d, i) => (
                  <View key={d.dimension} style={styles.dimBox}>
                    <Text style={styles.dimName}>{d.dimension}</Text>
                    <View style={styles.starsRow}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <TouchableOpacity
                          key={n}
                          onPress={() => {
                            const copy = [...dimRatings];
                            copy[i] = { ...copy[i], rating: n };
                            setDimRatings(copy);
                          }}
                        >
                          <Ionicons
                            name={n <= d.rating ? "star" : "star-outline"}
                            size={22}
                            color="#f59e0b"
                          />
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TextInput
                      style={styles.dimComment}
                      value={d.comment || ""}
                      onChangeText={(v) => {
                        const copy = [...dimRatings];
                        copy[i] = { ...copy[i], comment: v };
                        setDimRatings(copy);
                      }}
                      placeholder="Comment"
                      placeholderTextColor={c.textFaint}
                    />
                  </View>
                ))}

                <Text style={styles.label}>Overall rating</Text>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <TouchableOpacity
                      key={n}
                      onPress={() => setOverallRating(n)}
                    >
                      <Ionicons
                        name={
                          n <= overallRating ? "star" : "star-outline"
                        }
                        size={30}
                        color="#f59e0b"
                      />
                    </TouchableOpacity>
                  ))}
                </View>

                <View
                  style={[
                    styles.row,
                    { marginTop: 14, justifyContent: "space-between" },
                  ]}
                >
                  <Text style={styles.label}>
                    Promotion recommendation
                  </Text>
                  <Switch
                    value={promotion}
                    onValueChange={setPromotion}
                    trackColor={{ false: "#1f2937", true: "#16a34a" }}
                  />
                </View>

                <Text style={styles.label}>Next steps</Text>
                <TextInput
                  style={[styles.input, { minHeight: 60 }]}
                  value={nextSteps}
                  onChangeText={setNextSteps}
                  multiline
                  textAlignVertical="top"
                  placeholderTextColor={c.textFaint}
                />

                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnGhost]}
                    onPress={onSaveEval}
                    disabled={submitting}
                  >
                    <Text style={styles.btnGhostText}>Save draft</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnPrimary]}
                    onPress={onSubmitFinal}
                    disabled={submitting}
                  >
                    <Text style={styles.btnPrimaryText}>
                      {submitting ? "..." : "Save & Submit"}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={{ height: 12 }} />
              </ScrollView>
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
  cardSub: { color: c.textMuted, fontSize: 12, marginTop: 2 },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6 },
  pillText: { color: c.text, fontSize: 10, fontWeight: "800" },
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
    marginBottom: 8 },
  modalTitle: { color: c.text, fontSize: 17, fontWeight: "800" },
  hint: { color: c.textMuted, fontSize: 12, marginTop: 4 },
  section: {
    backgroundColor: c.bg,
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  sectionHeader: {
    color: c.textMuted,
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: "800",
    marginTop: 14,
    marginBottom: 6 },
  label: {
    color: c.textMuted,
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: "700",
    marginTop: 12,
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
  body: { color: c.text, fontSize: 13, lineHeight: 18 },
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
  dimBox: {
    backgroundColor: c.surface,
    padding: 12,
    borderRadius: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  dimName: { color: c.text, fontSize: 13, fontWeight: "700" },
  starsRow: { flexDirection: "row", gap: 6, marginTop: 6 },
  dimComment: {
    backgroundColor: c.bg,
    color: c.text,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    marginTop: 6,
    fontSize: 12 },
  row: { flexDirection: "row", alignItems: "center" },
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

