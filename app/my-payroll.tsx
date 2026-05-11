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
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useRouter } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import {
  myPayslips,
  myPayslipPdfUrl,
} from "../src/services/payroll";

import { downloadPdfWithAuth } from "../src/utils/download";

import { Payslip } from "../src/types";

const monthLabel = (year: number, month: number) =>
  new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

export default function MyPayroll() {

  const router = useRouter();

  const [items, setItems] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

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
    }, 2500);
  };

  const load = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const res = await myPayslips(token);
      setItems(res || []);
    } catch (err: any) {
      showPopup(err?.message || "Failed to load", "error");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const downloadPdf = async (p: Payslip) => {
    try {
      setDownloadingId(p.id);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const filename = `Payslip_${p.year}_${String(p.month).padStart(2, "0")}.pdf`;
      await downloadPdfWithAuth(
        myPayslipPdfUrl(p.id),
        token,
        filename
      );
    } catch (err: any) {
      showPopup(err?.message || "Download failed", "error");
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <View style={s.loader}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

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
            <Text style={s.title}>Payslips</Text>
            <Text style={s.subtitle}>
              {items.length} on record
            </Text>
          </View>
        </View>

        {items.length === 0 && (
          <View style={s.empty}>
            <Ionicons
              name="document-text-outline"
              size={48}
              color="#475569"
            />
            <Text style={s.emptyTitle}>No payslips yet</Text>
            <Text style={s.emptySub}>
              Once HR processes a payroll run, your slips will show up here.
            </Text>
          </View>
        )}

        {items.map((p) => (
          <View key={p.id} style={s.card}>
            <View style={s.cardTop}>
              <View>
                <Text style={s.cardMonth}>
                  {monthLabel(p.year, p.month)}
                </Text>
                <Text style={s.cardMeta}>
                  Working {p.attendedDays}/{p.workingDays}
                  {p.lopDays > 0 ? `  ·  LOP ${p.lopDays}d` : ""}
                </Text>
              </View>
              <Text style={s.netPay}>
                ₹ {p.netPay.toLocaleString("en-IN")}
              </Text>
            </View>

            <View style={s.breakdown}>
              <Row label="Gross" value={p.totalGross} />
              <Row
                label="Deductions"
                value={-p.totalDeductions}
                colorize="red"
              />
              {p.lopDeduction > 0 && (
                <Row
                  label="LOP"
                  value={-p.lopDeduction}
                  colorize="red"
                />
              )}
            </View>

            <TouchableOpacity
              style={s.downloadBtn}
              onPress={() => downloadPdf(p)}
              disabled={downloadingId === p.id}
            >
              {downloadingId === p.id ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons
                    name="download-outline"
                    size={16}
                    color="#fff"
                  />
                  <Text style={s.downloadText}>
                    Download PDF
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ))}

      </ScrollView>

    </SafeAreaView>
  );
}

const Row = ({
  label,
  value,
  colorize,
}: {
  label: string;
  value: number;
  colorize?: "red" | "green";
}) => (
  <View style={s.row}>
    <Text style={s.rowLabel}>{label}</Text>
    <Text
      style={[
        s.rowVal,
        colorize === "red" && { color: "#fca5a5" },
        colorize === "green" && { color: "#86efac" },
      ]}
    >
      {value < 0 ? "− " : ""}₹ {Math.abs(value).toLocaleString("en-IN")}
    </Text>
  </View>
);

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b1220" },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  loader: { flex: 1, backgroundColor: "#0b1220", justifyContent: "center", alignItems: "center" },
  popup: { position: "absolute", top: 60, left: 20, right: 20, padding: 14, borderRadius: 14, zIndex: 999 },
  popupOk: { backgroundColor: "#16a34a" },
  popupErr: { backgroundColor: "#dc2626" },
  popupText: { color: "#fff", fontWeight: "700", textAlign: "center" },

  header: { flexDirection: "row", alignItems: "center", marginBottom: 18, marginTop: 10, gap: 12 },
  backBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: "#111827", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#1f2937" },
  title: { color: "#fff", fontSize: 24, fontWeight: "800" },
  subtitle: { color: "#94a3b8", fontSize: 13, marginTop: 3 },

  empty: { padding: 40, backgroundColor: "#111827", borderRadius: 18, borderWidth: 1, borderColor: "#1f2937", alignItems: "center", marginTop: 20 },
  emptyTitle: { color: "#fff", fontSize: 17, fontWeight: "700", marginTop: 14 },
  emptySub: { color: "#94a3b8", fontSize: 13, marginTop: 6, textAlign: "center" },

  card: { backgroundColor: "#111827", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#1f2937" },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  cardMonth: { color: "#fff", fontSize: 16, fontWeight: "800" },
  cardMeta: { color: "#94a3b8", fontSize: 11, marginTop: 4 },
  netPay: { color: "#16a34a", fontSize: 22, fontWeight: "800" },

  breakdown: { backgroundColor: "#0f172a", borderRadius: 10, padding: 10, borderWidth: 1, borderColor: "#1e293b" },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  rowLabel: { color: "#94a3b8", fontSize: 12 },
  rowVal: { color: "#fff", fontSize: 13, fontWeight: "700" },

  downloadBtn: { marginTop: 12, backgroundColor: "#2563eb", paddingVertical: 10, borderRadius: 10, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6 },
  downloadText: { color: "#fff", fontWeight: "700", fontSize: 13 },
});
