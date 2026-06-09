import React, { useEffect, useMemo, useState } from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  Platform } from "react-native";
import { KeyboardAvoidingView, KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useRouter } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import {
  listUsers,
  createUser,
  updateUser } from "../src/services/users";

import { hrListAssets } from "../src/services/assets";

import {
  addUserDocument,
  DOC_CATEGORIES } from "../src/services/documents";

import { FilePickButton } from "../src/components/FilePickButton";
import { DatePickerField } from "../src/components/DatePickerField";

import {
  User,
  UserStatus,
  USER_STATUSES,
  Asset } from "../src/types";

import { useTheme } from "../src/theme/ThemeProvider";
import { getMe } from "../src/services/api";
import {
  BottomTabBar,
  BOTTOM_BAR_RESERVED_HEIGHT } from "../src/components/BottomTabBar";
import { confirmAction, notify } from "../src/utils/confirm";

interface StagedDoc {
  category: string;
  fileName: string;
  fileUrl: string;
}

/**
 * Employees list — Koru-style card grid. Tabs (Active / Not Active),
 * search, big create button. Profile / terminate inline.
 */
export default function Users() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [me, setMe] = useState<User | null>(null);

  // Create modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [tag, setTag] = useState<string>("Employee");
  const [employeeCode, setEmployeeCode] = useState("");
  const [workPhone, setWorkPhone] = useState("");
  const [status, setStatus] = useState<UserStatus>("Active");
  const [joiningDate, setJoiningDate] = useState<string>("");
  const [availableAssets, setAvailableAssets] = useState<Asset[]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [stagedDocs, setStagedDocs] = useState<StagedDoc[]>([]);
  const [docCategory, setDocCategory] = useState<string>(
    DOC_CATEGORIES[0]
  );
  const [saving, setSaving] = useState(false);

  // Terminate modal state
  const [terminateModalVisible, setTerminateModalVisible] = useState(false);
  const [terminateTarget, setTerminateTarget] = useState<User | null>(null);
  const [terminateReason, setTerminateReason] = useState("");
  const [terminating, setTerminating] = useState(false);

  const load = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const [list, meRes] = await Promise.all([
        listUsers(token),
        getMe(token).catch(() => null),
      ]);
      setUsers(list || []);
      setMe(meRes);
    } catch (err: any) {
      notify("Couldn't load employees", err?.message || "");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users
      .filter((u) =>
        tab === "ACTIVE" ? u.status !== "Terminated" : u.status === "Terminated"
      )
      .filter((u) => {
        if (!q) return true;
        return (
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.employeeCode || "").toLowerCase().includes(q) ||
          (u.tag || "").toLowerCase().includes(q)
        );
      });
  }, [users, tab, search]);

  const activeCount = users.filter(
    (u) => u.status !== "Terminated"
  ).length;
  const inactiveCount = users.filter(
    (u) => u.status === "Terminated"
  ).length;

  const openCreate = () => {
    setName("");
    setEmail("");
    setPassword("");
    setShowPassword(false);
    setTag("Employee");
    setEmployeeCode("");
    setWorkPhone("");
    setStatus("Active");
    setJoiningDate("");
    setSelectedAssetIds([]);
    setStagedDocs([]);
    setDocCategory(DOC_CATEGORIES[0]);
    setModalVisible(true);
    (async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        if (!token) return;
        const list = await hrListAssets(token, { status: "AVAILABLE" });
        setAvailableAssets(list || []);
      } catch {
        setAvailableAssets([]);
      }
    })();
  };

  const saveNew = async () => {
    if (saving) return;
    if (!name.trim()) return notify("Name required");
    if (!email.trim()) return notify("Email required");
    if (password.length < 6)
      return notify("Password must be at least 6 characters");
    try {
      setSaving(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const res = await createUser(token, {
        name: name.trim(),
        email: email.trim(),
        password,
        tag,
        employeeCode: employeeCode.trim() || undefined,
        workPhone: workPhone.trim() || undefined,
        joiningDate: joiningDate || undefined,
        status,
        initialAssetIds:
          selectedAssetIds.length > 0 ? selectedAssetIds : undefined });
      // Upload staged docs.
      for (const d of stagedDocs) {
        await addUserDocument(token, res.id, d).catch(() => {});
      }
      setModalVisible(false);
      notify(
        "Employee created",
        `Email: ${email}${
          res.employeeCode ? `\nCode: ${res.employeeCode}` : ""
        }`
      );
      router.push({
        pathname: "/hr-user-profile" as any,
        params: { id: res.id } });
      await load();
    } catch (err: any) {
      notify("Couldn't create", err?.message || "");
    } finally {
      setSaving(false);
    }
  };

  const askTerminate = async (u: User) => {
    if (u.status === "Terminated") {
      const ok = await confirmAction({
        title: "Reactivate user?",
        message: `${u.name} is currently NOT ACTIVE. Set status back to Active?`,
        confirmLabel: "Reactivate" });
      if (ok) await doSetStatus(u, "Active");
      return;
    }
    setTerminateTarget(u);
    setTerminateReason("");
    setTerminateModalVisible(true);
  };

  const confirmTerminate = async () => {
    if (terminating || !terminateTarget) return;
    if (!terminateReason.trim()) return notify("Reason is required");
    try {
      setTerminating(true);
      await doSetStatus(
        terminateTarget,
        "Terminated",
        terminateReason.trim()
      );
      setTerminateModalVisible(false);
      setTerminateTarget(null);
      setTerminateReason("");
    } finally {
      setTerminating(false);
    }
  };

  const doSetStatus = async (
    u: User,
    next: UserStatus,
    reason?: string
  ) => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const payload: any = { status: next };
      if (next === "Terminated" && reason) {
        payload.terminationReason = reason;
      }
      await updateUser(token, u.id, payload);
      await load();
    } catch (err: any) {
      notify("Failed", err?.message || "");
    }
  };

  if (loading) {
    return (
      <View style={[styles.loader, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]}>
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: BOTTOM_BAR_RESERVED_HEIGHT + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/")
            }
            style={[
              styles.iconBtn,
              {
                backgroundColor: c.surface,
                borderColor: c.surfaceBorder },
            ]}
          >
            <Ionicons name="chevron-back" size={22} color={c.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.title, { color: c.text }]}>
              Employees
            </Text>
            <Text style={[styles.subtitle, { color: c.textMuted }]}>
              {activeCount} active
            </Text>
          </View>
          <TouchableOpacity
            onPress={openCreate}
            style={[
              styles.addBtn,
              {
                backgroundColor: c.accent,
                shadowColor: c.shadow },
            ]}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* TABS */}
        <View style={styles.tabsRow}>
          <TouchableOpacity
            onPress={() => setTab("ACTIVE")}
            activeOpacity={0.85}
            style={[
              styles.tabBtn,
              {
                backgroundColor:
                  tab === "ACTIVE" ? c.accentSoft : c.surfaceMuted,
                borderColor:
                  tab === "ACTIVE" ? c.accent : c.surfaceBorder },
            ]}
          >
            <Text
              style={{
                color: tab === "ACTIVE" ? c.accent : c.textMuted,
                fontWeight: "800",
                fontSize: 13 }}
            >
              Active · {activeCount}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setTab("INACTIVE")}
            activeOpacity={0.85}
            style={[
              styles.tabBtn,
              {
                backgroundColor:
                  tab === "INACTIVE" ? c.accentSoft : c.surfaceMuted,
                borderColor:
                  tab === "INACTIVE" ? c.accent : c.surfaceBorder },
            ]}
          >
            <Text
              style={{
                color: tab === "INACTIVE" ? c.accent : c.textMuted,
                fontWeight: "800",
                fontSize: 13 }}
            >
              Not Active · {inactiveCount}
            </Text>
          </TouchableOpacity>
        </View>

        {/* SEARCH */}
        <View
          style={[
            styles.searchBox,
            {
              backgroundColor: c.surface,
              borderColor: c.surfaceBorder },
          ]}
        >
          <Ionicons name="search" size={18} color={c.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: c.text }]}
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name, email, or code"
            placeholderTextColor={c.textFaint}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
              <Ionicons
                name="close-circle"
                size={18}
                color={c.textMuted}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* LIST */}
        {filteredUsers.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: c.surface,
                borderColor: c.surfaceBorder,
                shadowColor: c.shadow },
            ]}
          >
            <Ionicons
              name={
                tab === "ACTIVE"
                  ? "people-outline"
                  : "person-remove-outline"
              }
              size={32}
              color={c.textMuted}
            />
            <Text style={[styles.emptyText, { color: c.text }]}>
              {search
                ? "No matching employees"
                : tab === "ACTIVE"
                ? "No active employees yet"
                : "No terminated employees"}
            </Text>
            {!search && tab === "ACTIVE" && (
              <Text style={[styles.emptySub, { color: c.textMuted }]}>
                Tap + to create your first employee.
              </Text>
            )}
          </View>
        ) : (
          filteredUsers.map((u) => (
            <UserCard
              key={u.id}
              user={u}
              onPress={() =>
                router.push(`/hr-user-profile?id=${u.id}` as any)
              }
              onTerminate={() => askTerminate(u)}
              theme={theme}
            />
          ))
        )}
      </ScrollView>

      {/* CREATE MODAL */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={[styles.modalScrim, { backgroundColor: c.overlay }]}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: c.surface, shadowColor: c.shadow },
            ]}
          >
            <KeyboardAwareScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              bottomOffset={24}
            >
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: c.text }]}>
                  New employee
                </Text>
                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={22} color={c.textMuted} />
                </TouchableOpacity>
              </View>

              <Field label="NAME" theme={theme}>
                <Input
                  value={name}
                  onChangeText={setName}
                  placeholder="Full name"
                  theme={theme}
                />
              </Field>
              <Field label="EMAIL" theme={theme}>
                <Input
                  value={email}
                  onChangeText={setEmail}
                  placeholder="user@example.com"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  theme={theme}
                />
              </Field>
              <Field label="PASSWORD" theme={theme}>
                <View style={{ position: "relative" }}>
                  <Input
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Min 6 characters"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    theme={theme}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword((v) => !v)}
                    style={styles.eyeBtn}
                    hitSlop={8}
                  >
                    <Ionicons
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={20}
                      color={c.textMuted}
                    />
                  </TouchableOpacity>
                </View>
              </Field>

              <Field label="DESIGNATION" theme={theme}>
                <Input
                  value={tag}
                  onChangeText={setTag}
                  placeholder="e.g. Senior Engineer"
                  theme={theme}
                />
              </Field>

              <Field
                label="EMPLOYEE CODE (optional)"
                theme={theme}
              >
                <Input
                  value={employeeCode}
                  onChangeText={setEmployeeCode}
                  placeholder="Leave blank to auto-generate"
                  theme={theme}
                />
              </Field>

              <Field label="WORK PHONE" theme={theme}>
                <Input
                  value={workPhone}
                  onChangeText={setWorkPhone}
                  placeholder="+91…"
                  keyboardType="phone-pad"
                  theme={theme}
                />
              </Field>

              <Field label="JOINING DATE" theme={theme}>
                <DatePickerField
                  value={joiningDate}
                  onChange={setJoiningDate}
                />
              </Field>

              <Field label="STATUS" theme={theme}>
                <View style={styles.chipsRow}>
                  {USER_STATUSES.map((s) => {
                    const active = status === s;
                    return (
                      <TouchableOpacity
                        key={s}
                        onPress={() => setStatus(s)}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: active
                              ? c.accentSoft
                              : c.surfaceMuted,
                            borderColor: active
                              ? c.accent
                              : c.surfaceBorder },
                        ]}
                      >
                        <Text
                          style={{
                            color: active ? c.accent : c.textMuted,
                            fontSize: 12,
                            fontWeight: "700" }}
                        >
                          {s === "Terminated" ? "Not Active" : s}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Field>

              {availableAssets.length > 0 && (
                <Field
                  label="ASSIGN ASSETS (optional)"
                  theme={theme}
                >
                  <View style={styles.chipsRow}>
                    {availableAssets.map((a) => {
                      const picked = selectedAssetIds.includes(a.id);
                      return (
                        <TouchableOpacity
                          key={a.id}
                          onPress={() =>
                            setSelectedAssetIds((prev) =>
                              picked
                                ? prev.filter((x) => x !== a.id)
                                : [...prev, a.id]
                            )
                          }
                          style={[
                            styles.chip,
                            {
                              backgroundColor: picked
                                ? c.accentSoft
                                : c.surfaceMuted,
                              borderColor: picked
                                ? c.accent
                                : c.surfaceBorder },
                          ]}
                        >
                          <Text
                            style={{
                              color: picked ? c.accent : c.textMuted,
                              fontSize: 12,
                              fontWeight: "700" }}
                          >
                            {a.code} · {a.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </Field>
              )}

              <Field label="DOCUMENTS (optional)" theme={theme}>
                <View style={styles.chipsRow}>
                  {DOC_CATEGORIES.map((cat) => {
                    const active = docCategory === cat;
                    return (
                      <TouchableOpacity
                        key={cat}
                        onPress={() => setDocCategory(cat)}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: active
                              ? c.accentSoft
                              : c.surfaceMuted,
                            borderColor: active
                              ? c.accent
                              : c.surfaceBorder },
                        ]}
                      >
                        <Text
                          style={{
                            color: active ? c.accent : c.textMuted,
                            fontSize: 12,
                            fontWeight: "700" }}
                        >
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={{ marginTop: 10 }}>
                  <FilePickButton
                    label={`Upload ${docCategory}`}
                    onUploaded={(url, fileName) =>
                      setStagedDocs((prev) => [
                        ...prev,
                        { category: docCategory, fileName, fileUrl: url },
                      ])
                    }
                  />
                </View>
                {stagedDocs.length > 0 && (
                  <View style={{ marginTop: 10, gap: 6 }}>
                    {stagedDocs.map((d, i) => (
                      <View
                        key={`${d.category}-${i}`}
                        style={[
                          styles.docRow,
                          {
                            backgroundColor: c.surfaceMuted,
                            borderColor: c.surfaceBorder },
                        ]}
                      >
                        <Ionicons
                          name="document-text-outline"
                          size={16}
                          color={c.accent}
                        />
                        <Text
                          style={{
                            color: c.text,
                            fontSize: 12,
                            flex: 1 }}
                          numberOfLines={1}
                        >
                          {d.category} · {d.fileName}
                        </Text>
                        <TouchableOpacity
                          onPress={() =>
                            setStagedDocs((prev) =>
                              prev.filter((_, j) => j !== i)
                            )
                          }
                          hitSlop={6}
                        >
                          <Ionicons
                            name="close-circle"
                            size={16}
                            color={c.dangerText}
                          />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </Field>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  disabled={saving}
                  style={[
                    styles.cancelBtn,
                    { backgroundColor: c.surfaceMuted },
                  ]}
                >
                  <Text
                    style={{ color: c.text, fontWeight: "700" }}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={saveNew}
                  disabled={saving}
                  style={[
                    styles.submitBtn,
                    {
                      backgroundColor: c.accent,
                      shadowColor: c.shadow,
                      opacity: saving ? 0.7 : 1 },
                  ]}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={{ color: "#fff", fontWeight: "800" }}>
                      Create
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </KeyboardAwareScrollView>
          </View>
        </View>
      </Modal>

      {/* TERMINATE MODAL */}
      <Modal
        visible={terminateModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setTerminateModalVisible(false)}
      >
        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View
          style={[
            styles.modalScrim,
            { backgroundColor: c.overlay, justifyContent: "center" },
          ]}
        >
          <View
            style={[
              styles.terminateCard,
              { backgroundColor: c.surface, shadowColor: c.shadow },
            ]}
          >
            <Text style={[styles.modalTitle, { color: c.text }]}>
              Mark {terminateTarget?.name || "user"} NOT ACTIVE
            </Text>
            <Text style={[styles.terminateHint, { color: c.textMuted }]}>
              Account is preserved (audit / payroll history kept) but the
              user can no longer log in. Reactivate later from this list.
            </Text>
            <Field label="REASON *" theme={theme}>
              <Input
                value={terminateReason}
                onChangeText={setTerminateReason}
                placeholder="e.g. Resigned, end of contract…"
                multiline
                theme={theme}
              />
            </Field>
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => {
                  setTerminateModalVisible(false);
                  setTerminateReason("");
                  setTerminateTarget(null);
                }}
                style={[
                  styles.cancelBtn,
                  { backgroundColor: c.surfaceMuted },
                ]}
              >
                <Text
                  style={{ color: c.text, fontWeight: "700" }}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmTerminate}
                disabled={terminating}
                style={[
                  styles.submitBtn,
                  {
                    backgroundColor: c.dangerText,
                    shadowColor: c.shadow,
                    opacity: terminating ? 0.7 : 1 },
                ]}
              >
                {terminating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: "#fff", fontWeight: "800" }}>
                    Mark NOT ACTIVE
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      <BottomTabBar user={me} />
    </SafeAreaView>
  );
}

// =============================================================
// Sub-components
// =============================================================

const UserCard = ({
  user,
  onPress,
  onTerminate,
  theme }: {
  user: User;
  onPress: () => void;
  onTerminate: () => void;
  theme: any;
}) => {
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);
  const roleTint =
    user.role === "HR"
      ? { bg: c.roleHrBg, fg: c.roleHrText }
      : user.role === "CEO"
      ? { bg: c.roleCeoBg, fg: c.roleCeoText }
      : user.role === "MANAGER"
      ? { bg: c.roleManagerBg, fg: c.roleManagerText }
      : { bg: c.accentSoft, fg: c.accentText };
  const isTerminated = user.status === "Terminated";

  return (
    <View
      style={[
        styles.userCard,
        {
          backgroundColor: c.surface,
          borderColor: c.surfaceBorder,
          shadowColor: c.shadow },
      ]}
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={styles.userCardMain}
      >
        <View
          style={[
            styles.avatar,
            { backgroundColor: c.accentSoft },
          ]}
        >
          <Text
            style={{
              color: c.accentText,
              fontSize: 18,
              fontWeight: "800" }}
          >
            {user.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={[styles.userName, { color: c.text }]}
            numberOfLines={1}
          >
            {user.name}
          </Text>
          <Text
            style={[styles.userMeta, { color: c.textMuted }]}
            numberOfLines={1}
          >
            {user.email}
            {user.employeeCode ? `  ·  ${user.employeeCode}` : ""}
          </Text>
          <View style={styles.userChips}>
            <View
              style={[
                styles.miniChip,
                { backgroundColor: roleTint.bg },
              ]}
            >
              <Text
                style={{
                  color: roleTint.fg,
                  fontSize: 10,
                  fontWeight: "800" }}
              >
                {user.role}
              </Text>
            </View>
            {!!user.tag && (
              <View
                style={[
                  styles.miniChip,
                  { backgroundColor: c.pastelSky },
                ]}
              >
                <Text
                  style={{
                    color: "#0369a1",
                    fontSize: 10,
                    fontWeight: "800" }}
                >
                  {user.tag}
                </Text>
              </View>
            )}
            {isTerminated && (
              <View
                style={[
                  styles.miniChip,
                  { backgroundColor: c.dangerBg },
                ]}
              >
                <Text
                  style={{
                    color: c.dangerText,
                    fontSize: 10,
                    fontWeight: "800" }}
                >
                  NOT ACTIVE
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onTerminate}
        style={[
          styles.userAction,
          {
            backgroundColor: isTerminated
              ? c.successBg
              : c.dangerBg },
        ]}
        hitSlop={6}
      >
        <Ionicons
          name={isTerminated ? "refresh-outline" : "trash-outline"}
          size={16}
          color={isTerminated ? c.successText : c.dangerText}
        />
      </TouchableOpacity>
    </View>
  );
};

const Field = ({
  label,
  theme,
  children }: {
  label: string;
  theme: any;
  children: React.ReactNode;
}) => (
  <View style={{ marginTop: 14 }}>
    <Text
      style={{
        color: theme.colors.textMuted,
        fontSize: 11,
        fontWeight: "800",
        letterSpacing: 1.2,
        marginBottom: 6 }}
    >
      {label}
    </Text>
    {children}
  </View>
);

const Input = ({
  theme,
  multiline,
  ...rest
}: any) => (
  <TextInput
    {...rest}
    multiline={multiline}
    placeholderTextColor={theme.colors.textFaint}
    style={{
      backgroundColor: theme.colors.surfaceMuted,
      color: theme.colors.text,
      paddingHorizontal: 12,
      paddingVertical: multiline ? 12 : 11,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.surfaceBorder,
      fontSize: 14,
      minHeight: multiline ? 70 : 44,
      textAlignVertical: multiline ? "top" : undefined }}
  />
);

const makeStyles = (c: any) => StyleSheet.create({
  safe: { flex: 1 },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 8 },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center" },
  title: { fontSize: 26, fontWeight: "800" },
  subtitle: { fontSize: 13, marginTop: 2 },
  addBtn: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3 },

  tabsRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  tabBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center" },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    gap: 10,
    marginBottom: 14 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14 },

  emptyCard: {
    padding: 30,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2 },
  emptyText: { fontSize: 14, fontWeight: "700" },
  emptySub: { fontSize: 12 },

  userCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
    gap: 8 },
  userCardMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center" },
  userName: { fontSize: 15, fontWeight: "800" },
  userMeta: { fontSize: 12, marginTop: 2 },
  userChips: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 },
  miniChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999 },
  userAction: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center" },

  // Modals
  modalScrim: { flex: 1, justifyContent: "flex-end" },
  modalCard: {
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    shadowOpacity: 1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 12 },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6 },
  modalTitle: { fontSize: 20, fontWeight: "800" },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1 },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1 },
  eyeBtn: {
    position: "absolute",
    right: 10,
    top: 0,
    bottom: 0,
    justifyContent: "center" },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
    marginBottom: Platform.OS === "ios" ? 10 : 0 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center" },
  submitBtn: {
    flex: 1.5,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3 },

  terminateCard: {
    margin: 20,
    padding: 20,
    borderRadius: 20,
    shadowOpacity: 1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12 },
  terminateHint: {
    fontSize: 12,
    marginTop: 6,
    lineHeight: 18 } });
