import React, { useEffect, useState, useCallback, useMemo } from "react";

import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  ScrollView,
  Platform,
  Linking } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { FilePickButton } from "../src/components/FilePickButton";
import { getMe } from "../src/services/api";
import {
  listMyDocuments,
  addMyDocument,
  deleteMyDocument,
  listMyRequiredDocuments,
  RequiredDocument } from "../src/services/documents";
import { EmployeeDocument, hasRole } from "../src/types";
import { confirmAction, notify } from "../src/utils/confirm";
import { useTheme } from "../src/theme/ThemeProvider";

// Categories the employee can self-manage. Salary Slip, Experience Letter,
// and Certification are HR-only and intentionally absent here.
const COMMON_CATEGORIES = [
  "PAN",
  "Aadhaar",
  "Resume",
  "Offer Letter",
  "Passport",
];

// Educational sub-categories. Surfaced as a single "Educational
// Certificates" group on the page; the user picks 10th / 12th / UG /
// PG / Ph.D when uploading. Stored on the backend under these exact
// category names.
const EDUCATIONAL_CATEGORIES = ["10th", "12th", "UG", "PG", "Ph.D"] as const;
const EDUCATIONAL_SET = new Set<string>(EDUCATIONAL_CATEGORIES);
// Categories HR may have flagged as required for this employee but
// which we no longer surface in the regular list (they were renamed or
// retired as part of the employee-facing simplification).
const HR_ONLY_CATEGORIES = new Set([
  "Salary Slip",
  "Experience Letter",
  "Certification",
  "Inter",
  "PhD",
]);

type DocStatus = "VERIFIED" | "IN_REVIEW" | "REQUIRED" | "OPTIONAL";

// Derives the display status + colour tone for a category from its
// latest doc and any HR requirement. Shared by the tile and the sheet.
function computeStatus(
  doc: EmployeeDocument | undefined,
  req: RequiredDocument | undefined,
  c: any
): { status: DocStatus; tone: { bg: string; fg: string }; label: string } {
  const lockedByHR = !!doc?.lockedByHR;
  const status: DocStatus =
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
  const label =
    status === "VERIFIED"
      ? "Verified"
      : status === "IN_REVIEW"
      ? lockedByHR
        ? "By HR"
        : "In review"
      : status === "REQUIRED"
      ? "Required"
      : "Optional";
  return { status, tone, label };
}

// Compact square tile for the 2-column grid. Tapping it opens the action
// sheet for that category.
function DocTile({
  cat,
  doc,
  req,
  hasNote,
  styles,
  c,
  onPress }: {
  cat: string;
  doc: EmployeeDocument | undefined;
  req: RequiredDocument | undefined;
  hasNote: boolean;
  styles: any;
  c: any;
  onPress: () => void;
}) {
  const { tone, label } = computeStatus(doc, req, c);
  const has = !!doc;
  return (
    <TouchableOpacity style={styles.tile} activeOpacity={0.85} onPress={onPress}>
      <View
        style={[
          styles.tileIcon,
          { backgroundColor: has ? tone.bg : c.surfaceMuted },
        ]}
      >
        <Ionicons
          name={has ? "document-text" : "cloud-upload-outline"}
          size={22}
          color={has ? tone.fg : c.textFaint}
        />
      </View>
      <Text style={styles.tileName} numberOfLines={2}>
        {cat}
      </Text>
      <View style={styles.tileStatusRow}>
        <View style={[styles.tileDot, { backgroundColor: tone.fg }]} />
        <Text
          style={[styles.tileStatusText, { color: tone.fg }]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
      {(!!req?.note || hasNote) && (
        <View style={styles.tileNoteBadge}>
          <Ionicons name="chatbubble-ellipses" size={11} color="#60a5fa" />
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function MyDocuments() {
  const router = useRouter();
  const { theme } = useTheme();
  const c = theme.colors;
  const styles = useMemo(() => makeStyles(c), [c]);
  const [items, setItems] = useState<EmployeeDocument[]>([]);
  const [required, setRequired] = useState<RequiredDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Only HR may add custom document slots; normal users just fill the
  // slots HR defines, so the header "+" is hidden for them.
  const [isHr, setIsHr] = useState(false);

  // Which category's action sheet is open (tile tap target).
  const [sheetCat, setSheetCat] = useState<string | null>(null);

  // Note buffers per-category, held in local state until the next upload
  // happens for that category. We don't persist note-only entries because
  // the backend requires fileUrl on every doc row.
  const [pendingNotes, setPendingNotes] = useState<Record<string, string>>({});
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  // Custom-category modal — for anything outside COMMON_CATEGORIES.
  const [showAddCat, setShowAddCat] = useState(false);
  const [customCat, setCustomCat] = useState("");
  const [extraCats, setExtraCats] = useState<string[]>([]);

  // Educational picker — clicking "Educational Certificates" shows a
  // sheet where the user picks 10th/12th/UG/PG/Ph.D to add as an upload
  // slot. We track which education slots are visible so the user only
  // sees ones they've opened (or already uploaded something for).
  const [showEducationalPicker, setShowEducationalPicker] = useState(false);
  const [educationalSlots, setEducationalSlots] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }
      const [data, req, me] = await Promise.all([
        listMyDocuments(token),
        listMyRequiredDocuments(token).catch(() => []),
        getMe(token).catch(() => null),
      ]);
      setItems(data || []);
      setRequired(req || []);
      setIsHr(hasRole(me, "HR"));
    } catch (err: any) {
      Alert.alert(
        "Couldn't load documents",
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

  // Latest uploaded doc per category. Backend is append-only and lists
  // newest first, so the first item we see wins.
  const latestByCategory = useMemo(() => {
    const map = new Map<string, EmployeeDocument>();
    for (const d of items) {
      if (!map.has(d.category)) map.set(d.category, d);
    }
    return map;
  }, [items]);

  // Top-level category rows = the standard employee list + anything HR
  // required + anything the employee already uploaded + custom extras,
  // MINUS the HR-only categories (shown to HR, hidden from employees)
  // and MINUS the educational sub-categories (they live in a separate
  // Educational Certificates group).
  const categories = useMemo(() => {
    const set = new Set<string>(COMMON_CATEGORIES);
    for (const r of required) set.add(r.category);
    for (const d of items) set.add(d.category);
    for (const c of extraCats) set.add(c);
    for (const cat of HR_ONLY_CATEGORIES) set.delete(cat);
    for (const cat of EDUCATIONAL_CATEGORIES) set.delete(cat);
    return Array.from(set);
  }, [required, items, extraCats]);

  // Educational slots to render: ones the user opened, ones HR required,
  // and ones already uploaded.
  const educationalCategories = useMemo(() => {
    const set = new Set<string>(educationalSlots);
    for (const r of required) {
      if (EDUCATIONAL_SET.has(r.category)) set.add(r.category);
    }
    for (const d of items) {
      if (EDUCATIONAL_SET.has(d.category)) set.add(d.category);
    }
    // Preserve the canonical ordering (10th → 12th → UG → PG → Ph.D).
    return EDUCATIONAL_CATEGORIES.filter((c) => set.has(c));
  }, [required, items, educationalSlots]);

  const requiredByCategory = useMemo(() => {
    const map = new Map<string, RequiredDocument>();
    for (const r of required) map.set(r.category, r);
    return map;
  }, [required]);

  const onUploaded = useCallback(
    async (category: string, url: string, fileName: string) => {
      try {
        const token = await AsyncStorage.getItem("token");
        if (!token) return;

        // Replace flow — delete the prior employee-owned doc for this
        // category before posting the new one, so the list stays clean.
        const prior = latestByCategory.get(category);
        if (prior && !prior.lockedByHR) {
          try {
            await deleteMyDocument(token, prior.id);
          } catch {
            // If the prior delete fails (network blip, race), continue —
            // the new upload still wins because we sort newest-first.
          }
        }

        const note = pendingNotes[category]?.trim();
        await addMyDocument(token, {
          category,
          fileName,
          fileUrl: url,
          notes: note || undefined });
        // Clear the pending note now that it's been attached to the doc.
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
    [latestByCategory, pendingNotes, load]
  );

  const onDelete = async (d: EmployeeDocument) => {
    const ok = await confirmAction({
      title: "Delete document?",
      message: d.fileName,
      confirmLabel: "Delete",
      destructive: true });
    if (!ok) return;
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await deleteMyDocument(token, d.id);
      setItems((prev) => prev.filter((x) => x.id !== d.id));
    } catch (err: any) {
      notify("Delete failed", err?.message || "");
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
        <Text style={styles.title}>My Documents</Text>
        {isHr ? (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setShowAddCat(true)}
          >
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 32 }} />
        )}
      </View>

      <View style={styles.infoBanner}>
        <Ionicons name="information-circle-outline" size={16} color="#60a5fa" />
        <Text style={styles.infoBannerText}>
          Each box is a document slot. Use Upload to attach a file, Note to
          leave a remark for HR, Replace to swap an existing file.
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
          {/* Personal / required documents — 2-column tile grid. */}
          <Text style={styles.sectionLabel}>DOCUMENTS</Text>
          <View style={styles.tileGrid}>
            {categories.map((cat) => (
              <DocTile
                key={cat}
                cat={cat}
                doc={latestByCategory.get(cat)}
                req={requiredByCategory.get(cat)}
                hasNote={!!pendingNotes[cat]}
                styles={styles}
                c={c}
                onPress={() => setSheetCat(cat)}
              />
            ))}
          </View>

          {/* Educational Certificates — same tile grid, plus an Add button
              that opens the 10th/12th/UG/PG/Ph.D picker. */}
          <View style={styles.eduGroupHeader}>
            <Ionicons name="school-outline" size={16} color={c.text} />
            <Text style={styles.eduGroupTitle}>Educational Certificates</Text>
            <TouchableOpacity
              style={styles.eduAddBtn}
              onPress={() => setShowEducationalPicker(true)}
            >
              <Ionicons name="add" size={14} color="#fff" />
              <Text style={styles.eduAddBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
          {educationalCategories.length === 0 ? (
            <View style={styles.eduEmpty}>
              <Text style={styles.eduEmptyText}>
                No certificate slots yet — tap Add to start with 10th, 12th,
                UG, PG or Ph.D.
              </Text>
            </View>
          ) : (
            <View style={styles.tileGrid}>
              {educationalCategories.map((cat) => (
                <DocTile
                  key={cat}
                  cat={cat}
                  doc={latestByCategory.get(cat)}
                  req={requiredByCategory.get(cat)}
                  hasNote={!!pendingNotes[cat]}
                  styles={styles}
                  c={c}
                  onPress={() => setSheetCat(cat)}
                />
              ))}
            </View>
          )}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}

      {/* Action sheet — opens when a document tile is tapped. Holds the
          full detail (file info, HR note) and the View/Replace/Upload/
          Note/Delete actions that used to live on each card. */}
      <Modal
        visible={!!sheetCat}
        animationType="slide"
        transparent
        onRequestClose={() => setSheetCat(null)}
      >
        <TouchableOpacity
          style={styles.sheetWrap}
          activeOpacity={1}
          onPress={() => setSheetCat(null)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.sheetCard}>
            {(() => {
              if (!sheetCat) return null;
              const doc = latestByCategory.get(sheetCat);
              const req = requiredByCategory.get(sheetCat);
              const note = pendingNotes[sheetCat];
              const lockedByHR = !!doc?.lockedByHR;
              const { tone, label } = computeStatus(doc, req, c);
              return (
                <>
                  <View style={styles.sheetHandle} />
                  <View style={styles.sheetHeader}>
                    <Text style={styles.sheetTitle}>{sheetCat}</Text>
                    <View
                      style={[styles.statusPill, { backgroundColor: tone.bg }]}
                    >
                      <Text style={[styles.statusPillText, { color: tone.fg }]}>
                        {label}
                      </Text>
                    </View>
                  </View>

                  {!!req?.note && (
                    <Text style={styles.catReqNote} numberOfLines={3}>
                      HR: {req.note}
                    </Text>
                  )}

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
                          {lockedByHR ? " · by HR" : " · by you"}
                        </Text>
                        {!!doc.notes && (
                          <Text style={styles.fileNote} numberOfLines={3}>
                            Note: {doc.notes}
                          </Text>
                        )}
                      </View>
                      {!lockedByHR && (
                        <TouchableOpacity
                          style={styles.cornerDelete}
                          onPress={() => {
                            const d = doc;
                            setSheetCat(null);
                            onDelete(d);
                          }}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={15}
                            color={c.dangerText}
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                  ) : (
                    <View style={styles.emptyBlock}>
                      <Ionicons
                        name="cloud-upload-outline"
                        size={18}
                        color={c.textFaint}
                      />
                      <Text style={styles.emptyBlockText}>No file yet</Text>
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
                        Note saved (attaches with next upload): {note}
                      </Text>
                    </View>
                  )}

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
                        {lockedByHR ? (
                          <View style={[styles.actionBtn, styles.actionBtnLocked]}>
                            <Ionicons
                              name="lock-closed-outline"
                              size={14}
                              color={c.textMuted}
                            />
                            <Text style={styles.actionBtnLockedText}>
                              Locked by HR
                            </Text>
                          </View>
                        ) : (
                          <FilePickButton
                            label="Replace"
                            style={styles.actionBtnPrimary}
                            onUploaded={(url, name) =>
                              onUploaded(sheetCat, url, name)
                            }
                          />
                        )}
                      </>
                    ) : (
                      <>
                        <FilePickButton
                          label="Upload"
                          style={styles.actionBtnPrimary}
                          onUploaded={(url, name) =>
                            onUploaded(sheetCat, url, name)
                          }
                        />
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.actionBtnGhost]}
                          onPress={() => {
                            const cat = sheetCat;
                            setSheetCat(null);
                            openNoteFor(cat);
                          }}
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
                </>
              );
            })()}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Educational sub-category picker */}
      <Modal
        visible={showEducationalPicker}
        animationType="fade"
        transparent
        onRequestClose={() => setShowEducationalPicker(false)}
      >
        <View style={styles.modalWrap}>
          <View style={styles.smallModal}>
            <Text style={styles.modalTitle}>Add educational certificate</Text>
            <Text style={styles.modalHint}>
              Pick a level. A new slot appears in Educational Certificates
              where you can upload the file.
            </Text>
            <View style={{ gap: 8, marginTop: 14 }}>
              {EDUCATIONAL_CATEGORIES.map((level) => {
                const already = educationalCategories.includes(level);
                return (
                  <TouchableOpacity
                    key={level}
                    disabled={already}
                    style={[
                      styles.eduPickRow,
                      already && { opacity: 0.5 },
                    ]}
                    onPress={() => {
                      setEducationalSlots((prev) =>
                        prev.includes(level) ? prev : [...prev, level]
                      );
                      setShowEducationalPicker(false);
                    }}
                  >
                    <Ionicons
                      name="ribbon-outline"
                      size={16}
                      color={c.text}
                    />
                    <Text style={styles.eduPickRowText}>{level}</Text>
                    {already && (
                      <Text style={styles.eduPickRowMeta}>Already added</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.btn, styles.btnGhost]}
                onPress={() => setShowEducationalPicker(false)}
              >
                <Text style={styles.btnGhostText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Note editor — small modal so we don't depend on Alert.prompt
          (which is iOS-only). */}
      <Modal
        visible={!!noteFor}
        animationType="fade"
        transparent
        onRequestClose={() => setNoteFor(null)}
      >
        <KeyboardAvoidingView
          behavior="padding"
          style={styles.modalWrap}
        >
          <View style={styles.smallModal}>
            <Text style={styles.modalTitle}>Note for {noteFor}</Text>
            <Text style={styles.modalHint}>
              This note is saved with your next upload for this category.
            </Text>
            <TextInput
              style={[styles.input, { minHeight: 80, marginTop: 12 }]}
              value={noteDraft}
              onChangeText={setNoteDraft}
              multiline
              textAlignVertical="top"
              placeholder="e.g. will provide next week"
              placeholderTextColor={c.textFaint}
            />
            <View style={styles.modalActions}>
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
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add custom category — lets the employee add a slot for something
          outside the standard list (e.g. visa, vaccination card). */}
      <Modal
        visible={showAddCat}
        animationType="fade"
        transparent
        onRequestClose={() => setShowAddCat(false)}
      >
        <KeyboardAvoidingView
          behavior="padding"
          style={styles.modalWrap}
        >
          <View style={styles.smallModal}>
            <Text style={styles.modalTitle}>Add a document slot</Text>
            <Text style={styles.modalHint}>
              For categories not in the standard list.
            </Text>
            <TextInput
              style={[styles.input, { marginTop: 12 }]}
              value={customCat}
              onChangeText={setCustomCat}
              placeholder="e.g. Visa, Vaccination"
              placeholderTextColor={c.textFaint}
            />
            <View style={styles.modalActions}>
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
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    title: { color: c.text, fontSize: 18, fontWeight: "800", flex: 1 },
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
    listWrap: { padding: 12 },

    sectionLabel: {
      color: c.textMuted,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.2,
      marginLeft: 4,
      marginBottom: 10 },

    // 2-column tile grid.
    tileGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      columnGap: 10,
      rowGap: 10 },
    tile: {
      width: "48%",
      flexGrow: 1,
      backgroundColor: c.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      padding: 14,
      minHeight: 124,
      justifyContent: "flex-start",
      position: "relative" },
    tileIcon: {
      width: 42,
      height: 42,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 10 },
    tileName: {
      color: c.text,
      fontSize: 14,
      fontWeight: "800",
      marginBottom: 8 },
    tileStatusRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginTop: "auto" },
    tileDot: { width: 7, height: 7, borderRadius: 4 },
    tileStatusText: { fontSize: 11, fontWeight: "700", flex: 1 },
    tileNoteBadge: {
      position: "absolute",
      top: 12,
      right: 12,
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(96,165,250,0.14)" },

    // Bottom action sheet.
    sheetWrap: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: c.overlay },
    sheetCard: {
      backgroundColor: c.surface,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      padding: 18,
      paddingBottom: 28,
      borderTopWidth: 1,
      borderColor: c.surfaceBorder },
    sheetHandle: {
      alignSelf: "center",
      width: 38,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.surfaceBorder,
      marginBottom: 14 },
    sheetHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      marginBottom: 10 },
    sheetTitle: {
      color: c.text,
      fontSize: 18,
      fontWeight: "800",
      flex: 1 },

    // One rectangle per category — the heart of the new design.
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
    actionBtnLocked: {
      backgroundColor: c.surfaceMuted,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      opacity: 0.7 },
    actionBtnLockedText: { color: c.textMuted, fontSize: 12, fontWeight: "700" },
    // Style override for FilePickButton — flex:1 + center so it sits
    // beside the ghost button as an equal-width column.
    actionBtnPrimary: {
      flex: 1,
      alignSelf: "auto",
      justifyContent: "center",
      paddingVertical: 10 },
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

    // Shared modal styles for note + add-category dialogs.
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
    btnPrimaryText: { color: "#fff", fontWeight: "800" },

    eduGroup: {
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      padding: 12 },
    eduGroupHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 4,
      marginTop: 22,
      paddingBottom: 10 },
    eduGroupTitle: {
      color: c.text,
      fontSize: 14,
      fontWeight: "800",
      flex: 1 },
    eduAddBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: c.accent },
    eduAddBtnText: { color: "#fff", fontSize: 12, fontWeight: "800" },
    eduEmpty: {
      paddingHorizontal: 10,
      paddingVertical: 14 },
    eduEmptyText: {
      color: c.textMuted,
      fontSize: 12,
      lineHeight: 17 },
    eduPickRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 11,
      borderRadius: 10,
      backgroundColor: c.surfaceMuted,
      borderWidth: 1,
      borderColor: c.surfaceBorder },
    eduPickRowText: { color: c.text, fontSize: 13, fontWeight: "700", flex: 1 },
    eduPickRowMeta: {
      color: c.textMuted,
      fontSize: 11,
      fontStyle: "italic" } });
