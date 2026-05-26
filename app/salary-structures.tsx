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

import { listUsers } from "../src/services/users";

import { useTheme } from "../src/theme/ThemeProvider";
import {
  hrGetSalaryStructure,
  hrSetSalaryStructure } from "../src/services/payroll";
import { breakdownFromCTC, PF_MONTHLY_CAP } from "../src/utils/salaryFormula";

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
  const [loadingStructure, setLoadingStructure] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [monthlyCTC, setMonthlyCTC] = useState("");
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
      const ss = await hrGetSalaryStructure(token, u.id);
      if (ss) {
        setCurrent(ss);
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
            <View style={s.avatar}>
              <Text style={s.avatarText}>
                {u.name.charAt(0).toUpperCase()}
              </Text>
            </View>
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
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <ScrollView showsVerticalScrollIndicator={false}>

              <Text style={s.modalTitle}>
                {target?.name}
              </Text>
              <Text style={s.hint}>
                {current
                  ? "Saving creates a new active version (history kept)."
                  : "No structure yet — set one to start."}
              </Text>

              {loadingStructure && (
                <ActivityIndicator color={c.accent} style={{ marginTop: 14 }} />
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
              <Text style={s.note}>
                Basic 50% · HRA 20% · Comm 5% · Other 19% · Employer PF 6%
                (cap ₹{PF_MONTHLY_CAP})
              </Text>
              <TouchableOpacity
                style={s.fillBtn}
                onPress={() => {
                  const ctc = parseFloat(monthlyCTC) || 0;
                  if (ctc <= 0) {
                    showPopup("Enter a valid monthly CTC", "error");
                    return;
                  }
                  const b = breakdownFromCTC(ctc);
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
                <Field label="Employer Insurance" value={employerInsurance} onChange={setEmployerInsurance} styles={s} faintColor={c.textFaint} />
                <View style={{ flex: 1 }} />
              </View>

              {/* DEDUCTIONS */}
              <Text style={s.section}>DEDUCTIONS</Text>
              <View style={s.twoCol}>
                <Field label="Professional Tax" value={pt} onChange={setPt} styles={s} faintColor={c.textFaint} />
                <Field label="TDS" value={tds} onChange={setTds} styles={s} faintColor={c.textFaint} />
              </View>
              <View style={s.twoCol}>
                <Field label="Employee Insurance" value={employeeInsurance} onChange={setEmployeeInsurance} styles={s} faintColor={c.textFaint} />
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

              <View style={s.modalActions}>
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

  header: { flexDirection: "row", alignItems: "center", marginBottom: 18, marginTop: 10, gap: 12 },
  backBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: c.surface, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: c.surfaceBorder },
  title: { color: c.text, fontSize: 24, fontWeight: "800" },
  subtitle: { color: c.textMuted, fontSize: 13, marginTop: 3 },

  card: { flexDirection: "row", alignItems: "center", backgroundColor: c.surface, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: c.surfaceBorder, gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#0d9488", justifyContent: "center", alignItems: "center" },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  cardName: { color: c.text, fontSize: 14, fontWeight: "700" },
  cardEmail: { color: c.textMuted, fontSize: 11, marginTop: 2 },

  modalOverlay: { flex: 1, backgroundColor: c.overlay, justifyContent: "center", padding: 20 },
  modalCard: { backgroundColor: c.surface, borderRadius: 18, padding: 20, maxHeight: "94%" },
  modalTitle: { color: c.text, fontSize: 22, fontWeight: "800" },
  hint: { color: c.textMuted, fontSize: 11, marginTop: 4 },

  section: { color: c.textMuted, fontSize: 11, letterSpacing: 1.5, fontWeight: "700", marginTop: 16, marginBottom: 8 },

  label: { color: c.textMuted, fontSize: 12, fontWeight: "600", marginBottom: 4, marginTop: 8 },
  input: { backgroundColor: c.surfaceMuted, color: c.text, borderRadius: 10, padding: 11, borderWidth: 1, borderColor: c.surfaceBorder, fontSize: 13 },
  twoCol: { flexDirection: "row", gap: 8 },

  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 12 },
  toggleBtn: { paddingHorizontal: 14, paddingVertical: 6, backgroundColor: c.surfaceMuted, borderRadius: 999, borderWidth: 1, borderColor: c.surfaceBorder },
  toggleOn: { backgroundColor: c.accent, borderColor: c.accent },
  toggleText: { color: c.textMuted, fontWeight: "700", fontSize: 11 },
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

