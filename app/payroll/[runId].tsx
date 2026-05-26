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
  SafeAreaView,
  Platform,
  Alert,
  Modal,
  TextInput,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  useRouter,
  useLocalSearchParams,
} from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import {
  hrGetPayrollRun,
  hrProcessPayrollRun,
  hrLockPayrollRun,
  hrEmailAllPayslips,
  hrListPayslipsForRun,
  hrEmailPayslip,
  hrPayslipPdfUrl,
  hrUpdatePayslip,
} from "../../src/services/payroll";

import { downloadPdfWithAuth } from "../../src/utils/download";

import { PayrollRun, Payslip } from "../../src/types";

import { useTheme } from "../../src/theme/ThemeProvider";
const monthLabel = (year: number, month: number) =>
  new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

export default function HRPayrollRun() {

  const router = useRouter();

  const { theme } = useTheme();

  const c = theme.colors;

  const s = useMemo(() => makeStyles(c), [c]);
  const params = useLocalSearchParams();
  const runId = params.runId as string;

  const [run, setRun] = useState<PayrollRun | null>(null);
  const [items, setItems] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [emailingId, setEmailingId] = useState<string | null>(null);

  // Per-payslip working-days edit
  const [editPayslip, setEditPayslip] = useState<Payslip | null>(null);
  const [editWorkingDays, setEditWorkingDays] = useState("");
  const [editAttendedDays, setEditAttendedDays] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [popup, setPopup] = useState({
    visible: false,
    type: "success" as "success" | "error",
    message: "",
  });

  const showPopup = (
    msg: string,
    kind: "success" | "error" = "success"
  ) => {
    setPopup({ visible: true, type: kind, message: msg });
    setTimeout(() => {
      setPopup((p) => ({ ...p, visible: false }));
    }, 3000);
  };

  const load = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const [r, list] = await Promise.all([
        hrGetPayrollRun(token, runId),
        hrListPayslipsForRun(token, runId).catch(() => []),
      ]);
      setRun(r);
      setItems(list || []);
    } catch (err: any) {
      showPopup(err?.message || "Failed to load", "error");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [runId]);

  const process = async () => {
    if (!run || busy) return;
    try {
      setBusy(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const r = await hrProcessPayrollRun(token, run.id);
      showPopup(
        `Generated ${r.generated} · Skipped ${r.skipped}`
      );
      await load();
    } catch (err: any) {
      showPopup(err?.message || "Failed to process", "error");
    } finally {
      setBusy(false);
    }
  };

  const lock = async () => {
    if (!run || busy) return;
    const ask = (msg: string): Promise<boolean> => {
      if (Platform.OS === "web") {
        return Promise.resolve(
          typeof window !== "undefined" && window.confirm(msg)
        );
      }
      return new Promise((resolve) => {
        Alert.alert("Lock run?", msg, [
          { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
          { text: "Lock", onPress: () => resolve(true) },
        ]);
      });
    };
    if (
      !(await ask(
        "Once locked, payslips can no longer be overridden."
      ))
    )
      return;

    try {
      setBusy(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await hrLockPayrollRun(token, run.id);
      showPopup("Locked");
      await load();
    } catch (err: any) {
      showPopup(err?.message || "Failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const emailAll = async () => {
    if (!run || busy) return;
    try {
      setBusy(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const r = await hrEmailAllPayslips(token, run.id);
      showPopup(
        `Sent ${r.sentCount} · Failed ${r.failedCount} · Skipped ${r.skippedCount}`
      );
    } catch (err: any) {
      showPopup(err?.message || "Failed to email", "error");
    } finally {
      setBusy(false);
    }
  };

  const downloadPdf = async (p: Payslip) => {
    try {
      setDownloadingId(p.id);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const filename = `Payslip_${p.user?.name || "user"}_${p.year}_${String(p.month).padStart(2, "0")}.pdf`;
      await downloadPdfWithAuth(
        hrPayslipPdfUrl(p.id),
        token,
        filename
      );
    } catch (err: any) {
      showPopup(err?.message || "Failed", "error");
    } finally {
      setDownloadingId(null);
    }
  };

  const emailOne = async (p: Payslip) => {
    try {
      setEmailingId(p.id);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await hrEmailPayslip(token, p.id);
      showPopup(`Emailed to ${p.user?.email}`);
    } catch (err: any) {
      showPopup(err?.message || "Failed to email", "error");
    } finally {
      setEmailingId(null);
    }
  };

  const openEditDays = (p: Payslip) => {
    setEditPayslip(p);
    setEditWorkingDays(String(p.workingDays ?? ""));
    setEditAttendedDays(String(p.attendedDays ?? ""));
  };

  const saveEditDays = async () => {
    if (!editPayslip || savingEdit) return;
    const wd = parseFloat(editWorkingDays);
    const ad = parseFloat(editAttendedDays);
    if (Number.isNaN(wd) || wd <= 0) {
      showPopup("Working days must be > 0", "error");
      return;
    }
    if (Number.isNaN(ad) || ad < 0 || ad > wd) {
      showPopup("Attended days must be between 0 and working days", "error");
      return;
    }
    try {
      setSavingEdit(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await hrUpdatePayslip(token, editPayslip.id, {
        workingDays: wd,
        attendedDays: ad,
      } as any);
      showPopup("Working days updated");
      setEditPayslip(null);
      await load();
    } catch (err: any) {
      showPopup(err?.message || "Failed to update", "error");
    } finally {
      setSavingEdit(false);
    }
  };

  if (loading) {
    return (
      <View style={s.loader}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  if (!run) {
    return (
      <View style={s.loader}>
        <Text style={{ color: c.text }}>Run not found</Text>
      </View>
    );
  }

  const statusColor = (st: string) =>
    st === "LOCKED"
      ? "#16a34a"
      : st === "PROCESSED"
      ? "#2563eb"
      : "#f59e0b";

  return (
    <SafeAreaView style={s.safe}>

      {popup.visible && (
        <View
          style={[
            s.popup,
            popup.type === "success" ? s.popupOk : s.popupErr,
          ]}
        >
          <Text style={s.popupText}>{popup.message}</Text>
        </View>
      )}

      <ScrollView
        style={s.container}
        contentContainerStyle={s.content}
      >

        <View style={s.header}>
          <TouchableOpacity
            style={s.backBtn}
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          >
            <Ionicons name="chevron-back" size={22} color={c.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>
              {monthLabel(run.year, run.month)}
            </Text>
            <Text style={s.subtitle}>
              {run.workingDays} working days  ·  {items.length} payslips
            </Text>
          </View>
          <View
            style={[
              s.statusChip,
              { backgroundColor: statusColor(run.status) },
            ]}
          >
            <Text style={s.statusText}>{run.status}</Text>
          </View>
        </View>

        {/* RUN ACTIONS */}
        <View style={s.runActions}>
          {run.status !== "LOCKED" && (
            <TouchableOpacity
              style={s.processBtn}
              onPress={process}
              disabled={busy}
            >
              <Ionicons
                name="play-outline"
                size={16}
                color="#fff"
              />
              <Text style={s.actionText}>
                {run.status === "DRAFT" ? "Process" : "Re-process"}
              </Text>
            </TouchableOpacity>
          )}
          {run.status === "PROCESSED" && (
            <TouchableOpacity
              style={s.lockBtn}
              onPress={lock}
              disabled={busy}
            >
              <Ionicons
                name="lock-closed-outline"
                size={16}
                color="#fff"
              />
              <Text style={s.actionText}>Lock</Text>
            </TouchableOpacity>
          )}
          {items.length > 0 && (
            <TouchableOpacity
              style={s.emailAllBtn}
              onPress={emailAll}
              disabled={busy}
            >
              <Ionicons
                name="mail-outline"
                size={16}
                color="#fff"
              />
              <Text style={s.actionText}>Email all</Text>
            </TouchableOpacity>
          )}
        </View>

        {items.length === 0 && (
          <View style={s.empty}>
            <Text style={s.emptyTitle}>
              No payslips yet
            </Text>
            <Text style={s.emptySub}>
              Tap Process to generate payslips for everyone with a salary structure.
            </Text>
          </View>
        )}

        {items.map((p) => (
          <View key={p.id} style={s.card}>
            <View style={s.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={s.cardName}>
                  {p.user?.name || "User"}
                </Text>
                <Text style={s.cardMeta}>
                  {p.user?.email}
                  {p.user?.employeeCode
                    ? `  ·  ${p.user.employeeCode}`
                    : ""}
                </Text>
              </View>
              <Text style={s.netPay}>
                ₹ {p.netPay.toLocaleString("en-IN")}
              </Text>
            </View>

            <View style={s.metaRow}>
              <Text style={s.metaText}>
                Att {p.attendedDays}/{p.workingDays}
                {p.lopDays > 0 ? `  ·  LOP ${p.lopDays}d` : ""}
                {"  ·  "}
                Gross ₹{p.totalGross.toLocaleString("en-IN")}
                {"  ·  "}
                Ded ₹{p.totalDeductions.toLocaleString("en-IN")}
              </Text>
              {p.status === "OVERRIDDEN" && (
                <View style={s.overChip}>
                  <Text style={s.overText}>OVERRIDDEN</Text>
                </View>
              )}
            </View>

            <View style={s.payActions}>
              {run.status !== "LOCKED" && (
                <TouchableOpacity
                  style={[s.smallBtn, { backgroundColor: "#f59e0b" }]}
                  onPress={() => openEditDays(p)}
                >
                  <Ionicons
                    name="create-outline"
                    size={14}
                    color="#fff"
                  />
                  <Text style={s.smallBtnText}>Edit days</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={s.smallBtn}
                onPress={() => downloadPdf(p)}
                disabled={downloadingId === p.id}
              >
                {downloadingId === p.id ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons
                      name="download-outline"
                      size={14}
                      color="#fff"
                    />
                    <Text style={s.smallBtnText}>PDF</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  s.smallBtn,
                  { backgroundColor: "#0d9488" },
                ]}
                onPress={() => emailOne(p)}
                disabled={emailingId === p.id}
              >
                {emailingId === p.id ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons
                      name="mail-outline"
                      size={14}
                      color="#fff"
                    />
                    <Text style={s.smallBtnText}>Email</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ))}

      </ScrollView>

      <Modal
        visible={!!editPayslip}
        transparent
        animationType="slide"
        onRequestClose={() => setEditPayslip(null)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>
              Edit working days
            </Text>
            <Text style={s.modalSub}>
              {editPayslip?.user?.name}
              {editPayslip?.user?.employeeCode
                ? `  ·  ${editPayslip.user.employeeCode}`
                : ""}
            </Text>
            <Text style={s.modalLabel}>Working days</Text>
            <TextInput
              style={s.modalInput}
              value={editWorkingDays}
              onChangeText={setEditWorkingDays}
              keyboardType="decimal-pad"
              placeholder="e.g. 22"
              placeholderTextColor={c.textFaint}
            />
            <Text style={s.modalLabel}>Attended days</Text>
            <TextInput
              style={s.modalInput}
              value={editAttendedDays}
              onChangeText={setEditAttendedDays}
              keyboardType="decimal-pad"
              placeholder="e.g. 20"
              placeholderTextColor={c.textFaint}
            />
            <Text style={s.modalHint}>
              The payslip&apos;s gross and LOP deduction are recalculated
              from these numbers when you save.
            </Text>
            <View style={s.modalActions}>
              <TouchableOpacity
                style={s.modalCancel}
                onPress={() => setEditPayslip(null)}
              >
                <Text style={s.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  s.modalSave,
                  savingEdit && { opacity: 0.7 },
                ]}
                onPress={saveEditDays}
                disabled={savingEdit}
              >
                {savingEdit ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[s.modalBtnText, { color: "#fff" }]}>Save</Text>
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
  loader: { flex: 1, backgroundColor: c.bg, justifyContent: "center", alignItems: "center" },
  popup: { position: "absolute", top: 60, left: 20, right: 20, padding: 14, borderRadius: 14, zIndex: 999 },
  popupOk: { backgroundColor: "#16a34a" },
  popupErr: { backgroundColor: "#dc2626" },
  popupText: { color: c.text, fontWeight: "700", textAlign: "center" },

  header: { flexDirection: "row", alignItems: "center", marginBottom: 14, marginTop: 10, gap: 12 },
  backBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: c.surface, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: c.surfaceBorder },
  title: { color: c.text, fontSize: 22, fontWeight: "800" },
  subtitle: { color: c.textMuted, fontSize: 12, marginTop: 3 },

  statusChip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  statusText: { color: c.text, fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },

  runActions: { flexDirection: "row", gap: 8, marginBottom: 14, flexWrap: "wrap" },
  processBtn: { flexDirection: "row", alignItems: "center", backgroundColor: c.accent, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, gap: 5 },
  lockBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#16a34a", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, gap: 5 },
  emailAllBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#0d9488", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, gap: 5 },
  actionText: { color: c.text, fontWeight: "700", fontSize: 13 },

  empty: { padding: 30, backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.surfaceBorder, alignItems: "center" },
  emptyTitle: { color: c.text, fontSize: 15, fontWeight: "700" },
  emptySub: { color: c.textMuted, fontSize: 12, marginTop: 4, textAlign: "center" },

  card: { backgroundColor: c.surface, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: c.surfaceBorder },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  cardName: { color: c.text, fontSize: 14, fontWeight: "700" },
  cardMeta: { color: c.textMuted, fontSize: 11, marginTop: 2 },
  netPay: { color: "#16a34a", fontSize: 16, fontWeight: "800" },

  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  metaText: { color: c.textMuted, fontSize: 11, flex: 1 },

  overChip: { backgroundColor: "#f59e0b", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  overText: { color: c.text, fontSize: 9, fontWeight: "800" },

  payActions: { flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" },
  smallBtn: { flexDirection: "row", alignItems: "center", backgroundColor: c.accent, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 5 },
  smallBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },

  modalOverlay: { flex: 1, backgroundColor: c.overlay, justifyContent: "center", padding: 20 },
  modalCard: { backgroundColor: c.surface, borderRadius: 18, padding: 20 },
  modalTitle: { color: c.text, fontSize: 18, fontWeight: "800" },
  modalSub: { color: c.textMuted, fontSize: 12, marginTop: 4 },
  modalLabel: { color: c.textMuted, fontSize: 12, fontWeight: "600", marginTop: 14, marginBottom: 6 },
  modalInput: { backgroundColor: c.surfaceMuted, color: c.text, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: c.surfaceBorder, fontSize: 14 },
  modalHint: { color: c.textMuted, fontSize: 11, marginTop: 10, lineHeight: 16 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 18 },
  modalCancel: { flex: 1, backgroundColor: c.surfaceMuted, padding: 13, borderRadius: 11, alignItems: "center" },
  modalSave: { flex: 1, backgroundColor: "#16a34a", padding: 13, borderRadius: 11, alignItems: "center" },
  modalBtnText: { color: c.text, fontWeight: "700" },
});
