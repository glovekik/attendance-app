import React, { useEffect, useState, useCallback } from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  Switch,
  Modal,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { FilePickButton } from "../src/components/FilePickButton";
import { getUser, updateUser, listUsers } from "../src/services/users";
import { listDepartments } from "../src/services/departments";
import { requestPasswordReset } from "../src/services/api";
import {
  Department,
  EmployeeType,
  User,
  WageDuration,
  WageType,
} from "../src/types";

type TabKey = "work" | "personal" | "payroll";

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: "work", label: "Work", icon: "briefcase-outline" },
  { key: "personal", label: "Personal", icon: "person-outline" },
  { key: "payroll", label: "Payroll", icon: "cash-outline" },
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
  "Employee",
  "Worker",
  "Student",
  "Trainee",
  "Contractor",
  "Freelancer",
  "Apprenticeship",
];
const CERT_LEVELS = [
  "Graduate",
  "Bachelor",
  "Master",
  "Doctor",
  "Other",
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

// ============================== Inline form helpers
const Field = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <View style={{ marginTop: 12 }}>
    <Text style={styles.label}>{label}</Text>
    {children}
  </View>
);

const TextField = ({
  value,
  onChange,
  placeholder,
  multiline,
  keyboardType,
  autoCapitalize,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: "default" | "email-address" | "phone-pad" | "decimal-pad";
  autoCapitalize?: "none" | "sentences" | "characters";
}) => (
  <TextInput
    style={[styles.input, multiline && { minHeight: 60, textAlignVertical: "top" }]}
    value={value}
    onChangeText={onChange}
    placeholder={placeholder}
    placeholderTextColor="#475569"
    multiline={multiline}
    keyboardType={keyboardType || "default"}
    autoCapitalize={autoCapitalize || "sentences"}
  />
);

const ChipPicker = <T extends string>({
  options,
  selected,
  onSelect,
}: {
  options: readonly T[];
  selected: T | undefined | null;
  onSelect: (v: T | undefined) => void;
}) => (
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

const SectionHeader = ({ title }: { title: string }) => (
  <Text style={styles.sectionHeader}>{title}</Text>
);

// ==============================
export default function HrUserProfile() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<TabKey>("work");

  const [user, setUser] = useState<User | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [showMgrPicker, setShowMgrPicker] = useState(false);
  const [mgrSearch, setMgrSearch] = useState("");

  // ===== Editable form state =====
  // Profile picture
  const [profilePictureUrl, setProfilePictureUrl] = useState("");

  // Role (USER / MANAGER — HR can't be set via API, requires bootstrap)
  const [roleValue, setRoleValue] = useState<"USER" | "MANAGER">("USER");

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

  const load = useCallback(async () => {
    if (!id) {
      router.back();
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
      setRoleValue(
        u.role === "MANAGER" ? "MANAGER" : "USER"
      );
      setDepartmentId(u.departmentId || u.work?.departmentId || null);
      setReportingManagerId(
        u.reportingManagerId || u.work?.reportingManagerId || null
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
      setLegalName(p.legalName || "");
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
      workAddress: opt(workAddress),
      workLocation: opt(workLocation),
      usualWorkLocation: Object.keys(usualWorkLocation).length
        ? usualWorkLocation
        : undefined,
      notes: opt(workNotes),
    };

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
        country: opt(country),
      },
      education: {
        certificationLevel: certLevel,
        fieldOfStudy: opt(fieldOfStudy),
      },
    };

    const statutory = {
      pan: opt(pan),
      uan: opt(uan),
      pfAccountNumber: opt(pfAcct),
      esiNumber: opt(esiNum),
    };

    const emergencyContact = {
      contactName: opt(ecName),
      relationship: opt(ecRel),
      phone: opt(ecPhone),
    };

    const bankAccounts = [
      {
        bankName: opt(bankName),
        accountNumber: opt(bankAcct),
        ifscCode: opt(bankIfsc),
        branch: opt(bankBranch),
        accountHolderName: opt(bankHolder),
      },
    ].filter((b) => Object.values(b).some((v) => !!v));

    const contract = {
      contractStartDate: opt(contractStart),
      contractEndDate: opt(contractEnd),
      wageType,
      wage: wage ? parseFloat(wage) : undefined,
      wageDuration,
      employeeType,
    };

    // Only send role if it's USER/MANAGER. HR role can't be set via the
    // API by design (security); requires the bootstrap script. Skip
    // sending role if the current user IS HR so we don't accidentally
    // demote them via a payload that defaults to USER.
    const rolePayload: { role?: "USER" | "MANAGER" } = {};
    if (user?.role !== "HR") {
      rolePayload.role = roleValue;
    }

    return {
      ...rolePayload,
      profilePictureUrl: opt(profilePictureUrl),
      departmentId: departmentId || undefined,
      reportingManagerId: reportingManagerId || undefined,
      work,
      personal,
      statutory,
      emergencyContact,
      bankAccounts: bankAccounts.length ? bankAccounts : undefined,
      contract,
    };
  };

  const onSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token || !id) return;
      await updateUser(token, id, buildPayload());
      Alert.alert("Saved", "Profile updated successfully");
    } catch (err: any) {
      Alert.alert("Save failed", err?.message || "");
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
          },
        },
      ]
    );
  };

  const managerCandidates = allUsers.filter(
    (u) => u.role === "MANAGER" || u.role === "HR"
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
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.loader}>
        <Text style={{ color: "#fff" }}>User not found</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.headerName} numberOfLines={1}>
            {user.name}
          </Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {user.email}
            {user.employeeCode ? `  ·  ${user.employeeCode}` : ""}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={onSave}
          disabled={saving}
        >
          <Text style={styles.saveText}>
            {saving ? "..." : "Save"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* QUICK LINKS */}
      <View style={styles.quickLinks}>
        <TouchableOpacity
          style={styles.quickLink}
          onPress={() =>
            router.push(`/hr-user-documents?id=${id}` as any)
          }
        >
          <Ionicons
            name="folder-open-outline"
            size={16}
            color="#06b6d4"
          />
          <Text style={styles.quickLinkText}>Documents</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickLink}
          onPress={onSendResetLink}
        >
          <Ionicons name="key-outline" size={16} color="#f59e0b" />
          <Text style={[styles.quickLinkText, { color: "#f59e0b" }]}>
            Send reset link
          </Text>
        </TouchableOpacity>
      </View>

      {/* PROFILE PICTURE */}
      <View style={styles.picBar}>
        <View style={styles.avatarBig}>
          {profilePictureUrl ? (
            <Image
              source={{ uri: profilePictureUrl }}
              style={styles.avatarImg}
              resizeMode="cover"
            />
          ) : (
            <Text style={styles.avatarBigText}>
              {user.name.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <FilePickButton
            label={
              profilePictureUrl ? "Replace photo" : "Upload photo"
            }
            mimeType="image/*"
            onUploaded={(url) => setProfilePictureUrl(url)}
          />
          {!!profilePictureUrl && (
            <TouchableOpacity
              onPress={() => setProfilePictureUrl("")}
            >
              <Text style={styles.linkClear}>Remove photo</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* TABS */}
      <View style={styles.tabs}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[
              styles.tab,
              tab === t.key && styles.tabActive,
            ]}
            onPress={() => setTab(t.key)}
          >
            <Ionicons
              name={t.icon}
              size={16}
              color={tab === t.key ? "#fff" : "#94a3b8"}
            />
            <Text
              style={[
                styles.tabText,
                tab === t.key && styles.tabTextActive,
              ]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

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
              <SectionHeader title="ACCESS" />
              <Field label="Role">
                {user?.role === "HR" ? (
                  <View>
                    <View
                      style={[
                        styles.chip,
                        {
                          alignSelf: "flex-start",
                          backgroundColor: "#db2777",
                          borderColor: "#db2777",
                        },
                      ]}
                    >
                      <Text style={styles.chipTextActive}>HR</Text>
                    </View>
                    <Text style={[styles.hint, { marginTop: 8 }]}>
                      HR role cannot be changed via the app. To demote
                      this user, edit MongoDB directly or run the
                      promote_hr.py script with the appropriate flag.
                    </Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.chipRow}>
                      {(["USER", "MANAGER"] as const).map((r) => (
                        <TouchableOpacity
                          key={r}
                          style={[
                            styles.chip,
                            roleValue === r && styles.chipActive,
                            roleValue === r &&
                              r === "MANAGER" && {
                                backgroundColor: "#7c3aed",
                                borderColor: "#7c3aed",
                              },
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
                      reports. HR role is set by server-side bootstrap
                      script for security.
                    </Text>
                  </>
                )}
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
                      color: reportingManagerId ? "#fff" : "#475569",
                    }}
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

              <SectionHeader title="ROLE" />
              <Field label="Job Position">
                <TextField
                  value={jobPosition}
                  onChange={setJobPosition}
                  placeholder="Senior Engineer"
                />
              </Field>
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
                                [d.key]: active ? null : loc,
                              }))
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
              <Field label="Birthday (YYYY-MM-DD)">
                <TextField
                  value={birthday}
                  onChange={setBirthday}
                  placeholder="1995-06-15"
                  autoCapitalize="none"
                />
              </Field>
              <Field label="Place of Birth">
                <TextField
                  value={placeOfBirth}
                  onChange={setPlaceOfBirth}
                />
              </Field>
              <Field label="Gender">
                <TextField value={gender} onChange={setGender} />
              </Field>
              <Field label="Marital Status">
                <TextField
                  value={maritalStatus}
                  onChange={setMaritalStatus}
                  placeholder="Single / Married / ..."
                />
              </Field>
              <Field label="Blood Group">
                <TextField
                  value={bloodGroup}
                  onChange={setBloodGroup}
                  placeholder="O+"
                />
              </Field>
              <View style={[styles.row, { marginTop: 14 }]}>
                <Text style={styles.label}>Disabled</Text>
                <Switch
                  value={disabled}
                  onValueChange={setDisabled}
                  trackColor={{ false: "#1e293b", true: "#3b82f6" }}
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
              <Field label="Start Date (YYYY-MM-DD)">
                <TextField
                  value={contractStart}
                  onChange={setContractStart}
                  placeholder="2026-04-01"
                  autoCapitalize="none"
                />
              </Field>
              <Field label="End Date (optional)">
                <TextField
                  value={contractEnd}
                  onChange={setContractEnd}
                  placeholder="2027-03-31"
                  autoCapitalize="none"
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
              <Text style={[styles.hint, { marginTop: 18 }]}>
                Salary components (basic / HRA / deductions / etc.) are
                managed under HR Admin → Payroll → Salary Structures.
              </Text>
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
                <Ionicons name="close" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={16} color="#64748b" />
              <TextInput
                style={styles.searchInput}
                value={mgrSearch}
                onChangeText={setMgrSearch}
                placeholder="Search by name or email"
                placeholderTextColor="#475569"
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b1220" },
  loader: {
    flex: 1,
    backgroundColor: "#0b1220",
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
    gap: 8,
  },
  headerName: { color: "#fff", fontSize: 16, fontWeight: "800" },
  headerSub: { color: "#94a3b8", fontSize: 11, marginTop: 2 },
  saveBtn: {
    backgroundColor: "#16a34a",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  saveText: { color: "#fff", fontWeight: "800" },
  picBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  avatarBig: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarBigText: { color: "#fff", fontSize: 24, fontWeight: "800" },
  avatarImg: { width: 64, height: 64 },
  quickLinks: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
    backgroundColor: "#0b1220",
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  quickLink: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1f2937",
    gap: 6,
  },
  quickLinkText: { color: "#06b6d4", fontSize: 12, fontWeight: "700" },
  tabs: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 6,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#111827",
    gap: 6,
  },
  tabActive: { backgroundColor: "#3b82f6" },
  tabText: { color: "#94a3b8", fontSize: 12, fontWeight: "700" },
  tabTextActive: { color: "#fff" },

  sectionHeader: {
    color: "#64748b",
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "800",
    marginTop: 24,
    marginBottom: 4,
  },
  label: {
    color: "#94a3b8",
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: "700",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#111827",
    color: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1f2937",
    minHeight: 42,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  chipActive: { backgroundColor: "#3b82f6", borderColor: "#3b82f6" },
  chipText: { color: "#94a3b8", fontSize: 11, fontWeight: "700" },
  chipTextActive: { color: "#fff" },
  smallChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  smallChipText: { color: "#94a3b8", fontSize: 10, fontWeight: "700" },
  weekdayRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 10,
  },
  weekdayLabel: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "800",
    width: 36,
  },
  hint: { color: "#64748b", fontSize: 12, fontStyle: "italic" },
  linkClear: { color: "#ef4444", fontSize: 11, fontWeight: "700" },

  modalWrap: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  pickerModal: {
    backgroundColor: "#0f172a",
    padding: 16,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  modalTitle: { color: "#fff", fontSize: 17, fontWeight: "800" },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 10,
    paddingHorizontal: 10,
    gap: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  searchInput: {
    flex: 1,
    color: "#fff",
    paddingVertical: 8,
    fontSize: 13,
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#111827",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "700" },
  pickerName: { color: "#fff", fontSize: 14, fontWeight: "700" },
  pickerSub: { color: "#94a3b8", fontSize: 11, marginTop: 2 },
});
