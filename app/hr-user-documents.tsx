import React, { useEffect, useState, useCallback, useMemo } from "react";

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
  ScrollView,
  Platform,
  Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { FilePickButton } from "../src/components/FilePickButton";
import { WebModal, ModalActions } from "../src/components/WebModal";
import {
  listUserDocuments,
  addUserDocument,
  deleteUserDocument,
  listUserRequiredDocuments,
  RequiredDocument,
  verifyUserRequiredDocument } from "../src/services/documents";
import { getUser } from "../src/services/users";
import { EmployeeDocument } from "../src/types";

import { useTheme } from "../src/theme/ThemeProvider";

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
];

export default function HrUserDocuments() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);
  const { id } = useLocalSearchParams<{ id: string }>();

  const [items, setItems] = useState<EmployeeDocument[]>([]);
  const [required, setRequired] = useState<RequiredDocument[]>([]);
  const [userName, setUserName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Local-only note buffer per category, attached on next HR upload.
  const [pendingNotes, setPendingNotes] = useState<Record<string, string>>({});
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  // Extra slots HR added on the fly for this employee.
  const [showAddCat, setShowAddCat] = useState(false);
  const [customCat, setCustomCat] = useState("");
  const [extraCats, setExtraCats] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!id) {
      if (router.canGoBack()) router.back();
      else router.replace("/");
      return;
    }
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const [docs, req, u] = await Promise.all([
        listUserDocuments(token, id),
        listUserRequiredDocuments(token, id).catch(() => []),
        userName
          ? Promise.resolve(null)
          : getUser(token, id).catch(() => null),
      ]);
      setItems(docs || []);
      setRequired(req || []);
      if (u && !userName) setUserName(u.name);
    } catch (err: any) {
      Alert.alert(
        "Couldn't load documents",
        err?.message || "Pull down to retry."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, router, userName]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const latestByCategory = useMemo(() => {
    const map = new Map<string, EmployeeDocument>();
    for (const d of items) {
      if (!map.has(d.category)) map.set(d.category, d);
    }
    return map;
  }, [items]);

  const categories = useMemo(() => {
    const set = new Set<string>(COMMON_CATEGORIES);
    for (const r of required) set.add(r.category);
    for (const d of items) set.add(d.category);
    for (const c of extraCats) set.add(c);
    return Array.from(set);
  }, [required, items, extraCats]);

  const requiredByCategory = useMemo(() => {
    const map = new Map<string, RequiredDocument>();
    for (const r of required) map.set(r.category, r);
    return map;
  }, [required]);

  const onUploaded = useCallback(
    async (category: string, url: string, fileName: string) => {
      if (!id) return;
      try {
        const token = await AsyncStorage.getItem("token");
        if (!token) return;

        // Replace flow — HR deletes any prior doc for the same
        // category before uploading the new one. HR is unrestricted
        // (delete works on both employee- and HR-uploaded rows).
        const prior = latestByCategory.get(category);
        if (prior) {
          try {
            await deleteUserDocument(token, id, prior.id);
          } catch {
            // Continue regardless — new upload still wins.
          }
        }

        const note = pendingNotes[category]?.trim();
        await addUserDocument(token, id, {
          category,
          fileName,
          fileUrl: url,
          notes: note || undefined });
        if (note) {
          setPendingNotes((prev) => {
            const next = { ...prev };
            delete next[category];
            return next;
          });
        }
        load();
      } catch (err: any) {
        Alert.alert("Upload failed", err?.message || "");
      }
    },
    [id, latestByCategory, pendingNotes, load]
  );

  const onDelete = (d: EmployeeDocument) => {
    if (!id) return;
    Alert.alert("Delete document?", d.fileName, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const token = await AsyncStorage.getItem("token");
            if (!token) return;
            await deleteUserDocument(token, id, d.id);
            setItems((prev) => prev.filter((x) => x.id !== d.id));
          } catch (err: any) {
            Alert.alert("Delete failed", err?.message || "");
          }
        } },
    ]);
  };

  const onVerify = async (category: string) => {
    if (!id) return;
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await verifyUserRequiredDocument(token, id, category);
      load();
    } catch (err: any) {
      Alert.alert("Verify failed", err?.message || "");
    }
  };

  const openNoteFor = (category: string) => {
    setNoteFor(category);
    setNoteDraft(pendingNotes[category] || "");
  };

  const saveNote = () => {
    if (!noteFor) return;
    const trimmed = noteDraft.trim();
    setPendingNotes((prev) => {
      const next = { ...prev };
      if (trimmed) next[noteFor] = trimmed;
      else delete next[noteFor];
      return next;
    });
    setNoteFor(null);
    setNoteDraft("");
  };

  const addCustomCategory = () => {
    const name = customCat.trim();
    if (!name) return;
    setExtraCats((prev) => (prev.includes(name) ? prev : [...prev, name]));
    setShowAddCat(false);
    setCustomCat("");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}>
          <Ionicons name="arrow-back" size={24} color={c.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Documents</Text>
          {!!userName && <Text style={styles.subtitle}>{userName}</Text>}
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowAddCat(true)}
        >
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.infoBanner}>
        <Ionicons name="information-circle-outline" size={16} color="#60a5fa" />
        <Text style={styles.infoBannerText}>
          One slot per category. Upload to attach a file, Replace to swap it,
          Verify to confirm an employee-supplied document. HR uploads are
          locked from the employee&apos;s side.
        </Text>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={c.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listWrap}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={c.accent}
              colors={[c.accent]}
            />
          }
        >
          {categories.map((cat) => {
            const doc = latestByCategory.get(cat);
            const req = requiredByCategory.get(cat);
            const note = pendingNotes[cat];
            const byHR = doc?.uploadedByRole === "HR";

            const status: "VERIFIED" | "IN_REVIEW" | "REQUIRED" | "OPTIONAL" =
              req?.status === "VERIFIED"
                ? "VERIFIED"
                : doc
                ? "IN_REVIEW"
                : req
                ? "REQUIRED"
                : "OPTIONAL";

            const tone =
              status === "VERIFIED"
                ? { bg: "rgba(22,163,74,0.12)", fg: "#16a34a" }
                : status === "IN_REVIEW"
                ? { bg: "rgba(96,165,250,0.12)", fg: "#60a5fa" }
                : status === "REQUIRED"
                ? { bg: "rgba(245,158,11,0.12)", fg: "#f59e0b" }
                : { bg: c.surfaceMuted, fg: c.textMuted };

            const statusLabel =
              status === "VERIFIED"
                ? "Verified"
                : status === "IN_REVIEW"
                ? byHR
                  ? "Uploaded by HR"
                  : "Awaiting verify"
                : status === "REQUIRED"
                ? "Required"
                : "Optional";

            // Can verify only when employee has uploaded and HR has marked
            // this category as required (and it isn't already verified).
            const canVerify =
              !!doc &&
              !byHR &&
              !!req &&
              req.status === "UPLOADED";

            return (
              <View key={cat} style={styles.catCard}>
                <View style={styles.catHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.catName}>{cat}</Text>
                    {!!req?.note && (
                      <Text style={styles.catReqNote} numberOfLines={2}>
                        HR note: {req.note}
                      </Text>
                    )}
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
                    <Text style={[styles.statusPillText, { color: tone.fg }]}>
                      {statusLabel}
                    </Text>
                  </View>
                  {doc && (
                    <TouchableOpacity
                      style={styles.cornerDelete}
                      onPress={() => onDelete(doc)}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={15}
                        color={c.dangerText}
                      />
                    </TouchableOpacity>
                  )}
                </View>

                {doc ? (
                  <View style={styles.fileBlock}>
                    <Ionicons
                      name="document-text-outline"
                      size={18}
                      color={c.textMuted}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fileName} numberOfLines={1}>
                        {doc.fileName}
                      </Text>
                      <Text style={styles.fileMeta}>
                        {doc.uploadedAt
                          ? `Uploaded ${String(doc.uploadedAt).slice(0, 10)}`
                          : "Uploaded"}
                        {" · "}
                        {byHR ? "by HR" : "by employee"}
                      </Text>
                      {!!doc.notes && (
                        <Text style={styles.fileNote} numberOfLines={2}>
                          Note: {doc.notes}
                        </Text>
                      )}
                    </View>
                  </View>
                ) : (
                  <View style={styles.emptyBlock}>
                    <Ionicons
                      name="cloud-upload-outline"
                      size={18}
                      color={c.textFaint}
                    />
                    <Text style={styles.emptyBlockText}>
                      No file from {userName || "employee"} yet
                    </Text>
                  </View>
                )}

                {!!note && !doc && (
                  <View style={styles.pendingNote}>
                    <Ionicons
                      name="chatbubble-ellipses-outline"
                      size={13}
                      color="#60a5fa"
                    />
                    <Text style={styles.pendingNoteText} numberOfLines={2}>
                      Note saved (will attach with next upload): {note}
                    </Text>
                  </View>
                )}

                {/* ACTION ROW — two buttons, state-dependent. */}
                <View style={styles.actionRow}>
                  {doc ? (
                    <>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionBtnGhost]}
                        onPress={() =>
                          doc.fileUrl
                            ? Linking.openURL(doc.fileUrl).catch(() => {})
                            : Alert.alert("No file URL on record")
                        }
                      >
                        <Ionicons name="eye-outline" size={16} color={c.text} />
                        <Text style={styles.actionBtnGhostText}>View</Text>
                      </TouchableOpacity>
                      {canVerify ? (
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.actionBtnVerify]}
                          onPress={() => onVerify(cat)}
                        >
                          <Ionicons
                            name="checkmark-circle-outline"
                            size={16}
                            color="#fff"
                          />
                          <Text style={styles.actionBtnVerifyText}>Verify</Text>
                        </TouchableOpacity>
                      ) : (
                        <FilePickButton
                          label="Replace"
                          style={styles.actionBtnPrimary}
                          onUploaded={(url, name) => onUploaded(cat, url, name)}
                        />
                      )}
                    </>
                  ) : (
                    <>
                      <FilePickButton
                        label="Upload"
                        style={styles.actionBtnPrimary}
                        onUploaded={(url, name) => onUploaded(cat, url, name)}
                      />
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionBtnGhost]}
                        onPress={() => openNoteFor(cat)}
                      >
                        <Ionicons
                          name="create-outline"
                          size={16}
                          color={c.text}
                        />
                        <Text style={styles.actionBtnGhostText}>
                          {note ? "Edit note" : "Note"}
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            );
          })}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}

      <WebModal
        visible={!!noteFor}
        onClose={() => setNoteFor(null)}
        title={`Note for ${noteFor ?? ""}`}
        size="sm"
        footer={
          <ModalActions align="spread">
            <TouchableOpacity
              style={[styles.btn, styles.btnGhost]}
              onPress={() => setNoteFor(null)}
            >
              <Text style={styles.btnGhostText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary]}
              onPress={saveNote}
            >
              <Text style={styles.btnPrimaryText}>Save</Text>
            </TouchableOpacity>
          </ModalActions>
        }
      >
        <Text style={styles.modalHint}>
          Saved with your next upload for this category.
        </Text>
        <TextInput
          style={[styles.input, { minHeight: 80, marginTop: 12 }]}
          value={noteDraft}
          onChangeText={setNoteDraft}
          multiline
          textAlignVertical="top"
          placeholder="e.g. verified original on 2026-05-22"
          placeholderTextColor={c.textFaint}
        />
      </WebModal>

      <WebModal
        visible={showAddCat}
        onClose={() => setShowAddCat(false)}
        title="Add a document slot"
        size="sm"
        footer={
          <ModalActions align="spread">
            <TouchableOpacity
              style={[styles.btn, styles.btnGhost]}
              onPress={() => setShowAddCat(false)}
            >
              <Text style={styles.btnGhostText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary]}
              onPress={addCustomCategory}
            >
              <Text style={styles.btnPrimaryText}>Add</Text>
            </TouchableOpacity>
          </ModalActions>
        }
      >
        <Text style={styles.modalHint}>
          For categories not in the standard list.
        </Text>
        <TextInput
          style={[styles.input, { marginTop: 12 }]}
          value={customCat}
          onChangeText={setCustomCat}
          placeholder="e.g. Visa, NDA"
          placeholderTextColor={c.textFaint}
        />
      </WebModal>
    </SafeAreaView>
  );
}

const makeStyles = (c: any) =>
  StyleSheet.create({
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
    subtitle: { color: c.textMuted, fontSize: 11, marginTop: 2 },
    addBtn: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: c.accent,
      alignItems: "center",
      justifyContent: "center" },
    infoBanner: {
      flexDirection: "row",
      alignItems: "flex-start",
      backgroundColor: "rgba(96,165,250,0.1)",
      borderColor: "rgba(96,165,250,0.35)",
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginHorizontal: 12,
      marginTop: 10,
      marginBottom: 4,
      borderRadius: 10,
      gap: 8 },
    infoBannerText: {
      color: "#bfdbfe",
      fontSize: 12,
      lineHeight: 17,
      flex: 1 },
    listWrap: { padding: 12, gap: 10 },

    catCard: {
      backgroundColor: c.surface,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: c.surfaceBorder },
    catHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      marginBottom: 10 },
    catName: { color: c.text, fontSize: 15, fontWeight: "800" },
    catReqNote: {
      color: c.textMuted,
      fontSize: 11,
      marginTop: 4,
      lineHeight: 15 },
    statusPill: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999 },
    statusPillText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
    cornerDelete: {
      width: 28,
      height: 28,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: c.surfaceMuted,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      marginLeft: 4 },

    fileBlock: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
      backgroundColor: c.surfaceMuted,
      borderRadius: 10,
      padding: 10,
      borderWidth: 1,
      borderColor: c.surfaceBorder },
    fileName: { color: c.text, fontSize: 13, fontWeight: "700" },
    fileMeta: { color: c.textMuted, fontSize: 11, marginTop: 2 },
    fileNote: { color: c.textMuted, fontSize: 11, marginTop: 4, lineHeight: 15 },

    emptyBlock: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: c.surfaceMuted,
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      borderStyle: "dashed" },
    emptyBlockText: { color: c.textFaint, fontSize: 12 },

    pendingNote: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: 8,
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: "rgba(96,165,250,0.1)" },
    pendingNoteText: { color: "#bfdbfe", fontSize: 11, flex: 1 },

    actionRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 12,
      alignItems: "stretch" },
    actionBtn: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 10,
      borderRadius: 10,
      gap: 6 },
    actionBtnGhost: {
      backgroundColor: c.surfaceMuted,
      borderWidth: 1,
      borderColor: c.surfaceBorder },
    actionBtnGhostText: { color: c.text, fontWeight: "700", fontSize: 13 },
    actionBtnVerify: { backgroundColor: "#16a34a" },
    actionBtnVerifyText: { color: "#fff", fontWeight: "800", fontSize: 13 },
    actionBtnPrimary: {
      flex: 1,
      alignSelf: "auto",
      justifyContent: "center",
      paddingVertical: 10 },

    modalWrap: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 18,
      backgroundColor: c.overlay },
    smallModal: {
      width: "100%",
      maxWidth: 420,
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 18,
      borderWidth: 1,
      borderColor: c.surfaceBorder },
    modalTitle: { color: c.text, fontSize: 16, fontWeight: "800" },
    modalHint: { color: c.textMuted, fontSize: 12, marginTop: 4 },
    input: {
      backgroundColor: c.surfaceMuted,
      color: c.text,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      minHeight: 42 },
    modalActions: { flexDirection: "row", gap: 10, marginTop: 14 },
    btn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: "center" },
    btnGhost: { backgroundColor: c.surfaceMuted },
    btnGhostText: { color: c.text, fontWeight: "700" },
    btnPrimary: { backgroundColor: c.accent },
    btnPrimaryText: { color: "#fff", fontWeight: "800" } });
