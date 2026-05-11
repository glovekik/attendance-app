import React, {
  useEffect,
  useState,
} from "react";

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
} from "../../src/services/payroll";

import { downloadPdfWithAuth } from "../../src/utils/download";

import { PayrollRun, Payslip } from "../../src/types";

const monthLabel = (year: number, month: number) =>
  new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

export default function HRPayrollRun() {

  const router = useRouter();
  const params = useLocalSearchParams();
  const runId = params.runId as string;

  const [run, setRun] = useState<PayrollRun | null>(null);
  const [items, setItems] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [emailingId, setEmailingId] = useState<string | null>(null);

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

  if (loading) {
    return (
      <View style={s.loader}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!run) {
    return (
      <View style={s.loader}>
        <Text style={{ color: "#fff" }}>Run not found</Text>
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
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={22} color="#fff" />
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

    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b1220" },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  loader: { flex: 1, backgroundColor: "#0b1220", justifyContent: "center", alignItems: "center" },
  popup: { position: "absolute", top: 60, left: 20, right: 20, padding: 14, borderRadius: 14, zIndex: 999 },
  popupOk: { backgroundColor: "#16a34a" },
  popupErr: { backgroundColor: "#dc2626" },
  popupText: { color: "#fff", fontWeight: "700", textAlign: "center" },

  header: { flexDirection: "row", alignItems: "center", marginBottom: 14, marginTop: 10, gap: 12 },
  backBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: "#111827", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#1f2937" },
  title: { color: "#fff", fontSize: 22, fontWeight: "800" },
  subtitle: { color: "#94a3b8", fontSize: 12, marginTop: 3 },

  statusChip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  statusText: { color: "#fff", fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },

  runActions: { flexDirection: "row", gap: 8, marginBottom: 14, flexWrap: "wrap" },
  processBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#2563eb", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, gap: 5 },
  lockBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#16a34a", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, gap: 5 },
  emailAllBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#0d9488", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, gap: 5 },
  actionText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  empty: { padding: 30, backgroundColor: "#111827", borderRadius: 14, borderWidth: 1, borderColor: "#1f2937", alignItems: "center" },
  emptyTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  emptySub: { color: "#94a3b8", fontSize: 12, marginTop: 4, textAlign: "center" },

  card: { backgroundColor: "#111827", borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "#1f2937" },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  cardName: { color: "#fff", fontSize: 14, fontWeight: "700" },
  cardMeta: { color: "#94a3b8", fontSize: 11, marginTop: 2 },
  netPay: { color: "#16a34a", fontSize: 16, fontWeight: "800" },

  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  metaText: { color: "#94a3b8", fontSize: 11, flex: 1 },

  overChip: { backgroundColor: "#f59e0b", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  overText: { color: "#fff", fontSize: 9, fontWeight: "800" },

  payActions: { flexDirection: "row", gap: 8, marginTop: 10 },
  smallBtn: { flexDirection: "row", alignItems: "center", backgroundColor: "#2563eb", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, gap: 5 },
  smallBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
});
