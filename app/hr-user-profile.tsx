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
  FlatList,
  Image,
  Platform } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import { WebModal, ModalActions } from "../src/components/WebModal";
import { FullScreenImage } from "../src/components/FullScreenImage";
import { Avatar } from "../src/components/Avatar";
import { openMedia, mediaUrl } from "../src/utils/media";

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
import { confirmAction, notify } from "../src/utils/confirm";
import {
  getUser,
  updateUser,
  listUsers,
  adminSetUserPassword,
} from "../src/services/users";
import {
  listManagerTasks,
  listTeamLeaveBalances,
} from "../src/services/managerTeam";
import { listDepartments } from "../src/services/departments";
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
import { useResponsive } from "../src/utils/responsive";

const isWeb = Platform.OS === "web";

type TabKey = "work" | "personal" | "payroll" | "documents" | "assets";

const TABS: { key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "work", label: "Work", icon: "briefcase-outline" },
  { key: "personal", label: "Personal", icon: "person-outline" },
  { key: "payroll", label: "Payroll", icon: "cash-outline" },
  { key: "documents", label: "Documents", icon: "folder-outline" },
  { key: "assets", label: "Assets", icon: "cube-outline" },
];

// Maps a SectionHeader title to a leading icon so the form reads like the
// manager team-member screen (icon + uppercase label) instead of a bare
// text row. Keyed loosely so wording tweaks don't drop the icon.
const sectionIcon = (title: string): keyof typeof Ionicons.glyphMap => {
  const t = title.toUpperCase();
  if (t.includes("BASIC")) return "person-circle-outline";
  if (t.includes("ACCESS")) return "key-outline";
  if (t.includes("ORGAN")) return "business-outline";
  if (t === "ROLE" || t.includes("POSITION")) return "ribbon-outline";
  if (t.includes("USUAL WORK")) return "map-outline";
  if (t.includes("LOCATION")) return "location-outline";
  if (t.includes("NOTES")) return "document-text-outline";
  if (t.includes("CONTACT")) return "call-outline";
  if (t.includes("PERSONAL")) return "id-card-outline";
  if (t.includes("ADDRESS")) return "home-outline";
  if (t.includes("EDUCATION")) return "school-outline";
  if (t.includes("STATUTORY")) return "shield-checkmark-outline";
  if (t.includes("EMERGENCY")) return "medkit-outline";
  if (t.includes("BANK")) return "card-outline";
  if (t.includes("CONTRACT")) return "reader-outline";
  if (t.includes("CTC")) return "flash-outline";
  if (t.includes("PERCENTAGE")) return "calculator-outline";
  if (t.includes("SALARY")) return "cash-outline";
  if (t.includes("BENEFIT")) return "gift-outline";
  if (t.includes("DEDUCTION")) return "remove-circle-outline";
  if (t.includes("ASSIGNED")) return "cube-outline";
  if (t.includes("ASSIGN")) return "add-circle-outline";
  if (t.includes("SUBMITTED") || t.includes("DOCUMENT")) return "folder-open-outline";
  return "ellipse-outline";
};

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
  const responsive = useResponsive();
  const isDesktop = responsive.isDesktop;
  const styles = useMemo(() => makeStyles(c, isDesktop), [c, isDesktop]);
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
        children,
        full }: {
        label: string;
        children: React.ReactNode;
        // `full` fields span the whole row on desktop (used for multiline
        // inputs and chip pickers); the rest flow two-up.
        full?: boolean;
      }) {
        const child =
          React.isValidElement(children) &&
          (children.props as any).placeholder === undefined &&
          (children.type as any) === TextField
            ? React.cloneElement(children as any, {
                placeholder: `Enter ${label.toLowerCase()}` })
            : children;
        return (
          <View style={[styles.field, full && styles.fieldFull]}>
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
        return (
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderIcon}>
              <Ionicons name={sectionIcon(title)} size={14} color={c.accent} />
            </View>
            <Text style={styles.sectionHeader}>{title}</Text>
          </View>
        );
      },
    [styles, c.accent]
  );

  // A titled content card: header (title + optional one-line description)
  // over a responsive two-up field grid. Memoized so the TextInputs inside
  // don't remount (and drop the keyboard) on every keystroke.
  const Card = useMemo(
    () =>
      function CardInner({
        title,
        desc,
        children }: {
        title: string;
        desc?: string;
        children: React.ReactNode;
      }) {
        return (
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>{title}</Text>
              {!!desc && <Text style={styles.cardDesc}>{desc}</Text>}
            </View>
            <View style={styles.formGrid}>{children}</View>
          </View>
        );
      },
    [styles]
  );

  // Segmented control — a refined replacement for chunky chip rows on the
  // small, fixed choice sets (role, status).
  const Segmented = useMemo(
    () =>
      function SegmentedInner<T extends string>({
        options,
        value,
        onChange,
        accentActive }: {
        options: { value: T; label: string }[];
        value: T;
        onChange: (v: T) => void;
        accentActive?: boolean;
      }) {
        return (
          <View style={styles.seg}>
            {options.map((o) => {
              const active = value === o.value;
              return (
                <TouchableOpacity
                  key={o.value}
                  onPress={() => onChange(o.value)}
                  style={[
                    styles.segBtn,
                    active &&
                      (accentActive ? styles.segBtnAccent : styles.segBtnOn),
                  ]}
                >
                  <Text
                    style={[
                      styles.segBtnText,
                      active &&
                        (accentActive
                          ? styles.segBtnTextAccent
                          : styles.segBtnTextOn),
                    ]}
                  >
                    {o.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        );
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

  // "At a glance" counts for the right rail — fetched once on mount,
  // best-effort (each falls back to null so the rail still renders).
  const [summary, setSummary] = useState<{
    leave: number | null;
    openTasks: number | null;
    docs: number | null;
    assets: number | null;
  }>({ leave: null, openTasks: null, docs: null, assets: null });

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

  // Admin "set password" modal — direct password reset (no email).
  const [showPwModal, setShowPwModal] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  // Project managers — multi-pick from the same MANAGER+HR pool.
  const [projectManagerIds, setProjectManagerIds] = useState<string[]>([]);
  const [mgrSearch, setMgrSearch] = useState("");

  // ===== Editable form state =====
  // Profile picture
  const [profilePictureUrl, setProfilePictureUrl] = useState("");
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [photoZoom, setPhotoZoom] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);

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
      notify(
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
      notify("Failed to load profile", err?.message || "");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    load();
  }, [load]);

  // Lightweight rail summary — leave balance, open tasks, documents, assets.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        if (!token) return;
        const [bal, tasks, docs, assets] = await Promise.all([
          listTeamLeaveBalances(token, id as string).catch(() => []),
          listManagerTasks(token, { assigneeId: id as string }).catch(() => []),
          listUserDocuments(token, id as string).catch(() => []),
          hrListAssets(token, { assignedToUserId: id as string }).catch(
            () => []
          ),
        ]);
        if (cancelled) return;
        const balances =
          bal?.find((r: any) => r.user?.id === id)?.balances || [];
        const leaveTotal = balances.reduce(
          (s: number, b: any) => s + (b.remaining || 0),
          0
        );
        const open = (tasks || []).filter(
          (t: any) => t.status === "PENDING" || t.status === "ONGOING"
        ).length;
        setSummary({
          leave: Math.round(leaveTotal * 10) / 10,
          openTasks: open,
          docs: (docs || []).length,
          assets: (assets || []).length,
        });
      } catch {
        /* rail summary is best-effort */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

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
      notify("Verify failed", err?.message || "");
    }
  };

  const deleteSubmittedDoc = async (doc: EmployeeDocument) => {
    if (!id) return;
    if (
      await confirmAction({
        title: "Delete document?",
        message: doc.fileName,
        confirmLabel: "Delete",
        cancelLabel: "Cancel",
        destructive: true,
      })
    ) {
      try {
        const token = await AsyncStorage.getItem("token");
        if (!token) return;
        await deleteUserDocument(token, id as string, doc.id);
        setSubmittedDocs((prev) => prev.filter((d) => d.id !== doc.id));
      } catch (err: any) {
        notify("Delete failed", err?.message || "");
      }
    }
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
      notify("Assign failed", err?.message || "");
    } finally {
      setAssetMutating(false);
    }
  };

  const onReturnAsset = async (assetId: string) => {
    if (assetMutating) return;
    const doReturn = async () => {
      try {
        setAssetMutating(true);
        const token = await AsyncStorage.getItem("token");
        if (!token) return;
        await hrReturnAsset(token, assetId, { status: "AVAILABLE" });
        await loadAssets();
      } catch (err: any) {
        const msg = err?.message || "Please try again.";
        if (Platform.OS === "web") window.alert(`Return failed\n\n${msg}`);
        else Alert.alert("Return failed", msg);
      } finally {
        setAssetMutating(false);
      }
    };
    // RN's Alert.alert button callbacks don't fire on web (it degrades to a
    // no-button window.alert), so use window.confirm there and Alert natively.
    if (Platform.OS === "web") {
      const ok =
        typeof window !== "undefined" &&
        window.confirm(
          "Return asset?\n\nThis marks the asset as AVAILABLE for reassignment."
        );
      if (ok) await doReturn();
      return;
    }
    Alert.alert(
      "Return asset?",
      "This marks the asset as AVAILABLE for reassignment.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Return", onPress: doReturn },
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
      notify(
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
      notify("Salary saved", "Structure stored for next payroll run.");
    } catch (err: any) {
      notify("Save failed", err?.message || "");
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
      // Send "" (not undefined) when cleared so the backend actually removes
      // it — opt() would drop the field and leave the old photo in place.
      profilePictureUrl: profilePictureUrl.trim() || "",
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

  // Photo actions persist on their own (like a social-media avatar) rather
  // than waiting for the whole-profile Save — a partial update touching only
  // profilePictureUrl. Passing "" clears it (the backend maps ""→null).
  const savePhoto = async (url: string) => {
    if (savingPhoto) return;
    setSavingPhoto(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token || !id) return;
      await updateUser(token, id, { profilePictureUrl: url || "" });
      setProfilePictureUrl(url);
      notify(url ? "Photo updated" : "Photo removed");
    } catch (err: any) {
      notify("Couldn't update photo", err?.message || "");
    } finally {
      setSavingPhoto(false);
    }
  };

  const openSetPassword = () => {
    setNewPw("");
    setConfirmPw("");
    setShowPw(false);
    setShowPwModal(true);
  };

  // Single source of truth for "can submit" — the button, its disabled tint
  // and the checklist all read this, so they can't disagree.
  const pwValid =
    !savingPw && newPw.length >= 6 && newPw === confirmPw;

  const submitSetPassword = async () => {
    if (savingPw) return;
    if (newPw.length < 6) {
      notify("Password too short", "Must be at least 6 characters.");
      return;
    }
    if (newPw !== confirmPw) {
      notify("Passwords don't match", "Re-enter the same password twice.");
      return;
    }
    setSavingPw(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token || !id) return;
      await adminSetUserPassword(token, id, newPw);
      setShowPwModal(false);
      notify(
        "Password updated",
        `${user?.name || "The user"} can now log in with the new password.`
      );
    } catch (err: any) {
      notify("Couldn't set password", err?.message || "");
    } finally {
      setSavingPw(false);
    }
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

  // Quick actions rendered once as data, so the desktop rail and the mobile
  // row stay in sync (single source of truth, no duplicated handlers).
  const quickActions: {
    key: string;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
    primary?: boolean;
    danger?: boolean;
  }[] = [
    {
      key: "perf",
      label: "Work Performance",
      icon: "stats-chart-outline",
      primary: true,
      onPress: () =>
        router.push({
          pathname: "/team-member/[id]",
          params: {
            id: id as string,
            name: displayName,
            email: user.email || "",
            employeeCode: editableEmployeeCode || "",
            tag: editableTag || "",
            backTo: `/hr-user-profile?id=${id}`,
          },
        } as any),
    },
    {
      key: "workreport",
      label: "Work Report",
      icon: "download-outline",
      onPress: () =>
        router.push(
          `/client-visits?userId=${id}&name=${encodeURIComponent(
            displayName
          )}` as any
        ),
    },
    {
      key: "leave",
      label: "Leave Balance",
      icon: "airplane-outline",
      onPress: () => router.push(`/hr-user-leave-balance?id=${id}` as any),
    },
    {
      key: "idcard",
      label: "ID Card",
      icon: "card-outline",
      onPress: () => router.push(`/id-card?userId=${id}` as any),
    },
    {
      key: "pw",
      label: "Set password",
      icon: "key-outline",
      onPress: openSetPassword,
    },
  ];

  // ----- Derived header values -----
  const deptName =
    departments.find((d) => d.id === departmentId)?.name || "";
  const roleBadge =
    roleValue === "USER" ? "Employee" : roleValue === "HR" ? "HR" : "Manager";
  const roleLine = [editableTag, deptName].filter(Boolean).join("  ·  ");
  const joinedLabel = editableJoiningDate
    ? new Date(`${editableJoiningDate}T00:00:00`).toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric" })
    : "—";
  const facts = [
    { k: "Employee ID", v: editableEmployeeCode || "—" },
    { k: "Reporting Manager", v: reportingManagerName || "—" },
    { k: "Date Joined", v: joinedLabel },
    { k: "Work Location", v: workLocation || "—" },
    { k: "Work Phone", v: editableWorkPhone || "—" },
  ];

  // Profile header — avatar, identity, badges, at-a-glance facts strip.
  const ProfileHeader = () => (
    <View style={styles.headCard}>
      <View style={styles.headTop}>
        <TouchableOpacity
          style={styles.headAvatarWrap}
          activeOpacity={0.85}
          onPress={() => setPhotoModalOpen(true)}
        >
          <View style={styles.headAvatar}>
            {profilePictureUrl ? (
              <Image
                source={{ uri: mediaUrl(profilePictureUrl) }}
                style={styles.headAvatarImg}
                resizeMode="cover"
              />
            ) : (
              <Text style={styles.headAvatarText}>{initials}</Text>
            )}
          </View>
          {/* Affordance only — the whole avatar opens the photo actions. */}
          <View style={styles.headCam} pointerEvents="none">
            <Ionicons name="camera" size={14} color={c.textMuted} />
          </View>
        </TouchableOpacity>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.headName} numberOfLines={1}>
            {displayName}
          </Text>
          {!!roleLine && (
            <Text style={styles.headRoleLine} numberOfLines={1}>
              {roleLine}
            </Text>
          )}
          <View style={styles.headBadges}>
            <View style={[styles.hbadge, { backgroundColor: statusTone.bg }]}>
              <View style={[styles.hdot, { backgroundColor: statusTone.fg }]} />
              <Text style={[styles.hbadgeText, { color: statusTone.fg }]}>
                {statusTone.label}
              </Text>
            </View>
            <View style={[styles.hbadge, { backgroundColor: c.accentSoft }]}>
              <Text style={[styles.hbadgeText, { color: c.accentText }]}>
                {roleBadge}
              </Text>
            </View>
            {!!employeeType && (
              <View
                style={[
                  styles.hbadge,
                  {
                    backgroundColor: c.surfaceMuted,
                    borderColor: c.surfaceBorder,
                    borderWidth: 1 },
                ]}
              >
                <Text style={[styles.hbadgeText, { color: c.textMuted }]}>
                  {employeeType}
                </Text>
              </View>
            )}
          </View>
        </View>

        {isDesktop && (
          <TouchableOpacity
            style={styles.headWorkBtn}
            onPress={quickActions[0].onPress}
          >
            <Ionicons name="stats-chart-outline" size={15} color={c.text} />
            <Text style={styles.headWorkBtnText}>Work Performance</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.facts}>
        {facts.map((f) => (
          <View key={f.k} style={styles.fact}>
            <Text style={styles.factK}>{f.k}</Text>
            <Text style={styles.factV} numberOfLines={1}>
              {f.v}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );

  // Tab bar — understated underline on desktop, wrapping segments on mobile.
  const TabBar = () =>
    isDesktop ? (
      <View style={styles.tabsRow2}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab2, active && styles.tab2Active]}
              onPress={() => setTab(t.key)}
            >
              <Ionicons
                name={t.icon}
                size={15}
                color={active ? c.accent : c.textMuted}
              />
              <Text style={[styles.tab2Text, active && styles.tab2TextActive]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    ) : (
      <View style={styles.segTabs}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[styles.segTab, active && styles.segTabActive]}
            >
              <Ionicons
                name={t.icon}
                size={15}
                color={active ? c.accent : c.textMuted}
              />
              <Text style={[styles.segTabText, active && { color: c.accent }]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );

  // Right rail — quick actions + live "at a glance" counts.
  const RightRail = () => (
    <View style={styles.rail}>
      <View style={styles.railCard}>
        <Text style={styles.railLabel}>QUICK ACTIONS</Text>
        <View style={styles.qaList}>
          {quickActions.map((a) => (
            <TouchableOpacity
              key={a.key}
              onPress={a.onPress}
              style={[styles.qaItem, a.primary && styles.quickLinkPrimary]}
            >
              <Ionicons
                name={a.icon}
                size={15}
                color={a.primary ? "#fff" : a.danger ? "#ef4444" : c.text}
              />
              <Text
                style={[
                  styles.qaItemText,
                  a.primary && { color: "#fff" },
                  a.danger && { color: "#ef4444" },
                ]}
              >
                {a.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.railCard}>
        <Text style={styles.railLabel}>AT A GLANCE</Text>
        {[
          {
            k: "Leave balance",
            v: summary.leave == null ? "—" : `${summary.leave} days`,
          },
          {
            k: "Open tasks",
            v: summary.openTasks == null ? "—" : String(summary.openTasks),
          },
          { k: "Documents", v: summary.docs == null ? "—" : String(summary.docs) },
          {
            k: "Assets assigned",
            v: summary.assets == null ? "—" : String(summary.assets),
          },
        ].map((m) => (
          <View key={m.k} style={styles.mini}>
            <Text style={styles.miniK}>{m.k}</Text>
            <Text style={styles.miniV}>{m.v}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      {/* TOP BAR — back · breadcrumb · set password · save */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.topBarBtn}
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
        >
          <Ionicons name="arrow-back" size={22} color={c.text} />
        </TouchableOpacity>
        <Text style={styles.crumbs} numberOfLines={1}>
          HR Admin · Employees ·{" "}
          <Text style={styles.crumbsStrong}>{displayName}</Text>
        </Text>
        {isDesktop && (
          <TouchableOpacity
            style={styles.ghostBtn}
            onPress={() => router.push(`/id-card?userId=${id}` as any)}
          >
            <Ionicons name="card-outline" size={14} color={c.text} />
            <Text style={styles.ghostBtnText}>ID card</Text>
          </TouchableOpacity>
        )}
        {isDesktop && (
          <TouchableOpacity style={styles.ghostBtn} onPress={openSetPassword}>
            <Ionicons name="key-outline" size={14} color={c.text} />
            <Text style={styles.ghostBtnText}>Set password</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={onSave}
          disabled={saving}
        >
          <Ionicons name="checkmark" size={15} color="#fff" />
          <Text style={styles.saveText}>{saving ? "Saving" : "Save"}</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.page}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <ProfileHeader />
          <TabBar />
          <View style={styles.bodyRow}>
            <View style={styles.mainCol}>
          {/* ===== WORK TAB ===== */}
          {tab === "work" && (
            <>
              <Card
                title="Basic information"
                desc="Identity and contact used across the app."
              >
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
                            setShowJoiningPicker(Platform.OS === "ios");
                            if (d) setEditableJoiningDate(dateToYMD(d));
                          }}
                        />
                      )}
                    </>
                  )}
                </Field>
              </Card>

              <Card
                title="Access & role"
                desc="Controls what this person can see and approve."
              >
                <Field label="System role" full>
                  <Segmented
                    accentActive
                    value={roleValue}
                    onChange={(v) => setRoleValue(v)}
                    options={[
                      { value: "USER", label: "User" },
                      { value: "MANAGER", label: "Manager" },
                      { value: "HR", label: "HR" },
                    ]}
                  />
                  <Text style={[styles.hint, { marginTop: 8 }]}>
                    Manager can approve leave, corrections, reimbursements &amp;
                    timesheets for their direct reports. HR has full org-wide
                    access — promote carefully.
                  </Text>
                </Field>
                <Field label="Employment status" full>
                  <Segmented
                    value={editableStatus}
                    onChange={(v) => setEditableStatus(v)}
                    options={[
                      { value: "Active", label: "Active" },
                      { value: "OnLeave", label: "On leave" },
                      { value: "Inactive", label: "Inactive" },
                      { value: "Terminated", label: "Not active" },
                    ]}
                  />
                </Field>
              </Card>

              <Card
                title="Organisation"
                desc="Where this person sits in the company."
              >
                <Field label="Department" full>
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

                <Field label="Reporting Manager" full>
                  <TouchableOpacity
                    style={styles.pickerInput}
                    onPress={() => setShowMgrPicker(true)}
                  >
                    <Text
                      style={{
                        color: reportingManagerId ? c.text : c.textFaint,
                        fontSize: 14,
                      }}
                    >
                      {reportingManagerName || "Choose a manager…"}
                    </Text>
                    <Ionicons
                      name="chevron-down"
                      size={16}
                      color={c.textFaint}
                    />
                  </TouchableOpacity>
                  {!!reportingManagerId && (
                    <TouchableOpacity
                      onPress={() => setReportingManagerId(null)}
                      style={{ marginTop: 6 }}
                    >
                      <Text style={styles.linkClear}>Clear</Text>
                    </TouchableOpacity>
                  )}
                </Field>

                <Field label="Project Manager(s)" full>
                  {(() => {
                    const pool = allUsers.filter(
                      (u) =>
                        (u.role === "MANAGER" || u.role === "HR") &&
                        u.id !== id &&
                        u.status !== "Terminated"
                    );
                    if (pool.length === 0) {
                      return (
                        <Text style={styles.hint}>
                          No managers available — promote someone to MANAGER
                          first.
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
              </Card>

              <Card
                title="Work location"
                desc="Primary site and default weekly setup."
              >
                <Field label="Work Address" full>
                  <TextField
                    value={workAddress}
                    onChange={setWorkAddress}
                    placeholder="Street, city, state, PIN"
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
                <Field label="Usual work location (Mon–Sun)" full>
                  <View style={styles.locList}>
                    {WEEKDAYS.map((d) => {
                      const selected = usualWorkLocation[d.key];
                      return (
                        <View key={d.key} style={styles.locRow}>
                          <Text style={styles.locRowDay}>{d.label}</Text>
                          <View style={styles.locRowChips}>
                            {WEEK_LOCS.map((loc) => {
                              const active = selected === loc;
                              return (
                                <TouchableOpacity
                                  key={loc}
                                  activeOpacity={0.8}
                                  style={[styles.locCell, active && styles.locCellActive]}
                                  onPress={() =>
                                    setUsualWorkLocation((prev) => ({
                                      ...prev,
                                      [d.key]: active ? null : loc }))
                                  }
                                >
                                  <Text
                                    style={[
                                      styles.locCellText,
                                      active && styles.locCellTextActive,
                                    ]}
                                  >
                                    {loc}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </Field>
                <Field label="Notes" full>
                  <TextField
                    value={workNotes}
                    onChange={setWorkNotes}
                    placeholder="Any work-related notes…"
                    multiline
                  />
                </Field>
              </Card>
            </>
          )}

          {/* ===== PERSONAL TAB ===== */}
          {tab === "personal" && (
            <>
              <Card
                title="Private contact"
                desc="Personal reach — not shown to other employees."
              >
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
              </Card>

              <Card
                title="Personal details"
                desc="Demographic details kept for records."
              >
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
                            ? new Date(
                                `${birthday}T00:00:00`
                              ).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric" })
                            : "Pick a date"}
                        </Text>
                      </TouchableOpacity>
                      {showBirthdayPicker && (
                        <DateTimePicker
                          value={ymdToDate(birthday) || new Date(2000, 0, 1)}
                          mode="date"
                          maximumDate={new Date()}
                          onChange={(_, d) => {
                            setShowBirthdayPicker(Platform.OS === "ios");
                            if (d) setBirthday(dateToYMD(d));
                          }}
                        />
                      )}
                    </>
                  )}
                </Field>
                <Field label="Place of Birth">
                  <TextField value={placeOfBirth} onChange={setPlaceOfBirth} />
                </Field>
                <Field label="Gender" full>
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
                <Field label="Marital Status" full>
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
                <Field label="Blood Group" full>
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
                <View style={[styles.switchRow]}>
                  <Text style={styles.switchLabel}>
                    Person with disability
                  </Text>
                  <Switch
                    value={disabled}
                    onValueChange={setDisabled}
                    trackColor={{ false: c.surfaceBorder, true: c.accent }}
                  />
                </View>
              </Card>

              <Card title="Address" desc="Residential address on file.">
                <Field label="Street 1" full>
                  <TextField value={street1} onChange={setStreet1} />
                </Field>
                <Field label="Street 2" full>
                  <TextField value={street2} onChange={setStreet2} />
                </Field>
                <Field label="City">
                  <TextField value={city} onChange={setCity} />
                </Field>
                <Field label="State">
                  <TextField value={state} onChange={setState} />
                </Field>
                <Field label="Pin Code">
                  <TextField
                    value={pinCode}
                    onChange={setPinCode}
                    keyboardType="phone-pad"
                  />
                </Field>
                <Field label="Country">
                  <TextField value={country} onChange={setCountry} />
                </Field>
              </Card>

              <Card title="Education">
                <Field label="Certification Level" full>
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
              </Card>

              <Card
                title="Statutory IDs"
                desc="Tax and provident-fund identifiers."
              >
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
              </Card>

              <Card title="Emergency contact">
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
              </Card>

              <Card
                title="Bank account"
                desc="Primary account used for payroll."
              >
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
              </Card>
            </>
          )}

          {/* ===== PAYROLL TAB ===== */}
          {tab === "payroll" && (
            <>
              <Card
                title="Contract"
                desc="Engagement type and headline wage."
              >
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
                <Field label="Wage Type" full>
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
                <Field label="Wage Duration" full>
                  <ChipPicker
                    options={WAGE_DURATIONS}
                    selected={wageDuration}
                    onSelect={setWageDuration}
                  />
                </Field>
                <Field label="Employee Type" full>
                  <ChipPicker
                    options={EMPLOYEE_TYPES}
                    selected={employeeType}
                    onSelect={setEmployeeType}
                  />
                </Field>
                {isSimplifiedEmployee && (
                  <Text style={[styles.hint, { marginTop: 8 }]}>
                    {employeeType === "Internship"
                      ? "Interns receive a stipend — only the wage amount above is captured. Full salary structure (HRA / PF / TDS) is skipped."
                      : "Consultants are paid the wage amount above on the chosen duration. No salary structure required."}
                  </Text>
                )}
              </Card>

              {!isSimplifiedEmployee && (
                <>
                  <Card
                    title="Quick fill from CTC"
                    desc="Enter a monthly CTC to auto-split the components."
                  >
                    <Field label="Monthly CTC (₹)" full>
                      <TextField
                        value={monthlyCTC}
                        onChange={setMonthlyCTC}
                        placeholder="e.g. 100000"
                        keyboardType="decimal-pad"
                      />
                    </Field>
                    <Text style={styles.hint}>
                      Basic 50% · HRA 20% · Comm 5% · Other 19% · Employer PF 6%
                      (cap ₹{PF_MONTHLY_CAP})
                    </Text>
                    <TouchableOpacity
                      style={[styles.saveReqBtn, { marginTop: 12 }]}
                      onPress={applyFormula}
                    >
                      <Text style={styles.saveReqText}>Apply formula</Text>
                    </TouchableOpacity>
                    <Field label="Percentage basis" full>
                      <Segmented
                        value={pctBasis}
                        onChange={(v) => setPctBasis(v)}
                        options={[
                          { value: "CTC", label: "% of CTC" },
                          { value: "Basic", label: "% of Basic" },
                        ]}
                      />
                      <Text style={[styles.hint, { marginTop: 8 }]}>
                        When a field is in % mode its value is read against this
                        basis.
                      </Text>
                    </Field>
                  </Card>

                  <Card
                    title="Earnings"
                    desc="Monthly salary components (₹)."
                  >
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
                  </Card>

                  <Card
                    title="Employer contributions"
                    desc="Paid by the company on top of CTC."
                  >
                    <Field label="Employer PF (blank = auto)">
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
                  </Card>

                  <Card
                    title="Employee deductions"
                    desc="Withheld from the employee's pay."
                  >
                    <Field label="Employee PF (blank = auto)">
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
                    <Text style={[styles.hint, { marginTop: 12 }]}>
                      Salary is stored separately so history is preserved when
                      you raise it. Leave PF blank to auto-compute from Basic
                      with the EPF cap.
                    </Text>
                  </Card>
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
                            onPress={() => {
                              if (!d.fileUrl || !openMedia(d.fileUrl)) {
                                notify("No file URL on record");
                              }
                            }}
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
            </View>
            {isDesktop && <RightRail />}
          </View>
          {!isDesktop && <RightRail />}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* MANAGER PICKER */}
      <WebModal
        visible={showMgrPicker}
        onClose={() => setShowMgrPicker(false)}
        title="Choose reporting manager"
        size="md"
        scrollable={false}
      >
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
                  <Avatar
                    name={item.name}
                    uri={item.profilePictureUrl}
                    size={36}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickerName}>{item.name}</Text>
                    <Text style={styles.pickerSub}>
                      {item.email} · {item.role}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            />
      </WebModal>

      <WebModal
        visible={showPwModal}
        onClose={() => setShowPwModal(false)}
        title="Set new password"
        size="md"
        scrollable={false}
        footer={
          <ModalActions align="spread">
            <TouchableOpacity
              style={styles.pwCancel}
              onPress={() => setShowPwModal(false)}
              disabled={savingPw}
            >
              <Text style={styles.pwCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pwSubmit, !pwValid && styles.pwSubmitDisabled]}
              onPress={submitSetPassword}
              disabled={!pwValid}
            >
              {savingPw ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.pwSubmitText}>Update password</Text>
              )}
            </TouchableOpacity>
          </ModalActions>
        }
      >
        {/* Who this affects, stated plainly — the destructive part of this
            action is doing it to the wrong person. */}
        <View style={styles.pwWho}>
          <View style={styles.pwWhoIcon}>
            <Ionicons name="key" size={18} color={c.accentText} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.pwWhoName} numberOfLines={1}>
              {user?.name || "This user"}
            </Text>
            <Text style={styles.pwWhoMail} numberOfLines={1}>
              {user?.email || ""}
            </Text>
          </View>
        </View>

        <Text style={styles.pwNote}>
          Sets the password immediately — no email is sent. Any pending reset
          links stop working. Share the new password securely.
        </Text>

        {/* Side by side on desktop so the wider box is actually used;
            stacked on phones, where two fields per row would be cramped. */}
        <View style={styles.pwFieldRow}>
          <View style={styles.pwFieldCol}>
            <Text style={styles.pwLabel}>NEW PASSWORD</Text>
            <View style={styles.pwField}>
              <Ionicons
                name="lock-closed-outline"
                size={17}
                color={c.textMuted}
              />
              <TextInput
                style={styles.pwInput}
                value={newPw}
                onChangeText={setNewPw}
                placeholder="Enter a new password"
                placeholderTextColor={c.textFaint}
                autoCapitalize="none"
                secureTextEntry={!showPw}
                editable={!savingPw}
              />
            </View>
          </View>

          <View style={styles.pwFieldCol}>
            <Text style={styles.pwLabel}>CONFIRM PASSWORD</Text>
            <View
              style={[
                styles.pwField,
                !!confirmPw &&
                  confirmPw !== newPw && { borderColor: c.dangerText },
              ]}
            >
              <Ionicons
                name="lock-closed-outline"
                size={17}
                color={c.textMuted}
              />
              <TextInput
                style={styles.pwInput}
                value={confirmPw}
                onChangeText={setConfirmPw}
                placeholder="Re-enter the password"
                placeholderTextColor={c.textFaint}
                autoCapitalize="none"
                secureTextEntry={!showPw}
                editable={!savingPw}
              />
              {!!confirmPw && confirmPw === newPw && (
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color={c.successText}
                />
              )}
            </View>
          </View>
        </View>

        {/* One toggle governing BOTH fields, so it lives outside them —
            inside the first field it read as applying only to that one. */}
        <TouchableOpacity
          style={styles.pwShowToggle}
          onPress={() => setShowPw((v) => !v)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={showPw ? "Hide passwords" : "Show passwords"}
        >
          <Ionicons
            name={showPw ? "eye-off-outline" : "eye-outline"}
            size={16}
            color={c.accent}
          />
          <Text style={styles.pwShowText}>
            {showPw ? "Hide passwords" : "Show passwords"}
          </Text>
        </TouchableOpacity>

        {/* Live checklist instead of one line that only reports the first
            problem — the rules and the current state are both visible. */}
        <View style={styles.pwRules}>
          <PwRule
            ok={newPw.length >= 6}
            label="At least 6 characters"
            c={c}
            styles={styles}
          />
          <PwRule
            ok={!!confirmPw && confirmPw === newPw}
            label="Both entries match"
            c={c}
            styles={styles}
          />
        </View>
      </WebModal>

      {/* Profile photo — click the avatar to change or delete it. */}
      <WebModal
        visible={photoModalOpen}
        onClose={() => setPhotoModalOpen(false)}
        title="Profile photo"
        size="xl"
        scrollable={false}
      >
        <View style={styles.photoModalRow}>
          {/* LEFT — the image */}
          <View style={styles.photoLeft}>
            <View style={styles.photoCard}>
              {profilePictureUrl ? (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => setPhotoZoom(true)}
                  style={{ width: "100%", height: "100%" }}
                >
                  <Image
                    source={{ uri: mediaUrl(profilePictureUrl) }}
                    style={styles.photoCardImg}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              ) : (
                <View style={styles.photoCardEmpty}>
                  <Ionicons name="image-outline" size={34} color={c.textFaint} />
                  <Text style={styles.photoCardEmptyText}>No image uploaded</Text>
                </View>
              )}
              <FullScreenImage
                uri={profilePictureUrl}
                visible={photoZoom}
                onClose={() => setPhotoZoom(false)}
              />
              {savingPhoto && (
                <View style={styles.photoBusy}>
                  <ActivityIndicator color="#fff" />
                </View>
              )}
            </View>
          </View>

          {/* RIGHT — identity + actions */}
          <View style={styles.photoRight}>
            <Text style={styles.photoName} numberOfLines={1}>{displayName}</Text>
            <Text style={styles.photoSub} numberOfLines={1}>
              {[roleBadge, editableEmployeeCode].filter(Boolean).join("  ·  ") || "Employee"}
            </Text>
            <Text style={styles.photoRightDesc}>
              Shown on the employee's profile and across the app. A clear
              headshot or ID card works best.
            </Text>

            <View style={styles.photoActions}>
              <FilePickButton
                label={profilePictureUrl ? "Upload new image" : "Upload image"}
                mimeType="image/*"
                crop
                style={styles.photoChangeBtn}
                onUploaded={(url) => savePhoto(url)}
              />
              {!!profilePictureUrl && (
                <TouchableOpacity
                  style={[styles.photoRemoveBtn, savingPhoto && { opacity: 0.5 }]}
                  disabled={savingPhoto}
                  onPress={async () => {
                    const ok = await confirmAction({
                      title: "Remove photo?",
                      message: "This clears the employee's profile picture.",
                      confirmLabel: "Remove",
                      destructive: true,
                    });
                    if (ok) savePhoto("");
                  }}
                >
                  <Ionicons name="trash-outline" size={15} color={c.dangerText} />
                  <Text style={styles.photoRemoveText}>Remove photo</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={[styles.hint, styles.photoHint]}>
              JPG or PNG · saves immediately
            </Text>
          </View>
        </View>
      </WebModal>
    </SafeAreaView>
  );
}

/** One requirement line in the set-password checklist. */
const PwRule = ({
  ok,
  label,
  c,
  styles,
}: {
  ok: boolean;
  label: string;
  c: any;
  styles: any;
}) => (
  <View style={styles.pwRule}>
    <Ionicons
      name={ok ? "checkmark-circle" : "ellipse-outline"}
      size={15}
      color={ok ? c.successText : c.textFaint}
    />
    <Text style={[styles.pwRuleText, ok && { color: c.successText }]}>
      {label}
    </Text>
  </View>
);

const makeStyles = (c: any, isDesktop: boolean) => StyleSheet.create({
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

  // ===== HERO (accent banner, centered identity) =====
  hero: {
    alignItems: "center",
    backgroundColor: c.accent,
    borderRadius: 22,
    marginHorizontal: 12,
    marginBottom: 12,
    paddingHorizontal: 20,
    paddingVertical: 20,
    shadowColor: c.accent,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
    ...(isDesktop && {
      maxWidth: 980,
      width: "100%" as const,
      alignSelf: "center" as const,
      marginHorizontal: 0,
    }) },
  avatarLgWrap: { position: "relative", marginBottom: 12 },
  avatarLg: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden" },
  avatarLgImg: { width: 76, height: 76 },
  avatarLgText: { color: "#fff", fontSize: 28, fontWeight: "800" },
  // Tiny camera bubble sitting on the bottom-right of the avatar. The white
  // ring separates the accent button from the accent hero background.
  avatarCamera: {
    position: "absolute",
    right: -2,
    bottom: -2,
    borderRadius: 15,
    backgroundColor: "#fff",
    padding: 3 },
  avatarCameraBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: c.accent },
  heroName: { color: "#fff", fontSize: 20, fontWeight: "800", textAlign: "center" },
  heroRole: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
    textAlign: "center" },
  heroPills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 12,
    justifyContent: "center" },
  heroPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: 240 },
  heroPillText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    gap: 5,
    marginTop: 12 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusPillText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
  statusRoleText: { fontSize: 10, fontWeight: "700", opacity: 0.85 },

  // ===== WORKSPACE (two-pane on desktop, single column on mobile) =====
  workspace: {
    flex: 1,
    ...(isDesktop && { flexDirection: "row" as const }) },
  leftRail: {
    width: 300,
    borderRightWidth: 1,
    borderRightColor: c.surfaceBorder,
    backgroundColor: c.bg },
  leftRailContent: { padding: 16, gap: 6 },
  railSectionLabel: {
    color: c.textMuted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginTop: 18,
    marginBottom: 8,
    marginLeft: 4 },

  // Rail identity card (compact, surface)
  railIdentity: {
    alignItems: "center",
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 20 },
  avatarRail: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: c.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden" },
  avatarRailImg: { width: 84, height: 84 },
  avatarRailText: { color: c.accentText, fontSize: 30, fontWeight: "800" },
  railName: {
    color: c.text,
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 12 },
  railRole: {
    color: c.textMuted,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 2 },
  railPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: c.surfaceMuted,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: 240 },
  railPillText: { color: c.text, fontSize: 11, fontWeight: "600" },

  // Vertical section nav (desktop rail)
  navList: { gap: 4 },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "transparent",
    ...(Platform.OS === "web" && { cursor: "pointer" as any }) },
  navItemActive: {
    backgroundColor: c.accentSoft,
    borderColor: c.accent },
  navItemText: { color: c.textMuted, fontSize: 14, fontWeight: "700" },

  // Wrapping segmented tabs (mobile)
  segTabs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
    marginBottom: 4 },
  segTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: c.surfaceMuted,
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  segTabActive: { backgroundColor: c.accentSoft, borderColor: c.accent },
  segTabText: { color: c.textMuted, fontSize: 13, fontWeight: "700" },

  // Quick actions (vertical rail buttons / mobile wrap row)
  qaList: { gap: 8 },
  qaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    ...(Platform.OS === "web" && { cursor: "pointer" as any }) },
  qaItemText: { color: c.text, fontSize: 13, fontWeight: "700" },
  qaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2 },

  // ================= REDESIGN: page / header / facts / tabs / body / rail =====
  page: {
    padding: isDesktop ? 24 : 16,
    paddingBottom: 96,
    ...(isDesktop && {
      maxWidth: 1180,
      width: "100%",
      alignSelf: "center" as const,
    }) },
  crumbs: { flex: 1, color: c.textMuted, fontSize: 13, marginLeft: 2 },
  crumbsStrong: { color: c.text, fontWeight: "700" },
  ghostBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    backgroundColor: c.surface },
  ghostBtnText: { color: c.text, fontSize: 13, fontWeight: "700" },

  headCard: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    borderTopWidth: 3,
    borderTopColor: c.accent,
    borderRadius: 16,
    padding: isDesktop ? 24 : 18,
    shadowColor: c.shadow,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2 },
  headTop: { flexDirection: "row", alignItems: "center", gap: 18 },
  headAvatarWrap: {
    position: "relative",
    shadowColor: c.accent,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3 },
  headAvatar: {
    width: isDesktop ? 76 : 62,
    height: isDesktop ? 76 : 62,
    borderRadius: 20,
    backgroundColor: c.accent,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden" },
  headAvatarImg: { width: "100%", height: "100%" },
  headAvatarText: {
    color: "#fff",
    fontSize: isDesktop ? 28 : 23,
    fontWeight: "800",
    letterSpacing: 0.5 },
  headCam: {
    position: "absolute",
    right: -6,
    bottom: -6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden" },
  // Profile-photo modal
  // Two-column layout: image on the left, identity + actions on the right.
  // Stacks vertically on mobile.
  photoModalRow: {
    flexDirection: isDesktop ? "row" : "column",
    gap: isDesktop ? 24 : 18,
    alignItems: "stretch",
  },
  photoLeft: { flex: isDesktop ? 1.15 : undefined, justifyContent: "center" },
  photoRight: { flex: isDesktop ? 1 : undefined, justifyContent: "center" },
  // Clean framed preview: white surface + thin border, image shown with
  // "contain" so a headshot OR an ID card is fully visible (no gray bars).
  photoCard: {
    width: "100%",
    aspectRatio: 1.4,
    borderRadius: 16,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: c.shadow,
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  photoCardImg: { width: "100%", height: "100%" },
  photoCardEmpty: { alignItems: "center", gap: 8 },
  photoCardEmptyText: { color: c.textMuted, fontSize: 13, fontWeight: "600" },
  photoBusy: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  photoName: { color: c.text, fontSize: isDesktop ? 20 : 18, fontWeight: "800" },
  photoSub: { color: c.textMuted, fontSize: 13, fontWeight: "600", marginTop: 4 },
  photoRightDesc: { color: c.textMuted, fontSize: 13, lineHeight: 19, marginTop: 14 },
  photoActions: { gap: 8, marginTop: 20 },
  // Full-width accent primary (overrides FilePickButton's default blue).
  photoChangeBtn: {
    alignSelf: "stretch",
    justifyContent: "center",
    backgroundColor: c.accent,
    paddingVertical: 13,
    borderRadius: 12,
  },
  // Subtle text-style remove — not a heavy red block.
  photoRemoveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
  },
  photoRemoveText: { color: c.dangerText, fontWeight: "700", fontSize: 13 },
  photoHint: { marginTop: 14 },
  headName: {
    color: c.text,
    fontSize: isDesktop ? 24 : 20,
    fontWeight: "800",
    letterSpacing: -0.3 },
  headRoleLine: { color: c.textMuted, fontSize: 14, marginTop: 3 },
  headBadges: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  hbadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 24,
    paddingHorizontal: 10,
    borderRadius: 999 },
  hdot: { width: 6, height: 6, borderRadius: 3 },
  hbadgeText: { fontSize: 12, fontWeight: "700" },
  headWorkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    backgroundColor: c.surface },
  headWorkBtnText: { color: c.text, fontSize: 13, fontWeight: "700" },

  facts: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 20,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    borderRadius: 10,
    backgroundColor: c.surfaceMuted,
    overflow: "hidden" },
  fact: {
    width: isDesktop ? "20%" : "50%",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: c.surfaceBorder },
  factK: {
    color: c.textFaint,
    fontSize: 10.5,
    letterSpacing: 0.6,
    fontWeight: "800",
    textTransform: "uppercase" },
  factV: { color: c.text, fontSize: 14, fontWeight: "600", marginTop: 4 },

  tabsRow2: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 22,
    marginBottom: 20 },
  tab2: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    ...(Platform.OS === "web" && { cursor: "pointer" as any }) },
  tab2Active: { backgroundColor: c.accentSoft },
  tab2Text: { color: c.textMuted, fontSize: 14, fontWeight: "700" },
  tab2TextActive: { color: c.text },
  tab2Underline: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: -1,
    height: 2,
    borderRadius: 2,
    backgroundColor: "transparent" },
  tab2UnderlineOn: { backgroundColor: c.accent },

  bodyRow: {
    gap: 20,
    alignItems: "flex-start",
    ...(isDesktop && { flexDirection: "row" as const }) },
  mainCol: { flex: 1, gap: 16, minWidth: 0, width: "100%" },
  rail: {
    width: isDesktop ? 300 : "100%",
    gap: 16 },
  railCard: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    borderRadius: 14,
    padding: 18,
    shadowColor: c.shadow,
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1 },
  railLabel: {
    color: c.textFaint,
    fontSize: 10.5,
    letterSpacing: 0.6,
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: 12 },
  mini: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.surfaceBorder },
  miniK: { color: c.textMuted, fontSize: 13 },
  miniV: { color: c.text, fontSize: 13, fontWeight: "700" },

  // Titled content card + responsive field grid
  card: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    borderRadius: 14,
    padding: isDesktop ? 22 : 18,
    shadowColor: c.shadow,
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1 },
  cardHead: { marginBottom: 16 },
  cardTitle: { color: c.text, fontSize: 15, fontWeight: "800", letterSpacing: -0.2 },
  cardDesc: { color: c.textMuted, fontSize: 12.5, marginTop: 3 },
  formGrid: {
    ...(isDesktop
      ? {
          flexDirection: "row" as const,
          flexWrap: "wrap" as const,
          justifyContent: "space-between" as const,
          rowGap: 16 }
      : { rowGap: 14 }) },

  // Segmented control
  seg: {
    flexDirection: "row",
    backgroundColor: c.surfaceMuted,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    borderRadius: 10,
    padding: 3,
    gap: 2 },
  segBtn: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 7 },
  segBtnOn: {
    backgroundColor: c.surface,
    shadowColor: c.shadow,
    shadowOpacity: 1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1 },
  segBtnAccent: { backgroundColor: c.accent },
  segBtnText: { color: c.textMuted, fontSize: 13, fontWeight: "700" },
  segBtnTextOn: { color: c.text },
  segBtnTextAccent: { color: "#fff" },

  // Dropdown-style picker input + switch row
  pickerInput: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    minHeight: 42 },
  switchRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4 },
  switchLabel: { color: c.text, fontSize: 14, fontWeight: "600" },

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
  quickLinkPrimary: { backgroundColor: c.accent, borderColor: c.accent },
  quickLinkText: { color: c.text, fontSize: 12, fontWeight: "700" },
  pwSubmit: {
    flex: 1,
    backgroundColor: c.accent,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
    ...(Platform.OS === "web" ? { cursor: "pointer" } : {}) },
  pwSubmitDisabled: { opacity: 0.45 },
  pwSubmitText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  pwCancel: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    ...(Platform.OS === "web" ? { cursor: "pointer" } : {}) },
  pwCancelText: { color: c.text, fontSize: 15, fontWeight: "600" },
  pwWho: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: c.accentSoft,
  },
  pwWhoIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.surface,
  },
  pwWhoName: { color: c.text, fontSize: 15, fontWeight: "700" },
  pwWhoMail: { color: c.textMuted, fontSize: 12, marginTop: 1 },
  pwNote: {
    color: c.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 12,
  },
  pwFieldRow: {
    flexDirection: isDesktop ? "row" : "column",
    gap: isDesktop ? 12 : 0,
  },
  pwFieldCol: { flex: isDesktop ? 1 : undefined, minWidth: 0 },
  pwLabel: {
    color: c.textFaint,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    marginTop: 16,
    marginBottom: 6,
  },
  pwField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    backgroundColor: c.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
  },
  pwInput: { flex: 1, color: c.text, fontSize: 15, padding: 0 },
  pwShowToggle: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    marginTop: 12,
    paddingVertical: 4,
    ...(Platform.OS === "web" ? { cursor: "pointer" } : {}) },
  pwShowText: { color: c.accent, fontSize: 12, fontWeight: "700" },
  pwRules: { marginTop: 12, gap: 6 },
  pwRule: { flexDirection: "row", alignItems: "center", gap: 8 },
  pwRuleText: { color: c.textMuted, fontSize: 12, fontWeight: "600" },

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
  tabLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  tabText: { color: c.textMuted, fontSize: 13, fontWeight: "700" },
  tabTextActive: { color: c.text },
  tabUnderline: {
    marginTop: 8,
    height: 2,
    width: "100%",
    borderRadius: 2,
    backgroundColor: "transparent" },
  tabUnderlineActive: { backgroundColor: c.accent },

  // Content of each form tab sits inside one rounded surface card so the
  // screen matches the manager team-member layout (cards under headers).
  tabCard: {
    backgroundColor: c.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    paddingHorizontal: isDesktop ? 24 : 14,
    paddingTop: 2,
    paddingBottom: isDesktop ? 24 : 16,
    shadowColor: c.shadow,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    // Desktop: fields flow two-up in a wrapping grid; mobile stays single
    // column. Section headers / `full` fields span the whole row.
    ...(isDesktop && {
      flexDirection: "row" as const,
      flexWrap: "wrap" as const,
      justifyContent: "space-between" as const,
      alignItems: "flex-start" as const,
    }) },
  // Form-grid children (row spacing comes from the grid's rowGap).
  field: { width: isDesktop ? "48%" : "100%" },
  fieldFull: { width: "100%" },
  gridFull: { width: "100%" },
  sectionHeaderRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 22,
    marginBottom: 6 },
  sectionHeaderIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: c.accentSoft,
    alignItems: "center",
    justifyContent: "center" },
  sectionHeader: {
    color: c.textMuted,
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: "800" },
  label: {
    color: c.textMuted,
    fontSize: 11,
    letterSpacing: 0.5,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 6 },
  input: {
    backgroundColor: c.surface,
    color: c.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    minHeight: 42,
    fontSize: 14 },
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
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between" },
  chipRow: { width: "100%", flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: c.surfaceMuted,
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  chipActive: { backgroundColor: c.accent, borderColor: c.accent },
  chipText: { color: c.textMuted, fontSize: 11, fontWeight: "700" },
  chipTextActive: { color: "#fff" },
  smallChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: c.surfaceMuted,
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  smallChipText: { color: c.textMuted, fontSize: 10, fontWeight: "700" },
  weekdayRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 10 },
  weekdayLabel: {
    color: c.textMuted,
    fontSize: 12,
    fontWeight: "800",
    width: 36 },

  // Usual-work-location — a simple aligned list: day label + equal-width
  // option cells that line up into columns across every row.
  locList: { gap: 8 },
  locRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  locRowDay: { width: 42, color: c.text, fontSize: 13, fontWeight: "800" },
  locRowChips: { flex: 1, flexDirection: "row", gap: 8 },
  locCell: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: c.surfaceMuted,
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  locCellActive: { backgroundColor: c.accent, borderColor: c.accent },
  locCellText: { color: c.textMuted, fontSize: 12, fontWeight: "600" },
  locCellTextActive: { color: "#fff", fontWeight: "800" },
  hint: { width: "100%", color: c.textMuted, fontSize: 12, fontStyle: "italic" },
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
  pickerName: { color: c.text, fontSize: 14, fontWeight: "700" },
  pickerSub: { color: c.textMuted, fontSize: 11, marginTop: 2 },

  // Shared row + button styles reused by the Salary save button and
  // the Assets tab (assigned/available asset rows + Return action).
  saveReqBtn: {
    width: "100%",
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

