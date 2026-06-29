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
  Platform,
  Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useRouter } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import {
  hrCreatePayrollRun,
  hrListPayrollRuns,
  hrDeletePayrollRun } from "../../src/services/payroll";

import { PayrollRun } from "../../src/types";

import { useTheme } from "../../src/theme/ThemeProvider";

import { WebModal, ModalActions } from "../../src/components/WebModal";

const monthLabel = (year: number, month: number) =>
  new Date(year, month - 1, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric" });

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default function HRPayroll() {

  const router = useRouter();

  const { theme } = useTheme();

  const c = theme.colors;

  const s = useMemo(() => makeStyles(c), [c]);

  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const [modalVisible, setModalVisible] = useState(false);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [workingDays, setWorkingDays] = useState("22");
  const [saving, setSaving] = useState(false);

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
      const res = await hrListPayrollRuns(token);
      setRuns(res || []);
    } catch (err: any) {
      showPopup(err?.message || "Failed to load", "error");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const submitCreate = async () => {
    if (saving) return;
    const wd = parseInt(workingDays, 10) || 22;
    if (wd <= 0 || wd > 31) {
      showPopup("Working days 1–31", "error");
      return;
    }
    try {
      setSaving(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await hrCreatePayrollRun(token, {
        year,
        month,
        workingDays: wd });
      showPopup("Run created");
      setModalVisible(false);
      await load();
    } catch (err: any) {
      showPopup(err?.message || "Failed", "error");
    } finally {
      setSaving(false);
    }
  };

  const askDelete = (r: PayrollRun) => {
    if (r.status !== "DRAFT") {
      showPopup("Only DRAFT runs can be deleted", "error");
      return;
    }
    if (Platform.OS === "web") {
      if (
        typeof window !== "undefined" &&
        window.confirm(
          `Delete ${monthLabel(r.year, r.month)} run?`
        )
      ) {
        doDelete(r.id);
      }
      return;
    }
    Alert.alert(
      "Delete run?",
      monthLabel(r.year, r.month),
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => doDelete(r.id) },
      ]
    );
  };

  const doDelete = async (id: string) => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await hrDeletePayrollRun(token, id);
      showPopup("Deleted");
      await load();
    } catch (err: any) {
      showPopup(err?.message || "Failed", "error");
    }
  };

  if (loading) {
    return (
      <View style={s.loader}>
        <ActivityIndicator size="large" color={c.accent} />
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
            <Text style={s.title}>Payroll</Text>
            <Text style={s.subtitle}>{runs.length} runs</Text>
          </View>
          <TouchableOpacity
            style={s.addBtn}
            onPress={() => setModalVisible(true)}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* SALARY STRUCTURE LINK */}
        <TouchableOpacity
          style={s.shortcut}
          onPress={() => router.push("/salary-structures")}
        >
          <View
            style={[
              s.iconBox,
              { backgroundColor: "#0d9488" },
            ]}
          >
            <Ionicons
              name="cash-outline"
              size={20}
              color="#fff"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.shortcutTitle}>Salary Structures</Text>
            <Text style={s.shortcutDesc}>
              Set per-user pay components (set this before running payroll)
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={c.textMuted}
          />
        </TouchableOpacity>

        <Text style={[s.section, { marginTop: 12 }]}>RUNS</Text>

        {runs.length === 0 && (
          <View style={s.empty}>
            <Text style={s.emptyTitle}>No payroll runs</Text>
            <Text style={s.emptySub}>
              Tap + to create one for the current month.
            </Text>
          </View>
        )}

        {runs.map((r) => (
          <TouchableOpacity
            key={r.id}
            style={s.card}
            onPress={() => router.push(`/payroll/${r.id}`)}
            onLongPress={() => askDelete(r)}
            activeOpacity={0.85}
          >
            <View style={{ flex: 1 }}>
              <Text style={s.cardName}>
                {monthLabel(r.year, r.month)}
              </Text>
              <Text style={s.cardMeta}>
                {r.workingDays} working days
                {r.generatedCount !== undefined &&
                  `  ·  ${r.generatedCount} payslips`}
              </Text>
            </View>
            <View
              style={[
                s.statusChip,
                { backgroundColor: statusColor(r.status) },
              ]}
            >
              <Text style={s.statusText}>{r.status}</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={c.textMuted}
            />
          </TouchableOpacity>
        ))}

      </ScrollView>

      <WebModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title="New Payroll Run"
        size="md"
        footer={
          <ModalActions align="spread">
            <TouchableOpacity
              style={s.cancelBtn}
              onPress={() => setModalVisible(false)}
            >
              <Text style={s.modalBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.saveBtn, saving && { opacity: 0.7 }]}
              onPress={submitCreate}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.modalBtnText}>Create</Text>
              )}
            </TouchableOpacity>
          </ModalActions>
        }
      >
        <Text style={s.label}>Year</Text>
        <TextInput
          style={s.input}
          value={String(year)}
          onChangeText={(v) =>
            setYear(parseInt(v, 10) || now.getFullYear())
          }
          keyboardType="number-pad"
        />

        <Text style={s.label}>Month</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6 }}
        >
          {MONTHS.map((m, i) => (
            <TouchableOpacity
              key={m}
              style={[
                s.monthBtn,
                month === i + 1 && s.monthActive,
              ]}
              onPress={() => setMonth(i + 1)}
            >
              <Text
                style={[
                  s.monthText,
                  month === i + 1 && { color: "#fff" },
                ]}
              >
                {m}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={s.label}>Working days</Text>
        <TextInput
          style={s.input}
          value={workingDays}
          onChangeText={setWorkingDays}
          placeholder="22"
          placeholderTextColor={c.textFaint}
          keyboardType="number-pad"
        />
      </WebModal>

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
  addBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: c.accent, justifyContent: "center", alignItems: "center" },
  title: { color: c.text, fontSize: 24, fontWeight: "800" },
  subtitle: { color: c.textMuted, fontSize: 13, marginTop: 3 },

  shortcut: { flexDirection: "row", alignItems: "center", backgroundColor: c.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: c.surfaceBorder, gap: 12 },
  iconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  shortcutTitle: { color: c.text, fontSize: 14, fontWeight: "700" },
  shortcutDesc: { color: c.textMuted, fontSize: 11, marginTop: 3 },

  section: { color: c.textMuted, fontSize: 12, letterSpacing: 1.5, fontWeight: "700", marginBottom: 10 },

  empty: { padding: 30, backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.surfaceBorder, alignItems: "center" },
  emptyTitle: { color: c.text, fontSize: 15, fontWeight: "700" },
  emptySub: { color: c.textMuted, fontSize: 12, marginTop: 4 },

  card: { flexDirection: "row", alignItems: "center", backgroundColor: c.surface, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: c.surfaceBorder, gap: 10 },
  cardName: { color: c.text, fontSize: 15, fontWeight: "700" },
  cardMeta: { color: c.textMuted, fontSize: 11, marginTop: 2 },

  statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusText: { color: c.text, fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(29,24,56,0.35)", justifyContent: "center", padding: 20 },
  modalCard: { backgroundColor: c.surface, borderRadius: 18, padding: 20 },
  modalTitle: { color: c.text, fontSize: 22, fontWeight: "800", marginBottom: 8 },

  label: { color: c.textMuted, fontSize: 13, fontWeight: "600", marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: c.surfaceMuted, color: c.text, borderRadius: 12, padding: 13, borderWidth: 1, borderColor: "#1e293b", fontSize: 14 },

  monthBtn: { paddingHorizontal: 14, paddingVertical: 10, backgroundColor: c.surfaceMuted, borderRadius: 10, borderWidth: 1, borderColor: "#1e293b" },
  monthActive: { backgroundColor: c.accent, borderColor: c.accent },
  monthText: { color: c.textMuted, fontWeight: "700", fontSize: 12 },

  modalActions: { flexDirection: "row", gap: 10, marginTop: 22 },
  cancelBtn: { flex: 1, backgroundColor: c.surfaceMuted, padding: 14, borderRadius: 12, alignItems: "center" },
  saveBtn: { flex: 1, backgroundColor: "#16a34a", padding: 14, borderRadius: 12, alignItems: "center" },
  modalBtnText: { color: c.text, fontWeight: "700" } });
