import React, {
  useEffect,
  useState, useMemo} from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Platform,
  Alert } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useRouter } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import {
  hrListLeaveRequests,
  hrDecideLeaveRequest } from "../src/services/leaves";

import { LeaveRequest } from "../src/types";

import { useTheme } from "../src/theme/ThemeProvider";
export default function LeaveRequests() {

  const router = useRouter();

  const { theme } = useTheme();

  const c = theme.colors;

  const styles = useMemo(() => makeStyles(c), [c]);

  const [items, setItems] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [rejectVisible, setRejectVisible] = useState(false);
  const [rejectTarget, setRejectTarget] =
    useState<LeaveRequest | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const [popup, setPopup] = useState({
    visible: false,
    type: "success" as "success" | "error",
    message: "" });

  const showPopup = (
    msg: string,
    kind: "success" | "error" = "success"
  ) => {
    setPopup({ visible: true, type: kind, message: msg });
    setTimeout(() => {
      setPopup((p) => ({ ...p, visible: false }));
    }, 2500);
  };

  const load = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const res = await hrListLeaveRequests(token, "PENDING");
      setItems(res || []);
    } catch (err: any) {
      showPopup(err?.message || "Failed to load", "error");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const confirmApprove = (
    r: LeaveRequest
  ): Promise<boolean> => {
    if (Platform.OS === "web") {
      return Promise.resolve(
        typeof window !== "undefined" &&
          window.confirm(
            `Approve ${r.user?.name || "user"}'s ${
              r.leaveType?.name || r.leaveTypeCode
            } from ${r.fromDate} to ${r.toDate}?`
          )
      );
    }
    return new Promise((resolve) => {
      Alert.alert(
        "Approve leave?",
        `${r.user?.name || "User"} · ${r.leaveType?.name || r.leaveTypeCode} · ${r.totalDays}d`,
        [
          { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
          { text: "Approve", onPress: () => resolve(true) },
        ]
      );
    });
  };

  const doApprove = async (r: LeaveRequest) => {
    if (busyId) return;
    const ok = await confirmApprove(r);
    if (!ok) return;
    try {
      setBusyId(r.id);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await hrDecideLeaveRequest(token, r.id, {
        action: "APPROVE" });
      showPopup("Approved");
      await load();
    } catch (err: any) {
      showPopup(err?.message || "Failed to approve", "error");
    } finally {
      setBusyId(null);
    }
  };

  const openReject = (r: LeaveRequest) => {
    setRejectTarget(r);
    setRejectNote("");
    setRejectVisible(true);
  };

  const submitReject = async () => {
    if (!rejectTarget || busyId) return;
    try {
      setBusyId(rejectTarget.id);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await hrDecideLeaveRequest(token, rejectTarget.id, {
        action: "REJECT",
        note: rejectNote.trim() || undefined });
      showPopup("Rejected");
      setRejectVisible(false);
      await load();
    } catch (err: any) {
      showPopup(err?.message || "Failed to reject", "error");
    } finally {
      setBusyId(null);
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

      {popup.visible && (
        <View
          style={[
            styles.popup,
            popup.type === "success"
              ? styles.successPopup
              : styles.errorPopup,
          ]}
        >
          <Text style={styles.popupText}>{popup.message}</Text>
        </View>
      )}

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >

        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          >
            <Ionicons name="chevron-back" size={22} color={c.text} />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Leave Requests</Text>
            <Text style={styles.subtitle}>
              {items.length} pending
            </Text>
          </View>
        </View>

        {items.length === 0 && (
          <View style={styles.emptyBox}>
            <Ionicons
              name="checkmark-done-outline"
              size={48}
              color={c.textFaint}
            />
            <Text style={styles.emptyTitle}>All clear</Text>
            <Text style={styles.emptySub}>
              No pending leave requests.
            </Text>
          </View>
        )}

        {items.map((r) => (
          <View key={r.id} style={styles.card}>

            <View style={styles.cardHead}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(r.user?.name || "U").charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>
                  {r.user?.name || "User"}
                </Text>
                <Text style={styles.cardEmail}>
                  {r.user?.email || ""}
                </Text>
              </View>
              <View style={styles.daysChip}>
                <Text style={styles.daysChipText}>
                  {r.totalDays}d
                </Text>
              </View>
            </View>

            <View style={styles.timeBox}>
              <View style={styles.timeRow}>
                <Text style={styles.timeLabel}>Type</Text>
                <Text style={styles.timeValue}>
                  {r.leaveType?.name || r.leaveTypeCode}
                </Text>
              </View>
              <View style={styles.timeRow}>
                <Text style={styles.timeLabel}>Dates</Text>
                <Text style={styles.timeValue}>
                  {r.fromDate}
                  {r.fromDate !== r.toDate && ` → ${r.toDate}`}
                </Text>
              </View>
              {r.halfDay && (
                <View style={styles.timeRow}>
                  <Text style={styles.timeLabel}>Half-day</Text>
                  <Text style={styles.timeValue}>
                    {r.halfDayPart === "FIRST"
                      ? "First half"
                      : "Second half"}
                  </Text>
                </View>
              )}
            </View>

            <Text style={styles.reasonLabel}>Reason</Text>
            <Text style={styles.reasonText}>{r.reason}</Text>

            {r.attachmentUrl ? (
              <Text style={styles.attachmentLink}>
                Attachment: {r.attachmentUrl}
              </Text>
            ) : null}

            <View style={styles.actions}>
              <TouchableOpacity
                style={[
                  styles.rejectBtn,
                  busyId === r.id && { opacity: 0.6 },
                ]}
                onPress={() => openReject(r)}
                disabled={busyId === r.id}
              >
                <Ionicons
                  name="close-outline"
                  size={18}
                  color={c.text}
                />
                <Text style={styles.actionText}>Reject</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.approveBtn,
                  busyId === r.id && { opacity: 0.6 },
                ]}
                onPress={() => doApprove(r)}
                disabled={busyId === r.id}
              >
                {busyId === r.id ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons
                      name="checkmark-outline"
                      size={18}
                      color="#fff"
                    />
                    <Text style={styles.actionText}>Approve</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

          </View>
        ))}

      </ScrollView>

      {/* REJECT MODAL */}
      <Modal
        visible={rejectVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRejectVisible(false)}
      >
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>

            <Text style={styles.modalTitle}>Reject leave</Text>

            <Text style={styles.label}>
              Reason (shown to user)
            </Text>

            <TextInput
              style={styles.input}
              value={rejectNote}
              onChangeText={setRejectNote}
              placeholder="Optional"
              placeholderTextColor={c.textFaint}
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setRejectVisible(false)}
              >
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.rejectConfirm,
                  busyId && { opacity: 0.7 },
                ]}
                onPress={submitReject}
                disabled={!!busyId}
              >
                {busyId ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.modalBtnText, { color: "#fff" }]}>Reject</Text>
                )}
              </TouchableOpacity>
            </View>

          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

const makeStyles = (c: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  loader: {
    flex: 1,
    backgroundColor: c.bg,
    justifyContent: "center",
    alignItems: "center" },

  popup: {
    position: "absolute",
    top: 60,
    left: 20,
    right: 20,
    padding: 14,
    borderRadius: 14,
    zIndex: 999 },
  successPopup: { backgroundColor: "#16a34a" },
  errorPopup: { backgroundColor: "#dc2626" },
  popupText: { color: c.text, fontWeight: "700", textAlign: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
    marginTop: 10,
    gap: 12 },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: c.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  title: { color: c.text, fontSize: 24, fontWeight: "800" },
  subtitle: { color: c.textMuted, fontSize: 13, marginTop: 3 },

  emptyBox: {
    alignItems: "center",
    padding: 40,
    backgroundColor: c.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    marginTop: 20 },
  emptyTitle: {
    color: c.text,
    fontSize: 17,
    fontWeight: "700",
    marginTop: 14 },
  emptySub: {
    color: c.textMuted,
    fontSize: 13,
    marginTop: 6,
    textAlign: "center" },

  card: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.accent,
    justifyContent: "center",
    alignItems: "center" },
  avatarText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  cardName: { color: c.text, fontSize: 15, fontWeight: "700" },
  cardEmail: { color: c.textMuted, fontSize: 12, marginTop: 2 },
  daysChip: {
    backgroundColor: c.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999 },
  daysChipText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800" },

  timeBox: {
    backgroundColor: c.surfaceMuted,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    marginBottom: 12 },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    gap: 12 },
  timeLabel: {
    color: c.textMuted,
    fontSize: 12,
    fontWeight: "600" },
  timeValue: {
    color: c.text,
    fontSize: 13,
    fontWeight: "700",
    flexShrink: 1,
    textAlign: "right" },

  reasonLabel: {
    color: c.textMuted,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6 },
  reasonText: {
    color: c.text,
    fontSize: 14,
    lineHeight: 20 },
  attachmentLink: {
    color: "#60a5fa",
    fontSize: 12,
    marginTop: 8 },

  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14 },
  rejectBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#dc2626",
    paddingVertical: 11,
    borderRadius: 10,
    gap: 5 },
  approveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#16a34a",
    paddingVertical: 11,
    borderRadius: 10,
    gap: 5 },
  actionText: {
    color: c.text,
    fontWeight: "700",
    fontSize: 14 },

  modalOverlay: {
    flex: 1,
    backgroundColor: c.overlay,
    justifyContent: "center",
    padding: 20 },
  modalCard: {
    backgroundColor: c.surface,
    borderRadius: 18,
    padding: 20 },
  modalTitle: {
    color: c.text,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 16 },
  label: {
    color: c.textMuted,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6 },
  input: {
    backgroundColor: c.surfaceMuted,
    color: c.text,
    borderRadius: 12,
    padding: 13,
    minHeight: 80,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    fontSize: 14 },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18 },
  cancelBtn: {
    flex: 1,
    backgroundColor: c.surfaceMuted,
    padding: 13,
    borderRadius: 11,
    alignItems: "center" },
  rejectConfirm: {
    flex: 1,
    backgroundColor: "#dc2626",
    padding: 13,
    borderRadius: 11,
    alignItems: "center" },
  modalBtnText: { color: c.text, fontWeight: "700" } });

