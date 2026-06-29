import React, { useEffect, useState, useCallback, useMemo} from "react";

import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
  Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { WebModal, ModalActions } from "../src/components/WebModal";
import {
  listMyReviews,
  submitSelfEval,
  acknowledgeReview } from "../src/services/reviews";
import { DimensionRating, Review } from "../src/types";

import { useTheme } from "../src/theme/ThemeProvider";
import {
  reviewStatusColor,
  reviewStatusLabel } from "../src/theme/statusColors";

export default function MyReviews() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);
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
        overallSelfRating });
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
            tintColor={c.accent}
            colors={[c.accent]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="star-outline" size={42} color={c.textFaint} />
            <Text style={styles.emptyText}>No reviews yet</Text>
          </View>
        }
        renderItem={({ item }) => {
          const sc = reviewStatusColor(item.status, c);
          return (
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
                    { backgroundColor: sc.bg },
                  ]}
                >
                  <Text style={[styles.pillText, { color: sc.fg }]}>
                    {reviewStatusLabel(item.status)}
                  </Text>
                </View>
              </View>
              <Text style={styles.row}>
                {item.periodStart} → {item.periodEnd}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      <WebModal
        visible={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `${selected.type} review` : undefined}
        size="lg"
        footer={
          selected &&
          (selected.status === "SELF_EVAL" ||
            selected.status === "SUBMITTED") ? (
            <ModalActions align="right">
              {selected.status === "SELF_EVAL" && (
                <TouchableOpacity
                  style={[styles.bigBtn, styles.bigPrimary]}
                  onPress={onSubmitSelfEval}
                  disabled={submitting}
                >
                  <Text style={styles.bigBtnText}>
                    {submitting ? "..." : "Submit self-eval"}
                  </Text>
                </TouchableOpacity>
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
            </ModalActions>
          ) : undefined
        }
      >
        {selected && (
          <>
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
                  placeholderTextColor={c.textFaint}
                  placeholder="What did you do well..."
                />

                <Text style={styles.label}>Challenges</Text>
                <TextInput
                  style={[styles.input, { minHeight: 70 }]}
                  value={challenges}
                  onChangeText={setChallenges}
                  multiline
                  textAlignVertical="top"
                  placeholderTextColor={c.textFaint}
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
                      placeholderTextColor={c.textFaint}
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
              </>
            )}

            {selected.status === "MANAGER_EVAL" && (
              <>
                <Text style={styles.section}>SELF-EVAL SUBMITTED</Text>
                <Text style={styles.body}>
                  Manager is evaluating. You&apos;ll be notified when
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
              </>
            )}
          </>
        )}
      </WebModal>
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
    gap: 8 },
  cardTitle: { color: c.text, fontSize: 15, fontWeight: "700" },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6 },
  pillText: { color: c.text, fontSize: 10, fontWeight: "800" },
  row: { color: c.textMuted, fontSize: 12, marginTop: 6 },
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
  hint: { color: c.textMuted, fontSize: 12 },
  section: {
    color: c.textMuted,
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: "800",
    marginTop: 18,
    marginBottom: 8 },
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
    borderColor: c.surfaceBorder },
  body: { color: c.text, fontSize: 13, lineHeight: 18 },
  dimBox: {
    backgroundColor: c.surface,
    padding: 12,
    borderRadius: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  dimBoxRead: {
    backgroundColor: c.surface,
    padding: 10,
    borderRadius: 8,
    marginTop: 6,
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
  dimCommentRead: { color: c.textMuted, fontSize: 12, marginTop: 4 },
  bigBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 18 },
  bigPrimary: { backgroundColor: c.accent },
  bigBtnText: { color: c.text, fontWeight: "800", fontSize: 14 } });

