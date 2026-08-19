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
  ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { WebModal, ModalActions } from "../src/components/WebModal";

import { Avatar } from "../src/components/Avatar";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useRouter } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import { listUsers } from "../src/services/users";

import { useTheme } from "../src/theme/ThemeProvider";
import {
  hrGetSalaryStructure,
  hrGetSalaryHistory,
  hrSetSalaryStructure } from "../src/services/payroll";
import { breakdownFromCTC, PF_MONTHLY_CAP } from "../src/utils/salaryFormula";
import { notify, notifySuccess } from "../src/utils/confirm";

import {
  User,
  SalaryStructure,
  TDSRegime } from "../src/types";

const REGIMES: TDSRegime[] = ["NEW", "OLD"];

// Stable field component — defined at module scope so typing into the
// TextInput doesn't unmount it and dismiss the keyboard after one letter.
const Field = ({
  label,
  value,
  onChange,
  keyboard = "decimal-pad",
  styles,
  faintColor }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  keyboard?: "decimal-pad" | "default" | "number-pad";
  styles: any;
  faintColor: string;
}) => (
  <View style={{ flex: 1 }}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChange}
      keyboardType={keyboard}
      placeholderTextColor={faintColor}
    />
  </View>
);

export default function SalaryStructures() {

  const router = useRouter();

  const { theme } = useTheme();

  const c = theme.colors;

  const s = useMemo(() => makeStyles(c), [c]);

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalVisible, setModalVisible] = useState(false);
  const [target, setTarget] = useState<User | null>(null);
  const [current, setCurrent] = useState<SalaryStructure | null>(null);
  // Every version ever saved, newest first. Saving supersedes rather than
  // edits, so without this the older versions are invisible — which matters
  // when correcting a past month, since the run picks the structure whose
  // effective window covers that month, not the newest one.
  const [history, setHistory] = useState<SalaryStructure[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loadingStructure, setLoadingStructure] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [monthlyCTC, setMonthlyCTC] = useState("");
  // Company-provided accommodation removes HRA (no rent being paid) and
  // rolls its 20% into Other Allowance, keeping the total at 100% of CTC.
  const [accommodation, setAccommodation] = useState(false);
  const [basic, setBasic] = useState("");
  const [hra, setHra] = useState("");
  const [comm, setComm] = useState("");
  const [other, setOther] = useState("");
  const [employerInsurance, setEmployerInsurance] = useState("");
  const [pt, setPt] = useState("");
  const [tds, setTds] = useState("");
  const [employeeInsurance, setEmployeeInsurance] = useState("");
  const [autoPF, setAutoPF] = useState(true);
  const [employerPF, setEmployerPF] = useState("");
  const [employeePF, setEmployeePF] = useState("");
  const [pan, setPan] = useState("");
  const [uan, setUan] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");
  const [bankName, setBankName] = useState("");
  const [tdsRegime, setTdsRegime] = useState<TDSRegime>("NEW");


  // Routed through the shared toast host rather than an in-screen View:
  // a screen-level popup renders BEHIND any open modal, so errors raised
  // from inside a dialog were invisible. See components/ModalToastHost.
  const showPopup = (
    msg: string,
    kind: "success" | "error" = "success"
  ) => {
    if (kind === "error") notify(msg);
    else notifySuccess(msg);
  };

  const load = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const u = await listUsers(token);
      setUsers(u || []);
    } catch (err: any) {
      showPopup(err?.message || "Failed to load", "error");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openFor = async (u: User) => {
    setTarget(u);
    setModalVisible(true);
    setLoadingStructure(true);
    setCurrent(null);
    setHistory([]);
    setHistoryOpen(false);

    // Reset to defaults
    setMonthlyCTC("");
    setBasic("");
    setHra("");
    setComm("");
    setOther("");
    setEmployerInsurance("");
    setPt("");
    setTds("");
    setEmployeeInsurance("");
    setAutoPF(true);
    setEmployerPF("");
    setEmployeePF("");
    setPan("");
    setUan("");
    setBankAccount("");
    setBankIfsc("");
    setBankName("");
    setTdsRegime("NEW");

    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const [ss, hist] = await Promise.all([
        hrGetSalaryStructure(token, u.id),
        hrGetSalaryHistory(token, u.id).catch(() => [] as SalaryStructure[]),
      ]);
      setHistory(hist || []);
      if (ss) {
        setCurrent(ss);
        setAccommodation(!!(ss as any).accommodation);
        // CTC was pure local state — typed in for the quick-fill and lost on
        // every refresh, so HR reopened a saved structure with a blank CTC.
        // Derive it from the stored components instead of persisting another
        // field: that stays correct even if HR hand-edits a line, and works
        // for structures saved before totalCTC existed.
        const ctcFromParts =
          (Number(ss.basic) || 0) +
          (Number(ss.hra) || 0) +
          (Number(ss.communicationAllowance) || 0) +
          (Number(ss.otherAllowance) || 0) +
          (Number(ss.employerPF) || 0) +
          (Number(ss.employerInsurance) || 0);
        const storedCtc = Number((ss as any).totalCTC) || 0;
        const ctc = storedCtc || ctcFromParts;
        setMonthlyCTC(ctc > 0 ? String(Math.round(ctc)) : "");
        setBasic(String(ss.basic));
        setHra(String(ss.hra));
        setComm(String(ss.communicationAllowance));
        setOther(String(ss.otherAllowance));
        setEmployerInsurance(String(ss.employerInsurance));
        setPt(String(ss.professionalTax));
        setTds(String(ss.tds));
        setEmployeeInsurance(String(ss.employeeInsurance));
        const pfNull =
          ss.employerPF === null && ss.employeePF === null;
        setAutoPF(pfNull);
        if (!pfNull) {
          setEmployerPF(String(ss.employerPF || 0));
          setEmployeePF(String(ss.employeePF || 0));
        }
        setPan(ss.panNumber || "");
        setUan(ss.uanNumber || "");
        setBankAccount(ss.bankAccountNumber || "");
        setBankIfsc(ss.bankIfsc || "");
        setBankName(ss.bankName || "");
        setTdsRegime(ss.tdsRegime || "NEW");
      }
    } catch {
      // 404 = no structure yet, that's fine
    }
    setLoadingStructure(false);
  };

  const num = (v: string) => parseFloat(v) || 0;

  const save = async () => {
    if (!target || saving) return;
    if (num(basic) <= 0) {
      showPopup("Basic must be > 0", "error");
      return;
    }
    try {
      setSaving(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await hrSetSalaryStructure(token, target.id, {
        accommodation,
        basic: num(basic),
        hra: num(hra),
        communicationAllowance: num(comm),
        otherAllowance: num(other),
        employerInsurance: num(employerInsurance),
        professionalTax: num(pt),
        tds: num(tds),
        employeeInsurance: num(employeeInsurance),
        employerPF: autoPF ? null : num(employerPF),
        employeePF: autoPF ? null : num(employeePF),
        panNumber: pan.trim() || undefined,
        uanNumber: uan.trim() || undefined,
        bankAccountNumber: bankAccount.trim() || undefined,
        bankIfsc: bankIfsc.trim() || undefined,
        bankName: bankName.trim() || undefined,
        tdsRegime });
      showPopup("Saved");
      setModalVisible(false);
    } catch (err: any) {
      showPopup(err?.message || "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={s.loader}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={s.safe}>

      

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
            <Text style={s.title}>Salary Structures</Text>
            <Text style={s.subtitle}>Tap a user to set or edit</Text>
          </View>
        </View>

        {users.map((u) => (
          <TouchableOpacity
            key={u.id}
            style={s.card}
            onPress={() => openFor(u)}
            activeOpacity={0.85}
          >
            <Avatar
              name={u.name}
              uri={u.profilePictureUrl}
              size={36}
              fontSize={14}
              bg="#0d9488"
              fg="#fff"
            />
            <View style={{ flex: 1 }}>
              <Text style={s.cardName}>{u.name}</Text>
              <Text style={s.cardEmail}>{u.email}</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={c.textMuted}
            />
          </TouchableOpacity>
        ))}

      </ScrollView>

      {/* MODAL */}
      <WebModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={target?.name}
        size="md"
        footer={
          <ModalActions align="spread">
            <TouchableOpacity
              style={s.cancelBtn}
              onPress={() => setModalVisible(false)}
            >
              <Text style={s.modalBtnText}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.saveBtn, saving && { opacity: 0.7 }]}
              onPress={save}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[s.modalBtnText, { color: "#fff" }]}>Save</Text>
              )}
            </TouchableOpacity>
          </ModalActions>
        }
      >
              <Text style={s.hint}>
                {current
                  ? "Saving creates a new active version (history kept)."
                  : "No structure yet — set one to start."}
              </Text>

              {loadingStructure && (
                <ActivityIndicator color={c.accent} style={{ marginTop: 14 }} />
              )}

              {/* PREVIOUS VERSIONS — the effective window is what the payroll
                  run matches against, so it is shown per row rather than
                  buried. "Active" is the one with no end date. */}
              {history.length > 0 && (
                <>
                  <TouchableOpacity
                    style={s.histToggle}
                    onPress={() => setHistoryOpen((v) => !v)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={historyOpen ? "chevron-down" : "chevron-forward"}
                      size={16}
                      color={c.textMuted}
                    />
                    <Text style={s.histToggleText}>
                      Previous versions ({history.length})
                    </Text>
                  </TouchableOpacity>

                  {historyOpen && (
                    <View style={s.histList}>
                      {history.map((h) => {
                        const active = !h.effectiveTo;
                        const gross =
                          (Number(h.basic) || 0) +
                          (Number(h.hra) || 0) +
                          (Number(h.communicationAllowance) || 0) +
                          (Number(h.otherAllowance) || 0);
                        const ctc =
                          gross +
                          (Number(h.employerPF) || 0) +
                          (Number(h.employerInsurance) || 0);
                        return (
                          <View key={h.id} style={s.histRow}>
                            <View style={{ flex: 1 }}>
                              <Text style={s.histWhen}>
                                {h.effectiveFrom} →{" "}
                                {h.effectiveTo || "present"}
                              </Text>
                              <Text style={s.histAmt}>
                                CTC ₹{Math.round(ctc).toLocaleString("en-IN")}
                                {"  ·  "}Basic ₹
                                {Math.round(Number(h.basic) || 0).toLocaleString("en-IN")}
                              </Text>
                            </View>
                            {active && (
                              <View style={s.histPill}>
                                <Text style={s.histPillText}>ACTIVE</Text>
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </>
              )}

              {/* QUICK FILL FROM MONTHLY CTC */}
              <Text style={s.section}>QUICK FILL</Text>
              <Field
                label="Monthly CTC (₹)"
                value={monthlyCTC}
                onChange={setMonthlyCTC}
                styles={s}
                faintColor={c.textFaint}
              />
              <TouchableOpacity
                style={s.accomRow}
                onPress={() => setAccommodation((v) => !v)}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={accommodation ? "checkbox" : "square-outline"}
                  size={20}
                  color={accommodation ? c.accent : c.textMuted}
                />
                <View style={{ flex: 1 }}>
                  <Text style={s.accomLabel}>Company accommodation provided</Text>
                  <Text style={s.accomHint}>
                    Removes HRA — its share moves to Other Allowance.
                  </Text>
                </View>
              </TouchableOpacity>
              <Text style={s.note}>
                {accommodation
                  ? `Basic 50% · HRA 0% · Comm 5% · Other 39% · Employer PF 6% (cap ₹${PF_MONTHLY_CAP})`
                  : `Basic 50% · HRA 20% · Comm 5% · Other 19% · Employer PF 6% (cap ₹${PF_MONTHLY_CAP})`}
              </Text>
              <TouchableOpacity
                style={s.fillBtn}
                onPress={() => {
                  const ctc = parseFloat(monthlyCTC) || 0;
                  if (ctc <= 0) {
                    showPopup("Enter a valid monthly CTC", "error");
                    return;
                  }
                  const b = breakdownFromCTC(ctc, accommodation);
                  setBasic(String(b.basic));
                  setHra(String(b.hra));
                  setComm(String(b.communicationAllowance));
                  setOther(String(b.otherAllowance));
                  setEmployerPF(String(b.employerPF));
                  setEmployeePF(String(b.employerPF));
                  setAutoPF(false);
                }}
              >
                <Text style={s.fillBtnText}>Apply formula</Text>
              </TouchableOpacity>

              {/* EARNINGS */}
              <Text style={s.section}>EARNINGS</Text>
              <View style={s.twoCol}>
                <Field label="Basic" value={basic} onChange={setBasic} styles={s} faintColor={c.textFaint} />
                <Field label="HRA" value={hra} onChange={setHra} styles={s} faintColor={c.textFaint} />
              </View>
              <View style={s.twoCol}>
                <Field label="Comm. Allowance" value={comm} onChange={setComm} styles={s} faintColor={c.textFaint} />
                <Field label="Other Allowance" value={other} onChange={setOther} styles={s} faintColor={c.textFaint} />
              </View>
              <View style={s.twoCol}>
                <Field label="Health Insurance" value={employerInsurance} onChange={setEmployerInsurance} styles={s} faintColor={c.textFaint} />
                <View style={{ flex: 1 }} />
              </View>

              {/* DEDUCTIONS */}
              <Text style={s.section}>DEDUCTIONS</Text>
              <View style={s.twoCol}>
                <Field label="Professional Tax" value={pt} onChange={setPt} styles={s} faintColor={c.textFaint} />
                <Field label="TDS" value={tds} onChange={setTds} styles={s} faintColor={c.textFaint} />
              </View>
              <View style={s.twoCol}>
                <Field label="Health Insurance" value={employeeInsurance} onChange={setEmployeeInsurance} styles={s} faintColor={c.textFaint} />
                <View style={{ flex: 1 }} />
              </View>

              {/* PF */}
              <View style={s.toggleRow}>
                <Text style={s.label}>Auto-calculate PF</Text>
                <TouchableOpacity
                  style={[
                    s.toggleBtn,
                    autoPF && s.toggleOn,
                  ]}
                  onPress={() => setAutoPF(!autoPF)}
                >
                  <Text style={[s.toggleText, autoPF && { color: "#fff" }]}>
                    {autoPF ? "ON" : "OFF"}
                  </Text>
                </TouchableOpacity>
              </View>
              {autoPF ? (
                <Text style={s.note}>
                  PF auto = min(Basic, 15000) × 12%, max ₹{PF_MONTHLY_CAP}
                </Text>
              ) : (
                <View style={s.twoCol}>
                  <Field label="Employer PF" value={employerPF} onChange={setEmployerPF} styles={s} faintColor={c.textFaint} />
                  <Field label="Employee PF" value={employeePF} onChange={setEmployeePF} styles={s} faintColor={c.textFaint} />
                </View>
              )}

              {/* TAX REGIME */}
              <Text style={s.section}>TAX REGIME</Text>
              <View style={s.chipPicker}>
                {REGIMES.map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[
                      s.pickBtn,
                      tdsRegime === r && s.pickActive,
                    ]}
                    onPress={() => setTdsRegime(r)}
                  >
                    <Text
                      style={[
                        s.pickText,
                        tdsRegime === r && { color: "#fff" },
                      ]}
                    >
                      {r}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* IDs / BANK */}
              <Text style={s.section}>IDs & BANK</Text>
              <View style={s.twoCol}>
                <Field label="PAN" value={pan} onChange={setPan} keyboard="default" styles={s} faintColor={c.textFaint} />
                <Field label="UAN" value={uan} onChange={setUan} keyboard="default" styles={s} faintColor={c.textFaint} />
              </View>
              <Field
                label="Bank Account"
                value={bankAccount}
                onChange={setBankAccount}
                keyboard="default"
                styles={s}
                faintColor={c.textFaint}
              />
              <View style={s.twoCol}>
                <Field label="IFSC" value={bankIfsc} onChange={setBankIfsc} keyboard="default" styles={s} faintColor={c.textFaint} />
                <Field label="Bank Name" value={bankName} onChange={setBankName} keyboard="default" styles={s} faintColor={c.textFaint} />
              </View>

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

  header: { flexDirection: "row", alignItems: "center", marginBottom: 18, marginTop: 10, gap: 12 },
  backBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: c.surface, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: c.surfaceBorder },
  title: { color: c.text, fontSize: 24, fontWeight: "800" },
  subtitle: { color: c.textMuted, fontSize: 13, marginTop: 3 },

  card: { flexDirection: "row", alignItems: "center", backgroundColor: c.surface, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: c.surfaceBorder, gap: 10 },
  cardName: { color: c.text, fontSize: 14, fontWeight: "700" },
  cardEmail: { color: c.textMuted, fontSize: 11, marginTop: 2 },

  modalOverlay: { flex: 1, backgroundColor: c.overlay, justifyContent: "center", padding: 20 },
  modalCard: { backgroundColor: c.surface, borderRadius: 18, padding: 20, maxHeight: "94%" },
  modalTitle: { color: c.text, fontSize: 22, fontWeight: "800" },
  hint: { color: c.textMuted, fontSize: 11, marginTop: 4 },

  histToggle: {
    flexDirection: "row", alignItems: "center", gap: 6,
    marginTop: 14, paddingVertical: 6 },
  histToggleText: { color: c.textMuted, fontSize: 13, fontWeight: "700" },
  histList: { gap: 6, marginBottom: 4 },
  histRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: c.surface, borderWidth: 1, borderColor: c.surfaceBorder,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  histWhen: { color: c.text, fontSize: 13, fontWeight: "700" },
  histAmt: { color: c.textMuted, fontSize: 12, marginTop: 2 },
  histPill: {
    backgroundColor: c.accentSoft, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 999 },
  histPillText: { color: c.accentText, fontSize: 10, fontWeight: "800" },
  section: { color: c.textMuted, fontSize: 11, letterSpacing: 1.5, fontWeight: "700", marginTop: 16, marginBottom: 8 },

  label: { color: c.textMuted, fontSize: 12, fontWeight: "600", marginBottom: 4, marginTop: 8 },
  input: { backgroundColor: c.surfaceMuted, color: c.text, borderRadius: 10, padding: 11, borderWidth: 1, borderColor: c.surfaceBorder, fontSize: 13 },
  twoCol: { flexDirection: "row", gap: 8 },

  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
  toggleBtn: { paddingHorizontal: 14, paddingVertical: 6, backgroundColor: c.surfaceMuted, borderRadius: 999, borderWidth: 1, borderColor: c.surfaceBorder },
  toggleOn: { backgroundColor: c.accent, borderColor: c.accent },
  toggleText: { color: c.textMuted, fontWeight: "700", fontSize: 11 },
  accomRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    backgroundColor: c.surface },
  accomLabel: { color: c.text, fontSize: 14, fontWeight: "700" },
  accomHint: { color: c.textMuted, fontSize: 12, marginTop: 2 },
  note: { color: c.textMuted, fontSize: 11, fontStyle: "italic", marginTop: 4 },

  chipPicker: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  pickBtn: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: c.surfaceMuted, borderRadius: 10, borderWidth: 1, borderColor: c.surfaceBorder },
  pickActive: { backgroundColor: c.accent, borderColor: c.accent },
  pickText: { color: c.textMuted, fontSize: 12, fontWeight: "700" },

  modalActions: { flexDirection: "row", gap: 10, marginTop: 22 },
  cancelBtn: { flex: 1, backgroundColor: c.surfaceMuted, padding: 14, borderRadius: 12, alignItems: "center" },
  saveBtn: { flex: 1, backgroundColor: "#16a34a", padding: 14, borderRadius: 12, alignItems: "center" },
  modalBtnText: { color: c.text, fontWeight: "700" },
  fillBtn: { backgroundColor: c.accent, padding: 12, borderRadius: 12, alignItems: "center", marginTop: 10 },
  fillBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 } });

