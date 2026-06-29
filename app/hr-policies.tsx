import React, { useCallback, useEffect, useState, useMemo} from "react";

import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
  Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebModal, ModalActions } from "../src/components/WebModal";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { FilePickButton } from "../src/components/FilePickButton";
import { DatePickerField } from "../src/components/DatePickerField";
import {
  listCompanyDocuments,
  hrCreateCompanyDocument,
  hrUpdateCompanyDocument,
  hrDeleteCompanyDocument,
  CompanyDocument,
  COMPANY_DOC_CATEGORIES } from "../src/services/companyDocs";
import { confirmAction, notify } from "../src/utils/confirm";

import { useTheme } from "../src/theme/ThemeProvider";
export default function HrPolicies() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);
  const [docs, setDocs] = useState<CompanyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Form
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>(COMPANY_DOC_CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const data = await listCompanyDocuments(token);
      setDocs(data || []);
    } catch (err: any) {
      Alert.alert(
        "Couldn't load policies",
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

  const openCreate = () => {
    setEditingId(null);
    setTitle("");
    setCategory(COMPANY_DOC_CATEGORIES[0]);
    setDescription("");
    setFileName("");
    setFileUrl("");
    setEffectiveFrom("");
    setExpiresOn("");
    setShowForm(true);
  };

  const openEdit = (d: CompanyDocument) => {
    setEditingId(d.id);
    setTitle(d.title);
    setCategory(d.category);
    setDescription(d.description || "");
    setFileName(d.fileName);
    setFileUrl(d.fileUrl);
    setEffectiveFrom(d.effectiveFrom || "");
    setExpiresOn(d.expiresOn || "");
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setSaving(false);
  };

  const onSave = async () => {
    if (saving) return;
    if (!title.trim()) return Alert.alert("Title required");
    if (!fileUrl.trim() || !fileName.trim())
      return Alert.alert("Pick a file");
    try {
      setSaving(true);
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const payload = {
        title: title.trim(),
        category,
        description: description.trim() || undefined,
        fileName: fileName.trim(),
        fileUrl: fileUrl.trim(),
        effectiveFrom: effectiveFrom.trim() || undefined,
        expiresOn: expiresOn.trim() || undefined };
      if (editingId) {
        await hrUpdateCompanyDocument(token, editingId, payload);
      } else {
        await hrCreateCompanyDocument(token, payload);
      }
      closeForm();
      await load();
    } catch (err: any) {
      Alert.alert("Save failed", err?.message || "");
      setSaving(false);
    }
  };

  const onDelete = async (d: CompanyDocument) => {
    const ok = await confirmAction({
      title: "Delete this document?",
      message: d.title,
      confirmLabel: "Delete",
      destructive: true });
    if (!ok) return;
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await hrDeleteCompanyDocument(token, d.id);
      setDocs((prev) => prev.filter((x) => x.id !== d.id));
    } catch (err: any) {
      notify("Delete failed", err?.message || "");
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#0891b2" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}>
          <Ionicons name="arrow-back" size={24} color={c.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Company Policies</Text>
          <Text style={styles.subtitle}>
            {docs.length} document{docs.length === 1 ? "" : "s"}
          </Text>
        </View>
        <TouchableOpacity onPress={openCreate}>
          <Ionicons name="add-circle" size={28} color="#0891b2" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={docs}
        keyExtractor={(d) => d.id}
        contentContainerStyle={
          docs.length === 0 ? styles.emptyWrap : { padding: 12 }
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor="#0891b2"
            colors={["#0891b2"]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="document-outline" size={42} color={c.textFaint} />
            <Text style={styles.emptyText}>
              No company documents yet. Upload your first policy or handbook.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.cardBody}
              onPress={() => openEdit(item)}
              activeOpacity={0.85}
            >
              <View style={styles.iconBox}>
                <Ionicons
                  name="document-text-outline"
                  size={20}
                  color="#fff"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardName}>{item.title}</Text>
                <Text style={styles.cardMeta}>
                  {item.category} · {item.fileName}
                </Text>
                {!!item.effectiveFrom && (
                  <Text style={styles.cardSub}>
                    Effective {item.effectiveFrom}
                    {item.expiresOn ? ` → ${item.expiresOn}` : ""}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onDelete(item)}
              style={styles.deleteBtn}
              hitSlop={10}
            >
              <Ionicons name="trash-outline" size={18} color="#ef4444" />
            </TouchableOpacity>
          </View>
        )}
      />

      <WebModal
        visible={showForm}
        onClose={closeForm}
        title={editingId ? "Edit document" : "Upload document"}
        size="md"
        footer={
          <ModalActions align="spread">
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
                {saving ? "…" : editingId ? "Update" : "Upload"}
              </Text>
            </TouchableOpacity>
          </ModalActions>
        }
      >
              <Text style={styles.label}>Title *</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Leave Policy 2026"
                placeholderTextColor={c.textFaint}
              />

              <Text style={styles.label}>Category</Text>
              <View style={styles.chipRow}>
                {COMPANY_DOC_CATEGORIES.map((c) => (
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

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, { minHeight: 70 }]}
                value={description}
                onChangeText={setDescription}
                placeholder="Optional summary or notes"
                placeholderTextColor={c.textFaint}
                multiline
                textAlignVertical="top"
              />

              <Text style={styles.label}>File *</Text>
              <FilePickButton
                label={fileName ? `Replace (${fileName})` : "Upload file"}
                onUploaded={(url, name) => {
                  setFileUrl(url);
                  setFileName(name);
                }}
              />
              {!!fileName && (
                <Text style={styles.fileHint}>{fileName}</Text>
              )}

              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Effective from</Text>
                  <DatePickerField
                    value={effectiveFrom}
                    onChange={setEffectiveFrom}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Expires on</Text>
                  <DatePickerField
                    value={expiresOn}
                    onChange={setExpiresOn}
                    min={effectiveFrom || undefined}
                  />
                </View>
              </View>

      </WebModal>
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
  title: { color: c.text, fontSize: 18, fontWeight: "800" },
  subtitle: { color: c.textMuted, fontSize: 12, marginTop: 2 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surface,
    paddingRight: 14,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: c.surfaceBorder,
    gap: 12 },
  cardBody: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12 },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#0891b2",
    alignItems: "center",
    justifyContent: "center" },
  cardName: { color: c.text, fontSize: 14, fontWeight: "700" },
  cardMeta: { color: c.textMuted, fontSize: 11, marginTop: 2 },
  cardSub: { color: c.textMuted, fontSize: 11, marginTop: 2 },
  deleteBtn: { padding: 6 },
  emptyWrap: { flex: 1, justifyContent: "center" },
  empty: { alignItems: "center", gap: 10, padding: 30 },
  emptyText: {
    color: c.textMuted,
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 30 },

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
  chipActive: { backgroundColor: "#0891b2", borderColor: "#0891b2" },
  chipText: { color: c.textMuted, fontSize: 11, fontWeight: "700" },
  chipTextActive: { color: c.text },
  fileHint: { color: "#06b6d4", fontSize: 11, marginTop: 6 },

  actions: { flexDirection: "row", gap: 10, marginTop: 18 },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center" },
  btnGhost: { backgroundColor: c.surfaceMuted },
  btnGhostText: { color: c.textMuted, fontWeight: "700" },
  btnPrimary: { backgroundColor: "#0891b2" },
  btnPrimaryText: { color: c.text, fontWeight: "800" } });

