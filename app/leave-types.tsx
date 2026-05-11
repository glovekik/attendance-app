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
  Switch,
  Platform,
  Alert,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useRouter } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import {
  hrCreateLeaveType,
  hrListLeaveTypes,
  hrUpdateLeaveType,
  hrDeleteLeaveType,
} from "../src/services/leaves";

import { LeaveType } from "../src/types";

export default function LeaveTypes() {

  const router = useRouter();

  const [items, setItems] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);

  const [popup, setPopup] = useState({
    visible: false,
    type: "success" as "success" | "error",
    message: "",
  });

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
        isActive,
      };

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
          onPress: () => doDelete(lt.id),
        },
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
            onPress={() => router.back()}
          >
            <Ionicons name="chevron-back" size={22} color="#fff" />
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
                      backgroundColor: "#374151",
                    },
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
              Tap + to seed EARNED, SICK, etc.
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
                {editingId ? "Edit Leave Type" : "New Leave Type"}
              </Text>

              <Text style={styles.label}>Code</Text>
              <TextInput
                style={[
                  styles.input,
                  editingId && styles.inputDisabled,
                ]}
                value={code}
                onChangeText={setCode}
                placeholder="EARNED"
                placeholderTextColor="#64748b"
                autoCapitalize="characters"
                editable={!editingId}
              />

              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Earned Leave"
                placeholderTextColor="#64748b"
              />

              <View style={styles.twoCol}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Days/month</Text>
                  <TextInput
                    style={styles.input}
                    value={daysPerMonth}
                    onChangeText={setDaysPerMonth}
                    placeholder="1"
                    placeholderTextColor="#64748b"
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
                    placeholderTextColor="#64748b"
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
                    true: "#2563eb",
                  }}
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
                    true: "#2563eb",
                  }}
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
                    true: "#16a34a",
                  }}
                  thumbColor="#fff"
                />
              </View>

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.multiline]}
                value={description}
                onChangeText={setDescription}
                placeholder="Optional"
                placeholderTextColor="#64748b"
                multiline
              />

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

  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#1f2937",
    gap: 10,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  cardName: { color: "#fff", fontSize: 15, fontWeight: "700" },
  codeChip: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  codeChipText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  cardMeta: { color: "#94a3b8", fontSize: 12 },
  cardDesc: {
    color: "#cbd5e1",
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
  },

  cardActions: {
    flexDirection: "column",
    gap: 6,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#2563eb",
    justifyContent: "center",
    alignItems: "center",
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
  inputDisabled: { opacity: 0.55 },
  multiline: {
    minHeight: 70,
    textAlignVertical: "top",
  },

  twoCol: {
    flexDirection: "row",
    gap: 10,
  },

  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
