import React, { useEffect, useState, useCallback } from "react";

import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  listDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from "../src/services/departments";
import { listUsers } from "../src/services/users";
import { Department, User } from "../src/types";

export default function HrDepartments() {
  const router = useRouter();
  const [items, setItems] = useState<Department[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [headUserId, setHeadUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Head picker
  const [showHeadPicker, setShowHeadPicker] = useState(false);
  const [headSearch, setHeadSearch] = useState("");

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const [depts, allUsers] = await Promise.all([
        listDepartments(token),
        listUsers(token).catch(() => [] as User[]),
      ]);
      setItems(depts || []);
      setUsers(allUsers || []);
    } catch (err: any) {
      console.log("departments load error", err);
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

  const openCreate = () => {
    setEditingId(null);
    setName("");
    setDescription("");
    setHeadUserId(null);
    setShowForm(true);
  };

  const openEdit = (d: Department) => {
    setEditingId(d.id);
    setName(d.name);
    setDescription(d.description || "");
    setHeadUserId(d.headUserId || null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setSaving(false);
  };

  const onSave = async () => {
    if (!name.trim()) {
      Alert.alert("Name is required");
      return;
    }
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        headUserId: headUserId || undefined,
      };
      if (editingId) {
        await updateDepartment(token, editingId, payload);
      } else {
        await createDepartment(token, payload);
      }
      closeForm();
      load();
    } catch (err: any) {
      Alert.alert("Save failed", err?.message || "");
      setSaving(false);
    }
  };

  const onDelete = (d: Department) => {
    Alert.alert(
      "Delete department?",
      `${d.name} — this will fail if any user still belongs to it.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem("token");
              if (!token) return;
              await deleteDepartment(token, d.id);
              setItems((prev) => prev.filter((x) => x.id !== d.id));
            } catch (err: any) {
              Alert.alert("Delete failed", err?.message || "");
            }
          },
        },
      ]
    );
  };

  const headUserName =
    users.find((u) => u.id === headUserId)?.name || "";

  const filteredUsers = users.filter((u) => {
    const q = headSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Departments</Text>
        <TouchableOpacity onPress={openCreate}>
          <Ionicons name="add-circle" size={28} color="#3b82f6" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(d) => d.id}
        contentContainerStyle={
          items.length === 0 ? styles.emptyWrap : { padding: 12 }
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3b82f6"
            colors={["#3b82f6"]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons
              name="business-outline"
              size={42}
              color="#475569"
            />
            <Text style={styles.emptyText}>
              No departments yet
            </Text>
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
          const head =
            users.find((u) => u.id === item.headUserId)?.name;
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => openEdit(item)}
              activeOpacity={0.8}
            >
              <View style={styles.iconBox}>
                <Ionicons
                  name="business-outline"
                  size={22}
                  color="#fff"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                {!!item.description && (
                  <Text style={styles.cardDesc} numberOfLines={1}>
                    {item.description}
                  </Text>
                )}
                {!!head && (
                  <Text style={styles.head}>Head: {head}</Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => onDelete(item)}
                style={styles.deleteBtn}
              >
                <Ionicons
                  name="trash-outline"
                  size={18}
                  color="#94a3b8"
                />
              </TouchableOpacity>
            </TouchableOpacity>
          );
        }}
      />

      {/* CREATE / EDIT MODAL */}
      <Modal
        visible={showForm}
        animationType="slide"
        transparent
        onRequestClose={closeForm}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalWrap}
        >
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingId ? "Edit department" : "New department"}
              </Text>
              <TouchableOpacity onPress={closeForm}>
                <Ionicons name="close" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Name *</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Engineering"
              placeholderTextColor="#475569"
            />

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, { minHeight: 70 }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Optional"
              placeholderTextColor="#475569"
              multiline
              textAlignVertical="top"
            />

            <Text style={styles.label}>Head (optional)</Text>
            <TouchableOpacity
              style={styles.input}
              onPress={() => setShowHeadPicker(true)}
            >
              <Text
                style={{
                  color: headUserId ? "#fff" : "#475569",
                }}
              >
                {headUserName || "Tap to choose..."}
              </Text>
            </TouchableOpacity>
            {!!headUserId && (
              <TouchableOpacity
                onPress={() => setHeadUserId(null)}
                style={{ marginTop: 4 }}
              >
                <Text style={styles.linkClear}>Clear</Text>
              </TouchableOpacity>
            )}

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

      {/* HEAD USER PICKER */}
      <Modal
        visible={showHeadPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowHeadPicker(false)}
      >
        <View style={styles.modalWrap}>
          <View style={styles.pickerModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose head</Text>
              <TouchableOpacity onPress={() => setShowHeadPicker(false)}>
                <Ionicons name="close" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={16} color="#64748b" />
              <TextInput
                style={styles.searchInput}
                value={headSearch}
                onChangeText={setHeadSearch}
                placeholder="Search by name or email"
                placeholderTextColor="#475569"
                autoCapitalize="none"
              />
            </View>
            <FlatList
              data={filteredUsers}
              keyExtractor={(u) => u.id}
              style={{ maxHeight: 380 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerRow}
                  onPress={() => {
                    setHeadUserId(item.id);
                    setShowHeadPicker(false);
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
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
    gap: 12,
  },
  title: { color: "#fff", fontSize: 18, fontWeight: "800", flex: 1 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111827",
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#1f2937",
    gap: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#0ea5e9",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  cardDesc: { color: "#94a3b8", fontSize: 12, marginTop: 3 },
  head: { color: "#64748b", fontSize: 11, marginTop: 4 },
  deleteBtn: { padding: 6 },
  emptyWrap: { flex: 1, justifyContent: "center" },
  empty: { alignItems: "center", gap: 10, padding: 30 },
  emptyText: { color: "#475569", fontSize: 14 },
  emptyBtn: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 6,
  },
  emptyBtnText: { color: "#fff", fontWeight: "700" },
  modalWrap: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modal: {
    backgroundColor: "#0f172a",
    padding: 20,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
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
  label: {
    color: "#94a3b8",
    fontSize: 11,
    letterSpacing: 1.2,
    fontWeight: "700",
    marginTop: 14,
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
  linkClear: { color: "#ef4444", fontSize: 11, fontWeight: "700" },
  actions: { flexDirection: "row", gap: 10, marginTop: 18 },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  btnGhost: { backgroundColor: "#1e293b" },
  btnGhostText: { color: "#94a3b8", fontWeight: "700" },
  btnPrimary: { backgroundColor: "#3b82f6" },
  btnPrimaryText: { color: "#fff", fontWeight: "800" },
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
