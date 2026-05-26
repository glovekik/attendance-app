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
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useRouter } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import {
  listMyAssets,
  reportAssetIssue } from "../src/services/assets";

import { Asset, AssetReportType } from "../src/types";

import { useTheme } from "../src/theme/ThemeProvider";
const REPORT_TYPES: { value: AssetReportType; label: string }[] = [
  { value: "DAMAGE", label: "Damaged" },
  { value: "LOSS", label: "Lost" },
  { value: "OTHER", label: "Other issue" },
];

export default function MyAssets() {

  const router = useRouter();

  const { theme } = useTheme();

  const c = theme.colors;

  const styles = useMemo(() => makeStyles(c), [c]);

  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  const [popup, setPopup] = useState({
    visible: false,
    type: "success" as "success" | "error",
    message: "" });

  const [modalVisible, setModalVisible] = useState(false);
  const [target, setTarget] = useState<Asset | null>(null);
  const [reportType, setReportType] =
    useState<AssetReportType>("DAMAGE");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

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
      const res = await listMyAssets(token);
      setAssets(res || []);
    } catch (err: any) {
      showPopup(err?.message || "Failed to load", "error");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openReport = (a: Asset) => {
    setTarget(a);
    setReportType("DAMAGE");
    setDescription("");
    setModalVisible(true);
  };

  const submit = async () => {

    if (saving || !target) return;

    if (!description.trim()) {
      showPopup("Description required", "error");
      return;
    }

    try {
      setSaving(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;

      await reportAssetIssue(token, target.id, {
        reportType,
        description: description.trim() });

      showPopup("Issue reported");
      setModalVisible(false);
      await load();
    } catch (err: any) {
      showPopup(err?.message || "Failed to report", "error");
    } finally {
      setSaving(false);
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
            <Text style={styles.title}>My Assets</Text>
            <Text style={styles.subtitle}>
              {assets.length} assigned to you
            </Text>
          </View>
        </View>

        {assets.length === 0 && (
          <View style={styles.emptyBox}>
            <Ionicons
              name="cube-outline"
              size={48}
              color={c.textFaint}
            />
            <Text style={styles.emptyTitle}>
              No assets assigned
            </Text>
            <Text style={styles.emptySub}>
              When HR assigns a laptop or device to you, it&apos;ll appear here.
            </Text>
          </View>
        )}

        {assets.map((a) => (
          <View key={a.id} style={styles.card}>

            <View style={styles.iconBox}>
              <Ionicons
                name="hardware-chip-outline"
                size={22}
                color="#fff"
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.cardName}>{a.name}</Text>
              <Text style={styles.cardMeta}>
                {a.code}
                {a.category ? `  ·  ${a.category}` : ""}
                {a.serialNumber ? `  ·  SN ${a.serialNumber}` : ""}
              </Text>
              {a.notes ? (
                <Text style={styles.cardNotes}>{a.notes}</Text>
              ) : null}

              <TouchableOpacity
                style={styles.reportBtn}
                onPress={() => openReport(a)}
              >
                <Ionicons
                  name="warning-outline"
                  size={14}
                  color="#fbbf24"
                />
                <Text style={styles.reportText}>
                  Report issue
                </Text>
              </TouchableOpacity>
            </View>

          </View>
        ))}

      </ScrollView>

      {/* REPORT MODAL */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>

            <Text style={styles.modalTitle}>Report Issue</Text>
            <Text style={styles.hint}>
              {target?.name}
              {target?.code ? `  ·  ${target.code}` : ""}
            </Text>

            <Text style={styles.label}>Type</Text>
            <View style={styles.chipPicker}>
              {REPORT_TYPES.map((t) => (
                <TouchableOpacity
                  key={t.value}
                  style={[
                    styles.pickBtn,
                    reportType === t.value && styles.pickActive,
                  ]}
                  onPress={() => setReportType(t.value)}
                >
                  <Text
                    style={[
                      styles.pickText,
                      reportType === t.value && {
                        color: "#fff" },
                    ]}
                  >
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              value={description}
              onChangeText={setDescription}
              placeholder="What happened?"
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
                  styles.saveBtn,
                  saving && { opacity: 0.7 },
                ]}
                onPress={submit}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.modalBtnText, { color: "#fff" }]}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>

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
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    gap: 12 },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#a855f7",
    justifyContent: "center",
    alignItems: "center" },
  cardName: { color: c.text, fontSize: 15, fontWeight: "700" },
  cardMeta: { color: c.textMuted, fontSize: 12, marginTop: 4 },
  cardNotes: {
    color: c.text,
    fontSize: 12,
    marginTop: 6,
    lineHeight: 17 },

  reportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: "rgba(251, 191, 36, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.4)" },
  reportText: {
    color: "#fbbf24",
    fontSize: 12,
    fontWeight: "700" },

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

  input: {
    backgroundColor: c.surfaceMuted,
    color: c.text,
    borderRadius: 12,
    padding: 13,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    fontSize: 14 },
  multiline: {
    minHeight: 90,
    textAlignVertical: "top" },

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
  saveBtn: {
    flex: 1,
    backgroundColor: "#16a34a",
    padding: 14,
    borderRadius: 12,
    alignItems: "center" },
  modalBtnText: { color: c.text, fontWeight: "700" } });

