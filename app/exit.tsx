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
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  Platform,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useRouter } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import DateTimePicker from "@react-native-community/datetimepicker";

import {
  WebDateField,
  dateToYMD,
  ymdToDate,
} from "../src/components/WebDateField";

import {
  userResign,
  getMyExit,
  setMyExitTaskStatus,
  downloadExperienceLetterUrl,
} from "../src/services/exit";

import { downloadPdfWithAuth } from "../src/utils/download";

import { ExitRequest, OnboardingTask } from "../src/types";

const isWeb = Platform.OS === "web";

export default function MyExit() {

  const router = useRouter();

  const [data, setData] = useState<ExitRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Form state for resign
  const [formVisible, setFormVisible] = useState(false);
  const [reason, setReason] = useState("");
  const [lastDay, setLastDay] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d;
  });
  const [showPicker, setShowPicker] = useState(false);

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
      const res = await getMyExit(token);
      setData(res);
      if (!res) setFormVisible(true);
    } catch (err: any) {
      showPopup(err?.message || "Failed to load", "error");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const submitResign = async () => {
    if (busy) return;
    if (!reason.trim()) {
      showPopup("Reason required", "error");
      return;
    }
    try {
      setBusy(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await userResign(token, {
        reason: reason.trim(),
        requestedLastWorkingDay: dateToYMD(lastDay),
      });
      showPopup("Resignation submitted");
      setFormVisible(false);
      await load();
    } catch (err: any) {
      showPopup(err?.message || "Failed to submit", "error");
    } finally {
      setBusy(false);
    }
  };

  const toggleTask = async (t: OnboardingTask) => {
    if (!data || busy) return;
    try {
      setBusy(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const newStatus = t.status === "DONE" ? "PENDING" : "DONE";
      const updated = await setMyExitTaskStatus(token, {
        taskId: t.id,
        status: newStatus,
      });
      setData(updated);
    } catch (err: any) {
      showPopup(err?.message || "Failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const downloadLetter = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await downloadPdfWithAuth(
        downloadExperienceLetterUrl(),
        token,
        "experience-letter.pdf"
      );
    } catch (err: any) {
      showPopup(
        err?.message || "Letter not ready yet",
        "error"
      );
    }
  };

  if (loading) {
    return (
      <View style={s.loader}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!data && !formVisible) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <TouchableOpacity
            style={s.backBtn}
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Exit</Text>
          </View>
        </View>
        <View style={s.empty}>
          <Text style={s.emptyTitle}>No active resignation</Text>
          <TouchableOpacity
            style={s.primary}
            onPress={() => setFormVisible(true)}
          >
            <Text style={s.primaryText}>Submit resignation</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
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
            <Text style={s.title}>My Exit</Text>
          </View>
        </View>

        {/* RESIGN FORM */}
        {!data && formVisible && (
          <>
            <Text style={s.section}>RESIGNATION</Text>

            <Text style={s.label}>Last working day</Text>
            {isWeb ? (
              <View style={s.dateRow}>
                <Ionicons
                  name="calendar-outline"
                  size={18}
                  color="#94a3b8"
                />
                <WebDateField
                  mode="date"
                  value={dateToYMD(lastDay)}
                  onChange={(v) => {
                    const d = ymdToDate(v);
                    if (d) setLastDay(d);
                  }}
                />
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={s.dateRow}
                  onPress={() => setShowPicker(true)}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={18}
                    color="#94a3b8"
                  />
                  <Text style={s.dateText}>
                    {lastDay.toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </Text>
                </TouchableOpacity>
                {showPicker && (
                  <DateTimePicker
                    value={lastDay}
                    mode="date"
                    onChange={(_, d) => {
                      setShowPicker(Platform.OS === "ios");
                      if (d) setLastDay(d);
                    }}
                  />
                )}
              </>
            )}

            <Text style={s.label}>Reason</Text>
            <TextInput
              style={[s.input, s.multi]}
              value={reason}
              onChangeText={setReason}
              placeholder="Why are you resigning?"
              placeholderTextColor="#64748b"
              multiline
            />

            <TouchableOpacity
              style={[s.primary, busy && { opacity: 0.7 }]}
              onPress={submitResign}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.primaryText}>Submit Resignation</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {/* EXISTING REQUEST */}
        {data && (
          <>
            <View style={s.statusCard}>
              <View
                style={[
                  s.statusChip,
                  data.status === "REQUESTED" && {
                    backgroundColor: "#f59e0b",
                  },
                  data.status === "APPROVED" && {
                    backgroundColor: "#2563eb",
                  },
                  data.status === "IN_PROGRESS" && {
                    backgroundColor: "#0d9488",
                  },
                  data.status === "COMPLETED" && {
                    backgroundColor: "#16a34a",
                  },
                  data.status === "REJECTED" && {
                    backgroundColor: "#dc2626",
                  },
                ]}
              >
                <Text style={s.statusText}>{data.status}</Text>
              </View>
              <Text style={s.statusInfo}>
                Requested: {data.requestedLastWorkingDay}
              </Text>
              {data.approvedLastWorkingDay && (
                <Text style={s.statusInfo}>
                  Approved: {data.approvedLastWorkingDay}
                </Text>
              )}
              {data.note ? (
                <Text style={s.note}>HR note: {data.note}</Text>
              ) : null}
            </View>

            <Text style={s.section}>YOUR REASON</Text>
            <View style={s.card}>
              <Text style={s.body}>{data.reason}</Text>
            </View>

            {/* MY TASKS */}
            {data.employeeTasks.length > 0 && (
              <>
                <Text style={[s.section, { marginTop: 14 }]}>
                  YOUR EXIT TASKS
                </Text>
                {data.employeeTasks.map((t) => {
                  const done = t.status === "DONE";
                  return (
                    <TouchableOpacity
                      key={t.id}
                      style={[s.card, done && { opacity: 0.6 }]}
                      onPress={() => toggleTask(t)}
                      disabled={busy || data.status === "COMPLETED"}
                      activeOpacity={0.85}
                    >
                      <Ionicons
                        name={
                          done
                            ? "checkmark-circle"
                            : "ellipse-outline"
                        }
                        size={22}
                        color={done ? "#16a34a" : "#475569"}
                      />
                      <Text
                        style={[
                          s.body,
                          { flex: 1, marginLeft: 10 },
                          done && {
                            textDecorationLine: "line-through",
                            color: "#94a3b8",
                          },
                        ]}
                      >
                        {t.title}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}

            {/* F&F */}
            {data.ffsCalculation && (
              <>
                <Text style={[s.section, { marginTop: 14 }]}>
                  FULL & FINAL
                </Text>
                <View style={s.ffsCard}>
                  <View style={s.ffsRow}>
                    <Text style={s.ffsLabel}>Pending salary</Text>
                    <Text style={s.ffsVal}>
                      ₹{(data.ffsCalculation.pendingSalary || 0).toLocaleString("en-IN")}
                    </Text>
                  </View>
                  <View style={s.ffsRow}>
                    <Text style={s.ffsLabel}>
                      Leave encashment
                    </Text>
                    <Text style={s.ffsVal}>
                      ₹{(data.ffsCalculation.leaveEncashment || 0).toLocaleString("en-IN")}
                    </Text>
                  </View>
                  <View style={s.ffsRow}>
                    <Text style={s.ffsLabel}>Bonus</Text>
                    <Text style={s.ffsVal}>
                      ₹{(data.ffsCalculation.bonus || 0).toLocaleString("en-IN")}
                    </Text>
                  </View>
                  <View style={s.ffsRow}>
                    <Text style={s.ffsLabel}>Deductions</Text>
                    <Text style={s.ffsVal}>
                      − ₹{(data.ffsCalculation.deductions || 0).toLocaleString("en-IN")}
                    </Text>
                  </View>
                  <View style={s.ffsTotal}>
                    <Text style={s.ffsTotalLabel}>
                      Total payable
                    </Text>
                    <Text style={s.ffsTotalVal}>
                      ₹{(data.ffsCalculation.totalPayable || 0).toLocaleString("en-IN")}
                    </Text>
                  </View>
                  <View
                    style={[
                      s.statusChip,
                      { alignSelf: "flex-start", marginTop: 10 },
                      data.ffsCalculation.status === "PAID" && {
                        backgroundColor: "#16a34a",
                      },
                      data.ffsCalculation.status === "FINALIZED" && {
                        backgroundColor: "#2563eb",
                      },
                      data.ffsCalculation.status === "DRAFT" && {
                        backgroundColor: "#6b7280",
                      },
                    ]}
                  >
                    <Text style={s.statusText}>
                      {data.ffsCalculation.status}
                    </Text>
                  </View>
                </View>
              </>
            )}

            {/* EXPERIENCE LETTER */}
            {data.experienceLetterIssuedAt && (
              <TouchableOpacity
                style={s.letterBtn}
                onPress={downloadLetter}
              >
                <Ionicons
                  name="document-text-outline"
                  size={18}
                  color="#fff"
                />
                <Text style={s.letterText}>
                  Download Experience Letter
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}

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

  header: { flexDirection: "row", alignItems: "center", marginBottom: 18, marginTop: 10, gap: 12 },
  backBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: "#111827", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#1f2937" },
  title: { color: "#fff", fontSize: 24, fontWeight: "800" },

  section: { color: "#64748b", fontSize: 12, letterSpacing: 1.5, fontWeight: "700", marginBottom: 10 },

  label: { color: "#94a3b8", fontSize: 13, fontWeight: "600", marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: "#0f172a", color: "#fff", borderRadius: 12, padding: 13, borderWidth: 1, borderColor: "#1e293b", fontSize: 14 },
  multi: { minHeight: 90, textAlignVertical: "top" },
  dateRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#0f172a", borderRadius: 12, padding: 13, borderWidth: 1, borderColor: "#1e293b", gap: 10 },
  dateText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  primary: { marginTop: 22, backgroundColor: "#2563eb", paddingVertical: 14, borderRadius: 14, alignItems: "center" },
  primaryText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  empty: { padding: 30, alignItems: "center", marginTop: 30 },
  emptyTitle: { color: "#fff", fontSize: 16, fontWeight: "700", marginBottom: 14 },

  statusCard: { backgroundColor: "#111827", borderRadius: 14, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: "#1f2937" },
  statusChip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, alignSelf: "flex-start" },
  statusText: { color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  statusInfo: { color: "#94a3b8", fontSize: 12, marginTop: 6 },
  note: { color: "#cbd5e1", fontSize: 12, marginTop: 8, fontStyle: "italic" },

  card: { flexDirection: "row", alignItems: "center", backgroundColor: "#111827", borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#1f2937" },
  body: { color: "#e2e8f0", fontSize: 13, lineHeight: 18 },

  ffsCard: { backgroundColor: "#111827", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#1f2937" },
  ffsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  ffsLabel: { color: "#94a3b8", fontSize: 13 },
  ffsVal: { color: "#fff", fontSize: 13, fontWeight: "700" },
  ffsTotal: { flexDirection: "row", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#1f2937" },
  ffsTotalLabel: { color: "#fff", fontWeight: "800", fontSize: 14 },
  ffsTotalVal: { color: "#16a34a", fontWeight: "800", fontSize: 16 },

  letterBtn: { marginTop: 18, backgroundColor: "#0d9488", paddingVertical: 13, borderRadius: 12, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 },
  letterText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
