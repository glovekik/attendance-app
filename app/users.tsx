import React, {
  useEffect,
  useState,
} from "react";

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  Platform,
  Alert,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useRouter } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import DateTimePicker from "@react-native-community/datetimepicker";

import {
  WebDateField,
  dateToYMD,
  ymdToDate,
} from "../src/components/WebDateField";

import {
  listUsers,
  createUser,
  updateUser,
} from "../src/services/users";

import {
  User,
  UserTag,
  UserStatus,
  USER_TAGS,
  USER_STATUSES,
} from "../src/types";

const isWeb = Platform.OS === "web";

export default function Users() {

  const router = useRouter();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [popup, setPopup] = useState({
    visible: false,
    type: "success" as "success" | "error",
    message: "",
  });

  // ===== modal =====
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [tag, setTag] = useState<UserTag>("Employee");
  const [employeeCode, setEmployeeCode] = useState("");
  const [workPhone, setWorkPhone] = useState("");
  const [status, setStatus] = useState<UserStatus>("Active");

  const [hasJoining, setHasJoining] = useState(false);
  const [joiningDate, setJoiningDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [saving, setSaving] = useState(false);

  const showPopup = (
    msg: string,
    kind: "success" | "error" = "success"
  ) => {
    setPopup({ visible: true, type: kind, message: msg });
    setTimeout(() => {
      setPopup((p) => ({ ...p, visible: false }));
    }, 2500);
  };

  // ===== load =====
  const load = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const res = await listUsers(token);
      setUsers(res || []);
    } catch (err: any) {
      showPopup(err?.message || "Failed to load users", "error");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setEmail("");
    setPassword("");
    setShowPassword(false);
    setTag("Employee");
    setEmployeeCode("");
    setWorkPhone("");
    setStatus("Active");
    setHasJoining(false);
    setJoiningDate(new Date());
  };

  const openCreate = () => {
    resetForm();
    setModalVisible(true);
  };

  const openEdit = (u: User) => {
    setEditingId(u.id);
    setName(u.name);
    setEmail(u.email);
    setPassword("");
    setTag(u.tag || "Employee");
    setEmployeeCode(u.employeeCode || "");
    setWorkPhone(u.workPhone || "");
    setStatus(u.status || "Active");
    if (u.joiningDate) {
      setHasJoining(true);
      setJoiningDate(new Date(`${u.joiningDate}T00:00:00`));
    } else {
      setHasJoining(false);
      setJoiningDate(new Date());
    }
    setModalVisible(true);
  };

  // ===== terminate (soft-delete) =====
  const askTerminate = (u: User) => {
    if (u.status === "Terminated") {
      Alert.alert(
        "Reactivate user?",
        `${u.name} is currently Terminated. Set status back to Active?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Reactivate",
            onPress: () => doSetStatus(u, "Active"),
          },
        ]
      );
      return;
    }
    Alert.alert(
      "Terminate user?",
      `${u.name} will be marked Terminated. Their account is preserved (audit / payroll history kept) but they can no longer log in. You can reactivate later from this list.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Terminate",
          style: "destructive",
          onPress: () => doSetStatus(u, "Terminated"),
        },
      ]
    );
  };

  const doSetStatus = async (u: User, status: UserStatus) => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await updateUser(token, u.id, { status });
      showPopup(
        status === "Terminated"
          ? `${u.name} terminated`
          : `${u.name} reactivated`
      );
      await load();
    } catch (err: any) {
      showPopup(err?.message || "Failed", "error");
    }
  };

  // ===== save =====
  const save = async () => {

    if (saving) return;

    if (!name.trim()) {
      showPopup("Name required", "error");
      return;
    }

    if (!editingId) {
      if (!email.trim()) {
        showPopup("Email required", "error");
        return;
      }
      if (password.length < 6) {
        showPopup("Password must be at least 6 chars", "error");
        return;
      }
    }

    try {

      setSaving(true);

      const token = await AsyncStorage.getItem("token");
      if (!token) return;

      const sharedFields = {
        name: name.trim(),
        tag,
        employeeCode: employeeCode.trim() || undefined,
        workPhone: workPhone.trim() || undefined,
        status,
        joiningDate: hasJoining ? dateToYMD(joiningDate) : undefined,
      };

      if (editingId) {
        await updateUser(token, editingId, sharedFields);
        showPopup("User updated");
      } else {
        const createdEmail = email.trim();
        const createdPwd = password;
        await createUser(token, {
          ...sharedFields,
          email: createdEmail,
          password: createdPwd,
        });
        // Show credentials once so HR can share them verbally if needed.
        // After this dialog closes the password is gone (only the hash
        // remains on the server).
        Alert.alert(
          "User created",
          `Email: ${createdEmail}\nPassword: ${createdPwd}\n\n` +
            "A welcome email with a setup link has also been sent. " +
            "Recommend the user click that link to set their own password.",
          [{ text: "OK" }]
        );
      }

      setModalVisible(false);
      resetForm();
      await load();

    } catch (err: any) {
      showPopup(err?.message || "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>

      {popup.visible && (
        <View
          style={[
            styles.popup,
            popup.type === "success"
              ? styles.successPopup
              : styles.errorPopup,
          ]}
        >
          <Text style={styles.popupText}>
            {popup.message}
          </Text>
        </View>
      )}

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >

        <View style={styles.header}>

          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
          >
            <Ionicons
              name="chevron-back"
              size={22}
              color="#fff"
            />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Users</Text>
            <Text style={styles.subtitle}>
              {users.length} total
            </Text>
          </View>

          <TouchableOpacity
            style={styles.addBtn}
            onPress={openCreate}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>

        </View>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color="#64748b" />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name, email, or code"
            placeholderTextColor="#64748b"
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons
                name="close-circle"
                size={16}
                color="#64748b"
              />
            </TouchableOpacity>
          )}
        </View>

        {users
          .filter((u) => {
            const q = search.trim().toLowerCase();
            if (!q) return true;
            return (
              u.name.toLowerCase().includes(q) ||
              u.email.toLowerCase().includes(q) ||
              (u.employeeCode || "").toLowerCase().includes(q) ||
              (u.tag || "").toLowerCase().includes(q)
            );
          })
          .map((u) => (
          <TouchableOpacity
            key={u.id}
            style={styles.card}
            onPress={() => openEdit(u)}
            activeOpacity={0.85}
          >

            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {u.name.charAt(0).toUpperCase()}
              </Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.cardName}>{u.name}</Text>
              <Text style={styles.cardEmail}>
                {u.email}
                {u.employeeCode ? `  ·  ${u.employeeCode}` : ""}
              </Text>
              {u.tag ? (
                <Text style={styles.cardTag}>{u.tag}</Text>
              ) : null}
            </View>

            <View style={styles.rightChips}>
              <View
                style={[
                  styles.roleChip,
                  u.role === "HR" && { backgroundColor: "#db2777" },
                  u.role === "MANAGER" && { backgroundColor: "#7c3aed" },
                ]}
              >
                <Text style={styles.roleChipText}>{u.role}</Text>
              </View>
              {u.status && u.status !== "Active" ? (
                <View
                  style={[
                    styles.roleChip,
                    u.status === "Terminated"
                      ? { backgroundColor: "#dc2626" }
                      : { backgroundColor: "#f59e0b" },
                    { marginTop: 4 },
                  ]}
                >
                  <Text style={styles.roleChipText}>
                    {u.status.toUpperCase()}
                  </Text>
                </View>
              ) : null}
              <View style={{ flexDirection: "row", gap: 4, marginTop: 4 }}>
                <TouchableOpacity
                  style={styles.profileBtn}
                  onPress={() =>
                    router.push(
                      `/hr-user-profile?id=${u.id}` as any
                    )
                  }
                >
                  <Ionicons
                    name="open-outline"
                    size={14}
                    color="#fff"
                  />
                  <Text style={styles.profileBtnText}>Profile</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.terminateBtn,
                    u.status === "Terminated" && {
                      backgroundColor: "#16a34a",
                    },
                  ]}
                  onPress={(e) => {
                    // Stop the card's onPress (opens modal)
                    if ((e as any).stopPropagation) (e as any).stopPropagation();
                    askTerminate(u);
                  }}
                  hitSlop={6}
                >
                  <Ionicons
                    name={
                      u.status === "Terminated"
                        ? "refresh-outline"
                        : "trash-outline"
                    }
                    size={14}
                    color="#fff"
                  />
                </TouchableOpacity>
              </View>
            </View>

          </TouchableOpacity>
        ))}

        {users.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>No users yet</Text>
            <Text style={styles.emptySub}>
              Tap + to create the first one.
            </Text>
          </View>
        )}

      </ScrollView>

      {/* MODAL */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >

              <Text style={styles.modalTitle}>
                {editingId ? "Edit User" : "New User"}
              </Text>

              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Full name"
                placeholderTextColor="#64748b"
              />

              <Text style={styles.label}>Email</Text>
              <TextInput
                style={[
                  styles.input,
                  editingId && styles.inputDisabled,
                ]}
                value={email}
                onChangeText={setEmail}
                placeholder="user@example.com"
                placeholderTextColor="#64748b"
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!editingId}
              />
              {editingId ? (
                <Text style={styles.hintMini}>
                  Email can't be changed
                </Text>
              ) : null}

              {!editingId ? (
                <>
                  <Text style={styles.label}>Password</Text>
                  <View style={styles.pwdRow}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Min 6 characters"
                      placeholderTextColor="#64748b"
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                    />
                    <TouchableOpacity
                      style={styles.eyeBtn}
                      onPress={() => setShowPassword((v) => !v)}
                    >
                      <Ionicons
                        name={
                          showPassword ? "eye-off-outline" : "eye-outline"
                        }
                        size={20}
                        color="#94a3b8"
                      />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.hintMini}>
                    HR can view what's typed. After creation, an email with
                    a setup link is sent — recommend the user replace this
                    password on first login.
                  </Text>
                </>
              ) : null}

              <Text style={styles.label}>Designation</Text>
              <View style={styles.chipPicker}>
                {USER_TAGS.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.pickBtn,
                      tag === t && styles.pickActive,
                    ]}
                    onPress={() => setTag(t)}
                  >
                    <Text
                      style={[
                        styles.pickText,
                        tag === t && { color: "#fff" },
                      ]}
                    >
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Employee Code</Text>
              <TextInput
                style={styles.input}
                value={employeeCode}
                onChangeText={setEmployeeCode}
                placeholder="e.g. EMP-0042"
                placeholderTextColor="#64748b"
              />

              <Text style={styles.label}>Work Phone</Text>
              <TextInput
                style={styles.input}
                value={workPhone}
                onChangeText={setWorkPhone}
                placeholder="+91-9876543210"
                placeholderTextColor="#64748b"
                keyboardType="phone-pad"
              />

              <View style={styles.toggleRow}>
                <Text style={styles.label}>Joining Date</Text>
                <TouchableOpacity
                  onPress={() => setHasJoining(!hasJoining)}
                  style={[
                    styles.toggleBtn,
                    hasJoining && styles.toggleOn,
                  ]}
                >
                  <Text
                    style={[
                      styles.toggleBtnText,
                      hasJoining && { color: "#fff" },
                    ]}
                  >
                    {hasJoining ? "Set" : "Not set"}
                  </Text>
                </TouchableOpacity>
              </View>

              {hasJoining && (
                isWeb ? (
                  <View style={styles.joinRow}>
                    <Ionicons
                      name="calendar-outline"
                      size={18}
                      color="#94a3b8"
                    />
                    <WebDateField
                      mode="date"
                      value={dateToYMD(joiningDate)}
                      max={dateToYMD(new Date())}
                      onChange={(v) => {
                        const d = ymdToDate(v);
                        if (d) setJoiningDate(d);
                      }}
                    />
                  </View>
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.joinRow}
                      onPress={() => setShowDatePicker(true)}
                    >
                      <Ionicons
                        name="calendar-outline"
                        size={18}
                        color="#94a3b8"
                      />
                      <Text style={styles.joinText}>
                        {joiningDate.toLocaleDateString("en-US", {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </Text>
                    </TouchableOpacity>
                    {showDatePicker && (
                      <DateTimePicker
                        value={joiningDate}
                        mode="date"
                        maximumDate={new Date()}
                        onChange={(_, d) => {
                          setShowDatePicker(
                            Platform.OS === "ios"
                          );
                          if (d) setJoiningDate(d);
                        }}
                      />
                    )}
                  </>
                )
              )}

              <Text style={styles.label}>Status</Text>
              <View style={styles.chipPicker}>
                {USER_STATUSES.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[
                      styles.pickBtn,
                      status === s && styles.pickActive,
                    ]}
                    onPress={() => setStatus(s)}
                  >
                    <Text
                      style={[
                        styles.pickText,
                        status === s && { color: "#fff" },
                      ]}
                    >
                      {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {!editingId ? (
                <Text style={styles.hint}>
                  New users get the USER role by default.
                </Text>
              ) : null}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.modalBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.saveBtn,
                    saving && { opacity: 0.7 },
                  ]}
                  onPress={save}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.modalBtnText}>
                      {editingId ? "Update" : "Create"}
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b1220" },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  loader: {
    flex: 1,
    backgroundColor: "#0b1220",
    justifyContent: "center",
    alignItems: "center",
  },

  popup: {
    position: "absolute",
    top: 60,
    left: 20,
    right: 20,
    padding: 14,
    borderRadius: 14,
    zIndex: 999,
  },
  successPopup: { backgroundColor: "#16a34a" },
  errorPopup: { backgroundColor: "#dc2626" },
  popupText: { color: "#fff", fontWeight: "700", textAlign: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
    marginTop: 10,
    gap: 12,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#111827",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  addBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#2563eb",
    justifyContent: "center",
    alignItems: "center",
  },
  title: { color: "#fff", fontSize: 24, fontWeight: "800" },
  subtitle: { color: "#94a3b8", fontSize: 13, marginTop: 3 },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1f2937",
    gap: 8,
  },

  searchInput: {
    flex: 1,
    color: "#fff",
    paddingVertical: 10,
    fontSize: 14,
  },

  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#1f2937",
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#2563eb",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  cardName: { color: "#fff", fontSize: 15, fontWeight: "700" },
  cardEmail: { color: "#94a3b8", fontSize: 12, marginTop: 2 },
  cardTag: {
    color: "#0ea5e9",
    fontSize: 11,
    fontWeight: "700",
    marginTop: 4,
  },

  rightChips: {
    alignItems: "flex-end",
    gap: 4,
  },
  profileBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3b82f6",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  profileBtnText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  terminateBtn: {
    backgroundColor: "#dc2626",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  pwdRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  eyeBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#0f172a",
    borderWidth: 1,
    borderColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
  },
  roleChip: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  roleChipText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  emptyBox: {
    alignItems: "center",
    padding: 40,
    backgroundColor: "#111827",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#1f2937",
    marginTop: 20,
  },
  emptyTitle: { color: "#fff", fontSize: 16, fontWeight: "700" },
  emptySub: {
    color: "#94a3b8",
    fontSize: 13,
    marginTop: 6,
    textAlign: "center",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#111827",
    borderRadius: 18,
    padding: 20,
    maxHeight: "92%",
  },
  modalTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 12,
  },

  label: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 14,
  },
  input: {
    backgroundColor: "#0f172a",
    color: "#fff",
    borderRadius: 12,
    padding: 13,
    borderWidth: 1,
    borderColor: "#1e293b",
    fontSize: 14,
  },
  inputDisabled: {
    opacity: 0.55,
  },
  hintMini: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 4,
    fontStyle: "italic",
  },

  chipPicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  pickBtn: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: "#0f172a",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1e293b",
  },
  pickActive: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  pickText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
  },

  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#0f172a",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#1e293b",
    marginTop: 14,
  },
  toggleOn: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },
  toggleBtnText: {
    color: "#94a3b8",
    fontWeight: "700",
    fontSize: 12,
  },

  joinRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 13,
    borderWidth: 1,
    borderColor: "#1e293b",
    gap: 10,
    marginTop: 8,
  },
  joinText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },

  hint: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 14,
    fontStyle: "italic",
  },

  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 22,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: "#374151",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  saveBtn: {
    flex: 1,
    backgroundColor: "#16a34a",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  modalBtnText: { color: "#fff", fontWeight: "700" },
});
