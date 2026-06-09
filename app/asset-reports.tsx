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
  Modal } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useRouter } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "../src/theme/ThemeProvider";
import {
  hrListAssetReports,
  hrResolveAssetReport } from "../src/services/assets";

import {
  AssetReport,
  AssetStatus } from "../src/types";

const NEW_STATUSES: AssetStatus[] = [
  "AVAILABLE",
  "DAMAGED",
  "LOST",
  "RETIRED",
];

export default function AssetReports() {

  const router = useRouter();

  const { theme } = useTheme();

  const c = theme.colors;

  const styles = useMemo(() => makeStyles(c), [c]);

  const [items, setItems] = useState<AssetReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [target, setTarget] = useState<AssetReport | null>(null);
  const [action, setAction] = useState<"RESOLVE" | "REJECT">(
    "RESOLVE"
  );
  const [resolution, setResolution] = useState("");
  const [newAssetStatus, setNewAssetStatus] =
    useState<AssetStatus>("DAMAGED");

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
      const res = await hrListAssetReports(token, "PENDING");
      setItems(res || []);
    } catch (err: any) {
      showPopup(err?.message || "Failed to load", "error");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openResolve = (
    r: AssetReport,
    initialAction: "RESOLVE" | "REJECT"
  ) => {
    setTarget(r);
    setAction(initialAction);
    setResolution("");
    setNewAssetStatus(
      r.reportType === "DAMAGE"
        ? "DAMAGED"
        : r.reportType === "LOSS"
        ? "LOST"
        : "AVAILABLE"
    );
    setModalVisible(true);
  };

  const submit = async () => {
    if (!target || busyId) return;
    try {
      setBusyId(target.id);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await hrResolveAssetReport(token, target.id, {
        action,
        resolution: resolution.trim() || undefined,
        newAssetStatus:
          action === "RESOLVE" ? newAssetStatus : undefined });
      showPopup(action === "RESOLVE" ? "Resolved" : "Rejected");
      setModalVisible(false);
      await load();
    } catch (err: any) {
      showPopup(err?.message || "Failed to update", "error");
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
            <Text style={styles.title}>Asset Reports</Text>
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
              No pending issue reports.
            </Text>
          </View>
        )}

        {items.map((r) => (
          <View key={r.id} style={styles.card}>

            <View style={styles.cardTopRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>
                  {r.asset?.name || "Asset"}
                </Text>
                <Text style={styles.cardMeta}>
                  {r.asset?.code}
                  {r.asset?.serialNumber
                    ? `  ·  SN ${r.asset.serialNumber}`
                    : ""}
                </Text>
              </View>
              {(() => {
                const tone =
                  r.reportType === "DAMAGE"
                    ? { bg: c.warningBg, fg: c.warningText }
                    : r.reportType === "LOSS"
                    ? { bg: c.dangerBg, fg: c.dangerText }
                    : { bg: c.surfaceMuted, fg: c.textMuted };
                return (
                  <View
                    style={[styles.typeChip, { backgroundColor: tone.bg }]}
                  >
                    <Text style={[styles.typeChipText, { color: tone.fg }]}>
                      {r.reportType}
                    </Text>
                  </View>
                );
              })()}
            </View>

            <Text style={styles.reporterLine}>
              By{" "}
              <Text style={{ color: c.text, fontWeight: "700" }}>
                {r.reporter?.name || "User"}
              </Text>
              {"  ·  "}
              {new Date(r.createdAt).toLocaleString([], {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit" })}
            </Text>

            <Text style={styles.descLabel}>Description</Text>
            <Text style={styles.descText}>{r.description}</Text>

            <View style={styles.actions}>
              <TouchableOpacity
                style={[
                  styles.rejectBtn,
                  busyId === r.id && { opacity: 0.6 },
                ]}
                onPress={() => openResolve(r, "REJECT")}
                disabled={busyId === r.id}
              >
                <Ionicons
                  name="close-outline"
                  size={16}
                  color="#fff"
                />
                <Text style={styles.actionText}>Reject</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.resolveBtn,
                  busyId === r.id && { opacity: 0.6 },
                ]}
                onPress={() => openResolve(r, "RESOLVE")}
                disabled={busyId === r.id}
              >
                <Ionicons
                  name="checkmark-outline"
                  size={16}
                  color="#fff"
                />
                <Text style={styles.actionText}>Resolve</Text>
              </TouchableOpacity>
            </View>

          </View>
        ))}

      </ScrollView>

      {/* RESOLVE/REJECT MODAL */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <KeyboardAwareScrollView showsVerticalScrollIndicator={false} bottomOffset={24} keyboardShouldPersistTaps="handled">

              <Text style={styles.modalTitle}>
                {action === "RESOLVE"
                  ? "Resolve Report"
                  : "Reject Report"}
              </Text>
              <Text style={styles.hint}>
                {target?.asset?.name}{" · "}
                {target?.asset?.code}
              </Text>

              {action === "RESOLVE" && (
                <>
                  <Text style={styles.label}>
                    Set asset status to
                  </Text>
                  <View style={styles.chipPicker}>
                    {NEW_STATUSES.map((s) => (
                      <TouchableOpacity
                        key={s}
                        style={[
                          styles.pickBtn,
                          newAssetStatus === s &&
                            styles.pickActive,
                        ]}
                        onPress={() => setNewAssetStatus(s)}
                      >
                        <Text
                          style={[
                            styles.pickText,
                            newAssetStatus === s && { color: "#fff" },
                          ]}
                        >
                          {s}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <Text style={styles.label}>
                {action === "RESOLVE"
                  ? "Resolution note"
                  : "Reason"}
              </Text>
              <TextInput
                style={[styles.input, styles.multiline]}
                value={resolution}
                onChangeText={setResolution}
                placeholder="Optional"
                placeholderTextColor={c.textFaint}
                multiline
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.modalBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    action === "RESOLVE"
                      ? styles.resolveConfirm
                      : styles.rejectConfirm,
                    busyId && { opacity: 0.7 },
                  ]}
                  onPress={submit}
                  disabled={!!busyId}
                >
                  {busyId ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={[styles.modalBtnText, { color: "#fff" }]}>
                      {action === "RESOLVE" ? "Resolve" : "Reject"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

            </KeyboardAwareScrollView>
          </View>
        </View>
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
  successPopup: { backgroundColor: c.successText },
  errorPopup: { backgroundColor: c.dangerText },
  popupText: { color: "#fff", fontWeight: "700", textAlign: "center" },

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
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 8 },
  cardName: { color: c.text, fontSize: 15, fontWeight: "700" },
  cardMeta: { color: c.textMuted, fontSize: 12, marginTop: 2 },

  typeChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999 },
  typeChipText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5 },

  reporterLine: {
    color: c.textMuted,
    fontSize: 12,
    marginBottom: 8 },

  descLabel: {
    color: c.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: 4 },
  descText: {
    color: c.text,
    fontSize: 13,
    lineHeight: 18 },

  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14 },
  rejectBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.dangerText,
    paddingVertical: 11,
    borderRadius: 10,
    gap: 5 },
  resolveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.successText,
    paddingVertical: 11,
    borderRadius: 10,
    gap: 5 },
  actionText: {
    color: "#fff",
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
    padding: 20,
    maxHeight: "92%" },
  modalTitle: {
    color: c.text,
    fontSize: 22,
    fontWeight: "800" },
  hint: {
    color: c.textMuted,
    fontSize: 12,
    marginTop: 4,
    marginBottom: 8 },

  label: {
    color: c.textMuted,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 14 },
  input: {
    backgroundColor: c.surfaceMuted,
    color: c.text,
    borderRadius: 12,
    padding: 13,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    fontSize: 14 },
  multiline: {
    minHeight: 80,
    textAlignVertical: "top" },

  chipPicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6 },
  pickBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: c.surfaceMuted,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  pickActive: {
    backgroundColor: c.accent,
    borderColor: c.accent },
  pickText: {
    color: c.textMuted,
    fontSize: 12,
    fontWeight: "700" },

  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 22 },
  cancelBtn: {
    flex: 1,
    backgroundColor: c.surfaceMuted,
    padding: 14,
    borderRadius: 12,
    alignItems: "center" },
  resolveConfirm: {
    flex: 1,
    backgroundColor: c.successText,
    padding: 14,
    borderRadius: 12,
    alignItems: "center" },
  rejectConfirm: {
    flex: 1,
    backgroundColor: c.dangerText,
    padding: 14,
    borderRadius: 12,
    alignItems: "center" },
  modalBtnText: { color: c.text, fontWeight: "700" } });

