import React, { useEffect, useMemo, useState, useCallback } from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Switch,
  Modal,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";

import {
  WebDateField,
  dateToYMD,
  ymdToDate } from "../src/components/WebDateField";
import { DatePickerField } from "../src/components/DatePickerField";
import { FilePickButton } from "../src/components/FilePickButton";
import { notify } from "../src/utils/confirm";
import { getUser, updateUser, listUsers } from "../src/services/users";
import { listDepartments } from "../src/services/departments";
import { requestPasswordReset } from "../src/services/api";
import {
  hrGetSalaryStructure,
  hrSetSalaryStructure } from "../src/services/payroll";
import {
  breakdownFromCTC,
  PF_MONTHLY_CAP } from "../src/utils/salaryFormula";
import {
  listUserDocuments,
  deleteUserDocument,
  listUserRequiredDocuments,
  verifyUserRequiredDocument,
  RequiredDocument } from "../src/services/documents";
import {
  hrListAssets,
  hrAssignAsset,
  hrReturnAsset } from "../src/services/assets";
import {
  Asset,
  Department,
  EmployeeDocument,
  EmployeeType,
  User,
  WageDuration,
  WageType } from "../src/types";
import { useTheme } from "../src/theme/ThemeProvider";

const isWeb = Platform.OS === "web";

type TabKey = "work" | "personal" | "payroll" | "documents" | "assets";

const TABS: { key: TabKey; label: string }[] = [
  { key: "work", label: "Work" },
  { key: "personal", label: "Personal" },
  { key: "payroll", label: "Payroll" },
  { key: "documents", label: "Documents" },
  { key: "assets", label: "Assets" },
];

const WAGE_TYPES: WageType[] = ["Fixed Wage", "Hourly Wage"];
const WAGE_DURATIONS: WageDuration[] = [
  "Year",
  "Half-Year",
  "Quarter",
  "2 Months",
  "Month",
  "Half-Month",
  "2 Weeks",
  "Week",
  "Day",
];
const EMPLOYEE_TYPES: EmployeeType[] = [
  "Full-time",
  "Part-time",
  "Internship",
  "Contract",
  "Consultant",
];
const CERT_LEVELS = [
  "Graduate",
  "Bachelor",
  "Master",
  "Doctor",
  "Other",
] as const;
const GENDER_OPTIONS = [
  "Male",
  "Female",
  "Other",
  "Prefer not to say",
] as const;
const MARITAL_OPTIONS = [
  "Single",
  "Married",
  "Divorced",
  "Widowed",
  "Separated",
] as const;
const BLOOD_GROUP_OPTIONS = [
  "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-",
] as const;
const WEEK_LOCS = ["Home", "Office", "Other"] as const;
const WEEKDAYS: {
  key:
    | "monday"
    | "tuesday"
    | "wednesday"
    | "thursday"
    | "friday"
    | "saturday"
    | "sunday";
  label: string;
}[] = [
  { key: "monday", label: "Mon" },
  { key: "tuesday", label: "Tue" },
  { key: "wednesday", label: "Wed" },
  { key: "thursday", label: "Thu" },
  { key: "friday", label: "Fri" },
  { key: "saturday", label: "Sat" },
  { key: "sunday", label: "Sun" },
];

// ==============================
export default function HrUserProfile() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);
  const amtStyles = useMemo(
    () =>
      StyleSheet.create({
        row: { flexDirection: "row", gap: 6, alignItems: "center" },
        toggle: {
          flexDirection: "row",
          backgroundColor: c.surfaceMuted,
          borderRadius: 10,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: c.surfaceBorder },
        toggleBtn: {
          paddingHorizontal: 10,
          paddingVertical: 9,
          minWidth: 34,
          alignItems: "center" },
        toggleActive: { backgroundColor: c.accent },
        toggleText: {
          color: c.textMuted,
          fontWeight: "800" as const,
          fontSize: 13 },
        toggleTextActive: { color: c.text },
        preview: {
          color: c.textMuted,
          fontSize: 11,
          marginTop: 4,
          fontStyle: "italic" as const } }),
    [c]
  );

  // ============================== Form helpers
  // Memoize component references so they stay stable across re-renders.
  // Without useMemo the function identity changes on every state update,
  // which unmounts the TextInput and dismisses the keyboard after a
  // single keystroke.
  const TextField = useMemo(
    () =>
      function TextFieldInner({
        value,
        onChange,
        placeholder,
        multiline,
        keyboardType,
        autoCapitalize }: {
        value: string;
        onChange: (v: string) => void;
        placeholder?: string;
        multiline?: boolean;
        keyboardType?:
          | "default"
          | "email-address"
          | "phone-pad"
          | "decimal-pad";
        autoCapitalize?: "none" | "sentences" | "characters";
      }) {
        return (
          <TextInput
            style={[
              styles.input,
              multiline && { minHeight: 60, textAlignVertical: "top" },
            ]}
            value={value}
            onChangeText={onChange}
            placeholder={placeholder}
            placeholderTextColor={c.textFaint}
            multiline={multiline}
            keyboardType={keyboardType || "default"}
            autoCapitalize={autoCapitalize || "sentences"}
          />
        );
      },
    [styles, c.textFaint]
  );

  const Field = useMemo(
    () =>
      function FieldInner({
        label,
        children }: {
        label: string;
        children: React.ReactNode;
      }) {
        const child =
          React.isValidElement(children) &&
          (children.props as any).placeholder === undefined &&
          (children.type as any) === TextField
            ? React.cloneElement(children as any, {
                placeholder: `Enter ${label.toLowerCase()}` })
            : children;
        return (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.label}>{label}</Text>
            {child}
          </View>
        );
      },
    [styles, TextField]
  );

  const ChipPicker = useMemo(
    () => (
      function ChipPickerInner<T extends string>({
        options,
        selected,
        onSelect }: {
        options: readonly T[];
        selected: T | undefined | null;
        onSelect: (v: T | undefined) => void;
      }) {
        return (
          <View style={styles.chipRow}>
            {options.map((opt) => (
              <TouchableOpacity
                key={opt}
                style={[
                  styles.chip,
                  selected === opt && styles.chipActive,
                ]}
                onPress={() =>
                  onSelect(selected === opt ? undefined : opt)
                }
              >
                <Text
                  style={[
                    styles.chipText,
                    selected === opt && styles.chipTextActive,
                  ]}
                >
                  {opt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        );
      }
    ),
    [styles]
  );

  const SectionHeader = useMemo(
    () =>
      function SectionHeaderInner({ title }: { title: string }) {
        return <Text style={styles.sectionHeader}>{title}</Text>;
      },
    [styles]
  );

  const AmountOrPctField = useMemo(
    () =>
      function AmountOrPctFieldInner({
        value,
        onChange,
        pctMode,
        onTogglePct,
        basis,
        placeholder }: {
        value: string;
        onChange: (v: string) => void;
        pctMode: boolean;
        onTogglePct: (next: boolean) => void;
        basis: number;
        placeholder?: string;
      }) {
        const parsed = parseFloat(value);
        const numeric = Number.isFinite(parsed) ? parsed : 0;
        const derivedAmount = pctMode
          ? Math.round((basis * numeric) / 100)
          : null;
        return (
          <View>
            <View style={amtStyles.row}>
              <View style={amtStyles.toggle}>
                <TouchableOpacity
                  style={[
                    amtStyles.toggleBtn,
                    !pctMode && amtStyles.toggleActive,
                  ]}
                  onPress={() => onTogglePct(false)}
                >
                  <Text
                    style={[
                      amtStyles.toggleText,
                      !pctMode && amtStyles.toggleTextActive,
                    ]}
                  >
                    ₹
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    amtStyles.toggleBtn,
                    pctMode && amtStyles.toggleActive,
                  ]}
                  onPress={() => onTogglePct(true)}
                >
                  <Text
                    style={[
                      amtStyles.toggleText,
                      pctMode && amtStyles.toggleTextActive,
                    ]}
                  >
                    %
                  </Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={value}
                onChangeText={onChange}
                placeholder={placeholder}
                placeholderTextColor={c.textFaint}
                keyboardType="decimal-pad"
              />
            </View>
            {pctMode && (
              <Text style={amtStyles.preview}>
                {basis > 0
                  ? `= ₹${derivedAmount?.toLocaleString()} (of ₹${basis.toLocaleString()})`
                  : "Set Basic first to compute amount"}
              </Text>
            )}
          </View>
        );
      },
    [styles, amtStyles, c.textFaint]
  );

  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<TabKey>("work");

  const [requiredDocs, setRequiredDocs] = useState<RequiredDocument[]>([]);
  const [submittedDocs, setSubmittedDocs] = useState<EmployeeDocument[]>([]);
  const [reqLoading, setReqLoading] = useState(false);

  // Assets tab — assignedAssets is what the user currently holds;
  // availableAssets is the AVAILABLE pool HR can hand out.
  const [assignedAssets, setAssignedAssets] = useState<Asset[]>([]);
  const [availableAssets, setAvailableAssets] = useState<Asset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetMutating, setAssetMutating] = useState(false);

  const [user, setUser] = useState<User | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [showMgrPicker, setShowMgrPicker] = useState(false);

  // Project managers — multi-pick from the same MANAGER+HR pool.
  const [projectManagerIds, setProjectManagerIds] = useState<string[]>([]);
  const [mgrSearch, setMgrSearch] = useState("");

  // ===== Editable form state =====
  // Profile picture
  const [profilePictureUrl, setProfilePictureUrl] = useState("");

  // Editable basics — these are entered at create time in users.tsx
  // and now also editable here so HR can correct anything later.
  const [editableName, setEditableName] = useState("");
  const [editableEmail, setEditableEmail] = useState("");
  const [editableTag, setEditableTag] = useState("");
  const [editableEmployeeCode, setEditableEmployeeCode] = useState("");
  const [editableWorkPhone, setEditableWorkPhone] = useState("");
  const [editableJoiningDate, setEditableJoiningDate] = useState("");
  const [showJoiningPicker, setShowJoiningPicker] = useState(false);
  const [editableStatus, setEditableStatus] = useState<
    "Active" | "Inactive" | "OnLeave" | "Terminated"
  >("Active");

  // Role (USER / MANAGER — HR can't be set via API, requires bootstrap)
  const [roleValue, setRoleValue] = useState<"USER" | "MANAGER" | "HR">(
    "USER"
  );

  // Org
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [reportingManagerId, setReportingManagerId] = useState<
    string | null
  >(null);

  // Work
  const [jobPosition, setJobPosition] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [workAddress, setWorkAddress] = useState("");
  const [workLocation, setWorkLocation] = useState("");
  const [workNotes, setWorkNotes] = useState("");
  const [usualWorkLocation, setUsualWorkLocation] = useState<
    Record<string, string | null>
  >({});

  // Personal
  const [personalEmail, setPersonalEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [legalName, setLegalName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [showBirthdayPicker, setShowBirthdayPicker] = useState(false);
  const [placeOfBirth, setPlaceOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [maritalStatus, setMaritalStatus] = useState("");
  const [disabled, setDisabled] = useState(false);

  // Address
  const [street1, setStreet1] = useState("");
  const [street2, setStreet2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [country, setCountry] = useState("");

  // Education
  const [certLevel, setCertLevel] = useState<
    typeof CERT_LEVELS[number] | undefined
  >(undefined);
  const [fieldOfStudy, setFieldOfStudy] = useState("");

  // Statutory
  const [pan, setPan] = useState("");
  const [uan, setUan] = useState("");
  const [pfAcct, setPfAcct] = useState("");
  const [esiNum, setEsiNum] = useState("");

  // Emergency contact
  const [ecName, setEcName] = useState("");
  const [ecRel, setEcRel] = useState("");
  const [ecPhone, setEcPhone] = useState("");

  // Bank (single primary account)
  const [bankName, setBankName] = useState("");
  const [bankAcct, setBankAcct] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");
  const [bankBranch, setBankBranch] = useState("");
  const [bankHolder, setBankHolder] = useState("");

  // Contract (payroll tab)
  const [contractStart, setContractStart] = useState("");
  const [contractEnd, setContractEnd] = useState("");
  const [wageType, setWageType] = useState<WageType | undefined>(
    undefined
  );
  const [wage, setWage] = useState("");
  const [wageDuration, setWageDuration] = useState<
    WageDuration | undefined
  >(undefined);
  const [employeeType, setEmployeeType] = useState<
    EmployeeType | undefined
  >(undefined);

  // Salary components (payroll tab). Stored as strings so the inputs
  // can be blank; coerced to numbers on save. Sourced from a separate
  // `/hr/users/{id}/salary-structure` endpoint, NOT from the user doc.
  const [salBasic, setSalBasic] = useState("");
  const [salHra, setSalHra] = useState("");
  const [salCommAllowance, setSalCommAllowance] = useState("");
  const [salOtherAllowance, setSalOtherAllowance] = useState("");
  const [salEmployerPF, setSalEmployerPF] = useState("");
  const [salEmployerInsurance, setSalEmployerInsurance] = useState("");
  const [salEmployeePF, setSalEmployeePF] = useState("");
  const [salEmployeeInsurance, setSalEmployeeInsurance] = useState("");
  const [salProfTax, setSalProfTax] = useState("");
  const [salTds, setSalTds] = useState("");
  const [savingSalary, setSavingSalary] = useState(false);

  // Monthly CTC drives the "Apply formula" quick-fill and is the
  // denominator when pctBasis === "CTC" (defaults to that — both
  // values are visible in the UI so HR can flip mid-edit).
  const [monthlyCTC, setMonthlyCTC] = useState("");
  const [pctBasis, setPctBasis] = useState<"CTC" | "Basic">("CTC");

  // Percentage-mode flags per component. When true, the input value is a
  // percentage of whichever basis (CTC or Basic) is currently selected;
  // on save, we resolve to an absolute INR amount.
  const [pctHra, setPctHra] = useState(false);
  const [pctComm, setPctComm] = useState(false);
  const [pctOther, setPctOther] = useState(false);
  const [pctEmployerPF, setPctEmployerPF] = useState(false);
  const [pctEmployerIns, setPctEmployerIns] = useState(false);
  const [pctEmployeePF, setPctEmployeePF] = useState(false);
  const [pctEmployeeIns, setPctEmployeeIns] = useState(false);

  // Numeric basis used by AmountOrPctField — switches with pctBasis.
  const pctBasisAmount =
    pctBasis === "CTC"
      ? parseFloat(monthlyCTC) || 0
      : parseFloat(salBasic) || 0;

  // Intern / Consultant employees get a simplified payroll: only the
  // wage amount is captured. Everything past contract is hidden.
  const isSimplifiedEmployee =
    employeeType === "Internship" || employeeType === "Consultant";

  const applyFormula = () => {
    const ctc = parseFloat(monthlyCTC) || 0;
    if (ctc <= 0) {
      Alert.alert(
        "Enter monthly CTC",
        "Type the employee's monthly CTC first, then tap Apply formula."
      );
      return;
    }
    const b = breakdownFromCTC(ctc);
    setSalBasic(String(b.basic));
    setSalHra(String(b.hra));
    setSalCommAllowance(String(b.communicationAllowance));
    setSalOtherAllowance(String(b.otherAllowance));
    setSalEmployerPF(String(b.employerPF));
    setSalEmployeePF(String(b.employerPF));
    // After Apply formula the values are absolute INR — turn off the
    // pct flags so HR doesn't see the resolved amounts interpreted as
    // percentages.
    setPctHra(false);
    setPctComm(false);
    setPctOther(false);
    setPctEmployerPF(false);
    setPctEmployeePF(false);
  };

  const load = useCallback(async () => {
    if (!id) {
      if (router.canGoBack()) router.back();
      else router.replace("/");
      return;
    }
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const [u, depts, users] = await Promise.all([
        getUser(token, id),
        listDepartments(token).catch(() => [] as Department[]),
        listUsers(token).catch(() => [] as User[]),
      ]);
      setUser(u);
      setDepartments(depts || []);
      setAllUsers(users || []);

      // Hydrate form from response (defensive defaults)
      setProfilePictureUrl(u.profilePictureUrl || "");
      setEditableName(u.name || "");
      setEditableEmail(u.email || "");
      setEditableTag(u.tag || "Employee");
      setEditableEmployeeCode(u.employeeCode || "");
      setEditableWorkPhone(u.workPhone || "");
      setEditableJoiningDate(u.joiningDate || "");
      setEditableStatus((u.status as any) || "Active");
      setRoleValue(
        u.role === "MANAGER"
          ? "MANAGER"
          : u.role === "HR"
          ? "HR"
          : "USER"
      );
      setDepartmentId(u.departmentId || u.work?.departmentId || null);
      setReportingManagerId(
        u.reportingManagerId || u.work?.reportingManagerId || null
      );
      setProjectManagerIds(
        u.projectManagerIds || u.work?.projectManagerIds || []
      );

      const w = u.work || {};
      setJobPosition(w.jobPosition || "");
      setJobTitle(w.jobTitle || "");
      setWorkAddress(w.workAddress || "");
      setWorkLocation(w.workLocation || "");
      setWorkNotes(w.notes || "");
      setUsualWorkLocation(w.usualWorkLocation || {});

      const p = u.personal || {};
      setPersonalEmail(p.personalEmail || "");
      setPhone(p.phone || "");
      // Legal name defaults to the account name when HR hasn't set one
      // explicitly — creation only captures "Name", so this keeps the
      // field populated (and persists it on the next save) instead of
      // showing blank on every profile.
      setLegalName(p.legalName || u.name || "");
      setBirthday(p.birthday || "");
      setPlaceOfBirth(p.placeOfBirth || "");
      setGender(p.gender || "");
      setBloodGroup(p.bloodGroup || "");
      setMaritalStatus(p.maritalStatus || "");
      setDisabled(!!p.disabled);

      const a = p.address || {};
      setStreet1(a.street1 || "");
      setStreet2(a.street2 || "");
      setCity(a.city || "");
      setState(a.state || "");
      setPinCode(a.pinCode || "");
      setCountry(a.country || "");

      const e = p.education || {};
      setCertLevel(
        e.certificationLevel as typeof CERT_LEVELS[number] | undefined
      );
      setFieldOfStudy(e.fieldOfStudy || "");

      const s = u.statutory || {};
      setPan(s.pan || "");
      setUan(s.uan || "");
      setPfAcct(s.pfAccountNumber || "");
      setEsiNum(s.esiNumber || "");

      const ec = u.emergencyContact || {};
      setEcName(ec.contactName || "");
      setEcRel(ec.relationship || "");
      setEcPhone(ec.phone || "");

      const bank = (u.bankAccounts && u.bankAccounts[0]) || {};
      setBankName(bank.bankName || "");
      setBankAcct(bank.accountNumber || "");
      setBankIfsc(bank.ifscCode || "");
      setBankBranch(bank.branch || "");
      setBankHolder(bank.accountHolderName || "");

      const c = u.contract || {};
      setContractStart(c.contractStartDate || "");
      setContractEnd(c.contractEndDate || "");
      setWageType(c.wageType);
      setWage(c.wage != null ? String(c.wage) : "");
      setWageDuration(c.wageDuration);
      setEmployeeType(c.employeeType);
    } catch (err: any) {
      Alert.alert("Failed to load profile", err?.message || "");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    load();
  }, [load]);

  // Fetch required-doc checklist when the Docs tab is opened. Cheap to
  // re-fetch every entry — the list is short and we want fresh status
  // chips after HR returns from the upload/verify flow.
  // Fetches the documents the employee has actually submitted plus the
  // HR-required checklist (so we know which uploaded categories can be
  // verified). Triggered when the Documents tab opens.
  const loadDocsTab = useCallback(async () => {
    if (!id) return;
    let cancelled = false;
    try {
      setReqLoading(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const [docs, reqs] = await Promise.all([
        listUserDocuments(token, id as string),
        listUserRequiredDocuments(token, id as string).catch(() => []),
      ]);
      if (cancelled) return;
      setSubmittedDocs(docs || []);
      setRequiredDocs(reqs || []);
    } catch {
      if (!cancelled) {
        setSubmittedDocs([]);
        setRequiredDocs([]);
      }
    } finally {
      if (!cancelled) setReqLoading(false);
    }
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (tab !== "documents") return;
    loadDocsTab();
  }, [tab, loadDocsTab]);

  const verifyDoc = async (category: string) => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const row = await verifyUserRequiredDocument(
        token,
        id as string,
        category
      );
      setRequiredDocs((prev) =>
        prev.map((r) => (r.category === category ? row : r))
      );
    } catch (err: any) {
      Alert.alert("Verify failed", err?.message || "");
    }
  };

  const deleteSubmittedDoc = (doc: EmployeeDocument) => {
    if (!id) return;
    Alert.alert("Delete document?", doc.fileName, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const token = await AsyncStorage.getItem("token");
            if (!token) return;
            await deleteUserDocument(token, id as string, doc.id);
            setSubmittedDocs((prev) => prev.filter((d) => d.id !== doc.id));
          } catch (err: any) {
            Alert.alert("Delete failed", err?.message || "");
          }
        } },
    ]);
  };

  // Load assigned + available assets when the Assets tab is opened.
  const loadAssets = useCallback(async () => {
    if (!id) return;
    try {
      setAssetsLoading(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const [assigned, available] = await Promise.all([
        hrListAssets(token, { assignedToUserId: id as string }).catch(
          () => [] as Asset[]
        ),
        hrListAssets(token, { status: "AVAILABLE" }).catch(
          () => [] as Asset[]
        ),
      ]);
      setAssignedAssets(assigned || []);
      setAvailableAssets(available || []);
    } finally {
      setAssetsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (tab !== "assets") return;
    loadAssets();
  }, [tab, loadAssets]);

  const onAssignAsset = async (assetId: string) => {
    if (assetMutating || !id) return;
    try {
      setAssetMutating(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await hrAssignAsset(token, assetId, { userId: id as string });
      await loadAssets();
    } catch (err: any) {
      Alert.alert("Assign failed", err?.message || "");
    } finally {
      setAssetMutating(false);
    }
  };

  const onReturnAsset = async (assetId: string) => {
    if (assetMutating) return;
    Alert.alert(
      "Return asset?",
      "This marks the asset as AVAILABLE for reassignment.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Return",
          onPress: async () => {
            try {
              setAssetMutating(true);
              const token = await AsyncStorage.getItem("token");
              if (!token) return;
              await hrReturnAsset(token, assetId, {
                status: "AVAILABLE" });
              await loadAssets();
            } catch (err: any) {
              Alert.alert("Return failed", err?.message || "");
            } finally {
              setAssetMutating(false);
            }
          } },
      ]
    );
  };

  // Load the active salary structure when the Payroll tab is opened.
  // Re-runs whenever the tab is re-entered so HR sees fresh values after
  // a different screen mutated the structure.
  useEffect(() => {
    if (tab !== "payroll" || !id) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        if (!token) return;
        const s = await hrGetSalaryStructure(token, id as string);
        if (cancelled || !s) return;
        setSalBasic(String(s.basic ?? ""));
        setSalHra(String(s.hra ?? ""));
        setSalCommAllowance(String(s.communicationAllowance ?? ""));
        setSalOtherAllowance(String(s.otherAllowance ?? ""));
        setSalEmployerPF(
          s.employerPF != null ? String(s.employerPF) : ""
        );
        setSalEmployerInsurance(String(s.employerInsurance ?? ""));
        setSalEmployeePF(
          s.employeePF != null ? String(s.employeePF) : ""
        );
        setSalEmployeeInsurance(String(s.employeeInsurance ?? ""));
        setSalProfTax(String(s.professionalTax ?? ""));
        setSalTds(String(s.tds ?? ""));
      } catch {
        // No structure yet — leave inputs empty. Saving fills it in.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, id]);

  const saveSalary = async () => {
    if (savingSalary || !id) return;
    const n = (v: string): number => {
      const p = parseFloat(v);
      return Number.isFinite(p) ? p : 0;
    };
    const basic = n(salBasic);
    if (basic <= 0) {
      Alert.alert(
        "Basic required",
        "Enter the Basic salary (in INR) before saving."
      );
      return;
    }
    // Resolve a field: if percentage mode is on, derive absolute amount
    // from the active basis (CTC or Basic); otherwise pass through the
    // raw amount. CTC falls back to Basic if monthlyCTC is blank so a
    // partially-filled form still saves sensible numbers.
    const ctc = n(monthlyCTC);
    const basisAmount =
      pctBasis === "CTC" && ctc > 0 ? ctc : basic;
    const resolve = (raw: string, isPct: boolean): number => {
      const num = n(raw);
      return isPct ? Math.round((basisAmount * num) / 100) : num;
    };
    try {
      setSavingSalary(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await hrSetSalaryStructure(token, id as string, {
        basic,
        hra: resolve(salHra, pctHra),
        communicationAllowance: resolve(salCommAllowance, pctComm),
        otherAllowance: resolve(salOtherAllowance, pctOther),
        // null tells the backend to auto-compute employer/employee PF
        // from basic with the EPF cap; an explicit number overrides.
        employerPF:
          salEmployerPF === ""
            ? null
            : resolve(salEmployerPF, pctEmployerPF),
        employerInsurance: resolve(salEmployerInsurance, pctEmployerIns),
        employeePF:
          salEmployeePF === ""
            ? null
            : resolve(salEmployeePF, pctEmployeePF),
        employeeInsurance: resolve(salEmployeeInsurance, pctEmployeeIns),
        professionalTax: n(salProfTax),
        tds: n(salTds) });
      Alert.alert("Salary saved", "Structure stored for next payroll run.");
    } catch (err: any) {
      Alert.alert("Save failed", err?.message || "");
    } finally {
      setSavingSalary(false);
    }
  };

  // Build the nested payload from form state. Omits empty strings as
  // undefined; the backend interprets empty string as "clear", which is
  // usually NOT what we want when leaving a field blank.
  const buildPayload = () => {
    const opt = (v: string) => (v.trim() ? v.trim() : undefined);

    const work = {
      departmentId: departmentId || undefined,
      jobPosition: opt(jobPosition),
      jobTitle: opt(jobTitle),
      reportingManagerId: reportingManagerId || undefined,
      projectManagerIds:
        projectManagerIds.length > 0 ? projectManagerIds : undefined,
      workAddress: opt(workAddress),
      workLocation: opt(workLocation),
      usualWorkLocation: Object.keys(usualWorkLocation).length
        ? usualWorkLocation
        : undefined,
      notes: opt(workNotes) };

    const personal = {
      personalEmail: opt(personalEmail),
      phone: opt(phone),
      legalName: opt(legalName),
      birthday: opt(birthday),
      placeOfBirth: opt(placeOfBirth),
      gender: opt(gender),
      disabled: disabled || undefined,
      bloodGroup: opt(bloodGroup),
      maritalStatus: opt(maritalStatus),
      address: {
        street1: opt(street1),
        street2: opt(street2),
        city: opt(city),
        state: opt(state),
        pinCode: opt(pinCode),
        country: opt(country) },
      education: {
        certificationLevel: certLevel,
        fieldOfStudy: opt(fieldOfStudy) } };

    const statutory = {
      pan: opt(pan),
      uan: opt(uan),
      pfAccountNumber: opt(pfAcct),
      esiNumber: opt(esiNum) };

    const emergencyContact = {
      contactName: opt(ecName),
      relationship: opt(ecRel),
      phone: opt(ecPhone) };

    const bankAccounts = [
      {
        bankName: opt(bankName),
        accountNumber: opt(bankAcct),
        ifscCode: opt(bankIfsc),
        branch: opt(bankBranch),
        accountHolderName: opt(bankHolder) },
    ].filter((b) => Object.values(b).some((v) => !!v));

    const contract = {
      contractStartDate: opt(contractStart),
      contractEndDate: opt(contractEnd),
      wageType,
      wage: wage ? parseFloat(wage) : undefined,
      wageDuration,
      employeeType };

    // Role is fully editable from this screen — HR can promote anyone
    // to HR/MANAGER/USER. Backend enforces that only HR/CEO callers can
    // set role=HR.
    const rolePayload: { role?: "USER" | "MANAGER" | "HR" } = {
      role: roleValue };

    return {
      ...rolePayload,
      // Editable basics
      name: opt(editableName),
      email: opt(editableEmail),
      tag: opt(editableTag),
      employeeCode: opt(editableEmployeeCode),
      workPhone: opt(editableWorkPhone),
      joiningDate: opt(editableJoiningDate),
      status: editableStatus,
      profilePictureUrl: opt(profilePictureUrl),
      departmentId: departmentId || undefined,
      reportingManagerId: reportingManagerId || undefined,
      projectManagerIds:
        projectManagerIds.length > 0 ? projectManagerIds : undefined,
      work,
      personal,
      statutory,
      emergencyContact,
      bankAccounts: bankAccounts.length ? bankAccounts : undefined,
      contract };
  };

  const onSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token || !id) return;
      await updateUser(token, id, buildPayload());
      notify("Saved", "Profile updated successfully");
    } catch (err: any) {
      notify("Save failed", err?.message || "");
    } finally {
      setSaving(false);
    }
  };

  const onSendResetLink = () => {
    if (!user?.email) return;
    Alert.alert(
      "Send password reset link?",
      `An email with a setup link will be sent to ${user.email}. They'll click it to set a new password.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send",
          onPress: async () => {
            try {
              await requestPasswordReset(user.email);
              Alert.alert(
                "Sent",
                "If the email is registered, a reset link has been sent."
              );
            } catch (err: any) {
              Alert.alert("Failed", err?.message || "");
            }
          } },
      ]
    );
  };

  const managerCandidates = allUsers.filter(
    (u) =>
      (u.role === "MANAGER" || u.role === "HR") &&
      u.status !== "Terminated"
  );

  const filteredMgrs = managerCandidates.filter((u) => {
    const q = mgrSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });

  const reportingManagerName =
    allUsers.find((u) => u.id === reportingManagerId)?.name || "";

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.loader}>
        <Text style={{ color: c.text }}>User not found</Text>
      </View>
    );
  }

  // Status pill palette mirrors the doc tab's tone system — keeps the
  // header glanceable without inventing new colors.
  const statusTone = (() => {
    switch (editableStatus) {
      case "Active":
        return { bg: "rgba(22,163,74,0.12)", fg: "#16a34a", label: "Active" };
      case "OnLeave":
        return { bg: "rgba(245,158,11,0.12)", fg: "#f59e0b", label: "On Leave" };
      case "Inactive":
        return { bg: "rgba(148,163,184,0.18)", fg: "#94a3b8", label: "Inactive" };
      case "Terminated":
        return { bg: "rgba(239,68,68,0.12)", fg: "#ef4444", label: "Terminated" };
    }
  })();

  const displayName = editableName || user.name;
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("") || "?";

  return (
    <SafeAreaView style={styles.safe}>
      {/* TOP BAR — back · title · save */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.topBarBtn}
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        >
          <Ionicons name="arrow-back" size={22} color={c.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Employee Profile</Text>
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={onSave}
          disabled={saving}
        >
          <Ionicons name="checkmark" size={15} color="#fff" />
          <Text style={styles.saveText}>{saving ? "Saving" : "Save"}</Text>
        </TouchableOpacity>
      </View>

      {/* HERO — large avatar (with photo-edit bubble), name, role, meta,
          status pill. Single banner card so the page opens with identity
          front-and-center instead of a cramped row. */}
      <View style={styles.hero}>
        <View style={styles.avatarLgWrap}>
          <View style={styles.avatarLg}>
            {profilePictureUrl ? (
              <Image
                source={{ uri: profilePictureUrl }}
                style={styles.avatarLgImg}
                resizeMode="cover"
              />
            ) : (
              <Text style={styles.avatarLgText}>{initials}</Text>
            )}
          </View>
          {/* Photo-edit bubble — uses FilePickButton's compact mode so
              tapping the camera opens the picker directly. */}
          <View style={styles.avatarCamera}>
            <FilePickButton
              compact
              mimeType="image/*"
              style={styles.avatarCameraBtn}
              onUploaded={(url) => setProfilePictureUrl(url)}
            />
          </View>
        </View>

        <View style={styles.heroBody}>
          <Text style={styles.heroName} numberOfLines={1}>
            {displayName}
          </Text>
          {!!editableTag && (
            <Text style={styles.heroRole} numberOfLines={1}>
              {editableTag}
            </Text>
          )}

          <View style={styles.metaRow}>
            {!!editableEmployeeCode && (
              <View style={styles.metaItem}>
                <Ionicons name="card-outline" size={12} color={c.textMuted} />
                <Text style={styles.metaText}>{editableEmployeeCode}</Text>
              </View>
            )}
            {!!user.email && (
              <View style={styles.metaItem}>
                <Ionicons name="mail-outline" size={12} color={c.textMuted} />
                <Text style={styles.metaText} numberOfLines={1}>
                  {user.email}
                </Text>
              </View>
            )}
          </View>

          <View style={[styles.statusPill, { backgroundColor: statusTone.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: statusTone.fg }]} />
            <Text style={[styles.statusPillText, { color: statusTone.fg }]}>
              {statusTone.label}
            </Text>
            <Text style={[styles.statusRoleText, { color: statusTone.fg }]}>
              · {roleValue}
            </Text>
          </View>
        </View>
      </View>

      {/* QUICK ACTIONS — homogenized neutral pills, icon-only color. The
          old rainbow of cyan/green/amber + the duplicated Documents link
          have been removed; Documents lives under its tab. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.actionsBar}
        contentContainerStyle={styles.actionsRow}
      >
        <TouchableOpacity
          style={styles.quickLink}
          onPress={() => router.push(`/hr-user-leave-balance?id=${id}` as any)}
        >
          <Ionicons name="airplane-outline" size={14} color={c.text} />
          <Text style={styles.quickLinkText}>Leave Balance</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickLink} onPress={onSendResetLink}>
          <Ionicons name="key-outline" size={14} color={c.text} />
          <Text style={styles.quickLinkText}>Send reset link</Text>
        </TouchableOpacity>
        {!!profilePictureUrl && (
          <TouchableOpacity
            style={styles.quickLink}
            onPress={() => setProfilePictureUrl("")}
          >
            <Ionicons name="trash-outline" size={14} color="#ef4444" />
            <Text style={[styles.quickLinkText, { color: "#ef4444" }]}>
              Remove photo
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* TABS — underline-indicator instead of pill-fill. Horizontally
          scrollable so labels don't get squeezed if we add more. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsBar}
        contentContainerStyle={styles.tabsRow}
      >
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={styles.tab}
              onPress={() => setTab(t.key)}
            >
              <Text
                style={[styles.tabText, active && styles.tabTextActive]}
              >
                {t.label}
              </Text>
              <View
                style={[styles.tabUnderline, active && styles.tabUnderlineActive]}
              />
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* ===== WORK TAB ===== */}
          {tab === "work" && (
            <>
              <SectionHeader title="BASIC INFO" />
              <Field label="Name">
                <TextField
                  value={editableName}
                  onChange={setEditableName}
                  placeholder="Full name"
                />
              </Field>
              <Field label="Login Email">
                <TextField
                  value={editableEmail}
                  onChange={setEditableEmail}
                  placeholder="name@company.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </Field>
              <Field label="Designation">
                <TextField
                  value={editableTag}
                  onChange={setEditableTag}
                  placeholder="e.g. Senior Engineer, Intern, Founder"
                />
              </Field>
              <Field label="Employee Code">
                <TextField
                  value={editableEmployeeCode}
                  onChange={setEditableEmployeeCode}
                  placeholder="EMP-0042"
                  autoCapitalize="characters"
                />
              </Field>
              <Field label="Work Phone">
                <TextField
                  value={editableWorkPhone}
                  onChange={setEditableWorkPhone}
                  placeholder="+91-..."
                  keyboardType="phone-pad"
                />
              </Field>
              <Field label="Joining Date">
                {isWeb ? (
                  <View style={styles.dateField}>
                    <Ionicons
                      name="calendar-outline"
                      size={18}
                      color={c.textMuted}
                    />
                    <WebDateField
                      mode="date"
                      value={editableJoiningDate}
                      onChange={(v) => v && setEditableJoiningDate(v)}
                    />
                  </View>
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.dateField}
                      onPress={() => setShowJoiningPicker(true)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="calendar-outline"
                        size={18}
                        color={c.textMuted}
                      />
                      <Text style={styles.dateFieldText}>
                        {editableJoiningDate
                          ? new Date(
                              `${editableJoiningDate}T00:00:00`
                            ).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric" })
                          : "Pick a date"}
                      </Text>
                    </TouchableOpacity>
                    {showJoiningPicker && (
                      <DateTimePicker
                        value={
                          ymdToDate(editableJoiningDate) || new Date()
                        }
                        mode="date"
                        onChange={(_, d) => {
                          setShowJoiningPicker(
                            Platform.OS === "ios"
                          );
                          if (d) setEditableJoiningDate(dateToYMD(d));
                        }}
                      />
                    )}
                  </>
                )}
              </Field>
              <Field label="Status">
                <View style={styles.chipRow}>
                  {(
                    ["Active", "Inactive", "OnLeave", "Terminated"] as const
                  ).map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[
                        styles.chip,
                        editableStatus === s && styles.chipActive,
                      ]}
                      onPress={() => setEditableStatus(s)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          editableStatus === s && styles.chipTextActive,
                        ]}
                      >
                        {s === "Terminated" ? "Not Active" : s}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Field>

              <SectionHeader title="ACCESS" />
              <Field label="Role">
                <>
                  <View style={styles.chipRow}>
                    {(["USER", "MANAGER", "HR"] as const).map((r) => (
                      <TouchableOpacity
                        key={r}
                        style={[
                          styles.chip,
                          roleValue === r && styles.chipActive,
                          roleValue === r &&
                            r === "MANAGER" && {
                              backgroundColor: "#7c3aed",
                              borderColor: "#7c3aed" },
                          roleValue === r &&
                            r === "HR" && {
                              backgroundColor: "#db2777",
                              borderColor: "#db2777" },
                        ]}
                        onPress={() => setRoleValue(r)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            roleValue === r && styles.chipTextActive,
                          ]}
                        >
                          {r}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={[styles.hint, { marginTop: 6 }]}>
                    MANAGER can approve leave / corrections /
                    reimbursements / timesheets for their direct
                    reports. HR has full org-wide access — promote
                    carefully.
                  </Text>
                </>
              </Field>

              <SectionHeader title="ORGANISATION" />
              <Field label="Department">
                <View style={styles.chipRow}>
                  {departments.length === 0 ? (
                    <Text style={styles.hint}>
                      No departments yet — create one in HR Admin
                    </Text>
                  ) : (
                    departments.map((d) => (
                      <TouchableOpacity
                        key={d.id}
                        style={[
                          styles.chip,
                          departmentId === d.id && styles.chipActive,
                        ]}
                        onPress={() =>
                          setDepartmentId(
                            departmentId === d.id ? null : d.id
                          )
                        }
                      >
                        <Text
                          style={[
                            styles.chipText,
                            departmentId === d.id && styles.chipTextActive,
                          ]}
                        >
                          {d.name}
                        </Text>
                      </TouchableOpacity>
                    ))
                  )}
                </View>
              </Field>

              <Field label="Reporting Manager">
                <TouchableOpacity
                  style={styles.input}
                  onPress={() => setShowMgrPicker(true)}
                >
                  <Text
                    style={{
                      color: reportingManagerId ? "#fff" : "#475569" }}
                  >
                    {reportingManagerName || "Tap to choose..."}
                  </Text>
                </TouchableOpacity>
                {!!reportingManagerId && (
                  <TouchableOpacity
                    onPress={() => setReportingManagerId(null)}
                    style={{ marginTop: 4 }}
                  >
                    <Text style={styles.linkClear}>Clear</Text>
                  </TouchableOpacity>
                )}
              </Field>

              <Field label="Project Manager(s)">
                {(() => {
                  // Eligible pool: anyone with MANAGER or HR role except
                  // the employee themselves. Inline chip multi-select —
                  // simpler than another modal because the team is small.
                  const pool = allUsers.filter(
                    (u) =>
                      (u.role === "MANAGER" || u.role === "HR") &&
                      u.id !== id &&
                      u.status !== "Terminated"
                  );
                  if (pool.length === 0) {
                    return (
                      <Text style={styles.hint}>
                        No managers available — promote someone to
                        MANAGER first.
                      </Text>
                    );
                  }
                  return (
                    <View style={styles.chipRow}>
                      {pool.map((u) => {
                        const picked = projectManagerIds.includes(u.id);
                        return (
                          <TouchableOpacity
                            key={u.id}
                            style={[
                              styles.chip,
                              picked && styles.chipActive,
                            ]}
                            onPress={() =>
                              setProjectManagerIds((prev) =>
                                picked
                                  ? prev.filter((x) => x !== u.id)
                                  : [...prev, u.id]
                              )
                            }
                          >
                            <Text
                              style={[
                                styles.chipText,
                                picked && styles.chipTextActive,
                              ]}
                            >
                              {u.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  );
                })()}
              </Field>

              <SectionHeader title="ROLE" />
              <Field label="Job Title">
                <TextField
                  value={jobTitle}
                  onChange={setJobTitle}
                  placeholder="Backend Lead"
                />
              </Field>

              <SectionHeader title="LOCATION" />
              <Field label="Work Address">
                <TextField
                  value={workAddress}
                  onChange={setWorkAddress}
                  placeholder="..."
                  multiline
                />
              </Field>
              <Field label="Work Location">
                <TextField
                  value={workLocation}
                  onChange={setWorkLocation}
                  placeholder="Bangalore Office"
                />
              </Field>

              <SectionHeader title="USUAL WORK LOCATION (Mon-Sun)" />
              {WEEKDAYS.map((d) => (
                <View key={d.key} style={styles.weekdayRow}>
                  <Text style={styles.weekdayLabel}>{d.label}</Text>
                  <View style={{ flex: 1 }}>
                    <View style={styles.chipRow}>
                      {WEEK_LOCS.map((loc) => {
                        const active =
                          usualWorkLocation[d.key] === loc;
                        return (
                          <TouchableOpacity
                            key={loc}
                            style={[
                              styles.smallChip,
                              active && styles.chipActive,
                            ]}
                            onPress={() =>
                              setUsualWorkLocation((prev) => ({
                                ...prev,
                                [d.key]: active ? null : loc }))
                            }
                          >
                            <Text
                              style={[
                                styles.smallChipText,
                                active && styles.chipTextActive,
                              ]}
                            >
                              {loc}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </View>
              ))}

              <SectionHeader title="NOTES" />
              <TextField
                value={workNotes}
                onChange={setWorkNotes}
                placeholder="Any work-related notes..."
                multiline
              />
            </>
          )}

          {/* ===== PERSONAL TAB ===== */}
          {tab === "personal" && (
            <>
              <SectionHeader title="PRIVATE CONTACT" />
              <Field label="Personal Email">
                <TextField
                  value={personalEmail}
                  onChange={setPersonalEmail}
                  placeholder="alex@gmail.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </Field>
              <Field label="Phone">
                <TextField
                  value={phone}
                  onChange={setPhone}
                  placeholder="+91..."
                  keyboardType="phone-pad"
                />
              </Field>

              <SectionHeader title="PERSONAL DETAILS" />
              <Field label="Legal Name">
                <TextField value={legalName} onChange={setLegalName} />
              </Field>
              <Field label="Birthday">
                {isWeb ? (
                  <View style={styles.dateField}>
                    <Ionicons
                      name="calendar-outline"
                      size={18}
                      color={c.textMuted}
                    />
                    <WebDateField
                      mode="date"
                      value={birthday}
                      max={dateToYMD(new Date())}
                      onChange={(v) => v && setBirthday(v)}
                    />
                  </View>
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.dateField}
                      onPress={() => setShowBirthdayPicker(true)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="calendar-outline"
                        size={18}
                        color={c.textMuted}
                      />
                      <Text style={styles.dateFieldText}>
                        {birthday
                          ? new Date(`${birthday}T00:00:00`).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric" }
                            )
                          : "Pick a date"}
                      </Text>
                    </TouchableOpacity>
                    {showBirthdayPicker && (
                      <DateTimePicker
                        value={
                          ymdToDate(birthday) || new Date(2000, 0, 1)
                        }
                        mode="date"
                        maximumDate={new Date()}
                        onChange={(_, d) => {
                          setShowBirthdayPicker(
                            Platform.OS === "ios"
                          );
                          if (d) setBirthday(dateToYMD(d));
                        }}
                      />
                    )}
                  </>
                )}
              </Field>
              <Field label="Place of Birth">
                <TextField
                  value={placeOfBirth}
                  onChange={setPlaceOfBirth}
                />
              </Field>
              <Field label="Gender">
                <ChipPicker
                  options={GENDER_OPTIONS}
                  selected={
                    (GENDER_OPTIONS as readonly string[]).includes(gender)
                      ? (gender as typeof GENDER_OPTIONS[number])
                      : undefined
                  }
                  onSelect={(v) => setGender(v || "")}
                />
              </Field>
              <Field label="Marital Status">
                <ChipPicker
                  options={MARITAL_OPTIONS}
                  selected={
                    (MARITAL_OPTIONS as readonly string[]).includes(
                      maritalStatus
                    )
                      ? (maritalStatus as typeof MARITAL_OPTIONS[number])
                      : undefined
                  }
                  onSelect={(v) => setMaritalStatus(v || "")}
                />
              </Field>
              <Field label="Blood Group">
                <ChipPicker
                  options={BLOOD_GROUP_OPTIONS}
                  selected={
                    (BLOOD_GROUP_OPTIONS as readonly string[]).includes(
                      bloodGroup
                    )
                      ? (bloodGroup as typeof BLOOD_GROUP_OPTIONS[number])
                      : undefined
                  }
                  onSelect={(v) => setBloodGroup(v || "")}
                />
              </Field>
              <View style={[styles.row, { marginTop: 14 }]}>
                <Text style={styles.label}>Disabled</Text>
                <Switch
                  value={disabled}
                  onValueChange={setDisabled}
                  trackColor={{ false: "#1f2937", true: "#3b82f6" }}
                />
              </View>

              <SectionHeader title="ADDRESS" />
              <Field label="Street 1">
                <TextField value={street1} onChange={setStreet1} />
              </Field>
              <Field label="Street 2">
                <TextField value={street2} onChange={setStreet2} />
              </Field>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Field label="City">
                    <TextField value={city} onChange={setCity} />
                  </Field>
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="State">
                    <TextField value={state} onChange={setState} />
                  </Field>
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Field label="Pin Code">
                    <TextField
                      value={pinCode}
                      onChange={setPinCode}
                      keyboardType="phone-pad"
                    />
                  </Field>
                </View>
                <View style={{ flex: 1 }}>
                  <Field label="Country">
                    <TextField value={country} onChange={setCountry} />
                  </Field>
                </View>
              </View>

              <SectionHeader title="EDUCATION" />
              <Field label="Certification Level">
                <ChipPicker
                  options={CERT_LEVELS}
                  selected={certLevel}
                  onSelect={setCertLevel}
                />
              </Field>
              <Field label="Field of Study">
                <TextField
                  value={fieldOfStudy}
                  onChange={setFieldOfStudy}
                  placeholder="Computer Science"
                />
              </Field>

              <SectionHeader title="STATUTORY" />
              <Field label="PAN">
                <TextField
                  value={pan}
                  onChange={setPan}
                  placeholder="ABCDE1234F"
                  autoCapitalize="characters"
                />
              </Field>
              <Field label="UAN">
                <TextField
                  value={uan}
                  onChange={setUan}
                  keyboardType="phone-pad"
                />
              </Field>
              <Field label="PF Account #">
                <TextField value={pfAcct} onChange={setPfAcct} />
              </Field>
              <Field label="ESI #">
                <TextField value={esiNum} onChange={setEsiNum} />
              </Field>

              <SectionHeader title="EMERGENCY CONTACT" />
              <Field label="Name">
                <TextField value={ecName} onChange={setEcName} />
              </Field>
              <Field label="Relationship">
                <TextField
                  value={ecRel}
                  onChange={setEcRel}
                  placeholder="Spouse / Parent / ..."
                />
              </Field>
              <Field label="Phone">
                <TextField
                  value={ecPhone}
                  onChange={setEcPhone}
                  keyboardType="phone-pad"
                />
              </Field>

              <SectionHeader title="BANK ACCOUNT" />
              <Field label="Bank Name">
                <TextField value={bankName} onChange={setBankName} />
              </Field>
              <Field label="Account Number">
                <TextField
                  value={bankAcct}
                  onChange={setBankAcct}
                  keyboardType="phone-pad"
                />
              </Field>
              <Field label="IFSC">
                <TextField
                  value={bankIfsc}
                  onChange={setBankIfsc}
                  autoCapitalize="characters"
                />
              </Field>
              <Field label="Branch">
                <TextField value={bankBranch} onChange={setBankBranch} />
              </Field>
              <Field label="Account Holder">
                <TextField value={bankHolder} onChange={setBankHolder} />
              </Field>
            </>
          )}

          {/* ===== PAYROLL TAB ===== */}
          {tab === "payroll" && (
            <>
              <SectionHeader title="CONTRACT" />
              <Field label="Start Date">
                <DatePickerField
                  value={contractStart}
                  onChange={setContractStart}
                />
              </Field>
              <Field label="End Date (optional)">
                <DatePickerField
                  value={contractEnd}
                  onChange={setContractEnd}
                  min={contractStart || undefined}
                />
              </Field>
              <Field label="Wage Type">
                <ChipPicker
                  options={WAGE_TYPES}
                  selected={wageType}
                  onSelect={setWageType}
                />
              </Field>
              <Field label="Wage Amount">
                <TextField
                  value={wage}
                  onChange={setWage}
                  placeholder="1500000"
                  keyboardType="decimal-pad"
                />
              </Field>
              <Field label="Wage Duration">
                <ChipPicker
                  options={WAGE_DURATIONS}
                  selected={wageDuration}
                  onSelect={setWageDuration}
                />
              </Field>
              <Field label="Employee Type">
                <ChipPicker
                  options={EMPLOYEE_TYPES}
                  selected={employeeType}
                  onSelect={setEmployeeType}
                />
              </Field>

              {isSimplifiedEmployee ? (
                <Text style={[styles.hint, { marginTop: 14 }]}>
                  {employeeType === "Internship"
                    ? "Interns receive a stipend — only the wage amount above is captured. Full salary structure (HRA / PF / TDS) is skipped."
                    : "Consultants are paid the wage amount above on the chosen duration. No salary structure required."}
                </Text>
              ) : (
                <>
                  {/* QUICK FILL FROM MONTHLY CTC */}
                  <SectionHeader title="QUICK FILL FROM CTC" />
                  <Field label="Monthly CTC (₹)">
                    <TextField
                      value={monthlyCTC}
                      onChange={setMonthlyCTC}
                      placeholder="e.g. 100000"
                      keyboardType="decimal-pad"
                    />
                  </Field>
                  <Text style={[styles.hint, { marginTop: 4 }]}>
                    Basic 50% · HRA 20% · Comm 5% · Other 19% · Employer
                    PF 6% (cap ₹{PF_MONTHLY_CAP})
                  </Text>
                  <TouchableOpacity
                    style={[styles.saveReqBtn, { marginTop: 10 }]}
                    onPress={applyFormula}
                  >
                    <Text style={styles.saveReqText}>Apply formula</Text>
                  </TouchableOpacity>

                  {/* PCT BASIS TOGGLE */}
                  <SectionHeader title="PERCENTAGE BASIS" />
                  <Text style={[styles.hint, { marginBottom: 8 }]}>
                    When a field is in % mode the value is read against
                    this basis.
                  </Text>
                  <View style={styles.chipRow}>
                    {(["CTC", "Basic"] as const).map((b) => (
                      <TouchableOpacity
                        key={b}
                        style={[
                          styles.chip,
                          pctBasis === b && styles.chipActive,
                        ]}
                        onPress={() => setPctBasis(b)}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            pctBasis === b && styles.chipTextActive,
                          ]}
                        >
                          % of {b}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <SectionHeader title="SALARY COMPONENTS (INR / MONTH)" />
                  <Field label="Basic">
                    <TextField
                      value={salBasic}
                      onChange={setSalBasic}
                      placeholder="50000"
                      keyboardType="decimal-pad"
                    />
                  </Field>
                  <Field label="House Rent Allowance">
                    <AmountOrPctField
                      value={salHra}
                      onChange={setSalHra}
                      pctMode={pctHra}
                      onTogglePct={setPctHra}
                      basis={pctBasisAmount}
                      placeholder={pctHra ? "20" : "20000"}
                    />
                  </Field>
                  <Field label="Communication Allowance">
                    <AmountOrPctField
                      value={salCommAllowance}
                      onChange={setSalCommAllowance}
                      pctMode={pctComm}
                      onTogglePct={setPctComm}
                      basis={pctBasisAmount}
                      placeholder={pctComm ? "5" : "0"}
                    />
                  </Field>
                  <Field label="Other Allowance">
                    <AmountOrPctField
                      value={salOtherAllowance}
                      onChange={setSalOtherAllowance}
                      pctMode={pctOther}
                      onTogglePct={setPctOther}
                      basis={pctBasisAmount}
                      placeholder={pctOther ? "19" : "0"}
                    />
                  </Field>

                  <SectionHeader title="BENEFITS (EMPLOYER)" />
                  <Field label="Employer PF (blank = auto-compute)">
                    <AmountOrPctField
                      value={salEmployerPF}
                      onChange={setSalEmployerPF}
                      pctMode={pctEmployerPF}
                      onTogglePct={setPctEmployerPF}
                      basis={pctBasisAmount}
                      placeholder={pctEmployerPF ? "6" : "auto"}
                    />
                  </Field>
                  <Field label="Health Insurance">
                    <AmountOrPctField
                      value={salEmployerInsurance}
                      onChange={setSalEmployerInsurance}
                      pctMode={pctEmployerIns}
                      onTogglePct={setPctEmployerIns}
                      basis={pctBasisAmount}
                      placeholder={pctEmployerIns ? "2" : "0"}
                    />
                  </Field>

                  <SectionHeader title="DEDUCTIONS (EMPLOYEE)" />
                  <Field label="Employee PF (blank = auto-compute)">
                    <AmountOrPctField
                      value={salEmployeePF}
                      onChange={setSalEmployeePF}
                      pctMode={pctEmployeePF}
                      onTogglePct={setPctEmployeePF}
                      basis={pctBasisAmount}
                      placeholder={pctEmployeePF ? "12" : "auto"}
                    />
                  </Field>
                  <Field label="Health Insurance">
                    <AmountOrPctField
                      value={salEmployeeInsurance}
                      onChange={setSalEmployeeInsurance}
                      pctMode={pctEmployeeIns}
                      onTogglePct={setPctEmployeeIns}
                      basis={pctBasisAmount}
                      placeholder={pctEmployeeIns ? "2" : "0"}
                    />
                  </Field>
                  <Field label="Professional Tax">
                    <TextField
                      value={salProfTax}
                      onChange={setSalProfTax}
                      placeholder="200"
                      keyboardType="decimal-pad"
                    />
                  </Field>
                  <Field label="TDS">
                    <TextField
                      value={salTds}
                      onChange={setSalTds}
                      placeholder="0"
                      keyboardType="decimal-pad"
                    />
                  </Field>

                  <TouchableOpacity
                    style={[
                      styles.saveReqBtn,
                      savingSalary && { opacity: 0.7 },
                    ]}
                    onPress={saveSalary}
                    disabled={savingSalary}
                  >
                    {savingSalary ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.saveReqText}>
                        Save salary structure
                      </Text>
                    )}
                  </TouchableOpacity>

                  <Text style={[styles.hint, { marginTop: 14 }]}>
                    Salary is stored separately from the employee profile so
                    history is preserved when you raise it. Leave PF fields
                    blank to auto-compute from Basic with the EPF cap.
                  </Text>
                </>
              )}
            </>
          )}

          {tab === "assets" && (
            <>
              <SectionHeader title="ASSIGNED TO THIS EMPLOYEE" />
              {assetsLoading ? (
                <ActivityIndicator color={c.accent} />
              ) : assignedAssets.length === 0 ? (
                <Text style={styles.hint}>
                  No assets assigned yet.
                </Text>
              ) : (
                assignedAssets.map((a) => (
                  <View key={a.id} style={styles.reqRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reqName}>
                        {a.code} · {a.name}
                      </Text>
                      <Text style={styles.reqNote}>
                        {a.category}
                        {a.serialNumber ? ` · SN ${a.serialNumber}` : ""}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.verifyBtn, { backgroundColor: "#ef4444" }]}
                      onPress={() => onReturnAsset(a.id)}
                      disabled={assetMutating}
                    >
                      <Text style={styles.verifyText}>Return</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}

              <SectionHeader title="ASSIGN A NEW ASSET" />
              {assetsLoading ? null : availableAssets.length === 0 ? (
                <Text style={styles.hint}>
                  No AVAILABLE assets in inventory. Create one in HR Assets.
                </Text>
              ) : (
                <View style={{ gap: 6 }}>
                  {availableAssets.map((a) => (
                    <TouchableOpacity
                      key={a.id}
                      style={[
                        styles.reqRow,
                        assetMutating && { opacity: 0.5 },
                      ]}
                      onPress={() => onAssignAsset(a.id)}
                      disabled={assetMutating}
                    >
                      <Ionicons
                        name="add-circle-outline"
                        size={18}
                        color="#16a34a"
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.reqName}>
                          {a.code} · {a.name}
                        </Text>
                        <Text style={styles.reqNote}>{a.category}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}

          {tab === "documents" && (
            <>
              <View style={styles.docTabHeader}>
                <View style={{ flex: 1 }}>
                  <SectionHeader title="Submitted documents" />
                  <Text style={styles.hint}>
                    Files this employee has uploaded.
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.docManageLink}
                  onPress={() =>
                    router.push(`/hr-user-documents?id=${id}` as any)
                  }
                >
                  <Ionicons name="cloud-upload-outline" size={13} color={c.text} />
                  <Text style={styles.docManageLinkText}>Upload more</Text>
                </TouchableOpacity>
              </View>

              {reqLoading ? (
                <ActivityIndicator color={c.accent} style={{ marginTop: 18 }} />
              ) : submittedDocs.length === 0 ? (
                <View style={styles.docEmpty}>
                  <Ionicons
                    name="folder-open-outline"
                    size={36}
                    color={c.textFaint}
                  />
                  <Text style={styles.docEmptyText}>
                    No documents submitted yet
                  </Text>
                  <Text style={styles.docEmptyHint}>
                    Tap &quot;Upload more&quot; to upload on the employee&apos;s
                    behalf or set required documents.
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 10, marginTop: 4 }}>
                  {submittedDocs.map((d) => {
                    const byHR = d.uploadedByRole === "HR";
                    const reqRow = requiredDocs.find(
                      (r) => r.category === d.category
                    );
                    const canVerify =
                      !!reqRow && !byHR && reqRow.status === "UPLOADED";
                    const verified = reqRow?.status === "VERIFIED";
                    return (
                      <View key={d.id} style={styles.docCard}>
                        <View style={styles.docCardTop}>
                          <View
                            style={[
                              styles.docCardIcon,
                              {
                                backgroundColor: byHR
                                  ? "rgba(239,68,68,0.12)"
                                  : "rgba(96,165,250,0.12)" },
                            ]}
                          >
                            <Ionicons
                              name="document-text-outline"
                              size={18}
                              color={byHR ? "#ef4444" : "#60a5fa"}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.docCardName} numberOfLines={1}>
                              {d.fileName}
                            </Text>
                            <View style={styles.docCardMetaRow}>
                              <Text style={styles.docCardCat}>{d.category}</Text>
                              <Text style={styles.docCardDot}>·</Text>
                              <Text style={styles.docCardMeta}>
                                {byHR ? "By HR" : "By employee"}
                              </Text>
                              {!!d.uploadedAt && (
                                <>
                                  <Text style={styles.docCardDot}>·</Text>
                                  <Text style={styles.docCardMeta}>
                                    {String(d.uploadedAt).slice(0, 10)}
                                  </Text>
                                </>
                              )}
                            </View>
                          </View>
                          {verified && (
                            <View style={styles.docCardVerifiedChip}>
                              <Ionicons
                                name="checkmark-circle"
                                size={12}
                                color="#16a34a"
                              />
                              <Text style={styles.docCardVerifiedText}>
                                Verified
                              </Text>
                            </View>
                          )}
                        </View>

                        {!!d.notes && (
                          <Text style={styles.docCardNote} numberOfLines={2}>
                            {d.notes}
                          </Text>
                        )}

                        <View style={styles.docCardActions}>
                          <TouchableOpacity
                            style={styles.docCardBtn}
                            onPress={() =>
                              d.fileUrl
                                ? Linking.openURL(d.fileUrl).catch(() => {})
                                : Alert.alert("No file URL on record")
                            }
                          >
                            <Ionicons name="eye-outline" size={14} color={c.text} />
                            <Text style={styles.docCardBtnText}>View</Text>
                          </TouchableOpacity>
                          {canVerify && (
                            <TouchableOpacity
                              style={[
                                styles.docCardBtn,
                                styles.docCardBtnVerify,
                              ]}
                              onPress={() => verifyDoc(d.category)}
                            >
                              <Ionicons
                                name="checkmark-circle-outline"
                                size={14}
                                color="#fff"
                              />
                              <Text style={styles.docCardBtnVerifyText}>
                                Verify
                              </Text>
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity
                            style={[styles.docCardBtn, styles.docCardBtnDanger]}
                            onPress={() => deleteSubmittedDoc(d)}
                          >
                            <Ionicons
                              name="trash-outline"
                              size={14}
                              color="#ef4444"
                            />
                            <Text style={styles.docCardBtnDangerText}>
                              Delete
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* MANAGER PICKER */}
      <Modal
        visible={showMgrPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowMgrPicker(false)}
      >
        <View style={styles.modalWrap}>
          <View style={styles.pickerModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Choose reporting manager
              </Text>
              <TouchableOpacity onPress={() => setShowMgrPicker(false)}>
                <Ionicons name="close" size={24} color={c.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={16} color={c.textMuted} />
              <TextInput
                style={styles.searchInput}
                value={mgrSearch}
                onChangeText={setMgrSearch}
                placeholder="Search by name or email"
                placeholderTextColor={c.textFaint}
                autoCapitalize="none"
              />
            </View>
            <FlatList
              data={filteredMgrs}
              keyExtractor={(u) => u.id}
              style={{ maxHeight: 380 }}
              ListEmptyComponent={
                <Text style={styles.hint}>
                  No managers found — promote a user to MANAGER first.
                </Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerRow}
                  onPress={() => {
                    setReportingManagerId(item.id);
                    setShowMgrPicker(false);
                  }}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {item.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickerName}>{item.name}</Text>
                    <Text style={styles.pickerSub}>
                      {item.email} · {item.role}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (c: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  loader: {
    flex: 1,
    backgroundColor: c.bg,
    justifyContent: "center",
    alignItems: "center" },
  // ===== TOP BAR (back · title · save) =====
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8 },
  topBarBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center" },
  topBarTitle: {
    flex: 1,
    color: c.text,
    fontSize: 15,
    fontWeight: "700",
    marginLeft: 2 },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#16a34a",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10 },
  saveText: { color: "#fff", fontWeight: "800", fontSize: 13 },

  // ===== HERO (banner card with avatar + identity) =====
  hero: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surface,
    borderRadius: 16,
    marginHorizontal: 12,
    marginBottom: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    gap: 14 },
  avatarLgWrap: { position: "relative" },
  avatarLg: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: c.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden" },
  avatarLgImg: { width: 68, height: 68 },
  avatarLgText: { color: c.accentText, fontSize: 24, fontWeight: "800" },
  // Tiny camera bubble sitting on the bottom-right of the avatar. The
  // FilePickButton renders inside it so a tap goes straight to the
  // file picker — no separate "Upload photo" pill needed.
  avatarCamera: {
    position: "absolute",
    right: -2,
    bottom: -2,
    borderRadius: 14,
    backgroundColor: c.surface,
    padding: 2 },
  avatarCameraBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: c.accent },
  heroBody: { flex: 1, gap: 4 },
  heroName: { color: c.text, fontSize: 18, fontWeight: "800" },
  heroRole: { color: c.textMuted, fontSize: 12, fontWeight: "600" },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 4 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { color: c.textMuted, fontSize: 11 },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 5,
    marginTop: 8 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
  statusRoleText: { fontSize: 10, fontWeight: "700", opacity: 0.85 },

  // ===== QUICK ACTIONS =====
  actionsBar: {
    flexGrow: 0,
    backgroundColor: c.bg },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 8,
    gap: 8 },
  quickLink: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    gap: 6 },
  quickLinkText: { color: c.text, fontSize: 12, fontWeight: "700" },

  // ===== TABS (underline indicator) =====
  tabsBar: {
    flexGrow: 0,
    borderBottomWidth: 1,
    borderBottomColor: c.surfaceBorder,
    backgroundColor: c.bg },
  tabsRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    gap: 4 },
  tab: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 0,
    alignItems: "center" },
  tabText: { color: c.textMuted, fontSize: 13, fontWeight: "700" },
  tabTextActive: { color: c.text },
  tabUnderline: {
    marginTop: 8,
    height: 2,
    width: "100%",
    borderRadius: 2,
    backgroundColor: "transparent" },
  tabUnderlineActive: { backgroundColor: c.accent },

  sectionHeader: {
    color: c.textMuted,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "800",
    marginTop: 24,
    marginBottom: 4 },
  label: {
    color: c.textMuted,
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: "700",
    marginBottom: 6 },
  input: {
    backgroundColor: c.surfaceMuted,
    color: c.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    minHeight: 42 },
  dateField: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surfaceMuted,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    minHeight: 42,
    gap: 10 },
  dateFieldText: {
    color: c.text,
    fontSize: 14,
    fontWeight: "600",
    flex: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  chipActive: { backgroundColor: c.accent, borderColor: c.accent },
  chipText: { color: c.textMuted, fontSize: 11, fontWeight: "700" },
  chipTextActive: { color: "#fff" },
  smallChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  smallChipText: { color: c.textMuted, fontSize: 10, fontWeight: "700" },
  weekdayRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 10 },
  weekdayLabel: {
    color: c.textMuted,
    fontSize: 12,
    fontWeight: "800",
    width: 36 },
  hint: { color: c.textMuted, fontSize: 12, fontStyle: "italic" },
  linkClear: { color: "#ef4444", fontSize: 11, fontWeight: "700" },

  modalWrap: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: c.overlay },
  pickerModal: {
    backgroundColor: c.surfaceMuted,
    padding: 16,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    borderTopColor: c.surfaceBorder,
    maxHeight: "85%" },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10 },
  modalTitle: { color: c.text, fontSize: 17, fontWeight: "800" },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surface,
    borderRadius: 10,
    paddingHorizontal: 10,
    gap: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  searchInput: {
    flex: 1,
    color: c.text,
    paddingVertical: 8,
    fontSize: 13 },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#111827" },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.accentSoft,
    alignItems: "center",
    justifyContent: "center" },
  avatarText: { color: c.accentText, fontWeight: "700" },
  pickerName: { color: c.text, fontSize: 14, fontWeight: "700" },
  pickerSub: { color: c.textMuted, fontSize: 11, marginTop: 2 },

  // Shared row + button styles reused by the Salary save button and
  // the Assets tab (assigned/available asset rows + Return action).
  saveReqBtn: {
    marginTop: 14,
    backgroundColor: "#16a34a",
    paddingVertical: 12,
    borderRadius: 11,
    alignItems: "center" },
  saveReqText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  reqRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surface,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    gap: 10 },
  reqName: { color: c.text, fontSize: 13, fontWeight: "700" },
  reqNote: { color: c.textMuted, fontSize: 11, marginTop: 2 },
  verifyBtn: {
    backgroundColor: c.accent,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8 },
  verifyText: { color: "#fff", fontSize: 11, fontWeight: "800" },

  // ===== DOCUMENTS TAB — list of submitted files =====
  docTabHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10 },
  docManageLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    marginTop: 24 },
  docManageLinkText: { color: c.text, fontSize: 12, fontWeight: "700" },

  docEmpty: {
    alignItems: "center",
    gap: 6,
    paddingVertical: 36,
    paddingHorizontal: 20 },
  docEmptyText: { color: c.textMuted, fontSize: 14, fontWeight: "700" },
  docEmptyHint: {
    color: c.textFaint,
    fontSize: 11,
    textAlign: "center",
    marginTop: 2 },

  docCard: {
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  docCardTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  docCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center" },
  docCardName: { color: c.text, fontSize: 14, fontWeight: "700" },
  docCardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 2,
    gap: 4 },
  docCardCat: { color: c.text, fontSize: 11, fontWeight: "700" },
  docCardMeta: { color: c.textMuted, fontSize: 11 },
  docCardDot: { color: c.textFaint, fontSize: 11 },
  docCardVerifiedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(22,163,74,0.12)" },
  docCardVerifiedText: { color: "#16a34a", fontSize: 10, fontWeight: "800" },
  docCardNote: {
    color: c.textMuted,
    fontSize: 12,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: c.surfaceMuted,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  docCardActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10 },
  docCardBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 9,
    borderRadius: 9,
    backgroundColor: c.surfaceMuted,
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  docCardBtnText: { color: c.text, fontSize: 12, fontWeight: "700" },
  docCardBtnVerify: {
    backgroundColor: "#16a34a",
    borderColor: "#16a34a" },
  docCardBtnVerifyText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  docCardBtnDanger: {
    backgroundColor: "rgba(239,68,68,0.08)",
    borderColor: "rgba(239,68,68,0.35)" },
  docCardBtnDangerText: { color: "#ef4444", fontSize: 12, fontWeight: "700" } });

