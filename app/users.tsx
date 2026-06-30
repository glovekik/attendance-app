import React, { useEffect, useMemo, useState } from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Pressable,
  Platform,
  Image,
} from "react-native";
import { KbAwareScroll } from "../src/components/KbAwareScroll";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useRouter } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import {
  listUsers,
  createUser,
  updateUser,
} from "../src/services/users";

import { hrListAssets } from "../src/services/assets";

import {
  addUserDocument,
  DOC_CATEGORIES,
} from "../src/services/documents";

import { FilePickButton } from "../src/components/FilePickButton";
import { DatePickerField } from "../src/components/DatePickerField";
import { WebModal, ModalActions, ConfirmModal } from "../src/components/WebModal";
import { DataTable, Column } from "../src/components/DataTable";
import { PageHeader } from "../src/components/PageHeader";
import { WebInput, FormField, ChipPicker } from "../src/components/WebFormFields";
import { ProButton, StatusBadge, Avatar } from "../src/components/ProUI";

import {
  User,
  UserStatus,
  USER_STATUSES,
  Asset,
} from "../src/types";

import { useTheme } from "../src/theme/ThemeProvider";
import { getMe } from "../src/services/api";
import {
  BottomTabBar,
  BOTTOM_BAR_RESERVED_HEIGHT,
} from "../src/components/BottomTabBar";
import { notify } from "../src/utils/confirm";
import { useResponsive, getResponsiveSpacing } from "../src/utils/responsive";

interface StagedDoc {
  category: string;
  fileName: string;
  fileUrl: string;
}

/**
 * Employees list — Responsive design with DataTable for desktop,
 * cards for mobile. Tabs (Active / Not Active), search, create modal.
 */
export default function Users() {
  const router = useRouter();
  const { theme } = useTheme();
  const responsive = useResponsive();
  const spacing = getResponsiveSpacing(responsive.breakpoint);
  const c = theme.colors;
  const isDesktop = responsive.isDesktop;
  const styles = useMemo(() => makeStyles(c, isDesktop), [c, isDesktop]);

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
          selectedAssetIds.length > 0 ? selectedAssetIds : undefined,
      });
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
        params: { id: res.id },
      });
      await load();
    } catch (err: any) {
      notify("Couldn't create", err?.message || "");
    } finally {
      setSaving(false);
    }
  };

  const askTerminate = async (u: User) => {
    if (u.status === "Terminated") {
      // Reactivate directly
      await doSetStatus(u, "Active");
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

  // DataTable columns for desktop
  const columns: Column<User>[] = useMemo(() => [
    {
      key: "name",
      label: "Employee",
      width: "30%",
      render: (user) => (
        <View style={styles.employeeCell}>
          <Avatar
            name={user.name}
            src={user.profilePictureUrl}
            size="sm"
          />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.cellName, { color: c.text }]} numberOfLines={1}>
              {user.name}
            </Text>
            <Text style={[styles.cellEmail, { color: c.textMuted }]} numberOfLines={1}>
              {user.email}
            </Text>
          </View>
        </View>
      ),
    },
    {
      key: "employeeCode",
      label: "Code",
      width: "12%",
      render: (user) => (
        <Text style={[styles.cellText, { color: c.text }]}>
          {user.employeeCode || "—"}
        </Text>
      ),
    },
    {
      key: "tag",
      label: "Designation",
      width: "18%",
      render: (user) => (
        <Text style={[styles.cellText, { color: c.text }]} numberOfLines={1}>
          {user.tag || "—"}
        </Text>
      ),
    },
    {
      key: "role",
      label: "Role",
      width: "12%",
      render: (user) => {
        const roleTint =
          user.role === "HR"
            ? "purple"
            : user.role === "CEO"
            ? "warning"
            : user.role === "MANAGER"
            ? "info"
            : "default";
        return (
          <StatusBadge
            status={user.role || "EMPLOYEE"}
            variant={roleTint as any}
          />
        );
      },
    },
    {
      key: "status",
      label: "Status",
      width: "12%",
      render: (user) => (
        <StatusBadge
          status={user.status === "Terminated" ? "INACTIVE" : "ACTIVE"}
          variant={user.status === "Terminated" ? "danger" : "success"}
        />
      ),
    },
    {
      key: "actions",
      label: "",
      width: "16%",
      align: "right",
      render: (user) => (
        <View style={styles.actionsCell}>
          <Pressable
            onPress={() => router.push(`/hr-user-profile?id=${user.id}` as any)}
            style={({ hovered }: any) => [
              styles.actionBtn,
              { backgroundColor: c.surfaceMuted },
              hovered && { backgroundColor: c.accentSoft },
            ]}
          >
            <Ionicons name="eye-outline" size={16} color={c.accent} />
          </Pressable>
          <Pressable
            onPress={() => askTerminate(user)}
            style={({ hovered }: any) => [
              styles.actionBtn,
              {
                backgroundColor: user.status === "Terminated"
                  ? c.successBg
                  : c.dangerBg,
              },
              hovered && { opacity: 0.8 },
            ]}
          >
            <Ionicons
              name={user.status === "Terminated" ? "refresh-outline" : "trash-outline"}
              size={16}
              color={user.status === "Terminated" ? c.successText : c.dangerText}
            />
          </Pressable>
        </View>
      ),
    },
  ], [c, styles]);

  // Desktop shows sidebar, so we don't need bottom bar padding
  const bottomPadding = responsive.showSidebar ? 40 : BOTTOM_BAR_RESERVED_HEIGHT + 24;

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
          padding: spacing.padding,
          paddingBottom: bottomPadding,
          ...(isDesktop && {
            maxWidth: 1400,
            alignSelf: "center" as const,
            width: "100%",
          }),
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <PageHeader
          title="Employees"
          subtitle={`${activeCount} active employees`}
          breadcrumbs={[
            { label: "Home", href: "/" },
            { label: "HR Admin", href: "/hr-admin" },
            { label: "Employees" },
          ]}
          actions={
            <ProButton
              label={isDesktop ? "Add Employee" : ""}
              icon="add"
              onPress={openCreate}
              variant="primary"
              size={isDesktop ? "md" : "sm"}
            />
          }
        />

        {/* TABS & SEARCH */}
        <View style={[styles.filterRow, isDesktop && styles.filterRowDesktop]}>
          <View style={styles.tabsRow}>
            <Pressable
              onPress={() => setTab("ACTIVE")}
              style={({ hovered }: any) => [
                styles.tabBtn,
                {
                  backgroundColor:
                    tab === "ACTIVE" ? c.accentSoft : c.surfaceMuted,
                  borderColor:
                    tab === "ACTIVE" ? c.accent : c.surfaceBorder,
                },
                Platform.OS === "web" && hovered && tab !== "ACTIVE" && {
                  borderColor: c.accent,
                },
              ]}
            >
              <Text
                style={{
                  color: tab === "ACTIVE" ? c.accent : c.textMuted,
                  fontWeight: "700",
                  fontSize: 13,
                }}
              >
                Active · {activeCount}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setTab("INACTIVE")}
              style={({ hovered }: any) => [
                styles.tabBtn,
                {
                  backgroundColor:
                    tab === "INACTIVE" ? c.accentSoft : c.surfaceMuted,
                  borderColor:
                    tab === "INACTIVE" ? c.accent : c.surfaceBorder,
                },
                Platform.OS === "web" && hovered && tab !== "INACTIVE" && {
                  borderColor: c.accent,
                },
              ]}
            >
              <Text
                style={{
                  color: tab === "INACTIVE" ? c.accent : c.textMuted,
                  fontWeight: "700",
                  fontSize: 13,
                }}
              >
                Not Active · {inactiveCount}
              </Text>
            </Pressable>
          </View>

          {/* SEARCH */}
          <View
            style={[
              styles.searchBox,
              {
                backgroundColor: c.surface,
                borderColor: c.surfaceBorder,
              },
              isDesktop && styles.searchBoxDesktop,
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
        </View>

        {/* LIST - DataTable for desktop, Cards for mobile */}
        {isDesktop ? (
          <DataTable
            columns={columns}
            data={filteredUsers}
            keyExtractor={(user) => user.id}
            onRowPress={(user) =>
              router.push(`/hr-user-profile?id=${user.id}` as any)
            }
            emptyMessage={
              search
                ? "No matching employees"
                : tab === "ACTIVE"
                ? "No active employees yet"
                : "No terminated employees"
            }
          />
        ) : (
          <>
            {filteredUsers.length === 0 ? (
              <View
                style={[
                  styles.emptyCard,
                  {
                    backgroundColor: c.surface,
                    borderColor: c.surfaceBorder,
                    shadowColor: c.shadow,
                  },
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
          </>
        )}
      </ScrollView>

      {/* CREATE MODAL */}
      <WebModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title="New Employee"
        subtitle="Add a new team member to your organization"
        size="lg"
        footer={
          <ModalActions align="spread">
            <ProButton
              label="Cancel"
              variant="secondary"
              onPress={() => setModalVisible(false)}
              disabled={saving}
            />
            <ProButton
              label={saving ? "Creating..." : "Create Employee"}
              variant="primary"
              onPress={saveNew}
              loading={saving}
              icon="checkmark"
            />
          </ModalActions>
        }
      >
        <KbAwareScroll
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bottomOffset={24}
        >
          <View style={[styles.formGrid, isDesktop && styles.formGridDesktop]}>
            <FormField label="Full Name" required>
              <WebInput
                value={name}
                onChangeText={setName}
                placeholder="Enter employee name"
                leftIcon="person-outline"
              />
            </FormField>

            <FormField label="Email Address" required>
              <WebInput
                value={email}
                onChangeText={setEmail}
                placeholder="user@company.com"
                autoCapitalize="none"
                keyboardType="email-address"
                leftIcon="mail-outline"
              />
            </FormField>

            <FormField label="Password" required>
              <WebInput
                value={password}
                onChangeText={setPassword}
                placeholder="Min 6 characters"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                leftIcon="lock-closed-outline"
                rightIcon={showPassword ? "eye-off-outline" : "eye-outline"}
                onRightIconPress={() => setShowPassword((v) => !v)}
              />
            </FormField>

            <FormField label="Designation">
              <WebInput
                value={tag}
                onChangeText={setTag}
                placeholder="e.g. Senior Engineer"
                leftIcon="briefcase-outline"
              />
            </FormField>

            <FormField label="Employee Code" helper="Leave blank to auto-generate">
              <WebInput
                value={employeeCode}
                onChangeText={setEmployeeCode}
                placeholder="EMP001"
                leftIcon="barcode-outline"
              />
            </FormField>

            <FormField label="Work Phone">
              <WebInput
                value={workPhone}
                onChangeText={setWorkPhone}
                placeholder="+91..."
                keyboardType="phone-pad"
                leftIcon="call-outline"
              />
            </FormField>

            <FormField label="Joining Date">
              <DatePickerField
                value={joiningDate}
                onChange={setJoiningDate}
              />
            </FormField>

            <FormField label="Status">
              <ChipPicker
                value={status}
                onChange={(v) => setStatus(v as UserStatus)}
                options={USER_STATUSES.map((s) => ({
                  value: s,
                  label: s === "Terminated" ? "Not Active" : s,
                }))}
              />
            </FormField>
          </View>

          {availableAssets.length > 0 && (
            <FormField label="Assign Assets (Optional)">
              <ChipPicker
                value={selectedAssetIds}
                onChange={(v) => setSelectedAssetIds(v as string[])}
                options={availableAssets.map((a) => ({
                  value: a.id,
                  label: `${a.code} · ${a.name}`,
                }))}
                multiple
              />
            </FormField>
          )}

          <FormField label="Documents (Optional)">
            <ChipPicker
              value={docCategory}
              onChange={(v) => setDocCategory(v as string)}
              options={DOC_CATEGORIES.map((cat) => ({
                value: cat,
                label: cat,
              }))}
            />
            <View style={{ marginTop: 12 }}>
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
              <View style={{ marginTop: 12, gap: 8 }}>
                {stagedDocs.map((d, i) => (
                  <View
                    key={`${d.category}-${i}`}
                    style={[
                      styles.docRow,
                      {
                        backgroundColor: c.surfaceMuted,
                        borderColor: c.surfaceBorder,
                      },
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
                        fontSize: 13,
                        flex: 1,
                      }}
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
                        size={18}
                        color={c.dangerText}
                      />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </FormField>
        </KbAwareScroll>
      </WebModal>

      {/* TERMINATE MODAL */}
      <WebModal
        visible={terminateModalVisible}
        onClose={() => {
          setTerminateModalVisible(false);
          setTerminateReason("");
          setTerminateTarget(null);
        }}
        title={`Mark ${terminateTarget?.name || "user"} NOT ACTIVE`}
        subtitle="Account is preserved (audit / payroll history kept) but the user can no longer log in."
        size="sm"
        footer={
          <ModalActions align="spread">
            <ProButton
              label="Cancel"
              variant="secondary"
              onPress={() => {
                setTerminateModalVisible(false);
                setTerminateReason("");
                setTerminateTarget(null);
              }}
            />
            <ProButton
              label={terminating ? "Processing..." : "Mark NOT ACTIVE"}
              variant="danger"
              onPress={confirmTerminate}
              loading={terminating}
            />
          </ModalActions>
        }
      >
        <FormField label="Reason" required>
          <WebInput
            value={terminateReason}
            onChangeText={setTerminateReason}
            placeholder="e.g. Resigned, end of contract..."
            leftIcon="document-text-outline"
          />
        </FormField>
      </WebModal>

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
  theme,
}: {
  user: User;
  onPress: () => void;
  onTerminate: () => void;
  theme: any;
}) => {
  const c = theme.colors;
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
        mobileStyles.userCard,
        {
          backgroundColor: c.surface,
          borderColor: c.surfaceBorder,
          shadowColor: c.shadow,
        },
      ]}
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={mobileStyles.userCardMain}
      >
        {user.profilePictureUrl ? (
          <Image
            source={{ uri: user.profilePictureUrl }}
            style={mobileStyles.avatar}
          />
        ) : (
          <View
            style={[
              mobileStyles.avatar,
              { backgroundColor: c.accentSoft },
            ]}
          >
            <Text
              style={{
                color: c.accentText,
                fontSize: 18,
                fontWeight: "800",
              }}
            >
              {user.name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text
            style={[mobileStyles.userName, { color: c.text }]}
            numberOfLines={1}
          >
            {user.name}
          </Text>
          <Text
            style={[mobileStyles.userMeta, { color: c.textMuted }]}
            numberOfLines={1}
          >
            {user.email}
            {user.employeeCode ? `  ·  ${user.employeeCode}` : ""}
          </Text>
          <View style={mobileStyles.userChips}>
            <View
              style={[
                mobileStyles.miniChip,
                { backgroundColor: roleTint.bg },
              ]}
            >
              <Text
                style={{
                  color: roleTint.fg,
                  fontSize: 10,
                  fontWeight: "800",
                }}
              >
                {user.role}
              </Text>
            </View>
            {!!user.tag && (
              <View
                style={[
                  mobileStyles.miniChip,
                  { backgroundColor: c.pastelSky },
                ]}
              >
                <Text
                  style={{
                    color: "#0369a1",
                    fontSize: 10,
                    fontWeight: "800",
                  }}
                >
                  {user.tag}
                </Text>
              </View>
            )}
            {isTerminated && (
              <View
                style={[
                  mobileStyles.miniChip,
                  { backgroundColor: c.dangerBg },
                ]}
              >
                <Text
                  style={{
                    color: c.dangerText,
                    fontSize: 10,
                    fontWeight: "800",
                  }}
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
          mobileStyles.userAction,
          {
            backgroundColor: isTerminated
              ? c.successBg
              : c.dangerBg,
          },
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

// Mobile-only styles (unchanged from original)
const mobileStyles = StyleSheet.create({
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
    gap: 8,
  },
  userCardMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  userName: { fontSize: 15, fontWeight: "800" },
  userMeta: { fontSize: 12, marginTop: 2 },
  userChips: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 6 },
  miniChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  userAction: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});

// Responsive styles
const makeStyles = (c: any, isDesktop: boolean) =>
  StyleSheet.create({
    safe: { flex: 1 },
    loader: { flex: 1, alignItems: "center", justifyContent: "center" },

    // Filter row
    filterRow: {
      marginTop: 16,
      marginBottom: 16,
      gap: 12,
    },
    filterRowDesktop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    tabsRow: {
      flexDirection: "row",
      gap: 8,
    },
    tabBtn: {
      paddingHorizontal: isDesktop ? 20 : 16,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      ...(Platform.OS === "web" && {
        cursor: "pointer" as any,
        transition: "all 0.15s ease" as any,
      }),
    },

    searchBox: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 10,
      paddingHorizontal: 14,
      borderWidth: 1,
      gap: 10,
    },
    searchBoxDesktop: {
      width: 320,
    },
    searchInput: {
      flex: 1,
      paddingVertical: 10,
      fontSize: 14,
      ...(Platform.OS === "web" && {
        outlineStyle: "none" as any,
      }),
    },

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
      elevation: 2,
    },
    emptyText: { fontSize: 14, fontWeight: "700" },
    emptySub: { fontSize: 12 },

    // DataTable cell styles
    employeeCell: {
      flexDirection: "row",
      alignItems: "center",
    },
    cellName: {
      fontSize: 14,
      fontWeight: "600",
    },
    cellEmail: {
      fontSize: 12,
      marginTop: 2,
    },
    cellText: {
      fontSize: 14,
    },
    actionsCell: {
      flexDirection: "row",
      gap: 8,
      justifyContent: "flex-end",
    },
    actionBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      ...(Platform.OS === "web" && {
        cursor: "pointer" as any,
        transition: "all 0.15s ease" as any,
      }),
    },

    // Form styles
    formGrid: {
      gap: 0,
    },
    formGridDesktop: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 16,
    },

    docRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
    },
  });
