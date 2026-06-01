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
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  useRouter,
  useLocalSearchParams,
} from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import DateTimePicker from "@react-native-community/datetimepicker";

import {
  WebDateField,
  dateToYMD,
  ymdToDate,
} from "../../src/components/WebDateField";

import {
  hrGetExit,
  hrDecideExit,
  hrSetExitHRTaskStatus,
  hrUpdateFFS,
  hrFinalizeFFS,
  hrMarkFFSPaid,
  hrIssueExperienceLetter,
  hrCompleteExit,
} from "../../src/services/exit";

import { API_URL } from "../../src/config";

import { downloadPdfWithAuth } from "../../src/utils/download";

import { ExitRequest, OnboardingTask } from "../../src/types";

import { useTheme } from "../../src/theme/ThemeProvider";
const isWeb = Platform.OS === "web";

export default function HRExitDetail() {

  const router = useRouter();

  const { theme } = useTheme();

  const c = theme.colors;

  const s = useMemo(() => makeStyles(c), [c]);
  const params = useLocalSearchParams();
  const id = params.id as string;

  const [data, setData] = useState<ExitRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Decide modal
  const [decideVisible, setDecideVisible] = useState(false);
  const [decideAction, setDecideAction] = useState<
    "APPROVE" | "REJECT"
  >("APPROVE");
  const [approvedDate, setApprovedDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [decideNote, setDecideNote] = useState("");

  // FFS state
  const [pendingSalary, setPendingSalary] = useState("0");
  const [leaveEncashment, setLeaveEncashment] = useState("0");
  const [bonus, setBonus] = useState("0");
  const [deductions, setDeductions] = useState("0");
  const [ffsNotes, setFfsNotes] = useState("");

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
      const res = await hrGetExit(token, id);
      setData(res);
      if (res.ffsCalculation) {
        setPendingSalary(String(res.ffsCalculation.pendingSalary || 0));
        setLeaveEncashment(String(res.ffsCalculation.leaveEncashment || 0));
        setBonus(String(res.ffsCalculation.bonus || 0));
        setDeductions(String(res.ffsCalculation.deductions || 0));
        setFfsNotes(res.ffsCalculation.notes || "");
      }
      if (res.requestedLastWorkingDay) {
        setApprovedDate(
          new Date(`${res.requestedLastWorkingDay}T00:00:00`)
        );
      }
    } catch (err: any) {
      showPopup(err?.message || "Failed to load", "error");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [id]);

  const submitDecision = async () => {
    if (!data || busy) return;
    try {
      setBusy(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await hrDecideExit(token, data.id, {
        action: decideAction,
        approvedLastWorkingDay:
          decideAction === "APPROVE"
            ? dateToYMD(approvedDate)
            : undefined,
        note: decideNote.trim() || undefined,
      });
      showPopup(decideAction === "APPROVE" ? "Approved" : "Rejected");
      setDecideVisible(false);
      await load();
    } catch (err: any) {
      showPopup(err?.message || "Failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const toggleHRTask = async (t: OnboardingTask) => {
    if (!data || busy) return;
    try {
      setBusy(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const newStatus = t.status === "DONE" ? "PENDING" : "DONE";
      const updated = await hrSetExitHRTaskStatus(token, data.id, {
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

  const saveFFS = async () => {
    if (!data || busy) return;
    try {
      setBusy(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const updated = await hrUpdateFFS(token, data.id, {
        pendingSalary: parseFloat(pendingSalary) || 0,
        leaveEncashment: parseFloat(leaveEncashment) || 0,
        bonus: parseFloat(bonus) || 0,
        deductions: parseFloat(deductions) || 0,
        notes: ffsNotes.trim() || undefined,
      });
      setData(updated);
      showPopup("F&F saved");
    } catch (err: any) {
      showPopup(err?.message || "Failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const finalizeFFS = async () => {
    if (!data || busy) return;
    try {
      setBusy(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await hrFinalizeFFS(token, data.id);
      showPopup("F&F finalized");
      await load();
    } catch (err: any) {
      showPopup(err?.message || "Failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const markPaid = async () => {
    if (!data || busy) return;
    try {
      setBusy(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await hrMarkFFSPaid(token, data.id);
      showPopup("Marked paid");
      await load();
    } catch (err: any) {
      showPopup(err?.message || "Failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const issueLetter = async () => {
    if (!data || busy) return;
    try {
      setBusy(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await hrIssueExperienceLetter(token, data.id);
      showPopup("Experience letter issued");
      await load();
    } catch (err: any) {
      showPopup(err?.message || "Failed", "error");
    } finally {
      setBusy(false);
    }
  };

  const downloadLetter = async () => {
    if (!data) return;
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const url = `${API_URL}/hr/exits/${data.id}/experience-letter`;
      const filename = `experience-letter_${data.user?.name || "user"}.pdf`;
      await downloadPdfWithAuth(url, token, filename);
    } catch (err: any) {
      showPopup(
        err?.message || "Letter not ready",
        "error"
      );
    }
  };

  const completeAll = async () => {
    if (!data || busy) return;
    try {
      setBusy(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await hrCompleteExit(token, data.id);
      showPopup("Exit completed");
      await load();
    } catch (err: any) {
      showPopup(err?.message || "Failed", "error");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={s.loader}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  if (!data) {
    return (
      <View style={s.loader}>
        <Text style={{ color: c.text }}>Not found</Text>
      </View>
    );
  }

  const ffsTotal =
    (parseFloat(pendingSalary) || 0) +
    (parseFloat(leaveEncashment) || 0) +
    (parseFloat(bonus) || 0) -
    (parseFloat(deductions) || 0);

  const ffsStatus = data.ffsCalculation?.status;

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
              {data.user?.name || "User"}
            </Text>
            <Text style={s.subtitle}>
              {data.user?.email}{"  ·  "}
              {data.status.replace("_", " ")}
            </Text>
          </View>
        </View>

        {/* DATES & REASON */}
        <View style={s.summaryCard}>
          <View style={s.row}>
            <Text style={s.label}>Requested last day</Text>
            <Text style={s.val}>{data.requestedLastWorkingDay}</Text>
          </View>
          {data.approvedLastWorkingDay && (
            <View style={s.row}>
              <Text style={s.label}>Approved last day</Text>
              <Text style={s.val}>
                {data.approvedLastWorkingDay}
              </Text>
            </View>
          )}
          <Text style={[s.label, { marginTop: 10 }]}>Reason</Text>
          <Text style={s.body}>{data.reason}</Text>
        </View>

        {/* DECIDE */}
        {data.status === "REQUESTED" && (
          <View style={s.actionsRow}>
            <TouchableOpacity
              style={s.rejectBtn}
              onPress={() => {
                setDecideAction("REJECT");
                setDecideNote("");
                setDecideVisible(true);
              }}
            >
              <Text style={s.actionText}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.approveBtn}
              onPress={() => {
                setDecideAction("APPROVE");
                setDecideNote("");
                setDecideVisible(true);
              }}
            >
              <Text style={s.actionText}>Approve</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* HR TASKS */}
        {data.status !== "REQUESTED" &&
          data.status !== "REJECTED" && (
          <>
            <Text style={[s.section, { marginTop: 14 }]}>
              HR EXIT TASKS
            </Text>
            {data.hrTasks.map((t) => {
              const done = t.status === "DONE";
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[s.card, done && { opacity: 0.6 }]}
                  onPress={() => toggleHRTask(t)}
                  activeOpacity={0.85}
                  disabled={busy}
                >
                  <Ionicons
                    name={done ? "checkmark-circle" : "ellipse-outline"}
                    size={22}
                    color={done ? "#16a34a" : "#475569"}
                  />
                  <Text
                    style={[
                      s.body,
                      { flex: 1, marginLeft: 10 },
                      done && {
                        textDecorationLine: "line-through",
                        color: c.textMuted,
                      },
                    ]}
                  >
                    {t.title}
                  </Text>
                </TouchableOpacity>
              );
            })}

            {/* F&F */}
            <Text style={[s.section, { marginTop: 14 }]}>
              FULL & FINAL{ffsStatus ? `  ·  ${ffsStatus}` : ""}
            </Text>
            <View style={s.ffsCard}>
              <View style={s.twoCol}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Pending salary</Text>
                  <TextInput
                    style={s.inputSmall}
                    value={pendingSalary}
                    onChangeText={setPendingSalary}
                    keyboardType="decimal-pad"
                    editable={ffsStatus === "DRAFT" || !ffsStatus}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Leave encashment</Text>
                  <TextInput
                    style={s.inputSmall}
                    value={leaveEncashment}
                    onChangeText={setLeaveEncashment}
                    keyboardType="decimal-pad"
                    editable={ffsStatus === "DRAFT" || !ffsStatus}
                  />
                </View>
              </View>
              <View style={s.twoCol}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Bonus</Text>
                  <TextInput
                    style={s.inputSmall}
                    value={bonus}
                    onChangeText={setBonus}
                    keyboardType="decimal-pad"
                    editable={ffsStatus === "DRAFT" || !ffsStatus}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Deductions</Text>
                  <TextInput
                    style={s.inputSmall}
                    value={deductions}
                    onChangeText={setDeductions}
                    keyboardType="decimal-pad"
                    editable={ffsStatus === "DRAFT" || !ffsStatus}
                  />
                </View>
              </View>
              <Text style={s.label}>Notes</Text>
              <TextInput
                style={[s.inputSmall, { minHeight: 60 }]}
                value={ffsNotes}
                onChangeText={setFfsNotes}
                placeholder="Optional"
                placeholderTextColor={c.textFaint}
                multiline
                editable={ffsStatus === "DRAFT" || !ffsStatus}
              />
              <View style={s.ffsTotal}>
                <Text style={s.ffsTotalLabel}>Total payable</Text>
                <Text style={s.ffsTotalVal}>
                  ₹ {ffsTotal.toLocaleString("en-IN")}
                </Text>
              </View>
              <View style={s.ffsActions}>
                {(ffsStatus === "DRAFT" || !ffsStatus) && (
                  <>
                    <TouchableOpacity
                      style={s.smallBtn}
                      onPress={saveFFS}
                      disabled={busy}
                    >
                      <Text style={s.smallBtnText}>Save</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        s.smallBtn,
                        { backgroundColor: c.accent },
                      ]}
                      onPress={finalizeFFS}
                      disabled={busy}
                    >
                      <Text style={s.smallBtnText}>
                        Finalize
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
                {ffsStatus === "FINALIZED" && (
                  <TouchableOpacity
                    style={[
                      s.smallBtn,
                      { backgroundColor: "#16a34a" },
                    ]}
                    onPress={markPaid}
                    disabled={busy}
                  >
                    <Text style={s.smallBtnText}>
                      Mark Paid
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* EXPERIENCE LETTER */}
            <Text style={[s.section, { marginTop: 14 }]}>
              EXPERIENCE LETTER
            </Text>
            <View style={s.row2}>
              <TouchableOpacity
                style={s.smallBtn}
                onPress={issueLetter}
                disabled={busy}
              >
                <Text style={s.smallBtnText}>
                  {data.experienceLetterIssuedAt
                    ? "Re-issue"
                    : "Issue Letter"}
                </Text>
              </TouchableOpacity>
              {data.experienceLetterIssuedAt && (
                <TouchableOpacity
                  style={[
                    s.smallBtn,
                    { backgroundColor: "#0d9488" },
                  ]}
                  onPress={downloadLetter}
                >
                  <Text style={s.smallBtnText}>Download</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* COMPLETE */}
            {data.status !== "COMPLETED" && (
              <TouchableOpacity
                style={[s.completeBtn, busy && { opacity: 0.7 }]}
                onPress={completeAll}
                disabled={busy}
              >
                <Ionicons
                  name="flag-outline"
                  size={18}
                  color="#fff"
                />
                <Text style={s.completeText}>
                  Complete Exit
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}

      </ScrollView>

      {/* DECIDE MODAL */}
      <Modal
        visible={decideVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDecideVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false}>

              <Text style={s.modalTitle}>
                {decideAction === "APPROVE"
                  ? "Approve Exit"
                  : "Reject Exit"}
              </Text>

              {decideAction === "APPROVE" && (
                <>
                  <Text style={s.label}>Approved last working day</Text>
                  {isWeb ? (
                    <View style={s.dateRow}>
                      <Ionicons
                        name="calendar-outline"
                        size={18}
                        color={c.textMuted}
                      />
                      <WebDateField
                        mode="date"
                        value={dateToYMD(approvedDate)}
                        onChange={(v) => {
                          const d = ymdToDate(v);
                          if (d) setApprovedDate(d);
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
                          color={c.textMuted}
                        />
                        <Text style={s.dateText}>
                          {approvedDate.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </Text>
                      </TouchableOpacity>
                      {showPicker && (
                        <DateTimePicker
                          value={approvedDate}
                          mode="date"
                          onChange={(_, d) => {
                            setShowPicker(Platform.OS === "ios");
                            if (d) setApprovedDate(d);
                          }}
                        />
                      )}
                    </>
                  )}
                </>
              )}

              <Text style={s.label}>Note</Text>
              <TextInput
                style={[s.inputSmall, { minHeight: 70 }]}
                value={decideNote}
                onChangeText={setDecideNote}
                placeholder="Optional"
                placeholderTextColor={c.textFaint}
                multiline
              />

              <View style={s.modalActions}>
                <TouchableOpacity
                  style={s.cancelBtn}
                  onPress={() => setDecideVisible(false)}
                >
                  <Text style={s.modalBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    decideAction === "APPROVE"
                      ? s.approveConfirm
                      : s.rejectConfirm,
                    busy && { opacity: 0.7 },
                  ]}
                  onPress={submitDecision}
                  disabled={busy}
                >
                  {busy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={s.modalBtnText}>
                      {decideAction === "APPROVE"
                        ? "Approve"
                        : "Reject"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

            </ScrollView>
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

  section: { color: c.textMuted, fontSize: 12, letterSpacing: 1.5, fontWeight: "700", marginBottom: 10 },

  summaryCard: { backgroundColor: c.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: c.surfaceBorder, marginBottom: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  label: { color: c.textMuted, fontSize: 12, fontWeight: "600", marginBottom: 4, marginTop: 8 },
  val: { color: c.text, fontSize: 13, fontWeight: "700" },
  body: { color: c.text, fontSize: 13, lineHeight: 18 },

  actionsRow: { flexDirection: "row", gap: 10, marginTop: 10 },
  rejectBtn: { flex: 1, backgroundColor: "#dc2626", paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  approveBtn: { flex: 1, backgroundColor: "#16a34a", paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  actionText: { color: c.text, fontWeight: "700", fontSize: 14 },

  card: { flexDirection: "row", alignItems: "center", backgroundColor: c.surface, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: c.surfaceBorder },

  ffsCard: { backgroundColor: c.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: c.surfaceBorder },
  twoCol: { flexDirection: "row", gap: 10 },
  inputSmall: { backgroundColor: c.surfaceMuted, color: c.text, borderRadius: 10, padding: 11, borderWidth: 1, borderColor: c.surfaceBorder, fontSize: 13, marginTop: 4 },
  ffsTotal: { flexDirection: "row", justifyContent: "space-between", marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: c.surfaceBorder },
  ffsTotalLabel: { color: c.text, fontWeight: "800", fontSize: 14 },
  ffsTotalVal: { color: "#16a34a", fontWeight: "800", fontSize: 16 },
  ffsActions: { flexDirection: "row", gap: 8, marginTop: 12 },

  row2: { flexDirection: "row", gap: 10 },
  smallBtn: { backgroundColor: c.accent, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  smallBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  completeBtn: { marginTop: 22, backgroundColor: "#16a34a", paddingVertical: 14, borderRadius: 14, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 },
  completeText: { color: c.text, fontWeight: "700", fontSize: 15 },

  modalOverlay: { flex: 1, backgroundColor: c.overlay, justifyContent: "center", padding: 20 },
  modalCard: { backgroundColor: c.surface, borderRadius: 18, padding: 20, maxHeight: "90%" },
  modalTitle: { color: c.text, fontSize: 22, fontWeight: "800" },
  dateRow: { flexDirection: "row", alignItems: "center", backgroundColor: c.surfaceMuted, borderRadius: 12, padding: 13, borderWidth: 1, borderColor: c.surfaceBorder, gap: 10 },
  dateText: { color: c.text, fontWeight: "700", fontSize: 14 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 18 },
  cancelBtn: { flex: 1, backgroundColor: c.surfaceMuted, padding: 13, borderRadius: 11, alignItems: "center" },
  approveConfirm: { flex: 1, backgroundColor: "#16a34a", padding: 13, borderRadius: 11, alignItems: "center" },
  rejectConfirm: { flex: 1, backgroundColor: "#dc2626", padding: 13, borderRadius: 11, alignItems: "center" },
  modalBtnText: { color: c.text, fontWeight: "700" },
});
