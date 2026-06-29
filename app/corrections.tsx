import React, {
  useEffect,
  useState, useMemo} from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Platform,
  Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useRouter } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import {
  listPendingCorrections,
  decideCorrection,
  bulkDecideCorrections } from "../src/services/corrections";

import { AttendanceCorrection } from "../src/types";

import { useTheme } from "../src/theme/ThemeProvider";
import { WebModal, ModalActions } from "../src/components/WebModal";
export default function Corrections() {

  const router = useRouter();

  const { theme } = useTheme();

  const c = theme.colors;

  const styles = useMemo(() => makeStyles(c), [c]);

  const [items, setItems] = useState<AttendanceCorrection[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const [rejectVisible, setRejectVisible] = useState(false);
  const [rejectTarget, setRejectTarget] =
    useState<AttendanceCorrection | null>(null);
  const [rejectReason, setRejectReason] = useState("");

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
      const res = await listPendingCorrections(token);
      const list = res || [];
      setItems(list);
      const validIds = new Set(list.map((i) => i.id));
      setSelected((prev) => new Set([...prev].filter((id) => validIds.has(id))));
    } catch (err: any) {
      showPopup(err?.message || "Failed to load", "error");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const confirmApprove = async (
    c: AttendanceCorrection
  ): Promise<boolean> => {
    if (Platform.OS === "web") {
      return Promise.resolve(
        typeof window !== "undefined" &&
          window.confirm(
            `Approve correction for ${c.user?.name || "user"} on ${c.attendanceDate || ""}?`
          )
      );
    }
    return new Promise((resolve) => {
      Alert.alert(
        "Approve correction?",
        `${c.user?.name || "User"} · ${c.attendanceDate || ""}`,
        [
          { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
          { text: "Approve", onPress: () => resolve(true) },
        ]
      );
    });
  };

  const doApprove = async (c: AttendanceCorrection) => {
    if (busyId) return;
    const ok = await confirmApprove(c);
    if (!ok) return;
    try {
      setBusyId(c.id);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await decideCorrection(token, c.id, { action: "APPROVE" });
      showPopup("Approved");
      await load();
    } catch (err: any) {
      showPopup(err?.message || "Failed to approve", "error");
    } finally {
      setBusyId(null);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = items.length > 0 && selected.size === items.length;

  const toggleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)));
  };

  const confirmBulk = async (count: number): Promise<boolean> => {
    const msg = `Approve ${count} correction${count === 1 ? "" : "s"}?`;
    if (Platform.OS === "web") {
      return Promise.resolve(
        typeof window !== "undefined" && window.confirm(msg)
      );
    }
    return new Promise((resolve) => {
      Alert.alert("Approve corrections?", msg, [
        { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
        { text: "Approve", onPress: () => resolve(true) },
      ]);
    });
  };

  const approveMany = async (targets: AttendanceCorrection[]) => {
    if (bulkBusy || busyId || targets.length === 0) return;
    const ok = await confirmBulk(targets.length);
    if (!ok) return;
    try {
      setBulkBusy(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      // One request handles the whole batch server-side; each row is
      // decided independently so a single bad row can't fail the rest.
      const res = await bulkDecideCorrections(
        token,
        targets.map((t) => t.id),
        "APPROVE"
      );
      const done = res.succeeded;
      const failed = res.failed;
      if (failed === 0) {
        showPopup(`Approved ${done} correction${done === 1 ? "" : "s"}`);
      } else {
        showPopup(`Approved ${done}, ${failed} failed`, "error");
      }
      setSelected(new Set());
      await load();
    } catch (err: any) {
      showPopup(err?.message || "Bulk approve failed", "error");
    } finally {
      setBulkBusy(false);
    }
  };

  const approveAll = () => approveMany(items);
  const approveSelected = () =>
    approveMany(items.filter((i) => selected.has(i.id)));

  const openReject = (c: AttendanceCorrection) => {
    setRejectTarget(c);
    setRejectReason("");
    setRejectVisible(true);
  };

  const submitReject = async () => {
    if (!rejectTarget || busyId) return;
    try {
      setBusyId(rejectTarget.id);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await decideCorrection(token, rejectTarget.id, {
        action: "REJECT",
        note: rejectReason.trim() || undefined });
      showPopup("Rejected");
      setRejectVisible(false);
      await load();
    } catch (err: any) {
      showPopup(err?.message || "Failed to reject", "error");
    } finally {
      setBusyId(null);
    }
  };

  const formatTime = (iso?: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: true });
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
            <Text style={styles.title}>Correction Requests</Text>
            <Text style={styles.subtitle}>
              {items.length} pending
            </Text>
          </View>
        </View>

        {items.length > 0 && (
          <View style={styles.bulkBar}>
            <TouchableOpacity
              style={styles.selectAllBtn}
              onPress={toggleSelectAll}
              disabled={bulkBusy}
            >
              <Ionicons
                name={allSelected ? "checkbox" : "square-outline"}
                size={20}
                color={allSelected ? c.accent : c.textMuted}
              />
              <Text style={styles.selectAllText}>
                {allSelected ? "Deselect all" : "Select all"}
              </Text>
            </TouchableOpacity>

            <View style={{ flex: 1 }} />

            {selected.size > 0 && (
              <TouchableOpacity
                style={[styles.bulkBtn, styles.bulkSelectedBtn, bulkBusy && { opacity: 0.6 }]}
                onPress={approveSelected}
                disabled={bulkBusy}
              >
                <Ionicons name="checkmark-outline" size={16} color="#fff" />
                <Text style={styles.bulkBtnText}>
                  Approve selected ({selected.size})
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.bulkBtn, styles.bulkAllBtn, bulkBusy && { opacity: 0.6 }]}
              onPress={approveAll}
              disabled={bulkBusy}
            >
              {bulkBusy ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-done-outline" size={16} color="#fff" />
                  <Text style={styles.bulkBtnText}>Approve all</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {items.length === 0 && (
          <View style={styles.emptyBox}>
            <Ionicons
              name="checkmark-done-outline"
              size={48}
              color={c.textFaint}
            />
            <Text style={styles.emptyTitle}>All clear</Text>
            <Text style={styles.emptySub}>
              No pending corrections.
            </Text>
          </View>
        )}

        {items.map((corr) => (
          <View
            key={corr.id}
            style={[styles.card, selected.has(corr.id) && styles.cardSelected]}
          >

            <View style={styles.cardHead}>
              <TouchableOpacity
                style={styles.checkbox}
                onPress={() => toggleSelect(corr.id)}
                disabled={bulkBusy}
                hitSlop={8}
              >
                <Ionicons
                  name={selected.has(corr.id) ? "checkbox" : "square-outline"}
                  size={22}
                  color={selected.has(corr.id) ? c.accent : c.textMuted}
                />
              </TouchableOpacity>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(corr.user?.name || "U").charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>
                  {corr.user?.name || "User"}
                </Text>
                <Text style={styles.cardMeta}>
                  {corr.attendanceDate || corr.requestedAt.slice(0, 10)}
                </Text>
              </View>
            </View>

            <View style={styles.timeBox}>
              {corr.requestedCheckIn && (
                <View style={styles.timeRow}>
                  <Text style={styles.timeLabel}>
                    Requested check-in
                  </Text>
                  <Text style={styles.timeValue}>
                    {formatTime(corr.requestedCheckIn)}
                  </Text>
                </View>
              )}
              <View style={styles.timeRow}>
                <Text style={styles.timeLabel}>
                  Requested check-out
                </Text>
                <Text style={styles.timeValue}>
                  {formatTime(corr.requestedCheckOut)}
                </Text>
              </View>
            </View>

            <Text style={styles.reasonLabel}>Reason</Text>
            <Text style={styles.reasonText}>{corr.reason}</Text>

            <View style={styles.actions}>
              <TouchableOpacity
                style={[
                  styles.rejectBtn,
                  (busyId === corr.id || bulkBusy) && { opacity: 0.6 },
                ]}
                onPress={() => openReject(corr)}
                disabled={busyId === corr.id || bulkBusy}
              >
                <Ionicons
                  name="close-outline"
                  size={18}
                  color="#fff"
                />
                <Text style={styles.actionText}>Reject</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.approveBtn,
                  (busyId === corr.id || bulkBusy) && { opacity: 0.6 },
                ]}
                onPress={() => doApprove(corr)}
                disabled={busyId === corr.id || bulkBusy}
              >
                {busyId === corr.id ? (
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
      <WebModal
        visible={rejectVisible}
        onClose={() => setRejectVisible(false)}
        title="Reject correction"
        size="sm"
        footer={
          <ModalActions align="spread">
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
          </ModalActions>
        }
      >
        <Text style={styles.modalLabel}>
          Reason (shown to the user)
        </Text>

        <TextInput
          style={styles.input}
          value={rejectReason}
          onChangeText={setRejectReason}
          placeholder="Optional"
          placeholderTextColor={c.textFaint}
          multiline
        />
      </WebModal>

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

  bulkBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
    flexWrap: "wrap" },
  selectAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6 },
  selectAllText: {
    color: c.text,
    fontSize: 14,
    fontWeight: "600" },
  bulkBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10 },
  bulkSelectedBtn: { backgroundColor: c.accent },
  bulkAllBtn: { backgroundColor: "#16a34a" },
  bulkBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13 },

  card: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  cardSelected: {
    borderColor: c.accent,
    backgroundColor: c.accentSoft || c.surface },
  checkbox: {
    justifyContent: "center",
    alignItems: "center" },
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
  avatarText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15 },
  cardName: {
    color: c.text,
    fontSize: 15,
    fontWeight: "700" },
  cardMeta: {
    color: c.textMuted,
    fontSize: 12,
    marginTop: 2 },

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
    paddingVertical: 4 },
  timeLabel: {
    color: c.textMuted,
    fontSize: 12,
    fontWeight: "600" },
  timeValue: {
    color: c.text,
    fontSize: 13,
    fontWeight: "700" },

  reasonLabel: {
    color: c.textMuted,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6 },
  reasonText: {
    color: c.text,
    fontSize: 14,
    lineHeight: 20 },

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
  modalLabel: {
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

