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
  listMyReviews,
  submitSelfEval,
  acknowledgeReview,
} from "../src/services/reviews";
import { DimensionRating, Review, ReviewStatus } from "../src/types";

const STATUS_COLOR: Record<ReviewStatus, string> = {
  SELF_EVAL: "#f59e0b",
  MANAGER_EVAL: "#3b82f6",
  SUBMITTED: "#8b5cf6",
  ACKNOWLEDGED: "#16a34a",
};

const STATUS_LABEL: Record<ReviewStatus, string> = {
  SELF_EVAL: "Self-eval needed",
  MANAGER_EVAL: "Manager evaluating",
  SUBMITTED: "Awaiting your acknowledgement",
  ACKNOWLEDGED: "Acknowledged",
};

export default function MyReviews() {
  const router = useRouter();
  const [items, setItems] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Detail / self-eval modal
  const [selected, setSelected] = useState<Review | null>(null);
  const [accomplishments, setAccomplishments] = useState("");
  const [challenges, setChallenges] = useState("");
  const [overallSelfRating, setOverallSelfRating] = useState(3);
  const [dimRatings, setDimRatings] = useState<DimensionRating[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const data = await listMyReviews(token);
      setItems(data || []);
    } catch (err: any) {
      console.log("my-reviews load error", err);
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

  const open = (r: Review) => {
    setSelected(r);
    setAccomplishments(r.selfEval?.accomplishments || "");
    setChallenges(r.selfEval?.challenges || "");
    setOverallSelfRating(r.selfEval?.overallSelfRating || 3);
    // Seed dim ratings from review dimensions + any prior self ratings
    const prior = r.selfEval?.ratings || [];
    const seeded = (r.dimensions || []).map((d) => {
      const found = prior.find((p) => p.dimension === d);
      return (
        found || { dimension: d, rating: 3, comment: "" }
      );
    });
    setDimRatings(seeded);
  };

  const onSubmitSelfEval = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await submitSelfEval(token, selected.id, {
        accomplishments: accomplishments.trim() || undefined,
        challenges: challenges.trim() || undefined,
        ratings: dimRatings.length ? dimRatings : undefined,
        overallSelfRating,
      });
      setSelected(null);
      load();
    } catch (err: any) {
      Alert.alert("Submit failed", err?.message || "");
    } finally {
      setSubmitting(false);
    }
  };

  const onAcknowledge = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await acknowledgeReview(token, selected.id);
      setSelected(null);
      load();
    } catch (err: any) {
      Alert.alert("Acknowledge failed", err?.message || "");
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
        <Text style={styles.title}>My Reviews</Text>
        <View style={{ width: 24 }} />
      </View>

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
            tintColor="#3b82f6"
            colors={["#3b82f6"]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="star-outline" size={42} color="#475569" />
            <Text style={styles.emptyText}>No reviews yet</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => open(item)}
            activeOpacity={0.85}
          >
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle}>{item.type}</Text>
              <View
                style={[
                  styles.pill,
                  { backgroundColor: STATUS_COLOR[item.status] },
                ]}
              >
                <Text style={styles.pillText}>
                  {STATUS_LABEL[item.status]}
                </Text>
              </View>
            </View>
            <Text style={styles.row}>
              {item.periodStart} → {item.periodEnd}
            </Text>
          </TouchableOpacity>
        )}
      />

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
              <Text style={styles.modalTitle}>
                {selected?.type} review
              </Text>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Ionicons name="close" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {selected && (
              <ScrollView style={{ maxHeight: 540 }}>
                <Text style={styles.hint}>
                  {selected.periodStart} → {selected.periodEnd}
                </Text>

                {selected.status === "SELF_EVAL" && (
                  <>
                    <Text style={styles.section}>SELF EVALUATION</Text>

                    <Text style={styles.label}>Accomplishments</Text>
                    <TextInput
                      style={[styles.input, { minHeight: 70 }]}
                      value={accomplishments}
                      onChangeText={setAccomplishments}
                      multiline
                      textAlignVertical="top"
                      placeholderTextColor="#475569"
                      placeholder="What did you do well..."
                    />

                    <Text style={styles.label}>Challenges</Text>
                    <TextInput
                      style={[styles.input, { minHeight: 70 }]}
                      value={challenges}
                      onChangeText={setChallenges}
                      multiline
                      textAlignVertical="top"
                      placeholderTextColor="#475569"
                      placeholder="What was hard..."
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
                                name={
                                  n <= d.rating ? "star" : "star-outline"
                                }
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
                          placeholder="Comment (optional)"
                          placeholderTextColor="#475569"
                        />
                      </View>
                    ))}

                    <Text style={styles.label}>Overall self-rating</Text>
                    <View style={styles.starsRow}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <TouchableOpacity
                          key={n}
                          onPress={() => setOverallSelfRating(n)}
                        >
                          <Ionicons
                            name={
                              n <= overallSelfRating
                                ? "star"
                                : "star-outline"
                            }
                            size={30}
                            color="#f59e0b"
                          />
                        </TouchableOpacity>
                      ))}
                    </View>

                    <TouchableOpacity
                      style={[styles.bigBtn, styles.bigPrimary]}
                      onPress={onSubmitSelfEval}
                      disabled={submitting}
                    >
                      <Text style={styles.bigBtnText}>
                        {submitting ? "..." : "Submit self-eval"}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}

                {selected.status === "MANAGER_EVAL" && (
                  <>
                    <Text style={styles.section}>SELF-EVAL SUBMITTED</Text>
                    <Text style={styles.body}>
                      Manager is evaluating. You'll be notified when
                      ready.
                    </Text>
                  </>
                )}

                {(selected.status === "SUBMITTED" ||
                  selected.status === "ACKNOWLEDGED") && (
                  <>
                    <Text style={styles.section}>MANAGER EVALUATION</Text>
                    {!!selected.managerEval?.strengths && (
                      <>
                        <Text style={styles.label}>Strengths</Text>
                        <Text style={styles.body}>
                          {selected.managerEval.strengths}
                        </Text>
                      </>
                    )}
                    {!!selected.managerEval?.areasToImprove && (
                      <>
                        <Text style={styles.label}>Areas to improve</Text>
                        <Text style={styles.body}>
                          {selected.managerEval.areasToImprove}
                        </Text>
                      </>
                    )}
                    {!!selected.managerEval?.ratings?.length && (
                      <>
                        <Text style={styles.label}>Ratings</Text>
                        {selected.managerEval.ratings.map((r, i) => (
                          <View key={i} style={styles.dimBoxRead}>
                            <Text style={styles.dimName}>
                              {r.dimension}: {r.rating}/5
                            </Text>
                            {!!r.comment && (
                              <Text style={styles.dimCommentRead}>
                                {r.comment}
                              </Text>
                            )}
                          </View>
                        ))}
                      </>
                    )}
                    {!!selected.managerEval?.overallRating && (
                      <Text style={styles.body}>
                        Overall: {selected.managerEval.overallRating}/5
                        {selected.managerEval.promotionRecommendation
                          ? "  ·  Promotion recommended ⭐"
                          : ""}
                      </Text>
                    )}
                    {!!selected.managerEval?.nextSteps && (
                      <>
                        <Text style={styles.label}>Next steps</Text>
                        <Text style={styles.body}>
                          {selected.managerEval.nextSteps}
                        </Text>
                      </>
                    )}

                    {selected.status === "SUBMITTED" && (
                      <TouchableOpacity
                        style={[styles.bigBtn, styles.bigPrimary]}
                        onPress={onAcknowledge}
                        disabled={submitting}
                      >
                        <Text style={styles.bigBtnText}>
                          {submitting ? "..." : "Acknowledge"}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}

                <View style={{ height: 18 }} />
              </ScrollView>
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
    gap: 8,
  },
  cardTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pillText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  row: { color: "#94a3b8", fontSize: 12, marginTop: 6 },
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
    marginBottom: 8,
  },
  modalTitle: { color: "#fff", fontSize: 17, fontWeight: "800" },
  hint: { color: "#64748b", fontSize: 12 },
  section: {
    color: "#64748b",
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: "800",
    marginTop: 18,
    marginBottom: 8,
  },
  label: {
    color: "#94a3b8",
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: "700",
    marginTop: 12,
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
  body: { color: "#cbd5e1", fontSize: 13, lineHeight: 18 },
  dimBox: {
    backgroundColor: "#111827",
    padding: 12,
    borderRadius: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  dimBoxRead: {
    backgroundColor: "#111827",
    padding: 10,
    borderRadius: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  dimName: { color: "#fff", fontSize: 13, fontWeight: "700" },
  starsRow: { flexDirection: "row", gap: 6, marginTop: 6 },
  dimComment: {
    backgroundColor: "#0b1220",
    color: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1f2937",
    marginTop: 6,
    fontSize: 12,
  },
  dimCommentRead: { color: "#94a3b8", fontSize: 12, marginTop: 4 },
  bigBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 18,
  },
  bigPrimary: { backgroundColor: "#3b82f6" },
  bigBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
});
