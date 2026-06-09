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
  ScrollView,
  Platform } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  listJobOpenings,
  createJobOpening,
  updateJobOpening,
  deleteJobOpening } from "../src/services/jobOpenings";
import { listDepartments } from "../src/services/departments";
import { useTheme } from "../src/theme/ThemeProvider";
import { jobOpeningStatusColor } from "../src/theme/statusColors";
import {
  Department,
  EMPLOYMENT_TYPES,
  EmploymentType,
  JOB_OPENING_STATUSES,
  JobOpening,
  JobOpeningStatus } from "../src/types";

export default function HrJobOpenings() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);
  const [items, setItems] = useState<JobOpening[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [location, setLocation] = useState("");
  const [employmentType, setEmploymentType] =
    useState<EmploymentType>("Full-time");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [salaryMin, setSalaryMin] = useState("");
  const [salaryMax, setSalaryMax] = useState("");
  const [openings, setOpenings] = useState("1");
  const [status, setStatus] = useState<JobOpeningStatus>("Open");

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const [jobs, depts] = await Promise.all([
        listJobOpenings(token),
        listDepartments(token).catch(() => [] as Department[]),
      ]);
      setItems(jobs || []);
      setDepartments(depts || []);
    } catch (err: any) {
      Alert.alert(
        "Couldn't load job openings",
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
    setTitle("");
    setDepartmentId(null);
    setLocation("");
    setEmploymentType("Full-time");
    setDescription("");
    setRequirements("");
    setSalaryMin("");
    setSalaryMax("");
    setOpenings("1");
    setStatus("Open");
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (j: JobOpening) => {
    setEditingId(j.id);
    setTitle(j.title);
    setDepartmentId(j.departmentId || null);
    setLocation(j.location || "");
    setEmploymentType(j.employmentType || "Full-time");
    setDescription(j.description || "");
    setRequirements(j.requirements || "");
    setSalaryMin(j.salaryMin != null ? String(j.salaryMin) : "");
    setSalaryMax(j.salaryMax != null ? String(j.salaryMax) : "");
    setOpenings(j.openings != null ? String(j.openings) : "1");
    setStatus(j.status);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    resetForm();
    setSaving(false);
  };

  const onSave = async () => {
    if (!title.trim()) {
      Alert.alert("Title is required");
      return;
    }
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const payload = {
        title: title.trim(),
        departmentId: departmentId || undefined,
        location: location.trim() || undefined,
        employmentType,
        description: description.trim() || undefined,
        requirements: requirements.trim() || undefined,
        salaryMin: salaryMin ? parseFloat(salaryMin) : undefined,
        salaryMax: salaryMax ? parseFloat(salaryMax) : undefined,
        openings: openings ? parseInt(openings, 10) : 1,
        status };
      if (editingId) {
        await updateJobOpening(token, editingId, payload);
      } else {
        await createJobOpening(token, payload);
      }
      closeForm();
      load();
    } catch (err: any) {
      Alert.alert("Save failed", err?.message || "");
      setSaving(false);
    }
  };

  const onDelete = (j: JobOpening) => {
    Alert.alert("Delete opening?", j.title, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const token = await AsyncStorage.getItem("token");
            if (!token) return;
            await deleteJobOpening(token, j.id);
            setItems((prev) => prev.filter((x) => x.id !== j.id));
          } catch (err: any) {
            Alert.alert("Delete failed", err?.message || "");
          }
        } },
    ]);
  };

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
        <Text style={styles.title}>Job Openings</Text>
        <TouchableOpacity onPress={openCreate}>
          <Ionicons name="add-circle" size={28} color={c.accent} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(j) => j.id}
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
              name="briefcase-outline"
              size={42}
              color={c.textFaint}
            />
            <Text style={styles.emptyText}>No openings yet</Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={openCreate}
            >
              <Text style={styles.emptyBtnText}>Create your first</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => {
          const dept =
            departments.find((d) => d.id === item.departmentId)?.name;
          const sc = jobOpeningStatusColor(item.status, c);
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => openEdit(item)}
              activeOpacity={0.8}
            >
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <View
                  style={[
                    styles.statusPill,
                    { backgroundColor: sc.bg },
                  ]}
                >
                  <Text style={[styles.statusText, { color: sc.fg }]}>{item.status}</Text>
                </View>
              </View>
              <Text style={styles.row}>
                {item.employmentType || "—"}
                {dept ? ` · ${dept}` : ""}
                {item.location ? ` · ${item.location}` : ""}
              </Text>
              <View style={styles.cardFooter}>
                <Text style={styles.meta}>
                  {item.openings || 1} opening(s)
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
                {editingId ? "Edit opening" : "New opening"}
              </Text>
              <TouchableOpacity onPress={closeForm}>
                <Ionicons name="close" size={24} color={c.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 520 }}>
              <Text style={styles.label}>Title *</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Senior Backend Engineer"
                placeholderTextColor={c.textFaint}
              />

              <Text style={styles.label}>Department</Text>
              <View style={styles.chipRow}>
                {departments.length === 0 ? (
                  <Text style={styles.hint}>
                    No departments yet
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

              <Text style={styles.label}>Location</Text>
              <TextInput
                style={styles.input}
                value={location}
                onChangeText={setLocation}
                placeholder="Bangalore / Remote"
                placeholderTextColor={c.textFaint}
              />

              <Text style={styles.label}>Employment Type</Text>
              <View style={styles.chipRow}>
                {EMPLOYMENT_TYPES.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.chip,
                      employmentType === t && styles.chipActive,
                    ]}
                    onPress={() => setEmploymentType(t)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        employmentType === t && styles.chipTextActive,
                      ]}
                    >
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, { minHeight: 80 }]}
                value={description}
                onChangeText={setDescription}
                placeholder="What the role is about"
                placeholderTextColor={c.textFaint}
                multiline
                textAlignVertical="top"
              />

              <Text style={styles.label}>Requirements</Text>
              <TextInput
                style={[styles.input, { minHeight: 80 }]}
                value={requirements}
                onChangeText={setRequirements}
                placeholder="Skills, experience, etc."
                placeholderTextColor={c.textFaint}
                multiline
                textAlignVertical="top"
              />

              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Salary min</Text>
                  <TextInput
                    style={styles.input}
                    value={salaryMin}
                    onChangeText={setSalaryMin}
                    placeholder="1500000"
                    placeholderTextColor={c.textFaint}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Salary max</Text>
                  <TextInput
                    style={styles.input}
                    value={salaryMax}
                    onChangeText={setSalaryMax}
                    placeholder="2500000"
                    placeholderTextColor={c.textFaint}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ width: 90 }}>
                  <Text style={styles.label}># Openings</Text>
                  <TextInput
                    style={styles.input}
                    value={openings}
                    onChangeText={setOpenings}
                    placeholder="1"
                    placeholderTextColor={c.textFaint}
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              <Text style={styles.label}>Status</Text>
              <View style={styles.chipRow}>
                {JOB_OPENING_STATUSES.map((s) => {
                  const sc = jobOpeningStatusColor(s, c);
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
    justifyContent: "space-between",
    gap: 8 },
  cardTitle: {
    color: c.text,
    fontSize: 15,
    fontWeight: "700",
    flex: 1 },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6 },
  statusText: { color: c.text, fontSize: 10, fontWeight: "800" },
  row: { color: c.textMuted, fontSize: 12, marginTop: 6 },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8 },
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
  hint: { color: c.textMuted, fontSize: 11, fontStyle: "italic" },
  actions: { flexDirection: "row", gap: 10, marginTop: 14 },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center" },
  btnGhost: { backgroundColor: c.surfaceMuted },
  btnGhostText: { color: c.textMuted, fontWeight: "700" },
  btnPrimary: { backgroundColor: c.accent },
  btnPrimaryText: { color: "#fff", fontWeight: "800" } });

