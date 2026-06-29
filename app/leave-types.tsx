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
  Switch,
  Platform,
  Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { WebModal, ModalActions } from "../src/components/WebModal";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useRouter } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import {
  hrCreateLeaveType,
  hrListLeaveTypes,
  hrUpdateLeaveType,
  hrDeleteLeaveType } from "../src/services/leaves";

import { LeaveType } from "../src/types";

import { useTheme } from "../src/theme/ThemeProvider";
export default function LeaveTypes() {

  const router = useRouter();

  const { theme } = useTheme();

  const c = theme.colors;

  const styles = useMemo(() => makeStyles(c), [c]);

  const [items, setItems] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);

  const [popup, setPopup] = useState({
    visible: false,
    type: "success" as "success" | "error",
    message: "" });

  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [daysPerMonth, setDaysPerMonth] = useState("0");
  const [daysPerYear, setDaysPerYear] = useState("0");
  const [allowHalfDay, setAllowHalfDay] = useState(true);
  const [requiresAttachment, setRequiresAttachment] =
    useState(false);
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [saving, setSaving] = useState(false);
  const [seedingDefaults, setSeedingDefaults] = useState(false);

  // Reasonable default set HR can bootstrap in one tap. Once these exist,
  // employees' `/leaves/balance` lazy-seeds their per-user rows on first
  // load, so balances start showing immediately. Codes are conventional
  // (CL/SL/EL/LOP) but the names/quotas are typical for IN orgs.
  const DEFAULT_LEAVE_TYPES = [
    {
      code: "CL",
      name: "Casual Leave",
      daysPerMonth: 0,
      daysPerYear: 12,
      allowHalfDay: true,
      requiresAttachment: false,
      description: "Personal time off, full-year quota allocated upfront.",
      isActive: true },
    {
      code: "SL",
      name: "Sick Leave",
      daysPerMonth: 0,
      daysPerYear: 12,
      allowHalfDay: true,
      requiresAttachment: false,
      description: "Health-related leave, allocated upfront.",
      isActive: true },
    {
      code: "EL",
      name: "Earned Leave",
      daysPerMonth: 1.5,
      daysPerYear: 18,
      allowHalfDay: false,
      requiresAttachment: false,
      description: "Accrues 1.5 days per month, capped at 18/year.",
      isActive: true },
    {
      code: "LOP",
      name: "Loss of Pay",
      daysPerMonth: 0,
      daysPerYear: 0,
      allowHalfDay: true,
      requiresAttachment: false,
      description: "Unpaid leave — used when other balances are exhausted.",
      isActive: true },
  ];

  const seedDefaults = async () => {
    if (seedingDefaults) return;
    try {
      setSeedingDefaults(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const existingCodes = new Set(items.map((t) => t.code));
      let created = 0;
      for (const t of DEFAULT_LEAVE_TYPES) {
        if (existingCodes.has(t.code)) continue;
        try {
          await hrCreateLeaveType(token, t);
          created += 1;
        } catch {
          /* skip individual failures; loop continues */
        }
      }
      showPopup(
        created > 0
          ? `${created} leave type${created > 1 ? "s" : ""} created`
          : "Default types already exist",
        created > 0 ? "success" : "error"
      );
      await load();
    } catch (err: any) {
      showPopup(err?.message || "Failed to seed defaults", "error");
    } finally {
      setSeedingDefaults(false);
    }
  };

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
      const res = await hrListLeaveTypes(token);
      setItems(res || []);
    } catch (err: any) {
      showPopup(err?.message || "Failed to load", "error");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const reset = () => {
    setEditingId(null);
    setCode("");
    setName("");
    setDaysPerMonth("0");
    setDaysPerYear("0");
    setAllowHalfDay(true);
    setRequiresAttachment(false);
    setDescription("");
    setIsActive(true);
  };

  const openCreate = () => {
    reset();
    setModalVisible(true);
  };

  const openEdit = (lt: LeaveType) => {
    setEditingId(lt.id);
    setCode(lt.code);
    setName(lt.name);
    setDaysPerMonth(String(lt.daysPerMonth));
    setDaysPerYear(String(lt.daysPerYear));
    setAllowHalfDay(lt.allowHalfDay);
    setRequiresAttachment(lt.requiresAttachment);
    setDescription(lt.description || "");
    setIsActive(lt.isActive);
    setModalVisible(true);
  };

  const save = async () => {

    if (saving) return;

    if (!code.trim()) {
      showPopup("Code required", "error");
      return;
    }
    if (!name.trim()) {
      showPopup("Name required", "error");
      return;
    }

    const dpm = parseFloat(daysPerMonth) || 0;
    const dpy = parseFloat(daysPerYear) || 0;

    if (dpm < 0 || dpy < 0) {
      showPopup("Days must be ≥ 0", "error");
      return;
    }

    try {
      setSaving(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;

      const payload = {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        daysPerMonth: dpm,
        daysPerYear: dpy,
        allowHalfDay,
        requiresAttachment,
        description: description.trim() || undefined,
        isActive };

      if (editingId) {
        await hrUpdateLeaveType(token, editingId, payload);
        showPopup("Leave type updated");
      } else {
        await hrCreateLeaveType(token, payload);
        showPopup("Leave type created");
      }

      setModalVisible(false);
      reset();
      await load();
    } catch (err: any) {
      showPopup(err?.message || "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  const askDelete = (lt: LeaveType) => {
    if (Platform.OS === "web") {
      if (
        typeof window !== "undefined" &&
        window.confirm(`Delete "${lt.name}"?`)
      ) {
        doDelete(lt.id);
      }
      return;
    }
    Alert.alert(
      "Delete leave type?",
      lt.name,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => doDelete(lt.id) },
      ]
    );
  };

  const doDelete = async (id: string) => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await hrDeleteLeaveType(token, id);
      showPopup("Deleted");
      await load();
    } catch (err: any) {
      showPopup(err?.message || "Failed to delete", "error");
    }
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

      {popup.visible && (
        <View
          style={[
            styles.popup,
            popup.type === "success"
              ? styles.successPopup
              : styles.errorPopup,
          ]}
        >
          <Text style={styles.popupText}>{popup.message}</Text>
        </View>
      )}

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
      >

        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          >
            <Ionicons name="chevron-back" size={22} color={c.text} />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Leave Types</Text>
            <Text style={styles.subtitle}>
              {items.length} configured
            </Text>
          </View>

          <TouchableOpacity
            style={styles.addBtn}
            onPress={openCreate}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {items.map((lt) => (
          <View
            key={lt.id}
            style={[
              styles.card,
              !lt.isActive && { opacity: 0.55 },
            ]}
          >
            <View style={{ flex: 1 }}>
              <View style={styles.cardTopRow}>
                <Text style={styles.cardName}>{lt.name}</Text>
                <View
                  style={[
                    styles.codeChip,
                    !lt.isActive && {
                      backgroundColor: c.surfaceMuted },
                  ]}
                >
                  <Text style={styles.codeChipText}>
                    {lt.code}
                  </Text>
                </View>
              </View>

              <Text style={styles.cardMeta}>
                {lt.daysPerMonth}/mo  ·  {lt.daysPerYear}/yr
                {lt.allowHalfDay ? "  ·  half-day" : ""}
                {lt.requiresAttachment ? "  ·  attach req" : ""}
              </Text>

              {lt.description ? (
                <Text style={styles.cardDesc}>
                  {lt.description}
                </Text>
              ) : null}
            </View>

            <View style={styles.cardActions}>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => openEdit(lt)}
                hitSlop={6}
              >
                <Ionicons
                  name="create-outline"
                  size={16}
                  color="#fff"
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.iconBtn,
                  { backgroundColor: "#dc2626" },
                ]}
                onPress={() => askDelete(lt)}
                hitSlop={6}
              >
                <Ionicons
                  name="trash-outline"
                  size={16}
                  color="#fff"
                />
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {items.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>
              No leave types yet
            </Text>
            <Text style={styles.emptySub}>
              Without leave types, employees won&apos;t see any balance on
              their My Leaves screen. Set up the standard set (Casual,
              Sick, Earned, LOP) in one tap, or tap + above to define
              your own.
            </Text>
            <TouchableOpacity
              style={[
                styles.seedBtn,
                seedingDefaults && { opacity: 0.6 },
              ]}
              onPress={seedDefaults}
              disabled={seedingDefaults}
            >
              {seedingDefaults ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.seedBtnText}>
                  Create default leave types
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>

      {/* MODAL */}
      <WebModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={editingId ? "Edit Leave Type" : "New Leave Type"}
        size="md"
        footer={
          <ModalActions align="spread">
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
          </ModalActions>
        }
      >
              <Text style={styles.label}>Code</Text>
              <TextInput
                style={[
                  styles.input,
                  editingId && styles.inputDisabled,
                ]}
                value={code}
                onChangeText={setCode}
                placeholder="EARNED"
                placeholderTextColor={c.textFaint}
                autoCapitalize="characters"
                editable={!editingId}
              />

              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Earned Leave"
                placeholderTextColor={c.textFaint}
              />

              <View style={styles.twoCol}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Days/month</Text>
                  <TextInput
                    style={styles.input}
                    value={daysPerMonth}
                    onChangeText={setDaysPerMonth}
                    placeholder="1"
                    placeholderTextColor={c.textFaint}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Days/year</Text>
                  <TextInput
                    style={styles.input}
                    value={daysPerYear}
                    onChangeText={setDaysPerYear}
                    placeholder="12"
                    placeholderTextColor={c.textFaint}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View style={styles.toggleRow}>
                <Text style={styles.label}>Allow half-day</Text>
                <Switch
                  value={allowHalfDay}
                  onValueChange={setAllowHalfDay}
                  trackColor={{
                    false: "#374151",
                    true: "#2563eb" }}
                  thumbColor="#fff"
                />
              </View>

              <View style={styles.toggleRow}>
                <Text style={styles.label}>
                  Attachment required
                </Text>
                <Switch
                  value={requiresAttachment}
                  onValueChange={setRequiresAttachment}
                  trackColor={{
                    false: "#374151",
                    true: "#2563eb" }}
                  thumbColor="#fff"
                />
              </View>

              <View style={styles.toggleRow}>
                <Text style={styles.label}>Active</Text>
                <Switch
                  value={isActive}
                  onValueChange={setIsActive}
                  trackColor={{
                    false: "#374151",
                    true: "#16a34a" }}
                  thumbColor="#fff"
                />
              </View>

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.multiline]}
                value={description}
                onChangeText={setDescription}
                placeholder="Optional"
                placeholderTextColor={c.textFaint}
                multiline
              />
      </WebModal>

    </SafeAreaView>
  );
}

const makeStyles = (c: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 60 },
  loader: {
    flex: 1,
    backgroundColor: c.bg,
    justifyContent: "center",
    alignItems: "center" },

  popup: {
    position: "absolute",
    top: 60,
    left: 20,
    right: 20,
    padding: 14,
    borderRadius: 14,
    zIndex: 999 },
  successPopup: { backgroundColor: "#16a34a" },
  errorPopup: { backgroundColor: "#dc2626" },
  popupText: { color: c.text, fontWeight: "700", textAlign: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
    marginTop: 10,
    gap: 12 },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: c.surface,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  addBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: c.accent,
    justifyContent: "center",
    alignItems: "center" },
  title: { color: c.text, fontSize: 24, fontWeight: "800" },
  subtitle: { color: c.textMuted, fontSize: 13, marginTop: 3 },

  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    gap: 10 },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4 },
  cardName: { color: c.text, fontSize: 15, fontWeight: "700" },
  codeChip: {
    backgroundColor: c.accent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999 },
  codeChipText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5 },
  cardMeta: { color: c.textMuted, fontSize: 12 },
  cardDesc: {
    color: c.text,
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17 },

  cardActions: {
    flexDirection: "column",
    gap: 6 },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: c.accent,
    justifyContent: "center",
    alignItems: "center" },

  emptyBox: {
    alignItems: "center",
    padding: 40,
    backgroundColor: c.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    marginTop: 20 },
  emptyTitle: { color: c.text, fontSize: 16, fontWeight: "700" },
  emptySub: {
    color: c.textMuted,
    fontSize: 13,
    marginTop: 6,
    textAlign: "center" },
  seedBtn: {
    marginTop: 16,
    backgroundColor: c.accent,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 220,
    alignItems: "center" },
  seedBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },

  modalOverlay: {
    flex: 1,
    backgroundColor: c.overlay,
    justifyContent: "center",
    padding: 20 },
  modalCard: {
    backgroundColor: c.surface,
    borderRadius: 18,
    padding: 20,
    maxHeight: "92%" },
  modalTitle: {
    color: c.text,
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 12 },

  label: {
    color: c.textMuted,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 14 },
  input: {
    backgroundColor: c.surfaceMuted,
    color: c.text,
    borderRadius: 12,
    padding: 13,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    fontSize: 14 },
  inputDisabled: { opacity: 0.55 },
  multiline: {
    minHeight: 70,
    textAlignVertical: "top" },

  twoCol: {
    flexDirection: "row",
    gap: 10 },

  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between" },

  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 22 },
  cancelBtn: {
    flex: 1,
    backgroundColor: c.surfaceMuted,
    padding: 14,
    borderRadius: 12,
    alignItems: "center" },
  saveBtn: {
    flex: 1,
    backgroundColor: "#16a34a",
    padding: 14,
    borderRadius: 12,
    alignItems: "center" },
  modalBtnText: { color: c.text, fontWeight: "700" } });

