import React, { useEffect, useState, useCallback, useMemo} from "react";

import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  Switch,
  ScrollView,
  Platform } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  listProjects,
  createProject,
  updateProject,
  deleteProject } from "../src/services/projects";
import { listDepartments } from "../src/services/departments";
import { listUsers } from "../src/services/users";
import { DatePickerField } from "../src/components/DatePickerField";
import { useTheme } from "../src/theme/ThemeProvider";
import { projectStatusColor } from "../src/theme/statusColors";
import {
  Department,
  Project,
  ProjectStatus,
  User } from "../src/types";

const STATUSES: ProjectStatus[] = ["Active", "OnHold", "Completed"];

export default function HrProjects() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);
  const [items, setItems] = useState<Project[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [pmIds, setPmIds] = useState<string[]>([]);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [status, setStatus] = useState<ProjectStatus>("Active");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [billable, setBillable] = useState(false);
  const [saving, setSaving] = useState(false);

  // Picker state
  const [pickerMode, setPickerMode] = useState<
    "pm" | "member" | null
  >(null);
  const [pickerSearch, setPickerSearch] = useState("");

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const [projs, depts, allUsers] = await Promise.all([
        listProjects(token),
        listDepartments(token).catch(() => []),
        listUsers(token).catch(() => []),
      ]);
      setItems(projs || []);
      setDepartments(depts || []);
      setUsers(allUsers || []);
    } catch (err: any) {
      Alert.alert(
        "Couldn't load projects",
        err?.message || "Pull down to retry."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setCode("");
    setDescription("");
    setDepartmentId(null);
    setPmIds([]);
    setMemberIds([]);
    setStatus("Active");
    setStartDate("");
    setEndDate("");
    setBillable(false);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (p: Project) => {
    setEditingId(p.id);
    setName(p.name);
    setCode(p.code);
    setDescription(p.description || "");
    setDepartmentId(p.departmentId || null);
    setPmIds(p.projectManagerIds || []);
    setMemberIds(p.memberIds || []);
    setStatus(p.status);
    setStartDate(p.startDate || "");
    setEndDate(p.endDate || "");
    setBillable(!!p.billable);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    resetForm();
    setSaving(false);
  };

  const onSave = async () => {
    if (!name.trim() || !code.trim()) {
      Alert.alert("Name and code are required");
      return;
    }
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const payload = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        description: description.trim() || undefined,
        departmentId: departmentId || undefined,
        projectManagerIds: pmIds,
        memberIds,
        status,
        startDate: startDate.trim() || undefined,
        endDate: endDate.trim() || undefined,
        billable };
      if (editingId) {
        await updateProject(token, editingId, payload);
      } else {
        await createProject(token, payload);
      }
      closeForm();
      load();
    } catch (err: any) {
      Alert.alert("Save failed", err?.message || "");
      setSaving(false);
    }
  };

  const onDelete = (p: Project) => {
    Alert.alert("Delete project?", p.name, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const token = await AsyncStorage.getItem("token");
            if (!token) return;
            await deleteProject(token, p.id);
            setItems((prev) => prev.filter((x) => x.id !== p.id));
          } catch (err: any) {
            Alert.alert("Delete failed", err?.message || "");
          }
        } },
    ]);
  };

  const toggleUserInList = (
    list: string[],
    setter: (l: string[]) => void,
    id: string
  ) => {
    if (list.includes(id)) {
      setter(list.filter((x) => x !== id));
    } else {
      setter([...list, id]);
    }
  };

  const pickerList = pickerMode === "pm" ? pmIds : memberIds;
  const pickerSetter =
    pickerMode === "pm" ? setPmIds : setMemberIds;

  const filteredUsers = users.filter((u) => {
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}>
          <Ionicons name="arrow-back" size={24} color={c.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Projects</Text>
        <TouchableOpacity onPress={openCreate}>
          <Ionicons name="add-circle" size={28} color={c.accent} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(p) => p.id}
        contentContainerStyle={
          items.length === 0 ? styles.emptyWrap : { padding: 12 }
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={c.accent}
            colors={[c.accent]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons
              name="folder-outline"
              size={42}
              color={c.textFaint}
            />
            <Text style={styles.emptyText}>No projects yet</Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={openCreate}
            >
              <Text style={styles.emptyBtnText}>
                Create your first
              </Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => {
          const dept =
            departments.find((d) => d.id === item.departmentId)?.name;
          const sc = projectStatusColor(item.status, c);
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => openEdit(item)}
              activeOpacity={0.8}
            >
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>
                    {item.name}
                    <Text style={styles.codeChip}>  · {item.code}</Text>
                  </Text>
                  {!!dept && (
                    <Text style={styles.cardDesc}>{dept}</Text>
                  )}
                </View>
                <View
                  style={[
                    styles.statusPill,
                    { backgroundColor: sc.bg },
                  ]}
                >
                  <Text style={[styles.statusText, { color: sc.fg }]}>{item.status}</Text>
                </View>
              </View>
              <View style={styles.cardFooter}>
                <Text style={styles.meta}>
                  {(item.projectManagerIds?.length || 0)} PM ·{" "}
                  {(item.memberIds?.length || 0)} members
                </Text>
                <TouchableOpacity
                  onPress={() => onDelete(item)}
                  style={styles.deleteBtn}
                >
                  <Ionicons
                    name="trash-outline"
                    size={16}
                    color={c.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* CREATE / EDIT */}
      <Modal
        visible={showForm}
        animationType="slide"
        transparent
        onRequestClose={closeForm}
      >
        <KeyboardAvoidingView
          behavior="padding"
          style={styles.modalWrap}
        >
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingId ? "Edit project" : "New project"}
              </Text>
              <TouchableOpacity onPress={closeForm}>
                <Ionicons name="close" size={24} color={c.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 520 }}>
              <Text style={styles.label}>Name *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Project Alpha"
                placeholderTextColor={c.textFaint}
              />

              <Text style={styles.label}>Code * (unique)</Text>
              <TextInput
                style={styles.input}
                value={code}
                onChangeText={setCode}
                placeholder="ALPHA"
                placeholderTextColor={c.textFaint}
                autoCapitalize="characters"
                editable={!editingId}
              />
              {editingId && (
                <Text style={styles.hint}>
                  Code can&apos;t be changed
                </Text>
              )}

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, { minHeight: 60 }]}
                value={description}
                onChangeText={setDescription}
                placeholder="Optional"
                placeholderTextColor={c.textFaint}
                multiline
                textAlignVertical="top"
              />

              <Text style={styles.label}>Department</Text>
              <View style={styles.chipRow}>
                {departments.length === 0 ? (
                  <Text style={styles.hint}>
                    No departments — create one first.
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

              <Text style={styles.label}>
                Project Managers ({pmIds.length})
              </Text>
              <TouchableOpacity
                style={styles.input}
                onPress={() => {
                  setPickerMode("pm");
                  setPickerSearch("");
                }}
              >
                <Text style={{ color: c.text }}>
                  {pmIds.length > 0
                    ? pmIds
                        .map(
                          (id) =>
                            users.find((u) => u.id === id)?.name ||
                            "?"
                        )
                        .join(", ")
                    : "Tap to add managers..."}
                </Text>
              </TouchableOpacity>

              <Text style={styles.label}>
                Members ({memberIds.length})
              </Text>
              <TouchableOpacity
                style={styles.input}
                onPress={() => {
                  setPickerMode("member");
                  setPickerSearch("");
                }}
              >
                <Text style={{ color: c.text }}>
                  {memberIds.length > 0
                    ? memberIds
                        .map(
                          (id) =>
                            users.find((u) => u.id === id)?.name ||
                            "?"
                        )
                        .join(", ")
                    : "Tap to add members..."}
                </Text>
              </TouchableOpacity>

              <Text style={styles.label}>Status</Text>
              <View style={styles.chipRow}>
                {STATUSES.map((s) => {
                  const sc = projectStatusColor(s, c);
                  return (
                    <TouchableOpacity
                      key={s}
                      style={[
                        styles.chip,
                        status === s && {
                          backgroundColor: sc.bg,
                          borderColor: sc.solid },
                      ]}
                      onPress={() => setStatus(s)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          status === s && { color: sc.fg },
                        ]}
                      >
                        {s}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Start date</Text>
                  <DatePickerField
                    value={startDate}
                    onChange={setStartDate}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>End date</Text>
                  <DatePickerField
                    value={endDate}
                    onChange={setEndDate}
                    min={startDate || undefined}
                  />
                </View>
              </View>

              <View style={[styles.row, { marginTop: 14 }]}>
                <Text style={styles.label}>Billable</Text>
                <Switch
                  value={billable}
                  onValueChange={setBillable}
                  trackColor={{ false: "#1f2937", true: "#3b82f6" }}
                />
              </View>

              <View style={{ height: 12 }} />
            </ScrollView>

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.btn, styles.btnGhost]}
                onPress={closeForm}
                disabled={saving}
              >
                <Text style={styles.btnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary]}
                onPress={onSave}
                disabled={saving}
              >
                <Text style={styles.btnPrimaryText}>
                  {saving ? "..." : editingId ? "Update" : "Create"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* USER PICKER (multi-select) */}
      <Modal
        visible={pickerMode !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setPickerMode(null)}
      >
        <View style={styles.modalWrap}>
          <View style={styles.pickerModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {pickerMode === "pm"
                  ? "Choose project managers"
                  : "Choose members"}
              </Text>
              <TouchableOpacity onPress={() => setPickerMode(null)}>
                <Ionicons
                  name="checkmark-done"
                  size={24}
                  color={c.accent}
                />
              </TouchableOpacity>
            </View>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={16} color={c.textMuted} />
              <TextInput
                style={styles.searchInput}
                value={pickerSearch}
                onChangeText={setPickerSearch}
                placeholder="Search..."
                placeholderTextColor={c.textFaint}
                autoCapitalize="none"
              />
            </View>
            <FlatList
              data={filteredUsers}
              keyExtractor={(u) => u.id}
              style={{ maxHeight: 420 }}
              renderItem={({ item }) => {
                const selected = pickerList.includes(item.id);
                return (
                  <TouchableOpacity
                    style={styles.pickerRow}
                    onPress={() =>
                      toggleUserInList(
                        pickerList,
                        pickerSetter,
                        item.id
                      )
                    }
                  >
                    <Ionicons
                      name={
                        selected ? "checkbox" : "square-outline"
                      }
                      size={22}
                      color={selected ? "#3b82f6" : "#64748b"}
                    />
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {item.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickerName}>
                        {item.name}
                      </Text>
                      <Text style={styles.pickerSub}>
                        {item.email} · {item.role}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: c.surfaceBorder,
    gap: 12 },
  title: { color: c.text, fontSize: 18, fontWeight: "800", flex: 1 },
  card: {
    backgroundColor: c.surface,
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10 },
  cardTitle: { color: c.text, fontSize: 15, fontWeight: "700" },
  codeChip: { color: c.textMuted, fontSize: 11, fontWeight: "600" },
  cardDesc: { color: c.textMuted, fontSize: 12, marginTop: 3 },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6 },
  statusText: { color: c.text, fontSize: 10, fontWeight: "800" },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10 },
  meta: { color: c.textMuted, fontSize: 11 },
  deleteBtn: { padding: 4 },
  emptyWrap: { flex: 1, justifyContent: "center" },
  empty: { alignItems: "center", gap: 10, padding: 30 },
  emptyText: { color: c.textMuted, fontSize: 14 },
  emptyBtn: {
    backgroundColor: c.accent,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 6 },
  emptyBtnText: { color: "#fff", fontWeight: "700" },
  modalWrap: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: c.overlay },
  modal: {
    backgroundColor: c.surfaceMuted,
    padding: 20,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    borderTopColor: c.surfaceBorder,
    maxHeight: "92%" },
  pickerModal: {
    backgroundColor: c.surfaceMuted,
    padding: 16,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    borderTopColor: c.surfaceBorder,
    maxHeight: "90%" },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10 },
  modalTitle: { color: c.text, fontSize: 17, fontWeight: "800" },
  label: {
    color: c.textMuted,
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: "700",
    marginTop: 14,
    marginBottom: 6 },
  input: {
    backgroundColor: c.surface,
    color: c.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    minHeight: 42 },
  hint: { color: c.textMuted, fontSize: 11, fontStyle: "italic" },
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
  chipTextActive: { color: c.text },
  actions: { flexDirection: "row", gap: 10, marginTop: 14 },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center" },
  btnGhost: { backgroundColor: c.surfaceMuted },
  btnGhostText: { color: c.textMuted, fontWeight: "700" },
  btnPrimary: { backgroundColor: c.accent },
  btnPrimaryText: { color: "#fff", fontWeight: "800" },
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
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: c.surfaceBorder },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.surfaceMuted,
    alignItems: "center",
    justifyContent: "center" },
  avatarText: { color: c.text, fontWeight: "700" },
  pickerName: { color: c.text, fontSize: 14, fontWeight: "700" },
  pickerSub: { color: c.textMuted, fontSize: 11, marginTop: 2 } });

