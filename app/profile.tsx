import React, { useEffect, useState, useMemo} from "react";

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Image,
  Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useRouter } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import { getMe, changePassword } from "../src/services/api";

import { unregisterPushToken } from "../src/services/notifications";

import {
  getMyProfile,
  updateMyProfile,
  updateMyProfilePicture,
  MyProfile } from "../src/services/users";
import { logoutSession } from "../src/services/session";
import { User, hasRole } from "../src/types";
import { useTheme, ThemePreference } from "../src/theme/ThemeProvider";
import {
  BottomTabBar,
  BOTTOM_BAR_RESERVED_HEIGHT,
} from "../src/components/BottomTabBar";
import { FilePickButton } from "../src/components/FilePickButton";
import { WebModal, ModalActions } from "../src/components/WebModal";
import { confirmAction, notify } from "../src/utils/confirm";
import { useResponsive, getResponsiveSpacing } from "../src/utils/responsive";
import { PageHeader } from "../src/components/PageHeader";

// ── Personal-info fields the employee can self-complete. Paths are
// dotted so the same descriptor reads from the profile object and
// rebuilds the PUT body. The backend ignores writes to filled fields.
type PField = {
  path: string;
  label: string;
  keyboard?: "default" | "email-address" | "phone-pad";
  placeholder?: string;
};
const PERSONAL_GROUPS: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  fields: PField[];
}[] = [
  {
    title: "Contact",
    icon: "call-outline",
    fields: [
      {
        path: "personal.personalEmail",
        label: "Personal email",
        keyboard: "email-address" },
      { path: "personal.phone", label: "Phone", keyboard: "phone-pad" },
    ] },
  {
    title: "Personal details",
    icon: "person-outline",
    fields: [
      { path: "personal.legalName", label: "Legal name" },
      {
        path: "personal.birthday",
        label: "Date of birth",
        placeholder: "YYYY-MM-DD" },
      { path: "personal.placeOfBirth", label: "Place of birth" },
      { path: "personal.gender", label: "Gender" },
      { path: "personal.bloodGroup", label: "Blood group" },
      { path: "personal.maritalStatus", label: "Marital status" },
    ] },
  {
    title: "Education",
    icon: "school-outline",
    fields: [
      { path: "personal.education.fieldOfStudy", label: "Field of study" },
    ] },
];

// Composite sections render as a single combined value with an Edit
// icon that opens a modal. The individual sub-fields only live inside
// the modal — the main profile stays uncluttered.
type CompositeField = {
  path: string;
  label: string;
  keyboard?: "default" | "email-address" | "phone-pad";
  placeholder?: string;
};
const ADDRESS_FIELDS: CompositeField[] = [
  { path: "personal.address.street1", label: "Street 1" },
  { path: "personal.address.street2", label: "Street 2" },
  { path: "personal.address.city", label: "City" },
  { path: "personal.address.state", label: "State" },
  {
    path: "personal.address.pinCode",
    label: "PIN code",
    keyboard: "phone-pad" },
  { path: "personal.address.country", label: "Country" },
];
const EMERGENCY_FIELDS: CompositeField[] = [
  { path: "emergencyContact.contactName", label: "Name" },
  { path: "emergencyContact.relationship", label: "Relationship" },
  {
    path: "emergencyContact.phone",
    label: "Phone",
    keyboard: "phone-pad" },
];

// HR-managed — shown read-only on the employee's profile.
const HR_MANAGED: { path: string; label: string }[] = [
  { path: "statutory.pan", label: "PAN" },
  { path: "statutory.uan", label: "UAN" },
  { path: "statutory.pfAccountNumber", label: "PF account" },
  { path: "statutory.esiNumber", label: "ESI number" },
  { path: "bankAccounts.0.bankName", label: "Bank" },
  { path: "bankAccounts.0.accountNumber", label: "Account number" },
  { path: "bankAccounts.0.ifscCode", label: "IFSC code" },
];

const readPath = (obj: any, path: string): string => {
  let n: any = obj;
  for (const p of path.split(".")) n = n == null ? null : n[p];
  return n == null ? "" : String(n);
};

const setPath = (target: any, path: string, value: any): void => {
  const parts = path.split(".");
  let node = target;
  for (let i = 0; i < parts.length - 1; i++) {
    node[parts[i]] = node[parts[i]] || {};
    node = node[parts[i]];
  }
  node[parts[parts.length - 1]] = value;
};

const joinAddress = (profile: any): string => {
  const parts = [
    readPath(profile, "personal.address.street1"),
    readPath(profile, "personal.address.street2"),
    readPath(profile, "personal.address.city"),
    readPath(profile, "personal.address.state"),
    readPath(profile, "personal.address.pinCode"),
    readPath(profile, "personal.address.country"),
  ].filter((p) => p && p.trim().length > 0);
  return parts.join(", ");
};

const joinEmergency = (profile: any): string => {
  const name = readPath(profile, "emergencyContact.contactName");
  const rel = readPath(profile, "emergencyContact.relationship");
  const phone = readPath(profile, "emergencyContact.phone");
  if (!name && !phone) return "";
  const head = [name, rel].filter(Boolean).join(" · ");
  return phone ? (head ? `${head} — ${phone}` : phone) : head;
};

/**
 * Profile screen — identity card, personal info, settings, logout.
 * Hand-styled with themed primitives so it honors light/dark properly.
 */
export default function Profile() {
  const router = useRouter();
  const { theme, preference, setPreference } = useTheme();
  const responsive = useResponsive();
  const spacing = getResponsiveSpacing(responsive.breakpoint);
  const isDesktop = responsive.isDesktop;

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Change-password modal state. All three fields live here; cleared
  // whenever the modal opens or closes so a stale entry never lingers.
  const [showPwModal, setShowPwModal] = useState(false);
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwShow, setPwShow] = useState(false);

  const openPwModal = () => {
    setPwCurrent("");
    setPwNew("");
    setPwConfirm("");
    setPwShow(false);
    setShowPwModal(true);
  };

  const handleChangePassword = async () => {
    if (!pwCurrent || !pwNew || !pwConfirm) {
      notify("Missing fields", "Please fill in all password fields.");
      return;
    }
    if (pwNew.length < 8) {
      notify("Weak password", "New password must be at least 8 characters.");
      return;
    }
    if (pwNew !== pwConfirm) {
      notify("Mismatch", "New password and confirmation do not match.");
      return;
    }
    if (pwNew === pwCurrent) {
      notify("No change", "New password must differ from the current one.");
      return;
    }
    setPwSaving(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        notify("Session expired", "Please sign in again.");
        return;
      }
      await changePassword(token, pwCurrent, pwNew);
      setShowPwModal(false);
      notify("Done", "Your password has been changed.");
    } catch (err: any) {
      notify("Couldn't change password", err?.message || "Please try again.");
    } finally {
      setPwSaving(false);
    }
  };

  // Per-field edit. editingPath is whichever single field the employee
  // is currently filling in; null when nothing is being edited.
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  // Composite editor for multi-part sections (Address, Emergency contact).
  // editingComposite is the title of whichever section's modal is open;
  // compositeDraft holds the per-field strings keyed by their dotted path.
  const [editingComposite, setEditingComposite] = useState<
    null | "address" | "emergency"
  >(null);
  const [compositeDraft, setCompositeDraft] = useState<Record<string, string>>(
    {}
  );
  const [compositeSaving, setCompositeSaving] = useState(false);

  const openCompositeEditor = (
    kind: "address" | "emergency"
  ): void => {
    const fields = kind === "address" ? ADDRESS_FIELDS : EMERGENCY_FIELDS;
    const next: Record<string, string> = {};
    for (const f of fields) {
      next[f.path] = profile ? readPath(profile, f.path) : "";
    }
    setCompositeDraft(next);
    setEditingComposite(kind);
  };

  const saveComposite = async () => {
    if (!editingComposite) return;
    const fields =
      editingComposite === "address" ? ADDRESS_FIELDS : EMERGENCY_FIELDS;
    const payload: any = {};
    for (const f of fields) {
      const v = (compositeDraft[f.path] ?? "").trim();
      if (v) setPath(payload, f.path, v);
    }
    try {
      setCompositeSaving(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const updated = await updateMyProfile(token, payload);
      setProfile(updated);
      setEditingComposite(null);
      setCompositeDraft({});
    } catch (err: any) {
      notify("Save failed", err?.message || "Please try again.");
    } finally {
      setCompositeSaving(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        if (!token) {
          router.replace("/login");
          return;
        }
        const [me, prof] = await Promise.all([
          getMe(token),
          getMyProfile(token).catch(() => null),
        ]);
        if (me) setUser(me);
        if (prof) setProfile(prof);
      } catch (err) {
        console.log("Profile error:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  // Save a single field. The backend rejects writes to non-blank fields,
  // so we only POST the one path the employee just filled in.
  const saveField = async (path: string) => {
    const val = draft.trim();
    if (!val) {
      setEditingPath(null);
      setDraft("");
      return;
    }
    const payload: any = {};
    const parts = path.split(".");
    let node = payload;
    for (let i = 0; i < parts.length - 1; i++) {
      node[parts[i]] = node[parts[i]] || {};
      node = node[parts[i]];
    }
    node[parts[parts.length - 1]] = val;
    try {
      setSaving(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const updated = await updateMyProfile(token, payload);
      setProfile(updated);
      setEditingPath(null);
      setDraft("");
    } catch (err: any) {
      notify("Save failed", err?.message || "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Profile-picture handlers — every user can upload/replace/remove
  // their own. The picker hands us a public URL; we persist it to the
  // user document so the avatar updates everywhere (dashboard, header,
  // etc.) on the next refresh.
  const [photoSaving, setPhotoSaving] = useState(false);
  const onPhotoUploaded = async (url: string) => {
    try {
      setPhotoSaving(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const updated = await updateMyProfilePicture(token, url);
      setProfile((prev) => (prev ? { ...prev, ...updated } : updated));
      setUser((prev) =>
        prev ? { ...prev, profilePictureUrl: url } : prev
      );
    } catch (err: any) {
      notify("Photo save failed", err?.message || "Please try again.");
    } finally {
      setPhotoSaving(false);
    }
  };
  const onPhotoRemove = async () => {
    const ok = await confirmAction({
      title: "Remove photo?",
      message: "Your avatar will show your initial instead.",
      confirmLabel: "Remove",
      destructive: true });
    if (!ok) return;
    try {
      setPhotoSaving(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await updateMyProfilePicture(token, null);
      setProfile((prev) =>
        prev ? { ...prev, profilePictureUrl: undefined } : prev
      );
      setUser((prev) =>
        prev ? { ...prev, profilePictureUrl: undefined } : prev
      );
    } catch (err: any) {
      notify("Remove failed", err?.message || "");
    } finally {
      setPhotoSaving(false);
    }
  };

  const handleLogout = async () => {
    setShowLogoutModal(false);
    try {
      setLoggingOut(true);
      const token = await AsyncStorage.getItem("token");
      if (token) await unregisterPushToken(token).catch(() => {});
      await logoutSession();
      router.replace("/login");
    } catch (err) {
      console.log("Logout error:", err);
    } finally {
      setLoggingOut(false);
    }
  };

  const c = theme.colors;

  const styles = useMemo(() => makeStyles(c, isDesktop), [c, isDesktop]);

  if (loading) {
    return (
      <View style={[styles.loader, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.loader, { backgroundColor: c.bg }]}>
        <Text style={{ color: c.text }}>Could not load profile.</Text>
      </View>
    );
  }

  const isHR = hasRole(user, "HR");
  const ledCount = user.ledTeamIds?.length || 0;
  const memberCount = user.memberOfTeamIds?.length || 0;
  const initial = user.name.charAt(0).toUpperCase();
  const roleTint = roleTints(theme, user.role);

  // Blank editable fields = "pending from HR" the employee can complete.
  // Legal name is excluded — it falls back to the account name (see the
  // PersonalRow render below), so it's never genuinely "pending".
  const pendingCount = profile
    ? PERSONAL_GROUPS.reduce(
        (n, g) =>
          n +
          g.fields.filter(
            (f) =>
              f.path !== "personal.legalName" &&
              readPath(profile, f.path) === ""
          ).length,
        0
      )
    : 0;
  const hrRows = profile
    ? HR_MANAGED.filter((f) => readPath(profile, f.path) !== "")
    : [];

  // Desktop shows sidebar, so we don't need bottom bar padding
  const bottomPadding = responsive.showSidebar ? 40 : BOTTOM_BAR_RESERVED_HEIGHT + 24;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.padding,
          paddingBottom: bottomPadding,
          ...(isDesktop && {
            maxWidth: 800,
            alignSelf: "center" as const,
            width: "100%",
          }),
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ===== HEADER ===== */}
        {isDesktop ? (
          <PageHeader
            title="My Profile"
            subtitle="View and edit your information"
            breadcrumbs={[
              { label: "Home", href: "/" },
              { label: "Profile" },
            ]}
          />
        ) : (
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace("/")
              }
              style={[
                styles.iconBtn,
                {
                  backgroundColor: c.surface,
                  borderColor: c.surfaceBorder,
                },
              ]}
            >
              <Ionicons name="chevron-back" size={22} color={c.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: c.text }]}>
              Profile
            </Text>
            <View style={{ width: 42 }} />
          </View>
        )}

        {/* ===== IDENTITY CARD ===== */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: c.surface,
              borderColor: c.surfaceBorder,
              shadowColor: c.shadow,
              alignItems: "center",
              padding: 24 },
          ]}
        >
          {/* Avatar + photo-edit bubble. Every user can upload their
              own — the bubble sits on the bottom-right of the avatar and
              opens the file picker directly. */}
          <View style={styles.avatarWrap}>
            {user.profilePictureUrl ? (
              <Image
                source={{ uri: user.profilePictureUrl }}
                style={styles.avatarImg}
              />
            ) : (
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: c.accentSoft },
                ]}
              >
                <Text style={[styles.avatarText, { color: c.accentText }]}>
                  {initial}
                </Text>
              </View>
            )}
            <View
              style={[
                styles.avatarCamera,
                { backgroundColor: c.surface, borderColor: c.surfaceBorder },
              ]}
            >
              {photoSaving ? (
                <ActivityIndicator size="small" color={c.accent} />
              ) : (
                <FilePickButton
                  compact
                  mimeType="image/*"
                  style={[
                    styles.avatarCameraBtn,
                    { backgroundColor: c.accent },
                  ]}
                  onUploaded={(url) => onPhotoUploaded(url)}
                />
              )}
            </View>
          </View>
          {user.profilePictureUrl && !photoSaving && (
            <TouchableOpacity
              onPress={onPhotoRemove}
              style={styles.removePhotoBtn}
            >
              <Ionicons
                name="trash-outline"
                size={12}
                color={c.dangerText}
              />
              <Text
                style={[styles.removePhotoText, { color: c.dangerText }]}
              >
                Remove photo
              </Text>
            </TouchableOpacity>
          )}

          <Text style={[styles.name, { color: c.text }]}>{user.name}</Text>
          <Text style={[styles.email, { color: c.textMuted }]}>
            {user.email}
          </Text>

          {/* Only the designation (tag) is shown to the employee — the
              raw role (USER/MANAGER/HR) is HR-internal. TEAM LEAD chip
              stays because it reflects something the employee actively
              does (leads a team), not a permission tier. */}
          <View style={styles.chipsRow}>
            {user.tag && (
              <View
                style={[styles.chip, { backgroundColor: c.pastelSky }]}
              >
                <Text style={[styles.chipText, { color: "#0369a1" }]}>
                  {user.tag}
                </Text>
              </View>
            )}
            {ledCount > 0 && (
              <View
                style={[
                  styles.chip,
                  { backgroundColor: c.pastelMint },
                ]}
              >
                <Text style={[styles.chipText, { color: "#15803d" }]}>
                  TEAM LEAD
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ===== ACCOUNT INFO ===== */}
        <Text style={[styles.section, { color: c.textMuted }]}>
          ACCOUNT
        </Text>
        <View
          style={[
            styles.card,
            {
              backgroundColor: c.surface,
              borderColor: c.surfaceBorder,
              shadowColor: c.shadow,
              padding: 0 },
          ]}
        >
          {user.employeeCode && (
            <InfoRow
              label="Employee code"
              value={user.employeeCode}
              theme={theme}
              showDivider
            />
          )}
          {user.workPhone && (
            <InfoRow
              label="Work phone"
              value={user.workPhone}
              theme={theme}
              showDivider
            />
          )}
          {user.joiningDate && (
            <InfoRow
              label="Joined"
              value={user.joiningDate}
              theme={theme}
              showDivider={ledCount > 0 || memberCount > 0}
            />
          )}
          {ledCount > 0 && (
            <InfoRow
              label="Teams led"
              value={`${ledCount}`}
              theme={theme}
              showDivider={memberCount > 0}
            />
          )}
          {memberCount > 0 && (
            <InfoRow
              label="Team memberships"
              value={`${memberCount}`}
              theme={theme}
              showDivider={false}
            />
          )}
        </View>

        {/* ===== PERSONAL INFORMATION ===== */}
        {profile && (
          <>
            <Text style={[styles.section, { color: c.textMuted }]}>
              PERSONAL INFORMATION
            </Text>

            {pendingCount > 0 && (
              <View style={styles.pendingBanner}>
                <Ionicons name="alert-circle" size={16} color="#b45309" />
                <Text style={styles.pendingBannerText}>
                  {pendingCount} detail{pendingCount > 1 ? "s" : ""} pending —
                  tap Edit next to a field below to fill it in.
                </Text>
              </View>
            )}

            {PERSONAL_GROUPS.map((g) => (
              <View
                key={g.title}
                style={[
                  styles.card,
                  {
                    backgroundColor: c.surface,
                    borderColor: c.surfaceBorder,
                    shadowColor: c.shadow,
                    padding: 0 },
                ]}
              >
                <View style={styles.groupHeader}>
                  <Ionicons name={g.icon} size={15} color={c.textMuted} />
                  <Text style={[styles.groupTitle, { color: c.text }]}>
                    {g.title}
                  </Text>
                </View>
                {g.fields.map((f, i) => (
                  <PersonalRow
                    key={f.path}
                    path={f.path}
                    label={f.label}
                    stored={
                      f.path === "personal.legalName" &&
                      readPath(profile, f.path) === ""
                        ? user.name
                        : readPath(profile, f.path)
                    }
                    editingPath={editingPath}
                    draft={draft}
                    saving={saving}
                    onChange={setDraft}
                    onStartEdit={(p) => { setDraft(""); setEditingPath(p); }}
                    onCancelEdit={() => { setEditingPath(null); setDraft(""); }}
                    onSave={saveField}
                    keyboard={f.keyboard}
                    placeholder={f.placeholder}
                    theme={theme}
                    showDivider={i < g.fields.length - 1}
                  />
                ))}
              </View>
            ))}

            {/* Address — shown as a single combined line. Edit opens a
                modal with the individual sub-fields. */}
            <View
              style={[
                styles.card,
                {
                  backgroundColor: c.surface,
                  borderColor: c.surfaceBorder,
                  shadowColor: c.shadow,
                  padding: 0 },
              ]}
            >
              <View style={styles.groupHeader}>
                <Ionicons name="home-outline" size={15} color={c.textMuted} />
                <Text style={[styles.groupTitle, { color: c.text }]}>
                  Address
                </Text>
              </View>
              <CompositeRow
                value={joinAddress(profile)}
                onEdit={() => openCompositeEditor("address")}
                theme={theme}
              />
            </View>

            {/* Emergency contact — same pattern as Address. */}
            <View
              style={[
                styles.card,
                {
                  backgroundColor: c.surface,
                  borderColor: c.surfaceBorder,
                  shadowColor: c.shadow,
                  padding: 0 },
              ]}
            >
              <View style={styles.groupHeader}>
                <Ionicons
                  name="alert-circle-outline"
                  size={15}
                  color={c.textMuted}
                />
                <Text style={[styles.groupTitle, { color: c.text }]}>
                  Emergency contact
                </Text>
              </View>
              <CompositeRow
                value={joinEmergency(profile)}
                onEdit={() => openCompositeEditor("emergency")}
                theme={theme}
              />
            </View>

            {hrRows.length > 0 && (
              <>
                <Text style={[styles.section, { color: c.textMuted }]}>
                  STATUTORY & BANK
                </Text>
                <View
                  style={[
                    styles.card,
                    {
                      backgroundColor: c.surface,
                      borderColor: c.surfaceBorder,
                      shadowColor: c.shadow,
                      padding: 0 },
                  ]}
                >
                  {hrRows.map((f, i) => (
                    <PersonalRow
                      key={f.path}
                      path={f.path}
                      label={f.label}
                      stored={readPath(profile, f.path)}
                      editingPath={null}
                      draft=""
                      saving={false}
                      onChange={() => {}}
                      onStartEdit={() => {}}
                      onCancelEdit={() => {}}
                      onSave={() => {}}
                      theme={theme}
                      showDivider={i < hrRows.length - 1}
                    />
                  ))}
                  <Text style={styles.hrHint}>Managed by HR</Text>
                </View>
              </>
            )}
          </>
        )}

        {/* ===== QUICK LINKS ===== */}
        <Text style={[styles.section, { color: c.textMuted }]}>
          MY ACCOUNT
        </Text>
        <View
          style={[
            styles.card,
            {
              backgroundColor: c.surface,
              borderColor: c.surfaceBorder,
              shadowColor: c.shadow,
              padding: 0 },
          ]}
        >
          <LinkRow
            icon="folder-open-outline"
            tint={c.pastelLavender}
            iconColor="#6d28d9"
            label="My documents"
            onPress={() => router.push("/my-documents" as any)}
            theme={theme}
            showDivider
          />
          <LinkRow
            icon="cash-outline"
            tint={c.pastelMint}
            iconColor="#15803d"
            label="My payslips"
            onPress={() => router.push("/my-payroll" as any)}
            theme={theme}
            showDivider
          />
          <LinkRow
            icon="airplane-outline"
            tint={c.pastelPeach}
            iconColor="#c2410c"
            label="My leaves"
            onPress={() => router.push("/leaves")}
            theme={theme}
            showDivider={!isHR}
          />
          {isHR && (
            <LinkRow
              icon="briefcase-outline"
              tint={c.roleHrBg}
              iconColor={c.roleHrText}
              label="HR Admin Console"
              onPress={() => router.push("/hr-admin")}
              theme={theme}
              showDivider={false}
            />
          )}
        </View>

        {/* ===== SECURITY ===== */}
        <Text style={[styles.section, { color: c.textMuted }]}>
          SECURITY
        </Text>
        <View
          style={[
            styles.card,
            {
              backgroundColor: c.surface,
              borderColor: c.surfaceBorder,
              shadowColor: c.shadow,
              padding: 0 },
          ]}
        >
          <LinkRow
            icon="lock-closed-outline"
            tint={c.pastelPink}
            iconColor="#be185d"
            label="Change password"
            onPress={openPwModal}
            theme={theme}
            showDivider={false}
          />
        </View>

        {/* ===== APPEARANCE ===== */}
        {/* Hidden on web — desktop is light-only (dark mode disabled). */}
        {Platform.OS !== "web" && (
        <>
        <Text style={[styles.section, { color: c.textMuted }]}>
          APPEARANCE
        </Text>
        <View
          style={[
            styles.card,
            {
              backgroundColor: c.surface,
              borderColor: c.surfaceBorder,
              shadowColor: c.shadow },
          ]}
        >
          <Text
            style={{
              color: c.textMuted,
              fontSize: 12,
              marginBottom: 10 }}
          >
            Theme
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["light", "dark", "system"] as ThemePreference[]).map((p) => {
              const active = preference === p;
              const icon =
                p === "light"
                  ? "sunny-outline"
                  : p === "dark"
                  ? "moon-outline"
                  : "phone-portrait-outline";
              return (
                <TouchableOpacity
                  key={p}
                  onPress={() => setPreference(p)}
                  activeOpacity={0.8}
                  style={[
                    styles.themeBtn,
                    {
                      backgroundColor: active
                        ? c.accentSoft
                        : c.surfaceMuted,
                      borderColor: active ? c.accent : c.surfaceBorder },
                  ]}
                >
                  <Ionicons
                    name={icon as any}
                    size={20}
                    color={active ? c.accent : c.textMuted}
                  />
                  <Text
                    style={{
                      color: active ? c.accent : c.textMuted,
                      fontWeight: "700",
                      fontSize: 12,
                      marginTop: 4,
                      textTransform: "capitalize" }}
                  >
                    {p}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        </>
        )}

        {/* ===== LOGOUT ===== */}
        <TouchableOpacity
          style={[
            styles.logoutBtn,
            {
              backgroundColor: c.dangerBg,
              borderColor: c.dangerText },
          ]}
          onPress={() => setShowLogoutModal(true)}
          disabled={loggingOut}
          activeOpacity={0.85}
        >
          {loggingOut ? (
            <ActivityIndicator color={c.dangerText} />
          ) : (
            <>
              <Ionicons
                name="log-out-outline"
                size={20}
                color={c.dangerText}
              />
              <Text style={[styles.logoutText, { color: c.dangerText }]}>
                Sign out
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Composite editor modal — used for Address and Emergency contact.
          The per-sub-field inputs only live here so the main profile
          shows just a single line for each section. */}
      <WebModal
        visible={editingComposite !== null}
        onClose={() => setEditingComposite(null)}
        title={
          editingComposite === "address"
            ? "Edit address"
            : "Edit emergency contact"
        }
        size="sm"
        footer={
          <ModalActions align="spread">
            <TouchableOpacity
              style={[
                styles.compModalBtn,
                { backgroundColor: c.surfaceMuted },
              ]}
              onPress={() => setEditingComposite(null)}
              disabled={compositeSaving}
            >
              <Text
                style={{ color: c.text, fontWeight: "700", fontSize: 13 }}
              >
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.compModalBtn,
                { backgroundColor: c.accent },
              ]}
              onPress={saveComposite}
              disabled={compositeSaving}
            >
              {compositeSaving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text
                  style={{
                    color: "#fff",
                    fontWeight: "800",
                    fontSize: 13 }}
                >
                  Save
                </Text>
              )}
            </TouchableOpacity>
          </ModalActions>
        }
      >
        {(editingComposite === "address"
          ? ADDRESS_FIELDS
          : EMERGENCY_FIELDS
        ).map((f) => (
          <View key={f.path} style={{ marginTop: 12 }}>
            <Text
              style={{
                color: c.textMuted,
                fontSize: 11,
                fontWeight: "700",
                marginBottom: 5 }}
            >
              {f.label}
            </Text>
            <TextInput
              value={compositeDraft[f.path] ?? ""}
              onChangeText={(v) =>
                setCompositeDraft((prev) => ({
                  ...prev,
                  [f.path]: v }))
              }
              placeholder={f.placeholder || f.label}
              placeholderTextColor={c.textFaint}
              keyboardType={f.keyboard || "default"}
              editable={!compositeSaving}
              style={{
                backgroundColor: c.surfaceMuted,
                color: c.text,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: c.surfaceBorder,
                paddingHorizontal: 12,
                paddingVertical: 9,
                fontSize: 14 }}
            />
          </View>
        ))}
      </WebModal>

      {/* Sign-out confirmation — themed card replacing the browser's
          default confirm dialog (which looked dated on web). */}
      <WebModal
        visible={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        size="sm"
        showCloseButton={false}
        footer={
          <ModalActions align="spread">
            <TouchableOpacity
              style={[
                styles.logoutModalBtn,
                { backgroundColor: c.surfaceMuted },
              ]}
              onPress={() => setShowLogoutModal(false)}
            >
              <Text style={{ color: c.text, fontWeight: "700", fontSize: 14 }}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.logoutModalBtn,
                { backgroundColor: c.dangerText },
              ]}
              onPress={handleLogout}
            >
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>
                Sign out
              </Text>
            </TouchableOpacity>
          </ModalActions>
        }
      >
        <View style={{ alignItems: "center" }}>
          <View
            style={[
              styles.logoutModalIcon,
              { backgroundColor: c.dangerBg },
            ]}
          >
            <Ionicons name="log-out-outline" size={26} color={c.dangerText} />
          </View>
          <Text style={[styles.logoutModalTitle, { color: c.text }]}>
            Sign out?
          </Text>
          <Text style={[styles.logoutModalSub, { color: c.textMuted }]}>
            You&apos;ll need to enter your credentials again to come back.
          </Text>
        </View>
      </WebModal>

      {/* Change-password modal — verifies the current password before
          setting a new one. Available to every signed-in user. */}
      <WebModal
        visible={showPwModal}
        onClose={() => (pwSaving ? null : setShowPwModal(false))}
        size="sm"
        title="Change password"
        footer={
          <ModalActions align="spread">
            <TouchableOpacity
              style={[
                styles.logoutModalBtn,
                { backgroundColor: c.surfaceMuted },
              ]}
              onPress={() => setShowPwModal(false)}
              disabled={pwSaving}
            >
              <Text style={{ color: c.text, fontWeight: "700", fontSize: 14 }}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.logoutModalBtn,
                { backgroundColor: c.accent, opacity: pwSaving ? 0.6 : 1 },
              ]}
              onPress={handleChangePassword}
              disabled={pwSaving}
            >
              {pwSaving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 14 }}>
                  Update
                </Text>
              )}
            </TouchableOpacity>
          </ModalActions>
        }
      >
        <View>
          {[
            {
              key: "current",
              label: "Current password",
              value: pwCurrent,
              set: setPwCurrent,
            },
            {
              key: "new",
              label: "New password (min 8 characters)",
              value: pwNew,
              set: setPwNew,
            },
            {
              key: "confirm",
              label: "Confirm new password",
              value: pwConfirm,
              set: setPwConfirm,
            },
          ].map((f) => (
            <View key={f.key} style={{ marginTop: 12 }}>
              <Text
                style={{
                  color: c.textMuted,
                  fontSize: 11,
                  fontWeight: "700",
                  marginBottom: 5,
                }}
              >
                {f.label}
              </Text>
              <TextInput
                value={f.value}
                onChangeText={f.set}
                placeholder={f.label}
                placeholderTextColor={c.textFaint}
                secureTextEntry={!pwShow}
                autoCapitalize="none"
                editable={!pwSaving}
                style={{
                  backgroundColor: c.surfaceMuted,
                  color: c.text,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: c.surfaceBorder,
                  paddingHorizontal: 12,
                  paddingVertical: 9,
                  fontSize: 14,
                }}
              />
            </View>
          ))}
          <TouchableOpacity
            onPress={() => setPwShow((s) => !s)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              marginTop: 12,
            }}
          >
            <Ionicons
              name={pwShow ? "eye-off-outline" : "eye-outline"}
              size={16}
              color={c.textMuted}
            />
            <Text style={{ color: c.textMuted, fontSize: 13, fontWeight: "600" }}>
              {pwShow ? "Hide passwords" : "Show passwords"}
            </Text>
          </TouchableOpacity>
        </View>
      </WebModal>

      <BottomTabBar user={user} />
    </SafeAreaView>
  );
}

// Single-line display of a composite section with an Edit pill that
// opens the editor modal. "Not set" placeholder when empty.
const CompositeRow = ({
  value,
  onEdit,
  theme }: {
  value: string;
  onEdit: () => void;
  theme: any;
}) => {
  const c = theme.colors;
  const blank = !value;
  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingVertical: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 10 }}
    >
      <Text
        style={{
          flex: 1,
          color: blank ? c.textFaint : c.text,
          fontSize: 14,
          fontWeight: blank ? "400" : "600" }}
        numberOfLines={3}
      >
        {blank ? "Not set" : value}
      </Text>
      <TouchableOpacity
        onPress={onEdit}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          borderWidth: 1,
          borderColor: c.accent,
          borderRadius: 999,
          paddingHorizontal: 10,
          paddingVertical: 5 }}
      >
        <Ionicons name="create-outline" size={12} color={c.accent} />
        <Text style={{ color: c.accent, fontSize: 11, fontWeight: "800" }}>
          Edit
        </Text>
      </TouchableOpacity>
    </View>
  );
};

// =============================================================
// Helpers
// =============================================================

const roleTints = (theme: any, role: string) => {
  if (role === "HR") {
    return { bg: theme.colors.roleHrBg, fg: theme.colors.roleHrText };
  }
  if (role === "CEO") {
    return { bg: theme.colors.roleCeoBg, fg: theme.colors.roleCeoText };
  }
  if (role === "MANAGER") {
    return {
      bg: theme.colors.roleManagerBg,
      fg: theme.colors.roleManagerText };
  }
  return { bg: theme.colors.accentSoft, fg: theme.colors.accentText };
};

const InfoRow = ({
  label,
  value,
  theme,
  showDivider }: {
  label: string;
  value: string;
  theme: any;
  showDivider: boolean;
}) => (
  <View
    style={{
      paddingHorizontal: 18,
      paddingVertical: 14,
      borderBottomWidth: showDivider ? 1 : 0,
      borderBottomColor: theme.colors.surfaceBorder,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center" }}
  >
    <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>
      {label}
    </Text>
    <Text
      style={{
        color: theme.colors.text,
        fontSize: 14,
        fontWeight: "700" }}
      numberOfLines={1}
    >
      {value}
    </Text>
  </View>
);

// Stacked label/value row with PER-FIELD editing. A row is in one of
// three modes:
//   filled   → read-only value (HR-set values stay locked for the employee)
//   blank    → "Not set" + small Edit pill on the right
//   editing  → input + Cancel/Save (only one row can be in this mode at a
//              time; tapping Edit on another row drops any unsaved draft).
const PersonalRow = ({
  path,
  label,
  stored,
  editingPath,
  draft,
  saving,
  onChange,
  onStartEdit,
  onCancelEdit,
  onSave,
  keyboard,
  placeholder,
  theme,
  showDivider }: {
  path: string;
  label: string;
  stored: string;
  editingPath: string | null;
  draft: string;
  saving: boolean;
  onChange: (v: string) => void;
  onStartEdit: (path: string) => void;
  onCancelEdit: () => void;
  onSave: (path: string) => void;
  keyboard?: "default" | "email-address" | "phone-pad";
  placeholder?: string;
  theme: any;
  showDivider: boolean;
}) => {
  const c = theme.colors;
  const blank = stored === "";
  const isEditing = editingPath === path;
  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingVertical: 11,
        borderBottomWidth: showDivider ? 1 : 0,
        borderBottomColor: c.surfaceBorder }}
    >
      <Text
        style={{
          color: isEditing ? c.accent : c.textMuted,
          fontSize: 11,
          fontWeight: "700",
          marginBottom: isEditing ? 6 : 3 }}
      >
        {label}
        {isEditing ? "  · editing" : blank ? "  · pending" : ""}
      </Text>

      {isEditing ? (
        <View>
          <TextInput
            value={draft}
            onChangeText={onChange}
            placeholder={placeholder || `Enter ${label.toLowerCase()}`}
            placeholderTextColor={c.textFaint}
            keyboardType={keyboard || "default"}
            autoCapitalize={keyboard === "email-address" ? "none" : "sentences"}
            autoFocus
            editable={!saving}
            style={{
              backgroundColor: c.surfaceMuted,
              color: c.text,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: c.surfaceBorder,
              paddingHorizontal: 12,
              paddingVertical: 9,
              fontSize: 14 }}
          />
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <TouchableOpacity
              onPress={onCancelEdit}
              disabled={saving}
              style={{
                flex: 1,
                paddingVertical: 9,
                borderRadius: 10,
                alignItems: "center",
                backgroundColor: c.surfaceMuted }}
            >
              <Text style={{ color: c.text, fontWeight: "700", fontSize: 13 }}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onSave(path)}
              disabled={saving}
              style={{
                flex: 1,
                paddingVertical: 9,
                borderRadius: 10,
                alignItems: "center",
                backgroundColor: c.accent }}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={{ color: "#fff", fontWeight: "800", fontSize: 13 }}>
                  Save
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : blank ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between" }}
        >
          <Text style={{ color: c.textFaint, fontSize: 14 }}>Not set</Text>
          <TouchableOpacity
            onPress={() => onStartEdit(path)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              borderWidth: 1,
              borderColor: c.accent,
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 4 }}
          >
            <Ionicons name="create-outline" size={12} color={c.accent} />
            <Text style={{ color: c.accent, fontSize: 11, fontWeight: "800" }}>
              Edit
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={{ color: c.text, fontSize: 14, fontWeight: "600" }}>
          {stored}
        </Text>
      )}
    </View>
  );
};

const LinkRow = ({
  icon,
  tint,
  iconColor,
  label,
  onPress,
  theme,
  showDivider }: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  iconColor: string;
  label: string;
  onPress: () => void;
  theme: any;
  showDivider: boolean;
}) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.85}
    style={{
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 18,
      paddingVertical: 14,
      borderBottomWidth: showDivider ? 1 : 0,
      borderBottomColor: theme.colors.surfaceBorder }}
  >
    <View
      style={{
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: tint,
        alignItems: "center",
        justifyContent: "center" }}
    >
      <Ionicons name={icon} size={18} color={iconColor} />
    </View>
    <Text
      style={{
        flex: 1,
        color: theme.colors.text,
        fontSize: 15,
        fontWeight: "700" }}
    >
      {label}
    </Text>
    <Ionicons
      name="chevron-forward"
      size={18}
      color={theme.colors.textMuted}
    />
  </TouchableOpacity>
);

const makeStyles = (c: any, isDesktop: boolean) =>
  StyleSheet.create({
    safe: { flex: 1 },
    loader: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: isDesktop ? 24 : 16,
    },
    iconBtn: {
      width: 42,
      height: 42,
      borderRadius: 14,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      flex: 1,
      fontSize: isDesktop ? 20 : 18,
      fontWeight: "800",
      textAlign: "center",
      letterSpacing: 0.3,
    },
    card: {
      borderRadius: 20,
      borderWidth: 1,
      padding: isDesktop ? 22 : 18,
      marginTop: isDesktop ? 14 : 10,
      shadowOpacity: 1,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
      ...(Platform.OS === "web" && {
        transition: "all 0.15s ease" as any,
      }),
    },
    avatarWrap: {
      position: "relative",
      width: isDesktop ? 100 : 84,
      height: isDesktop ? 100 : 84,
      marginBottom: isDesktop ? 18 : 14,
    },
    avatar: {
      width: isDesktop ? 100 : 84,
      height: isDesktop ? 100 : 84,
      borderRadius: isDesktop ? 50 : 42,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarImg: {
      width: isDesktop ? 100 : 84,
      height: isDesktop ? 100 : 84,
      borderRadius: isDesktop ? 50 : 42,
    },
    avatarText: { fontSize: isDesktop ? 36 : 30, fontWeight: "800" },
    avatarCamera: {
      position: "absolute",
      right: -4,
      bottom: -4,
      borderRadius: 16,
      padding: 2,
      borderWidth: 1,
    },
    avatarCameraBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
    },
    removePhotoBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      marginBottom: 12,
      marginTop: -4,
    },
    removePhotoText: { fontSize: 11, fontWeight: "700" },
    name: { fontSize: isDesktop ? 26 : 22, fontWeight: "800", marginBottom: 4 },
    email: { fontSize: isDesktop ? 15 : 14, marginBottom: isDesktop ? 16 : 12 },
    chipsRow: {
      flexDirection: "row",
      gap: 6,
      flexWrap: "wrap",
      justifyContent: "center",
    },
    chip: {
      paddingHorizontal: isDesktop ? 12 : 10,
      paddingVertical: isDesktop ? 6 : 5,
      borderRadius: 999,
    },
    chipText: { fontSize: isDesktop ? 11 : 10, fontWeight: "800", letterSpacing: 0.5 },
    section: {
      fontSize: isDesktop ? 12 : 11,
      fontWeight: "800",
      letterSpacing: 1.4,
      marginTop: isDesktop ? 28 : 22,
      marginBottom: isDesktop ? 10 : 8,
      marginLeft: 4,
    },
    themeBtn: {
      flex: 1,
      paddingVertical: isDesktop ? 16 : 14,
      borderRadius: 14,
      borderWidth: 1,
      alignItems: "center",
      ...(Platform.OS === "web" && {
        cursor: "pointer" as any,
        transition: "all 0.15s ease" as any,
      }),
    },
    logoutBtn: {
      marginTop: isDesktop ? 28 : 22,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: isDesktop ? 16 : 14,
      borderRadius: 14,
      borderWidth: 1,
      ...(Platform.OS === "web" && {
        cursor: "pointer" as any,
        transition: "all 0.15s ease" as any,
      }),
    },
    logoutText: { fontSize: isDesktop ? 15 : 14, fontWeight: "800" },
    personalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: isDesktop ? 28 : 22,
      marginBottom: isDesktop ? 10 : 8,
    },
    editBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 5,
    },
    editBtnText: { fontSize: 12, fontWeight: "800" },
    pendingBanner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: "rgba(245,158,11,0.12)",
      borderColor: "rgba(245,158,11,0.4)",
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: isDesktop ? 16 : 12,
      paddingVertical: isDesktop ? 12 : 10,
    },
    pendingBannerText: {
      color: "#b45309",
      fontSize: isDesktop ? 13 : 12.5,
      fontWeight: "700",
      flex: 1,
    },
    groupHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      paddingHorizontal: isDesktop ? 18 : 16,
      paddingTop: isDesktop ? 16 : 14,
      paddingBottom: 6,
    },
    groupTitle: { fontSize: isDesktop ? 13 : 12, fontWeight: "800", letterSpacing: 0.4 },
    editActions: { flexDirection: "row", gap: 10, marginTop: 12 },
    editAction: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 12,
      alignItems: "center",
    },
    hrHint: {
      color: c.textFaint,
      fontSize: 11,
      fontStyle: "italic",
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    compModalWrap: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: c.overlay,
      paddingHorizontal: 18,
    },
    compModalCard: {
      width: "100%",
      maxWidth: isDesktop ? 500 : 440,
      borderRadius: 16,
      padding: isDesktop ? 24 : 18,
      borderWidth: 1,
    },
    compModalTitle: { fontSize: isDesktop ? 18 : 16, fontWeight: "800" },
    compModalActions: {
      flexDirection: "row",
      gap: 10,
      marginTop: isDesktop ? 20 : 16,
    },
    compModalBtn: {
      flex: 1,
      paddingVertical: isDesktop ? 14 : 12,
      borderRadius: 12,
      alignItems: "center",
      ...(Platform.OS === "web" && {
        cursor: "pointer" as any,
      }),
    },

    logoutModalWrap: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: c.overlay,
      paddingHorizontal: 28,
    },
    logoutModalCard: {
      width: "100%",
      maxWidth: isDesktop ? 400 : 360,
      borderRadius: 20,
      borderWidth: 1,
      padding: isDesktop ? 28 : 22,
      alignItems: "center",
    },
    logoutModalIcon: {
      width: isDesktop ? 64 : 56,
      height: isDesktop ? 64 : 56,
      borderRadius: isDesktop ? 32 : 28,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: isDesktop ? 18 : 14,
    },
    logoutModalTitle: { fontSize: isDesktop ? 20 : 18, fontWeight: "800", marginBottom: 6 },
    logoutModalSub: {
      fontSize: isDesktop ? 14 : 13,
      lineHeight: 20,
      textAlign: "center",
      marginBottom: isDesktop ? 24 : 20,
    },
    logoutModalActions: {
      flexDirection: "row",
      gap: 10,
      width: "100%",
    },
    logoutModalBtn: {
      flex: 1,
      paddingVertical: isDesktop ? 14 : 13,
      borderRadius: 12,
      alignItems: "center",
      ...(Platform.OS === "web" && {
        cursor: "pointer" as any,
      }),
    },
  });
