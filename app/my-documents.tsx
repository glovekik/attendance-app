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
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { FilePickButton } from "../src/components/FilePickButton";
import {
  listMyDocuments,
  addMyDocument,
  deleteMyDocument,
} from "../src/services/documents";
import { EmployeeDocument } from "../src/types";

const COMMON_CATEGORIES = [
  "PAN",
  "Aadhaar",
  "Resume",
  "Offer Letter",
  "Experience Letter",
  "10th",
  "Inter",
  "UG",
  "PG",
  "PhD",
  "Passport",
  "Salary Slip",
  "Certification",
  "Other",
];

export default function MyDocuments() {
  const router = useRouter();
  const [items, setItems] = useState<EmployeeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>("");

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [category, setCategory] = useState<string>("PAN");
  const [fileName, setFileName] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [expiresOn, setExpiresOn] = useState("");

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const data = await listMyDocuments(
        token,
        filter || undefined
      );
      setItems(data || []);
    } catch (err: any) {
      console.log("my-documents load error", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router, filter]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const onSave = async () => {
    if (!fileUrl.trim()) return Alert.alert("Pick or paste a file URL");
    if (!fileName.trim()) return Alert.alert("File name required");
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await addMyDocument(token, {
        category,
        fileName: fileName.trim(),
        fileUrl: fileUrl.trim(),
        notes: notes.trim() || undefined,
        expiresOn: expiresOn.trim() || undefined,
      });
      setShowForm(false);
      setFileName("");
      setFileUrl("");
      setNotes("");
      setExpiresOn("");
      load();
    } catch (err: any) {
      Alert.alert("Save failed", err?.message || "");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = (d: EmployeeDocument) => {
    Alert.alert("Delete document?", d.fileName, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const token = await AsyncStorage.getItem("token");
            if (!token) return;
            await deleteMyDocument(token, d.id);
            setItems((prev) => prev.filter((x) => x.id !== d.id));
          } catch (err: any) {
            Alert.alert("Delete failed", err?.message || "");
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>My Documents</Text>
        <TouchableOpacity onPress={() => setShowForm(true)}>
          <Ionicons name="add-circle" size={28} color="#3b82f6" />
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 12,
          paddingVertical: 8,
          gap: 6,
        }}
      >
        <TouchableOpacity
          style={[styles.chip, !filter && styles.chipActive]}
          onPress={() => setFilter("")}
        >
          <Text
            style={[styles.chipText, !filter && styles.chipTextActive]}
          >
            All
          </Text>
        </TouchableOpacity>
        {COMMON_CATEGORIES.map((c) => (
          <TouchableOpacity
            key={c}
            style={[styles.chip, filter === c && styles.chipActive]}
            onPress={() => setFilter(c)}
          >
            <Text
              style={[
                styles.chipText,
                filter === c && styles.chipTextActive,
              ]}
            >
              {c}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : (
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
                name="folder-open-outline"
                size={42}
                color="#475569"
              />
              <Text style={styles.emptyText}>
                {filter ? `No ${filter} docs` : "No documents yet"}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.iconBox}>
                <Ionicons
                  name="document-text-outline"
                  size={20}
                  color="#fff"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName} numberOfLines={1}>
                  {item.fileName}
                </Text>
                <Text style={styles.cardCat}>{item.category}</Text>
                {!!item.expiresOn && (
                  <Text style={styles.expiry}>
                    Expires {item.expiresOn}
                  </Text>
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
            </View>
          )}
        />
      )}

      <Modal
        visible={showForm}
        animationType="slide"
        transparent
        onRequestClose={() => setShowForm(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalWrap}
        >
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Upload document</Text>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <Ionicons name="close" size={24} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 520 }}>
              <Text style={styles.label}>Category *</Text>
              <View style={styles.chipRow}>
                {COMMON_CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[
                      styles.chip,
                      category === c && styles.chipActive,
                    ]}
                    onPress={() => setCategory(c)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        category === c && styles.chipTextActive,
                      ]}
                    >
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>File</Text>
              <FilePickButton
                label="Pick file"
                onUploaded={(url, name) => {
                  setFileUrl(url);
                  if (!fileName) setFileName(name);
                }}
              />
              <TextInput
                style={[styles.input, { marginTop: 8 }]}
                value={fileUrl}
                onChangeText={setFileUrl}
                placeholder="or paste URL"
                placeholderTextColor="#475569"
                autoCapitalize="none"
              />

              <Text style={styles.label}>File name *</Text>
              <TextInput
                style={styles.input}
                value={fileName}
                onChangeText={setFileName}
                placeholder="pan-front.pdf"
                placeholderTextColor="#475569"
              />

              <Text style={styles.label}>Notes</Text>
              <TextInput
                style={[styles.input, { minHeight: 60 }]}
                value={notes}
                onChangeText={setNotes}
                multiline
                textAlignVertical="top"
                placeholderTextColor="#475569"
              />

              <Text style={styles.label}>Expires on (optional)</Text>
              <TextInput
                style={styles.input}
                value={expiresOn}
                onChangeText={setExpiresOn}
                placeholder="2030-12-31"
                placeholderTextColor="#475569"
                autoCapitalize="none"
              />
              <View style={{ height: 14 }} />
            </ScrollView>

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.btn, styles.btnGhost]}
                onPress={() => setShowForm(false)}
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
                  {saving ? "..." : "Save"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#1f2937",
    gap: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#3b82f6",
    alignItems: "center",
    justifyContent: "center",
  },
  cardName: { color: "#fff", fontSize: 14, fontWeight: "700" },
  cardCat: { color: "#94a3b8", fontSize: 11, marginTop: 2 },
  expiry: { color: "#f59e0b", fontSize: 11, marginTop: 2 },
  deleteBtn: { padding: 6 },
  emptyWrap: { flex: 1, justifyContent: "center" },
  empty: { alignItems: "center", gap: 10 },
  emptyText: { color: "#475569", fontSize: 14 },
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
    maxHeight: "92%",
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
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  chipActive: { backgroundColor: "#3b82f6", borderColor: "#3b82f6" },
  chipText: { color: "#94a3b8", fontSize: 11, fontWeight: "700" },
  chipTextActive: { color: "#fff" },
  actions: { flexDirection: "row", gap: 10, marginTop: 14 },
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
});
