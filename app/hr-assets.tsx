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
  Platform,
  Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { WebModal, ModalActions } from "../src/components/WebModal";

import AsyncStorage from "@react-native-async-storage/async-storage";

import { useRouter } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import {
  hrCreateAsset,
  hrListAssets,
  hrUpdateAsset,
  hrDeleteAsset,
  hrAssignAsset,
  hrReturnAsset } from "../src/services/assets";

import { listUsers } from "../src/services/users";

import { useTheme } from "../src/theme/ThemeProvider";
import {
  Asset,
  AssetStatus,
  User } from "../src/types";

const STATUS_FILTERS: (AssetStatus | "ALL")[] = [
  "ALL",
  "AVAILABLE",
  "ASSIGNED",
  "DAMAGED",
  "LOST",
  "RETIRED",
];

const RETURN_STATUSES: ("AVAILABLE" | "DAMAGED" | "LOST")[] = [
  "AVAILABLE",
  "DAMAGED",
  "LOST",
];

const statusColor = (s: AssetStatus) => {
  switch (s) {
    case "AVAILABLE": return "#16a34a";
    case "ASSIGNED":  return "#2563eb";
    case "DAMAGED":   return "#f59e0b";
    case "LOST":      return "#dc2626";
    case "RETIRED":   return "#6b7280";
  }
};

export default function HRAssets() {

  const router = useRouter();

  const { theme } = useTheme();

  const c = theme.colors;

  const styles = useMemo(() => makeStyles(c), [c]);

  const [assets, setAssets] = useState<Asset[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<AssetStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");

  const [popup, setPopup] = useState({
    visible: false,
    type: "success" as "success" | "error",
    message: "" });

  // ===== form state =====
  const [formVisible, setFormVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // ===== assign state =====
  const [assignVisible, setAssignVisible] = useState(false);
  const [assignTarget, setAssignTarget] = useState<Asset | null>(null);
  const [assignUserId, setAssignUserId] = useState("");
  const [assignNotes, setAssignNotes] = useState("");

  // ===== return state =====
  const [returnVisible, setReturnVisible] = useState(false);
  const [returnTarget, setReturnTarget] = useState<Asset | null>(null);
  const [returnStatus, setReturnStatus] =
    useState<"AVAILABLE" | "DAMAGED" | "LOST">("AVAILABLE");
  const [returnNotes, setReturnNotes] = useState("");

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
      const filters =
        filter === "ALL" ? undefined : { status: filter };
      const [a, u] = await Promise.all([
        hrListAssets(token, filters),
        listUsers(token).catch(() => [] as User[]),
      ]);
      setAssets(a || []);
      setUsers(u || []);
    } catch (err: any) {
      showPopup(err?.message || "Failed to load", "error");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [filter]);

  const userName = (id?: string) => {
    if (!id) return "—";
    return users.find((u) => u.id === id)?.name || `…${id.slice(-4)}`;
  };

  // Inactive/terminated employees must not show up in the assign picker.
  // The full `users` list is still kept above so userName() can resolve
  // the name of someone an asset was assigned to before they left.
  const assignableUsers = useMemo(
    () =>
      users.filter(
        (u) => u.status !== "Inactive" && u.status !== "Terminated"
      ),
    [users]
  );

  // ===== form (create/edit) =====
  const resetForm = () => {
    setEditingId(null);
    setCode("");
    setName("");
    setCategory("");
    setSerialNumber("");
    setNotes("");
  };

  const openCreate = () => {
    resetForm();
    setFormVisible(true);
  };

  const openEdit = (a: Asset) => {
    setEditingId(a.id);
    setCode(a.code);
    setName(a.name);
    setCategory(a.category || "");
    setSerialNumber(a.serialNumber || "");
    setNotes(a.notes || "");
    setFormVisible(true);
  };

  const submitForm = async () => {
    if (saving) return;
    if (!name.trim()) {
      showPopup("Name required", "error");
      return;
    }
    if (!editingId && !code.trim()) {
      showPopup("Code required", "error");
      return;
    }
    if (!category.trim()) {
      showPopup("Category required", "error");
      return;
    }

    try {
      setSaving(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;

      if (editingId) {
        await hrUpdateAsset(token, editingId, {
          name: name.trim(),
          category: category.trim(),
          serialNumber: serialNumber.trim() || undefined,
          notes: notes.trim() || undefined });
        showPopup("Asset updated");
      } else {
        await hrCreateAsset(token, {
          code: code.trim(),
          name: name.trim(),
          category: category.trim(),
          serialNumber: serialNumber.trim() || undefined,
          notes: notes.trim() || undefined });
        showPopup("Asset created");
      }

      setFormVisible(false);
      resetForm();
      await load();
    } catch (err: any) {
      showPopup(err?.message || "Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  // ===== assign =====
  const openAssign = (a: Asset) => {
    setAssignTarget(a);
    setAssignUserId(assignableUsers[0]?.id || "");
    setAssignNotes("");
    setAssignVisible(true);
  };

  const submitAssign = async () => {
    if (!assignTarget || saving) return;
    if (!assignUserId) {
      showPopup("Pick a user", "error");
      return;
    }
    try {
      setSaving(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await hrAssignAsset(token, assignTarget.id, {
        userId: assignUserId,
        notes: assignNotes.trim() || undefined });
      showPopup("Assigned");
      setAssignVisible(false);
      await load();
    } catch (err: any) {
      showPopup(err?.message || "Failed to assign", "error");
    } finally {
      setSaving(false);
    }
  };

  // ===== return =====
  const openReturn = (a: Asset) => {
    setReturnTarget(a);
    setReturnStatus("AVAILABLE");
    setReturnNotes("");
    setReturnVisible(true);
  };

  const submitReturn = async () => {
    if (!returnTarget || saving) return;
    try {
      setSaving(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await hrReturnAsset(token, returnTarget.id, {
        status: returnStatus,
        notes: returnNotes.trim() || undefined });
      showPopup("Returned");
      setReturnVisible(false);
      await load();
    } catch (err: any) {
      showPopup(err?.message || "Failed to return", "error");
    } finally {
      setSaving(false);
    }
  };

  // ===== delete =====
  const askDelete = (a: Asset) => {
    if (Platform.OS === "web") {
      if (
        typeof window !== "undefined" &&
        window.confirm(`Delete ${a.name}?`)
      ) {
        doDelete(a.id);
      }
      return;
    }
    Alert.alert(
      "Delete asset?",
      a.name,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => doDelete(a.id) },
      ]
    );
  };

  const doDelete = async (id: string) => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await hrDeleteAsset(token, id);
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
            <Text style={styles.title}>Asset Inventory</Text>
            <Text style={styles.subtitle}>
              {assets.length} {filter === "ALL" ? "total" : filter.toLowerCase()}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.addBtn}
            onPress={openCreate}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* FILTERS */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {STATUS_FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              style={[
                styles.filterBtn,
                filter === f && styles.filterActive,
              ]}
              onPress={() => setFilter(f)}
            >
              <Text
                style={[
                  styles.filterText,
                  filter === f && { color: "#fff" },
                ]}
              >
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={c.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name, code, serial, category"
            placeholderTextColor={c.textFaint}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons
                name="close-circle"
                size={16}
                color={c.textMuted}
              />
            </TouchableOpacity>
          )}
        </View>

        {assets.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>No assets</Text>
            <Text style={styles.emptySub}>
              {filter === "ALL"
                ? "Tap + to add the first one."
                : `No ${filter.toLowerCase()} assets right now.`}
            </Text>
          </View>
        )}

        {assets
          .filter((a) => {
            const q = search.trim().toLowerCase();
            if (!q) return true;
            return (
              a.name.toLowerCase().includes(q) ||
              a.code.toLowerCase().includes(q) ||
              (a.category || "").toLowerCase().includes(q) ||
              (a.serialNumber || "").toLowerCase().includes(q)
            );
          })
          .map((a) => (
          <View key={a.id} style={styles.card}>

            <View style={styles.cardTopRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{a.name}</Text>
                <Text style={styles.cardMeta}>
                  {a.code}
                  {a.category ? `  ·  ${a.category}` : ""}
                  {a.serialNumber ? `  ·  SN ${a.serialNumber}` : ""}
                </Text>
              </View>
              <View
                style={[
                  styles.statusChip,
                  { backgroundColor: statusColor(a.status) },
                ]}
              >
                <Text style={styles.statusChipText}>
                  {a.status}
                </Text>
              </View>
            </View>

            {a.assignedToUserId ? (
              <Text style={styles.assignedLine}>
                Assigned to{" "}
                <Text style={{ color: "#fff", fontWeight: "700" }}>
                  {a.assignedTo?.name || userName(a.assignedToUserId)}
                </Text>
              </Text>
            ) : null}

            {a.notes ? (
              <Text style={styles.notesLine}>{a.notes}</Text>
            ) : null}

            <View style={styles.actions}>
              {a.status === "AVAILABLE" && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.assignBtn]}
                  onPress={() => openAssign(a)}
                >
                  <Ionicons
                    name="person-add-outline"
                    size={14}
                    color="#fff"
                  />
                  <Text style={styles.actionText}>Assign</Text>
                </TouchableOpacity>
              )}

              {a.status === "ASSIGNED" && (
                <TouchableOpacity
                  style={[styles.actionBtn, styles.returnBtn]}
                  onPress={() => openReturn(a)}
                >
                  <Ionicons
                    name="return-down-back-outline"
                    size={14}
                    color="#fff"
                  />
                  <Text style={styles.actionText}>Return</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.actionBtn, styles.editBtn]}
                onPress={() => openEdit(a)}
              >
                <Ionicons
                  name="create-outline"
                  size={14}
                  color="#fff"
                />
                <Text style={styles.actionText}>Edit</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.deleteBtn]}
                onPress={() => askDelete(a)}
              >
                <Ionicons
                  name="trash-outline"
                  size={14}
                  color="#fff"
                />
              </TouchableOpacity>
            </View>

          </View>
        ))}

      </ScrollView>

      {/* CREATE/EDIT MODAL */}
      <WebModal
        visible={formVisible}
        onClose={() => setFormVisible(false)}
        title={editingId ? "Edit Asset" : "New Asset"}
        size="md"
        footer={
          <ModalActions align="spread">
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setFormVisible(false)}
            >
              <Text style={styles.modalBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.saveBtn,
                saving && { opacity: 0.7 },
              ]}
              onPress={submitForm}
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
                placeholder="e.g. LAP-001"
                placeholderTextColor={c.textFaint}
                editable={!editingId}
              />

              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="MacBook Pro 14"
                placeholderTextColor={c.textFaint}
              />

              <Text style={styles.label}>Category</Text>
              <TextInput
                style={styles.input}
                value={category}
                onChangeText={setCategory}
                placeholder="Laptop / Phone / Monitor"
                placeholderTextColor={c.textFaint}
              />

              <Text style={styles.label}>Serial Number</Text>
              <TextInput
                style={styles.input}
                value={serialNumber}
                onChangeText={setSerialNumber}
                placeholder="Optional"
                placeholderTextColor={c.textFaint}
              />

              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.multiline]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Optional"
                placeholderTextColor={c.textFaint}
                multiline
              />
      </WebModal>

      {/* ASSIGN MODAL */}
      <WebModal
        visible={assignVisible}
        onClose={() => setAssignVisible(false)}
        title="Assign Asset"
        size="md"
        footer={
          <ModalActions align="spread">
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setAssignVisible(false)}
            >
              <Text style={styles.modalBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.saveBtn,
                saving && { opacity: 0.7 },
              ]}
              onPress={submitAssign}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.modalBtnText}>
                  Assign
                </Text>
              )}
            </TouchableOpacity>
          </ModalActions>
        }
      >
              <Text style={styles.hint}>
                {assignTarget?.name}{" · "}
                {assignTarget?.code}
              </Text>

              <Text style={styles.label}>Pick User</Text>
              <View style={styles.chipPicker}>
                {assignableUsers.length === 0 ? (
                  <Text style={styles.hint}>
                    No active employees to assign.
                  </Text>
                ) : (
                  assignableUsers.map((u) => (
                    <TouchableOpacity
                      key={u.id}
                      style={[
                        styles.pickBtn,
                        assignUserId === u.id && styles.pickActive,
                      ]}
                      onPress={() => setAssignUserId(u.id)}
                    >
                      <Text
                        style={[
                          styles.pickText,
                          assignUserId === u.id && {
                            color: "#fff" },
                        ]}
                      >
                        {u.name}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </View>

              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.multiline]}
                value={assignNotes}
                onChangeText={setAssignNotes}
                placeholder="Optional"
                placeholderTextColor={c.textFaint}
                multiline
              />
      </WebModal>

      {/* RETURN MODAL */}
      <WebModal
        visible={returnVisible}
        onClose={() => setReturnVisible(false)}
        title="Return Asset"
        size="md"
        footer={
          <ModalActions align="spread">
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setReturnVisible(false)}
            >
              <Text style={styles.modalBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.saveBtn,
                saving && { opacity: 0.7 },
              ]}
              onPress={submitReturn}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.modalBtnText}>Return</Text>
              )}
            </TouchableOpacity>
          </ModalActions>
        }
      >
              <Text style={styles.hint}>
                {returnTarget?.name}{" · "}
                from{" "}
                {returnTarget
                  ? userName(returnTarget.assignedToUserId)
                  : ""}
              </Text>

              <Text style={styles.label}>New Status</Text>
              <View style={styles.chipPicker}>
                {RETURN_STATUSES.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[
                      styles.pickBtn,
                      returnStatus === s && styles.pickActive,
                    ]}
                    onPress={() => setReturnStatus(s)}
                  >
                    <Text
                      style={[
                        styles.pickText,
                        returnStatus === s && { color: "#fff" },
                      ]}
                    >
                      {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, styles.multiline]}
                value={returnNotes}
                onChangeText={setReturnNotes}
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
    marginBottom: 12,
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

  filterRow: {
    gap: 6,
    paddingBottom: 14 },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    gap: 8 },

  searchInput: {
    flex: 1,
    color: c.text,
    paddingVertical: 10,
    fontSize: 14 },
  filterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: c.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  filterActive: {
    backgroundColor: c.accent,
    borderColor: c.accent },
  filterText: {
    color: c.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5 },

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

  card: {
    backgroundColor: c.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10 },
  cardName: { color: c.text, fontSize: 15, fontWeight: "700" },
  cardMeta: { color: c.textMuted, fontSize: 12, marginTop: 4 },

  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999 },
  statusChipText: {
    color: c.text,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5 },

  assignedLine: {
    color: c.textMuted,
    fontSize: 12,
    marginTop: 8 },
  notesLine: {
    color: c.text,
    fontSize: 12,
    marginTop: 6,
    lineHeight: 17 },

  actions: {
    flexDirection: "row",
    gap: 6,
    marginTop: 12,
    flexWrap: "wrap" },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4 },
  assignBtn: { backgroundColor: c.accent },
  returnBtn: { backgroundColor: "#0d9488" },
  editBtn: { backgroundColor: c.surfaceMuted },
  deleteBtn: {
    backgroundColor: "#dc2626",
    paddingHorizontal: 10 },
  actionText: {
    color: c.text,
    fontSize: 12,
    fontWeight: "700" },

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
    fontWeight: "800" },
  hint: {
    color: c.textMuted,
    fontSize: 12,
    marginTop: 4,
    marginBottom: 8 },

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

  chipPicker: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6 },
  pickBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: c.surfaceMuted,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.surfaceBorder },
  pickActive: {
    backgroundColor: c.accent,
    borderColor: c.accent },
  pickText: {
    color: c.textMuted,
    fontSize: 12,
    fontWeight: "700" },

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

